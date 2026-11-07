-- Websites periodiek opnieuw lezen (besluit B12, open punt 33).
-- enqueue_scrape(true) plant alleen plekken die nog nooit gelezen zijn; daardoor verouderen vertrektijden en prijzen
-- ongemerkt. Deze functie zet elk half uur de 10 plekken die het langst niet gelezen zijn (en minstens 30 dagen) terug
-- in de wachtrij. Bij ±3.200 websites is elke plek zo eens per maand aan de beurt, zonder pieken op externe sites.
-- Wat beheer heeft ingevuld blijft staan: de pipeline overschrijft velden uit sources.beheer niet.

create or replace function private.enqueue_stale_scrape(p_days int default 30, p_limit int default 10)
 returns integer language plpgsql security definer set search_path to ''
as $$
declare n int;
begin
  insert into private.scrape_queue (place_id)
  select id from public.places
   where website is not null and last_scraped_at < now() - make_interval(days => p_days)
   order by last_scraped_at
   limit p_limit
  on conflict (place_id) do update set done_at = null, attempts = 0, next_attempt_at = now(), last_error = null
   where private.scrape_queue.done_at is not null or private.scrape_queue.attempts >= 3;
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function private.enqueue_stale_scrape(int, int) from public, anon, authenticated;

do $$ begin
  if exists (select 1 from cron.job where jobname = 'scrape-refresh') then perform cron.unschedule('scrape-refresh'); end if;
  perform cron.schedule('scrape-refresh', '7,37 * * * *', 'select private.enqueue_stale_scrape()');
end $$;

-- Terugdraaien:
--   select cron.unschedule('scrape-refresh');
--   drop function private.enqueue_stale_scrape(int, int);
