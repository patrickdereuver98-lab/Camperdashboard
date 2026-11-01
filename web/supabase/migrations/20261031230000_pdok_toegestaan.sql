-- pdok en gemeenten_nl op toegestaan (besluit eigenaar 31 oktober 2026, na migratie 20261031220000).
--
-- Er zijn nog geen datasets: bronnen.json heeft pdok op actief met een lege lijst lagen (de run slaat de bron dan over
-- met een waarschuwing) en gemeenten_nl op voorbereid. Zodra een laag of bestand records levert, tellen ze als
-- tier-2-bron in promote_geo_master.
--
-- Terugdraaien: update public.geo_bronnen set status = 'te_beoordelen', beoordeeld_op = null
--               where bron in ('pdok', 'gemeenten_nl');

update public.geo_bronnen
   set status = 'toegestaan',
       beoordeeld_op = now(),
       notitie = notitie || ' Toegestaan door de eigenaar op 31 oktober 2026.'
 where bron in ('pdok', 'gemeenten_nl')
   and status <> 'toegestaan';
