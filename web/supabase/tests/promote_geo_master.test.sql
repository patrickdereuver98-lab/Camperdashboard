-- Tests voor public.promote_geo_master (migratie 20261031090000). Draai met web/supabase/tests/run.sh.
-- Elke controle is een assert: één fout stopt het script (ON_ERROR_STOP) met de melding.

-- Bestaande plek in places: De Bosrand in Utrecht, met een website (beheer of scraper vulde die)
insert into public.places (slug, name, lat, lng, website, power)
values ('de-bosrand-utrecht', 'Camperplaats De Bosrand', 52.0900, 5.1200, 'https://bosrand.example', false);

insert into public.geo_bronnen (bron, naam, tier, status, soort) values
  ('partner_a', 'Partner A (eigen lijst)', 2, 'toegestaan', 'camperplaats'),
  ('gids_b', 'Gids B', 4, 'toegestaan', null),
  ('gids_c', 'Gids C', 4, 'toegestaan', 'camping'),
  ('forum_x', 'Forum X', 5, 'geblokkeerd', null),
  ('nieuw_y', 'Nieuw Y', 3, 'te_beoordelen', null);

insert into public.geo_master (master_id, geohash, naam, namen, lat, lon, bron_ids, faciliteiten, match_score) values
  -- Nieuwe plek uit een tier-2-bron: wordt aangemaakt, alleen geldige waarden gaan mee
  ('partner_a:1', 'u178k', 'De Hooiberg', '{De Hooiberg}', 52.3000, 5.3000, '{partner_a:1}',
   '{"stroom": true, "water": "ja", "honden": "aangelijnd", "max_lengte_m": 8, "capaciteit": 12.5, "douche": false}', 1),
  -- Ligt 40 m van De Bosrand: alleen koppelen, places blijft ongewijzigd
  ('partner_a:2', 'u178k', 'Bosrand', '{Bosrand}', 52.09036, 5.1200, '{partner_a:2}', '{"stroom": true}', 1),
  -- 120 m verderop met een lijkende naam: ook koppelen
  ('partner_a:3', 'u178k', 'De Bosrand Camperplek', '{De Bosrand Camperplek}', 52.09108, 5.1200, '{partner_a:3}', '{}', 1),
  -- Tier 4 met één bron: nog niet genoeg
  ('gids_b:1', 'u178k', 'Het Veld', '{Het Veld}', 52.40, 5.40, '{gids_b:1}', '{}', 1),
  -- Tier 4 met twee verschillende bronnen: wel genoeg; soort onenigheid (leeg en camping) → soort onbekend
  ('gids_b:2', 'u178k', 'De Weide', '{De Weide}', 52.45, 5.45, '{gids_b:2,gids_c:9}', '{}', 0.9),
  -- Twee keer dezelfde tier-4-bron telt als één
  ('gids_b:3', 'u178k', 'Het Erf', '{Het Erf}', 52.46, 5.46, '{gids_b:3,gids_b:4}', '{}', 0.9),
  -- Alleen een geblokkeerde bron
  ('forum_x:1', 'u178k', 'Plekje', '{Plekje}', 52.20, 5.20, '{forum_x:1}', '{}', 1),
  -- Bron nog niet beoordeeld
  ('nieuw_y:1', 'u178k', 'Zomerweide', '{Zomerweide}', 52.21, 5.21, '{nieuw_y:1}', '{}', 1),
  -- Buiten Nederland (Brussel)
  ('partner_a:4', 'u151', 'Aire de Bruxelles', '{Aire de Bruxelles}', 50.85, 4.35, '{partner_a:4}', '{}', 1),
  -- Antwerpen: binnen de rechthoek van Nederland, maar 24 km van de dichtstbijzijnde Nederlandse plaats
  ('partner_a:11', 'u155', 'Stadscamping Antwerpen', '{Stadscamping Antwerpen}', 51.22, 4.40, '{partner_a:11}', '{}', 1),
  -- Alleen een soortwoord als naam
  ('partner_a:5', 'u178k', 'Camperplaats', '{Camperplaats}', 52.31, 5.31, '{partner_a:5}', '{}', 1),
  -- Geen naam
  ('partner_a:6', 'u178k', null, '{}', 52.32, 5.32, '{partner_a:6}', '{}', 1),
  -- URL als naam
  ('partner_a:7', 'u178k', 'www.campingdewei.nl', '{www.campingdewei.nl}', 52.33, 5.33, '{partner_a:7}', '{}', 1),
  -- Wildkamperen in een van de namen
  ('partner_a:8', 'u178k', 'Bosplek Veluwe', '{Bosplek Veluwe,Wildkampeerplek Veluwe}', 52.34, 5.34, '{partner_a:8}', '{}', 1),
  -- Paalkampeerterrein (alleen tenten, geen camperplek)
  ('partner_a:9', 'u178k', 'Paalkampeerterrein Het Hijkerveld', '{Paalkampeerterrein Het Hijkerveld}', 52.35, 5.35, '{partner_a:9}', '{}', 1);

-- ── Proef: telt, schrijft niets ──────────────────────────────────────────────

do $$
declare r jsonb := public.promote_geo_master(true);
begin
  assert (r ->> 'bekeken')::int = 15, format('bekeken: %s', r);
  assert (r ->> 'nieuw')::int = 2, format('nieuw: %s', r);
  assert (r ->> 'gekoppeld')::int = 2, format('gekoppeld: %s', r);
  assert (r ->> 'geweigerd')::int = 11, format('geweigerd: %s', r);
  assert (select count(*) from public.places) = 1, 'proef schreef in places';
  assert (select count(*) from public.geo_master where promotie is not null) = 0, 'proef schreef in geo_master';
end $$;

-- ── Uitvoeren ────────────────────────────────────────────────────────────────

do $$
declare r jsonb := public.promote_geo_master(false);
begin
  assert (r ->> 'nieuw')::int = 2 and (r ->> 'gekoppeld')::int = 2 and (r ->> 'geweigerd')::int = 11, format('%s', r);
  assert r -> 'redenen' = '{
    "geen toegestane bron": 1,
    "alleen geblokkeerde bronnen": 1,
    "één bron uit tier 3–5: een tweede toegestane bron is nodig": 2,
    "buiten Nederland": 2,
    "naam is alleen een soortwoord": 1,
    "naam ontbreekt of heeft een vreemde lengte": 1,
    "naam lijkt een adres, URL of nummer": 1,
    "wildkamperen of paalkamperen (geen camperplek)": 2
  }'::jsonb, format('redenen: %s', r -> 'redenen');
end $$;

-- Nieuwe plek: alleen geldige waarden, de rest leeg; soort uit de bron; plaats via nearest_town; concept
do $$
declare p public.places;
begin
  select * into p from public.places where sources -> 'geo_master' ->> 'master_id' = 'partner_a:1';
  assert p.id is not null, 'De Hooiberg niet aangemaakt';
  assert p.name = 'De Hooiberg' and p.kind = 'camperplaats' and p.town = 'Bunschoten' and p.province = 'Utrecht' and p.slug = 'de-hooiberg-bunschoten', format('%s', row_to_json(p));
  assert p.power is true and p.shower is false, 'booleans niet overgenomen';
  assert p.water is null, '"ja" als tekst is geen boolean: moet leeg blijven';
  assert p.dogs is null, '"aangelijnd" mag geen ja/nee worden';
  assert p.max_length_m = 8 and p.capacity is null, 'lengte 8 wel, capaciteit 12,5 niet';
  assert p.status = 'draft', 'nieuwe plek zonder contact moet concept zijn';
  assert p.sources -> 'geo_master' -> 'bron_ids' = '["partner_a:1"]', 'herkomst ontbreekt';
end $$;

do $$
begin
  -- Twee tier-4-bronnen die het niet eens zijn over de soort: soort onbekend
  assert (select kind from public.places where name = 'De Weide') is null, 'soort zou onbekend moeten zijn';
  -- Koppelen verandert de bestaande plek niet
  assert (select power from public.places where slug = 'de-bosrand-utrecht') is false, 'bestaande plek gewijzigd';
  assert (select count(*) from public.geo_master where promotie = 'gekoppeld'
            and place_id = (select id from public.places where slug = 'de-bosrand-utrecht')) = 2, 'koppeling ontbreekt';
  assert (select promotie_reden from public.geo_master where master_id = 'forum_x:1') = 'alleen geblokkeerde bronnen';
  assert (select place_id from public.geo_master where master_id = 'forum_x:1') is null;
end $$;

-- ── Opnieuw draaien: geen dubbele plekken; een later toegestane bron gaat alsnog door ───────────

update public.geo_bronnen set status = 'toegestaan', beoordeeld_op = now() where bron = 'nieuw_y';
insert into public.geo_master (master_id, geohash, naam, namen, lat, lon, bron_ids, faciliteiten, match_score)
values ('partner_a:10', 'u178k', 'De Hooiberg', '{De Hooiberg}', 52.3001, 5.3001, '{partner_a:10}', '{}', 1);

do $$
declare r jsonb := public.promote_geo_master(false);
begin
  -- De 11 geweigerden opnieuw bekeken (Zomerweide: bron nu toegestaan, maar tier 3 met één bron) + partner_a:10
  assert (r ->> 'bekeken')::int = 12, format('%s', r);
  assert (r ->> 'gekoppeld')::int = 1, 'tweede Hooiberg moet aan de eerste gekoppeld worden';
  assert (select count(*) from public.places where name = 'De Hooiberg') = 1, 'dubbele plek';
  assert (select promotie_reden from public.geo_master where master_id = 'nieuw_y:1') like 'één bron uit tier 3–5%', 'tier 3 met één bron';
end $$;

-- Rechten: alleen service_role mag promoveren, en de bronnenlijst is niet open
do $$
begin
  assert not has_function_privilege('anon', 'public.promote_geo_master(boolean, integer)', 'execute'), 'anon mag promoveren';
  assert not has_function_privilege('authenticated', 'public.promote_geo_master(boolean, integer)', 'execute'), 'authenticated mag promoveren';
  assert has_function_privilege('service_role', 'public.promote_geo_master(boolean, integer)', 'execute');
  assert not has_table_privilege('anon', 'public.geo_bronnen', 'select'), 'geo_bronnen open voor anon';
end $$;

-- Nummers: 120 m naast "Steiger 12" ligt "Steiger 14": een andere plek, niet koppelen
insert into public.places (slug, name, lat, lng) values ('steiger-12', 'Passantenhaven Steiger 12', 52.2500, 5.3800);
insert into public.geo_master (master_id, geohash, naam, namen, lat, lon, bron_ids, faciliteiten, match_score)
values ('partner_a:12', 'u178k', 'Passantenhaven Steiger 14', '{Passantenhaven Steiger 14}', 52.25108, 5.3800, '{partner_a:12}', '{}', 1);
do $$
declare r jsonb := public.promote_geo_master(false);
begin
  assert (select promotie from public.geo_master where master_id = 'partner_a:12') = 'nieuw', format('Steiger 14: %s', r);
  assert not private.geo_nummers_botsen('Steiger 12', 'Steiger') and private.geo_nummers_botsen('Weide 2', 'Weide 3');
end $$;

select 'promote_geo_master: alle tests geslaagd' as uitkomst;
