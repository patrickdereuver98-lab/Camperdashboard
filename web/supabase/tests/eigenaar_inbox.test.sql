-- Test voor migratie 20261102120000_eigenaar_inbox.sql. Draait na mission_control.test.sql (run.sh, zelfde database).
\set ON_ERROR_STOP 1

reset role;
alter table public.places add column if not exists verified_at timestamptz;
insert into public.internal_secrets (name, value) values ('owner_inbox_key', 'inbox-geheim')
  on conflict (name) do update set value = excluded.value;
insert into public.places (id, name, departure, checkout_until, price_eur, email) values
  ('22222222-2222-2222-2222-222222222222', 'Camperplaats Eigen Mail', 'vrij', null, 15, 'Info@EigenMail.nl'),
  ('33333333-3333-3333-3333-333333333333', 'Keten A', null, null, null, 'keten@example.nl'),
  ('44444444-4444-4444-4444-444444444444', 'Keten B', null, null, null, 'keten@example.nl');

\i :migration

-- Verkeerde sleutel: geweigerd
do $$ begin
  begin
    perform public.log_owner_reply('fout', '{"email_id": "x", "from": "a@b.nl"}');
    assert false, 'verkeerde sleutel werd geaccepteerd';
  exception when insufficient_privilege then null;
  end;
end $$;

-- Update via e-mailadres: prijs en vertrektijd in de wachtrij (plus vertrek 'vast'), niets direct op places
set role anon;
do $$
declare r jsonb;
begin
  r := public.log_owner_reply('inbox-geheim', '{"email_id": "m1", "from": "info@eigenmail.nl", "subject": "Re: vraag",
    "intent": "update", "price": 18, "departure_time": "11:00", "summary": "Nieuwe prijs en vertrektijd.", "ai_model": "gemini-2.5-flash"}');
  assert r ->> 'outcome' = 'queued', 'update niet in de wachtrij: ' || r::text;
  assert (r ->> 'queued')::int = 3, 'verwacht drie velden';
  assert r ->> 'matched_by' = 'email', 'niet op e-mail gevonden';
  -- Dezelfde mail nog een keer (Resend probeert opnieuw): niets dubbel
  r := public.log_owner_reply('inbox-geheim', '{"email_id": "m1", "from": "info@eigenmail.nl", "intent": "update", "price": 18}');
  assert (r ->> 'duplicate')::boolean, 'tweede aanroep niet herkend';
end $$;
reset role;
do $$ begin
  assert (select count(*) from public.updates_queue where source = 'eigenaar') = 3, 'aantal rijen eigenaar';
  assert (select new_value from public.updates_queue where source = 'eigenaar' and field_changed = 'price_eur') = '18'::jsonb, 'prijs';
  assert (select old_value from public.updates_queue where source = 'eigenaar' and field_changed = 'price_eur') = '15'::jsonb, 'oude prijs';
  assert (select new_value from public.updates_queue where source = 'eigenaar' and field_changed = 'checkout_until') = '"11:00"'::jsonb, 'vertrektijd';
  assert (select new_value from public.updates_queue where source = 'eigenaar' and field_changed = 'departure') = '"vast"'::jsonb, 'vast';
  assert (select price_eur from public.places where id = '22222222-2222-2222-2222-222222222222') = 15, 'places direct aangepast';
  assert (select count(*) from public.owner_replies) = 1, 'antwoord niet of dubbel gelogd';
  assert exists (select 1 from public.admin_logs where source = 'inbound-email' and message not like '%@%'), 'logboek';
end $$;

-- Bevestiging vanaf het bekende adres: verified_at gezet
set role anon;
do $$ begin
  assert public.log_owner_reply('inbox-geheim', '{"email_id": "m2", "from": "info@eigenmail.nl", "intent": "confirm", "summary": "Klopt."}') ->> 'outcome' = 'verified', 'bevestiging';
end $$;
reset role;
do $$ begin
  assert (select verified_at from public.places where id = '22222222-2222-2222-2222-222222222222') is not null, 'verified_at niet gezet';
end $$;

-- Bevestiging met id in het onderwerp maar van een ander adres: alleen gelogd, verified_at blijft leeg
set role anon;
do $$
declare r jsonb;
begin
  r := public.log_owner_reply('inbox-geheim', '{"email_id": "m3", "from": "iemand@anders.nl", "intent": "confirm",
    "place_id": "11111111-1111-1111-1111-111111111111"}');
  assert r ->> 'outcome' = 'logged' and r ->> 'matched_by' = 'id', 'vreemde afzender: ' || r::text;
  -- Twee plekken met hetzelfde adres en geen id: niet raden
  r := public.log_owner_reply('inbox-geheim', '{"email_id": "m4", "from": "keten@example.nl", "intent": "update", "price": 20}');
  assert r ->> 'outcome' = 'ambiguous' and r ->> 'place_id' is null, 'meerdere plekken: ' || r::text;
  -- Onbekend adres
  r := public.log_owner_reply('inbox-geheim', '{"email_id": "m5", "from": "nieuw@example.nl", "intent": "update", "price": 20}');
  assert r ->> 'outcome' = 'no_place', 'onbekend adres';
  -- Waarden buiten de grenzen worden leeg; update zonder verschil zet niets in de wachtrij
  r := public.log_owner_reply('inbox-geheim', '{"email_id": "m6", "from": "info@eigenmail.nl", "intent": "update",
    "price": 9999, "departure_time": "rond twaalven"}');
  assert r ->> 'outcome' = 'logged' and (r ->> 'queued')::int = 0, 'onzin in de wachtrij: ' || r::text;
end $$;
reset role;
do $$ begin
  assert (select verified_at from public.places where id = '11111111-1111-1111-1111-111111111111') is null, 'vreemde afzender zette verified_at';
  assert (select price_eur from public.owner_replies where email_id = 'm6') is null, 'prijs 9999 opgeslagen';
end $$;

-- Gewone gebruiker ziet de antwoorden niet; de beheerder wel, en kan een eigenaar-update accepteren
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000c';
do $$ begin
  assert (select count(*) from public.owner_replies) = 0, 'gast ziet antwoorden';
end $$;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
do $$ begin
  assert (select count(*) from public.owner_replies) = 6, 'beheerder ziet niet alles';
  perform public.admin_apply_update((select id from public.updates_queue where source = 'eigenaar' and field_changed = 'price_eur'));
  assert (select price_eur from public.places where id = '22222222-2222-2222-2222-222222222222') = 18, 'accepteren werkte niet';
end $$;
reset role;
select 'eigenaar-inbox: alle tests geslaagd' as uitkomst;
