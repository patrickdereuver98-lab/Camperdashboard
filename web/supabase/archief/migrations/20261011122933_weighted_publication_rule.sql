-- Live migratie 20261011122933 (weighted_publication_rule), letterlijk uit supabase_migrations.schema_migrations.statements
-- (opgehaald 8 november 2026, review R5). Niet wijzigen: dit is de geschiedenis zoals live toegepast.

-- Gewogen volledigheid (0..1) uit 20 punten:
--   beslisfeiten  prijs 3, openingsperiode 3, stroom 2
--   service       water 1,5, lozen 1,5
--   vertrouwen    contact 2, foto 2, echte naam 1
--   comfort       toilet 1, honden 1, douche 0,5, aantal plekken 0,5
--   beschrijving  1
-- Wifi, max. lengte, ondergrond en reserveren tonen we wel, maar ze tellen niet mee.
create or replace function public.place_completeness(p public.places)
returns numeric language sql immutable set search_path = '' as $$
  select round((
      3 * (p.price_eur is not null)::int
    + 3 * (p.open_all_year is not null or p.season is not null)::int
    + 2 * (p.power is not null)::int
    + 1.5 * (p.water is not null)::int
    + 1.5 * (p.dump_station is not null)::int
    + 2 * (p.website is not null or p.phone is not null)::int
    + 2 * (p.image_url is not null)::int
    + 1 * (not p.name_is_generic)::int
    + 1 * (p.toilet is not null)::int
    + 1 * (p.dogs is not null)::int
    + 0.5 * (p.shower is not null)::int
    + 0.5 * (p.capacity is not null)::int
    + 1 * (p.description is not null)::int
  )::numeric / 20, 3);
$$;

-- Harde eisen naast de score: contact, en minstens 2 van de 3 beslisfeiten (prijs, openingsperiode, stroom)
create or replace function public.place_meets_must_haves(p public.places)
returns boolean language sql immutable set search_path = '' as $$
  select (p.website is not null or p.phone is not null)
     and ((p.price_eur is not null)::int + (p.open_all_year is not null or p.season is not null)::int + (p.power is not null)::int) >= 2;
$$;

create or replace function private.places_before_write()
returns trigger language plpgsql set search_path = '' as $$
declare t numeric := coalesce((select (value #>> '{}')::numeric from public.site_settings where key = 'publish_threshold'), 0.7);
begin
  if new.image_url like '%&#%' or new.photos::text like '%&#%' then
    new.image_url := private.decode_entities(new.image_url);
    new.photos := (select coalesce(jsonb_agg(jsonb_set(ph, '{url}', to_jsonb(private.decode_entities(ph->>'url')))), '[]'::jsonb)
                     from jsonb_array_elements(new.photos) ph);
  end if;
  new.updated_at := now();
  new.completeness := public.place_completeness(new);
  if not new.status_locked then
    new.status := case when new.completeness >= t and public.place_meets_must_haves(new) then 'published' else 'draft' end;
  end if;
  return new;
end $$;

update public.site_settings set value = '0.7'::jsonb where key = 'publish_threshold';
