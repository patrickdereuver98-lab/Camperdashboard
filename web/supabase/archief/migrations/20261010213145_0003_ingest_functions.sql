-- Live migratie 20261010213145 (0003_ingest_functions), letterlijk uit supabase_migrations.schema_migrations.statements
-- (opgehaald 8 november 2026, review R5). Niet wijzigen: dit is de geschiedenis zoals live toegepast.

create table public.nl_towns (
  id serial primary key, name text not null, province text not null,
  lat double precision not null, lng double precision not null
);
alter table public.nl_towns enable row level security;
create policy "woonplaatsen lezen" on public.nl_towns for select to anon, authenticated using (true);

create table public.internal_secrets (name text primary key, value text not null);
alter table public.internal_secrets enable row level security;
-- geen policies: alleen de service role (edge functions) kan dit lezen

create or replace function public.nearest_town(p_lat double precision, p_lng double precision)
returns public.nl_towns language sql stable set search_path = '' as $$
  select t.* from public.nl_towns t
   order by (t.lat - p_lat)^2 + ((t.lng - p_lng) * cos(radians(p_lat)))^2
   limit 1;
$$;

create or replace function public.slugify(p text)
returns text language sql immutable set search_path = '' as $$
  select trim(both '-' from regexp_replace(lower(extensions.unaccent(coalesce(p, ''))), '[^a-z0-9]+', '-', 'g'));
$$;

-- Eén OSM-element samenvoegen. Bestaande waarden blijven staan als OSM niets weet.
create or replace function public.ingest_osm(p_rows jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  r jsonb; town public.nl_towns; ins int := 0; upd int := 0; v_slug text; base text; n int;
  existing uuid; v_name text; generic boolean;
begin
  for r in select * from jsonb_array_elements(p_rows) loop
    town := public.nearest_town((r->>'lat')::float8, (r->>'lng')::float8);
    v_name := nullif(trim(r->>'name'), '');
    generic := v_name is null;
    if generic then
      v_name := case r->>'kind' when 'camping' then 'Camping ' when 'parkeerplaats' then 'Camperparkeerplaats ' else 'Camperplaats ' end
                || coalesce(nullif(r->>'town', ''), town.name);
    end if;

    select id into existing from public.places where osm_type = r->>'osm_type' and osm_id = (r->>'osm_id')::bigint;
    if existing is null then
      base := public.slugify(v_name || case when generic then '' else '-' || coalesce(nullif(r->>'town', ''), town.name) end);
      if base = '' then base := 'camperplaats'; end if;
      v_slug := base; n := 1;
      while exists (select 1 from public.places where slug = v_slug) loop
        n := n + 1; v_slug := base || '-' || n;
      end loop;
      insert into public.places (slug, osm_type, osm_id, name, name_is_generic, kind, lat, lng, street, postcode, town, province,
        description, description_source, price_eur, price_note, power, water, dump_station, toilet, shower, wifi, dogs,
        capacity, max_length_m, surface, open_all_year, season, reservation, website, phone, email, image_url, image_credit, sources)
      values (v_slug, r->>'osm_type', (r->>'osm_id')::bigint, v_name, generic, r->>'kind',
        (r->>'lat')::float8, (r->>'lng')::float8, r->>'street', r->>'postcode',
        coalesce(nullif(r->>'town', ''), town.name), town.province,
        r->>'description', case when r ? 'description' then 'openstreetmap' end,
        (r->>'price_eur')::numeric, r->>'price_note',
        (r->>'power')::boolean, (r->>'water')::boolean, (r->>'dump_station')::boolean, (r->>'toilet')::boolean,
        (r->>'shower')::boolean, (r->>'wifi')::boolean, (r->>'dogs')::boolean,
        (r->>'capacity')::int, (r->>'max_length_m')::numeric, r->>'surface',
        (r->>'open_all_year')::boolean, r->>'season', (r->>'reservation')::boolean,
        r->>'website', r->>'phone', r->>'email', r->>'image_url', r->>'image_credit',
        jsonb_build_object('osm', now()));
      ins := ins + 1;
    else
      update public.places p set
        name = case when p.name_is_generic and not generic then v_name else p.name end,
        name_is_generic = p.name_is_generic and generic,
        kind = coalesce(r->>'kind', p.kind),
        street = coalesce(r->>'street', p.street), postcode = coalesce(r->>'postcode', p.postcode),
        description = coalesce(p.description, r->>'description'),
        price_eur = coalesce(p.price_eur, (r->>'price_eur')::numeric),
        power = coalesce((r->>'power')::boolean, p.power), water = coalesce((r->>'water')::boolean, p.water),
        dump_station = coalesce((r->>'dump_station')::boolean, p.dump_station),
        toilet = coalesce((r->>'toilet')::boolean, p.toilet), shower = coalesce((r->>'shower')::boolean, p.shower),
        wifi = coalesce((r->>'wifi')::boolean, p.wifi), dogs = coalesce((r->>'dogs')::boolean, p.dogs),
        capacity = coalesce((r->>'capacity')::int, p.capacity),
        max_length_m = coalesce((r->>'max_length_m')::numeric, p.max_length_m),
        surface = coalesce(r->>'surface', p.surface),
        open_all_year = coalesce((r->>'open_all_year')::boolean, p.open_all_year),
        season = coalesce(r->>'season', p.season), reservation = coalesce((r->>'reservation')::boolean, p.reservation),
        website = coalesce(r->>'website', p.website), phone = coalesce(r->>'phone', p.phone), email = coalesce(r->>'email', p.email),
        image_url = coalesce(p.image_url, r->>'image_url'), image_credit = case when p.image_url is null then r->>'image_credit' else p.image_credit end,
        sources = p.sources || jsonb_build_object('osm', now())
      where p.id = existing;
      upd := upd + 1;
    end if;
  end loop;
  return jsonb_build_object('inserted', ins, 'updated', upd);
end;
$$;

-- Plekken met dumpstation/waterpunt binnen 150 m markeren
create or replace function public.ingest_osm_points(p_points jsonb)
returns int language plpgsql security definer set search_path = '' as $$
declare r jsonb; n int := 0; c int;
begin
  for r in select * from jsonb_array_elements(p_points) loop
    update public.places p set
      dump_station = case when r->>'type' = 'dump' then coalesce(p.dump_station, true) else p.dump_station end,
      water = case when r->>'type' in ('dump','water') then coalesce(p.water, case when r->>'type' = 'water' or (r->>'water')::boolean then true end) else p.water end
    where abs(p.lat - (r->>'lat')::float8) < 0.002 and abs(p.lng - (r->>'lng')::float8) < 0.003
      and (p.lat - (r->>'lat')::float8)^2 + ((p.lng - (r->>'lng')::float8) * 0.62)^2 < (150.0 / 111000)^2;
    get diagnostics c = row_count; n := n + c;
  end loop;
  return n;
end;
$$;

-- Volgende batch voor de scraper (vergrendelt 20 minuten)
create or replace function public.next_scrape_batch(p_limit int)
returns table (id uuid, website text, name text, town text) language sql security definer set search_path = '' as $$
  with picked as (
    select q.place_id from private.scrape_queue q
     where q.done_at is null and q.next_attempt_at <= now() and q.attempts < 3
     order by q.attempts, q.next_attempt_at
     limit p_limit for update skip locked
  ), upd as (
    update private.scrape_queue q set next_attempt_at = now() + interval '20 minutes', attempts = q.attempts + 1
      from picked where q.place_id = picked.place_id returning q.place_id
  )
  select p.id, p.website, p.name, p.town from public.places p join upd on upd.place_id = p.id;
$$;

create or replace function public.enqueue_scrape(p_only_missing boolean default true)
returns int language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  insert into private.scrape_queue (place_id)
  select id from public.places where website is not null and (not p_only_missing or last_scraped_at is null)
  on conflict (place_id) do update set done_at = null, attempts = 0, next_attempt_at = now(), last_error = null;
  get diagnostics n = row_count;
  return n;
end;
$$;

-- Resultaat van de scraper toepassen: alleen lege velden aanvullen (prijs/seizoen van de site gaan voor)
create or replace function public.apply_scrape(p_id uuid, p_data jsonb, p_error text default null)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if p_error is not null then
    update private.scrape_queue set last_error = left(p_error, 500) where place_id = p_id;
    if (select attempts from private.scrape_queue where place_id = p_id) >= 3 then
      update private.scrape_queue set done_at = now() where place_id = p_id;
      update public.places set last_scraped_at = now() where id = p_id;
    end if;
    return;
  end if;
  update public.places p set
    price_eur = coalesce((p_data->>'price_eur')::numeric, p.price_eur),
    price_note = coalesce(p_data->>'price_note', p.price_note),
    tourist_tax_included = coalesce(p.tourist_tax_included, (p_data->>'tourist_tax_included')::boolean),
    power = coalesce(p.power, (p_data->>'power')::boolean),
    water = coalesce(p.water, (p_data->>'water')::boolean),
    dump_station = coalesce(p.dump_station, (p_data->>'dump_station')::boolean),
    toilet = coalesce(p.toilet, (p_data->>'toilet')::boolean),
    shower = coalesce(p.shower, (p_data->>'shower')::boolean),
    wifi = coalesce(p.wifi, (p_data->>'wifi')::boolean),
    dogs = coalesce(p.dogs, (p_data->>'dogs')::boolean),
    capacity = coalesce(p.capacity, (p_data->>'capacity')::int),
    max_length_m = coalesce(p.max_length_m, (p_data->>'max_length_m')::numeric),
    open_all_year = coalesce((p_data->>'open_all_year')::boolean, p.open_all_year),
    season = coalesce(p_data->>'season', p.season),
    reservation = coalesce(p.reservation, (p_data->>'reservation')::boolean),
    phone = coalesce(p.phone, p_data->>'phone'),
    email = coalesce(p.email, p_data->>'email'),
    street = coalesce(p.street, p_data->>'street'),
    postcode = coalesce(p.postcode, p_data->>'postcode'),
    description = coalesce(p.description, p_data->>'description'),
    description_source = case when p.description is null and p_data ? 'description' then 'website' else p.description_source end,
    image_url = coalesce(p.image_url, p_data->>'image_url'),
    image_credit = case when p.image_url is null and p_data ? 'image_url' then coalesce(p_data->>'image_credit', p.website) else p.image_credit end,
    photos = case when jsonb_array_length(p.photos) = 0 and p_data ? 'photos' then p_data->'photos' else p.photos end,
    sources = p.sources || jsonb_build_object('website', now(), 'website_fields', coalesce(p_data->'fields', '[]'::jsonb)),
    last_scraped_at = now(),
    verified_at = now()
  where p.id = p_id;
  update private.scrape_queue set done_at = now(), last_error = null where place_id = p_id;
end;
$$;

revoke all on function public.ingest_osm, public.ingest_osm_points, public.next_scrape_batch, public.enqueue_scrape, public.apply_scrape from public, anon, authenticated;
