-- Live migratie 20261011131839 (admin_stats), letterlijk uit supabase_migrations.schema_migrations.statements
-- (opgehaald 8 november 2026, review R5). Niet wijzigen: dit is de geschiedenis zoals live toegepast.

create or replace function public.admin_stats(p_days int default 30)
 returns jsonb language plpgsql stable security definer set search_path to ''
as $$
declare d int := greatest(1, least(coalesce(p_days, 30), 400)); since timestamptz := now() - make_interval(days => d);
begin
  if not public.is_admin() then raise exception 'Geen toegang'; end if;
  return jsonb_build_object(
    'days', d,
    'totals', (select jsonb_build_object(
        'page_views', count(*) filter (where name = 'page_view'),
        'sessions', count(distinct session_id),
        'searches', count(*) filter (where name = 'search'),
        'place_views', count(*) filter (where name = 'place_view'),
        'outbound', count(*) filter (where name = 'outbound'),
        'routes', count(*) filter (where name = 'route'),
        'saves', count(*) filter (where name = 'save'))
      from public.events where ts >= since),
    'per_day', (select coalesce(jsonb_agg(x order by x->>'day'), '[]') from (
        select jsonb_build_object('day', to_char(date_trunc('day', ts at time zone 'Europe/Amsterdam'), 'YYYY-MM-DD'),
          'page_views', count(*) filter (where name = 'page_view'), 'sessions', count(distinct session_id)) x
        from public.events where ts >= since group by date_trunc('day', ts at time zone 'Europe/Amsterdam')) s),
    'top_pages', (select coalesce(jsonb_agg(jsonb_build_object('path', path, 'n', n) order by n desc), '[]') from (
        select path, count(*) n from public.events where ts >= since and name = 'page_view' group by path order by n desc limit 15) s),
    'top_searches', (select coalesce(jsonb_agg(jsonb_build_object('q', q, 'n', n) order by n desc), '[]') from (
        select lower(trim(props->>'q')) q, count(*) n from public.events
        where ts >= since and name = 'search' and coalesce(trim(props->>'q'), '') <> '' group by 1 order by n desc limit 15) s),
    'top_places', (select coalesce(jsonb_agg(jsonb_build_object('slug', slug, 'name', name, 'views', views, 'routes', routes, 'outbound', outbound) order by views desc), '[]') from (
        select coalesce(e.props->>'slug', '') slug, max(p.name) name,
          count(*) filter (where e.name = 'place_view') views, count(*) filter (where e.name = 'route') routes,
          count(*) filter (where e.name = 'outbound') outbound
        from public.events e left join public.places p on p.slug = e.props->>'slug'
        where e.ts >= since and e.name in ('place_view','route','outbound') and e.props ? 'slug'
        group by 1 order by views desc limit 15) s),
    'consent', (select jsonb_build_object('total', count(*), 'analytics', count(*) filter (where analytics))
        from (select distinct on (consent_id) consent_id, analytics from public.consent_log where ts >= since order by consent_id, ts desc) c)
  );
end $$;
revoke all on function public.admin_stats(int) from public, anon;
grant execute on function public.admin_stats(int) to authenticated;
