-- Aanvulling op stub_schema.sql voor de scraper- en beheermigraties (31 oktober 2026): de kolommen en tabellen die
-- die migraties raken, met dezelfde vorm als live. pg_cron en is_admin zijn hier nep (geen Supabase nodig).

alter table public.places
  add column if not exists departure text,
  add column if not exists last_scraped_at timestamptz,
  add column if not exists completeness numeric not null default 0,
  add column if not exists status_locked boolean not null default false,
  add column if not exists operator text,
  add column if not exists email text,
  add column if not exists street text,
  add column if not exists postcode text,
  add column if not exists season text;

create table private.scrape_queue (
  place_id uuid primary key references public.places (id) on delete cascade,
  attempts int not null default 0, last_error text, next_attempt_at timestamptz not null default now(), done_at timestamptz);
create table private.stealth_queue (
  place_id uuid primary key references public.places (id) on delete cascade, reason text,
  attempts int not null default 0, next_attempt_at timestamptz not null default now(), done_at timestamptz,
  last_error text, created_at timestamptz not null default now());

create schema if not exists cron;
create table cron.job (jobid serial primary key, jobname text unique, schedule text, command text);
create function cron.schedule(n text, s text, c text) returns bigint language sql as
  $$ insert into cron.job (jobname, schedule, command) values (n, s, c) returning jobid $$;
create function cron.unschedule(n text) returns boolean language sql as $$ delete from cron.job where jobname = n returning true $$;

create function public.is_admin() returns boolean language sql stable as $$ select current_setting('test.admin', true) = 'ja' $$;

-- Zelfde regel als live (place_meets_must_haves, 31 oktober 2026)
create function public.place_meets_must_haves(p public.places) returns boolean language sql immutable set search_path to '' as $$
  select (p.website is not null or p.phone is not null or p.email is not null or nullif(trim(p.operator), '') is not null)
     and ((p.departure is not null)::int * 2 + (p.open_all_year is not null or p.season is not null)::int
          + (p.power is not null)::int + (p.price_eur is not null)::int) >= 2;
$$;
