-- Live migratie 20261011074833 (ingest_osm_provenance), letterlijk uit supabase_migrations.schema_migrations.statements
-- (opgehaald 8 november 2026, review R5). Niet wijzigen: dit is de geschiedenis zoals live toegepast.

create or replace function public.ingest_osm(p_rows jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  r jsonb; town public.nl_towns; ins int := 0; upd int := 0; v_slug text; base text; n int;
  existing uuid; v_name text; generic boolean; v_town text;
begin
  for r in select * from jsonb_array_elements(p_rows) loop
    town := public.nearest_town((r->>'lat')::float8, (r->>'lng')::float8);
    v_town := coalesce(nullif(r->>'town', ''), town.name);
    v_name := nullif(trim(r->>'name'), '');
    generic := v_name is null;
    if generic then
      v_name := case r->>'kind' when 'camping' then 'Camping ' when 'parkeerplaats' then 'Camperparkeerplaats ' else 'Camperplaats ' end || v_town;
    end if;

    select id into existing from public.places where osm_type = r->>'osm_type' and osm_id = (r->>'osm_id')::bigint;
    if existing is null then
      base := public.slugify(v_name || case when generic then '' else '-' || v_town end);
      if base = '' then base := 'camperplaats'; end if;
      v_slug := base; n := 1;
      while exists (select 1 from public.places where slug = v_slug) loop
        n := n + 1; v_slug := base || '-' || n;
      end loop;
      insert into public.places (slug, osm_type, osm_id, name, name_is_generic, kind, lat, lng, street, postcode, town, province,
        description, description_source, price_eur, power, water, dump_station, toilet, shower, wifi, dogs,
        capacity, max_length_m, surface, open_all_year, season, reservation, website, phone, email, image_url, image_credit, sources)
      values (v_slug, r->>'osm_type', (r->>'osm_id')::bigint, v_name, generic, r->>'kind',
        (r->>'lat')::float8, (r->>'lng')::float8, r->>'street', r->>'postcode',
        v_town, coalesce(nullif(r->>'province', ''), town.province),
        r->>'description', case when r ? 'description' then 'openstreetmap' end,
        (r->>'price_eur')::numeric,
        (r->>'power')::boolean, (r->>'water')::boolean, (r->>'dump_station')::boolean, (r->>'toilet')::boolean,
        (r->>'shower')::boolean, (r->>'wifi')::boolean, (r->>'dogs')::boolean,
        (r->>'capacity')::int, (r->>'max_length_m')::numeric, r->>'surface',
        (r->>'open_all_year')::boolean, r->>'season', (r->>'reservation')::boolean,
        r->>'website', r->>'phone', r->>'email', r->>'image_url', r->>'image_credit',
        jsonb_build_object('osm', now()));
      ins := ins + 1;
    else
      -- Volgorde van gezag: beheer > eigen website (prijs/seizoen) > OpenStreetMap
      update public.places p set
        name = case when p.name_is_generic and not generic then v_name else p.name end,
        name_is_generic = p.name_is_generic and generic,
        kind = case when p.sources->>'kind' = 'beheer' then p.kind else coalesce(r->>'kind', p.kind) end,
        province = coalesce(nullif(r->>'province', ''), p.province),
        street = coalesce(r->>'street', p.street), postcode = coalesce(r->>'postcode', p.postcode),
        description = coalesce(p.description, r->>'description'),
        price_eur = case when p.sources->>'price_eur' = 'beheer' or p.sources->'website_fields' ? 'price_eur' then p.price_eur
                         else (r->>'price_eur')::numeric end,
        power = case when p.sources->>'power' = 'beheer' then p.power else coalesce((r->>'power')::boolean, p.power) end,
        water = case when p.sources->>'water' = 'beheer' then p.water else coalesce((r->>'water')::boolean, p.water) end,
        dump_station = case when p.sources->>'dump_station' = 'beheer' then p.dump_station else coalesce((r->>'dump_station')::boolean, p.dump_station) end,
        toilet = case when p.sources->>'toilet' = 'beheer' then p.toilet else coalesce((r->>'toilet')::boolean, p.toilet) end,
        shower = case when p.sources->>'shower' = 'beheer' then p.shower else coalesce((r->>'shower')::boolean, p.shower) end,
        wifi = case when p.sources->>'wifi' = 'beheer' then p.wifi else coalesce((r->>'wifi')::boolean, p.wifi) end,
        dogs = case when p.sources->>'dogs' = 'beheer' then p.dogs else coalesce((r->>'dogs')::boolean, p.dogs) end,
        capacity = case when p.sources->>'capacity' = 'beheer' then p.capacity else coalesce((r->>'capacity')::int, p.capacity) end,
        max_length_m = case when p.sources->>'max_length_m' = 'beheer' then p.max_length_m else coalesce((r->>'max_length_m')::numeric, p.max_length_m) end,
        surface = case when p.sources->>'surface' = 'beheer' then p.surface else coalesce(r->>'surface', p.surface) end,
        open_all_year = case when p.sources->>'open_all_year' = 'beheer' or p.sources->'website_fields' ? 'open_all_year' then p.open_all_year
                             else coalesce((r->>'open_all_year')::boolean, p.open_all_year) end,
        season = case when p.sources->>'season' = 'beheer' or p.sources->'website_fields' ? 'season' then p.season
                      else coalesce(r->>'season', p.season) end,
        reservation = case when p.sources->>'reservation' = 'beheer' then p.reservation else coalesce((r->>'reservation')::boolean, p.reservation) end,
        website = case when p.sources->>'website' = 'beheer' then p.website else coalesce(r->>'website', p.website) end,
        phone = coalesce(r->>'phone', p.phone), email = coalesce(r->>'email', p.email),
        image_url = coalesce(p.image_url, r->>'image_url'),
        image_credit = case when p.image_url is null then r->>'image_credit' else p.image_credit end,
        sources = p.sources || jsonb_build_object('osm', now())
      where p.id = existing;
      upd := upd + 1;
    end if;
  end loop;
  return jsonb_build_object('inserted', ins, 'updated', upd);
end $$;
revoke all on function public.ingest_osm(jsonb) from public, anon, authenticated;
