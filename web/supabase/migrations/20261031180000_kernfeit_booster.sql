-- Kernfeit-booster (opdracht eigenaar 31 oktober 2026, B1 en B3).
--
-- B1. Plekken zonder vertrekregel (departure is null) worden tijdelijk elke 14 dagen opnieuw gelezen in plaats van
--     elke 30, door de gewone scraper én de stealth-lezer, en gaan in de wachtrij vóór de rest. De batches geven een
--     kolom `focus` mee: dan leest de scraper eerst huisregels, FAQ, reglement, praktisch en voorwaarden, en tot 4 PDF's
--     (pages.ts FOCUS_SUBPAGES en FOCUS_PDFS; bij de stealth-lezer binnen de 7 pagina's van bronnenbeleid §3a).
--     Terug naar 30 dagen: in beide enqueue-functies `least(p_days, 14)` vervangen door `p_days`.
-- B3. manual_review.requires_manual_review: de website is ook met de stealth-lezer niet te lezen en beheer heeft de
--     plek nog niet ingevuld. Beheer ziet die plekken bovenaan (Beheer, Plekken). Elke dag om 06:23 bijgewerkt, na de stealth-
--     wachtrij (05:23) en het opruimen van onbereikbare plekken zonder gegevens (06:13, migratie 20261025160000).
--     Zodra beheer een veld invult (sources.beheer), gaat de markering er vanzelf af.

-- ── B1: vaker en eerst ───────────────────────────────────────────────────────

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
     and merged_into is null
     and (last_scraped_at is null
          or last_scraped_at < now() - make_interval(days => case when departure is null then least(p_days, 14) else p_days end))
     and not (sources ? 'stealth' and not (sources->'stealth' ? 'error'))
     and not exists (select 1 from private.scrape_queue q where q.place_id = places.id and q.done_at is null)
   order by (departure is null) desc, last_scraped_at nulls first
   limit p_limit
  on conflict (place_id) do update set done_at = null, attempts = 0, next_attempt_at = now(), last_error = null
   where private.scrape_queue.done_at is not null;
  get diagnostics n = row_count;
  return n;
end $$;

create or replace function private.enqueue_stealth(p_days integer default 30, p_limit integer default 300)
returns integer
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
                when p.departure is null then 'kernfeit'
                when p.sources ? 'stealth' then 'herlezen'
                else 'kernfeit' end as reason
      from public.places p
     where p.website is not null
       and p.merged_into is null
       and p.last_scraped_at is not null
       and not coalesce((p.sources->'stealth'->>'blocked')::boolean, false)
       and (p.sources->'stealth' is null
            or (p.sources->'stealth'->>'at')::timestamptz
               < now() - make_interval(days => case when p.departure is null then least(p_days, 14) else p_days end))
       and (p.sources ? 'website_error'
            or p.sources ? 'stealth'
            or coalesce(jsonb_array_length(case when jsonb_typeof(p.sources->'website_fields') = 'array'
                                                then p.sources->'website_fields' end), 0) < 3
            or p.price_eur is null
            or p.departure is null)
       and not exists (select 1 from private.stealth_queue q where q.place_id = p.id and q.done_at is null)
  ) c
  order by case reason when 'onleesbaar' then 0 when 'kernfeit' then 1 when 'weinig' then 2 else 3 end
  limit p_limit
  on conflict (place_id) do update
    set reason = excluded.reason, done_at = null, attempts = 0, next_attempt_at = now(), last_error = null
    where private.stealth_queue.done_at is not null;
  get diagnostics n = row_count;
  return n;
end $$;

-- De batches geven `focus` mee (nieuwe kolom: eerst weghalen, het resultaattype verandert)
drop function if exists public.next_scrape_batch(integer);
create function public.next_scrape_batch(p_limit integer)
returns table (id uuid, website text, name text, town text, focus boolean)
language sql
security definer
set search_path to ''
as $$
  with picked as (
    select q.place_id from private.scrape_queue q
     where q.done_at is null and q.next_attempt_at <= now() and q.attempts < 3
     order by q.attempts, q.next_attempt_at
     limit p_limit for update skip locked
  ), upd as (
    update private.scrape_queue q set next_attempt_at = now() + interval '20 minutes', attempts = q.attempts + 1
      from picked where q.place_id = picked.place_id returning q.place_id
  )
  select p.id, p.website, p.name, p.town, p.departure is null from public.places p join upd on upd.place_id = p.id;
$$;

drop function if exists public.next_stealth_batch(integer);
create function public.next_stealth_batch(p_limit integer)
returns table (id uuid, website text, name text, town text, reason text, focus boolean)
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
  select p.id, p.website, p.name, p.town, upd.reason, p.departure is null from public.places p join upd on upd.place_id = p.id;
$$;

drop function if exists public.next_stealth_batch(integer, integer, integer);
create function public.next_stealth_batch(p_limit integer, p_shard integer, p_shards integer)
returns table (id uuid, website text, name text, town text, reason text, focus boolean)
language sql
security definer
set search_path to ''
as $$
  with picked as (
    select q.place_id from private.stealth_queue q
      join public.places p on p.id = q.place_id
     where q.done_at is null and q.next_attempt_at <= now() and q.attempts < 3
       and abs(hashtext(lower(regexp_replace(coalesce(p.website, ''), '^[a-z]+://(www\.)?([^/:?#]+).*$', '\2', 'i'))))
           % greatest(p_shards, 1) = p_shard
     order by q.attempts, q.next_attempt_at
     limit p_limit for update of q skip locked
  ), upd as (
    update private.stealth_queue q set next_attempt_at = now() + interval '1 hour', attempts = q.attempts + 1
      from picked where q.place_id = picked.place_id returning q.place_id, q.reason
  )
  select p.id, p.website, p.name, p.town, upd.reason, p.departure is null from public.places p join upd on upd.place_id = p.id;
$$;

revoke all on function public.next_scrape_batch(integer) from public, anon, authenticated;
revoke all on function public.next_stealth_batch(integer) from public, anon, authenticated;
revoke all on function public.next_stealth_batch(integer, integer, integer) from public, anon, authenticated;
grant execute on function public.next_scrape_batch(integer) to service_role;
grant execute on function public.next_stealth_batch(integer) to service_role;
grant execute on function public.next_stealth_batch(integer, integer, integer) to service_role;

-- ── B3: handmatig nakijken ───────────────────────────────────────────────────
-- Een eigen tabel in plaats van een kolom op places: een update van places zet updated_at ("Laatste update" op de
-- site) en rekent de status opnieuw uit, en dat mag een markering voor beheer niet doen.

create table if not exists public.manual_review (
  place_id uuid primary key references public.places (id) on delete cascade,
  requires_manual_review boolean not null default true,
  reden text not null,
  sinds timestamptz not null default now()
);
alter table public.manual_review enable row level security;
revoke all on public.manual_review from anon, authenticated;
grant select, insert, update, delete on public.manual_review to service_role;

create or replace function private.markeer_handmatig()
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare n_erbij int; n_eraf int;
begin
  drop table if exists _doel;
  create temp table _doel on commit drop as
  select p.id, 'website ook met de stealth-lezer onleesbaar: ' || left(coalesce(p.sources->'stealth'->>'error', ''), 120) as reden
    from public.places p
   where p.merged_into is null
     and p.website is not null
     and p.sources->'stealth' ? 'error'
     and coalesce(p.sources->'beheer', '{}'::jsonb) in ('{}'::jsonb, '[]'::jsonb)
     and not exists (select 1 from private.stealth_queue q where q.place_id = p.id and q.done_at is null);

  delete from public.manual_review m where not exists (select 1 from _doel d where d.id = m.place_id);
  get diagnostics n_eraf = row_count;
  insert into public.manual_review (place_id, reden) select id, reden from _doel
  on conflict (place_id) do update set reden = excluded.reden;
  get diagnostics n_erbij = row_count;
  return jsonb_build_object('gemarkeerd', (select count(*) from public.manual_review), 'eraf', n_eraf);
end $$;
revoke all on function private.markeer_handmatig() from public, anon, authenticated;

-- Voor Beheer, Plekken: de gemarkeerde plekken bovenaan
create or replace function public.admin_manual_review()
returns table (place_id uuid, reden text, sinds timestamptz)
language plpgsql
stable
security definer
set search_path to ''
as $$
begin
  if not public.is_admin() then raise exception 'Geen toegang'; end if;
  return query select m.place_id, m.reden, m.sinds from public.manual_review m where m.requires_manual_review order by m.sinds;
end $$;
revoke all on function public.admin_manual_review() from public, anon;
grant execute on function public.admin_manual_review() to authenticated;

select private.markeer_handmatig();

do $$
begin
  if exists (select 1 from cron.job where jobname = 'handmatig-markeren') then perform cron.unschedule('handmatig-markeren'); end if;
  perform cron.schedule('handmatig-markeren', '23 6 * * *', 'select private.markeer_handmatig()');
end $$;
