-- Koppelen ook bij één bron, en geen verwijderde plekken terug (besluit eigenaar 31 oktober 2026, punten A3 en 73).
--
-- 1. Een master die niet aan de bronregels voldoet (bijvoorbeeld OSM alleen, tier 4), maar wel een bestaande plek in
--    places is (zelfde regel als het gewone koppelen: ≤ 60 m, of ≤ 150 m met een lijkende naam zonder ander nummer),
--    krijgt toch het place_id. Er verandert niets aan die plek en er komt niets nieuws bij; alleen de relatie ligt vast,
--    zodat latere wijzigingen uit de bron bij de juiste plek terechtkomen. promotie = 'gekoppeld' met promotie_reden =
--    het bezwaar (bij een volledige koppeling is de reden leeg).
-- 2. Een nieuwe plek wordt niet aangemaakt als op dezelfde plek een plek is opgeruimd (private.verwijderde_plekken,
--    migratie 20261025160000). De trigger daar herkent alleen OSM-nummers; masters hebben er geen.
--
-- Terugdraaien: migratie 20261031090000 opnieuw uitvoeren (oude promote_geo_master), en
--   drop function private.geo_bestaande_plek(public.geo_master); drop function private.geo_eerder_verwijderd(public.geo_master);

-- Zelfde definitie als in 20261025160000; hier ook, zodat deze migratie los te testen is
create table if not exists private.verwijderde_plekken (
  id uuid primary key,
  osm_type text,
  osm_id bigint,
  slug text,
  name text,
  website text,
  reden text not null,
  gegevens jsonb not null,
  removed_at timestamptz not null default now()
);
alter table private.verwijderde_plekken enable row level security;

-- Bestaande plek voor deze master, of null. Eerst een vak van ±200 m (snel), dan precies.
create or replace function private.geo_bestaande_plek(m public.geo_master)
returns uuid
language sql
stable
set search_path to ''
as $$
  select p.id
    from public.places p
   where p.merged_into is null
     and m.lat is not null and m.lon is not null
     and p.lat between m.lat - 0.0018 and m.lat + 0.0018
     and p.lng between m.lon - 0.003 and m.lon + 0.003
     and (private.geo_afstand_m(m.lat, m.lon, p.lat, p.lng) <= 60
          or (private.geo_afstand_m(m.lat, m.lon, p.lat, p.lng) <= 150
              and not private.geo_nummers_botsen(p.name, m.naam)
              and extensions.similarity(private.geo_naam_kern(p.name), private.geo_naam_kern(m.naam)) >= 0.3))
   order by private.geo_afstand_m(m.lat, m.lon, p.lat, p.lng)
   limit 1;
$$;

-- Is hier eerder een plek opgeruimd? Zelfde afstands- en naamregel als koppelen, op de bewaarde gegevens.
create or replace function private.geo_eerder_verwijderd(m public.geo_master)
returns boolean
language sql
stable
security definer
set search_path to ''
as $$
  select exists (
    select 1
      from private.verwijderde_plekken v
      cross join lateral (select (v.gegevens ->> 'lat')::float8 as lat, (v.gegevens ->> 'lng')::float8 as lng) g
     where g.lat between m.lat - 0.0018 and m.lat + 0.0018
       and g.lng between m.lon - 0.003 and m.lon + 0.003
       and (private.geo_afstand_m(m.lat, m.lon, g.lat, g.lng) <= 60
            or (private.geo_afstand_m(m.lat, m.lon, g.lat, g.lng) <= 150
                and not private.geo_nummers_botsen(v.name, m.naam)
                and extensions.similarity(private.geo_naam_kern(v.name), private.geo_naam_kern(m.naam)) >= 0.3)));
$$;

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
                            'gekoppeld_zonder_promotie', c_alleen_gekoppeld, 'redenen_gekoppeld', redenen_gekoppeld,
                            'geweigerd', c_geweigerd, 'redenen', redenen, 'voorbeelden_nieuw', voorbeelden);
end $$;

revoke all on function public.promote_geo_master(boolean, integer) from public, anon, authenticated;
grant execute on function public.promote_geo_master(boolean, integer) to service_role;
revoke all on function private.geo_bestaande_plek(public.geo_master) from public;
revoke all on function private.geo_eerder_verwijderd(public.geo_master) from public;
