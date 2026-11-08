-- Cron-taken van live op 2026-11-08 (zonder geheimen: de opdrachten lezen sleutels uit private.secrets).
-- Na de nulmigratie uitvoeren op een nieuw project; niet in een testdatabase.
select cron.schedule('crowd-retention', '17 3 * * *', 'delete from public.crowd_reports where created_at < now() - interval ''30 days''');
select cron.schedule('departure-recheck', '41 3 * * *', '
  update public.places set departure_check = null, departure_checked_at = null, departure_checked_by = null
  where departure_check is not null and departure_checked_at < now() - interval ''1 year''
');
select cron.schedule('discover', '* * * * *', 'select private.call_discover(6) where exists (select 1 from public.places p where p.website is null and p.status in (''draft'',''published'') and coalesce(p.name_is_generic,false) = false and p.name is not null and not (coalesce(p.sources,''{}''::jsonb) ? ''discovery''))');
select cron.schedule('handmatig-markeren', '23 6 * * *', 'select private.markeer_handmatig()');
select cron.schedule('marketing-opruimen', '41 3 * * *', 'select private.marketing_cleanup()');
select cron.schedule('onbereikbaar-opruimen', '13 6 * * *', 'select private.verwijder_onbereikbare_plekken(false)');
select cron.schedule('ops-probe', '*/10 * * * *', 'select private.ops_probe()');
select cron.schedule('osm-collect', '* * * * *', 'select private.collect_osm()');
select cron.schedule('osm-regions', '*/3 * * * *', 'select private.next_osm_region()');
select cron.schedule('osm-staging', '* * * * *', 'select public.process_osm_staging(300) where exists (select 1 from public.osm_staging where processed_at is null)');
select cron.schedule('owner-replies-retention', '23 3 * * *', 'delete from public.owner_replies where received_at < now() - interval ''12 months''');
select cron.schedule('pdok-adres', '* * * * *', '
  select private.call_pipeline(''{"action":"adres","n":40,"background":true}''::jsonb)
   where exists (select 1 from public.places where merged_into is null and (street is null or postcode is null)
                  and not (coalesce(sources, ''{}''::jsonb) ? ''pdok''))
');
select cron.schedule('retention', '17 3 * * *', 'select private.apply_retention()');
select cron.schedule('retention-cron-log', '17 3 * * *', 'select 1 where 1=0');
select cron.schedule('scrape', '15 seconds', 'select private.call_pipeline(''{"action":"scrape","n":8,"background":true}''::jsonb) from generate_series(1, 10) where exists (select 1 from private.scrape_queue where done_at is null and next_attempt_at <= now() and attempts < 3)');
select cron.schedule('scrape-enqueue', '*/30 * * * *', 'select public.enqueue_scrape(true)');
select cron.schedule('scrape-refresh', '7,37 * * * *', 'select private.enqueue_stale_scrape()');
select cron.schedule('stealth-enqueue', '23 5 * * *', 'select private.enqueue_stealth(30, 300)');
