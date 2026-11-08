-- Live migratie 20261011074842 (beheer_marker_array), letterlijk uit supabase_migrations.schema_migrations.statements
-- (opgehaald 8 november 2026, review R5). Niet wijzigen: dit is de geschiedenis zoals live toegepast.

do $$
declare d text;
begin
  d := pg_get_functiondef('public.ingest_osm'::regproc);
  d := regexp_replace(d, $re$p\.sources->>'([a-z_]+)' = 'beheer'$re$, $rp$p.sources->'beheer' ? '\1'$rp$, 'g');
  execute d;
  d := pg_get_functiondef('public.apply_scrape'::regproc);
  d := replace(d, $s$continue when p.sources->>f = 'beheer';$s$, $s$continue when p.sources->'beheer' ? f;$s$);
  execute d;
end $$;
