-- OSM ophalen per deel en na elkaar (november 2026, na de foutanalyse van 18 november)
--
-- Probleem: per provincie gingen twee Overpass-verzoeken tegelijk naar dezelfde server (plekken en servicepunten), en
-- de ronde telde alleen als beide in dezelfde poging lukten. Gelukte helften werden weggegooid; Noord-Brabant, Drenthe
-- en Limburg kwamen daardoor sinds 9 en 10 november niet meer door (8 tot 13 pogingen).
--
-- 1. Een gelukt deel blijft bewaard: de plekken gaan meteen naar osm_staging (via de pipeline, actie "parse" met
--    alleen places_req). osm_regions.places_done_at onthoudt dat; de volgende poging vraagt alleen de servicepunten.
-- 2. Na elkaar: eerst de plekken, daarna (volgende ronde van osm-regions, ±3 minuten later) de servicepunten. Er staat
--    nooit meer dan één Overpass-verzoek van ons tegelijk uit.
-- 3. De oude private.overpass_get(text, text) zonder serverkeuze is weg (ongebruikt; naast de versie met p_mirror
--    maakte die een aanroep met twee argumenten dubbelzinnig).
--
-- "Bezig" is nu: places_req of points_req gevuld. De cron-taak osm-collect, admin_pipeline('osm-refresh') en
-- admin_overview (veld osm.busy) kijken daarom naar beide kolommen.
--
-- Volgorde bij uitrollen: eerst de edge function pipeline (parse met één van beide verzoeken), dan deze migratie.

alter table public.osm_regions add column if not exists places_done_at timestamptz;
comment on column public.osm_regions.places_done_at is
  'Plekken van de lopende ronde staan in osm_staging; de volgende poging vraagt alleen de servicepunten';

drop function if exists private.overpass_get(text, text);

create or replace function private.next_osm_region()
 returns text
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare r public.osm_regions;
begin
  -- Nooit meer dan één Overpass-verzoek tegelijk
  if exists (select 1 from public.osm_regions where places_req is not null or points_req is not null) then return null; end if;
  select * into r from public.osm_regions
   where last_run_at is null or last_run_at < now() - interval '7 days'
   order by last_run_at nulls first limit 1;
  if not found then return null; end if;
  -- Bij een eerdere mislukte poging een andere Overpass-server (p_mirror = attempt)
  if r.places_done_at is null then
    update public.osm_regions set last_run_at = now(), places_req = private.overpass_get('places', r.code, r.attempt)
     where code = r.code;
  else
    update public.osm_regions set last_run_at = now(), points_req = private.overpass_get('points', r.code, r.attempt)
     where code = r.code;
  end if;
  return r.code;
end $function$;

create or replace function private.collect_osm()
 returns text
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare r public.osm_regions; req bigint; part text; deel text; st int; found_ boolean; wait interval;
begin
  select * into r from public.osm_regions where places_req is not null or points_req is not null limit 1;
  if not found then return null; end if;
  if r.places_req is not null then req := r.places_req; part := 'places'; deel := 'plekken';
  else req := r.points_req; part := 'points'; deel := 'servicepunten'; end if;
  -- Overpass is vaak overbelast: wacht steeds langer (10, 20, 40 … minuten, hooguit 6 uur), wissel van server
  wait := least(interval '10 minutes' * power(2, least(r.attempt, 6)), interval '6 hours');
  select true, status_code into found_, st from net._http_response where id = req;
  if found_ is null then
    -- Nog geen antwoord; na 10 minuten geldt het als mislukt (pg_net raakt soms een verzoek kwijt)
    if r.last_run_at < now() - interval '10 minutes' then
      update public.osm_regions set places_req = null, points_req = null, attempt = attempt + 1,
             last_run_at = now() - interval '7 days' + wait where code = r.code;
    end if;
    return 'wacht';
  end if;
  if st = 200 then
    -- Meteen verwerken: pg_net bewaart antwoorden maar 6 uur
    perform private.call_pipeline(jsonb_build_object('action', 'parse', 'region', r.code, part || '_req', req));
    if part = 'places' then
      -- Plekken binnen: servicepunten bij de volgende ronde van osm-regions, met de eerste server
      update public.osm_regions set places_req = null, places_done_at = now(), attempt = 0,
             last_run_at = now() - interval '7 days 1 minute' where code = r.code;
    else
      -- Ronde klaar; last_run_at blijft het moment van dit verzoek, dus volgende ronde over 7 dagen
      update public.osm_regions set points_req = null, places_done_at = null, attempt = 0 where code = r.code;
    end if;
  else
    insert into public.app_logs (level, source, message, context) values (case when r.attempt >= 3 then 'error' else 'warn' end, 'pipeline',
      'Overpass gaf geen data voor ' || r.name || ' (' || deel || ', poging ' || (r.attempt + 1) || ', volgende poging over '
        || extract(epoch from wait)::int / 60 || ' minuten via andere server)',
      jsonb_build_object(part, st));
    update public.osm_regions set places_req = null, points_req = null, attempt = attempt + 1,
           last_run_at = now() - interval '7 days' + wait where code = r.code;
  end if;
  return r.code;
end $function$;

-- osm-collect draait ook tijdens het servicepuntendeel
do $$
begin
  if exists (select 1 from cron.job where jobname = 'osm-collect') then perform cron.unschedule('osm-collect'); end if;
  perform cron.schedule('osm-collect', '*/5 * * * *',
    $c$select private.collect_osm() where exists (select 1 from public.osm_regions where places_req is not null or points_req is not null)$c$);
end $$;

-- admin_pipeline('osm-refresh') en admin_overview: "bezig" ook bij een lopend servicepuntenverzoek. Alleen deze ene
-- voorwaarde verandert; de rest van beide functies blijft zoals live. Faalt als de tekst niet (precies één keer) staat.
do $$
declare def text; oud text; nieuw text; f regprocedure;
begin
  foreach f in array array['public.admin_pipeline(text)'::regprocedure, 'public.admin_overview()'::regprocedure] loop
    def := pg_get_functiondef(f);
    if f = 'public.admin_pipeline(text)'::regprocedure then
      oud := 'where places_req is null;';
      nieuw := 'where places_req is null and points_req is null;';
    else
      oud := '''busy'', places_req is not null)';
      nieuw := '''busy'', places_req is not null or points_req is not null)';
    end if;
    if (length(def) - length(replace(def, oud, ''))) / length(oud) <> 1 then
      raise exception '%: verwachte tekst % niet precies één keer gevonden', f, oud;
    end if;
    execute replace(def, oud, nieuw);
  end loop;
end $$;
