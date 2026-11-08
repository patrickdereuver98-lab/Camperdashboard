-- Losse servicepunten uit OSM (lozen, water) alleen aan de dichtstbijzijnde plek koppelen (opdracht eigenaar
-- 31 oktober 2026, D3). Tot nu toe kreeg elke plek binnen 150 m het punt, waardoor een buurcamping "lozen: ja" kon
-- krijgen voor het lozingspunt van de camperplaats ernaast. Zelfde afstand (150 m); een bekende waarde wordt nooit
-- overschreven (coalesce), zoals voorheen.

create or replace function public.ingest_osm_points(p_points jsonb)
returns integer
language plpgsql
security definer
set search_path to ''
as $$
declare r jsonb; n int := 0; c int; v_lat float8; v_lng float8;
begin
  for r in select * from jsonb_array_elements(p_points) loop
    v_lat := (r->>'lat')::float8;
    v_lng := (r->>'lng')::float8;
    update public.places p
       set dump_station = case when r->>'type' = 'dump' then coalesce(p.dump_station, true) else p.dump_station end,
           water = case when r->>'type' in ('dump', 'water')
                        then coalesce(p.water, case when r->>'type' = 'water' or (r->>'water')::boolean then true end)
                        else p.water end
     where p.id = (
       select q.id from public.places q
        where q.merged_into is null
          and abs(q.lat - v_lat) < 0.002 and abs(q.lng - v_lng) < 0.003
          and (q.lat - v_lat) ^ 2 + ((q.lng - v_lng) * 0.62) ^ 2 < (150.0 / 111000) ^ 2
        order by (q.lat - v_lat) ^ 2 + ((q.lng - v_lng) * 0.62) ^ 2
        limit 1)
       -- Niets te doen (al bekend): niet aanraken, anders verandert updated_at zonder reden
       and ((r->>'type' = 'dump' and p.dump_station is null)
            or (p.water is null and (r->>'type' = 'water' or (r->>'water')::boolean)));
    get diagnostics c = row_count;
    n := n + c;
  end loop;
  return n;
end $$;

revoke all on function public.ingest_osm_points(jsonb) from public, anon, authenticated;
grant execute on function public.ingest_osm_points(jsonb) to service_role;
