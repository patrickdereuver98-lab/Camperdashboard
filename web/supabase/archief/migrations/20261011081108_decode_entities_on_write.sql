-- Live migratie 20261011081108 (decode_entities_on_write), letterlijk uit supabase_migrations.schema_migrations.statements
-- (opgehaald 8 november 2026, review R5). Niet wijzigen: dit is de geschiedenis zoals live toegepast.

create or replace function private.places_before_write()
returns trigger language plpgsql set search_path = '' as $$
declare t numeric := coalesce((select (value #>> '{}')::numeric from public.site_settings where key = 'publish_threshold'), 0.8);
begin
  -- Foto-URL's met HTML-entiteiten (https&#x3A;&#x2F;…) leesbaar maken
  if new.image_url like '%&#%' or new.photos::text like '%&#%' then
    new.image_url := private.decode_entities(new.image_url);
    new.photos := (select coalesce(jsonb_agg(jsonb_set(ph, '{url}', to_jsonb(private.decode_entities(ph->>'url')))), '[]'::jsonb)
                     from jsonb_array_elements(new.photos) ph);
  end if;
  new.updated_at := now();
  new.completeness := public.place_completeness(new);
  if not new.status_locked then
    new.status := case when new.completeness >= t then 'published' else 'draft' end;
  end if;
  return new;
end $$;
select count(*) filter (where image_url like '%&#%') left_over from public.places;
