-- Niets stil weggooien (review 16 november 2026, R68 en R73) op het herbouwde schema. Eén transactie.
\set ON_ERROR_STOP 1
begin;

-- Twee concepten zonder website, prijs en vertrekregel: de camping gaat weg, de camperplaats blijft
insert into public.places (name, slug, lat, lng, kind) values
  ('Herbouw camping weg', 'herbouw-camping-weg', 52.6, 5.6, 'camping'),
  ('Herbouw camperplaats blijft', 'herbouw-camperplaats-blijft', 52.61, 5.61, 'camperplaats');
select private.verwijder_onbereikbare_plekken(false);
do $$ begin
  assert not exists (select 1 from public.places where slug = 'herbouw-camping-weg'), 'camping zonder website niet opgeruimd';
  assert exists (select 1 from public.places where slug = 'herbouw-camperplaats-blijft'), 'camperplaats zonder website verwijderd (R68)';
end $$;

-- Blokkade: een recent verwijderde OSM-plek komt niet terug, een oude wel, en een plek met nu een website ook
insert into private.verwijderde_plekken (id, osm_type, osm_id, slug, name, reden, gegevens, removed_at) values
  (gen_random_uuid(), 'node', 990001, 'recent', 'Recent', 'geen website', '{}', now() - interval '1 month'),
  (gen_random_uuid(), 'node', 990002, 'oud', 'Oud', 'geen website', '{}', now() - interval '7 months'),
  (gen_random_uuid(), 'node', 990003, 'site', 'Site', 'geen website', '{}', now() - interval '1 month');
insert into public.places (name, slug, lat, lng, osm_type, osm_id) values ('Recent terug', 'herbouw-recent', 52.7, 5.7, 'node', 990001);
insert into public.places (name, slug, lat, lng, osm_type, osm_id) values ('Oud terug', 'herbouw-oud', 52.71, 5.71, 'node', 990002);
insert into public.places (name, slug, lat, lng, osm_type, osm_id, website) values ('Site terug', 'herbouw-site', 52.72, 5.72, 'node', 990003, 'https://voorbeeld.nl');
do $$ begin
  assert not exists (select 1 from public.places where slug = 'herbouw-recent'), 'recent verwijderde plek kwam terug';
  assert exists (select 1 from public.places where slug = 'herbouw-oud'), 'blokkade vervalt niet na zes maanden';
  assert exists (select 1 from public.places where slug = 'herbouw-site'), 'plek met nu een website blijft geblokkeerd';
end $$;

-- OSM wist geen prijs en overschrijft geen website, telefoon of e-mail
insert into public.places (name, slug, lat, lng, kind, osm_type, osm_id, price_eur, website, phone, email)
values ('Herbouw osm', 'herbouw-osm', 52.8, 5.8, 'camperplaats', 'node', 990010, 15, 'https://eigen.nl', '0301111111', 'info@eigen.nl');
select public.ingest_osm('[{"osm_type": "node", "osm_id": 990010, "lat": 52.8, "lng": 5.8, "kind": "camperplaats", "name": "Herbouw osm",
  "website": "https://andere.nl", "phone": "0302222222", "email": "x@andere.nl"}]'::jsonb);
do $$ declare p public.places; begin
  select * into p from public.places where slug = 'herbouw-osm';
  assert p.price_eur = 15, format('OSM zonder prijs wiste de prijs (%s)', p.price_eur);
  assert p.website = 'https://eigen.nl' and p.phone = '0301111111' and p.email = 'info@eigen.nl',
         format('OSM overschreef contactgegevens (%s %s %s)', p.website, p.phone, p.email);
end $$;
-- Lege velden vult OSM wel
update public.places set phone = null where slug = 'herbouw-osm';
select public.ingest_osm('[{"osm_type": "node", "osm_id": 990010, "lat": 52.8, "lng": 5.8, "kind": "camperplaats", "name": "Herbouw osm", "phone": "0302222222"}]'::jsonb);
do $$ begin
  assert (select phone from public.places where slug = 'herbouw-osm') = '0302222222', 'OSM vulde een leeg telefoonveld niet';
end $$;

-- R71: een onzekere uitkomst is geen "geen website": na 7 dagen opnieuw, hoogstens drie keer
insert into public.places (name, slug, lat, lng, kind) values ('Herbouw zoeker', 'herbouw-zoeker', 52.9, 5.9, 'camping');
do $$ declare v_id uuid := (select id from public.places where slug = 'herbouw-zoeker'); d jsonb; begin
  perform public.apply_discovery(v_id, null, true);
  select sources->'discovery' into d from public.places where id = v_id;
  assert (d->>'tries')::int = 1 and d ? 'retry', format('onzekere uitkomst zonder nieuwe poging (%s)', d);
  -- Nog niet aan de beurt
  assert not exists (select 1 from public.next_discover_batch(500) b where b.id = v_id), 'onzekere plek te vroeg opnieuw opgepakt';
  -- Wel aan de beurt: retry in het verleden
  update public.places set sources = jsonb_set(sources, '{discovery,retry}', to_jsonb(now() - interval '1 minute')) where id = v_id;
  assert exists (select 1 from public.next_discover_batch(500) b where b.id = v_id), 'onzekere plek niet opnieuw opgepakt';
  assert (select (sources->'discovery'->>'tries')::int from public.places where id = v_id) = 1, 'aantal pogingen kwijt bij oppakken';
  -- Derde onzekere uitkomst: geen nieuwe poging meer
  perform public.apply_discovery(v_id, null, true);
  perform public.apply_discovery(v_id, null, true);
  select sources->'discovery' into d from public.places where id = v_id;
  assert (d->>'tries')::int = 3 and not (d ? 'retry'), format('na drie pogingen nog steeds opnieuw (%s)', d);
  -- Blijven hangen op started: na een dag terug
  update public.places set sources = jsonb_set(sources, '{discovery}', jsonb_build_object('started', now() - interval '2 days')) where id = v_id;
  assert exists (select 1 from public.next_discover_batch(500) b where b.id = v_id), 'plek die op started bleef hangen komt niet terug';
end $$;

rollback;
select 'niets weggooien op het herbouwde schema: alle tests geslaagd' as uitkomst;
