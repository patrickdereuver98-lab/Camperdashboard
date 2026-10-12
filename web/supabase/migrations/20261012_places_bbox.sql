-- Status: live toegepast op 2026-10-12.
-- Kaart laadt alleen plekken binnen de zichtbare bounding box (PostGIS + GIST-index).
-- Additief: een gegenereerde kolom, een index en een leesfunctie. RLS op public.places blijft gelden
-- (security invoker), dus anon ziet alleen gepubliceerde plekken.

create extension if not exists postgis with schema extensions;

alter table public.places
  add column if not exists geom extensions.geometry(Point, 4326)
  generated always as (extensions.st_setsrid(extensions.st_makepoint(lng, lat), 4326)) stored;

create index if not exists places_geom_gist on public.places using gist (geom) where status = 'published';

create or replace function public.places_in_bbox(min_lng double precision, min_lat double precision,
                                                 max_lng double precision, max_lat double precision)
returns setof public.places
language sql
stable
security invoker
set search_path = ''
as $$
  select p.*
  from public.places p
  where p.status = 'published'
    and p.geom operator(extensions.&&) extensions.st_makeenvelope(min_lng, min_lat, max_lng, max_lat, 4326)
  order by p.slug
  limit 5000;
$$;

revoke all on function public.places_in_bbox(double precision, double precision, double precision, double precision) from public;
grant execute on function public.places_in_bbox(double precision, double precision, double precision, double precision) to anon, authenticated;
