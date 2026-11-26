-- Beheerdashboard (opdracht Patrick, 26 november 2026): alles voor het nieuwe overzicht in één aanroep. Werkvoorraad per
-- wachtrij, de kernbelofte, de stand van de API's (ops_probe), de geplande taken (cron), fouten van de laatste 24 uur,
-- recente beheerbesluiten en openstaande updates. Alleen lezen; alleen voor beheerders.
create or replace function public.admin_dashboard()
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $$
declare
  out jsonb;
begin
  if not public.is_admin() then raise exception 'Geen toegang' using errcode = '42501'; end if;

  select jsonb_build_object(
    'generated_at', now(),

    -- Kernbelofte: vertrekregel, zonder vaste vertrektijd en prijs, op gepubliceerde plekken (doel 90%, PRD)
    'core', (select jsonb_build_object(
        'published', count(*),
        'departure', count(*) filter (where departure is not null),
        'free', count(*) filter (where departure in ('vrij', 'per24')),
        'price', count(*) filter (where price_eur is not null),
        'goal', 0.9)
      from public.places where status = 'published' and merged_into is null),
    'drafts', (select count(*) from public.places where status = 'draft' and merged_into is null),

    -- Werkvoorraad: aantal en de oudste per wachtrij
    'queues', jsonb_build_array(
      (select jsonb_build_object('key', 'triage', 'count', count(*), 'oldest', min(created_at))
         from public.updates_queue where status = 'pending'),
      (select jsonb_build_object('key', 'vertrektijden', 'count', count(*), 'oldest', min(updated_at))
         from public.places where departure in ('vrij', 'per24') and departure_check is null and status <> 'hidden' and merged_into is null),
      (select jsonb_build_object('key', 'inzendingen', 'count', count(*), 'oldest', min(created_at))
         from public.submissions where status = 'nieuw'),
      (select jsonb_build_object('key', 'support', 'count', count(*), 'oldest', min(created_at))
         from public.tickets where status in ('open', 'in-behandeling', 'wacht-op-klant')),
      (select jsonb_build_object('key', 'reviews', 'count', count(*), 'oldest', min(created_at))
         from public.reviews where status = 'pending'),
      (select jsonb_build_object('key', 'fotos', 'count', count(*), 'oldest', min(created_at))
         from public.place_photos where status = 'pending'),
      (select jsonb_build_object('key', 'kandidaten', 'count', count(*), 'oldest', min(created_at))
         from public.discovery_candidates where status = 'nieuw')),
    'triage_sources', (select coalesce(jsonb_object_agg(source, n), '{}') from (
        select source, count(*) n from public.updates_queue where status = 'pending' group by source) s),

    -- Binnenkomend: de nieuwste open items over alle wachtrijen
    'incoming', (select coalesce(jsonb_agg(i order by i ->> 'at' desc), '[]') from (
        (select jsonb_build_object('kind', 'triage', 'at', u.created_at, 'title', p.name, 'detail', u.field_changed, 'source', u.source) i
           from public.updates_queue u join public.places p on p.id = u.place_id
          where u.status = 'pending' order by u.created_at desc limit 8)
        union all
        (select jsonb_build_object('kind', 'inzendingen', 'at', s.created_at, 'title', coalesce(p.name, s.payload ->> 'naam', 'Nieuwe plek'), 'detail', s.kind, 'source', 'bezoeker')
           from public.submissions s left join public.places p on p.id = s.place_id
          where s.status = 'nieuw' order by s.created_at desc limit 8)
        union all
        (select jsonb_build_object('kind', 'support', 'at', t.updated_at, 'title', t.subject, 'detail', t.status, 'source', 'support')
           from public.tickets t where t.status in ('open', 'in-behandeling', 'wacht-op-klant') order by t.updated_at desc limit 8)
        union all
        (select jsonb_build_object('kind', 'reviews', 'at', r.created_at, 'title', p.name, 'detail', r.rating::text, 'source', 'bezoeker')
           from public.reviews r join public.places p on p.id = r.place_id
          where r.status = 'pending' order by r.created_at desc limit 8)
      ) x),

    -- API's: de laatste afgeronde meting per bron (ops_probe, elke 10 minuten) en de mislukte van 24 uur
    'apis', (select coalesce(jsonb_agg(a order by a ->> 'source'), '[]') from (
        select jsonb_build_object(
                 'source', l.source, 'status', l.status, 'at', l.ts, 'http', l.http_status, 'ms', l.duration_ms, 'message', l.message,
                 'failed_24h', (select count(*) from public.admin_logs f where f.kind = 'api' and f.source = l.source and f.status = 'failed' and f.ts > now() - interval '24 hours'),
                 'total_24h', (select count(*) from public.admin_logs f where f.kind = 'api' and f.source = l.source and f.status <> 'pending' and f.ts > now() - interval '24 hours')) a
          from (select distinct on (source) * from public.admin_logs
                 where kind = 'api' and status <> 'pending' order by source, ts desc) l) x),

    -- Geplande taken (pg_cron): aan of uit, laatste run en mislukte runs van 24 uur
    'jobs', (select coalesce(jsonb_agg(jsonb_build_object(
                 'name', j.jobname, 'active', j.active, 'schedule', j.schedule,
                 'last', d.last_start, 'last_status', d.last_status, 'failed_24h', coalesce(d.failed, 0)) order by j.jobname), '[]')
       from cron.job j
       left join lateral (
         select max(r.start_time) last_start,
                (array_agg(r.status order by r.start_time desc))[1] last_status,
                count(*) filter (where r.status = 'failed' and r.start_time > now() - interval '24 hours') failed
           from cron.job_run_details r where r.jobid = j.jobid and r.start_time > now() - interval '7 days') d on true),

    -- Fouten en waarschuwingen van de laatste 24 uur, per bron, met de nieuwste meldingen
    'errors', (select jsonb_build_object(
        'by_source', (select coalesce(jsonb_agg(jsonb_build_object('source', source, 'level', level, 'count', n) order by n desc), '[]')
                        from (select source, level, count(*) n from public.app_logs
                               where ts > now() - interval '24 hours' and level in ('error', 'warn') group by 1, 2) e),
        'latest', (select coalesce(jsonb_agg(jsonb_build_object('at', ts, 'level', level, 'source', source, 'message', left(message, 220)) order by ts desc), '[]')
                     from (select * from public.app_logs where ts > now() - interval '24 hours' and level in ('error', 'warn')
                            order by ts desc limit 6) e))),

    -- Recente besluiten van beheer
    'decided_24h', (select jsonb_build_object(
        'approved', count(*) filter (where status = 'approved'),
        'rejected', count(*) filter (where status = 'rejected'))
      from public.updates_queue where decided_at > now() - interval '24 hours'),
    -- Alleen besluiten, niet de automatische regels van de tabeltrigger (action update/insert/delete)
    'activity', (select coalesce(jsonb_agg(jsonb_build_object(
                    'at', a.ts, 'action', a.action, 'entity', a.entity, 'who', a.actor_email, 'place', p.name,
                    'field', a.details ->> 'veld', 'note', left(a.details ->> 'notitie', 160)) order by a.ts desc), '[]')
       from (select * from public.audit_log where action not in ('update', 'insert', 'delete') order by ts desc limit 60) a
       left join public.places p on p.id::text = a.entity_id),

    -- Updates van de app (Dependabot-radar) die nog open staan
    'updates', (select coalesce(jsonb_agg(jsonb_build_object(
                   'package', package_name, 'from', version_from, 'to', version_to, 'type', update_type,
                   'status', status, 'advice', left(ai_advice, 200), 'pr', pr_number, 'url', pr_url, 'at', created_at) order by created_at desc), '[]')
       from (select * from public.dependency_updates where status not in ('merged', 'closed', 'done', 'ignored')
              order by created_at desc limit 10) u)
  ) into out;
  return out;
end $$;

revoke all on function public.admin_dashboard() from public, anon, authenticated, service_role;
grant execute on function public.admin_dashboard() to authenticated;
grant execute on function public.admin_dashboard() to service_role;
