-- Promotie van geo_master naar places (opdracht 30 oktober 2026; open punt 71 in docs/specs/README.md).
--
-- Een master gaat alleen naar places als hij aan de bronregels voldoet. Die regels volgen de bronnenlaag (dataplan
-- Fase 0, besluit 18 oktober 2026), die zelf nog niet live staat:
--   1. Bron: elk bron_id begint met "<bron>:". Alleen bronnen die een mens in geo_bronnen op `toegestaan` zette tellen.
--      Tier 1 of 2 is genoeg; tier 3 tot 5 vraagt twee verschillende toegestane bronnen. Geblokkeerd telt nooit.
--      Een toegestane bron is daarmee ook de garantie dat het om legale plekken gaat: beoordeel een bron vóór je hem
--      toestaat (geen wildkampeerlijsten).
--   2. Plek: binnen de rechthoek van Nederland én hoogstens 16 km van een plaats in nl_towns (elke plek in places ligt
--      binnen 15,5 km; Antwerpen 24 km, Brussel 50 km). Een plek net over de grens kan er nog door; daarvoor is
--      een grenspolygoon nodig.
--   3. Naam: aanwezig, 3 tot 120 tekens, niet alleen een soortwoord ("Camperplaats"), geen adres of URL.
--   4. Geen wildkamperen: een naam of faciliteit die op wild- of paalkamperen wijst, gaat niet door.
--   5. Bestaat de plek al in places (≤ 60 m, of ≤ 150 m met een naam die op elkaar lijkt en geen ander nummer noemt),
--      dan wordt de master alleen
--      gekoppeld. Hij verandert niets aan die plek: beheer, de eigen website en OpenStreetMap gaan voor (W4.1).
--   6. Een nieuwe plek krijgt alleen wat de bron letterlijk noemt. De status volgt de bestaande regel in
--      places_before_write (drempel plus harde eis met contact): zonder website of telefoon blijft hij concept, en de
--      cron `discover` zoekt daarna een website zoals bij elke nieuwe OSM-plek.
--
-- Afgewezen masters worden bij de volgende run opnieuw bekeken (een bron kan later worden toegestaan).
-- Aanroepen: select public.promote_geo_master(true)  → proef, schrijft niets
--            select public.promote_geo_master(false) → uitvoeren (pipeline-actie `promote`, workflow data_pipeline.yml)

-- ── Bronnen die naar places mogen ────────────────────────────────────────────

create table if not exists public.geo_bronnen (
  bron text primary key check (bron ~ '^[a-z0-9_]{2,40}$'),
  naam text not null,
  tier smallint not null check (tier between 1 and 5),
  status text not null default 'te_beoordelen' check (status in ('toegestaan', 'te_beoordelen', 'geblokkeerd')),
  -- Soort plek voor nieuwe plekken uit deze bron (alleen als de hele bron één soort is); leeg = onbekend
  soort text check (soort in ('camperplaats', 'camping', 'parkeerplaats', 'boerderij', 'jachthaven')),
  notitie text,
  beoordeeld_op timestamptz,
  aangemaakt_op timestamptz not null default now()
);
alter table public.geo_bronnen enable row level security;
revoke all on public.geo_bronnen from anon, authenticated;
grant select, insert, update, delete on public.geo_bronnen to service_role;

-- ── Uitkomst per master ──────────────────────────────────────────────────────

alter table public.geo_master
  add column if not exists place_id uuid references public.places (id) on delete set null,
  add column if not exists promotie text check (promotie in ('nieuw', 'gekoppeld', 'geweigerd')),
  add column if not exists promotie_reden text,
  add column if not exists gepromoveerd_op timestamptz;
create index if not exists geo_master_te_promoveren on public.geo_master (bijgewerkt_op) where place_id is null;

-- ── Regels ───────────────────────────────────────────────────────────────────

-- Naam zonder accenten, leestekens en soortwoorden (zelfde woorden als normalizeName in merge_master.ts)
create or replace function private.geo_naam_kern(p text)
returns text
language sql
immutable
set search_path to ''
as $$
  select coalesce(string_agg(w, ' ' order by i), '')
  from regexp_split_to_table(lower(extensions.unaccent(coalesce(p, ''))), '[^a-z0-9]+') with ordinality as t(w, i)
  where w <> '' and w not in (
    'camperplaats', 'camperplaatsen', 'camperplek', 'camperplekken', 'camperpark', 'camperparkeerplaats',
    'campervoorziening', 'camperstandplaats', 'camperhaven', 'camping', 'minicamping', 'kampeerterrein',
    'boerderijcamping', 'natuurcamping', 'parking', 'parkeerplaats', 'jachthaven', 'passantenhaven', 'stellplatz',
    'wohnmobilstellplatz', 'reisemobilstellplatz', 'campingplatz', 'aire', 'motorhome', 'camper', 'campers',
    'vakantiepark', 'recreatiepark', 'de', 'het', 't', 'van', 'aan', 'bij', 'op');
$$;

-- Afstand in meters (haversine), zonder PostGIS zodat de functie ook in de test-database draait
create or replace function private.geo_afstand_m(lat1 float8, lon1 float8, lat2 float8, lon2 float8)
returns float8
language sql
immutable
set search_path to ''
as $$
  select 2 * 6371008.8 * asin(least(1, sqrt(
    sin(radians(lat2 - lat1) / 2) ^ 2 + cos(radians(lat1)) * cos(radians(lat2)) * sin(radians(lon2 - lon1) / 2) ^ 2)));
$$;

/**
 * Waarom deze master (nog) niet naar places mag; null = mag. Alleen de regels 1 tot en met 4; koppelen of nieuw is
 * de stap daarna.
 */
create or replace function private.geo_promotie_bezwaar(m public.geo_master)
returns text
language plpgsql
stable
set search_path to ''
as $$
declare
  n_sterk int; n_zwak int; n_geblokkeerd int; namen text; t public.nl_towns;
begin
  select count(*) filter (where b.status = 'toegestaan' and b.tier <= 2),
         count(distinct b.bron) filter (where b.status = 'toegestaan' and b.tier >= 3),
         count(*) filter (where b.status = 'geblokkeerd')
    into n_sterk, n_zwak, n_geblokkeerd
    from (select distinct split_part(id, ':', 1) as bron from unnest(m.bron_ids) id) s
    join public.geo_bronnen b on b.bron = s.bron;
  if n_sterk = 0 and n_zwak = 0 then
    return case when n_geblokkeerd > 0 then 'alleen geblokkeerde bronnen' else 'geen toegestane bron' end;
  end if;
  if n_sterk = 0 and n_zwak < 2 then
    return 'één bron uit tier 3–5: een tweede toegestane bron is nodig';
  end if;

  if m.lat is null or m.lon is null or m.lat not between 50.70 and 53.60 or m.lon not between 3.30 and 7.30 then
    return 'buiten Nederland';
  end if;
  t := public.nearest_town(m.lat, m.lon);
  if t.id is null or private.geo_afstand_m(m.lat, m.lon, t.lat, t.lng) > 16000 then
    return 'buiten Nederland';
  end if;

  if m.naam is null or length(trim(m.naam)) not between 3 and 120 then
    return 'naam ontbreekt of heeft een vreemde lengte';
  end if;
  if private.geo_naam_kern(m.naam) = '' then
    return 'naam is alleen een soortwoord';
  end if;
  if m.naam ~* '(https?://|www\.|@|\.(nl|com|de|be|eu)\b)' or m.naam ~ '^[0-9 .,-]+$' then
    return 'naam lijkt een adres, URL of nummer';
  end if;

  namen := lower(extensions.unaccent(m.naam || ' ' || array_to_string(m.namen, ' ')));
  if namen ~ '(wild ?kampe|wildcamp|wild camp|free ?camp|wildes? camp|paalkampe|bivak)'
     or m.faciliteiten ?| array['wildkamperen', 'paalkamperen', 'wildcamping'] then
    return 'wildkamperen of paalkamperen (geen camperplek)';
  end if;
  return null;
end $$;

-- Noemen beide namen een nummer en verschillen die, dan zijn het andere plekken (zelfde regel als nameSimilarity in
-- merge_master.ts; gevonden in de generale repetitie van 30 oktober: "Vlinder 574" werd aan "Vlinder 502" gekoppeld)
create or replace function private.geo_nummers_botsen(a text, b text)
returns boolean
language sql
immutable
set search_path to ''
as $$
  with n as (
    select (select string_agg(x[1], ',' order by x[1]) from regexp_matches(a, '[0-9]+', 'g') x) as na,
           (select string_agg(x[1], ',' order by x[1]) from regexp_matches(b, '[0-9]+', 'g') x) as nb
  )
  select na is not null and nb is not null and na <> nb from n;
$$;

-- Waarde van een faciliteit als boolean, alleen als de bron echt true/false gaf
create or replace function private.geo_bool(f jsonb, k text)
returns boolean
language sql
immutable
set search_path to ''
as $$
  select case when jsonb_typeof(f -> k) = 'boolean' then (f ->> k)::boolean end;
$$;

-- ── Promotie ─────────────────────────────────────────────────────────────────

create or replace function public.promote_geo_master(p_dry_run boolean default true, p_limit integer default 500)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare
  m public.geo_master;
  bezwaar text;
  match_id uuid;
  v_kind text; v_town text; v_province text; v_slug text; base text; n int; new_id uuid;
  f jsonb; v_len numeric; v_cap int;
  c_nieuw int := 0; c_gekoppeld int := 0; c_geweigerd int := 0; c_bekeken int := 0;
  redenen jsonb := '{}';
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

    if bezwaar is not null then
      c_geweigerd := c_geweigerd + 1;
      redenen := jsonb_set(redenen, array[bezwaar], to_jsonb(coalesce((redenen ->> bezwaar)::int, 0) + 1));
      if not p_dry_run then
        update public.geo_master set promotie = 'geweigerd', promotie_reden = bezwaar where master_id = m.master_id;
      end if;
      continue;
    end if;

    -- Bestaat de plek al? ≤ 60 m, of ≤ 150 m met een naam die erop lijkt. Eerst een vak van ±200 m (snel), dan precies.
    select p.id into match_id
      from public.places p
     where p.merged_into is null
       and p.lat between m.lat - 0.0018 and m.lat + 0.0018
       and p.lng between m.lon - 0.003 and m.lon + 0.003
       and (private.geo_afstand_m(m.lat, m.lon, p.lat, p.lng) <= 60
            or (private.geo_afstand_m(m.lat, m.lon, p.lat, p.lng) <= 150
                and not private.geo_nummers_botsen(p.name, m.naam)
                and extensions.similarity(private.geo_naam_kern(p.name), private.geo_naam_kern(m.naam)) >= 0.3))
     order by private.geo_afstand_m(m.lat, m.lon, p.lat, p.lng)
     limit 1;

    if match_id is not null then
      c_gekoppeld := c_gekoppeld + 1;
      if not p_dry_run then
        update public.geo_master
           set place_id = match_id, promotie = 'gekoppeld', promotie_reden = null, gepromoveerd_op = now()
         where master_id = m.master_id;
      end if;
      continue;
    end if;

    c_nieuw := c_nieuw + 1;
    if jsonb_array_length(voorbeelden) < 20 then
      voorbeelden := voorbeelden || jsonb_build_object('master_id', m.master_id, 'naam', m.naam);
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
    v_cap := case when jsonb_typeof(f -> 'capaciteit') = 'number' and (f ->> 'capaciteit')::numeric between 1 and 1999
                       and (f ->> 'capaciteit')::numeric = trunc((f ->> 'capaciteit')::numeric)
                  then (f ->> 'capaciteit')::int end;

    insert into public.places (slug, name, name_is_generic, kind, lat, lng, town, province,
      power, water, dump_station, toilet, shower, wifi, dogs, open_all_year, reservation, max_length_m, capacity, sources)
    values (v_slug, trim(m.naam), false, v_kind, m.lat, m.lon, v_town, v_province,
      private.geo_bool(f, 'stroom'), private.geo_bool(f, 'water'), private.geo_bool(f, 'lozing'),
      private.geo_bool(f, 'toilet'), private.geo_bool(f, 'douche'), private.geo_bool(f, 'wifi'),
      private.geo_bool(f, 'honden'), private.geo_bool(f, 'jaarrond_open'), private.geo_bool(f, 'reserveren'),
      v_len, v_cap,
      jsonb_build_object('geo_master', jsonb_build_object('master_id', m.master_id, 'bron_ids', to_jsonb(m.bron_ids), 'at', now())))
    returning id into new_id;

    update public.geo_master
       set place_id = new_id, promotie = 'nieuw', promotie_reden = null, gepromoveerd_op = now()
     where master_id = m.master_id;
  end loop;

  return jsonb_build_object('dry_run', p_dry_run, 'bekeken', c_bekeken, 'nieuw', c_nieuw, 'gekoppeld', c_gekoppeld,
                            'geweigerd', c_geweigerd, 'redenen', redenen, 'voorbeelden_nieuw', voorbeelden);
end $$;

revoke all on function public.promote_geo_master(boolean, integer) from public, anon, authenticated;
grant execute on function public.promote_geo_master(boolean, integer) to service_role;
revoke all on function private.geo_promotie_bezwaar(public.geo_master) from public;
revoke all on function private.geo_naam_kern(text) from public;
revoke all on function private.geo_afstand_m(float8, float8, float8, float8) from public;
revoke all on function private.geo_bool(jsonb, text) from public;
revoke all on function private.geo_nummers_botsen(text, text) from public;
