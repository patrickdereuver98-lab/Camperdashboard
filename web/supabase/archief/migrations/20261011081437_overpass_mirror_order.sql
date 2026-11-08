-- Live migratie 20261011081437 (overpass_mirror_order), letterlijk uit supabase_migrations.schema_migrations.statements
-- (opgehaald 8 november 2026, review R5). Niet wijzigen: dit is de geschiedenis zoals live toegepast.

create or replace function private.overpass_get(p_name text, p_region text, p_mirror int default 0)
returns bigint language sql security definer set search_path = '' as $$
  select net.http_get(
    (array['https://overpass-api.de/api/interpreter',
           'https://overpass.kumi.systems/api/interpreter',
           'https://overpass.private.coffee/api/interpreter'])[1 + (p_mirror % 3)],
    params := jsonb_build_object('data', format((select template from public.osm_queries where name = p_name), p_region)),
    headers := '{"User-Agent":"VrijStaanBot/1.0 (+https://vrijstaan.nl/bot)"}'::jsonb,
    timeout_milliseconds := 120000);
$$;

do $$
declare d text;
begin
  d := pg_get_functiondef('private.next_osm_region'::regproc);
  d := replace(d, $s$private.overpass_get('points', r.code, r.attempt + 1)$s$, $s$private.overpass_get('points', r.code, r.attempt)$s$);
  execute d;
end $$;

update public.osm_regions set attempt = 1, last_run_at = null where places_req is null;
