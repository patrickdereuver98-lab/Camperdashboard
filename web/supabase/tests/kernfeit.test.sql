-- Tests voor de migraties 20261031180000 (kernfeit-booster), 20261031190000 (concepten) en 20261031200000
-- (servicepunten). Draai met web/supabase/tests/run.sh.

delete from private.verwijderde_plekken;
delete from public.geo_master;
delete from public.places;

insert into public.places (id, slug, name, lat, lng, website, departure, last_scraped_at, status, sources) values
  -- Geen vertrekregel, 20 dagen geleden gelezen: met 14 dagen wel opnieuw, met 30 nog niet
  ('00000000-0000-4000-8000-000000000001', 'a', 'Zonder regel', 52.10, 5.10, 'https://a.nl', null, now() - interval '20 days', 'draft', '{}'),
  -- Met vertrekregel, 20 dagen: nog niet
  ('00000000-0000-4000-8000-000000000002', 'b', 'Met regel', 52.11, 5.11, 'https://b.nl', 'vast', now() - interval '20 days', 'published', '{}'),
  -- Ook met stealth onleesbaar, beheer heeft niets ingevuld: handmatig nakijken
  ('00000000-0000-4000-8000-000000000003', 'c', 'Onleesbaar', 52.12, 5.12, 'https://c.nl', null, now() - interval '2 days', 'published', '{"stealth": {"error": "403"}}'),
  -- Onleesbaar, maar beheer vulde al iets in: niet nakijken
  ('00000000-0000-4000-8000-000000000004', 'd', 'Onleesbaar ingevuld', 52.13, 5.13, 'https://d.nl', null, now() - interval '2 days', 'draft', '{"stealth": {"error": "403"}, "beheer": ["departure"]}'),
  -- Concept zonder contact
  ('00000000-0000-4000-8000-000000000005', 'e', 'Zonder contact', 52.14, 5.14, null, null, null, 'draft', '{}'),
  -- Alleen met stealth leesbaar (geen fout): niet naar de gewone scraper
  ('00000000-0000-4000-8000-000000000006', 'f', 'Stealth goed', 52.15, 5.15, 'https://f.nl', null, now() - interval '20 days', 'draft', '{"stealth": {"at": "2026-10-26T00:00:00Z"}}');

-- ── B1 ───────────────────────────────────────────────────────────────────────
do $$
begin
  assert private.enqueue_stale_scrape(30, 10) = 1, 'alleen de plek zonder regel en zonder stealth-resultaat';
  assert exists (select 1 from private.scrape_queue where place_id = '00000000-0000-4000-8000-000000000001');
  assert (select focus from public.next_scrape_batch(5) limit 1) is true, 'focus voor plek zonder regel';
end $$;

-- ── B3 ───────────────────────────────────────────────────────────────────────
do $$
begin
  perform private.markeer_handmatig();
  assert (select array_agg(place_id) from public.manual_review) = array['00000000-0000-4000-8000-000000000003'::uuid], 'alleen Onleesbaar';
  -- Beheer vult iets in: de markering gaat er bij de volgende ronde af
  update public.places set sources = sources || '{"beheer": ["price_eur"]}' where slug = 'c';
  perform private.markeer_handmatig();
  assert not exists (select 1 from public.manual_review), 'markering bleef staan';
end $$;
set test.admin = 'nee';
do $$
begin
  begin
    perform public.admin_manual_review();
    assert false, 'niet-beheerder kon de lijst lezen';
  exception when raise_exception then null;
  end;
end $$;
set test.admin = 'ja';

-- ── C1 en C2 ─────────────────────────────────────────────────────────────────
do $$
declare r record;
begin
  assert private.concept_reden((select p from public.places p where slug = 'e')) = 'geen contact (website, telefoon of e-mail)';
  assert private.concept_reden((select p from public.places p where slug = 'a')) = 'te weinig kernfeiten, geen vertrekregel';
  assert private.concept_reden((select p from public.places p where slug = 'b')) is null, 'online is geen concept';
  select * into r from public.admin_concept_redenen() where reden like 'te weinig%';
  assert r.aantal = 3, format('te weinig kernfeiten: %s', r);
  update private.scrape_queue set done_at = now();
  -- a (concept, site, geen regel) wel; f (alleen stealth) en d (stealth-fout) wel/niet volgens de regel
  assert private.forceer_kernfeit_scrape() = 2, format('geforceerd: %s', (select array_agg(place_id) from private.scrape_queue where done_at is null));
  assert not exists (select 1 from private.scrape_queue where place_id = '00000000-0000-4000-8000-000000000006' and done_at is null), 'stealth-plek naar de gewone scraper';
end $$;

-- ── D3: alleen de dichtstbijzijnde plek krijgt het lozingspunt ──────────────
insert into public.places (slug, name, lat, lng) values ('dichtbij', 'Dichtbij', 52.3000, 5.3000), ('verder', 'Verder', 52.3008, 5.3000);
do $$
begin
  assert public.ingest_osm_points('[{"type": "dump", "lat": 52.3001, "lng": 5.3000}]') = 1;
  assert (select dump_station from public.places where slug = 'dichtbij') is true;
  assert (select dump_station from public.places where slug = 'verder') is null, 'buurplek kreeg het lozingspunt';
  -- Al bekend: niet opnieuw aanraken
  assert public.ingest_osm_points('[{"type": "dump", "lat": 52.3001, "lng": 5.3000}]') = 0;
end $$;

select 'kernfeit, concepten en servicepunten: alle tests geslaagd' as uitkomst;
