-- Minimaal stuk van het live schema, net genoeg om de geo_master-migraties te testen op een lege Postgres 16
-- (lokaal of de service-container in CI). Geen PostGIS nodig. Definities overgenomen van de live database
-- (30 oktober 2026): places (alleen de kolommen die de promotie raakt, met dezelfde checks), slugify, nl_towns en
-- nearest_town. De statusregel van places_before_write is hier vereenvoudigd tot "concept".

create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
create schema extensions;
create schema private;
create extension pg_trgm with schema extensions;
create extension unaccent with schema extensions;

create table public.places (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  name_is_generic boolean not null default false,
  kind text check (kind in ('camperplaats', 'camping', 'parkeerplaats', 'boerderij', 'jachthaven')),
  lat double precision not null,
  lng double precision not null,
  town text,
  province text,
  power boolean, water boolean, dump_station boolean, toilet boolean, shower boolean, wifi boolean, dogs boolean,
  open_all_year boolean, reservation boolean,
  max_length_m numeric,
  capacity integer check (capacity > 0 and capacity < 2000),
  website text, phone text,
  status text not null default 'draft' check (status in ('draft', 'published', 'hidden')),
  merged_into uuid references public.places (id) on delete set null,
  sources jsonb not null default '{}'
);

create table public.nl_towns (id serial primary key, name text not null, province text not null, lat float8 not null, lng float8 not null);
insert into public.nl_towns (name, province, lat, lng) values
  ('Utrecht', 'Utrecht', 52.0907, 5.1214), ('Bunschoten', 'Utrecht', 52.2400, 5.3800), ('Almere', 'Flevoland', 52.3700, 5.2100),
  ('Lelystad', 'Flevoland', 52.5100, 5.4700), ('Zwolle', 'Overijssel', 52.5168, 6.0830), ('Baarle-Nassau', 'Noord-Brabant', 51.4450, 4.9300);

create function public.nearest_town(p_lat double precision, p_lng double precision)
returns public.nl_towns language sql stable set search_path to '' as $$
  select t.* from public.nl_towns t order by (t.lat - p_lat) ^ 2 + ((t.lng - p_lng) * 0.61) ^ 2 limit 1;
$$;

create function public.slugify(p text) returns text language sql immutable set search_path to '' as $$
  select trim(both '-' from regexp_replace(lower(extensions.unaccent(coalesce(p, ''))), '[^a-z0-9]+', '-', 'g'));
$$;
