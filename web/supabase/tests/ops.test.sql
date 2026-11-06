-- Tests voor 20261106200000_health_en_ops_probe.sql en 20261106200100_cron_rustiger_en_opschonen.sql (review
-- november 2026, R1, R3, R7). Draait in de Mission Control-database (run.sh), na de andere Mission Control-tests.
\set ON_ERROR_STOP 1
reset role;

-- Stuk van het live schema dat health() en apply_retention lezen en de stub nog niet heeft
alter table public.places add column if not exists last_scraped_at timestamptz;
alter table public.reviews add column if not exists created_at timestamptz not null default now();
create table if not exists public.app_logs (id bigserial primary key, ts timestamptz not null default now(), level text not null,
  source text, message text, context jsonb);
create table if not exists public.consent_log (id bigserial primary key, ts timestamptz not null default now());
create table if not exists public.tickets (id uuid primary key default gen_random_uuid(), place_id uuid, status text,
  updated_at timestamptz not null default now());
create table if not exists public.osm_staging (id bigserial primary key, kind text, row jsonb, processed_at timestamptz);
create table if not exists public.osm_regions (code text primary key, places_req bigint);
create table if not exists public.geo_master (master_id text primary key, place_id uuid);
create table if not exists public.duplicate_dismissals (a uuid, b uuid);
create table if not exists public.shared_trips (id uuid primary key default gen_random_uuid(), owner_id uuid);
create or replace function private.log(l text, s text, m text, c jsonb) returns void language sql as $$
  insert into public.app_logs (level, source, message, context) values (l, s, m, c)
$$;
-- Cron-taken zoals live op 6 november 2026 (stub: alleen naam, rooster en opdracht)
insert into cron.job (jobname, schedule, command) values
  ('discover', '* * * * *', 'select 1'), ('pdok-adres', '* * * * *', 'select 1'), ('osm-staging', '* * * * *', 'select 1'),
  ('osm-collect', '* * * * *', 'select private.collect_osm()'), ('retention-cron-log', '17 3 * * *', 'select 1 where 1=0'),
  ('scrape', '15 seconds', 'select 1');

\i :migration_ops
\i :migration_cron

-- ── health(): alleen tellingen, ook voor anon ──────────────────────────────────────────────────────────────────────
update public.places set status = 'concept';
insert into public.places (name, status, departure, price_eur, last_scraped_at) values
  ('Gezond vast', 'published', 'vast', 15, now() - interval '2 hours'),
  ('Gezond onbekend', 'published', null, null, now() - interval '1 hour'),
  ('Gezond concept', 'concept', 'vrij', 10, now());
insert into public.app_logs (level, source, message, ts) values ('error', 'pipeline', 'stuk', now()),
  ('error', 'pipeline', 'oud', now() - interval '2 days'), ('warn', 'pipeline', 'let op', now());
delete from net._http_response;
insert into net._http_response (id, status_code, timed_out, error_msg, created) values
  (9001, 200, false, null, now()), (9002, 502, false, null, now()), (9003, null, true, 'Timeout', now()),
  (9004, 200, false, null, now() - interval '2 days');

set role anon;
do $$
declare h jsonb := public.health();
begin
  assert (h ->> 'published')::int = 2, format('published %s', h ->> 'published');
  assert (h ->> 'with_departure')::int = 1, 'with_departure';
  assert (h ->> 'with_price')::int = 1, 'with_price';
  assert (h ->> 'net_calls_24h')::int = 3, format('net_calls_24h %s', h ->> 'net_calls_24h');
  assert (h ->> 'net_failed_24h')::int = 2, 'net_failed_24h';
  assert (h ->> 'app_errors_24h')::int = 1, 'app_errors_24h';
  assert (h ->> 'db_bytes')::bigint > 0, 'db_bytes';
  assert (h ->> 'last_scrape')::timestamptz > now() - interval '61 minutes', 'last_scrape';
  assert not (h ? 'name') and h::text !~ 'Gezond', 'health() lekt rijgegevens';
end $$;
reset role;

-- ── ops_probe(): alleen HTTP 200 zonder doorverwijzing en met de verwachte inhoud telt als goed ───────────────────
delete from public.admin_logs where kind = 'api';
delete from net._http_response;
do $$
declare first_id bigint; n int;
begin
  perform private.ops_probe();
  assert (select count(*) from public.admin_logs where kind = 'api' and status = 'pending') = 5, 'vijf controles verwacht';
  assert not exists (select 1 from public.admin_logs where source = 'overpass'), 'Overpass-controle hoort weg';
  select min(request_id) into first_id from public.admin_logs where kind = 'api';
  -- pdok: 200 met JSON; osrm: 301; openfreemap: 200 met Location (login); wsrv: 200; site: 200 met HTML-loginpagina
  insert into net._http_response (id, status_code, timed_out, headers, content) values
    ((select request_id from public.admin_logs where source = 'pdok' and status = 'pending'), 200, false, '{"Content-Type": "application/json"}', '{"response": {}}'),
    ((select request_id from public.admin_logs where source = 'osrm' and status = 'pending'), 301, false, '{"location": "https://elders"}', ''),
    ((select request_id from public.admin_logs where source = 'openfreemap' and status = 'pending'), 200, false, '{"Location": "https://vercel.com/sso"}', '{}'),
    ((select request_id from public.admin_logs where source = 'wsrv' and status = 'pending'), 200, false, '{}', 'png'),
    ((select request_id from public.admin_logs where source = 'site' and status = 'pending'), 200, false, '{"content-type": "text/html"}', '<!DOCTYPE html><html>');
  perform private.ops_probe();
  assert (select status from public.admin_logs where source = 'pdok' and http_status = 200) = 'ok', 'pdok 200 niet ok';
  assert (select status from public.admin_logs where source = 'wsrv' and http_status = 200) = 'ok', 'wsrv 200 niet ok';
  assert (select status from public.admin_logs where source = 'osrm' and http_status = 301) = 'failed', '301 telde als goed';
  assert (select status from public.admin_logs where source = 'openfreemap' and http_status = 200) = 'failed', '200 met Location telde als goed';
  assert (select message from public.admin_logs where source = 'openfreemap' and http_status = 200) like '%doorverwijzing%', 'melding doorverwijzing';
  assert (select status from public.admin_logs where source = 'site' and http_status = 200) = 'failed', 'loginpagina telde als goed';
  assert (select message from public.admin_logs where source = 'site' and http_status = 200) like '%onverwachte inhoud%', 'melding inhoud';

  -- Site met echte JSON is wel goed
  insert into net._http_response (id, status_code, timed_out, headers, content)
  values ((select request_id from public.admin_logs where source = 'site' and status = 'pending'), 200, false, '{}', '[{"name": "Utrecht"}]');
  perform private.ops_probe();
  assert (select count(*) from public.admin_logs where source = 'site' and status = 'ok') = 1, 'site met JSON niet ok';

  -- pg_net: 3 van 12 aanroepen mislukt (25%) → één regel, ook na een tweede ronde
  assert not exists (select 1 from public.admin_logs where source = 'pg_net'), 'pg_net te vroeg gemeld';
  insert into net._http_response (id, status_code, timed_out, error_msg)
  select 20000 + g, case when g <= 2 then 502 else 200 end, g = 3, case when g = 3 then 'Timeout' end from generate_series(1, 12) g;
  perform private.ops_probe();
  perform private.ops_probe();
  select count(*) into n from public.admin_logs where kind = 'api' and source = 'pg_net' and status = 'failed';
  assert n = 1, format('pg_net-fouten %s keer gemeld', n);
  assert (select details ->> 'failed' from public.admin_logs where source = 'pg_net') = '3', 'aantal mislukt';
end $$;

-- Onder de 20%: geen melding
delete from public.admin_logs where source = 'pg_net';
delete from net._http_response where id > 20000;
insert into net._http_response (id, status_code, timed_out) select 30000 + g, case when g = 1 then 503 else 200 end, false from generate_series(1, 10) g;
do $$ begin perform private.ops_probe(); end $$;
do $$ begin
  assert not exists (select 1 from public.admin_logs where source = 'pg_net'), '10% foutief werd gemeld';
end $$;

-- ── cron: rustiger ritme, dode taak weg ────────────────────────────────────────────────────────────────────────────
do $$ begin
  assert (select schedule from cron.job where jobname = 'discover') = '*/10 * * * *', 'discover';
  assert (select schedule from cron.job where jobname = 'pdok-adres') = '*/10 * * * *', 'pdok-adres';
  assert (select schedule from cron.job where jobname = 'osm-staging') = '*/5 * * * *', 'osm-staging';
  assert (select schedule from cron.job where jobname = 'osm-collect') = '*/5 * * * *', 'osm-collect';
  assert (select command from cron.job where jobname = 'osm-collect') like '%where exists%osm_regions%', 'bewaker osm-collect';
  assert (select count(*) from cron.job where jobname in ('discover', 'pdok-adres', 'osm-staging', 'osm-collect')) = 4, 'dubbele taken';
  assert not exists (select 1 from cron.job where jobname = 'retention-cron-log'), 'retention-cron-log hoort weg';
  assert exists (select 1 from cron.job where jobname = 'scrape' and schedule = '15 seconds'), 'andere taken blijven';
end $$;

-- ── apply_retention: verwerkte osm_staging ouder dan 14 dagen weg ──────────────────────────────────────────────────
insert into public.osm_staging (kind, row, processed_at) values
  ('place', '{"email": "beheer@example.nl"}', now() - interval '20 days'),
  ('place', '{}', now() - interval '3 days'),
  ('place', '{}', null);
do $$
declare r jsonb := private.apply_retention();
begin
  assert (r ->> 'osm_staging')::int = 1, format('osm_staging %s', r);
  assert (select count(*) from public.osm_staging) = 2, 'recente of onverwerkte rijen gewist';
end $$;

do $$ begin
  assert (select count(*) from pg_indexes where indexname in ('geo_master_place_id', 'tickets_place_id',
    'duplicate_dismissals_b', 'shared_trips_owner_id')) = 4, 'FK-indexen ontbreken';
end $$;

select 'health, ops-probe en cron: alle tests geslaagd' as uitkomst;
