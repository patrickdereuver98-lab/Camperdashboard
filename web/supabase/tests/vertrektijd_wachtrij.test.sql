-- Test voor migratie 20261102085642_vertrektijd_wachtrij.sql (README 95). Draait na eigenaar_inbox.test.sql.
\set ON_ERROR_STOP 1
reset role;

-- Vóór de migratie: de oude trigger zette "12:00" in `departure` (zie mission_control.test.sql)
do $$ begin
  assert exists (select 1 from public.updates_queue where field_changed = 'departure' and new_value = '"12:00"'::jsonb
                 and status = 'pending'), 'uitgangssituatie ontbreekt';
end $$;

\i :migration

-- Reparatie: geen tijd meer in `departure`; dezelfde inzending staat nu als 'vast' + checkout_until
do $$
declare sid uuid := (select id from public.submissions where payload ->> 'vertrek_uiterlijk' = '12:00');
begin
  assert not exists (select 1 from public.updates_queue where field_changed = 'departure'
                     and new_value #>> '{}' ~ '^[0-9]{1,2}[:.][0-9]{2}$'), 'tijd nog in departure';
  assert (select new_value from public.updates_queue where submission_id = sid and field_changed = 'departure') = '"vast"'::jsonb, 'departure niet vast';
  assert (select new_value from public.updates_queue where submission_id = sid and field_changed = 'checkout_until') = '"12:00"'::jsonb, 'tijd niet in checkout_until';
end $$;

insert into public.places (id, name, departure, checkout_until) values
  ('55555555-5555-5555-5555-555555555555', 'Vertrekproef', 'vast', '11:00');

-- Doe mee: vaste tijd 9.30 → alleen checkout_until "09:30" (departure is al vast)
insert into public.submissions (kind, place_id, payload) values
  ('correctie', '55555555-5555-5555-5555-555555555555', '{"onderwerp": "vertrektijd", "vertrek": "vast", "vertrek_uiterlijk": "9.30"}');
do $$ begin
  assert (select count(*) from public.updates_queue where place_id = '55555555-5555-5555-5555-555555555555') = 1, 'verwacht één rij';
  assert (select new_value from public.updates_queue where place_id = '55555555-5555-5555-5555-555555555555'
          and field_changed = 'checkout_until') = '"09:30"'::jsonb, 'tijd niet genormaliseerd';
end $$;

-- Vrij vertrek: departure 'vrij' en de oude tijd weg
insert into public.submissions (kind, place_id, payload) values
  ('correctie', '55555555-5555-5555-5555-555555555555', '{"onderwerp": "vertrektijd", "vertrek": "vrij", "vertrek_uiterlijk": null}');
do $$
declare sid uuid := (select id from public.submissions where payload ->> 'vertrek' = 'vrij');
begin
  assert (select new_value from public.updates_queue where submission_id = sid and field_changed = 'departure') = '"vrij"'::jsonb, 'vrij';
  assert (select new_value from public.updates_queue where submission_id = sid and field_changed = 'checkout_until') = 'null'::jsonb, 'tijd niet gewist';
end $$;

-- Onleesbare tijd of geen regel: niets in de wachtrij
insert into public.submissions (kind, place_id, payload) values
  ('correctie', '55555555-5555-5555-5555-555555555555', '{"onderwerp": "vertrektijd", "vertrek": "vast", "vertrek_uiterlijk": "rond de middag"}'),
  ('correctie', '55555555-5555-5555-5555-555555555555', '{"onderwerp": "vertrektijd"}');
do $$ begin
  assert (select count(*) from public.updates_queue where place_id = '55555555-5555-5555-5555-555555555555') = 3, 'onzin in de wachtrij';
end $$;

-- Accepteren werkt nu: beheerder zet 09:30 live
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
do $$ begin
  perform public.admin_apply_update((select id from public.updates_queue where place_id = '55555555-5555-5555-5555-555555555555'
                                     and new_value = '"09:30"'::jsonb));
  assert (select checkout_until from public.places where id = '55555555-5555-5555-5555-555555555555') = '09:30', 'accepteren mislukt';
end $$;
reset role;
select 'vertrektijd-wachtrij: alle tests geslaagd' as uitkomst;
