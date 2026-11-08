-- Live migratie 20261018211809 (pdok_adres_cron), letterlijk uit supabase_migrations.schema_migrations.statements
-- (opgehaald 8 november 2026, review R5). Niet wijzigen: dit is de geschiedenis zoals live toegepast.

select cron.schedule('pdok-adres', '* * * * *', $$
  select private.call_pipeline('{"action":"adres","n":40,"background":true}'::jsonb)
   where exists (select 1 from public.places where merged_into is null and (street is null or postcode is null)
                  and not (coalesce(sources, '{}'::jsonb) ? 'pdok'))
$$);
