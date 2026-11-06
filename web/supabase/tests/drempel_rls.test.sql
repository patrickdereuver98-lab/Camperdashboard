-- Tests voor 20261106200200_publicatiedrempel.sql (DB-11, README 38) en de leesregel van places (R40: anon ziet geen
-- concepten). Draait in een eigen database met drempel_stub.sql (run.sh).
\set ON_ERROR_STOP 1
reset role;

\i :migration

-- ── Eén standaard: zonder instelling 0,45 in de functie én in de trigger ─────────────────────────────────────────
delete from public.site_settings where key = 'publish_threshold';
insert into public.places (name, test_score) values ('Net boven 0,45', 0.5), ('Net onder 0,45', 0.44);
insert into public.places (name, test_score, test_must_haves) values ('Hoge score zonder contact', 0.9, false);
insert into public.places (name, test_score, status, status_locked) values ('Vastgezet concept', 0.9, 'draft', true);
do $$ begin
  assert private.publish_threshold() = 0.45, format('publish_threshold() = %s', private.publish_threshold());
  assert (select status from public.places where name = 'Net boven 0,45') = 'published', 'trigger gebruikt een andere standaard dan 0,45';
  assert (select status from public.places where name = 'Net onder 0,45') = 'draft', 'onder de drempel gepubliceerd';
  assert (select status from public.places where name = 'Hoge score zonder contact') = 'draft', 'verplichte velden genegeerd';
  assert (select status from public.places where name = 'Vastgezet concept') = 'draft', 'status_locked genegeerd';
end $$;

-- Met instelling: functie en trigger volgen dezelfde waarde
insert into public.site_settings (key, value) values ('publish_threshold', '0.6');
update public.places set name = name;
do $$ begin
  assert private.publish_threshold() = 0.6, 'instelling niet gelezen';
  assert (select status from public.places where name = 'Net boven 0,45') = 'draft', 'trigger volgt de instelling niet';
end $$;

-- apply-threshold neemt ook de verplichte velden mee
delete from public.site_settings;
insert into public.admins (user_id, email) values ('00000000-0000-0000-0000-00000000000a', 'beheer@example.nl');
insert into auth.users (id, email) values ('00000000-0000-0000-0000-00000000000a', 'beheer@example.nl');
alter table public.places disable trigger places_before_write;
update public.places set status = 'published', completeness = 0.9 where name = 'Hoge score zonder contact';
update public.places set completeness = 0.5, status = 'draft' where name = 'Net boven 0,45';
alter table public.places enable trigger places_before_write;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
do $$ begin
  perform public.admin_pipeline('apply-threshold');
  assert (select status from public.places where name = 'Hoge score zonder contact') = 'draft', 'apply-threshold liet plek zonder verplichte velden staan';
  assert (select status from public.places where name = 'Net boven 0,45') = 'published', 'apply-threshold publiceerde niet';
end $$;
reset request.jwt.claim.sub;

-- ── RLS: anon en gewone accounts zien alleen gepubliceerde plekken ────────────────────────────────────────────────
set role anon;
do $$ begin
  assert (select count(*) from public.places where status <> 'published') = 0, 'anon ziet concepten';
  assert (select count(*) from public.places) = (select count(*) from public.places where status = 'published'), 'anon';
  assert (select count(*) from public.places) > 0, 'anon ziet geen gepubliceerde plekken';
end $$;
reset role;
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000c';
do $$ begin
  assert (select count(*) from public.places where status <> 'published') = 0, 'gewoon account ziet concepten';
  update public.places set name = 'gekaapt';
  assert not exists (select 1 from public.places where name = 'gekaapt'), 'gewoon account kan plekken wijzigen';
end $$;
-- Beheer ziet alles
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
do $$ begin
  assert (select count(*) from public.places where status = 'draft') > 0, 'beheer ziet geen concepten';
end $$;
reset request.jwt.claim.sub;
reset role;

select 'publicatiedrempel en RLS: alle tests geslaagd' as uitkomst;
