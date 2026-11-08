-- Live migratie 20261012132541 (crowd_retention), letterlijk uit supabase_migrations.schema_migrations.statements
-- (opgehaald 8 november 2026, review R5). Niet wijzigen: dit is de geschiedenis zoals live toegepast.

select cron.schedule('crowd-retention', '17 3 * * *', $$delete from public.crowd_reports where created_at < now() - interval '30 days'$$);
