-- Kernregels op het volledige, herbouwde schema (R5 en R40): geen stub, maar de echte tabellen, triggers en rechten
-- uit de nulmigratie plus de migraties daarna. Alles in één transactie die aan het eind terugdraait.
\set ON_ERROR_STOP 1
begin;

-- ── Leesrechten: anon ziet geen concepten, geen privégegevens van reviewers en niets in private ─────────────────
insert into public.places (name, slug, lat, lng) values ('Herbouw concept', 'herbouw-concept', 52.1, 5.1);
do $$ begin
  assert (select status from public.places where slug = 'herbouw-concept') = 'draft', 'nieuwe plek zonder kernfeiten is geen concept';
end $$;

set local role anon;
do $$ begin
  assert (select count(*) from public.places where status <> 'published') = 0, 'anon ziet concepten of verborgen plekken';
  begin
    perform author_email from public.reviews;
    raise exception 'anon leest reviews.author_email';
  exception when insufficient_privilege then null;
  end;
  begin
    perform admin_note from public.reviews;
    raise exception 'anon leest reviews.admin_note';
  exception when insufficient_privilege then null;
  end;
  begin
    perform 1 from private.scrape_queue;
    raise exception 'anon leest private.scrape_queue';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

set local role authenticated;
do $$ begin
  assert (select count(*) from public.places where status <> 'published') = 0, 'ingelogde bezoeker zonder beheerrol ziet concepten';
  begin
    perform user_id from public.reviews;
    raise exception 'authenticated leest reviews.user_id';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

-- ── apply_scrape: halve lezing wist niets, beheer gaat voor, controledatum alleen bij een kernveld ──────────────
insert into public.places (name, slug, lat, lng, website, price_eur, departure, checkout_until, phone, verified_at, sources)
values ('Herbouw scrape', 'herbouw-scrape', 52.2, 5.2, 'https://voorbeeld.nl', 20, 'vast', '11:00', '0301234567',
        '2026-01-01', jsonb_build_object('website_fields', jsonb_build_array('price_eur', 'departure', 'checkout_until', 'phone'),
                                         'website_parser', '43'));

-- Een lezing waarbij pagina's mislukten: niets verdwijnt, ook velden buiten de kernvelden niet
select public.apply_scrape((select id from public.places where slug = 'herbouw-scrape'), '{"_pages_failed": true}'::jsonb);
do $$ declare p public.places; begin
  select * into p from public.places where slug = 'herbouw-scrape';
  assert p.price_eur = 20, format('halve lezing wiste de prijs (%s)', p.price_eur);
  assert p.departure = 'vast' and p.checkout_until = '11:00', 'halve lezing wiste de vertrektijd';
  assert p.phone = '0301234567', 'halve lezing wiste het telefoonnummer';
  assert p.verified_at = '2026-01-01', 'controledatum gezet zonder kernveld';
end $$;

-- Een volledige lezing zonder prijs met dezelfde parser: prijs en vertrektijd blijven staan (keep)
select public.apply_scrape((select id from public.places where slug = 'herbouw-scrape'), '{"_parser": "43", "phone": "0301234567"}'::jsonb);
do $$ declare p public.places; begin
  select * into p from public.places where slug = 'herbouw-scrape';
  assert p.price_eur = 20 and p.departure = 'vast', 'volledige lezing met dezelfde parser wiste een kernveld';
  assert p.verified_at = '2026-01-01', 'controledatum gezet bij alleen een telefoonnummer (R20)';
end $$;

-- Beheer gaat voor: een vastgezette prijs blijft, ook als de site iets anders zegt; een kernveld zet de controledatum
update public.places set sources = sources || '{"beheer": {"price_eur": true}}'::jsonb where slug = 'herbouw-scrape';
select public.apply_scrape((select id from public.places where slug = 'herbouw-scrape'),
                           '{"_parser": "43", "price_eur": 99, "departure": "vast", "checkout_until": "10:00"}'::jsonb);
do $$ declare p public.places; begin
  select * into p from public.places where slug = 'herbouw-scrape';
  assert p.price_eur = 20, format('beheerprijs overschreven door de site (%s)', p.price_eur);
  assert p.checkout_until = '10:00', format('vertrektijd van de site niet overgenomen (%s)', p.checkout_until);
  assert p.verified_at > '2026-01-01', 'controledatum niet gezet bij een gevonden kernveld';
end $$;

rollback;
select 'kernregels op het herbouwde schema: alle tests geslaagd' as uitkomst;
