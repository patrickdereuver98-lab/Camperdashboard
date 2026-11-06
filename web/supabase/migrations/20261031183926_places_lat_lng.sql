-- Index op places (lat, lng) voor het koppelen in de dataketen (31 oktober 2026).
--
-- private.geo_bestaande_plek en promote_geo_master zoeken per master plekken binnen een vak van ±200 m op lat en
-- lng. Zonder index las elke master de hele tabel places: de proef van Dataketen run #6 (4.523 open masters) duurde
-- 11,9 s en brak af op de statement_timeout van 8 s (authenticator). Met deze index 1,7 s (gemeten op het live schema
-- in een transactie die is teruggedraaid).
--
-- Terugdraaien: drop index public.places_lat_lng;

create index if not exists places_lat_lng on public.places (lat, lng) where merged_into is null;
