-- Eigen database voor de Mission Control-migratie (run.sh maakt hem aan). Minimaal stuk van het live schema op
-- 1 november 2026: auth, cron en net (pg_net) als stub, plus de tabellen die de migratie raakt.
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin bypassrls; end if;
end $$;
create schema extensions;
create schema private;
create schema auth;
create schema cron;
create schema net;
create extension pgcrypto with schema extensions;
grant usage on schema public, auth, extensions to anon, authenticated;

create table auth.users (id uuid primary key default gen_random_uuid(), email text);
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
grant execute on function auth.uid() to anon, authenticated;

create table cron.job (jobid bigserial primary key, jobname text, schedule text, command text);
create table cron.job_run_details (runid bigserial primary key, jobid bigint, status text, return_message text,
  start_time timestamptz default now(), end_time timestamptz default now());
create function cron.schedule(n text, s text, c text) returns bigint language sql as $$
  insert into cron.job (jobname, schedule, command) values (n, s, c) returning jobid
$$;
create function cron.unschedule(n text) returns boolean language sql as $$
  delete from cron.job where jobname = n returning true
$$;

create table net._http_response (id bigint primary key, status_code integer, content_type text, headers jsonb,
  content text, timed_out boolean, error_msg text, created timestamptz not null default now());
create sequence net.req_seq;
create function net.http_get(url text, params jsonb default '{}', headers jsonb default '{}',
  timeout_milliseconds integer default 5000) returns bigint language sql as $$ select nextval('net.req_seq') $$;

create table public.places (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  power boolean, water boolean, dump_station boolean, toilet boolean, shower boolean, wifi boolean, dogs boolean,
  departure text, checkout_until text, checkin_from text, checkin_until text, price_eur numeric, price_note text,
  capacity integer check (capacity > 0 and capacity < 2000), max_length_m numeric, open_all_year boolean, season text,
  reservation boolean, max_stay_nights integer, website text, phone text, email text, operator text,
  status text not null default 'published',
  sources jsonb not null default '{}'
);
create table public.profiles (id uuid primary key references auth.users (id) on delete cascade, display_name text,
  avatar_url text, created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table public.admins (user_id uuid primary key references auth.users (id) on delete cascade, email text not null,
  role text not null default 'admin' check (role in ('admin', 'support')), created_at timestamptz not null default now());
create table public.submissions (id uuid primary key default gen_random_uuid(), kind text not null, place_id uuid
  references public.places (id), payload jsonb not null default '{}', contact_name text, contact_email text,
  status text not null default 'nieuw' check (status in ('nieuw', 'verwerkt', 'afgewezen')), admin_note text,
  created_at timestamptz not null default now(), user_id uuid);
create table public.internal_secrets (name text primary key, value text not null);
create table public.audit_log (id bigserial primary key, ts timestamptz not null default now(), actor uuid,
  actor_email text, action text, entity text, entity_id text, details jsonb);
create table public.ingest_runs (id bigserial primary key, kind text not null, started_at timestamptz not null default now(),
  finished_at timestamptz, status text not null default 'running', stats jsonb);
alter table public.profiles enable row level security;
grant select, insert, update, delete on public.profiles, public.places to authenticated;

create table private.rate_counter (bucket text, window_start timestamptz, hits integer);
create function private.rate_take(b text, n integer, w interval) returns boolean language sql as $$ select true $$;

create function public.is_admin() returns boolean language sql stable security definer set search_path to '' as $$
  select exists (select 1 from public.admins where user_id = (select auth.uid()))
$$;
create function public.admin_mark_beheer(p_place_id uuid, p_fields text[]) returns void
 language plpgsql security definer set search_path to '' as $$
begin
  if not public.is_admin() then raise exception 'Geen toegang'; end if;
  update public.places set sources = jsonb_set(sources, '{beheer}', to_jsonb(p_fields)) where id = p_place_id;
end $$;
grant execute on function public.admin_mark_beheer(uuid, text[]) to authenticated;

-- Testgegevens: een beheerder, een supportmedewerker, een gewone gebruiker, een plek en twee open inzendingen
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'beheer@example.nl'),
  ('00000000-0000-0000-0000-00000000000b', 'support@example.nl'),
  ('00000000-0000-0000-0000-00000000000c', 'gast@example.nl');
insert into public.profiles (id) select id from auth.users;
insert into public.admins (user_id, email, role) values
  ('00000000-0000-0000-0000-00000000000a', 'beheer@example.nl', 'admin'),
  ('00000000-0000-0000-0000-00000000000b', 'support@example.nl', 'support');
insert into public.places (id, name, power, departure) values
  ('11111111-1111-1111-1111-111111111111', 'Camperplaats De Proef', false, '11:00');
insert into public.submissions (kind, place_id, payload) values
  ('correctie', '11111111-1111-1111-1111-111111111111', '{"voorzieningen": {"power": {"was": false, "nieuw": true}, "wifi": {"was": null, "nieuw": true}}}'),
  ('correctie', '11111111-1111-1111-1111-111111111111', '{"onderwerp": "vertrektijd", "vertrek_uiterlijk": "12:00"}');
