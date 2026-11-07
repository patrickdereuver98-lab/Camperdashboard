-- R12 en R26 (review november 2026; SEC-05, DATA-08, DATA-09, DATA-14).
--
-- 1. Antwoorden van eigenaren (log_owner_reply). Het afzenderadres van een mail is niet bewezen (geen SPF/DKIM in de
--    webhook) en places.email is openbaar, dus iedereen kan een mail "van de eigenaar" sturen. Daarom:
--      * bron 'eigenaar' alleen als het afzenderadres gelijk is aan places.email, anders 'mail (onbevestigd)';
--      * een bevestiging ("klopt nog") zet places.verified_at niet meer zelf. Hij komt als voorstel (veld
--        `verified_at`) in de Triage Inbox; de beheerder bevestigt met Accepteer.
-- 2. Accepteren in de Triage Inbox (admin_apply_update):
--      * vertrekregel (`departure`) en tijd (`checkout_until`) van dezelfde inzending of hetzelfde antwoord gaan samen,
--        in één transactie (accepteren of afwijzen van de een neemt de ander mee);
--      * een geaccepteerde vertrekregel krijgt een controledatum (departure_checked_at, door 'beheer', of 'eigenaar'
--        als alle voorstellen van het bekende adres van de eigenaar kwamen). Een vaste vertrektijd telt dan als
--        bevestigd; "geen vaste tijd" en "per 24 uur" blijven op Vertrektijden staan om de bron te controleren
--        (kernbelofte: Zonder vertrektijd alleen na controle van de bron);
--      * `verified_at` (bevestiging van een eigenaar) zet places.verified_at op nu, zonder merkteken van beheer.
--
-- Uitrollen: los van de site te doen; de oude site werkt ermee (zelfde functienamen en argumenten).

-- ── Bron 'mail (onbevestigd)' ───────────────────────────────────────────────────────────────────────────────────────
alter table public.updates_queue drop constraint if exists updates_queue_source_check;
alter table public.updates_queue add constraint updates_queue_source_check
  check (source in ('doe-mee', 'plekpuls', 'beheer', 'pipeline', 'eigenaar', 'mail (onbevestigd)'));

-- ── log_owner_reply ─────────────────────────────────────────────────────────────────────────────────────────────────
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
  v_source text;
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
  -- Het afzenderadres is niet bewezen: alleen het bekende adres van de plek heet 'eigenaar'
  v_source := case when v_sender then 'eigenaar' else 'mail (onbevestigd)' end;

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
      values (v_place.id, 'price_eur', to_jsonb(v_place.price_eur), to_jsonb(v_price), v_source, v_reply);
      v_queued := v_queued + 1;
    end if;
    if v_time is not null then
      if v_place.checkout_until is distinct from v_time then
        insert into public.updates_queue (place_id, field_changed, old_value, new_value, source, owner_reply_id)
        values (v_place.id, 'checkout_until', to_jsonb(v_place.checkout_until), to_jsonb(v_time), v_source, v_reply);
        v_queued := v_queued + 1;
      end if;
      -- Een uiterlijke vertrektijd betekent een vaste vertrektijd
      if v_place.departure is distinct from 'vast' then
        insert into public.updates_queue (place_id, field_changed, old_value, new_value, source, owner_reply_id)
        values (v_place.id, 'departure', to_jsonb(v_place.departure), '"vast"'::jsonb, v_source, v_reply);
        v_queued := v_queued + 1;
      end if;
    end if;
  elsif v_matched is not null and v_intent = 'confirm' then
    -- Bevestiging via de inbox: de beheerder leest de mail en zet de controledatum met Accepteer
    insert into public.updates_queue (place_id, field_changed, old_value, new_value, source, owner_reply_id)
    values (v_place.id, 'verified_at', to_jsonb(v_place.verified_at), to_jsonb(now()), v_source, v_reply);
    v_queued := 1;
  end if;
  if v_queued > 0 then v_outcome := 'queued'; end if;

  update public.owner_replies set outcome = v_outcome, queued = v_queued where id = v_reply;

  -- Logboek zonder e-mailadres
  insert into public.admin_logs (kind, source, status, message, details)
  values ('api', 'inbound-email', case when v_outcome in ('no_place', 'ambiguous') then 'warn' else 'ok' end,
          left(format('Antwoord eigenaar (%s, %s): %s', v_intent, v_source, coalesce(v_place.name, 'geen plek gevonden')), 1000),
          jsonb_build_object('reply', v_reply, 'outcome', v_outcome, 'queued', v_queued, 'sender_matches', v_sender));

  return jsonb_build_object('id', v_reply, 'place_id', v_place.id, 'matched_by', v_matched, 'intent', v_intent,
                            'outcome', v_outcome, 'queued', v_queued, 'source', v_source);
end $$;
revoke all on function public.log_owner_reply(text, jsonb) from public;
grant execute on function public.log_owner_reply(text, jsonb) to anon, authenticated;

-- ── Eén voorstel toepassen (zonder rechtencontrole: alleen via de admin-functies hieronder) ─────────────────────────
create or replace function private.apply_queue_row(u public.updates_queue) returns void
 language plpgsql security definer set search_path to ''
as $$
declare rec public.places;
begin
  if u.field_changed = 'verified_at' then
    -- Bevestiging van een eigenaar: alleen de controledatum, geen merkteken van beheer
    update public.places set verified_at = now() where id = u.place_id;
    update public.owner_replies set outcome = 'verified' where id = u.owner_reply_id;
  else
    if not (u.field_changed = any (private.queue_fields())) then
      raise exception 'Veld % kan niet via de inbox worden aangepast', u.field_changed;
    end if;
    rec := jsonb_populate_record(null::public.places, jsonb_build_object(u.field_changed, u.new_value));
    execute format('update public.places set %1$I = ($1).%1$I where id = $2', u.field_changed) using rec, u.place_id;
    perform public.admin_mark_beheer(u.place_id, array[u.field_changed]);
  end if;
  update public.updates_queue set status = 'approved', decided_by = auth.uid(), decided_at = now() where id = u.id;
  insert into public.audit_log (actor, actor_email, action, entity, entity_id, details)
  values (auth.uid(), (select email from auth.users where id = auth.uid()), 'update_accepted', 'places', u.place_id::text,
          jsonb_build_object('veld', u.field_changed, 'was', u.old_value, 'nieuw', u.new_value, 'update', u.id,
                             'bron', u.source, 'ai_score', u.ai_score));
end $$;
revoke all on function private.apply_queue_row(public.updates_queue) from public, anon, authenticated;

/** Controledatum van de vertrekregel na een geaccepteerde wijziging (zie de uitleg bovenaan) */
create or replace function private.mark_departure_checked(p_place uuid, p_by text) returns void
 language plpgsql security definer set search_path to ''
as $$
begin
  -- In een aparte update: de trigger places_before_write wist de controle als de regel verandert zonder nieuwe datum
  update public.places
     set departure_checked_at = now(),
         departure_checked_by = p_by,
         departure_check = case when departure = 'vast' then 'bevestigd' else null end
   where id = p_place;
end $$;
revoke all on function private.mark_departure_checked(uuid, text) from public, anon, authenticated;

/** Ids die samen beslist worden: regel en tijd van dezelfde inzending of hetzelfde antwoord, anders alleen deze */
create or replace function private.queue_group(u public.updates_queue) returns uuid[]
 language sql stable security definer set search_path to ''
as $$
  select case when u.field_changed in ('departure', 'checkout_until') then (
    select array_agg(q.id order by q.field_changed desc)
      from public.updates_queue q
     where q.status = 'pending' and q.place_id = u.place_id and q.field_changed in ('departure', 'checkout_until')
       and (q.id = u.id
            or (u.submission_id is not null and q.submission_id = u.submission_id)
            or (u.owner_reply_id is not null and q.owner_reply_id = u.owner_reply_id)))
  else array[u.id] end;
$$;
revoke all on function private.queue_group(public.updates_queue) from public, anon, authenticated;

-- ── Accepteren ──────────────────────────────────────────────────────────────────────────────────────────────────────
create or replace function public.admin_apply_update(p_id uuid) returns jsonb
 language plpgsql security definer set search_path to ''
as $$
declare
  u public.updates_queue;
  g public.updates_queue;
  v_ids uuid[];
  v_departure boolean := false;
  v_owner boolean := true;
  v_subs uuid[] := '{}';
  s uuid;
begin
  if not public.has_admin_role() then raise exception 'Geen toegang' using errcode = '42501'; end if;
  select * into u from public.updates_queue where id = p_id for update;
  if not found then raise exception 'Onbekende update'; end if;
  if u.status <> 'pending' then raise exception 'Deze update is al afgehandeld'; end if;

  v_ids := private.queue_group(u);
  -- Eerst de regel, dan de tijd (de tijd hoort bij een vaste regel)
  for g in select * from public.updates_queue where id = any (v_ids) and status = 'pending'
           order by (field_changed = 'departure') desc for update loop
    perform private.apply_queue_row(g);
    if g.field_changed in ('departure', 'checkout_until') then
      v_departure := true;
      v_owner := v_owner and g.source = 'eigenaar';
    end if;
    if g.submission_id is not null and not (g.submission_id = any (v_subs)) then v_subs := v_subs || g.submission_id; end if;
  end loop;

  if v_departure then
    perform private.mark_departure_checked(u.place_id, case when v_owner then 'eigenaar' else 'beheer' end);
  end if;
  foreach s in array v_subs loop perform private.close_submission(s); end loop;
  return jsonb_build_object('id', u.id, 'status', 'approved', 'ids', to_jsonb(v_ids));
end $$;
revoke all on function public.admin_apply_update(uuid) from public, anon;
grant execute on function public.admin_apply_update(uuid) to authenticated;

-- ── Afwijzen (regel en tijd ook samen) ──────────────────────────────────────────────────────────────────────────────
create or replace function public.admin_reject_update(p_id uuid, p_note text default null) returns jsonb
 language plpgsql security definer set search_path to ''
as $$
declare
  u public.updates_queue;
  g public.updates_queue;
  v_ids uuid[];
  v_subs uuid[] := '{}';
  s uuid;
begin
  if not public.has_admin_role() then raise exception 'Geen toegang' using errcode = '42501'; end if;
  select * into u from public.updates_queue where id = p_id and status = 'pending' for update;
  if not found then raise exception 'Onbekende of al afgehandelde update'; end if;

  v_ids := private.queue_group(u);
  for g in update public.updates_queue set status = 'rejected', decided_by = auth.uid(), decided_at = now()
            where id = any (v_ids) and status = 'pending' returning * loop
    insert into public.audit_log (actor, actor_email, action, entity, entity_id, details)
    values (auth.uid(), (select email from auth.users where id = auth.uid()), 'update_rejected', 'places', g.place_id::text,
            jsonb_build_object('veld', g.field_changed, 'nieuw', g.new_value, 'update', g.id, 'bron', g.source, 'notitie', p_note));
    if g.submission_id is not null and not (g.submission_id = any (v_subs)) then v_subs := v_subs || g.submission_id; end if;
  end loop;
  foreach s in array v_subs loop perform private.close_submission(s, p_note); end loop;
  return jsonb_build_object('id', u.id, 'status', 'rejected', 'ids', to_jsonb(v_ids));
end $$;
revoke all on function public.admin_reject_update(uuid, text) from public, anon;
grant execute on function public.admin_reject_update(uuid, text) to authenticated;
