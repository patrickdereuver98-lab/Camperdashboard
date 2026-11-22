-- Herlezing 20 november 2026 (20261120400000_vertrek_niet_stil_wissen): een vertrekregel verdwijnt nooit stil.
\set ON_ERROR_STOP 1
begin;

insert into public.places (name, slug, lat, lng, website, price_eur, departure, checkout_until, times_note, sources)
values ('Herbouw vertrek', 'herbouw-vertrek', 52.5, 5.5, 'https://voorbeeld.nl', 20, 'vast', '11:00', 'Vertrek voor 11.00 uur.',
        jsonb_build_object('website_fields', jsonb_build_array('price_eur', 'departure', 'checkout_until', 'times_note'),
                           'website_parser', '43'));

-- Nieuwe parser vindt geen vertrek (twee tijden op de site): regel, tijd en bronzin blijven, wissen wordt een voorstel
select public.apply_scrape((select id from public.places where slug = 'herbouw-vertrek'),
  '{"_parser": "47", "price_eur": 20, "times_note": "Twee vertrektijden op de site (10:00 en 11:00): niet ingevuld, nakijken in Beheer"}'::jsonb);
do $$ declare p public.places; n int; begin
  select * into p from public.places where slug = 'herbouw-vertrek';
  assert p.departure = 'vast' and p.checkout_until = '11:00', format('vertrekregel stil gewist (%s %s)', p.departure, p.checkout_until);
  assert p.times_note = 'Vertrek voor 11.00 uur.', format('bronzin vervangen (%s)', p.times_note);
  select count(*) into n from public.updates_queue
   where place_id = p.id and field_changed = 'departure' and source = 'pipeline' and status = 'pending' and new_value = 'null'::jsonb;
  assert n = 1, format('geen voorstel om te wissen (%s)', n);
end $$;

-- Nog een lezing: geen tweede voorstel
select public.apply_scrape((select id from public.places where slug = 'herbouw-vertrek'), '{"_parser": "47", "price_eur": 20}'::jsonb);
do $$ declare n int; begin
  select count(*) into n from public.updates_queue q join public.places p on p.id = q.place_id
   where p.slug = 'herbouw-vertrek' and q.field_changed = 'departure' and q.status = 'pending';
  assert n = 1, format('dubbel voorstel (%s)', n);
end $$;

-- Een andere regel van de site wordt gewoon overgenomen
select public.apply_scrape((select id from public.places where slug = 'herbouw-vertrek'),
  '{"_parser": "47", "departure": "vast", "checkout_until": "12:00", "times_note": "Vertrek voor 12.00 uur."}'::jsonb);
do $$ declare p public.places; begin
  select * into p from public.places where slug = 'herbouw-vertrek';
  assert p.checkout_until = '12:00', format('nieuwe tijd niet overgenomen (%s)', p.checkout_until);
end $$;

rollback;
select 'vertrek niet stil wissen: alle tests geslaagd' as uitkomst;
