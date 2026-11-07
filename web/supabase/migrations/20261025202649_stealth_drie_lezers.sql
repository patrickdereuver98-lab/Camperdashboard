-- Stealth-lezer met meerdere lezers tegelijk (besluit eigenaar 25 oktober 2026: "graag", drie keer zo snel).
-- Elke lezer krijgt een vast deel van de websites, ingedeeld op hostnaam (zonder www.). Zo komen twee lezers nooit op
-- dezelfde host en blijft de grens van één verzoek per 5 seconden per host (bronnenbeleid §3a) gelden.
-- De versie met één argument blijft bestaan voor een lezer zonder indeling.

create or replace function public.next_stealth_batch(p_limit int, p_shard int, p_shards int)
returns table(id uuid, website text, name text, town text, reason text)
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
  select p.id, p.website, p.name, p.town, upd.reason from public.places p join upd on upd.place_id = p.id;
$$;

revoke all on function public.next_stealth_batch(int, int, int) from public, anon, authenticated;
grant execute on function public.next_stealth_batch(int, int, int) to service_role;
