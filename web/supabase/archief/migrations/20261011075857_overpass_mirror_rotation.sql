-- Live migratie 20261011075857 (overpass_mirror_rotation), letterlijk uit supabase_migrations.schema_migrations.statements
-- (opgehaald 8 november 2026, review R5). Niet wijzigen: dit is de geschiedenis zoals live toegepast.

alter table public.osm_regions add column if not exists attempt int not null default 0;

create or replace function private.overpass_get(p_name text, p_region text, p_mirror int default 0)
returns bigint language sql security definer set search_path = '' as $$
  select net.http_get(
    (array['https://overpass-api.de/api/interpreter',
           'https://overpass.private.coffee/api/interpreter',
           'https://overpass.kumi.systems/api/interpreter'])[1 + (p_mirror % 3)],
    params := jsonb_build_object('data', format((select template from public.osm_queries where name = p_name), p_region)),
    headers := '{"User-Agent":"VrijStaanBot/1.0 (+https://vrijstaan.nl/bot)"}'::jsonb,
    timeout_milliseconds := 120000);
$$;

create or replace function private.next_osm_region()
returns text language plpgsql security definer set search_path = '' as $$
declare r public.osm_regions;
begin
  if exists (select 1 from public.osm_regions where places_req is not null) then return null; end if;
  select * into r from public.osm_regions
   where last_run_at is null or last_run_at < now() - interval '7 days'
   order by last_run_at nulls first limit 1;
  if not found then return null; end if;
  -- Bij een eerdere mislukte poging een andere Overpass-server
  update public.osm_regions
     set last_run_at = now(),
         places_req = private.overpass_get('places', r.code, r.attempt),
         points_req = private.overpass_get('points', r.code, r.attempt + 1)
   where code = r.code;
  return r.code;
end $$;

create or replace function private.collect_osm()
returns text language plpgsql security definer set search_path = '' as $$
declare r public.osm_regions; a_status int; b_status int; a_err text; b_err text; a_found boolean; b_found boolean;
begin
  select * into r from public.osm_regions where places_req is not null limit 1;
  if not found then return null; end if;
  select true, status_code, coalesce(error_msg, left(content::text, 200)) into a_found, a_status, a_err from net._http_response where id = r.places_req;
  select true, status_code, coalesce(error_msg, left(content::text, 200)) into b_found, b_status, b_err from net._http_response where id = r.points_req;
  if a_found is null or b_found is null then
    if r.last_run_at < now() - interval '10 minutes' then
      update public.osm_regions set places_req = null, points_req = null, attempt = attempt + 1,
             last_run_at = now() - interval '7 days' + interval '10 minutes' where code = r.code;
    end if;
    return 'wacht';
  end if;
  if a_status = 200 and b_status = 200 then
    perform private.call_pipeline(jsonb_build_object('action', 'parse', 'region', r.code, 'places_req', r.places_req, 'points_req', r.points_req));
    update public.osm_regions set places_req = null, points_req = null, attempt = 0 where code = r.code;
  else
    insert into public.app_logs (level, source, message, context) values (case when r.attempt >= 3 then 'error' else 'warn' end, 'pipeline',
      'Overpass gaf geen data voor ' || r.name || ' (poging ' || (r.attempt + 1) || ', volgende poging via andere server)',
      jsonb_build_object('places', a_status, 'points', b_status));
    -- Na 10 minuten opnieuw, via de volgende server
    update public.osm_regions set places_req = null, points_req = null, attempt = attempt + 1,
           last_run_at = now() - interval '7 days' + interval '10 minutes' where code = r.code;
  end if;
  return r.code;
end $$;
