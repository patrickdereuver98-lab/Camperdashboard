-- Status: NOG NIET live toegepast (eerst beslissen, zie LET OP).
-- Strikte OSM-toelating: alleen tourism=caravan_site of motorhome=yes/designated (gelijk aan placesQuery in
-- supabase/functions/pipeline/osm.ts, die ook in mapOsm nog eens controleert).
-- LET OP: campings met alleen tourism=camp_site (zonder motorhome-tag) worden hierna niet meer geïmporteerd of
-- ververst. Bestaande plekken blijven staan; er wordt niets verwijderd of offline gehaald.
-- Toepassen samen met een deploy van de edge function `pipeline`.
update public.osm_queries
set template = '[out:json][timeout:110];area["ISO3166-2"="%s"]->.r;(nwr["tourism"="caravan_site"](area.r);nwr["motorhome"~"^(yes|designated)$",i](area.r););out center tags;'
where name = 'places';
