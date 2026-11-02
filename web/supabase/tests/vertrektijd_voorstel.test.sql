-- Test voor migratie 20261102160000_vertrektijd_voorstel.sql. Draait na vertrektijd_wachtrij.test.sql.
\set ON_ERROR_STOP 1
reset role;

insert into public.places (id, name, departure, checkout_until) values
  ('66666666-6666-6666-6666-666666666666', 'Bronproef', null, null);

-- Uitgangssituatie zoals live: de oude trigger zette `vertrektijd` letterlijk in de wachtrij
insert into public.submissions (kind, place_id, payload) values
  ('correctie', '66666666-6666-6666-6666-666666666666',
   '{"veld": "vertrektijd", "voorstel": "vast, uiterlijk 12:00", "citaat": "Abreise bis 12 Uhr"}');
do $$ begin
  assert exists (select 1 from public.updates_queue where place_id = '66666666-6666-6666-6666-666666666666'
                 and field_changed = 'vertrektijd' and status = 'pending'), 'uitgangssituatie ontbreekt';
end $$;

\i :migration

-- Reparatie: geen `vertrektijd` meer; wel departure 'vast' en checkout_until '12:00'
do $$ begin
  assert not exists (select 1 from public.updates_queue where status = 'pending' and submission_id is not null
                     and not (field_changed = any (private.queue_fields()))), 'onbekend veld nog in de wachtrij';
  assert (select new_value from public.updates_queue where place_id = '66666666-6666-6666-6666-666666666666'
          and field_changed = 'departure') = '"vast"'::jsonb, 'departure niet vast';
  assert (select new_value from public.updates_queue where place_id = '66666666-6666-6666-6666-666666666666'
          and field_changed = 'checkout_until') = '"12:00"'::jsonb, 'tijd niet in checkout_until';
end $$;

-- Nieuwe voorstellen: vrij, per 24 uur, onleesbaar, en een veld dat accepteren niet kent
insert into public.places (id, name, departure, checkout_until) values
  ('77777777-7777-7777-7777-777777777777', 'Bronproef 2', 'vast', '11:00');
insert into public.submissions (kind, place_id, payload) values
  ('correctie', '77777777-7777-7777-7777-777777777777', '{"veld": "vertrektijd", "voorstel": "Per 24 uur, geen vaste tijd"}');
do $$
declare sid uuid := (select id from public.submissions where payload ->> 'voorstel' like 'Per 24%');
begin
  assert (select new_value from public.updates_queue where submission_id = sid and field_changed = 'departure') = '"per24"'::jsonb, 'per24';
  assert (select new_value from public.updates_queue where submission_id = sid and field_changed = 'checkout_until') = 'null'::jsonb, 'oude tijd niet gewist';
end $$;
insert into public.submissions (kind, place_id, payload) values
  ('correctie', '77777777-7777-7777-7777-777777777777', '{"veld": "vertrektijd", "voorstel": "vrij"}'),
  ('correctie', '77777777-7777-7777-7777-777777777777', '{"veld": "vertrektijd", "voorstel": "rond de middag"}'),
  ('correctie', '77777777-7777-7777-7777-777777777777', '{"veld": "sfeer", "voorstel": "gezellig"}');
do $$ begin
  assert (select new_value from public.updates_queue q join public.submissions s on s.id = q.submission_id
          where s.payload ->> 'voorstel' = 'vrij' and q.field_changed = 'departure') = '"vrij"'::jsonb, 'vrij';
  assert not exists (select 1 from public.updates_queue q join public.submissions s on s.id = q.submission_id
                     where s.payload ->> 'voorstel' in ('rond de middag', 'gezellig')), 'onzin in de wachtrij';
end $$;

-- Accepteren werkt: beheerder zet vast 12:00 live
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
do $$ begin
  perform public.admin_apply_update(q.id) from public.updates_queue q
   where q.place_id = '66666666-6666-6666-6666-666666666666' and q.status = 'pending';
  assert (select departure from public.places where id = '66666666-6666-6666-6666-666666666666') = 'vast', 'departure niet live';
  assert (select checkout_until from public.places where id = '66666666-6666-6666-6666-666666666666') = '12:00', 'tijd niet live';
end $$;
reset role;
select 'vertrektijd-voorstel: alle tests geslaagd' as uitkomst;
