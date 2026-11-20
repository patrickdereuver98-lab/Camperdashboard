-- Dataplan november 2026 (docs/dataplan-2026-11.md), besluit Patrick 20 november 2026 (README 138).
-- Spoor 2.1: ruwe OSM-tags bewaren in private.osm_tags (niet in places: die gaat in bulk naar de site).
-- Spoor 2.2: past mijn camper en betaalwijze: places.max_height_m, max_weight_t, payment; controledatum uit OSM.
-- Spoor 2.3: los- en waterpunten als eigen laag (public.service_points) in plaats van weggooien na 150 m.
-- Spoor 2.4: de lezer levert max_stay_nights; apply_scrape neemt het over.
-- Spoor 1.5: constraints op het kernfeit (R79), eerst NOT VALID en dan VALIDATE (live 0 schendingen op 20 november).
--   Bewust géén harde koppeling vast↔tijd: Beheer en de inbox schrijven regel en tijd in twee stappen (review
--   database, 20 november). health() telt zulke plekken in plaats daarvan (vast_zonder_tijd).
-- Spoor 1.2: health() telt voorstellen die langer dan 7 dagen wachten.
-- Spoor 3.1: mail aan eigenaren kiest camperplaatsen zonder vertrekregel eerst.
-- Basis: apply_scrape uit 20261118200000_wislog_en_kanalen, ingest_osm uit 20261118300000_niets_weggooien,
-- ingest_osm_points uit de nulmigratie, outreach_next uit 20261119200000_outreach. Alleen de gemarkeerde delen zijn nieuw.

set local lock_timeout = '5s';

-- ── Nieuwe velden ────────────────────────────────────────────────────────────────────────────────────────────────
alter table public.places add column if not exists max_height_m numeric(3,1);
alter table public.places add column if not exists max_weight_t numeric(4,1);
alter table public.places add column if not exists payment text[];
comment on column public.places.max_height_m is 'Maximale hoogte in meters (OSM maxheight); leeg = onbekend';
comment on column public.places.max_weight_t is 'Maximaal gewicht in ton (OSM maxweight); leeg = onbekend';
comment on column public.places.payment is 'Betaalwijzen: contant, pin, creditcard, contactloos, app (OSM payment:*); leeg = onbekend';

-- ── Constraints (R79) ────────────────────────────────────────────────────────────────────────────────────────────
alter table public.places drop constraint if exists places_tijden_geldig;
alter table public.places add constraint places_tijden_geldig check (
  (checkout_until is null or checkout_until ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$')
  and (checkin_from is null or checkin_from ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$')
  and (checkin_until is null or checkin_until ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$')) not valid;
alter table public.places drop constraint if exists places_in_nederland;
alter table public.places add constraint places_in_nederland check (lat between 50.7 and 53.7 and lng between 3.2 and 7.3) not valid;
alter table public.places drop constraint if exists places_bereik;
alter table public.places add constraint places_bereik check (
  (max_stay_nights is null or max_stay_nights between 1 and 60)
  and (max_length_m is null or max_length_m between 3 and 30)
  and (max_height_m is null or max_height_m between 1.5 and 6)
  and (max_weight_t is null or max_weight_t between 1 and 60)
  and (payment is null or payment <@ array['contant', 'pin', 'creditcard', 'contactloos', 'app']::text[])) not valid;
alter table public.places drop constraint if exists places_json_vorm;
alter table public.places add constraint places_json_vorm check (
  (price_extras is null or jsonb_typeof(price_extras) = 'array')
  and (sources is null or jsonb_typeof(sources) = 'object')) not valid;
alter table public.places validate constraint places_tijden_geldig;
alter table public.places validate constraint places_in_nederland;
alter table public.places validate constraint places_bereik;
alter table public.places validate constraint places_json_vorm;

-- ── Ruwe OSM-tags (spoor 2.1) ────────────────────────────────────────────────────────────────────────────────────
create table if not exists private.osm_tags (
  osm_type text not null,
  osm_id bigint not null,
  tags jsonb not null,
  check_date text,
  updated_at timestamptz not null default now(),
  primary key (osm_type, osm_id)
);
alter table private.osm_tags enable row level security;
revoke all on private.osm_tags from public, anon, authenticated;

-- ── Servicepunten (spoor 2.3) ────────────────────────────────────────────────────────────────────────────────────
create table if not exists public.service_points (
  id bigint generated always as identity primary key,
  osm_type text not null,
  osm_id bigint not null,
  type text not null check (type in ('dump', 'water')),
  water boolean,
  name text,
  fee boolean,
  opening_hours text,
  lat double precision not null check (lat between 50.7 and 53.7),
  lng double precision not null check (lng between 3.2 and 7.3),
  updated_at timestamptz not null default now(),
  unique (osm_type, osm_id)
);
create index if not exists service_points_lat_lng on public.service_points (lat, lng);
alter table public.service_points enable row level security;
-- Open data (OSM, ODbL): iedereen mag lezen, alleen de keten schrijft
drop policy if exists service_points_lezen on public.service_points;
create policy service_points_lezen on public.service_points for select to anon, authenticated using (true);
revoke all on public.service_points from anon, authenticated;
grant select on public.service_points to anon, authenticated;
comment on table public.service_points is 'Los- en waterpunten uit OpenStreetMap (amenity=sanitary_dump_station, water_point); dataplan november 2026';

CREATE OR REPLACE FUNCTION public.ingest_osm_points(p_points jsonb)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare r jsonb; n int := 0; c int; v_lat float8; v_lng float8;
begin
  for r in select * from jsonb_array_elements(p_points) loop
    v_lat := (r->>'lat')::float8;
    v_lng := (r->>'lng')::float8;
    -- Nieuw (spoor 2.3): elk punt ook als eigen servicepunt bewaren
    if r ? 'osm_id' and v_lat between 50.7 and 53.7 and v_lng between 3.2 and 7.3 then
      insert into public.service_points (osm_type, osm_id, type, water, name, fee, opening_hours, lat, lng, updated_at)
      values (r->>'osm_type', (r->>'osm_id')::bigint, case when r->>'type' = 'dump' then 'dump' else 'water' end,
              (r->>'water')::boolean, left(r->>'name', 200), (r->>'fee')::boolean, left(r->>'opening_hours', 200), v_lat, v_lng, now())
      on conflict (osm_type, osm_id) do update
        set type = excluded.type, water = excluded.water, name = excluded.name, fee = excluded.fee,
            opening_hours = excluded.opening_hours, lat = excluded.lat, lng = excluded.lng, updated_at = now();
      insert into private.osm_tags (osm_type, osm_id, tags, updated_at)
      values (r->>'osm_type', (r->>'osm_id')::bigint, coalesce(r->'_tags', '{}'::jsonb), now())
      on conflict (osm_type, osm_id) do update set tags = excluded.tags, updated_at = now()
        where private.osm_tags.tags is distinct from excluded.tags;
    end if;
    update public.places p
       set dump_station = case when r->>'type' = 'dump' then coalesce(p.dump_station, true) else p.dump_station end,
           water = case when r->>'type' in ('dump', 'water')
                        then coalesce(p.water, case when r->>'type' = 'water' or (r->>'water')::boolean then true end)
                        else p.water end
     where p.id = (
       select q.id from public.places q
        where q.merged_into is null
          and abs(q.lat - v_lat) < 0.002 and abs(q.lng - v_lng) < 0.003
          and (q.lat - v_lat) ^ 2 + ((q.lng - v_lng) * 0.62) ^ 2 < (150.0 / 111000) ^ 2
        order by (q.lat - v_lat) ^ 2 + ((q.lng - v_lng) * 0.62) ^ 2
        limit 1)
       -- Niets te doen (al bekend): niet aanraken, anders verandert updated_at zonder reden
       and ((r->>'type' = 'dump' and p.dump_station is null)
            or (p.water is null and (r->>'type' = 'water' or (r->>'water')::boolean)));
    get diagnostics c = row_count;
    n := n + c;
  end loop;
  return n;
end $function$;
revoke all on function public.ingest_osm_points(jsonb) from public, anon, authenticated;
grant execute on function public.ingest_osm_points(jsonb) to service_role;

-- ── ingest_osm met de nieuwe velden (spoor 2.1 en 2.2) ───────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.ingest_osm(p_rows jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  r jsonb; town public.nl_towns; ins int := 0; upd int := 0; v_slug text; base text; n int;
  existing uuid; v_name text; generic boolean; v_town text; v_payment text[]; skipped int := 0;
begin
  for r in select * from jsonb_array_elements(p_rows) loop
   begin
    town := public.nearest_town((r->>'lat')::float8, (r->>'lng')::float8);
    v_town := coalesce(nullif(r->>'town', ''), town.name);
    v_name := nullif(trim(r->>'name'), '');
    generic := v_name is null;
    if generic then
      v_name := case r->>'kind' when 'camping' then 'Camping ' when 'parkeerplaats' then 'Camperparkeerplaats ' else 'Camperplaats ' end || v_town;
    end if;
    -- Nieuw: betaalwijze als lijst (alleen bekende woorden), ruwe tags apart
    v_payment := case when jsonb_typeof(r->'payment') = 'array'
                      then array(select x from jsonb_array_elements_text(r->'payment') x
                                  where x = any (array['contant', 'pin', 'creditcard', 'contactloos', 'app']) order by x) end;
    if v_payment = '{}' then v_payment := null; end if;
    -- Ongeldige waarden weg vóór het schrijven: één rare OSM-tag ("check_out=10:75") mag geen hele ronde stoppen
    -- (review database, 20 november). Een rij die toch faalt, wordt overgeslagen en gelogd.
    r := r - (select coalesce(array_agg(k), '{}') from unnest(array['checkout_until', 'checkin_from']) k
               where r ? k and r->>k !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$');
    if r->>'departure' = 'vast' and not r ? 'checkout_until' then r := r - 'departure'; end if;
    if r ? 'departure' and r->>'departure' not in ('vast', 'vrij', 'per24') then r := r - 'departure' - 'checkout_until'; end if;
    if (r->>'max_stay_nights')::numeric not between 1 and 60 then r := r - 'max_stay_nights'; end if;
    if (r->>'max_length_m')::numeric not between 3 and 30 then r := r - 'max_length_m'; end if;
    if (r->>'max_height_m')::numeric not between 1.5 and 6 then r := r - 'max_height_m'; end if;
    if (r->>'max_weight_t')::numeric not between 1 and 60 then r := r - 'max_weight_t'; end if;
    if r ? '_tags' then
      insert into private.osm_tags (osm_type, osm_id, tags, check_date, updated_at)
      values (r->>'osm_type', (r->>'osm_id')::bigint, r->'_tags', r->>'_check_date', now())
      on conflict (osm_type, osm_id) do update set tags = excluded.tags, check_date = excluded.check_date, updated_at = now()
        where (private.osm_tags.tags, private.osm_tags.check_date) is distinct from (excluded.tags, excluded.check_date);
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
        capacity, max_length_m, max_height_m, max_weight_t, payment, surface, open_all_year, season, reservation, website, phone, email, operator, image_url, image_credit,
        departure, checkout_until, checkin_from, max_stay_nights, access_24h, times_note, sources)
      values (v_slug, r->>'osm_type', (r->>'osm_id')::bigint, v_name, generic, r->>'kind',
        (r->>'lat')::float8, (r->>'lng')::float8, r->>'street', r->>'postcode',
        v_town, coalesce(nullif(r->>'province', ''), town.province),
        r->>'description', case when r ? 'description' then 'openstreetmap' end,
        (r->>'price_eur')::numeric,
        (r->>'power')::boolean, (r->>'water')::boolean, (r->>'dump_station')::boolean, (r->>'toilet')::boolean,
        (r->>'shower')::boolean, (r->>'wifi')::boolean, (r->>'dogs')::boolean,
        (r->>'capacity')::int, (r->>'max_length_m')::numeric, (r->>'max_height_m')::numeric, (r->>'max_weight_t')::numeric, v_payment, r->>'surface',
        (r->>'open_all_year')::boolean, r->>'season', (r->>'reservation')::boolean,
        r->>'website', r->>'phone', r->>'email', r->>'operator', r->>'image_url', r->>'image_credit',
        r->>'departure', r->>'checkout_until', r->>'checkin_from', (r->>'max_stay_nights')::int, (r->>'access_24h')::boolean,
        case when r ? 'departure' or r ? 'checkin_from' then 'Volgens OpenStreetMap' end,
        jsonb_build_object('osm', now()) || case when r ? '_check_date' then jsonb_build_object('osm_check_date', r->>'_check_date') else '{}'::jsonb end);
      ins := ins + 1;
    else
      -- Volgorde van gezag: beheer > eigen website (prijs, seizoen, tijden) > OpenStreetMap
      update public.places p set
        name = case when p.name_is_generic and not generic then v_name else p.name end,
        name_is_generic = p.name_is_generic and generic,
        kind = case when p.sources->'beheer' ? 'kind' then p.kind else coalesce(r->>'kind', p.kind) end,
        province = coalesce(nullif(r->>'province', ''), p.province),
        street = case when p.sources->'beheer' ? 'street' then p.street else coalesce(r->>'street', p.street) end,
        postcode = case when p.sources->'beheer' ? 'postcode' then p.postcode else coalesce(r->>'postcode', p.postcode) end,
        description = coalesce(p.description, r->>'description'),
        price_eur = case when p.sources->'beheer' ? 'price_eur' or p.sources->'website_fields' ? 'price_eur' then p.price_eur
                         else coalesce((r->>'price_eur')::numeric, p.price_eur) end,
        power = case when p.sources->'beheer' ? 'power' then p.power else coalesce((r->>'power')::boolean, p.power) end,
        water = case when p.sources->'beheer' ? 'water' then p.water else coalesce((r->>'water')::boolean, p.water) end,
        dump_station = case when p.sources->'beheer' ? 'dump_station' then p.dump_station else coalesce((r->>'dump_station')::boolean, p.dump_station) end,
        toilet = case when p.sources->'beheer' ? 'toilet' then p.toilet else coalesce((r->>'toilet')::boolean, p.toilet) end,
        shower = case when p.sources->'beheer' ? 'shower' then p.shower else coalesce((r->>'shower')::boolean, p.shower) end,
        wifi = case when p.sources->'beheer' ? 'wifi' then p.wifi else coalesce((r->>'wifi')::boolean, p.wifi) end,
        dogs = case when p.sources->'beheer' ? 'dogs' then p.dogs else coalesce((r->>'dogs')::boolean, p.dogs) end,
        capacity = case when p.sources->'beheer' ? 'capacity' then p.capacity else coalesce((r->>'capacity')::int, p.capacity) end,
        max_length_m = case when p.sources->'beheer' ? 'max_length_m' then p.max_length_m else coalesce((r->>'max_length_m')::numeric, p.max_length_m) end,
        -- Nieuw (spoor 2.2): OSM is hier de enige bron; beheer gaat voor
        max_height_m = case when p.sources->'beheer' ? 'max_height_m' then p.max_height_m else coalesce((r->>'max_height_m')::numeric, p.max_height_m) end,
        max_weight_t = case when p.sources->'beheer' ? 'max_weight_t' then p.max_weight_t else coalesce((r->>'max_weight_t')::numeric, p.max_weight_t) end,
        payment = case when p.sources->'beheer' ? 'payment' then p.payment else coalesce(v_payment, p.payment) end,
        surface = case when p.sources->'beheer' ? 'surface' then p.surface else coalesce(r->>'surface', p.surface) end,
        open_all_year = case when p.sources->'beheer' ? 'open_all_year' or p.sources->'website_fields' ? 'open_all_year' then p.open_all_year
                             else coalesce((r->>'open_all_year')::boolean, p.open_all_year) end,
        season = case when p.sources->'beheer' ? 'season' or p.sources->'website_fields' ? 'season' then p.season
                      else coalesce(r->>'season', p.season) end,
        reservation = case when p.sources->'beheer' ? 'reservation' then p.reservation else coalesce((r->>'reservation')::boolean, p.reservation) end,
        -- R73: OSM vult alleen lege contactvelden; een gevonden of gecorrigeerde website, telefoon of e-mail blijft
        website = case when p.sources->'beheer' ? 'website' then p.website else coalesce(p.website, r->>'website') end,
        phone = case when p.sources->'beheer' ? 'phone' then p.phone else coalesce(p.phone, r->>'phone') end,
        email = case when p.sources->'beheer' ? 'email' then p.email else coalesce(p.email, r->>'email') end,
        operator = case when p.sources->'beheer' ? 'operator' then p.operator else coalesce(r->>'operator', p.operator) end,
        image_url = coalesce(p.image_url, r->>'image_url'),
        image_credit = case when p.image_url is null then r->>'image_credit' else p.image_credit end,
        departure = case when p.sources->'beheer' ? 'departure' or p.sources->'website_fields' ? 'departure' then p.departure
                         else coalesce(r->>'departure', p.departure) end,
        checkout_until = case when p.sources->'beheer' ? 'checkout_until' or p.sources->'website_fields' ? 'departure' then p.checkout_until
                              else coalesce(r->>'checkout_until', p.checkout_until) end,
        checkin_from = case when p.sources->'beheer' ? 'checkin_from' or p.sources->'website_fields' ? 'checkin_from' then p.checkin_from
                            else coalesce(r->>'checkin_from', p.checkin_from) end,
        times_note = case when p.sources->'beheer' ? 'departure' or p.sources->'website_fields' ? 'times_note' then p.times_note
                          when r ? 'departure' or r ? 'checkin_from' then 'Volgens OpenStreetMap' else p.times_note end,
        max_stay_nights = case when p.sources->'beheer' ? 'max_stay_nights' or p.sources->'website_fields' ? 'max_stay_nights' then p.max_stay_nights
                               else coalesce((r->>'max_stay_nights')::int, p.max_stay_nights) end,
        access_24h = case when p.sources->'beheer' ? 'access_24h' or p.sources->'website_fields' ? 'access_24h' then p.access_24h
                          else coalesce((r->>'access_24h')::boolean, p.access_24h) end,
        sources = p.sources || jsonb_build_object('osm', now())
                  || case when r ? '_check_date' then jsonb_build_object('osm_check_date', r->>'_check_date') else '{}'::jsonb end
      where p.id = existing;
      upd := upd + 1;
    end if;
   exception when check_violation or invalid_text_representation or numeric_value_out_of_range then
    skipped := skipped + 1;
    insert into public.app_logs (level, source, message, context)
    values ('warn', 'ingest_osm', left('OSM-rij overgeslagen: ' || sqlerrm, 500), jsonb_build_object('osm_type', r->>'osm_type', 'osm_id', r->>'osm_id'));
   end;
  end loop;
  return jsonb_build_object('inserted', ins, 'updated', upd, 'skipped', skipped);
end $function$;
revoke all on function public.ingest_osm(jsonb) from public, anon, authenticated;
grant execute on function public.ingest_osm(jsonb) to service_role;

-- ── apply_scrape: max_stay_nights van de website (spoor 2.4) ─────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.apply_scrape(p_id uuid, p_data jsonb, p_error text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  p public.places;
  r public.places;
  prev jsonb;
  patch jsonb := '{}'::jsonb;
  applied jsonb := '[]'::jsonb;
  n_found int := 0;
  -- Alleen deze velden maken een controledatum: zonder prijs, vertrek of seizoen is de plek niet 'gecontroleerd'
  n_core int := 0;
  core text[] := array['price_eur','departure','checkout_until','season','open_all_year'];
  f text;
  old jsonb;
  -- Nieuw: max_stay_nights
  fields text[] := array['price_eur','tourist_tax_included','power','water','dump_station','toilet','shower','wifi','dogs',
                         'capacity','max_length_m','max_stay_nights','open_all_year','season','reservation','phone','email','street','postcode',
                         'description','image_url','departure','checkout_until','checkin_from','checkin_until','access_hours','access_24h','times_note','price_extras',
                         'reservation_rule'];
  priority text[] := array['price_extras','price_eur','open_all_year','season','departure','checkout_until','checkin_from','access_hours','times_note'];
  keep text[] := array['price_extras','price_eur','open_all_year','season','departure','checkout_until','checkin_from','times_note'];
begin
  if p_error is not null then
    update private.scrape_queue set last_error = left(p_error, 500) where place_id = p_id;
    if (select attempts from private.scrape_queue where place_id = p_id) >= 3 then
      update private.scrape_queue set done_at = now() where place_id = p_id;
      update public.places
         set last_scraped_at = now(),
             sources = coalesce(sources, '{}'::jsonb) || jsonb_build_object('website_error', jsonb_build_object('at', now(), 'error', left(p_error, 200)))
       where id = p_id;
    end if;
    return;
  end if;

  select * into p from public.places where id = p_id for update;
  if not found then return; end if;
  prev := coalesce(p.sources->'website_fields', '[]'::jsonb);

  foreach f in array fields loop
    if p.sources->'beheer' ? f then
      -- R61: beheer gaat voor. Zegt de site iets anders bij een kernfeit, dan wordt dat een voorstel in de inbox in
      -- plaats van een stille overschrijving (één open voorstel per plek, veld en waarde).
      if f = any(core || array['times_note']) and p_data ? f and p_data->f is distinct from to_jsonb(p)->f
         and p_data->f is distinct from 'null'::jsonb
         and not exists (select 1 from public.updates_queue q
                          where q.place_id = p.id and q.field_changed = f and q.source = 'pipeline'
                            and q.status = 'pending' and q.new_value = p_data->f) then
        insert into public.updates_queue (place_id, field_changed, old_value, new_value, source)
        values (p.id, f, to_jsonb(p)->f, p_data->f, 'pipeline');
      end if;
      continue;
    end if;
    old := to_jsonb(p)->f;
    if p_data ? f then
      if f = any(priority) or old is null or old = 'null'::jsonb or prev ? f then
        patch := patch || jsonb_build_object(f, p_data->f);
        applied := applied || to_jsonb(f);
      end if;
      n_found := n_found + 1;
      if f = any(core) then n_core := n_core + 1; end if;
    elsif prev ? f and not (p_data ? '_pages_failed')
          and (not (f = any(keep)) or (p_data ? '_parser' and p_data->>'_parser' is distinct from p.sources->>'website_parser')) then
      patch := patch || jsonb_build_object(f, null);
    elsif prev ? f then
      applied := applied || to_jsonb(f);
    end if;
  end loop;
  if patch ? 'departure' and patch->>'departure' is distinct from 'vast' and not coalesce(p.sources->'beheer' ? 'checkout_until', false) then
    patch := patch || jsonb_build_object('checkout_until', null);
  end if;

  if patch ? 'price_eur' then patch := patch || jsonb_build_object('price_note', p_data->'price_note'); end if;
  if patch ? 'description' then
    patch := patch || jsonb_build_object('description_source', case when patch->>'description' is null then null else 'website' end);
  end if;
  if patch ? 'image_url' then
    patch := patch || jsonb_build_object('image_credit', case when patch->>'image_url' is null then null else coalesce(p_data->>'image_credit', p.website) end);
  end if;

  -- R62: elke wijziging van een kernfeit in het veldlog, met oude en nieuwe waarde en de parser
  insert into private.field_log (place_id, field, old_value, new_value, parser)
  select p.id, e.key, to_jsonb(p)->e.key, e.value, p_data->>'_parser'
    from jsonb_each(patch) e
   where e.key = any(core || array['times_note', 'price_extras'])
     and e.value is distinct from coalesce(to_jsonb(p)->e.key, 'null'::jsonb);

  r := jsonb_populate_record(p, patch);
  update public.places t set
    price_eur = r.price_eur, price_note = r.price_note, tourist_tax_included = r.tourist_tax_included,
    power = r.power, water = r.water, dump_station = r.dump_station, toilet = r.toilet, shower = r.shower,
    wifi = r.wifi, dogs = r.dogs, capacity = r.capacity, max_length_m = r.max_length_m, max_stay_nights = r.max_stay_nights,
    open_all_year = r.open_all_year, season = r.season, reservation = r.reservation,
    phone = r.phone, email = r.email, street = r.street, postcode = r.postcode,
    description = r.description, description_source = r.description_source,
    image_url = r.image_url, image_credit = r.image_credit,
    departure = r.departure, checkout_until = r.checkout_until, checkin_from = r.checkin_from, checkin_until = r.checkin_until,
    reservation_rule = r.reservation_rule,
    access_hours = r.access_hours, access_24h = r.access_24h, times_note = r.times_note, price_extras = r.price_extras,
    photos = case when p_data ? 'photos' then p_data->'photos' when prev ? 'image_url' and not (p_data ? 'image_url') and not (p_data ? '_pages_failed') then '[]'::jsonb else t.photos end,
    sources = (coalesce(t.sources, '{}'::jsonb) - 'website_error') || jsonb_build_object('website', now(), 'website_fields', applied)
              || case when p_data ? '_parser' then jsonb_build_object('website_parser', p_data->>'_parser') else '{}'::jsonb end,
    last_scraped_at = now(),
    verified_at = case when n_core > 0 then now() else t.verified_at end
  where t.id = p_id;
  update private.scrape_queue set done_at = now(), last_error = null where place_id = p_id;
end $function$;

-- ── health(): voorstellen die blijven liggen (spoor 1.2) ─────────────────────────────────────────────────────────
create or replace function public.health() returns jsonb
 language sql stable security definer set search_path to ''
as $$
  select jsonb_build_object(
    'ts', now(),
    'published', p.published,
    'with_departure', p.with_departure,
    'with_price', p.with_price,
    'last_scrape', p.last_scrape,
    'net_calls_24h', n.total,
    'net_failed_24h', n.failed,
    'app_errors_24h', (select count(*) from public.app_logs where level = 'error' and ts > now() - interval '24 hours'),
    'db_bytes', pg_database_size(current_database()),
    -- R64: per kanaal
    'web_last', (select max(done_at) from private.scrape_queue where last_error is null),
    'stealth_last', (select max(done_at) from private.stealth_queue where last_error is null),
    'scrape_open', (select count(*) from private.scrape_queue where done_at is null),
    'stealth_open', (select count(*) from private.stealth_queue where done_at is null),
    'stealth_oldest_open', (select min(created_at) from private.stealth_queue where done_at is null),
    'core_changed_24h', (select count(*) from private.field_log where at > now() - interval '24 hours'),
    'core_wiped_24h', (select count(*) from private.field_log
                        where at > now() - interval '24 hours' and (new_value is null or new_value = 'null'::jsonb)
                          and old_value is not null and old_value <> 'null'::jsonb),
    -- Nieuw (dataplan november 2026): wachtende voorstellen en de oudste daarvan
    'updates_pending', (select count(*) from public.updates_queue where status = 'pending'),
    'updates_pending_7d', (select count(*) from public.updates_queue where status = 'pending' and created_at < now() - interval '7 days'),
    'vast_zonder_tijd', (select count(*) from public.places where (departure = 'vast') <> (checkout_until is not null))
  )
  from (select count(*) filter (where status = 'published') as published,
               count(*) filter (where status = 'published' and departure is not null) as with_departure,
               count(*) filter (where status = 'published' and price_eur is not null) as with_price,
               max(last_scraped_at) as last_scrape
          from public.places) p,
       (select count(*) as total,
               count(*) filter (where r.timed_out or r.error_msg is not null or r.status_code >= 500) as failed
          from net._http_response r
         where r.created > now() - interval '24 hours'
           and not exists (select 1 from public.admin_logs l where l.kind = 'api' and l.request_id = r.id)) n;
$$;
revoke all on function public.health() from public;
grant execute on function public.health() to anon, authenticated, service_role;

-- ── Mail aan eigenaren: camperplaatsen zonder vertrekregel eerst (spoor 3.1) ─────────────────────────────────────
-- Volgorde: camperplaats zonder vertrekregel, dan elke plek zonder vertrekregel, gepubliceerd voor concept, dan het
-- aantal open vragen. Verder gelijk aan 20261119200000_outreach.
create or replace function private.outreach_rank(p public.places) returns integer
 language sql stable set search_path to ''
as $$
  select (case when p.kind = 'camperplaats' and 'vertrek' = any (private.outreach_missing(p)) then 0
               when 'vertrek' = any (private.outreach_missing(p)) then 1 else 2 end) * 10
         + case when p.status = 'published' then 0 else 1 end
$$;
revoke all on function private.outreach_rank(public.places) from public, anon, authenticated;

create or replace function public.outreach_next(p_secret text, p_limit integer default 10) returns jsonb
 language plpgsql security definer set search_path to ''
as $$
declare
  cfg private.outreach_config;
  v_local timestamp := now() at time zone 'Europe/Amsterdam';
  v_first timestamptz;
  v_cap integer;
  v_today integer;
  v_n integer;
  v_complaints integer;
  v_bounced integer;
  v_total integer;
  v_items jsonb;
  v_new uuid[] := '{}';
begin
  perform private.outreach_auth(p_secret);
  if not private.rate_take('outreach_next', 120, interval '1 hour') then
    return jsonb_build_object('enabled', true, 'reason', 'te vaak aangeroepen', 'items', '[]'::jsonb);
  end if;
  perform pg_advisory_xact_lock(hashtext('outreach_next'));

  select * into cfg from private.outreach_config where id;
  if not cfg.enabled then
    return jsonb_build_object('enabled', false, 'reason', coalesce(cfg.paused_reason, 'uit'), 'items', '[]'::jsonb);
  end if;

  -- Noodrem: één spamklacht of te veel harde bounces zet alles uit
  select count(*) filter (where status = 'complained'),
         count(*) filter (where status = 'bounced'),
         count(*) filter (where status not in ('claimed', 'failed'))
    into v_complaints, v_bounced, v_total
    from private.outreach_log where claimed_at > now() - interval '30 days';
  if v_complaints >= 1 then
    perform private.outreach_pause('spamklacht');
    return jsonb_build_object('enabled', false, 'reason', 'spamklacht', 'items', '[]'::jsonb);
  elsif v_total >= 40 and v_bounced * 100 > v_total * 3 then
    perform private.outreach_pause('meer dan 3% harde bounces');
    return jsonb_build_object('enabled', false, 'reason', 'te veel bounces', 'items', '[]'::jsonb);
  end if;

  -- Alleen op werkdagen overdag
  if (cfg.weekdays_only and extract(isodow from v_local) > 5)
     or extract(hour from v_local) < cfg.window_start or extract(hour from v_local) >= cfg.window_end then
    return jsonb_build_object('enabled', true, 'reason', 'buiten verzendtijd', 'items', '[]'::jsonb);
  end if;

  -- Opgegeven pogingen
  update private.outreach_log set status = 'failed', error = 'verzending verlopen', updated_at = now()
   where status = 'claimed' and claimed_at < now() - interval '20 hours';

  -- Dagquotum: begint bij per_day_start en verdubbelt elke ramp_days dagen tot per_day_max
  select min(claimed_at) into v_first from private.outreach_log;
  v_cap := least(cfg.per_day_max,
                 cfg.per_day_start * power(2, least(coalesce(floor(extract(epoch from now() - v_first) / 86400 / cfg.ramp_days), 0), 10))::integer);
  select count(*) into v_today from private.outreach_log
   where claimed_at >= date_trunc('day', v_local) at time zone 'Europe/Amsterdam';
  v_n := least(greatest(coalesce(p_limit, 10), 0), 25, greatest(v_cap - v_today, 0));

  -- Nieuwe plekken claimen (nieuw: volgorde via outreach_rank)
  if v_n > 0 then
    with ins as (
      insert into private.outreach_log (place_id, email_hash)
      select c.place_id, c.email_hash
        from private.outreach_candidates() c
        join public.places p on p.id = c.place_id
       order by private.outreach_rank(p), cardinality(private.outreach_missing(p)) desc, p.id
       limit v_n
      on conflict do nothing
      returning place_id)
    select coalesce(array_agg(place_id), '{}') into v_new from ins;
  end if;

  -- Wat nu verstuurd moet worden: nieuw geclaimd, of blijven hangen
  with due as (
    update private.outreach_log l set offered_at = now()
     where l.status = 'claimed' and (l.place_id = any (v_new) or l.offered_at < now() - interval '30 minutes')
    returning l.place_id, l.token
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'token', d.token, 'place_id', p.id, 'name', p.name, 'kind', p.kind, 'town', p.town,
           'email', trim(p.email), 'departure', p.departure, 'checkout_until', p.checkout_until,
           'checkin_from', p.checkin_from, 'checkin_until', p.checkin_until, 'open_all_year', p.open_all_year,
           'season', p.season, 'price_eur', p.price_eur, 'power', p.power, 'dump_station', p.dump_station, 'missing', to_jsonb(private.outreach_missing(p)))), '[]'::jsonb)
    into v_items
    from due d join public.places p on p.id = d.place_id;

  return jsonb_build_object('enabled', true, 'cap', v_cap, 'sent_today', v_today, 'items', v_items);
end $$;
revoke all on function public.outreach_next(text, integer) from public;
grant execute on function public.outreach_next(text, integer) to anon, authenticated;

-- Servicepunten die bij geen enkele OSM-ronde meer langskomen (weggehaald of buiten gebruik), na 30 dagen weg; de
-- provincies worden elke 7 dagen opgehaald (review database, 20 november)
select cron.schedule('servicepunten-opruimen', '41 3 * * *', $$delete from public.service_points where updated_at < now() - interval '30 days'$$);
