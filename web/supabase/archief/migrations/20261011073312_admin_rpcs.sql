-- Live migratie 20261011073312 (admin_rpcs), letterlijk uit supabase_migrations.schema_migrations.statements
-- (opgehaald 8 november 2026, review R5). Niet wijzigen: dit is de geschiedenis zoals live toegepast.

create or replace function public.admin_overview()
returns jsonb language plpgsql security definer set search_path = '' stable as $$
declare out jsonb;
begin
  if not public.is_admin() then raise exception 'Geen toegang'; end if;
  select jsonb_build_object(
    'places', (select jsonb_build_object(
        'total', count(*),
        'published', count(*) filter (where status = 'published'),
        'draft', count(*) filter (where status = 'draft'),
        'hidden', count(*) filter (where status = 'hidden'),
        'locked', count(*) filter (where status_locked),
        'near', count(*) filter (where status = 'draft' and completeness >= 0.7),
        'with_website', count(*) filter (where website is not null)
      ) from public.places),
    'buckets', (select coalesce(jsonb_agg(jsonb_build_object('from', b, 'count', c) order by b), '[]') from (
        select floor(completeness * 10) / 10 as b, count(*) c from public.places group by 1) x),
    'coverage', (select jsonb_build_object(
        'price', count(*) filter (where price_eur is not null),
        'power', count(*) filter (where power is not null),
        'water', count(*) filter (where water is not null),
        'dump_station', count(*) filter (where dump_station is not null),
        'toilet', count(*) filter (where toilet is not null),
        'shower', count(*) filter (where shower is not null),
        'wifi', count(*) filter (where wifi is not null),
        'dogs', count(*) filter (where dogs is not null),
        'capacity', count(*) filter (where capacity is not null),
        'season', count(*) filter (where open_all_year is not null or season is not null),
        'photos', count(*) filter (where jsonb_array_length(coalesce(photos, '[]')) > 0 or image_url is not null),
        'description', count(*) filter (where description is not null),
        'phone', count(*) filter (where phone is not null),
        'total', count(*)
      ) from public.places),
    'kinds', (select jsonb_object_agg(kind, c) from (select kind, count(*) c from public.places where status = 'published' group by 1) k),
    'provinces', (select jsonb_object_agg(province, c) from (select coalesce(province, 'onbekend') province, count(*) c from public.places where status = 'published' group by 1) k),
    'scrape', (select jsonb_build_object(
        'queued', count(*) filter (where done_at is null and attempts < 3),
        'done', count(*) filter (where done_at is not null and last_error is null),
        'failed', count(*) filter (where last_error is not null),
        'last', max(done_at)
      ) from private.scrape_queue),
    'osm', (select coalesce(jsonb_agg(jsonb_build_object('code', code, 'name', name, 'last_run_at', last_run_at, 'busy', places_req is not null) order by name), '[]') from public.osm_regions),
    'support', jsonb_build_object(
        'open_tickets', (select count(*) from public.tickets where status in ('open', 'in-behandeling')),
        'pending_reviews', (select count(*) from public.reviews where status = 'pending'),
        'new_submissions', (select count(*) from public.submissions where status = 'nieuw'),
        'errors_24h', (select count(*) from public.app_logs where level = 'error' and ts > now() - interval '24 hours')
      ),
    'traffic', (select coalesce(jsonb_agg(jsonb_build_object('day', d, 'views', v, 'sessions', s, 'searches', q, 'outbound', o) order by d), '[]') from (
        select date_trunc('day', ts)::date d,
               count(*) filter (where name = 'page_view') v,
               count(distinct session_id) s,
               count(*) filter (where name = 'search') q,
               count(*) filter (where name = 'outbound') o
          from public.events where ts > now() - interval '14 days' group by 1) t),
    'top_pages', (select coalesce(jsonb_agg(jsonb_build_object('path', path, 'views', c) order by c desc), '[]') from (
        select path, count(*) c from public.events where name = 'page_view' and ts > now() - interval '30 days' group by 1 order by 2 desc limit 10) t),
    'consent', (select jsonb_build_object(
        'total', count(*),
        'analytics', count(*) filter (where analytics),
        'marketing', count(*) filter (where marketing),
        'last_30d', count(*) filter (where ts > now() - interval '30 days')
      ) from public.consent_log)
  ) into out;
  return out;
end $$;

create or replace function public.admin_pipeline(p_action text)
returns text language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  if not public.is_admin() then raise exception 'Geen toegang'; end if;
  if p_action = 'scrape-missing' then
    perform public.enqueue_scrape(true);
  elsif p_action = 'scrape-all' then
    perform public.enqueue_scrape(false);
  elsif p_action = 'osm-refresh' then
    update public.osm_regions set last_run_at = null where places_req is null;
  elsif p_action = 'recompute' then
    update public.places set updated_at = now();
  else
    raise exception 'Onbekende actie %', p_action;
  end if;
  get diagnostics n = row_count;
  insert into public.audit_log (actor, actor_email, action, entity, entity_id, details)
  values (auth.uid(), (select email from public.admins where user_id = auth.uid()), 'pipeline', 'pipeline', p_action, '{}'::jsonb);
  return 'ok';
end $$;

revoke all on function public.admin_overview() from public, anon;
revoke all on function public.admin_pipeline(text) from public, anon;
grant execute on function public.admin_overview() to authenticated;
grant execute on function public.admin_pipeline(text) to authenticated;
