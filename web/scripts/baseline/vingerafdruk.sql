-- Vingerafdruk van het app-schema (review november 2026, R5): één regel per object met de genormaliseerde definitie.
-- Draait op live (maak-baseline.py schrijft web/supabase/baseline/vingerafdruk.txt) en in de herbouwtest op de
-- schone database; verschil = de nulmigratie dekt live niet. Alleen lezen.
set search_path = '';

with
app_ns as (select oid, nspname from pg_namespace where nspname in ('public', 'private')),
ext_obj as (select objid from pg_depend where deptype = 'e'),
tabellen as (
  select c.oid, c.oid::regclass::text as naam, c.relrowsecurity, c.relacl, c.relowner
  from pg_class c join app_ns n on n.oid = c.relnamespace
  where c.relkind in ('r', 'p') and c.oid not in (select objid from ext_obj)
),
functies as (
  select p.oid, p.oid::regprocedure::text as sig, p.proacl, p.proowner
  from pg_proc p join app_ns n on n.oid = p.pronamespace
  where p.oid not in (select objid from ext_obj)
),
rol as (select oid, rolname::text as naam from pg_roles union all select 0, 'PUBLIC'),
regels(soort, naam, detail) as (
  -- extensies die Supabase zelf beheert (graphql, vault, statistieken) tellen niet mee
  select 'extensie', e.extname::text, e.extnamespace::regnamespace::text from pg_extension e
  where e.extname not in ('plpgsql', 'pg_graphql', 'supabase_vault', 'pg_stat_statements')
  union all
  select 'schema', nspname::text, '' from app_ns
  union all
  select 'tabel', t.naam, case when t.relrowsecurity then 'rls' else 'geen rls' end from tabellen t
  union all
  select 'kolom', t.naam || '.' || a.attname,
    concat_ws(' ', format_type(a.atttypid, a.atttypmod), case when a.attnotnull then 'not null' end,
      case a.attidentity when 'a' then 'identity always' when 'd' then 'identity by default' end,
      case a.attgenerated when 's' then 'generated ' || pg_get_expr(d.adbin, d.adrelid) end,
      case when a.attgenerated = '' and d.adbin is not null then 'default ' || pg_get_expr(d.adbin, d.adrelid) end)
  from tabellen t join pg_attribute a on a.attrelid = t.oid and a.attnum > 0 and not a.attisdropped
  left join pg_attrdef d on d.adrelid = a.attrelid and d.adnum = a.attnum
  union all
  select 'constraint', t.naam || '.' || co.conname, pg_get_constraintdef(co.oid)
  from tabellen t join pg_constraint co on co.conrelid = t.oid where co.contype in ('p', 'u', 'c', 'f', 'x')
  union all
  select 'index', i.indexrelid::regclass::text, pg_get_indexdef(i.indexrelid)
  from tabellen t join pg_index i on i.indrelid = t.oid
  union all
  select 'reeks', c.oid::regclass::text, format_type(s.seqtypid, null)
  from pg_class c join app_ns n on n.oid = c.relnamespace join pg_sequence s on s.seqrelid = c.oid where c.relkind = 'S'
  union all
  select 'view', c.oid::regclass::text, md5(pg_get_viewdef(c.oid))
  from pg_class c join app_ns n on n.oid = c.relnamespace where c.relkind in ('v', 'm')
  union all
  select 'functie', f.sig, md5(pg_get_functiondef(f.oid)) from functies f
  union all
  select 'trigger', tg.tgrelid::regclass::text || '.' || tg.tgname, pg_get_triggerdef(tg.oid)
  from pg_trigger tg join pg_class c on c.oid = tg.tgrelid
  where not tg.tgisinternal and (c.relnamespace in (select oid from app_ns) or tg.tgfoid in (select oid from functies))
  union all
  select 'policy', pol.polrelid::regclass::text || '.' || pol.polname,
    concat_ws(' | ', case when pol.polpermissive then 'permissive' else 'restrictive' end, pol.polcmd::text,
      (select string_agg(case when r = 0 then 'PUBLIC' else pg_get_userbyid(r)::text end, ',' order by 1) from unnest(pol.polroles) r),
      pg_get_expr(pol.polqual, pol.polrelid), pg_get_expr(pol.polwithcheck, pol.polrelid))
  from pg_policy pol join pg_class c on c.oid = pol.polrelid
  where c.relnamespace in (select oid from app_ns) or pol.polrelid = 'storage.objects'::regclass
  union all
  -- rechten zonder grantor en zonder de eigenaar; een lege ACL telt als de standaard
  select 'recht', t.naam || ' ' || r.naam, string_agg(lower(x.privilege_type), ',' order by x.privilege_type)
  from tabellen t cross join lateral aclexplode(coalesce(t.relacl, acldefault('r', t.relowner))) x join rol r on r.oid = x.grantee
  where x.grantee <> t.relowner and r.naam in ('PUBLIC', 'anon', 'authenticated', 'service_role')
  group by t.naam, r.naam
  union all
  select 'kolomrecht', t.naam || '.' || a.attname || ' ' || r.naam, string_agg(lower(x.privilege_type), ',' order by x.privilege_type)
  from tabellen t join pg_attribute a on a.attrelid = t.oid and a.attnum > 0 and not a.attisdropped and a.attacl is not null
  cross join lateral aclexplode(a.attacl) x join rol r on r.oid = x.grantee
  where x.grantee <> t.relowner and r.naam in ('PUBLIC', 'anon', 'authenticated', 'service_role')
  group by t.naam, a.attname, r.naam
  union all
  select 'reeksrecht', c.oid::regclass::text || ' ' || r.naam, string_agg(lower(x.privilege_type), ',' order by x.privilege_type)
  from pg_class c join app_ns n on n.oid = c.relnamespace
  cross join lateral aclexplode(coalesce(c.relacl, acldefault('s', c.relowner))) x join rol r on r.oid = x.grantee
  where c.relkind = 'S' and x.grantee <> c.relowner and r.naam in ('PUBLIC', 'anon', 'authenticated', 'service_role')
  group by c.oid, r.naam
  union all
  select 'functierecht', f.sig || ' ' || r.naam, 'execute'
  from functies f cross join lateral aclexplode(coalesce(f.proacl, acldefault('f', f.proowner))) x join rol r on r.oid = x.grantee
  where x.grantee <> f.proowner and r.naam in ('PUBLIC', 'anon', 'authenticated', 'service_role')
  union all
  select 'schemarecht', n.nspname || ' ' || r.naam, string_agg(lower(x.privilege_type), ',' order by x.privilege_type)
  from pg_namespace n cross join lateral aclexplode(n.nspacl) x join rol r on r.oid = x.grantee
  where n.nspname in ('public', 'private') and r.naam in ('PUBLIC', 'anon', 'authenticated', 'service_role')
  group by n.nspname, r.naam
  union all
  select 'standaardrecht', da.defaclobjtype::text || ' ' || n.nspname || ' ' || r.naam, string_agg(lower(x.privilege_type), ',' order by x.privilege_type)
  from pg_default_acl da join pg_namespace n on n.oid = da.defaclnamespace
  cross join lateral aclexplode(da.defaclacl) x join rol r on r.oid = x.grantee
  where pg_get_userbyid(da.defaclrole) = 'postgres' and n.nspname in ('public', 'private')
    and r.naam in ('PUBLIC', 'anon', 'authenticated', 'service_role')
  group by da.defaclobjtype, n.nspname, r.naam
  union all
  select 'publicatie', pubname || ' ' || schemaname || '.' || tablename, '' from pg_publication_tables where schemaname in ('public', 'private')
  union all
  select 'bucket', b.id, concat_ws(' ', b.public, b.file_size_limit, b.allowed_mime_types::text) from storage.buckets b
)
select soort, naam, replace(coalesce(detail, ''), E'\n', ' ') as detail from regels order by soort, naam, detail;
