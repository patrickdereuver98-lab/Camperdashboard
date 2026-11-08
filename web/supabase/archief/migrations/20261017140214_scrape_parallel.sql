-- Drie scrape-workers naast elkaar in plaats van één: elk haalt 8 websites per 15 seconden. next_scrape_batch pakt
-- rijen met "for update skip locked", dus twee workers lezen nooit dezelfde plek. Elke worker leest andere sites, dus
-- per website blijft het één bezoek tegelijk.
select cron.schedule('scrape-2', '15 seconds', $$select private.call_pipeline('{"action":"scrape","n":8}'::jsonb) where exists (select 1 from private.scrape_queue where done_at is null and next_attempt_at <= now() and attempts < 3)$$);
select cron.schedule('scrape-3', '15 seconds', $$select private.call_pipeline('{"action":"scrape","n":8}'::jsonb) where exists (select 1 from private.scrape_queue where done_at is null and next_attempt_at <= now() and attempts < 3)$$);
