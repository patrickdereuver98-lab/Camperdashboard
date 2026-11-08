-- Live migratie 20261012061539 (places_geom_full_index), letterlijk uit supabase_migrations.schema_migrations.statements
-- (opgehaald 8 november 2026, review R5). Niet wijzigen: dit is de geschiedenis zoals live toegepast.

create index if not exists places_geom_all_gist on public.places using gist (geom);
