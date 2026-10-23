-- Eén scrape-taak in plaats van tien. Elke taak die draait, ook zonder werk, schrijft een regel in
-- cron.job_run_details: tien taken van elke 15 seconden gaven 57.600 regels per dag (142 MB op 23 oktober 2026).
-- call_pipeline is asynchroon (pg_net), dus één taak vuurt nu tien aanroepen tegelijk af: zelfde snelheid
-- (10 × 8 websites per 15 seconden), een tiende van de logregels. Zonder werk in de wachtrij gebeurt er niets.
do $$
declare
  i int;
begin
  for i in 2..10 loop
    if exists (select 1 from cron.job where jobname = 'scrape-' || i) then
      perform cron.unschedule('scrape-' || i);
    end if;
  end loop;
  perform cron.schedule(
    'scrape',
    '15 seconds',
    $cmd$select private.call_pipeline('{"action":"scrape","n":8,"background":true}'::jsonb) from generate_series(1, 10) where exists (select 1 from private.scrape_queue where done_at is null and next_attempt_at <= now() and attempts < 3)$cmd$
  );
end $$;
