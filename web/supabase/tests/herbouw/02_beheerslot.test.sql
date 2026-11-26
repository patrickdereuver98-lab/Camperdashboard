-- Beheerslot (review 16 november 2026, R61) op het herbouwde schema: een bevestigde vertrekregel en een nagekeken
-- prijs overleven de volgende lezing; een afwijkende lezing wordt een voorstel in de inbox. Alles in één transactie.
\set ON_ERROR_STOP 1
begin;

-- Beheerder met de rol admin (is_admin kijkt naar de rol, R14)
insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000b1', 'beheer-r61@example.nl');
insert into public.admins (user_id, email, role) values ('00000000-0000-0000-0000-0000000000b1', 'beheer-r61@example.nl', 'admin');

insert into public.places (name, slug, lat, lng, website, departure, times_note, price_eur, sources)
values ('Herbouw slot', 'herbouw-slot', 52.3, 5.3, 'https://voorbeeld.nl', 'vrij',
        'Bij ons geen vaste vertrektijd.', 18,
        jsonb_build_object('website_fields', jsonb_build_array('departure', 'times_note', 'price_eur'), 'website_parser', '45'));

-- Bevestigen als beheerder zet een slot op regel, tijd en bronzin
set local request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000b1';
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000000b1", "role": "authenticated", "aal": "aal2"}';
select public.check_departure((select id from public.places where slug = 'herbouw-slot'), 'bevestigd', 'beheer');
reset request.jwt.claim.sub;
reset request.jwt.claims;
do $$ declare p public.places; begin
  select * into p from public.places where slug = 'herbouw-slot';
  assert p.departure_check = 'bevestigd', 'bevestiging niet opgeslagen';
  assert p.sources->'beheer' ? 'departure' and p.sources->'beheer' ? 'checkout_until' and p.sources->'beheer' ? 'times_note',
         format('geen slot na bevestigen (%s)', p.sources->'beheer');
end $$;

-- De volgende lezing zegt iets anders: de regel en de bevestiging blijven staan, er komt één voorstel in de inbox
select public.apply_scrape((select id from public.places where slug = 'herbouw-slot'),
  '{"_parser": "45", "departure": "vast", "checkout_until": "11:00", "times_note": "Vertrek voor 11.00 uur.", "price_eur": 18}'::jsonb);
select public.apply_scrape((select id from public.places where slug = 'herbouw-slot'),
  '{"_parser": "45", "departure": "vast", "checkout_until": "11:00", "times_note": "Vertrek voor 11.00 uur.", "price_eur": 18}'::jsonb);
do $$ declare p public.places; n int; begin
  select * into p from public.places where slug = 'herbouw-slot';
  assert p.departure = 'vrij' and p.checkout_until is null, format('bevestigde regel overschreven (%s %s)', p.departure, p.checkout_until);
  assert p.times_note = 'Bij ons geen vaste vertrektijd.', 'bronzin van de bevestigde regel overschreven';
  assert p.departure_check = 'bevestigd', 'bevestiging gewist door de lezing';
  select count(*) into n from public.updates_queue
   where place_id = p.id and source = 'pipeline' and status = 'pending' and field_changed = 'departure' and new_value = '"vast"';
  assert n = 1, format('verwacht precies één voorstel voor de regel, kreeg %s', n);
  select count(*) into n from public.updates_queue where place_id = p.id and field_changed = 'price_eur';
  assert n = 0, 'voorstel voor een veld zonder slot';
end $$;

-- Afwijzen zet geen slot: de regel klopt dan juist niet
insert into public.places (name, slug, lat, lng, departure, times_note)
values ('Herbouw afgewezen', 'herbouw-afgewezen', 52.4, 5.4, 'vrij', 'Vrij in- en uitrijden.');
set local request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000b1';
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000000b1", "role": "authenticated", "aal": "aal2"}';
select public.check_departure((select id from public.places where slug = 'herbouw-afgewezen'), 'afgewezen', 'beheer');
reset request.jwt.claim.sub;
reset request.jwt.claims;
do $$ begin
  assert not coalesce((select sources->'beheer' ? 'departure' from public.places where slug = 'herbouw-afgewezen'), false),
         'afwijzen zette een slot';
end $$;

-- Het slot in de oude vorm (object) blijft werken en wordt samengevoegd
update public.places set sources = sources || '{"beheer": {"price_eur": true}}'::jsonb where slug = 'herbouw-afgewezen';
select private.lock_fields((select id from public.places where slug = 'herbouw-afgewezen'), array['departure']);
do $$ declare b jsonb; begin
  select sources->'beheer' into b from public.places where slug = 'herbouw-afgewezen';
  assert b ? 'price_eur' and b ? 'departure', format('slot niet samengevoegd (%s)', b);
end $$;

-- Bezoekers kunnen het slot niet zelf zetten
set local role anon;
do $$ begin
  begin
    perform private.lock_fields('00000000-0000-0000-0000-000000000000', array['price_eur']);
    raise exception 'anon kan private.lock_fields aanroepen';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

rollback;
select 'beheerslot op het herbouwde schema: alle tests geslaagd' as uitkomst;
