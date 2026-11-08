-- Live migratie 20261015082646 (rate_limit_tracking), letterlijk uit supabase_migrations.schema_migrations.statements
-- (opgehaald 8 november 2026, review R5). Niet wijzigen: dit is de geschiedenis zoals live toegepast.

create or replace function public.track(p_name text, p_path text, p_props jsonb, p_session text)
 returns void language plpgsql security definer set search_path to ''
as $$
begin
  if p_name not in ('page_view','search','place_view','outbound','route','save') then return; end if;
  if jsonb_typeof(coalesce(p_props, '{}')) <> 'object' or pg_column_size(p_props) > 600 then return; end if;
  if not private.rate_take('track:min', 300, interval '1 minute')
     or not private.rate_take('track:dag', 20000, interval '1 day') then return; end if;
  insert into public.events (name, path, props, session_id)
  values (p_name, private.safe_path(p_path), coalesce(p_props, '{}'), left(p_session, 64));
end $$;

create or replace function public.log_consent(p_consent_id text, p_analytics boolean, p_marketing boolean, p_version text)
 returns void language plpgsql security definer set search_path to ''
as $$
begin
  if not private.rate_take('consent:min', 60, interval '1 minute')
     or not private.rate_take('consent:dag', 3000, interval '1 day') then return; end if;
  insert into public.consent_log (consent_id, analytics, marketing, version)
  values (left(p_consent_id, 64), p_analytics, p_marketing, left(p_version, 20));
end $$;

create or replace function public.report_client_error(p_message text, p_context jsonb)
 returns void language plpgsql security definer set search_path to ''
as $$
declare ctx jsonb := case when pg_column_size(p_context) > 4000 or jsonb_typeof(p_context) <> 'object' then '{}'::jsonb else p_context end;
begin
  if not private.rate_take('client-error:min', 30, interval '1 minute')
     or not private.rate_take('client-error:dag', 1000, interval '1 day') then return; end if;
  if ctx ? 'path' then ctx := jsonb_set(ctx, '{path}', to_jsonb(private.safe_path(ctx->>'path'))); end if;
  perform private.log('error', 'client', regexp_replace(left(p_message, 500), '/support/[A-Za-z0-9_-]+', '/support/[token]', 'g'), ctx);
end $$;
