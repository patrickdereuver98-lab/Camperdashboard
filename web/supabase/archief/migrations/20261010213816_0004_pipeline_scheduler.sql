-- Live migratie 20261010213816 (0004_pipeline_scheduler), letterlijk uit supabase_migrations.schema_migrations.statements
-- (opgehaald 8 november 2026, review R5). Niet wijzigen: dit is de geschiedenis zoals live toegepast.

create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron;

-- Roept de pipeline-function aan vanuit de database
create or replace function private.call_pipeline(p_body jsonb)
returns bigint language plpgsql security definer set search_path = '' as $$
declare k text; rid bigint;
begin
  select value into k from public.internal_secrets where name = 'pipeline_key';
  select net.http_post(
    url := 'https://qkrmthrhwmmmwswmfgwc.supabase.co/functions/v1/pipeline',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-pipeline-key', k),
    body := p_body,
    timeout_milliseconds := 150000
  ) into rid;
  return rid;
end;
$$;
revoke all on function private.call_pipeline from public;
