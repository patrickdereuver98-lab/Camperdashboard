-- Test voor migratie 20261102200000_outreach.sql. Draait na marketing_dashboard.test.sql (run.sh, zelfde database).
\set ON_ERROR_STOP 1

reset role;
alter table public.places add column if not exists kind text;
alter table public.places add column if not exists town text;
alter table public.places add column if not exists slug text;
alter table public.places add column if not exists merged_into uuid;
alter table public.places add column if not exists verified_at timestamptz;
-- Eerdere tests laten plekken met adressen achter: hier tellen alleen de plekken van deze test
update public.places set email = null;
insert into public.internal_secrets (name, value) values ('outreach_key', 'outreach-geheim')
  on conflict (name) do update set value = excluded.value;

insert into public.places (id, name, kind, town, email, departure, checkout_until, checkin_from, status, sources, verified_at) values
  -- Komt in aanmerking: eigen domein, geen vertrekregel
  ('a0000000-0000-4000-8000-000000000001', 'Camping De Vlinder', 'camping', 'Leek', 'Info@DeVlinder.nl', null, null, null, 'published', '{}', null),
  -- Idem, vertrekregel bekend maar aankomst niet
  ('a0000000-0000-4000-8000-000000000002', 'Boerderij Het Hooi', 'boerderij', 'Dwingeloo', 'hooi@hetHooi.nl', 'vast', '11:00', null, 'published', '{}', null),
  -- Gmail: een privépersoon, niet mailen
  ('a0000000-0000-4000-8000-000000000003', 'Gmail-plek', 'camping', 'Zeist', 'jan@gmail.com', null, null, null, 'published', '{}', null),
  -- Parkeerplaats: geen eigenaar om te mailen
  ('a0000000-0000-4000-8000-000000000004', 'Parkeerplaats', 'parkeerplaats', 'Ede', 'gemeente@ede.nl', null, null, null, 'published', '{}', null),
  -- Alles bekend: niets te vragen (verified_at zegt niets: de scraper zet het bij elke gelezen website)
  ('a0000000-0000-4000-8000-000000000005', 'Compleet', 'camping', 'Vaals', 'info@compleet.nl', 'vast', '12:00', '14:00', 'published', '{}', now()),
  -- Eigenaar liet de lezer stoppen
  ('a0000000-0000-4000-8000-000000000006', 'Geblokkeerd', 'camping', 'Echt', 'info@geblokkeerd.nl', null, null, null, 'published', '{"stealth": {"error": "geblokkeerd: eigenaar vroeg te stoppen"}}', null),
  -- Samengevoegd in een andere plek
  ('a0000000-0000-4000-8000-000000000007', 'Dubbel', 'camping', 'Echt', 'info@dubbel.nl', null, null, null, 'published', '{}', null),
  -- Keten: twee plekken, één adres
  ('a0000000-0000-4000-8000-000000000008', 'Keten Noord', 'camping', 'Assen', 'keten@ketting.nl', null, null, null, 'published', '{}', null),
  ('a0000000-0000-4000-8000-000000000009', 'Keten Zuid', 'camping', 'Venlo', 'keten@ketting.nl', 'vast', '10:00', '15:00', 'draft', '{}', null),
  -- Alles belangrijke bekend, niet recent bevestigd: niets te vragen
  ('a0000000-0000-4000-8000-00000000000b', 'Alles bekend', 'camping', 'Vaals', 'info@allesbekend.nl', 'vast', '12:00', '14:00', 'published', '{}', null),
  -- Geen geldig adres
  ('a0000000-0000-4000-8000-00000000000a', 'Kapot adres', 'camping', 'Echt', 'geen adres', null, null, null, 'published', '{}', null);
update public.places set merged_into = 'a0000000-0000-4000-8000-000000000001' where id = 'a0000000-0000-4000-8000-000000000007';
update public.places set open_all_year = true, price_eur = 20, power = true, water = true, dump_station = false
 where id in ('a0000000-0000-4000-8000-00000000000b', 'a0000000-0000-4000-8000-000000000005');
-- Alles bekend op lozen na: toch een mail, met alleen die ene vraag
insert into public.places (id, name, kind, email, departure, checkout_until, checkin_from, open_all_year, price_eur, power, water, dump_station, status)
  values ('a0000000-0000-4000-8000-00000000000c', 'Bijna compleet', 'camping', 'info@bijnacompleet.nl', 'vast', '11:00', '14:00', true, 20, true, true, null, 'published');
update public.places set slug = 'camping-de-vlinder' where id = 'a0000000-0000-4000-8000-000000000001';

\i :migration

-- Verkeerde sleutel: geweigerd (ook voor het ophalen)
set role anon;
do $$ begin
  begin
    perform public.outreach_next('fout', 5);
    assert false, 'verkeerde sleutel werd geaccepteerd';
  exception when insufficient_privilege then null;
  end;
end $$;

-- Standaard UIT: er wordt niets geclaimd
do $$
declare r jsonb;
begin
  r := public.outreach_next('outreach-geheim', 10);
  assert (r ->> 'enabled')::boolean is false and jsonb_array_length(r -> 'items') = 0, 'campagne stond niet uit: ' || r::text;
end $$;
reset role;
do $$ begin assert (select count(*) from private.outreach_log) = 0, 'log gevuld terwijl uit'; end $$;

-- Wat missen we: alleen belangrijke gegevens, in vaste volgorde
do $$ begin
  assert private.outreach_missing((select p from public.places p where id = 'a0000000-0000-4000-8000-000000000002')) = array['aankomst','seizoen','prijs','stroom','lozen'];
  assert private.outreach_missing((select p from public.places p where id = 'a0000000-0000-4000-8000-00000000000b')) = array[]::text[];
  assert private.outreach_missing((select p from public.places p where id = 'a0000000-0000-4000-8000-00000000000c')) = array['lozen'];
end $$;

-- Wie komt in aanmerking: de Vlinder, het Hooi, één van de keten (Noord: geen vertrekregel gaat voor) en Bijna compleet
do $$
declare ids uuid[];
begin
  select array_agg(place_id order by place_id) into ids from private.outreach_candidates();
  assert ids = array['a0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000002',
                     'a0000000-0000-4000-8000-000000000008', 'a0000000-0000-4000-8000-00000000000c']::uuid[], format('kandidaten: %s', ids);
end $$;

-- Aanzetten (buiten het verzendvenster van de tests: venster wijd open en ook in het weekend)
update private.outreach_config set enabled = true, window_start = 0, window_end = 24, weekdays_only = false, per_day_start = 2;

-- Dagquotum: 2 per dag, ook al vraagt de route er 10. Zonder vertrekregel gaat voor: de Vlinder en Keten Noord.
set role anon;
do $$
declare r jsonb;
begin
  r := public.outreach_next('outreach-geheim', 10);
  assert jsonb_array_length(r -> 'items') = 2, 'quotum 2: ' || r::text;
  assert (r -> 'items' -> 0 ->> 'place_id') = 'a0000000-0000-4000-8000-000000000001', 'volgorde: zonder vertrekregel eerst';
  assert (r -> 'items' -> 0 ->> 'email') = 'Info@DeVlinder.nl', 'adres ontbreekt';
  assert (r -> 'items' -> 0 -> 'missing') = '["vertrek","aankomst","seizoen","prijs","stroom","lozen"]'::jsonb, 'missing: ' || (r -> 'items' -> 0 -> 'missing')::text;
  assert (r -> 'items' -> 1 ->> 'place_id') = 'a0000000-0000-4000-8000-000000000008', 'keten: de plek zonder regel';
  -- Tweede aanroep zonder iets verstuurd te hebben: geen nieuwe plekken (quotum op) en niets opnieuw (nog geen 30 min)
  r := public.outreach_next('outreach-geheim', 10);
  assert jsonb_array_length(r -> 'items') = 0, 'tweede aanroep gaf weer iets: ' || r::text;
end $$;
reset role;

-- Blijft een verzending hangen (30 min), dan komt dezelfde plek met hetzelfde token terug
select token as t1 from private.outreach_log where place_id = 'a0000000-0000-4000-8000-000000000001' \gset
update private.outreach_log set offered_at = now() - interval '31 minutes' where place_id = 'a0000000-0000-4000-8000-000000000001';
set role anon;
select (public.outreach_next('outreach-geheim', 10) -> 'items' -> 0 ->> 'token') = :'t1' as opnieuw_aangeboden \gset
reset role;
\if :opnieuw_aangeboden
\else
  do $$ begin raise exception 'niet opnieuw aangeboden'; end $$;
\endif

-- Verzonden melden; een tweede melding verandert niets meer
set role anon;
select public.outreach_sent('outreach-geheim', :'t1', 're_1') \gset
select public.outreach_sent('outreach-geheim', :'t1', 're_andere') \gset
reset role;
do $$ begin
  assert (select status || resend_id from private.outreach_log where place_id = 'a0000000-0000-4000-8000-000000000001') = 'sentre_1', 'sent/resend_id';
  -- Het logboek bewaart geen e-mailadres
  assert not exists (select 1 from private.outreach_log where email_hash like '%@%'), 'adres in logboek';
  assert (select email_hash from private.outreach_log where place_id = 'a0000000-0000-4000-8000-000000000001') = private.email_hash('info@devlinder.nl'), 'hash';
end $$;

-- Met een hoger quotum komt het Hooi aan de beurt
update private.outreach_config set per_day_start = 3;
set role anon;
do $$
declare r jsonb;
begin
  r := public.outreach_next('outreach-geheim', 10);
  assert jsonb_array_length(r -> 'items') = 1 and (r -> 'items' -> 0 ->> 'place_id') = 'a0000000-0000-4000-8000-000000000002', 'hooi: ' || r::text;
end $$;
reset role;

-- Resend weigert het adres van het Hooi (permanent): nooit meer proberen
select token as t2 from private.outreach_log where place_id = 'a0000000-0000-4000-8000-000000000002' \gset
set role anon;
select public.outreach_failed('outreach-geheim', :'t2', 'ongeldig adres', true) \gset
reset role;
do $$ begin
  assert (select status from private.outreach_log where place_id = 'a0000000-0000-4000-8000-000000000002') = 'failed', 'failed';
  assert exists (select 1 from private.outreach_suppressions where email_hash = private.email_hash('hooi@hethooi.nl') and reason = 'geweigerd'), 'geweigerd niet op de lijst';
end $$;

-- Een fout aan onze kant (p_suppress false) geeft de plek op, maar sluit het adres niet uit
insert into public.places (id, name, kind, email, status) values ('a0000000-0000-4000-8000-0000000000c1', 'Eigen fout', 'camping', 'info@eigenfout.nl', 'published');
insert into private.outreach_log (place_id, email_hash) values ('a0000000-0000-4000-8000-0000000000c1', private.email_hash('info@eigenfout.nl'));
select token as t3 from private.outreach_log where place_id = 'a0000000-0000-4000-8000-0000000000c1' \gset
set role anon;
select public.outreach_failed('outreach-geheim', :'t3', 'niets te vragen', true, false) \gset
reset role;
do $$ begin
  assert (select status from private.outreach_log where place_id = 'a0000000-0000-4000-8000-0000000000c1') = 'failed';
  assert not exists (select 1 from private.outreach_suppressions where email_hash = private.email_hash('info@eigenfout.nl')), 'adres uitgesloten door onze eigen fout';
end $$;

-- Afmelden met het token: op de lijst, ook bij een tweede keer of een onbekend token (zelfde antwoord)
set role anon;
select (public.outreach_unsubscribe(:'t1') ->> 'ok')::boolean as ok1 \gset
select (public.outreach_unsubscribe(:'t1') ->> 'ok')::boolean as ok2 \gset
select (public.outreach_unsubscribe(gen_random_uuid()) ->> 'ok')::boolean as ok3 \gset
reset role;
do $$ begin
  assert (select status from private.outreach_log where place_id = 'a0000000-0000-4000-8000-000000000001') = 'unsubscribed', 'status na afmelden';
  assert exists (select 1 from private.outreach_suppressions where email_hash = private.email_hash('info@devlinder.nl') and reason = 'afgemeld');
  -- Ook een nieuwe plek met hetzelfde adres krijgt nooit mail
  insert into public.places (id, name, kind, email, status) values ('a0000000-0000-4000-8000-0000000000b1', 'Zelfde eigenaar', 'camping', 'INFO@devlinder.nl', 'published');
  assert not exists (select 1 from private.outreach_candidates() where place_id = 'a0000000-0000-4000-8000-0000000000b1'), 'afgemeld adres kwam terug';
end $$;
\if :ok1
\if :ok2
\if :ok3
\else
  do $$ begin raise exception 'onbekend token gaf een ander antwoord'; end $$;
\endif
\endif
\endif

-- Terugmailen dat je geen mail wilt (intent unsubscribe): op de lijst, ook zonder gevonden plek
set role anon;
do $$
declare r jsonb;
begin
  r := public.log_owner_reply('inbox-geheim', '{"email_id": "u1", "from": "nooit@meer.nl", "intent": "unsubscribe", "summary": "Wil geen mail."}');
  assert r ->> 'outcome' = 'unsubscribed', 'outcome: ' || r::text;
end $$;
reset role;
do $$ begin
  assert exists (select 1 from private.outreach_suppressions where email_hash = private.email_hash('nooit@meer.nl')), 'terugmailen niet verwerkt';
end $$;

-- Gebeurtenissen van Resend: delivered, harde bounce; een onbekend id doet niets
select token as t8 from private.outreach_log where place_id = 'a0000000-0000-4000-8000-000000000008' \gset
set role anon;
select public.outreach_sent('outreach-geheim', :'t8', 're_k') \gset
do $$
begin
  assert (public.outreach_event('outreach-geheim', 'onbekend', 'bounced') ->> 'known')::boolean is false;
  perform public.outreach_event('outreach-geheim', 're_k', 'delivered');
end $$;
reset role;
do $$ begin
  assert (select status from private.outreach_log where resend_id = 're_k') = 'delivered', 'delivered';
end $$;

-- Een antwoord van de eigenaar zet de status op 'replied' en verwerkt aankomst en een vrije vertrekregel
set role anon;
do $$
declare r jsonb;
begin
  r := public.log_owner_reply('inbox-geheim', '{"email_id": "r1", "from": "keten@ketting.nl", "subject": "Re: Klopt dit nog? [VS-a0000000-0000-4000-8000-000000000008]",
    "place_id": "a0000000-0000-4000-8000-000000000008", "intent": "update", "checkin_from": "15:00", "departure_rule": "vrij", "summary": "Vrij vertrek."}');
  assert r ->> 'outcome' = 'queued' and (r ->> 'queued')::int = 2, 'aankomst en vrij vertrek: ' || r::text;
  -- Onzin van het model: tijd "25:00" en regel "soms" worden genegeerd
  r := public.log_owner_reply('inbox-geheim', '{"email_id": "r2", "from": "keten@ketting.nl", "place_id": "a0000000-0000-4000-8000-000000000008",
    "intent": "update", "checkin_from": "25:00", "departure_rule": "soms"}');
  assert (r ->> 'queued')::int = 0, 'onzin in de wachtrij: ' || r::text;
  -- Voorzieningen en openingsperiode uit het antwoord: elk een eigen rij voor de beheerder
  r := public.log_owner_reply('inbox-geheim', '{"email_id": "r3", "from": "keten@ketting.nl", "place_id": "a0000000-0000-4000-8000-000000000008",
    "intent": "update", "power": true, "water": true, "dump_station": false, "season": "1 april tot en met 31 oktober", "price": 24}');
  assert (r ->> 'queued')::int = 5, 'voorzieningen, seizoen en prijs: ' || r::text;
  -- Een periode met data en "het hele jaar open" spreken elkaar tegen: geen van beide
  r := public.log_owner_reply('inbox-geheim', '{"email_id": "r4", "from": "keten@ketting.nl", "place_id": "a0000000-0000-4000-8000-000000000008",
    "intent": "update", "open_all_year": true, "season": "1 april tot 1 oktober"}');
  assert (r ->> 'queued')::int = 0, 'tegenstrijdige periode kwam in de wachtrij: ' || r::text;
  -- Een tekst in plaats van ja/nee is geen waarheidswaarde
  r := public.log_owner_reply('inbox-geheim', '{"email_id": "r5", "from": "keten@ketting.nl", "place_id": "a0000000-0000-4000-8000-000000000008",
    "intent": "update", "power": "misschien", "water": "ja"}');
  assert (r ->> 'queued')::int = 0, 'tekst als boolean: ' || r::text;
end $$;
reset role;
do $$ begin
  assert (select status from private.outreach_log where place_id = 'a0000000-0000-4000-8000-000000000008') = 'replied', 'replied';
  assert (select new_value from public.updates_queue where owner_reply_id = (select id from public.owner_replies where email_id = 'r1') and field_changed = 'checkin_from') = '"15:00"'::jsonb;
  assert (select new_value from public.updates_queue where owner_reply_id = (select id from public.owner_replies where email_id = 'r1') and field_changed = 'departure') = '"vrij"'::jsonb;
  assert (select new_value from public.updates_queue where owner_reply_id = (select id from public.owner_replies where email_id = 'r3') and field_changed = 'season') = '"1 april tot en met 31 oktober"'::jsonb;
  assert (select new_value from public.updates_queue where owner_reply_id = (select id from public.owner_replies where email_id = 'r3') and field_changed = 'dump_station') = 'false'::jsonb;
end $$;

-- Noodrem: een spamklacht zet de hele campagne uit, ook voor volgende aanroepen
set role anon;
do $$
declare r jsonb;
begin
  perform public.outreach_event('outreach-geheim', 're_k', 'complained');
  r := public.outreach_next('outreach-geheim', 10);
  assert (r ->> 'enabled')::boolean is false and jsonb_array_length(r -> 'items') = 0, 'campagne bleef aan na klacht: ' || r::text;
end $$;
reset role;
do $$ begin
  assert (select paused_reason from private.outreach_config) = 'spamklacht';
  assert exists (select 1 from public.admin_logs where source = 'outreach' and status = 'warn'), 'geen melding in Mission Control';
end $$;

-- Te veel harde bounces (vanaf 40 verzonden): ook uit
update private.outreach_config set enabled = true, paused_reason = null;
delete from private.outreach_log where status = 'complained';
insert into public.places (id, name, email)
  select ('b0000000-0000-4000-8000-' || lpad(g::text, 12, '0'))::uuid, 'Bulk ' || g, 'bulk' || g || '@bulk.nl' from generate_series(1, 45) g;
insert into private.outreach_log (place_id, email_hash, status, sent_at)
  select ('b0000000-0000-4000-8000-' || lpad(g::text, 12, '0'))::uuid, private.email_hash('bulk' || g || '@bulk.nl'),
         case when g <= 3 then 'bounced' else 'delivered' end, now()
    from generate_series(1, 45) g;
set role anon;
do $$
declare r jsonb;
begin
  r := public.outreach_next('outreach-geheim', 10);
  assert r ->> 'reason' = 'te veel bounces', 'bounce-rem: ' || r::text;
end $$;
reset role;
do $$ begin assert (select enabled from private.outreach_config) is false; end $$;

-- Buiten het verzendvenster gebeurt niets
update private.outreach_config set enabled = true, paused_reason = null, window_start = 0, window_end = 1, weekdays_only = false;
delete from private.outreach_log where status = 'bounced';
set role anon;
do $$
declare r jsonb;
begin
  -- Alleen waar: het is niet tussen 00:00 en 01:00 in Amsterdam (anders slaat de test over)
  if extract(hour from now() at time zone 'Europe/Amsterdam') <> 0 then
    r := public.outreach_next('outreach-geheim', 10);
    assert r ->> 'reason' = 'buiten verzendtijd', 'venster: ' || r::text;
  end if;
end $$;
reset role;

-- Beheer: alleen een beheerder ziet het overzicht en kan aan- en uitzetten; een gewone gebruiker niet
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000c';
do $$ begin
  begin
    perform public.admin_outreach_overview();
    assert false, 'gast zag het overzicht';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.admin_outreach_set(true);
    assert false, 'gast zette de campagne aan';
  exception when insufficient_privilege then null;
  end;
end $$;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
do $$
declare o jsonb;
begin
  perform public.admin_outreach_set(false);
  o := public.admin_outreach_overview();
  assert (o ->> 'enabled')::boolean is false and o ->> 'paused_reason' = 'handmatig uitgezet', 'uitzetten: ' || o::text;
  assert (o -> 'by_status' ->> 'delivered')::int = 42, 'aantallen: ' || o::text;
  assert (o ->> 'suppressed')::int >= 4, 'afmeldlijst: ' || o::text;
end $$;
reset role;

select 'outreach: alle tests geslaagd' as uitkomst;
