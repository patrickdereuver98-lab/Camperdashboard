-- Live migratie 20261011081056 (decode_entity_urls), letterlijk uit supabase_migrations.schema_migrations.statements
-- (opgehaald 8 november 2026, review R5). Niet wijzigen: dit is de geschiedenis zoals live toegepast.

create or replace function private.decode_entities(s text) returns text language plpgsql immutable set search_path = '' as $$
declare m text[]; out text := s;
begin
  if out is null then return null; end if;
  for m in select regexp_matches(out, '&#x([0-9a-fA-F]+);', 'g') loop
    out := replace(out, '&#x' || m[1] || ';', chr(('x' || lpad(m[1], 8, '0'))::bit(32)::int));
  end loop;
  for m in select regexp_matches(out, '&#([0-9]+);', 'g') loop
    out := replace(out, '&#' || m[1] || ';', chr(m[1]::int));
  end loop;
  return replace(out, '&amp;', '&');
end $$;

update public.places set
  image_url = private.decode_entities(image_url),
  photos = (select coalesce(jsonb_agg(jsonb_set(ph, '{url}', to_jsonb(private.decode_entities(ph->>'url')))), '[]'::jsonb) from jsonb_array_elements(photos) ph)
where image_url like '%&#%' or image_url like '%&amp;%' or photos::text like '%&#%' or photos::text like '%&amp;%';
