-- Review 16 november 2026, R68 en R73: de keten gooit geen plekken of gegevens meer stil weg.
-- 1. verwijder_onbereikbare_plekken verwijdert geen camperplaatsen of parkeerplaatsen zonder website meer: vaak
--    gemeentelijke plekken, precies het soort zonder vaste vertrektijd. Ze blijven concept en gaan naar de controlelijst.
-- 2. De blokkade op verwijderde plekken (weiger_verwijderde_plek, geo_eerder_verwijderd) vervalt na zes maanden, en een
--    plek die zonder website wegging mag terug als OSM er nu een heeft. Tot nu toe was de blokkade voorgoed.
-- 3. ingest_osm wist een prijs niet meer als OSM geen prijs heeft (coalesce), en overschrijft website, telefoon en
--    e-mail niet meer: OSM vult alleen lege velden (datareview F7).
-- Basis: de nulmigratie (gelijk aan live op 18 november 2026); alleen de gemarkeerde regels zijn nieuw.

CREATE OR REPLACE FUNCTION private.verwijder_onbereikbare_plekken(p_proef boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  n_geen_site int;
  n_dood int;
begin
  drop table if exists _weg;
  create temp table _weg on commit drop as
  select p.*,
         case when p.website is null then 'geen website'
              else 'website onleesbaar, ook met stealth: ' || left(p.sources->'stealth'->>'error', 120) end as reden
    from public.places p
   where p.merged_into is null
     and p.status <> 'published'
     and not p.status_locked
     and p.price_eur is null
     and p.departure is null
     -- R68: camperplaatsen en parkeerplaatsen zonder website zijn vaak gemeentelijk; die gaan naar de controlelijst
     -- (cron handmatig-markeren) in plaats van weg
     and not (p.website is null and p.kind in ('camperplaats', 'parkeerplaats'))
     -- coalesce: zonder sources.beheer zou een vergelijking met null de hele voorwaarde null maken (dan valt alles af)
     and coalesce(p.sources->'beheer', '{}'::jsonb) in ('{}'::jsonb, '[]'::jsonb)
     and not exists (select 1 from public.places m where m.merged_into = p.id)
     and (p.website is null
          or (p.sources->'stealth' ? 'error'
              and not exists (select 1 from private.stealth_queue q where q.place_id = p.id and q.done_at is null)));

  select count(*) filter (where website is null), count(*) filter (where website is not null)
    into n_geen_site, n_dood from _weg;

  if not p_proef then
    insert into private.verwijderde_plekken (id, osm_type, osm_id, slug, name, website, reden, gegevens)
    select w.id, w.osm_type, w.osm_id, w.slug, w.name, w.website, w.reden, to_jsonb(w) - 'reden' - 'geom'
      from _weg w
    on conflict (id) do nothing;
    delete from public.places p using _weg w where p.id = w.id;
  end if;

  return jsonb_build_object('proef', p_proef, 'geen_website', n_geen_site, 'website_dood', n_dood);
end $function$
;

CREATE OR REPLACE FUNCTION private.weiger_verwijderde_plek()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if new.osm_id is not null and exists (
    select 1 from private.verwijderde_plekken v where v.osm_type = new.osm_type and v.osm_id = new.osm_id
       -- R68: de blokkade vervalt na zes maanden, en een plek die zonder website wegging mag terug als OSM er nu een heeft
       and v.removed_at > now() - interval '6 months'
       and not (v.reden = 'geen website' and new.website is not null)
  ) then
    return null;
  end if;
  return new;
end $function$
;

CREATE OR REPLACE FUNCTION private.geo_eerder_verwijderd(m public.geo_master)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select exists (
    select 1
      from private.verwijderde_plekken v
      cross join lateral (select (v.gegevens ->> 'lat')::float8 as lat, (v.gegevens ->> 'lng')::float8 as lng) g
     where v.removed_at > now() - interval '6 months'  -- R68: blokkade vervalt na zes maanden
       and g.lat between m.lat - 0.0018 and m.lat + 0.0018
       and g.lng between m.lon - 0.003 and m.lon + 0.003
       and (private.geo_afstand_m(m.lat, m.lon, g.lat, g.lng) <= 60
            or (private.geo_afstand_m(m.lat, m.lon, g.lat, g.lng) <= 150
                and not private.geo_nummers_botsen(v.name, m.naam)
                and extensions.similarity(private.geo_naam_kern(v.name), private.geo_naam_kern(m.naam)) >= 0.3)));
$function$
;

CREATE OR REPLACE FUNCTION public.ingest_osm(p_rows jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
        capacity, max_length_m, surface, open_all_year, season, reservation, website, phone, email, operator, image_url, image_credit,
        departure, checkout_until, checkin_from, max_stay_nights, access_24h, times_note, sources)
      values (v_slug, r->>'osm_type', (r->>'osm_id')::bigint, v_name, generic, r->>'kind',
        (r->>'lat')::float8, (r->>'lng')::float8, r->>'street', r->>'postcode',
        v_town, coalesce(nullif(r->>'province', ''), town.province),
        r->>'description', case when r ? 'description' then 'openstreetmap' end,
        (r->>'price_eur')::numeric,
        (r->>'power')::boolean, (r->>'water')::boolean, (r->>'dump_station')::boolean, (r->>'toilet')::boolean,
        (r->>'shower')::boolean, (r->>'wifi')::boolean, (r->>'dogs')::boolean,
        (r->>'capacity')::int, (r->>'max_length_m')::numeric, r->>'surface',
        (r->>'open_all_year')::boolean, r->>'season', (r->>'reservation')::boolean,
        r->>'website', r->>'phone', r->>'email', r->>'operator', r->>'image_url', r->>'image_credit',
        r->>'departure', r->>'checkout_until', r->>'checkin_from', (r->>'max_stay_nights')::int, (r->>'access_24h')::boolean,
        case when r ? 'departure' or r ? 'checkin_from' then 'Volgens OpenStreetMap' end,
        jsonb_build_object('osm', now()));
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
        max_stay_nights = case when p.sources->'beheer' ? 'max_stay_nights' then p.max_stay_nights else coalesce((r->>'max_stay_nights')::int, p.max_stay_nights) end,
        access_24h = case when p.sources->'beheer' ? 'access_24h' or p.sources->'website_fields' ? 'access_24h' then p.access_24h
                          else coalesce((r->>'access_24h')::boolean, p.access_24h) end,
        sources = p.sources || jsonb_build_object('osm', now())
      where p.id = existing;
      upd := upd + 1;
    end if;
  end loop;
  return jsonb_build_object('inserted', ins, 'updated', upd);
end $function$
;

-- R71: een time-out of serverfout bij het zoeken naar een website is geen "geen website". apply_discovery legt een
-- onzekere uitkomst vast met een nieuwe poging na 7 dagen (hoogstens drie keer), en next_discover_batch pakt zulke
-- plekken dan weer op. Een plek die op "started" bleef hangen (functie halverwege afgebroken) komt na een dag terug.
drop function if exists public.apply_discovery(uuid, text);
create or replace function public.apply_discovery(p_id uuid, p_url text, p_unsure boolean default false)
 returns void
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare tries int;
begin
  if p_unsure and p_url is null then
    select coalesce((sources->'discovery'->>'tries')::int, 0) + 1 into tries from public.places where id = p_id;
    update public.places
       set sources = coalesce(sources, '{}'::jsonb) || jsonb_build_object('discovery',
             jsonb_build_object('at', now(), 'url', null, 'tries', tries)
             || case when tries < 3 then jsonb_build_object('retry', now() + interval '7 days') else '{}'::jsonb end)
     where id = p_id;
    return;
  end if;
  update public.places
     set website = coalesce(website, p_url),
         sources = coalesce(sources, '{}'::jsonb) || jsonb_build_object('discovery', jsonb_build_object('at', now(), 'url', p_url))
   where id = p_id;
  if p_url is not null then
    insert into private.scrape_queue (place_id) values (p_id)
    on conflict (place_id) do update set done_at = null, attempts = 0, next_attempt_at = now(), last_error = null;
  end if;
end $function$;
revoke all on function public.apply_discovery(uuid, text, boolean) from public, anon, authenticated;
grant execute on function public.apply_discovery(uuid, text, boolean) to service_role;

create or replace function public.next_discover_batch(p_limit integer)
 returns table(id uuid, name text, town text, postcode text, phone text)
 language sql
 security definer
 set search_path to ''
as $function$
  with picked as (
    select p.id from public.places p
     where p.website is null
       and p.status in ('draft', 'published')
       and coalesce(p.name_is_generic, false) = false
       and p.name is not null
       and (not (coalesce(p.sources, '{}'::jsonb) ? 'discovery')
            -- R71: onzeker, en de nieuwe poging is aan de beurt
            or (p.sources->'discovery'->>'retry')::timestamptz < now()
            -- R71: blijven hangen op "started" zonder uitkomst
            or (not (p.sources->'discovery' ? 'at') and (p.sources->'discovery'->>'started')::timestamptz < now() - interval '1 day'))
     order by p.completeness desc
     limit p_limit
     for update skip locked
  ), mark as (
    -- Meteen markeren, zodat een volgende batch dezelfde plekken niet nog eens pakt (tries blijft bewaard)
    update public.places p set sources = coalesce(p.sources, '{}'::jsonb) || jsonb_build_object('discovery',
             jsonb_build_object('started', now())
             || case when p.sources->'discovery' ? 'tries' then jsonb_build_object('tries', p.sources->'discovery'->'tries') else '{}'::jsonb end)
      from picked where p.id = picked.id
    returning p.id, p.name, p.town, p.postcode, p.phone
  )
  select * from mark;
$function$;
