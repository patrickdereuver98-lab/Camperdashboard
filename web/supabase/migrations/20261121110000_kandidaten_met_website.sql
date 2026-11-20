-- plan.md A1 en A3 (20 november 2026): kandidaten uit tweede bronnen krijgen hun website mee.
--
-- 1. promote_geo_master zet de website van de kandidaat (geo_master.faciliteiten.website, alleen http(s)) op de nieuwe
--    plek. Zonder website ruimt het opruimen een nieuw concept anders meteen weer op.
-- 2. Een kandidaat uit één bron in tier 3 (Overture) mag een concept worden als hij een website heeft. Zo'n plek krijgt
--    sources.geo_master.proef = true en gaat pas online als de eigen site (tier 2) een vertrekregel noemt. De eigen site
--    is dan de tweede bron (bronnenbeleid §2); de lezer doet de controle, er komt geen nieuwe publicatieroute bij.
-- 3. geo_eerder_verwijderd blokkeerde ook een kandidaat met website op een plek die wegging omdat OSM geen website had.
--    Nu dezelfde uitzondering als de trigger weiger_verwijderde_plek: 316 van de 466 ontbrekende OSM-plekken gingen weg
--    om die reden (meting 20 november 2026).
-- Basis: de live definities op 20 november 2026.

create or replace function private.geo_website(m public.geo_master) returns text
 language sql immutable set search_path to ''
as $$
  select case when m.faciliteiten->>'website' ~* '^https?://[a-z0-9.-]+\.[a-z]{2,}(/|:|$)'
                   and length(m.faciliteiten->>'website') <= 300
              then m.faciliteiten->>'website' end;
$$;
revoke all on function private.geo_website(public.geo_master) from public, anon, authenticated;

CREATE OR REPLACE FUNCTION private.geo_eerder_verwijderd(m geo_master)
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
       and not (v.reden = 'geen website' and private.geo_website(m) is not null)
       and g.lat between m.lat - 0.0018 and m.lat + 0.0018
       and g.lng between m.lon - 0.003 and m.lon + 0.003
       and (private.geo_afstand_m(m.lat, m.lon, g.lat, g.lng) <= 60
            or (private.geo_afstand_m(m.lat, m.lon, g.lat, g.lng) <= 150
                and not private.geo_nummers_botsen(v.name, m.naam)
                and extensions.similarity(private.geo_naam_kern(v.name), private.geo_naam_kern(m.naam)) >= 0.3)));
$function$;

CREATE OR REPLACE FUNCTION public.promote_geo_master(p_dry_run boolean DEFAULT true, p_limit integer DEFAULT 500)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  m public.geo_master;
  bezwaar text;
  match_id uuid;
  v_kind text; v_town text; v_province text; v_slug text; base text; n int; new_id uuid;
  f jsonb; v_len numeric; v_cap int; v_prijs numeric; v_site text; v_proef boolean;
  c_nieuw int := 0; c_gekoppeld int := 0; c_alleen_gekoppeld int := 0; c_geweigerd int := 0; c_bekeken int := 0;
  redenen jsonb := '{}';
  redenen_gekoppeld jsonb := '{}';
  voorbeelden jsonb := '[]';
begin
  for m in
    select * from public.geo_master g
     where g.place_id is null
     order by g.bijgewerkt_op, g.master_id
     limit greatest(1, least(coalesce(p_limit, 500), 5000))
  loop
    c_bekeken := c_bekeken + 1;
    bezwaar := private.geo_promotie_bezwaar(m);
    v_site := private.geo_website(m);
    -- plan.md A3: één bron uit tier 3 (Overture) mag een concept worden als hij een website heeft. Online gaat het pas
    -- als de eigen site (tier 2) een vertrekregel noemt (places_before_write, sources.geo_master.proef).
    v_proef := coalesce(bezwaar = 'één bron uit tier 3–5: een tweede toegestane bron is nodig' and v_site is not null, false);
    match_id := private.geo_bestaande_plek(m);

    -- Bestaat de plek al: koppelen, ook als de master zelf niet door de bronregels komt (A3). Places blijft gelijk.
    if match_id is not null then
      if bezwaar is null then
        c_gekoppeld := c_gekoppeld + 1;
      else
        c_alleen_gekoppeld := c_alleen_gekoppeld + 1;
        redenen_gekoppeld := jsonb_set(redenen_gekoppeld, array[bezwaar],
                                       to_jsonb(coalesce((redenen_gekoppeld ->> bezwaar)::int, 0) + 1));
      end if;
      if not p_dry_run then
        update public.geo_master
           set place_id = match_id, promotie = 'gekoppeld', promotie_reden = bezwaar, gepromoveerd_op = now()
         where master_id = m.master_id;
      end if;
      continue;
    end if;

    -- Nieuw mag alleen zonder bezwaar, en niet op een plek die eerder is opgeruimd (open punt 73)
    if v_proef then bezwaar := null; end if;
    if bezwaar is null and private.geo_eerder_verwijderd(m) then
      bezwaar := 'eerder opgeruimd (onbereikbaar): niet opnieuw aanmaken';
    end if;
    if bezwaar is not null then
      c_geweigerd := c_geweigerd + 1;
      redenen := jsonb_set(redenen, array[bezwaar], to_jsonb(coalesce((redenen ->> bezwaar)::int, 0) + 1));
      if not p_dry_run then
        update public.geo_master set promotie = 'geweigerd', promotie_reden = bezwaar where master_id = m.master_id;
      end if;
      continue;
    end if;

    c_nieuw := c_nieuw + 1;
    if jsonb_array_length(voorbeelden) < 20 then
      voorbeelden := voorbeelden || jsonb_build_object('master_id', m.master_id, 'naam', m.naam, 'proef', v_proef);
    end if;
    if p_dry_run then continue; end if;

    -- Soort alleen als alle toegestane bronnen van deze master dezelfde soort noemen
    select case when count(distinct b.soort) = 1 and count(*) = count(b.soort) then min(b.soort) end into v_kind
      from (select distinct split_part(id, ':', 1) as bron from unnest(m.bron_ids) id) s
      join public.geo_bronnen b on b.bron = s.bron and b.status = 'toegestaan';
    select t.name, t.province into v_town, v_province from public.nearest_town(m.lat, m.lon) t;

    base := public.slugify(m.naam || coalesce('-' || v_town, ''));
    if base = '' then base := 'camperplaats'; end if;
    v_slug := base; n := 1;
    while exists (select 1 from public.places where slug = v_slug) loop
      n := n + 1; v_slug := base || '-' || n;
    end loop;

    -- Alleen waarden met het juiste type en binnen de grenzen van places; de rest blijft leeg (onbekend)
    f := m.faciliteiten;
    v_len := case when jsonb_typeof(f -> 'max_lengte_m') = 'number' and (f ->> 'max_lengte_m')::numeric between 3 and 30
                  then (f ->> 'max_lengte_m')::numeric end;
    -- Nachtprijs uit de bron (OSM charge, of 0 bij fee=no), alleen als getal binnen de grenzen van places
    v_prijs := case when jsonb_typeof(f -> 'prijs_eur') = 'number' and (f ->> 'prijs_eur')::numeric >= 0
                         and (f ->> 'prijs_eur')::numeric < 150 then (f ->> 'prijs_eur')::numeric end;
    v_cap := case when jsonb_typeof(f -> 'capaciteit') = 'number' and (f ->> 'capaciteit')::numeric between 1 and 1999
                       and (f ->> 'capaciteit')::numeric = trunc((f ->> 'capaciteit')::numeric)
                  then (f ->> 'capaciteit')::int end;

    insert into public.places (slug, name, name_is_generic, kind, lat, lng, town, province,
      power, water, dump_station, toilet, shower, wifi, dogs, open_all_year, reservation, max_length_m, capacity, price_eur, website, sources)
    values (v_slug, trim(m.naam), false, v_kind, m.lat, m.lon, v_town, v_province,
      private.geo_bool(f, 'stroom'), private.geo_bool(f, 'water'), private.geo_bool(f, 'lozing'),
      private.geo_bool(f, 'toilet'), private.geo_bool(f, 'douche'), private.geo_bool(f, 'wifi'),
      private.geo_bool(f, 'honden'), private.geo_bool(f, 'jaarrond_open'), private.geo_bool(f, 'reserveren'),
      v_len, v_cap, v_prijs, v_site,
      jsonb_build_object('geo_master', jsonb_build_object('master_id', m.master_id, 'bron_ids', to_jsonb(m.bron_ids), 'at', now())
                                       || case when v_proef then jsonb_build_object('proef', true) else '{}'::jsonb end))
    returning id into new_id;

    update public.geo_master
       set place_id = new_id, promotie = 'nieuw', promotie_reden = null, gepromoveerd_op = now()
     where master_id = m.master_id;
  end loop;

  return jsonb_build_object('dry_run', p_dry_run, 'bekeken', c_bekeken, 'nieuw', c_nieuw, 'gekoppeld', c_gekoppeld,
                            'gekoppeld_zonder_promotie', c_alleen_gekoppeld, 'redenen_gekoppeld', redenen_gekoppeld,
                            'geweigerd', c_geweigerd, 'redenen', redenen, 'voorbeelden_nieuw', voorbeelden);
end $function$;

CREATE OR REPLACE FUNCTION private.places_before_write()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
  if new.image_url like '%&#%' or new.photos::text like '%&#%' then
    new.image_url := private.decode_entities(new.image_url);
    new.photos := (select coalesce(jsonb_agg(jsonb_set(ph, '{url}', to_jsonb(private.decode_entities(ph->>'url')))), '[]'::jsonb)
                     from jsonb_array_elements(new.photos) ph);
  end if;
  if tg_op = 'UPDATE'
     and (new.departure, new.checkout_until, new.times_note) is distinct from (old.departure, old.checkout_until, old.times_note)
     and new.departure_checked_at is not distinct from old.departure_checked_at then
    new.departure_check := null;
    new.departure_checked_at := null;
    new.departure_checked_by := null;
  end if;
  new.updated_at := now();
  -- De score blijft voor de volgorde op de site
  new.completeness := public.place_completeness(new);
  if not new.status_locked then
    new.status := case when public.place_meets_must_haves(new)
                            -- plan.md A3: een plek uit één tier-3-bron gaat pas online als de eigen site de vertrekregel noemt
                            and not (coalesce((new.sources->'geo_master'->>'proef')::boolean, false) and new.departure is null)
                       then 'published' else 'draft' end;
  end if;
  return new;
end $function$;

-- plan.md A3, besluit 1 (§10): Overture Places als kandidatenbron in tier 3. Alleen een aanwijzing; een plek uit
-- Overture alleen gaat pas online als de eigen site de vertrekregel noemt (zie places_before_write hierboven).
insert into public.geo_bronnen (bron, naam, tier, status, notitie, beoordeeld_op)
values ('overture', 'Overture Maps Places (campground, rv_park, marina)', 3, 'toegestaan',
        'CDLA-Permissive-2.0 (Foursquare-records Apache-2.0). Verzamelbron: tier 3. Alleen kandidaten met website worden een concept (sources.geo_master.proef); online pas met een vertrekregel van de eigen site. plan.md A3.',
        now())
on conflict (bron) do nothing;
