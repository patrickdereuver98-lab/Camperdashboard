-- Master Database (30 oktober 2026): heel Nederland in één Overpass-query, dubbele OSM-objecten herkennen bij de import
-- en één stealth-lezerproces in plaats van acht lezers op eigen hosts.
--
-- Pas live toepassen nadat de edge function `pipeline` met dedupe.ts en de regio "NL" (osm.ts) is uitgerold: de oude
-- functie kent "NL" niet en zou de landsrun als onbekende regio weigeren.
--
-- Terugdraaien: de oude templates staan in de vorige versie van public.osm_queries (zie git, osm.ts placesQuery met een
-- provinciecode); provincies terugzetten met de insert onderaan in commentaar.

-- 1. Overpass: één landsquery (300 s op de server), pg_net wacht 330 s. collect_osm geeft na 10 minuten op, dat blijft ruim.
update public.osm_queries set template =
  '[out:json][timeout:300];(area["ISO3166-1"="NL"][admin_level=2];area["ISO3166-1:alpha2"="NL"][admin_level=2];)->.r;(nwr["tourism"="caravan_site"](area.r);nwr["tourism"="camp_site"]["motorhome"!="no"]["tents"!="only"](area.r);nwr["amenity"="parking"]["motorhome"~"^(yes|designated)$",i](area.r);nwr["motorhome"~"^(yes|designated)$",i](area.r););out center tags;'
 where name = 'places';
update public.osm_queries set template =
  '[out:json][timeout:180];(area["ISO3166-1"="NL"][admin_level=2];area["ISO3166-1:alpha2"="NL"][admin_level=2];)->.r;(nwr["amenity"="sanitary_dump_station"](area.r);nwr["amenity"="water_point"](area.r););out center tags;'
 where name = 'points';

create or replace function private.overpass_get(p_name text, p_region text, p_mirror integer default 0)
returns bigint
language sql
security definer
set search_path to ''
as $function$
  select net.http_get(
    (array['https://overpass-api.de/api/interpreter',
           'https://overpass.kumi.systems/api/interpreter',
           'https://overpass.private.coffee/api/interpreter'])[1 + (p_mirror % 3)],
    params := jsonb_build_object('data', format((select template from public.osm_queries where name = p_name), p_region)),
    headers := '{"User-Agent":"VrijStaanBot/1.0 (+https://vrijstaan.nl/bot)"}'::jsonb,
    timeout_milliseconds := 330000);
$function$;

-- Eén regio voor heel Nederland; de provincie komt bij nieuwe plekken uit nearest_town (ingest_osm deed dat al als
-- terugval), bestaande plekken houden hun provincie.
insert into public.osm_regions (code, name) values ('NL', 'Nederland') on conflict (code) do nothing;
delete from public.osm_regions where code like 'NL-%';
-- insert into public.osm_regions (code, name) values ('NL-DR','Drenthe'),('NL-FL','Flevoland'),('NL-FR','Friesland'),
--   ('NL-GE','Gelderland'),('NL-GR','Groningen'),('NL-LI','Limburg'),('NL-NB','Noord-Brabant'),('NL-NH','Noord-Holland'),
--   ('NL-OV','Overijssel'),('NL-UT','Utrecht'),('NL-ZE','Zeeland'),('NL-ZH','Zuid-Holland');

-- 2. ingest_osm: de pipeline voegt dubbele OSM-objecten van één plek samen (dedupe.ts) en geeft de andere mee in
-- osm_refs ("way/123"). Is de plek eerder onder een van die objecten binnengekomen, dan werken we die plek bij in plaats
-- van een tweede aan te maken. Gepubliceerde en vollere plekken eerst. Zelfde aanpak als 20261019070000: tekst
-- vervangen en controleren dat het lukte.
do $$
declare d text := pg_get_functiondef('public.ingest_osm(jsonb)'::regprocedure);
begin
  d := replace(d,
    $a$select id into existing from public.places where osm_type = r->>'osm_type' and osm_id = (r->>'osm_id')::bigint;$a$,
    $a$select id into existing from public.places where osm_type = r->>'osm_type' and osm_id = (r->>'osm_id')::bigint;
    if existing is null and jsonb_typeof(r->'osm_refs') = 'array' then
      select p.id into existing
        from jsonb_array_elements_text(r->'osm_refs') ref
        join public.places p on p.osm_type = split_part(ref, '/', 1) and p.osm_id = nullif(split_part(ref, '/', 2), '')::bigint
       where p.merged_into is null
       order by p.status = 'published' desc, p.completeness desc nulls last
       limit 1;
    end if;$a$);
  if position('osm_refs' in d) = 0 then
    raise exception 'ingest_osm: vervanging niet gelukt';
  end if;
  execute d;
end $$;

-- 3. Stealth-lezer: één proces met een gedeelde klok per host (tools/stealth-lezer), dus geen verdeling over hosts meer.
-- De versie met één argument blijft.
drop function if exists public.next_stealth_batch(int, int, int);
