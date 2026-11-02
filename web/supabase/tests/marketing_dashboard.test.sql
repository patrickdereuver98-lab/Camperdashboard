-- Test voor migratie 20261102180000_marketing_dashboard.sql. Draait in de Mission Control-database (run.sh), na de
-- andere Mission Control-tests.
\set ON_ERROR_STOP 1
reset role;

-- Stuk van het live schema dat de feitenbank leest en de stub nog niet heeft
alter table public.places add column if not exists province text, add column if not exists created_at timestamptz not null default now(),
  add column if not exists verified_at timestamptz, add column if not exists departure_check text;
create table if not exists public.reviews (id uuid primary key default gen_random_uuid(), place_id uuid, rating smallint, status text);
create table if not exists public.events (id bigserial primary key, ts timestamptz not null default now(), name text, path text,
  props jsonb not null default '{}', session_id text);

-- Plekken uit eerdere tests tellen niet mee: alleen de 'Feit'-plekken zijn gepubliceerd
update public.places set status = 'concept';
insert into public.places (name, province, status, departure, checkout_until, departure_check, price_eur, power) values
  ('Feit vrij', 'Zeeland', 'published', 'vrij', null, null, 0, true),
  ('Feit vrij voorwaardelijk', 'Zeeland', 'published', 'vrij', null, 'voorwaardelijk', 10, true),
  ('Feit uitslaper', 'Zeeland', 'published', 'vast', '12:00', null, 20, false),
  ('Feit ruim', 'Gelderland', 'published', 'vast', '11.30', null, 30, null),
  ('Feit vroeg', 'Gelderland', 'published', 'vast', '9:00', null, null, null),
  ('Feit onleesbaar', 'Gelderland', 'published', 'vast', 'middag', null, null, null),
  ('Feit concept', 'Gelderland', 'concept', 'vrij', null, null, 5, true);
insert into public.reviews (rating, status) values (8, 'approved'), (9, 'approved'), (2, 'pending');
insert into public.events (name, props, session_id) values
  ('page_view', '{"bron": "instagram", "campagne": "voorjaar"}', 's1'),
  ('page_view', '{"bron": "instagram", "campagne": "voorjaar"}', 's1'),
  ('page_view', '{"bron": "instagram"}', 's2'),
  ('page_view', '{}', 's3'),
  ('search', '{"bron": "tiktok"}', 's4');

\i :migration

-- Gewone gebruiker: geen feiten, geen tabellen
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000c';
do $$ begin
  begin
    perform public.marketing_facts();
    assert false, 'gast kreeg de feitenbank';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.marketing_traffic(28);
    assert false, 'gast kreeg het verkeer';
  exception when insufficient_privilege then null;
  end;
  assert (select count(*) from public.content_items) = 0, 'gast ziet content';
  begin
    insert into public.content_items (pillar, channel, title) values ('app', 'instagram', 'x');
    assert false, 'gast kon content maken';
  exception when insufficient_privilege then null;
  end;
end $$;

-- Support is geen admin
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
do $$ begin
  begin
    perform public.marketing_facts();
    assert false, 'support kreeg de feitenbank';
  exception when insufficient_privilege then null;
  end;
end $$;

-- Beheerder: feiten volgen departureKind, concepten tellen niet mee
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
do $$
declare f jsonb := public.marketing_facts();
begin
  assert (f ->> 'places')::int = (select count(*) from public.places where status = 'published'), 'aantal plekken';
  assert (f -> 'departure' ->> 'vrij')::int = 1, 'vrij (voorwaardelijk telt niet)';
  assert (f -> 'departure' ->> 'uitslapers')::int = 1, 'uitslapers';
  assert (f -> 'departure' ->> 'ruim')::int = 1, 'ruim (11.30 met punt)';
  assert (f -> 'departure' ->> 'vroeg')::int = 1, 'vroeg';
  assert (f -> 'price' ->> 'free')::int = 1, 'gratis';
  assert (f -> 'price' ->> 'median')::numeric = 20, 'mediaan van 10, 20, 30';
  assert (f -> 'reviews' ->> 'count')::int = 2, 'alleen goedgekeurde reviews';
  assert (f -> 'reviews' ->> 'avg')::numeric = 8.5, 'gemiddelde';
  assert jsonb_array_length(f -> 'provinces') >= 2, 'provincies';
end $$;

do $$
declare t jsonb := public.marketing_traffic(28);
begin
  assert (t ->> 'sessions')::int = 3, 'drie sessies met page_view';
  assert (t -> 'per_bron' -> 0 ->> 'bron') = 'instagram' and (t -> 'per_bron' -> 0 ->> 'sessions')::int = 2, 'instagram 2 sessies';
  assert exists (select 1 from jsonb_array_elements(t -> 'per_bron') x where x ->> 'bron' = 'direct'), 'zonder bron = direct';
  assert (t -> 'per_campagne' -> 0 ->> 'campagne') = 'voorjaar', 'campagne';
end $$;

-- Beheerder maakt content, campagne en een job
insert into public.content_items (pillar, channel, title, body) values ('cijfers', 'instagram', 'Cijfers november', 'Tekst');
insert into public.campaigns (name, channel, bron, campagne, budget_eur) values ('Voorjaar', 'instagram', 'instagram', 'voorjaar', 40);
do $$ begin
  begin
    insert into public.campaigns (name, channel, bron, campagne) values ('Fout', 'instagram', 'Insta Gram', 'x');
    assert false, 'bron met hoofdletters en spatie toegestaan';
  exception when check_violation then null;
  end;
end $$;
insert into public.marketing_jobs (id, kind, template, format, props)
  values ('77777777-7777-7777-7777-777777777777', 'video', 'cijfers', 'vertical', '{"facts": {"places": 6}}');

-- De Action (als eigenaar van de database) pakt de job op en meldt klaar
reset role;
do $$
declare j public.marketing_jobs := private.marketing_claim_job();
begin
  assert j.id = '77777777-7777-7777-7777-777777777777' and j.status = 'bezig', 'job niet opgepakt';
  assert (private.marketing_claim_job()).id is null, 'zelfde job twee keer opgepakt';
  assert public.marketing_upload_allowed('jobs/77777777-7777-7777-7777-777777777777/cijfers.mp4'), 'upload naar eigen pad geweigerd';
  assert not public.marketing_upload_allowed('jobs/88888888-8888-8888-8888-888888888888/x.mp4'), 'upload naar ander pad toegestaan';
  assert not public.marketing_upload_allowed('elders/77777777-7777-7777-7777-777777777777/x.mp4'), 'upload buiten jobs/ toegestaan';
  perform private.marketing_finish_job(j.id, '[{"kind": "video", "path": "jobs/77777777-7777-7777-7777-777777777777/cijfers.mp4", "title": "Cijfers"},
                                               {"kind": "video", "path": "jobs/anders/kwaad.mp4"}]');
  assert (select status from public.marketing_jobs where id = j.id) = 'klaar', 'job niet klaar';
  assert (select count(*) from public.marketing_assets where job_id = j.id) = 1, 'pad buiten de job toch opgeslagen';
  assert (select facts_snapshot ->> 'places' from public.marketing_assets where job_id = j.id) = '6', 'feiten niet bewaard';
  assert not public.marketing_upload_allowed('jobs/77777777-7777-7777-7777-777777777777/later.mp4'), 'upload na klaar toegestaan';
end $$;

-- Fout melden
insert into public.marketing_jobs (id, kind) values ('99999999-9999-9999-9999-999999999999', 'schermopnames');
do $$
declare j public.marketing_jobs := private.marketing_claim_job();
begin
  perform private.marketing_finish_job(j.id, null, 'Playwright faalde');
  assert (select status || ':' || error from public.marketing_jobs where id = j.id) = 'fout:Playwright faalde', 'fout niet bewaard';
end $$;

-- Content bijwerken zet updated_at
do $$
declare before timestamptz;
begin
  select updated_at into before from public.content_items limit 1;
  perform pg_sleep(0.01);
  update public.content_items set status = 'klaar';
  assert (select updated_at from public.content_items limit 1) > before, 'updated_at niet bijgewerkt';
end $$;

-- Cron staat erin
do $$ begin
  assert exists (select 1 from cron.job where jobname = 'marketing-opruimen'), 'cron marketing-opruimen ontbreekt';
end $$;
select 'marketing-dashboard: alle tests geslaagd' as uitkomst;
