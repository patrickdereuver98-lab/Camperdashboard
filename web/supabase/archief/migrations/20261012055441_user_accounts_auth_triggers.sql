-- Live migratie 20261012055441 (user_accounts_auth_triggers), letterlijk uit supabase_migrations.schema_migrations.statements
-- (opgehaald 8 november 2026, review R5). Niet wijzigen: dit is de geschiedenis zoals live toegepast.

set local lock_timeout = '10s';
create trigger on_auth_user_profile after insert on auth.users for each row execute function private.create_profile();
create trigger on_auth_user_confirmed after update of email_confirmed_at on auth.users
  for each row when (old.email_confirmed_at is null and new.email_confirmed_at is not null)
  execute function private.on_auth_user_created();
