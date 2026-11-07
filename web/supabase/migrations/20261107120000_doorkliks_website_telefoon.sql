-- Review R45: de hoofdmaat uit de PRD apart meten. Doorkliks naar website en telefoon zijn 'outbound' met
-- props.soort 'website' of 'telefoon'; een route openen is een eigen 'route'-event met props.app. Oude events tellen
-- eerlijk mee: tot deze wijziging was een route 'outbound' met soort 'route', en 'route' zonder app was alleen
-- "rijtijd berekend" (geen route geopend, dus niet meer geteld).
-- public.track hoeft niet te veranderen: 'outbound' en 'route' zijn al toegestaan.
-- Pas live toepassen nadat de bijbehorende code is samengevoegd (CLAUDE.md). De oude pagina leest alleen
-- totals.outbound/routes en top_places.outbound/routes; die blijven bestaan.

create or replace function private.is_contact_click(e public.events) returns boolean
language sql immutable set search_path = '' as $$
  select e.name = 'outbound' and coalesce(e.props->>'soort', '') in ('website', 'telefoon')
$$;

create or replace function private.is_route_open(e public.events) returns boolean
language sql immutable set search_path = '' as $$
  select (e.name = 'route' and e.props ? 'app') or (e.name = 'outbound' and e.props->>'soort' = 'route')
$$;

revoke all on function private.is_contact_click(public.events) from public, anon, authenticated;
revoke all on function private.is_route_open(public.events) from public, anon, authenticated;

create or replace function public.admin_stats(p_days integer default 30)
 returns jsonb
 language plpgsql
 stable security definer
 set search_path to ''
as $function$
declare d int := greatest(1, least(coalesce(p_days, 30), 400)); since timestamptz := now() - make_interval(days => d);
begin
  if not public.is_admin() then raise exception 'Geen toegang'; end if;
  return jsonb_build_object(
    'days', d,
    'totals', (select jsonb_build_object(
        'page_views', count(*) filter (where e.name = 'page_view'),
        'sessions', count(distinct e.session_id),
        'searches', count(*) filter (where e.name = 'search'),
        'place_views', count(*) filter (where e.name = 'place_view'),
        'outbound', count(*) filter (where private.is_contact_click(e)),
        'websites', count(*) filter (where private.is_contact_click(e) and e.props->>'soort' = 'website'),
        'phones', count(*) filter (where private.is_contact_click(e) and e.props->>'soort' = 'telefoon'),
        'routes', count(*) filter (where private.is_route_open(e)),
        'saves', count(*) filter (where e.name = 'save'))
      from public.events e where e.ts >= since),
    'per_day', (select coalesce(jsonb_agg(x order by x->>'day'), '[]') from (
        select jsonb_build_object('day', to_char(date_trunc('day', ts at time zone 'Europe/Amsterdam'), 'YYYY-MM-DD'),
          'page_views', count(*) filter (where name = 'page_view'), 'sessions', count(distinct session_id)) x
        from public.events where ts >= since group by date_trunc('day', ts at time zone 'Europe/Amsterdam')) s),
    'top_pages', (select coalesce(jsonb_agg(jsonb_build_object('path', path, 'n', n) order by n desc), '[]') from (
        select path, count(*) n from public.events where ts >= since and name = 'page_view' group by path order by n desc limit 15) s),
    'top_searches', (select coalesce(jsonb_agg(jsonb_build_object('q', q, 'n', n) order by n desc), '[]') from (
        select lower(trim(coalesce(props->>'q', props->>'waar', props->>'provincie'))) q, count(*) n from public.events
        where ts >= since and name = 'search' and coalesce(trim(coalesce(props->>'q', props->>'waar', props->>'provincie')), '') <> '' group by 1 order by n desc limit 15) s),
    'top_places', (select coalesce(jsonb_agg(jsonb_build_object('slug', slug, 'name', name, 'views', views, 'routes', routes, 'outbound', outbound,
          'websites', websites, 'phones', phones) order by views desc), '[]') from (
        select coalesce(e.props->>'slug', substring(e.path from '^/plek/([^/?#]+)')) slug, max(p.name) name,
          count(*) filter (where e.name = 'place_view') views,
          count(*) filter (where private.is_route_open(e)) routes,
          count(*) filter (where private.is_contact_click(e)) outbound,
          count(*) filter (where private.is_contact_click(e) and e.props->>'soort' = 'website') websites,
          count(*) filter (where private.is_contact_click(e) and e.props->>'soort' = 'telefoon') phones
        from public.events e left join public.places p on p.slug = coalesce(e.props->>'slug', substring(e.path from '^/plek/([^/?#]+)'))
        where e.ts >= since and e.name in ('place_view','route','outbound') and (e.props ? 'slug' or e.path like '/plek/%')
        group by 1 order by views desc limit 15) s),
    'consent', (select jsonb_build_object('total', count(*), 'analytics', count(*) filter (where analytics))
        from (select distinct on (consent_id) consent_id, analytics from public.consent_log where ts >= since order by consent_id, ts desc) c)
  );
end $function$;

-- Overzicht in beheer: "Doorkliks" per dag telt alleen website en telefoon, geen routes meer.
-- Gelijk aan de live versie van 7 november 2026, alleen de regel voor 'o' is anders.
create or replace function public.admin_overview()
 returns jsonb
 language plpgsql
 stable security definer
 set search_path to ''
as $function$
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
        'near', count(*) filter (where status = 'draft' and completeness >= 0.6),
        'blocked_contact', count(*) filter (where status = 'draft' and website is null and phone is null),
        'blocked_facts', count(*) filter (where status = 'draft' and ((price_eur is not null)::int + (open_all_year is not null or season is not null)::int + (power is not null)::int) < 2),
        'blocked_score', count(*) filter (where status = 'draft' and public.place_meets_must_haves(places) and completeness < (select (value #>> '{}')::numeric from public.site_settings where key = 'publish_threshold')),
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
        select date_trunc('day', e.ts)::date d,
               count(*) filter (where e.name = 'page_view') v,
               count(distinct e.session_id) s,
               count(*) filter (where e.name = 'search') q,
               count(*) filter (where private.is_contact_click(e)) o
          from public.events e where e.ts > now() - interval '14 days' group by 1) t),
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
end $function$;
