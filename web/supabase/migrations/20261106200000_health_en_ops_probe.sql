-- Review november 2026, R1 en R3 (DB-04, DB-05): fouten zichtbaar maken.
--
-- 1. public.health(): openbare tellingen voor de bewaking (.github/workflows/monitor.yml). Alleen aantallen, geen rijen:
--    gepubliceerde plekken, met vertrekregel, met prijs, laatste scrape, aanroepen via pg_net en hoeveel daarvan
--    mislukten (5xx, time-out of netwerkfout), fouten in app_logs, en de grootte van de database. pg_net bewaart
--    antwoorden maar een paar uur: `net_calls_24h` telt dus wat er nog is.
-- 2. private.ops_probe():
--    - een controle is alleen "ok" bij HTTP 200 zonder doorverwijzing (Location-header) en, waar opgegeven, met de
--      verwachte inhoud. De site achter Vercel-login gaf 200 met een loginpagina en telde als goed (R1);
--    - de Overpass-controle is weg: de openbare server is vaak vol (491 van 491 rood sinds 2 november) en zegt niets
--      over de site. Mislukte Overpass-rondes meldt collect_osm zelf in app_logs (level error vanaf poging 4), en die
--      telt health() mee;
--    - mislukte pg_net-aanroepen (edge functions, Overpass) komen in admin_logs als in het afgelopen uur meer dan 20%
--      faalde (minimaal 10 aanroepen), hooguit één regel per uur. De cron meldt die runs als "succeeded".
-- Live pas toepassen na samenvoegen (CLAUDE.md).

create or replace function public.health() returns jsonb
 language sql stable security definer set search_path to ''
as $$
  select jsonb_build_object(
    'ts', now(),
    'published', p.published,
    'with_departure', p.with_departure,
    'with_price', p.with_price,
    'last_scrape', p.last_scrape,
    'net_calls_24h', n.total,
    'net_failed_24h', n.failed,
    'app_errors_24h', (select count(*) from public.app_logs where level = 'error' and ts > now() - interval '24 hours'),
    'db_bytes', pg_database_size(current_database())
  )
  from (select count(*) filter (where status = 'published') as published,
               count(*) filter (where status = 'published' and departure is not null) as with_departure,
               count(*) filter (where status = 'published' and price_eur is not null) as with_price,
               max(last_scraped_at) as last_scrape
          from public.places) p,
       (select count(*) as total,
               count(*) filter (where r.timed_out or r.error_msg is not null or r.status_code >= 500) as failed
          from net._http_response r
         where r.created > now() - interval '24 hours'
           -- de eigen controles van ops_probe (externe diensten) tellen hier niet mee
           and not exists (select 1 from public.admin_logs l where l.kind = 'api' and l.request_id = r.id)) n;
$$;
revoke all on function public.health() from public;
grant execute on function public.health() to anon, authenticated, service_role;

create or replace function private.ops_probe() returns jsonb
 language plpgsql security definer set search_path to ''
as $$
declare
  t record;
  rid bigint;
  last_run bigint;
  n_resolved integer;
  n_cron integer;
  net_total integer;
  net_failed integer;
begin
  -- Antwoorden van de vorige ronde: alleen 200 zonder doorverwijzing en met de verwachte inhoud is goed
  update public.admin_logs l
     set status = case when r.status_code = 200 and not coalesce(r.timed_out, false) and r.error_msg is null
                            and not y.doorverwezen
                            and (l.details ->> 'expect' is null or coalesce(r.content, '') ~ (l.details ->> 'expect'))
                       then 'ok' else 'failed' end,
         http_status = r.status_code,
         duration_ms = greatest(0, (extract(epoch from r.created - l.ts) * 1000)::integer),
         message = coalesce(left(r.error_msg, 300), case when r.timed_out then 'time-out' end,
                            case when r.status_code = 200 and y.doorverwezen then 'HTTP 200 met doorverwijzing (login of verhuisd?)'
                                 when r.status_code = 200 and l.details ->> 'expect' is not null
                                      and coalesce(r.content, '') !~ (l.details ->> 'expect') then 'HTTP 200 met onverwachte inhoud' end,
                            'HTTP ' || r.status_code)
    from net._http_response r,
         lateral (select exists (select 1 from jsonb_object_keys(case when jsonb_typeof(r.headers) = 'object' then r.headers else '{}' end) k
                                  where lower(k) = 'location') as doorverwezen) y
   where l.status = 'pending' and l.kind = 'api' and r.id = l.request_id;
  get diagnostics n_resolved = row_count;
  update public.admin_logs set status = 'failed', message = 'Geen antwoord binnen 30 minuten'
   where status = 'pending' and kind = 'api' and ts < now() - interval '30 minutes';

  -- expect: reguliere expressie die de inhoud moet bevatten (leeg = elke inhoud)
  for t in select * from (values
      ('pdok', 'https://api.pdok.nl/bzk/locatieserver/search/v3_1/suggest?q=utrecht&rows=1', '"response"'),
      ('osrm', 'https://routing.openstreetmap.de/routed-car/route/v1/driving/5.12,52.09;5.38,52.24?overview=false', '"code"\s*:\s*"Ok"'),
      ('openfreemap', 'https://tiles.openfreemap.org/styles/liberty', null),
      ('wsrv', 'https://wsrv.nl/?url=wsrv.nl/lichtenstein.jpg&w=16', null),
      ('site', 'https://camperdashboard-vrijstaan.vercel.app/api/towns', '^\s*\[')
    ) as v(source, url, expect) loop
    rid := net.http_get(url := t.url, timeout_milliseconds := 15000);
    insert into public.admin_logs (kind, source, status, request_id, details)
    values ('api', t.source, 'pending', rid, jsonb_strip_nulls(jsonb_build_object('url', t.url, 'expect', t.expect)));
  end loop;

  -- Aanroepen via pg_net (edge functions, Overpass) van het afgelopen uur, zonder de controles hierboven
  select count(*), count(*) filter (where r.timed_out or r.error_msg is not null or r.status_code >= 500)
    into net_total, net_failed
    from net._http_response r
   where r.created > now() - interval '1 hour'
     and not exists (select 1 from public.admin_logs l where l.kind = 'api' and l.request_id = r.id);
  if net_total >= 10 and net_failed > net_total * 0.2
     and not exists (select 1 from public.admin_logs where kind = 'api' and source = 'pg_net' and ts > now() - interval '55 minutes') then
    insert into public.admin_logs (kind, source, status, message, details)
    values ('api', 'pg_net', 'failed',
            format('%s van %s aanroepen via pg_net mislukten in het afgelopen uur (5xx, time-out of netwerkfout)', net_failed, net_total),
            jsonb_build_object('failed', net_failed, 'total', net_total));
  end if;

  select coalesce(max((details ->> 'runid')::bigint), 0) into last_run from public.admin_logs where kind = 'cron';
  insert into public.admin_logs (ts, kind, source, status, message, details)
  select d.start_time, 'cron', j.jobname, 'failed', left(d.return_message, 1000),
         jsonb_build_object('runid', d.runid, 'job', j.jobid)
    from cron.job_run_details d join cron.job j using (jobid)
   where d.runid > last_run and d.status = 'failed';
  get diagnostics n_cron = row_count;
  if last_run = 0 and n_cron = 0 then
    -- Watermerk zetten, zodat een eerste ronde zonder fouten niet steeds alles opnieuw bekijkt
    insert into public.admin_logs (kind, source, status, message, details)
    select 'cron', 'pg_cron', 'ok', 'Bewaking gestart', jsonb_build_object('runid', coalesce(max(runid), 0))
      from cron.job_run_details;
  end if;

  delete from public.admin_logs where (status = 'ok' and ts < now() - interval '30 days') or ts < now() - interval '180 days';
  return jsonb_build_object('resolved', n_resolved, 'cron_failed', n_cron, 'net_total', net_total, 'net_failed', net_failed);
end $$;
revoke all on function private.ops_probe() from public, anon, authenticated;
