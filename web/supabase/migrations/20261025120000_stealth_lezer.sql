-- Stealth-lezer (bronnenbeleid §3a, besluit eigenaar 25 oktober 2026). Een Python-taak met Scrapling
-- (tools/stealth-lezer) leest websites die de gewone scraper niet of nauwelijks kon lezen: botbeveiliging (403,
-- Cloudflare, captcha), menu en tekst in JavaScript, of een site zonder prijs en vertrektijd. De pipeline kiest de
-- pagina's en leest ze uit (actie stealth_*); deze migratie levert de wachtrij en het wegschrijven.
--
-- Wat de stealth-lezer vond staat in places.sources.stealth ({at, pages, robots_disallows, proxy} of {at, error}).
-- Zolang dat zonder fout is, plant de gewone scraper de plek niet opnieuw in: die zou de site weer niet kunnen lezen
-- en dan velden wissen die de stealth-lezer vond. De stealth-lezer leest zulke plekken zelf eens per 30 dagen.

create table if not exists private.stealth_queue (
  place_id uuid primary key references public.places(id) on delete cascade,
  reason text not null,
  attempts int not null default 0,
  next_attempt_at timestamptz not null default now(),
  done_at timestamptz,
  last_error text,
  created_at timestamptz not null default now()
);
alter table private.stealth_queue enable row level security;

-- Volgorde: onleesbare sites, dan sites met weinig gegevens, dan sites zonder prijs of vertrektijd, dan herlezen
create or replace function private.enqueue_stealth(p_days int default 30, p_limit int default 300)
returns int
language plpgsql
security definer
set search_path to ''
as $$
declare n int;
begin
  -- Vastgelopen leases (taak afgebroken) na een dag opgeven
  update private.stealth_queue
     set done_at = now(), last_error = coalesce(last_error, 'Afgebroken zonder resultaat')
   where done_at is null and attempts >= 3 and next_attempt_at < now() - interval '1 day';

  insert into private.stealth_queue (place_id, reason)
  select id, reason from (
    select p.id,
           case when p.sources ? 'website_error' then 'onleesbaar'
                when coalesce(jsonb_array_length(case when jsonb_typeof(p.sources->'website_fields') = 'array'
                                                      then p.sources->'website_fields' end), 0) < 3 then 'weinig'
                when p.sources ? 'stealth' then 'herlezen'
                else 'kernfeit' end as reason
      from public.places p
     where p.website is not null
       and p.merged_into is null
       and p.last_scraped_at is not null
       and not coalesce((p.sources->'stealth'->>'blocked')::boolean, false)
       and (p.sources->'stealth' is null or (p.sources->'stealth'->>'at')::timestamptz < now() - make_interval(days => p_days))
       and (p.sources ? 'website_error'
            or p.sources ? 'stealth'
            or coalesce(jsonb_array_length(case when jsonb_typeof(p.sources->'website_fields') = 'array'
                                                then p.sources->'website_fields' end), 0) < 3
            or p.price_eur is null
            or p.departure is null)
       and not exists (select 1 from private.stealth_queue q where q.place_id = p.id and q.done_at is null)
  ) c
  order by case reason when 'onleesbaar' then 0 when 'weinig' then 1 when 'kernfeit' then 2 else 3 end
  limit p_limit
  on conflict (place_id) do update
    set reason = excluded.reason, done_at = null, attempts = 0, next_attempt_at = now(), last_error = null
    where private.stealth_queue.done_at is not null;
  get diagnostics n = row_count;
  return n;
end $$;

-- Lease van een uur: de lezer wacht 5 s per verzoek, dus één plek duurt al snel een minuut
create or replace function public.next_stealth_batch(p_limit int)
returns table(id uuid, website text, name text, town text, reason text)
language sql
security definer
set search_path to ''
as $$
  with picked as (
    select q.place_id from private.stealth_queue q
     where q.done_at is null and q.next_attempt_at <= now() and q.attempts < 3
     order by q.attempts, q.next_attempt_at
     limit p_limit for update skip locked
  ), upd as (
    update private.stealth_queue q set next_attempt_at = now() + interval '1 hour', attempts = q.attempts + 1
      from picked where q.place_id = picked.place_id returning q.place_id, q.reason
  )
  select p.id, p.website, p.name, p.town, upd.reason from public.places p join upd on upd.place_id = p.id;
$$;

-- Resultaat wegschrijven via apply_scrape (zelfde regels: beheer gaat voor, kernvelden niet wissen bij een haperende
-- site). Bij een fout: na drie pogingen opgeven en vastleggen in sources.stealth, dan neemt de gewone scraper het weer.
-- Een fout met "geblokkeerd:" ervoor (de eigenaar vroeg ons te stoppen) zet de plek vast op geblokkeerd.
create or replace function public.apply_stealth(p_id uuid, p_data jsonb, p_error text default null, p_meta jsonb default '{}'::jsonb)
returns void
language plpgsql
security definer
set search_path to ''
as $$
begin
  if p_error is not null then
    update private.stealth_queue set last_error = left(p_error, 500) where place_id = p_id;
    if p_error like 'geblokkeerd:%' or (select attempts from private.stealth_queue where place_id = p_id) >= 3 then
      update private.stealth_queue set done_at = now() where place_id = p_id;
      update public.places
         set sources = coalesce(sources, '{}'::jsonb) || jsonb_build_object('stealth', jsonb_build_object(
               'at', now(), 'error', left(p_error, 200), 'blocked', p_error like 'geblokkeerd:%'))
       where id = p_id;
    end if;
    return;
  end if;

  perform public.apply_scrape(p_id, p_data, null);
  update public.places
     set sources = sources || jsonb_build_object('stealth', jsonb_build_object('at', now()) || coalesce(p_meta, '{}'::jsonb))
   where id = p_id;
  update private.stealth_queue set done_at = now(), last_error = null where place_id = p_id;
end $$;

-- De gewone scraper slaat plekken over die de stealth-lezer zonder fout las (zie boven)
create or replace function private.enqueue_stale_scrape(p_days integer default 30, p_limit integer default 10)
returns integer
language plpgsql
security definer
set search_path to ''
as $$
declare n int;
begin
  update private.scrape_queue
     set done_at = now(), last_error = coalesce(last_error, 'Afgebroken zonder resultaat')
   where done_at is null and attempts >= 3 and next_attempt_at < now() - interval '1 hour';

  insert into private.scrape_queue (place_id)
  select id from public.places
   where website is not null
     and (last_scraped_at is null or last_scraped_at < now() - make_interval(days => p_days))
     and not (sources ? 'stealth' and not (sources->'stealth' ? 'error'))
     and not exists (select 1 from private.scrape_queue q where q.place_id = places.id and q.done_at is null)
   order by last_scraped_at nulls first
   limit p_limit
  on conflict (place_id) do update set done_at = null, attempts = 0, next_attempt_at = now(), last_error = null
   where private.scrape_queue.done_at is not null;
  get diagnostics n = row_count;
  return n;
end $$;

revoke all on function private.enqueue_stealth(int, int) from public, anon, authenticated;
revoke all on function public.next_stealth_batch(int) from public, anon, authenticated;
revoke all on function public.apply_stealth(uuid, jsonb, text, jsonb) from public, anon, authenticated;
grant execute on function public.next_stealth_batch(int) to service_role;
grant execute on function public.apply_stealth(uuid, jsonb, text, jsonb) to service_role;

-- Elke dag de wachtrij aanvullen (05:23, na retention en bron-opschonen)
do $$
begin
  if exists (select 1 from cron.job where jobname = 'stealth-enqueue') then
    perform cron.unschedule('stealth-enqueue');
  end if;
  perform cron.schedule('stealth-enqueue', '23 5 * * *', $cmd$select private.enqueue_stealth(30, 300)$cmd$);
end $$;
