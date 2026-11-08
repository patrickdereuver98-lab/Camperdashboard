-- Live migratie 20261011073340 (publish_threshold_setting), letterlijk uit supabase_migrations.schema_migrations.statements
-- (opgehaald 8 november 2026, review R5). Niet wijzigen: dit is de geschiedenis zoals live toegepast.

create or replace function private.publish_threshold()
returns numeric language sql stable set search_path = '' as $$
  select coalesce((select (value #>> '{}')::numeric from public.site_settings where key = 'publish_threshold'), 0.8);
$$;

create or replace function private.places_before_write()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  new.completeness := public.place_completeness(new);
  if not new.status_locked then
    new.status := case when new.completeness >= private.publish_threshold() then 'published' else 'draft' end;
  end if;
  return new;
end $$;

create or replace function public.admin_pipeline(p_action text)
returns text language plpgsql security definer set search_path = '' as $$
declare n int := 0; t numeric;
begin
  if not public.is_admin() then raise exception 'Geen toegang'; end if;
  insert into public.audit_log (actor, actor_email, action, entity, entity_id, details)
  values (auth.uid(), (select email from public.admins where user_id = auth.uid()), 'pipeline', 'pipeline', p_action, '{}'::jsonb);
  if p_action = 'scrape-missing' then
    perform public.enqueue_scrape(true);
  elsif p_action = 'scrape-all' then
    perform public.enqueue_scrape(false);
  elsif p_action = 'osm-refresh' then
    update public.osm_regions set last_run_at = null where places_req is null;
  elsif p_action = 'apply-threshold' then
    t := private.publish_threshold();
    -- Massa-update niet per rij in het auditlog zetten
    perform set_config('request.jwt.claims', '{}', true);
    update public.places set updated_at = now()
     where not status_locked and ((completeness >= t) <> (status = 'published'));
    get diagnostics n = row_count;
  else
    raise exception 'Onbekende actie %', p_action;
  end if;
  return n::text;
end $$;
revoke all on function public.admin_pipeline(text) from public, anon;
grant execute on function public.admin_pipeline(text) to authenticated;
