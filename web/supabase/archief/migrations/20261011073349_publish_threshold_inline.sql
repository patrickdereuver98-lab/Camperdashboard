-- Live migratie 20261011073349 (publish_threshold_inline), letterlijk uit supabase_migrations.schema_migrations.statements
-- (opgehaald 8 november 2026, review R5). Niet wijzigen: dit is de geschiedenis zoals live toegepast.

create or replace function private.places_before_write()
returns trigger language plpgsql set search_path = '' as $$
declare t numeric := coalesce((select (value #>> '{}')::numeric from public.site_settings where key = 'publish_threshold'), 0.8);
begin
  new.updated_at := now();
  new.completeness := public.place_completeness(new);
  if not new.status_locked then
    new.status := case when new.completeness >= t then 'published' else 'draft' end;
  end if;
  return new;
end $$;
