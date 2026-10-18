-- De pipeline antwoordt bij "background": true meteen en scrapet op de achtergrond (EdgeRuntime.waitUntil). pg_net wacht
-- dan niet meer op de traagste site van een batch; de vorige run haalde daardoor maar 33 sites per minuut. Tien workers
-- van 8 sites per 15 seconden: gemeten 338 per minuut (18 okt), zonder geheugenfouten, elk een andere site.
do $$
declare
  i int;
begin
  for i in 1..10 loop
    perform cron.schedule(
      case when i = 1 then 'scrape' else 'scrape-' || i end,
      '15 seconds',
      $cmd$select private.call_pipeline('{"action":"scrape","n":8,"background":true}'::jsonb) where exists (select 1 from private.scrape_queue where done_at is null and next_attempt_at <= now() and attempts < 3)$cmd$
    );
  end loop;
end $$;
