-- Test voor migratie 20261031230000_pdok_toegestaan.sql. Draai met run.sh.
do $$
begin
  assert (select count(*) = 2 from public.geo_bronnen
           where bron in ('pdok', 'gemeenten_nl') and tier = 2 and status = 'toegestaan' and beoordeeld_op is not null),
         'pdok en gemeenten_nl niet toegestaan als tier 2';
end $$;
select 'pdok toegestaan: alle tests geslaagd' as uitkomst;
