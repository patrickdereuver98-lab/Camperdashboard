-- Veldlog en health() per kanaal (review 16 november 2026, R62 en R64) op het herbouwde schema. Eén transactie.
\set ON_ERROR_STOP 1
begin;

insert into public.places (name, slug, lat, lng, website, price_eur, departure, checkout_until, times_note, sources)
values ('Herbouw log', 'herbouw-log', 52.5, 5.5, 'https://voorbeeld.nl', 20, 'vast', '11:00', 'Vertrek voor 11.00 uur.',
        jsonb_build_object('website_fields', jsonb_build_array('price_eur', 'departure', 'checkout_until', 'times_note'),
                           'website_parser', '43'));

-- Nieuwe parser, andere tijd en geen prijs meer: wijziging en wissen komen allebei in het log
select public.apply_scrape((select id from public.places where slug = 'herbouw-log'),
  '{"_parser": "45", "departure": "vast", "checkout_until": "12:00", "times_note": "Vertrek voor 12.00 uur.", "phone": "0301234567"}'::jsonb);
do $$ declare v_id uuid := (select id from public.places where slug = 'herbouw-log'); n int; begin
  assert (select price_eur from public.places where slug = 'herbouw-log') is null, 'parserwissel wiste de prijs niet (testopzet)';
  select count(*) into n from private.field_log
   where place_id = v_id and field = 'checkout_until' and old_value = '"11:00"' and new_value = '"12:00"' and parser = '45';
  assert n = 1, format('wijziging van de vertrektijd niet gelogd (%s)', n);
  select count(*) into n from private.field_log where place_id = v_id and field = 'price_eur' and old_value = '20' and new_value = 'null';
  assert n = 1, format('gewiste prijs niet gelogd (%s)', n);
  select count(*) into n from private.field_log where place_id = v_id and field in ('departure', 'phone');
  assert n = 0, 'ongewijzigd of geen kernveld toch gelogd';
end $$;

-- health() geeft de nieuwe velden en telt het gewiste kernveld
do $$ declare h jsonb := public.health(); begin
  assert h ? 'stealth_last' and h ? 'web_last' and h ? 'stealth_open' and h ? 'scrape_open', format('kanalen ontbreken (%s)', h);
  assert (h->>'core_wiped_24h')::int >= 1, format('gewist kernveld niet geteld (%s)', h->>'core_wiped_24h');
  assert (h->>'core_changed_24h')::int >= 3, format('wijzigingen niet geteld (%s)', h->>'core_changed_24h');
end $$;

-- Bezoekers lezen het log niet, health() wel
set local role anon;
do $$ begin
  begin
    perform 1 from private.field_log;
    raise exception 'anon leest private.field_log';
  exception when insufficient_privilege then null;
  end;
  perform public.health();
end $$;
reset role;

rollback;
select 'veldlog en kanalen op het herbouwde schema: alle tests geslaagd' as uitkomst;
