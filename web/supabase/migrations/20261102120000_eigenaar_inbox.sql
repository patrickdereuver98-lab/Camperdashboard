-- AI Outreach Loop, stap 1 (opdracht 2 november 2026): antwoorden van eigenaren via Resend Inbound komen binnen op
-- /api/webhooks/inbound-email. Gemini leest de mail; deze migratie legt het antwoord vast en zet wijzigingen in de
-- Triage Inbox (updates_queue, bron 'eigenaar'). Zie docs/specs/05-backend-schema.md en README nummer 94.
--
-- De website heeft geen service-role-sleutel: de route geeft het geheim OWNER_INBOX_KEY door en public.log_owner_reply
-- vergelijkt het (als SHA-256) met internal_secrets.owner_inbox_key. Zonder sleutel in de tabel weigert de functie alles.
-- Niets gaat zonder beheerder naar de site: een wijziging wacht op Accepteer in Mission Control. Alleen een bevestiging
-- vanaf het e-mailadres dat al bij de plek staat, zet places.verified_at.

-- ── owner_replies: elk binnengekomen antwoord, met de uitkomst ────────────────────────────────────────────────────
create table if not exists public.owner_replies (
  id uuid primary key default gen_random_uuid(),
  email_id text not null unique check (char_length(email_id) between 1 and 100),
  received_at timestamptz not null default now(),
  from_email text not null check (char_length(from_email) between 3 and 254),
  subject text check (char_length(subject) <= 300),
  place_id uuid references public.places (id) on delete set null,
  matched_by text check (matched_by in ('id', 'email')),
  sender_matches boolean not null default false,
  intent text not null check (intent in ('confirm', 'update', 'unknown')),
  price_eur numeric check (price_eur >= 0 and price_eur <= 500),
  departure_time text check (departure_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  summary text check (char_length(summary) <= 500),
  ai_model text check (char_length(ai_model) <= 80),
  outcome text not null check (outcome in ('queued', 'verified', 'logged', 'no_place', 'ambiguous')),
  queued smallint not null default 0
);
create index if not exists owner_replies_place on public.owner_replies (place_id, received_at desc);
create index if not exists owner_replies_received on public.owner_replies (received_at desc);

alter table public.owner_replies enable row level security;
revoke all on public.owner_replies from anon, public;
revoke truncate, references, trigger on public.owner_replies from authenticated;
grant select, insert, update, delete on public.owner_replies to authenticated;
drop policy if exists "alleen admin" on public.owner_replies;
create policy "alleen admin" on public.owner_replies for all to authenticated
  using ((select public.has_admin_role())) with check ((select public.has_admin_role()));
grant all on public.owner_replies to service_role;

-- ── updates_queue: bron 'eigenaar' en een verwijzing naar het antwoord ────────────────────────────────────────────
alter table public.updates_queue drop constraint if exists updates_queue_source_check;
alter table public.updates_queue add constraint updates_queue_source_check
  check (source in ('doe-mee', 'plekpuls', 'beheer', 'pipeline', 'eigenaar'));
alter table public.updates_queue add column if not exists owner_reply_id uuid references public.owner_replies (id) on delete set null;
create unique index if not exists updates_queue_owner_reply on public.updates_queue (owner_reply_id, field_changed)
  where owner_reply_id is not null;

-- ── log_owner_reply: aanroep van de webhook-route ─────────────────────────────────────────────────────────────────
-- p_reply: { email_id, from, subject, place_id (uit het onderwerp, mag leeg), intent, price, departure_time,
--            summary, ai_model }. Een tweede aanroep met hetzelfde email_id (Resend probeert opnieuw) doet niets.
create or replace function public.log_owner_reply(p_secret text, p_reply jsonb) returns jsonb
 language plpgsql security definer set search_path to ''
as $$
declare
  expected text;
  v_email_id text := left(trim(p_reply ->> 'email_id'), 100);
  v_from text := lower(trim(p_reply ->> 'from'));
  v_intent text := coalesce(p_reply ->> 'intent', 'unknown');
  v_price numeric;
  v_time text := p_reply ->> 'departure_time';
  v_place public.places;
  v_matched text;
  v_n integer;
  v_sender boolean := false;
  v_outcome text;
  v_queued integer := 0;
  v_reply uuid;
begin
  select value into expected from public.internal_secrets where name = 'owner_inbox_key';
  if expected is null or p_secret is null
     or extensions.digest(p_secret, 'sha256') <> extensions.digest(expected, 'sha256') then
    raise exception 'Geen toegang' using errcode = '42501';
  end if;
  if not private.rate_take('owner_inbox', 300, interval '1 hour') then
    raise exception 'Te veel meldingen';
  end if;
  if coalesce(v_email_id, '') = '' or coalesce(v_from, '') !~ '^[^@\s]+@[^@\s]+$' then
    raise exception 'email_id en from zijn verplicht' using errcode = '22023';
  end if;
  if v_intent not in ('confirm', 'update', 'unknown') then v_intent := 'unknown'; end if;

  select id into v_reply from public.owner_replies where email_id = v_email_id;
  if found then return jsonb_build_object('id', v_reply, 'duplicate', true); end if;

  -- Waarden van het model nogmaals streng controleren; twijfel = leeg (nooit data verzinnen)
  if jsonb_typeof(p_reply -> 'price') = 'number' and (p_reply ->> 'price')::numeric between 0 and 500 then
    v_price := round((p_reply ->> 'price')::numeric, 2);
  end if;
  if v_time !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' then v_time := null; end if;

  -- Plek: eerst het id uit het onderwerp, anders het e-mailadres (alleen als precies één plek dat adres heeft)
  if p_reply ->> 'place_id' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    select * into v_place from public.places where id = (p_reply ->> 'place_id')::uuid;
    if found then v_matched := 'id'; end if;
  end if;
  if v_matched is null then
    select count(*) into v_n from public.places where lower(trim(email)) = v_from;
    if v_n = 1 then
      select * into v_place from public.places where lower(trim(email)) = v_from;
      v_matched := 'email';
    end if;
  end if;
  if v_matched is not null then
    v_sender := coalesce(lower(trim(v_place.email)) = v_from, false);
  end if;

  v_outcome := case when v_matched is not null then 'logged' when v_n > 1 then 'ambiguous' else 'no_place' end;

  insert into public.owner_replies (email_id, from_email, subject, place_id, matched_by, sender_matches, intent,
    price_eur, departure_time, summary, ai_model, outcome)
  values (v_email_id, left(v_from, 254), left(p_reply ->> 'subject', 300), v_place.id, v_matched, v_sender, v_intent,
          v_price, v_time, left(p_reply ->> 'summary', 500), left(p_reply ->> 'ai_model', 80), v_outcome)
  returning id into v_reply;

  if v_matched is not null and v_intent = 'update' then
    -- Alleen echte verschillen in de wachtrij; de beheerder beslist met Accepteer of Wijs af
    if v_price is not null and v_place.price_eur is distinct from v_price then
      insert into public.updates_queue (place_id, field_changed, old_value, new_value, source, owner_reply_id)
      values (v_place.id, 'price_eur', to_jsonb(v_place.price_eur), to_jsonb(v_price), 'eigenaar', v_reply);
      v_queued := v_queued + 1;
    end if;
    if v_time is not null then
      if v_place.checkout_until is distinct from v_time then
        insert into public.updates_queue (place_id, field_changed, old_value, new_value, source, owner_reply_id)
        values (v_place.id, 'checkout_until', to_jsonb(v_place.checkout_until), to_jsonb(v_time), 'eigenaar', v_reply);
        v_queued := v_queued + 1;
      end if;
      -- Een uiterlijke vertrektijd betekent een vaste vertrektijd
      if v_place.departure is distinct from 'vast' then
        insert into public.updates_queue (place_id, field_changed, old_value, new_value, source, owner_reply_id)
        values (v_place.id, 'departure', to_jsonb(v_place.departure), '"vast"'::jsonb, 'eigenaar', v_reply);
        v_queued := v_queued + 1;
      end if;
    end if;
    if v_queued > 0 then v_outcome := 'queued'; end if;
  elsif v_matched is not null and v_intent = 'confirm' and v_sender then
    update public.places set verified_at = now() where id = v_place.id;
    v_outcome := 'verified';
  end if;

  update public.owner_replies set outcome = v_outcome, queued = v_queued where id = v_reply;

  -- Logboek zonder e-mailadres
  insert into public.admin_logs (kind, source, status, message, details)
  values ('api', 'inbound-email', case when v_outcome in ('no_place', 'ambiguous') then 'warn' else 'ok' end,
          left(format('Antwoord eigenaar (%s): %s', v_intent, coalesce(v_place.name, 'geen plek gevonden')), 1000),
          jsonb_build_object('reply', v_reply, 'outcome', v_outcome, 'queued', v_queued));

  return jsonb_build_object('id', v_reply, 'place_id', v_place.id, 'matched_by', v_matched, 'intent', v_intent,
                            'outcome', v_outcome, 'queued', v_queued);
end $$;
revoke all on function public.log_owner_reply(text, jsonb) from public;
grant execute on function public.log_owner_reply(text, jsonb) to anon, authenticated;

-- ── Bewaartermijn: antwoorden (met e-mailadres) na 12 maanden weg ─────────────────────────────────────────────────
do $$ begin
  if exists (select 1 from cron.job where jobname = 'owner-replies-retention') then
    perform cron.unschedule('owner-replies-retention');
  end if;
  perform cron.schedule('owner-replies-retention', '23 3 * * *',
    $c$delete from public.owner_replies where received_at < now() - interval '12 months'$c$);
end $$;
