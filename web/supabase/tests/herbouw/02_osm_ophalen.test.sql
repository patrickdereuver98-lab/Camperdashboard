-- OSM ophalen per deel en na elkaar (20261118120000_osm_ophalen_per_deel.sql), op het volledige herbouwde schema.
-- Overpass-antwoorden worden nagespeeld in net._http_response; alles in één transactie die aan het eind terugdraait,
-- zodat pg_net geen enkel verzoek echt verstuurt.
\set ON_ERROR_STOP 1
begin;

create temp table t_regio as select 'NL-DR'::text code;
-- Alleen Drenthe is aan de beurt
update public.osm_regions set last_run_at = now(), places_req = null, points_req = null, places_done_at = null, attempt = 0;
update public.osm_regions set last_run_at = null where code = 'NL-DR';

-- Laatste verzoek dat pg_net zou versturen
create function pg_temp.laatste() returns table (url text, body jsonb) language sql as $$
  select url, case when body is null then null else convert_from(body, 'UTF8')::jsonb end
    from net.http_request_queue order by id desc limit 1
$$;
create function pg_temp.antwoord(p_id bigint, p_status int) returns void language sql as $$
  insert into net._http_response (id, status_code, content, timed_out, created)
  values (p_id, p_status, case when p_status = 200 then '{"elements":[]}' end, false, now())
$$;

-- ── Ronde begint met alleen de plekken, bij de eerste server ────────────────────────────────────────────────────────
do $$ declare r public.osm_regions; begin
  assert private.next_osm_region() = 'NL-DR', 'Drenthe niet aan de beurt';
  select * into r from public.osm_regions where code = 'NL-DR';
  assert r.places_req is not null and r.points_req is null, 'niet alleen het plekkenverzoek verstuurd';
  assert (select url from pg_temp.laatste()) like 'https://overpass-api.de/%', 'eerste poging niet bij overpass-api.de';
  assert private.next_osm_region() is null, 'tweede verzoek terwijl er een uitstaat';
end $$;

-- ── Plekken mislukken: wachten, volgende server, nog steeds plekken ────────────────────────────────────────────────
select pg_temp.antwoord((select places_req from public.osm_regions where code = 'NL-DR'), 502);
do $$ declare r public.osm_regions; begin
  assert private.collect_osm() = 'NL-DR', 'collect_osm deed niets';
  select * into r from public.osm_regions where code = 'NL-DR';
  assert r.places_req is null and r.points_req is null and r.attempt = 1, format('na 502: attempt %s', r.attempt);
  assert r.places_done_at is null, 'mislukte plekken als binnen gemarkeerd';
  assert r.last_run_at > now() - interval '7 days', 'geen wachttijd na een mislukte poging';
  assert (select message from public.app_logs order by id desc limit 1) like 'Overpass gaf geen data voor Drenthe (plekken, poging 1,%',
    'melding noemt het deel niet';
end $$;

update public.osm_regions set last_run_at = null where code = 'NL-DR';
do $$ declare r public.osm_regions; begin
  assert private.next_osm_region() = 'NL-DR';
  select * into r from public.osm_regions where code = 'NL-DR';
  assert r.places_req is not null and r.points_req is null, 'na een mislukte poging niet opnieuw de plekken';
  assert (select url from pg_temp.laatste()) like 'https://overpass.kumi.systems/%', 'tweede poging niet bij een andere server';
end $$;

-- ── Plekken lukken: meteen verwerken (alleen places_req), servicepunten direct aan de beurt ─────────────────────────
select pg_temp.antwoord((select places_req from public.osm_regions where code = 'NL-DR'), 200);
do $$ declare r public.osm_regions; req bigint := (select places_req from public.osm_regions where code = 'NL-DR'); b jsonb; begin
  assert private.collect_osm() = 'NL-DR';
  select body into b from pg_temp.laatste();
  assert b ->> 'action' = 'parse' and (b ->> 'places_req')::bigint = req and not (b ? 'points_req'),
    format('pipeline niet met alleen de plekken aangeroepen: %s', b);
  select * into r from public.osm_regions where code = 'NL-DR';
  assert r.places_req is null and r.places_done_at is not null and r.attempt = 0, 'plekken niet als binnen bewaard';
  assert r.last_run_at <= now() - interval '7 days', 'servicepunten niet meteen aan de beurt';
end $$;

-- ── Servicepunten mislukken: de plekken blijven binnen ─────────────────────────────────────────────────────────────
do $$ declare r public.osm_regions; begin
  assert private.next_osm_region() = 'NL-DR';
  select * into r from public.osm_regions where code = 'NL-DR';
  assert r.places_req is null and r.points_req is not null, 'na de plekken niet het servicepuntenverzoek';
  assert (select url from pg_temp.laatste()) like 'https://overpass-api.de/%', 'servicepunten niet bij de eerste server';
end $$;
select pg_temp.antwoord((select points_req from public.osm_regions where code = 'NL-DR'), 504);
do $$ declare r public.osm_regions; begin
  assert private.collect_osm() = 'NL-DR';
  select * into r from public.osm_regions where code = 'NL-DR';
  assert r.points_req is null and r.attempt = 1, 'mislukte servicepunten niet geteld';
  assert r.places_done_at is not null, 'gelukte plekken weggegooid na mislukte servicepunten';
  assert (select message from public.app_logs order by id desc limit 1) like '%(servicepunten, poging 1,%', 'melding noemt het deel niet';
end $$;

-- ── Geen antwoord binnen 10 minuten telt als mislukt; de plekken blijven binnen ────────────────────────────────────
update public.osm_regions set last_run_at = null where code = 'NL-DR';
select private.next_osm_region();
update public.osm_regions set last_run_at = now() - interval '11 minutes' where code = 'NL-DR';
do $$ declare r public.osm_regions; begin
  assert private.collect_osm() = 'wacht';
  select * into r from public.osm_regions where code = 'NL-DR';
  assert r.points_req is null and r.attempt = 2 and r.places_done_at is not null, format('time-out: attempt %s', r.attempt);
end $$;

-- ── Servicepunten lukken: ronde klaar, volgende over 7 dagen ───────────────────────────────────────────────────────
update public.osm_regions set last_run_at = null where code = 'NL-DR';
select private.next_osm_region();
select pg_temp.antwoord((select points_req from public.osm_regions where code = 'NL-DR'), 200);
do $$ declare r public.osm_regions; req bigint := (select points_req from public.osm_regions where code = 'NL-DR'); b jsonb; begin
  assert (select url from pg_temp.laatste()) like 'https://overpass.private.coffee/%', 'derde poging niet bij de derde server';
  assert private.collect_osm() = 'NL-DR';
  select body into b from pg_temp.laatste();
  assert (b ->> 'points_req')::bigint = req and not (b ? 'places_req'), format('pipeline niet met alleen de servicepunten: %s', b);
  select * into r from public.osm_regions where code = 'NL-DR';
  assert r.points_req is null and r.places_done_at is null and r.attempt = 0, 'ronde niet afgesloten';
  assert r.last_run_at > now() - interval '1 minute', 'regio meteen weer aan de beurt';
  assert private.next_osm_region() is null, 'nieuwe ronde terwijl geen regio aan de beurt is';
end $$;

-- ── Bezig = één van beide verzoeken; oude overpass_get weg ─────────────────────────────────────────────────────────
do $$ begin
  assert (select command from cron.job where jobname = 'osm-collect') like '%points_req is not null%', 'osm-collect negeert servicepunten';
  assert pg_get_functiondef('public.admin_overview()'::regprocedure) like '%''busy'', places_req is not null or points_req is not null)%',
    'admin_overview busy niet bijgewerkt';
  assert pg_get_functiondef('public.admin_pipeline(text)'::regprocedure) like '%where places_req is null and points_req is null;%',
    'osm-refresh negeert servicepunten';
  assert to_regprocedure('private.overpass_get(text, text)') is null, 'oude overpass_get bestaat nog';
end $$;

rollback;
select 'OSM ophalen per deel: alle tests geslaagd' as uitkomst;
