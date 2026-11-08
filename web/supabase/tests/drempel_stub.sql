-- Eigen database voor de drempel- en RLS-tests (run.sh maakt hem aan). Stuk van het live schema op 6 november 2026:
-- rollen, places met de kolommen die de trigger raakt, de trigger places_before_write en de RLS-policies van places
-- (letterlijk uit pg_policies). place_completeness en place_meets_must_haves zijn stubs: de score staat in de kolom
-- test_score, zodat de test de drempel zelf kiest.
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin bypassrls; end if;
end $$;
create schema private;
create schema auth;
grant usage on schema public to anon, authenticated, service_role;

create table auth.users (id uuid primary key, email text);
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
grant usage on schema auth to anon, authenticated;
grant execute on function auth.uid() to anon, authenticated;

create table public.site_settings (key text primary key, value jsonb);
create table public.admins (user_id uuid primary key, email text not null, role text not null default 'admin');
create table public.audit_log (id bigserial primary key, ts timestamptz not null default now(), actor uuid,
  actor_email text, action text, entity text, entity_id text, details jsonb);
create table public.osm_regions (code text primary key, places_req bigint, last_run_at timestamptz);
create table public.places (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  status text not null default 'draft',
  status_locked boolean not null default false,
  completeness numeric,
  test_score numeric not null default 0,
  test_must_haves boolean not null default true,
  image_url text,
  photos jsonb not null default '[]',
  departure text, checkout_until text, times_note text,
  departure_check text, departure_checked_at timestamptz, departure_checked_by uuid,
  updated_at timestamptz not null default now()
);

create function public.is_admin() returns boolean language sql stable security definer set search_path to '' as $$
  select exists (select 1 from public.admins where user_id = (select auth.uid()))
$$;
grant execute on function public.is_admin() to anon, authenticated;
create function public.place_completeness(p public.places) returns numeric language sql stable as $$ select p.test_score $$;
create function public.place_meets_must_haves(p public.places) returns boolean language sql stable as $$ select p.test_must_haves $$;
create function private.decode_entities(t text) returns text language sql immutable as $$ select t $$;
create function public.enqueue_scrape(only_missing boolean) returns void language sql as $$ select $$;

-- Trigger zoals live (de functie zelf komt uit de migratie)
create function private.places_before_write() returns trigger language plpgsql as $$ begin return new; end $$;
create trigger places_before_write before insert or update on public.places
  for each row execute function private.places_before_write();

-- RLS zoals live
alter table public.places enable row level security;
grant select on public.places to anon;
grant select, insert, update, delete on public.places to authenticated;
create policy "plekken lezen" on public.places for select to anon, authenticated
  using ((status = 'published'::text) or (select public.is_admin() as is_admin));
create policy "admins plekken insert" on public.places for insert to authenticated with check ((select public.is_admin() as is_admin));
create policy "admins plekken update" on public.places for update to authenticated
  using ((select public.is_admin() as is_admin)) with check ((select public.is_admin() as is_admin));
create policy "admins plekken delete" on public.places for delete to authenticated using ((select public.is_admin() as is_admin));
