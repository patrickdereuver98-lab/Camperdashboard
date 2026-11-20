-- Tests voor 20261120200000_publicatie_op_regels.sql (dataplan november §7, README 139): de score telt niet meer voor
-- publicatie, alleen de harde eisen. Draait na drempel_rls.test.sql in dezelfde database (run.sh).
\set ON_ERROR_STOP 1
reset role;

\i :migration_regels

delete from public.places;
insert into public.site_settings (key, value) values ('publish_threshold', '0.9') on conflict (key) do update set value = excluded.value;
insert into public.places (name, test_score) values ('Lage score met eisen', 0.2);
insert into public.places (name, test_score, test_must_haves) values ('Hoge score zonder eisen', 0.95, false);
insert into public.places (name, test_score, status, status_locked) values ('Vastgezet concept', 0.2, 'draft', true);
do $$ begin
  assert (select status from public.places where name = 'Lage score met eisen') = 'published', 'score telt nog voor publicatie';
  assert (select status from public.places where name = 'Hoge score zonder eisen') = 'draft', 'harde eisen genegeerd';
  assert (select status from public.places where name = 'Vastgezet concept') = 'draft', 'status_locked genegeerd';
end $$;

-- apply-threshold volgt dezelfde regel
alter table public.places disable trigger places_before_write;
update public.places set status = 'draft' where name = 'Lage score met eisen';
update public.places set status = 'published' where name = 'Hoge score zonder eisen';
alter table public.places enable trigger places_before_write;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
do $$ begin
  assert public.admin_pipeline('apply-threshold') = '2', 'apply-threshold wisselde niet precies twee plekken';
  assert (select status from public.places where name = 'Lage score met eisen') = 'published', 'apply-threshold publiceerde niet';
  assert (select status from public.places where name = 'Hoge score zonder eisen') = 'draft', 'apply-threshold liet plek zonder eisen staan';
end $$;
reset request.jwt.claim.sub;

select 'publicatie op regels: alle tests geslaagd' as uitkomst;
