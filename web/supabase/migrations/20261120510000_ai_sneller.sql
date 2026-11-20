-- AI-lezer sneller (opdracht Patrick 20 november 2026: "elke plek moet er langs, dus we moeten echt sneller").
-- De Gemini-sleutel haalde 40 aanroepen per minuut zonder 429; de edge function leest nu 5 plekken tegelijk.
-- - next_ai_batch: tot 30 plekken per ronde (was 10); cron ai-lezer elke minuut 20 (±1.200 per uur).
-- - next_text_batch: tot 12 plekken per ronde (was 10); cron ai-tekst elke minuut 10 (±600 per uur, ±2.900 in ±5 uur).
-- Bij een 429 wacht de AI-lezer de lease van een uur af en telt de poging niet.

create or replace function public.next_ai_batch(p_limit integer default 2)
 returns table (id uuid, name text, kind text, text text, hash text)
 language sql security definer set search_path to ''
as $$
  with pick as (
    select t.place_id
      from private.page_texts t
      join public.places p on p.id = t.place_id
     where t.ai_hash is distinct from t.hash
       and t.ai_tries < 3
       and (t.ai_at is null or t.ai_at < now() - interval '1 hour')
       and p.merged_into is null and p.status <> 'hidden'
     order by (p.departure is null) desc, (p.kind = 'camperplaats') desc, (p.price_eur is null) desc, t.stored_at
     limit least(greatest(p_limit, 1), 30)
     for update of t skip locked
  )
  update private.page_texts t
     set ai_at = now(), ai_tries = t.ai_tries + 1
    from pick, public.places p
   where t.place_id = pick.place_id and p.id = t.place_id
  returning t.place_id, p.name, p.kind, t.text, t.hash;
$$;
revoke all on function public.next_ai_batch(integer) from public, anon, authenticated;
grant execute on function public.next_ai_batch(integer) to service_role;

create or replace function public.next_text_batch(p_limit integer default 4)
 returns table (id uuid, website text)
 language sql security definer set search_path to ''
as $$
  with pick as (
    select c.id, c.website
      from private.text_candidates() c
     order by (c.departure is null) desc, (c.kind = 'camperplaats') desc, (c.price_eur is null) desc, c.id
     limit least(greatest(p_limit, 1), 12)
  ), lease as (
    insert into private.text_attempts as a (place_id, tried_at)
    select pick.id, now() from pick
    on conflict (place_id) do update set tried_at = now(), error = null
    returning a.place_id
  )
  select pick.id, pick.website from pick join lease on lease.place_id = pick.id;
$$;
revoke all on function public.next_text_batch(integer) from public, anon, authenticated;
grant execute on function public.next_text_batch(integer) to service_role;

do $$ begin
  perform cron.unschedule('ai-lezer') where exists (select 1 from cron.job where jobname = 'ai-lezer');
  perform cron.schedule('ai-lezer', '* * * * *', $c$select private.call_pipeline('{"action":"ai","n":20,"background":true}'::jsonb) where exists (select 1 from private.page_texts t where t.ai_hash is distinct from t.hash and t.ai_tries < 3 and (t.ai_at is null or t.ai_at < now() - interval '1 hour'))$c$);
  perform cron.unschedule('ai-tekst') where exists (select 1 from cron.job where jobname = 'ai-tekst');
  perform cron.schedule('ai-tekst', '* * * * *', $c$select private.call_pipeline('{"action":"ai_text","n":10,"background":true}'::jsonb) where exists (select 1 from private.text_candidates())$c$);
end $$;
