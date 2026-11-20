-- AI-lezer over alle plekken (opdracht Patrick 20 november 2026, README 140): een aparte ronde haalt alleen de tekst
-- van de website op (actie "ai_text", geen extractie, geen wijziging in places), zodat de AI-lezer niet hoeft te
-- wachten tot de scraper een plek binnen 30 dagen opnieuw leest. Een volledige herlezing zou weer kernfeiten wissen.
--
-- private.text_attempts: per plek de laatste poging (ook mislukt), zodat een onleesbare site niet elke ronde terugkomt.
-- Daarnaast: de AI-lezer elke 5 minuten 4 plekken (was 2 per 10 minuten). Bij de limiet van Gemini (429) wacht hij.

create table if not exists private.text_attempts (
  place_id uuid primary key references public.places (id) on delete cascade,
  tried_at timestamptz not null default now(),
  error text check (char_length(error) <= 300)
);
comment on table private.text_attempts is 'Laatste poging per plek om websitetekst voor de AI-lezer op te halen (actie ai_text)';
alter table private.text_attempts enable row level security;
revoke all on private.text_attempts from public, anon, authenticated;

-- Plekken met een website zonder opgeslagen tekst, die de laatste 30 dagen niet geprobeerd zijn. Geblokkeerd door de
-- eigenaar (sources.stealth.blocked) of verborgen: nooit. Eerst wat het meest oplevert, zoals bij next_ai_batch.
create or replace function private.text_candidates()
 returns setof public.places
 language sql stable security definer set search_path to ''
as $$
  select p.*
    from public.places p
   where p.website ~ '^https?://'
     and p.merged_into is null and p.status <> 'hidden'
     and coalesce((p.sources -> 'stealth' ->> 'blocked')::boolean, false) = false
     and not exists (select 1 from private.page_texts t where t.place_id = p.id)
     and not exists (select 1 from private.text_attempts a where a.place_id = p.id and a.tried_at > now() - interval '30 days');
$$;
revoke all on function private.text_candidates() from public, anon, authenticated;

create or replace function public.next_text_batch(p_limit integer default 4)
 returns table (id uuid, website text)
 language sql security definer set search_path to ''
as $$
  with pick as (
    select c.id, c.website
      from private.text_candidates() c
     order by (c.departure is null) desc, (c.kind = 'camperplaats') desc, (c.price_eur is null) desc, c.id
     limit least(greatest(p_limit, 1), 10)
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

create or replace function public.record_text_attempt(p_id uuid, p_error text) returns void
 language sql security definer set search_path to ''
as $$
  update private.text_attempts set error = left(p_error, 300) where place_id = p_id;
$$;
revoke all on function public.record_text_attempt(uuid, text) from public, anon, authenticated;
grant execute on function public.record_text_attempt(uuid, text) to service_role;

do $$ begin
  perform cron.unschedule('ai-tekst') where exists (select 1 from cron.job where jobname = 'ai-tekst');
  perform cron.schedule('ai-tekst', '*/2 * * * *', $c$select private.call_pipeline('{"action":"ai_text","n":4,"background":true}'::jsonb) where exists (select 1 from private.text_candidates())$c$);
  perform cron.unschedule('ai-lezer') where exists (select 1 from cron.job where jobname = 'ai-lezer');
  perform cron.schedule('ai-lezer', '*/5 * * * *', $c$select private.call_pipeline('{"action":"ai","n":4,"background":true}'::jsonb) where exists (select 1 from private.page_texts t where t.ai_hash is distinct from t.hash and t.ai_tries < 3 and (t.ai_at is null or t.ai_at < now() - interval '1 hour'))$c$);
end $$;
