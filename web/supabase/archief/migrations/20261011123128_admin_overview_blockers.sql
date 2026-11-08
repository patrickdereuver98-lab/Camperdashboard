-- Live migratie 20261011123128 (admin_overview_blockers), letterlijk uit supabase_migrations.schema_migrations.statements
-- (opgehaald 8 november 2026, review R5). Niet wijzigen: dit is de geschiedenis zoals live toegepast.

do $$
declare d text;
begin
  d := pg_get_functiondef('public.admin_overview'::regproc);
  d := replace(d, $s$'near', count(*) filter (where status = 'draft' and completeness >= 0.7),$s$,
    $s$'near', count(*) filter (where status = 'draft' and completeness >= 0.6),
        'blocked_contact', count(*) filter (where status = 'draft' and website is null and phone is null),
        'blocked_facts', count(*) filter (where status = 'draft' and ((price_eur is not null)::int + (open_all_year is not null or season is not null)::int + (power is not null)::int) < 2),
        'blocked_score', count(*) filter (where status = 'draft' and public.place_meets_must_haves(places) and completeness < (select (value #>> '{}')::numeric from public.site_settings where key = 'publish_threshold')),$s$);
  execute d;
end $$;
