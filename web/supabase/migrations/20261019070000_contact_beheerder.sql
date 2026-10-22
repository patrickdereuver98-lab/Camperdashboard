-- Besluit eigenaar (19 oktober 2026): bij plekken zonder website of telefoon telt ook een e-mailadres of de beheerder
-- uit OpenStreetMap (`operator`, bv. "Gemeente Leek") als contact voor publicatie. Vooral gemeentelijke camperplaatsen
-- hebben geen website (datareview D11: 32 camperplaatsen met wel 2 kernfeiten).
-- Tegelijk (datareview F7): OSM overschrijft telefoon, e-mail, straat en postcode niet meer als Beheer ze vastzette.

alter table public.places add column if not exists operator text;

create or replace function public.place_meets_must_haves(p public.places)
 returns boolean
 language sql
 immutable
 set search_path to ''
as $function$
  select (p.website is not null or p.phone is not null or p.email is not null or nullif(trim(p.operator), '') is not null)
     and ((p.departure is not null)::int + (p.open_all_year is not null or p.season is not null)::int
          + (p.power is not null)::int + (p.price_eur is not null)::int) >= 2;
$function$;

-- ingest_osm: operator meenemen (nieuw en bijwerken) en Beheer laten voorgaan bij contact en adres
do $$
declare d text := pg_get_functiondef('public.ingest_osm(jsonb)'::regprocedure);
begin
  d := replace(d, 'website, phone, email, image_url, image_credit,', 'website, phone, email, operator, image_url, image_credit,');
  d := replace(d, $a$r->>'website', r->>'phone', r->>'email', r->>'image_url'$a$, $a$r->>'website', r->>'phone', r->>'email', r->>'operator', r->>'image_url'$a$);
  d := replace(d, $a$street = coalesce(r->>'street', p.street), postcode = coalesce(r->>'postcode', p.postcode),$a$,
    $a$street = case when p.sources->'beheer' ? 'street' then p.street else coalesce(r->>'street', p.street) end,
        postcode = case when p.sources->'beheer' ? 'postcode' then p.postcode else coalesce(r->>'postcode', p.postcode) end,$a$);
  d := replace(d, $a$phone = coalesce(r->>'phone', p.phone), email = coalesce(r->>'email', p.email),$a$,
    $a$phone = case when p.sources->'beheer' ? 'phone' then p.phone else coalesce(r->>'phone', p.phone) end,
        email = case when p.sources->'beheer' ? 'email' then p.email else coalesce(r->>'email', p.email) end,
        operator = case when p.sources->'beheer' ? 'operator' then p.operator else coalesce(r->>'operator', p.operator) end,$a$);
  if position('r->>''operator''' in d) = 0 or position('beheer'' ? ''phone''' in d) = 0 then
    raise exception 'ingest_osm: vervanging niet gelukt';
  end if;
  execute d;
end $$;

-- Alle regio's opnieuw uit OSM halen, zodat operator overal gevuld wordt (de cron loopt ze een voor een af)
update public.osm_regions set last_run_at = '2000-01-01';
