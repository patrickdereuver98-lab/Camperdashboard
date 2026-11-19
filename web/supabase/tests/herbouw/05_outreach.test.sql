-- Uitgaande mail en antwoorden van eigenaren (migratie 20261119200000_outreach) op het herbouwde schema. Eén transactie.
\set ON_ERROR_STOP 1
begin;

-- Standaard UIT: zonder admin_outreach_set(true) claimt outreach_next niets
insert into public.internal_secrets (name, value) values ('outreach_key', 'herbouw-outreach'), ('owner_inbox_key', 'herbouw-inbox')
  on conflict (name) do update set value = excluded.value;
insert into public.places (name, slug, lat, lng, kind, email)
values ('Herbouw outreach', 'herbouw-outreach', 52.3, 5.3, 'camping', 'info@herbouw-outreach.nl');
do $$
declare r jsonb;
begin
  assert (select enabled from private.outreach_config) is false, 'outreach staat standaard aan';
  r := public.outreach_next('herbouw-outreach', 10);
  assert (r ->> 'enabled')::boolean is false and jsonb_array_length(r -> 'items') = 0, 'outreach_next claimde iets terwijl uit: ' || r::text;
  assert not exists (select 1 from private.outreach_log), 'logboek gevuld terwijl uit';
end $$;

-- Antwoord met de nieuwe velden komt met bron 'eigenaar' in de wachtrij; de echte queue_fields kennen ze
do $$
declare
  r jsonb;
  v_place uuid := (select id from public.places where slug = 'herbouw-outreach');
begin
  r := public.log_owner_reply('herbouw-inbox', jsonb_build_object('email_id', 'herbouw-1', 'from', 'info@herbouw-outreach.nl',
    'place_id', v_place, 'intent', 'update', 'checkin_from', '14:00', 'departure_rule', 'vrij', 'power', true, 'season', 'april tot oktober'));
  assert r ->> 'source' = 'eigenaar' and (r ->> 'queued')::int = 4, 'antwoord: ' || r::text;
  assert (select bool_and(field_changed = any (private.queue_fields())) from public.updates_queue
           where owner_reply_id = (r ->> 'id')::uuid), 'veld dat de inbox niet kan toepassen';
  -- Bevestiging: een voorstel, places.verified_at blijft staan
  r := public.log_owner_reply('herbouw-inbox', jsonb_build_object('email_id', 'herbouw-2', 'from', 'info@herbouw-outreach.nl',
    'place_id', v_place, 'intent', 'confirm'));
  assert (select field_changed from public.updates_queue where owner_reply_id = (r ->> 'id')::uuid) = 'verified_at', 'bevestiging niet als voorstel';
  -- Afmelden per mail: op de afmeldlijst
  r := public.log_owner_reply('herbouw-inbox', '{"email_id": "herbouw-3", "from": "stop@herbouw-outreach.nl", "intent": "unsubscribe"}');
  assert r ->> 'outcome' = 'unsubscribed', 'afmelden: ' || r::text;
  assert exists (select 1 from private.outreach_suppressions where email_hash = private.email_hash('stop@herbouw-outreach.nl'));
end $$;

rollback;
select 'outreach op het herbouwde schema: alle tests geslaagd' as uitkomst;
