-- Tests voor 20261118100000_plekgeschiedenis.sql: bron per schrijver, alleen kernvelden, terugzetten en leesrecht.
-- Draait in een eigen database met plekgeschiedenis_stub.sql (run.sh).
\set ON_ERROR_STOP 1
reset role;

\i :migration

insert into public.admins (user_id, email) values ('00000000-0000-0000-0000-00000000000a', 'beheer@example.org');
insert into public.places (id, name, lat, lng, price_eur, departure, checkout_until, power) values
  ('00000000-0000-4000-8000-000000000001', 'Haven', 52.1, 5.1, 12, 'vast', '11:00', true);

-- ── Pipeline: bron uit sources, alleen kernvelden ────────────────────────────────────────────────────────────────
do $$
declare r public.place_history;
begin
  -- Scraper: wist de vertrektijd, schrijft de tijdstempel in sources en de score (die volgen we niet)
  update public.places set checkout_until = null, completeness = 0.4,
         sources = sources || '{"website": "2026-11-18T10:00:00Z"}'
   where name = 'Haven';
  assert (select count(*) from public.place_history) = 1, 'alleen checkout_until hoort erin';
  select * into r from public.place_history;
  assert r.field = 'checkout_until' and r.old_value = '"11:00"' and r.new_value = 'null', format('rij: %s', r);
  assert r.source = 'website' and r.actor is null, format('bron: %s', r.source);

  -- PDOK
  update public.places set lat = 52.2, sources = sources || '{"pdok": {"at": "x"}}' where name = 'Haven';
  assert (select source from public.place_history where field = 'lat') = 'pdok';

  -- Ruis in coördinaten: niet vastleggen
  update public.places set lng = 5.100000001 where name = 'Haven';
  assert not exists (select 1 from public.place_history where field = 'lng'), 'lng-ruis vastgelegd';

  -- Zonder sources en zonder jwt: systeem; met service_role: pipeline; expliciete bron gaat voor
  update public.places set price_eur = 13 where name = 'Haven';
  assert (select source from public.place_history where field = 'price_eur' order by id desc limit 1) = 'systeem';
  perform set_config('request.jwt.claims', '{"role": "service_role"}', true);
  update public.places set price_eur = 14 where name = 'Haven';
  assert (select source from public.place_history where field = 'price_eur' order by id desc limit 1) = 'pipeline';
  perform set_config('vrijstaan.bron', 'osm', true);
  update public.places set price_eur = 15 where name = 'Haven';
  assert (select source from public.place_history where field = 'price_eur' order by id desc limit 1) = 'osm';
  perform set_config('vrijstaan.bron', 'onzin', true);
  update public.places set price_eur = 16 where name = 'Haven';
  assert (select source from public.place_history where field = 'price_eur' order by id desc limit 1) = 'pipeline',
    'onbekende bron moet genegeerd worden';
  perform set_config('vrijstaan.bron', '', true);
  perform set_config('request.jwt.claims', '', true);

  -- Update zonder verschil: niets
  update public.places set name = name where name = 'Haven';
  assert (select count(*) from public.place_history) = 6, format('aantal: %s', (select count(*) from public.place_history));
end $$;

-- ── Leesrecht: alleen beheer ─────────────────────────────────────────────────────────────────────────────────────
set role anon;
do $$
begin
  begin
    perform 1 from public.place_history;
    assert false, 'anon kan de geschiedenis lezen';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000bb';
do $$
begin
  assert (select count(*) from public.place_history) = 0, 'een bezoeker ziet de geschiedenis';
  begin
    perform public.admin_revert_place_change((select min(id) from public.place_history));
    assert false, 'een bezoeker kan terugzetten';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.place_history (place_id, field, source) values ('00000000-0000-4000-8000-000000000001', 'name', 'beheer');
    assert false, 'een bezoeker kan schrijven';
  exception when insufficient_privilege then null;
  end;
end $$;

-- ── Beheer: wijziging met naam, terugzetten ──────────────────────────────────────────────────────────────────────
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
do $$
declare
  v_id bigint;
  v_rev public.place_history;
begin
  assert (select count(*) from public.place_history) = 6, 'beheer ziet alles';
  update public.places set power = false where name = 'Haven';
  assert (select actor_email from public.place_history where field = 'power') = 'beheer@example.org';
  assert (select source from public.place_history where field = 'power') = 'beheer';

  -- De gewiste vertrektijd terugzetten
  select id into v_id from public.place_history where field = 'checkout_until';
  perform public.admin_revert_place_change(v_id);
  assert (select checkout_until from public.places where name = 'Haven') = '11:00', 'niet teruggezet';
  assert (select sources -> 'beheer' from public.places where name = 'Haven') = '["checkout_until"]', 'merkteken ontbreekt';
  select * into v_rev from public.place_history where revert_of = v_id;
  assert v_rev.source = 'beheer' and v_rev.new_value = '"11:00"', format('terugzet-rij: %s', v_rev);

  -- Nog een keer dezelfde: het veld is sindsdien veranderd
  begin
    perform public.admin_revert_place_change(v_id);
    assert false, 'dubbel terugzetten mocht';
  exception when invalid_parameter_value then null;
  end;

  -- Een oudere prijs terwijl er nieuwere zijn: weigeren
  select min(id) into v_id from public.place_history where field = 'price_eur';
  begin
    perform public.admin_revert_place_change(v_id);
    assert false, 'oude prijs terugzetten over een nieuwere heen mocht';
  exception when invalid_parameter_value then null;
  end;

  -- Zetten zonder dat de volgende update de terugzet-markering erft
  update public.places set departure = 'vrij' where name = 'Haven';
  assert (select revert_of from public.place_history where field = 'departure') is null, 'revert_of bleef hangen';
end $$;
reset request.jwt.claim.sub;
reset role;

-- ── Bewaartermijn ────────────────────────────────────────────────────────────────────────────────────────────────
do $$
begin
  update public.place_history set ts = now() - interval '25 months' where field = 'lat';
  assert private.place_history_prune() = 1, 'oude rij niet opgeruimd';
  assert not exists (select 1 from public.place_history where field = 'lat');
end $$;
select 'plekgeschiedenis: alle tests geslaagd' as uitkomst;
