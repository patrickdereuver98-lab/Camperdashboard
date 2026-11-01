-- PDOK en gemeentelijke open data als bron voor de dataketen (besluit eigenaar 31 oktober 2026: tier 2).
--
-- Tier 2 is genoeg om met één bron te promoveren (private.geo_promotie_bezwaar telt toegestane bronnen met tier ≤ 2
-- als sterk). Een master uit OSM (tier 4) of Archies (tier 3) die samenvalt met een PDOK-record komt daarmee door de
-- bronregels.
--
-- Status te_beoordelen: er zijn nog geen endpoints (bronnen.json, lagen leeg). Een mens zet de bron op toegestaan
-- zodra de eerste datasets zijn bekeken; tot dan telt een PDOK-record niet mee (alleen toegestaan telt).
-- Let op: het bronnenbeleid (docs/bronnenbeleid.md §2 en §5) noemt PDOK tier 1. Voor de promotie maakt 1 of 2 geen
-- verschil; zie docs/specs/README.md.
--
-- Terugdraaien: delete from public.geo_bronnen where bron in ('pdok', 'gemeenten_nl');

insert into public.geo_bronnen (bron, naam, tier, status, notitie)
values
  ('pdok', 'PDOK / gemeentelijke open data (data.overheid.nl): camperplaatsen', 2, 'te_beoordelen',
   'Tier 2 volgens besluit eigenaar 31 oktober 2026. Datasets via WFS 2.0, OGC API Features of GeoJSON (tools/data-collectors/pdok.py). Op toegestaan zetten als de eerste lagen zijn bekeken.'),
  ('gemeenten_nl', 'Gemeentelijke open data (data.overheid.nl): losse downloads', 2, 'te_beoordelen',
   'Tier 2, zelfde als pdok. GeoJSON- of CSV-downloads in tools/data-collectors/aanlevering/gemeenten/.')
on conflict (bron) do nothing;
