-- Tien scrape-workers van 4 websites per 15 seconden in plaats van drie van 8: sneller (160 per minuut) en lichter per
-- aanroep, want 8 sites tegelijk raakte soms het geheugenplafond van de edge function (WORKER_RESOURCE_LIMIT).
-- cron.schedule met een bestaande naam vervangt de taak.
do $$
declare
  i int;
begin
  for i in 1..10 loop
    perform cron.schedule(
      case when i = 1 then 'scrape' else 'scrape-' || i end,
      '15 seconds',
      $cmd$select private.call_pipeline('{"action":"scrape","n":4}'::jsonb) where exists (select 1 from private.scrape_queue where done_at is null and next_attempt_at <= now() and attempts < 3)$cmd$
    );
  end loop;
end $$;
