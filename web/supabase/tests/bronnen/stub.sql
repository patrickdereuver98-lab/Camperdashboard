-- Minimale nabootsing van Supabase voor PGlite: rollen, extensies en de stukken PostGIS en pg_cron die
-- de migratie bronnen_en_claims gebruikt. Alleen voor tests.
create role anon; create role authenticated; create role service_role;
create schema extensions;
create extension pg_trgm schema extensions;
create extension unaccent schema extensions;
create extension pgcrypto schema extensions;
-- PostGIS-stubs (alleen wat de migratie gebruikt), punt = (lng, lat)
create domain extensions.geometry as point;
create domain extensions.geography as point;
create function extensions.st_makepoint(x float8, y float8) returns extensions.geometry language sql immutable as $$ select point(x, y)::extensions.geometry $$;
create function extensions.st_setsrid(g extensions.geometry, s int) returns extensions.geometry language sql immutable as $$ select g $$;
create function extensions.st_distance(a extensions.geography, b extensions.geography) returns float8 language sql immutable as $$
  select 6371000 * 2 * asin(sqrt(power(sin(radians(b[1]-a[1])/2),2) + cos(radians(a[1]))*cos(radians(b[1]))*power(sin(radians(b[0]-a[0])/2),2))) $$;
create function extensions.st_dwithin(a extensions.geography, b extensions.geography, d float8) returns boolean language sql immutable as $$ select extensions.st_distance(a, b) <= d $$;
create schema cron;
create function cron.schedule(n text, s text, c text) returns bigint language sql as $$ select 1::bigint $$;
create schema auth;
create table public.admins (user_id uuid);
create function public.is_admin() returns boolean language sql as $$ select false $$;
create table public.places (
  id uuid primary key default gen_random_uuid(), slug text unique, name text, town text, website text,
  lat float8, lng float8, geom extensions.geometry generated always as (point(lng, lat)) stored,
  departure text, checkout_until text, price_eur numeric, power boolean, sources jsonb not null default '{}',
  merged_into uuid);
