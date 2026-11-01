-- Test voor migratie 20261031220000_geo_bronnen_pdok.sql: een OSM-master (tier 4, één bron) komt door de bronregels
-- zodra een PDOK-record (tier 2) erbij hoort, maar pas als pdok op toegestaan staat. Draai met run.sh.

do $$
declare r jsonb;
begin
  assert (select tier = 2 and status = 'te_beoordelen' from public.geo_bronnen where bron = 'pdok'), 'pdok niet tier 2 / te_beoordelen';
  assert (select tier = 2 from public.geo_bronnen where bron = 'gemeenten_nl'), 'gemeenten_nl niet tier 2';

  insert into public.geo_bronnen (bron, naam, tier, status) values ('osm', 'OpenStreetMap', 4, 'toegestaan')
  on conflict (bron) do nothing;
  insert into public.geo_master (master_id, geohash, naam, namen, lat, lon, bron_ids, faciliteiten, match_score) values
    ('osm:node/900', 'u1kbz', 'Camperplaats Katerveer', '{Camperplaats Katerveer}', 52.5200, 6.0900,
     '{osm:node/900,pdok:zwolle/1}', '{"capaciteit": 12, "gemeente": "Zwolle"}', 1),
    ('osm:node/901', 'u1kbz', 'Camperplaats De Vecht', '{Camperplaats De Vecht}', 52.5300, 6.1000,
     '{osm:node/901}', '{}', 1);

  -- pdok nog te_beoordelen: telt niet, beide alleen OSM
  r := public.promote_geo_master(true, 5000);
  assert not (r -> 'voorbeelden_nieuw') @> '[{"master_id": "osm:node/900"}]', 'pdok telde al mee vóór toegestaan';

  update public.geo_bronnen set status = 'toegestaan', beoordeeld_op = now() where bron = 'pdok';
  r := public.promote_geo_master(true, 5000);
  assert (r -> 'voorbeelden_nieuw') @> '[{"master_id": "osm:node/900"}]', 'OSM + PDOK kwam niet door de bronregels: ' || r::text;
  assert not (r -> 'voorbeelden_nieuw') @> '[{"master_id": "osm:node/901"}]', 'OSM alleen kwam toch door';

  -- Opruimen voor de volgende testbestanden
  delete from public.geo_master where master_id in ('osm:node/900', 'osm:node/901');
  update public.geo_bronnen set status = 'te_beoordelen', beoordeeld_op = null where bron = 'pdok';
end $$;

select 'pdok als tier-2-bron: alle tests geslaagd' as uitkomst;
