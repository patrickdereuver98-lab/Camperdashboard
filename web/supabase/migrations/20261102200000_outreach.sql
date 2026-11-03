-- AI Outreach Loop, stap 2 (opdracht 2 november 2026): automatisch een korte mail naar eigenaren met een bekend
-- e-mailadres, via Resend, en het verwerken van hun antwoord (Gemini) uitbreiden. Zie README nummer 96.
--
-- Veiligheid staat in de database, niet in de route:
--   * private.outreach_config.enabled staat standaard UIT. Verzenden begint pas als beheer het aanzet.
--   * één mail per plek en per e-mailadres, ooit (unieke indexen); het adres staat alleen als SHA-256 in het logboek.
--   * wie zich afmeldt, terugmailt dat hij geen mail wil, of een harde bounce of spamklacht veroorzaakt, komt op
--     private.outreach_suppressions en krijgt nooit meer mail, ook niet na een nieuwe import.
--   * een spamklacht, of meer dan 3% harde bounces vanaf 40 verzonden mails, zet de hele campagne uit.
--   * dagquotum met opbouw (verdubbelt elke 3 dagen), alleen op werkdagen van 08:00 tot 17:00 (Amsterdam).
--   * geen gmail/hotmail/ziggo e.d. (meestal een privépersoon), geen parkeerplaatsen, geen samengevoegde plekken en geen
--     plek waarvan de eigenaar de stealth-lezer liet stoppen.
-- De route heeft geen service-role-sleutel: ze geeft OUTREACH_KEY door en de functies vergelijken het (als SHA-256) met
-- internal_secrets.outreach_key. Zonder sleutel in de tabel weigeren ze alles.

-- ── Hulpfuncties ─────────────────────────────────────────────────────────────────────────────────────────────────
create or replace function private.email_hash(p_email text) returns text
 language sql immutable set search_path to ''
as $$ select encode(extensions.digest(lower(trim(p_email)), 'sha256'), 'hex') $$;

create or replace function private.outreach_free_domains() returns text[]
 language sql immutable set search_path to ''
as $$
  select array['gmail.com', 'googlemail.com', 'hotmail.com', 'hotmail.nl', 'outlook.com', 'outlook.nl', 'live.nl',
               'live.com', 'msn.com', 'yahoo.com', 'yahoo.nl', 'ziggo.nl', 'kpnmail.nl', 'kpn.nl', 'planet.nl',
               'hetnet.nl', 'xs4all.nl', 'home.nl', 'chello.nl', 'online.nl', 'tele2.nl', 'icloud.com', 'me.com',
               'casema.nl', 'upcmail.nl', 'telfort.nl', 'tiscali.nl', 'freeler.nl', 'quicknet.nl', 'zonnet.nl',
               'solcon.nl', 'versatel.nl', 'caiway.nl', 'proton.me', 'protonmail.com', 'gmx.net', 'gmx.com', 'gmx.de',
               'web.de', 't-online.de', 'aol.com', 'mail.com', 'ymail.com', 'live.be', 'telenet.be', 'skynet.be']
$$;

-- ── Tabellen ─────────────────────────────────────────────────────────────────────────────────────────────────────
create table if not exists private.outreach_config (
  id boolean primary key default true check (id),
  enabled boolean not null default false,
  per_day_start integer not null default 25 check (per_day_start between 1 and 500),
  per_day_max integer not null default 200 check (per_day_max between 1 and 1000),
  ramp_days integer not null default 3 check (ramp_days between 1 and 30),
  -- Verzendvenster (Amsterdam): vanaf `window_start` tot `window_end` uur, standaard alleen op werkdagen
  window_start smallint not null default 8 check (window_start between 0 and 23),
  window_end smallint not null default 17 check (window_end between 1 and 24),
  weekdays_only boolean not null default true,
  paused_reason text check (char_length(paused_reason) <= 200),
  updated_at timestamptz not null default now()
);
insert into private.outreach_config (id) values (true) on conflict do nothing;

create table if not exists private.outreach_log (
  place_id uuid primary key references public.places (id) on delete cascade,
  email_hash text not null,
  token uuid not null unique default gen_random_uuid(),
  status text not null default 'claimed'
    check (status in ('claimed', 'sent', 'delivered', 'bounced', 'complained', 'replied', 'unsubscribed', 'failed')),
  resend_id text check (char_length(resend_id) <= 100),
  error text check (char_length(error) <= 300),
  claimed_at timestamptz not null default now(),
  offered_at timestamptz not null default now(),
  sent_at timestamptz,
  updated_at timestamptz not null default now()
);
create unique index if not exists outreach_log_email on private.outreach_log (email_hash);
create index if not exists outreach_log_resend on private.outreach_log (resend_id) where resend_id is not null;
create index if not exists outreach_log_claimed on private.outreach_log (claimed_at);

create table if not exists private.outreach_suppressions (
  email_hash text primary key,
  reason text not null check (reason in ('afgemeld', 'bounce', 'klacht', 'geweigerd')),
  created_at timestamptz not null default now()
);

revoke all on private.outreach_config, private.outreach_log, private.outreach_suppressions from public, anon, authenticated;

-- ── Welke belangrijke gegevens missen we ─────────────────────────────────────────────────────────────────────────
-- Waar de mail naar vraagt (besluit eigenaar 3 november 2026): de zwaarst wegende gegevens voor publicatie en score
-- (vertrekregel 4, openingsperiode 3, prijs 2, stroom 2; zie place_completeness en place_meets_must_haves), plus aankomst
-- (hoort bij de vertrekregel) en lozen. De mail laat zien wat we al weten en vraagt precies naar wat hier terugkomt.
-- Volgorde = volgorde in de mail.
create or replace function private.outreach_missing(p public.places) returns text[]
 language sql stable set search_path to ''
as $$
  select array_remove(array[
    case when p.departure is null or (p.departure = 'vast' and p.checkout_until is null) then 'vertrek' end,
    case when p.checkin_from is null then 'aankomst' end,
    case when p.open_all_year is null and p.season is null then 'seizoen' end,
    case when p.price_eur is null then 'prijs' end,
    case when p.power is null then 'stroom' end,
    case when p.dump_station is null then 'lozen' end], null)
$$;
revoke all on function private.outreach_missing(public.places) from public, anon, authenticated;

-- ── Wie komt in aanmerking ───────────────────────────────────────────────────────────────────────────────────────
-- Een plek met een geldig adres op een eigen domein, waarvan we minstens één van deze gegevens niet kennen. Per adres één plek (ketens krijgen één mail). Niemand die al een mail kreeg of zich
-- afmeldde.
create or replace function private.outreach_candidates() returns table (place_id uuid, email_hash text)
 language sql stable set search_path to ''
as $$
  select distinct on (h.hash) p.id, h.hash
    from public.places p
   cross join lateral (select private.email_hash(p.email) as hash, private.outreach_missing(p) as missing) h
   where p.email ~* '^[^@\s]+@[^@\s]+\.[^@\s]{2,}$'
     and char_length(p.email) <= 254
     and split_part(lower(trim(p.email)), '@', 2) <> all (private.outreach_free_domains())
     and p.status in ('published', 'draft')
     and p.merged_into is null
     and p.kind is distinct from 'parkeerplaats'
     and coalesce(p.sources #>> '{stealth,error}', '') not like 'geblokkeerd%'
     and cardinality(h.missing) >= 1
     and not exists (select 1 from private.outreach_log l where l.place_id = p.id or l.email_hash = h.hash)
     and not exists (select 1 from private.outreach_suppressions s where s.email_hash = h.hash)
   order by h.hash, ('vertrek' = any (h.missing)) desc, cardinality(h.missing) desc, p.id
$$;
revoke all on function private.outreach_candidates() from public, anon, authenticated;

-- Controle van de sleutel; gooit 42501 bij een verkeerde
create or replace function private.outreach_auth(p_secret text) returns void
 language plpgsql security definer set search_path to ''
as $$
declare expected text;
begin
  select value into expected from public.internal_secrets where name = 'outreach_key';
  if expected is null or p_secret is null
     or extensions.digest(p_secret, 'sha256') <> extensions.digest(expected, 'sha256') then
    raise exception 'Geen toegang' using errcode = '42501';
  end if;
end $$;
revoke all on function private.outreach_auth(text) from public, anon, authenticated;

-- Campagne uitzetten met een reden (in het logboek van Mission Control)
create or replace function private.outreach_pause(p_reason text) returns void
 language plpgsql security definer set search_path to ''
as $$
begin
  update private.outreach_config set enabled = false, paused_reason = left(p_reason, 200), updated_at = now() where id;
  insert into public.admin_logs (kind, source, status, message, details)
  values ('api', 'outreach', 'warn', left('Uitgaande mail gestopt: ' || p_reason, 1000), '{}'::jsonb);
end $$;
revoke all on function private.outreach_pause(text) from public, anon, authenticated;

-- ── outreach_next: de volgende plekken om te mailen ──────────────────────────────────────────────────────────────
-- Geeft { enabled, reason, items: [{ token, place_id, name, kind, town, email, departure, checkout_until, checkin_from,
-- checkin_until, slug, open_all_year, season, price_eur, power, water, dump_station, missing }] }. Een plek in `items` is geclaimd; blijft de verzending hangen, dan komt hij na 30 minuten opnieuw
-- (Resend krijgt dezelfde Idempotency-Key, dus er gaat nooit twee keer dezelfde mail uit). Na 20 uur geeft hij het op.
create or replace function public.outreach_next(p_secret text, p_limit integer default 10) returns jsonb
 language plpgsql security definer set search_path to ''
as $$
declare
  cfg private.outreach_config;
  v_local timestamp := now() at time zone 'Europe/Amsterdam';
  v_first timestamptz;
  v_cap integer;
  v_today integer;
  v_n integer;
  v_complaints integer;
  v_bounced integer;
  v_total integer;
  v_items jsonb;
  v_new uuid[] := '{}';
begin
  perform private.outreach_auth(p_secret);
  if not private.rate_take('outreach_next', 120, interval '1 hour') then
    return jsonb_build_object('enabled', true, 'reason', 'te vaak aangeroepen', 'items', '[]'::jsonb);
  end if;
  perform pg_advisory_xact_lock(hashtext('outreach_next'));

  select * into cfg from private.outreach_config where id;
  if not cfg.enabled then
    return jsonb_build_object('enabled', false, 'reason', coalesce(cfg.paused_reason, 'uit'), 'items', '[]'::jsonb);
  end if;

  -- Noodrem: één spamklacht of te veel harde bounces zet alles uit
  select count(*) filter (where status = 'complained'),
         count(*) filter (where status = 'bounced'),
         count(*) filter (where status not in ('claimed', 'failed'))
    into v_complaints, v_bounced, v_total
    from private.outreach_log where claimed_at > now() - interval '30 days';
  if v_complaints >= 1 then
    perform private.outreach_pause('spamklacht');
    return jsonb_build_object('enabled', false, 'reason', 'spamklacht', 'items', '[]'::jsonb);
  elsif v_total >= 40 and v_bounced * 100 > v_total * 3 then
    perform private.outreach_pause('meer dan 3% harde bounces');
    return jsonb_build_object('enabled', false, 'reason', 'te veel bounces', 'items', '[]'::jsonb);
  end if;

  -- Alleen op werkdagen overdag
  if (cfg.weekdays_only and extract(isodow from v_local) > 5)
     or extract(hour from v_local) < cfg.window_start or extract(hour from v_local) >= cfg.window_end then
    return jsonb_build_object('enabled', true, 'reason', 'buiten verzendtijd', 'items', '[]'::jsonb);
  end if;

  -- Opgegeven pogingen
  update private.outreach_log set status = 'failed', error = 'verzending verlopen', updated_at = now()
   where status = 'claimed' and claimed_at < now() - interval '20 hours';

  -- Dagquotum: begint bij per_day_start en verdubbelt elke ramp_days dagen tot per_day_max
  select min(claimed_at) into v_first from private.outreach_log;
  v_cap := least(cfg.per_day_max,
                 cfg.per_day_start * power(2, least(coalesce(floor(extract(epoch from now() - v_first) / 86400 / cfg.ramp_days), 0), 10))::integer);
  select count(*) into v_today from private.outreach_log
   where claimed_at >= date_trunc('day', v_local) at time zone 'Europe/Amsterdam';
  v_n := least(greatest(coalesce(p_limit, 10), 0), 25, greatest(v_cap - v_today, 0));

  -- Nieuwe plekken claimen
  if v_n > 0 then
    with ins as (
      insert into private.outreach_log (place_id, email_hash)
      select c.place_id, c.email_hash
        from private.outreach_candidates() c
        join public.places p on p.id = c.place_id
       order by ('vertrek' = any (private.outreach_missing(p))) desc, cardinality(private.outreach_missing(p)) desc, p.id
       limit v_n
      on conflict do nothing
      returning place_id)
    select coalesce(array_agg(place_id), '{}') into v_new from ins;
  end if;

  -- Wat nu verstuurd moet worden: nieuw geclaimd, of blijven hangen
  with due as (
    update private.outreach_log l set offered_at = now()
     where l.status = 'claimed' and (l.place_id = any (v_new) or l.offered_at < now() - interval '30 minutes')
    returning l.place_id, l.token
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'token', d.token, 'place_id', p.id, 'name', p.name, 'kind', p.kind, 'town', p.town,
           'email', trim(p.email), 'departure', p.departure, 'checkout_until', p.checkout_until,
           'checkin_from', p.checkin_from, 'checkin_until', p.checkin_until, 'open_all_year', p.open_all_year,
           'season', p.season, 'price_eur', p.price_eur, 'power', p.power, 'dump_station', p.dump_station, 'missing', to_jsonb(private.outreach_missing(p)))), '[]'::jsonb)
    into v_items
    from due d join public.places p on p.id = d.place_id;

  return jsonb_build_object('enabled', true, 'cap', v_cap, 'sent_today', v_today, 'items', v_items);
end $$;
revoke all on function public.outreach_next(text, integer) from public;
grant execute on function public.outreach_next(text, integer) to anon, authenticated;

-- ── Uitkomst van een verzending ──────────────────────────────────────────────────────────────────────────────────
create or replace function public.outreach_sent(p_secret text, p_token uuid, p_resend_id text) returns void
 language plpgsql security definer set search_path to ''
as $$
begin
  perform private.outreach_auth(p_secret);
  update private.outreach_log
     set status = 'sent', resend_id = left(p_resend_id, 100), sent_at = now(), updated_at = now(), error = null
   where token = p_token and status in ('claimed', 'failed');
end $$;
revoke all on function public.outreach_sent(text, uuid, text) from public;
grant execute on function public.outreach_sent(text, uuid, text) to anon, authenticated;

-- p_permanent: opgeven voor deze plek. p_suppress (standaard gelijk aan p_permanent): ook het adres uitsluiten; dat is
-- alleen voor een adres dat Resend afwees, niet voor een fout aan onze kant (bijvoorbeeld niets om te vragen).
-- Zonder p_permanent blijft de plek geclaimd en komt hij na 30 minuten opnieuw.
create or replace function public.outreach_failed(p_secret text, p_token uuid, p_error text, p_permanent boolean default false,
                                                  p_suppress boolean default null) returns void
 language plpgsql security definer set search_path to ''
as $$
declare v_hash text;
begin
  perform private.outreach_auth(p_secret);
  if p_permanent then
    update private.outreach_log set status = 'failed', error = left(p_error, 300), updated_at = now()
     where token = p_token and status = 'claimed' returning email_hash into v_hash;
    if v_hash is not null and coalesce(p_suppress, true) then
      insert into private.outreach_suppressions (email_hash, reason) values (v_hash, 'geweigerd') on conflict do nothing;
    end if;
  else
    update private.outreach_log set error = left(p_error, 300), updated_at = now() where token = p_token and status = 'claimed';
  end if;
end $$;
revoke all on function public.outreach_failed(text, uuid, text, boolean, boolean) from public;
grant execute on function public.outreach_failed(text, uuid, text, boolean, boolean) to anon, authenticated;

-- Gebeurtenis van Resend: delivered, bounced (alleen permanente), complained
create or replace function public.outreach_event(p_secret text, p_resend_id text, p_type text) returns jsonb
 language plpgsql security definer set search_path to ''
as $$
declare l private.outreach_log;
begin
  perform private.outreach_auth(p_secret);
  select * into l from private.outreach_log where resend_id = p_resend_id;
  if not found then return jsonb_build_object('known', false); end if;

  if p_type = 'delivered' then
    update private.outreach_log set status = 'delivered', updated_at = now() where resend_id = p_resend_id and status = 'sent';
  elsif p_type = 'bounced' then
    update private.outreach_log set status = 'bounced', updated_at = now() where resend_id = p_resend_id and status <> 'unsubscribed';
    insert into private.outreach_suppressions (email_hash, reason) values (l.email_hash, 'bounce') on conflict do nothing;
  elsif p_type = 'complained' then
    update private.outreach_log set status = 'complained', updated_at = now() where resend_id = p_resend_id;
    insert into private.outreach_suppressions (email_hash, reason) values (l.email_hash, 'klacht')
      on conflict (email_hash) do update set reason = 'klacht';
    perform private.outreach_pause('spamklacht');
  else
    return jsonb_build_object('known', true, 'ignored', true);
  end if;
  return jsonb_build_object('known', true, 'type', p_type);
end $$;
revoke all on function public.outreach_event(text, text, text) from public;
grant execute on function public.outreach_event(text, text, text) to anon, authenticated;

-- ── Afmelden (link in de mail, met het token uit de mail) ────────────────────────────────────────────────────────
-- Geen sleutel nodig: het token is willekeurig (uuid v4), staat alleen in de mail aan het adres van de plek, en geeft
-- alleen het recht om dit ene adres uit te schrijven en (met p_remove) deze ene plek van de site te halen. Antwoordt
-- altijd hetzelfde, zodat je geen tokens kunt raden. Een plek van de site halen is: status 'hidden' en vastgezet
-- (status_locked), dus de pipeline zet hem niet terug. De mail belooft dit, dus het moet echt gebeuren.
create or replace function public.outreach_unsubscribe(p_token uuid, p_remove boolean default false) returns jsonb
 language plpgsql security definer set search_path to ''
as $$
declare
  v_hash text;
  v_place uuid;
  v_name text;
begin
  if not private.rate_take('outreach_unsub', 300, interval '1 hour') then
    return jsonb_build_object('ok', true);
  end if;
  select email_hash, place_id into v_hash, v_place from private.outreach_log where token = p_token;
  if v_hash is not null then
    insert into private.outreach_suppressions (email_hash, reason) values (v_hash, 'afgemeld') on conflict do nothing;
    update private.outreach_log set status = 'unsubscribed', updated_at = now() where email_hash = v_hash;
    if p_remove then
      update public.places set status = 'hidden', status_locked = true where id = v_place returning name into v_name;
      insert into public.admin_logs (kind, source, status, message, details)
      values ('api', 'outreach', 'warn', left('Eigenaar vroeg om de plek van de site te halen: ' || coalesce(v_name, '?'), 1000),
              jsonb_build_object('place_id', v_place));
    end if;
  end if;
  return jsonb_build_object('ok', true);
end $$;
revoke all on function public.outreach_unsubscribe(uuid, boolean) from public;
grant execute on function public.outreach_unsubscribe(uuid, boolean) to anon, authenticated;

-- ── Beheer: overzicht en aan/uit ─────────────────────────────────────────────────────────────────────────────────
create or replace function public.admin_outreach_overview() returns jsonb
 language plpgsql stable security definer set search_path to ''
as $$
declare
  cfg private.outreach_config;
  v_first timestamptz;
  v_cap integer;
begin
  if not public.has_admin_role() then raise exception 'Geen toegang' using errcode = '42501'; end if;
  select * into cfg from private.outreach_config where id;
  select min(claimed_at) into v_first from private.outreach_log;
  v_cap := least(cfg.per_day_max,
                 cfg.per_day_start * power(2, least(coalesce(floor(extract(epoch from now() - v_first) / 86400 / cfg.ramp_days), 0), 10))::integer);
  return jsonb_build_object(
    'enabled', cfg.enabled, 'paused_reason', cfg.paused_reason, 'cap_today', v_cap,
    'by_status', coalesce((select jsonb_object_agg(status, n) from (select status, count(*) n from private.outreach_log group by status) s), '{}'::jsonb),
    'suppressed', (select count(*) from private.outreach_suppressions),
    'waiting', (select count(*) from private.outreach_candidates()));
end $$;
revoke all on function public.admin_outreach_overview() from public, anon;
grant execute on function public.admin_outreach_overview() to authenticated;

create or replace function public.admin_outreach_set(p_enabled boolean) returns void
 language plpgsql security definer set search_path to ''
as $$
begin
  if not public.has_admin_role() then raise exception 'Geen toegang' using errcode = '42501'; end if;
  update private.outreach_config
     set enabled = p_enabled, paused_reason = case when p_enabled then null else 'handmatig uitgezet' end, updated_at = now()
   where id;
  insert into public.audit_log (actor, action, entity, details)
  values (auth.uid(), case when p_enabled then 'outreach_aan' else 'outreach_uit' end, 'outreach', '{}'::jsonb);
end $$;
revoke all on function public.admin_outreach_set(boolean) from public, anon;
grant execute on function public.admin_outreach_set(boolean) to authenticated;

-- ── Antwoorden van eigenaren: aankomsttijd, vertrekregel en afmelden erbij ───────────────────────────────────────
alter table public.owner_replies add column if not exists checkin_from text
  check (checkin_from ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$');
alter table public.owner_replies add column if not exists departure_rule text
  check (departure_rule in ('vast', 'vrij', 'per24'));
alter table public.owner_replies add column if not exists power boolean;
alter table public.owner_replies add column if not exists water boolean;
alter table public.owner_replies add column if not exists dump_station boolean;
alter table public.owner_replies add column if not exists open_all_year boolean;
alter table public.owner_replies add column if not exists season text check (char_length(season) <= 60);
alter table public.owner_replies drop constraint if exists owner_replies_intent_check;
alter table public.owner_replies add constraint owner_replies_intent_check
  check (intent in ('confirm', 'update', 'unsubscribe', 'unknown'));
alter table public.owner_replies drop constraint if exists owner_replies_outcome_check;
alter table public.owner_replies add constraint owner_replies_outcome_check
  check (outcome in ('queued', 'verified', 'logged', 'no_place', 'ambiguous', 'unsubscribed'));

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
  v_in text := p_reply ->> 'checkin_from';
  v_rule text := p_reply ->> 'departure_rule';
  v_power boolean := case jsonb_typeof(p_reply -> 'power') when 'boolean' then (p_reply ->> 'power')::boolean end;
  v_water boolean := case jsonb_typeof(p_reply -> 'water') when 'boolean' then (p_reply ->> 'water')::boolean end;
  v_dump boolean := case jsonb_typeof(p_reply -> 'dump_station') when 'boolean' then (p_reply ->> 'dump_station')::boolean end;
  v_open boolean := case jsonb_typeof(p_reply -> 'open_all_year') when 'boolean' then (p_reply ->> 'open_all_year')::boolean end;
  v_season text := nullif(left(regexp_replace(trim(coalesce(p_reply ->> 'season', '')), '\s+', ' ', 'g'), 60), '');
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
  if v_intent not in ('confirm', 'update', 'unsubscribe', 'unknown') then v_intent := 'unknown'; end if;

  select id into v_reply from public.owner_replies where email_id = v_email_id;
  if found then return jsonb_build_object('id', v_reply, 'duplicate', true); end if;

  -- Waarden van het model nogmaals streng controleren; twijfel = leeg (nooit data verzinnen)
  if jsonb_typeof(p_reply -> 'price') = 'number' and (p_reply ->> 'price')::numeric between 0 and 500 then
    v_price := round((p_reply ->> 'price')::numeric, 2);
  end if;
  if v_time !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' then v_time := null; end if;
  if v_in !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' then v_in := null; end if;
  if v_rule is null or v_rule not in ('vast', 'vrij', 'per24') then v_rule := null; end if;
  -- Een tijd hoort bij een vaste vertrektijd; "vrij" of "per 24 uur" met een tijd spreekt zichzelf tegen
  if v_time is not null then v_rule := 'vast'; end if;
  if v_rule = 'vast' and v_time is null then v_rule := null; end if;
  -- Een openingsperiode met data en "het hele jaar open" spreken elkaar tegen: dan geldt niets
  if v_season is not null and v_open is true then v_season := null; v_open := null; end if;

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
    price_eur, departure_time, checkin_from, departure_rule, power, water, dump_station, open_all_year, season,
    summary, ai_model, outcome)
  values (v_email_id, left(v_from, 254), left(p_reply ->> 'subject', 300), v_place.id, v_matched, v_sender, v_intent,
          v_price, v_time, v_in, v_rule, v_power, v_water, v_dump, v_open, v_season,
          left(p_reply ->> 'summary', 500), left(p_reply ->> 'ai_model', 80), v_outcome)
  returning id into v_reply;

  if v_intent = 'unsubscribe' then
    -- Geen mail meer naar dit adres, ook niet voor andere plekken, ook niet als we de plek niet vinden
    insert into private.outreach_suppressions (email_hash, reason) values (private.email_hash(v_from), 'afgemeld')
      on conflict do nothing;
    update private.outreach_log set status = 'unsubscribed', updated_at = now() where email_hash = private.email_hash(v_from);
    v_outcome := 'unsubscribed';
  elsif v_matched is not null and v_intent = 'update' then
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
    elsif v_rule in ('vrij', 'per24') then
      if v_place.departure is distinct from v_rule then
        insert into public.updates_queue (place_id, field_changed, old_value, new_value, source, owner_reply_id)
        values (v_place.id, 'departure', to_jsonb(v_place.departure), to_jsonb(v_rule), 'eigenaar', v_reply);
        v_queued := v_queued + 1;
      end if;
      -- Een oude vaste tijd klopt dan niet meer (zoals bij een voorstel van een bezoeker)
      if v_place.checkout_until is not null then
        insert into public.updates_queue (place_id, field_changed, old_value, new_value, source, owner_reply_id)
        values (v_place.id, 'checkout_until', to_jsonb(v_place.checkout_until), 'null'::jsonb, 'eigenaar', v_reply);
        v_queued := v_queued + 1;
      end if;
    end if;
    if v_in is not null and v_place.checkin_from is distinct from v_in then
      insert into public.updates_queue (place_id, field_changed, old_value, new_value, source, owner_reply_id)
      values (v_place.id, 'checkin_from', to_jsonb(v_place.checkin_from), to_jsonb(v_in), 'eigenaar', v_reply);
      v_queued := v_queued + 1;
    end if;
    -- Voorzieningen en openingsperiode: alleen als de eigenaar ze noemt en ze verschillen van wat we hebben
    if v_power is not null and v_place.power is distinct from v_power then
      insert into public.updates_queue (place_id, field_changed, old_value, new_value, source, owner_reply_id)
      values (v_place.id, 'power', to_jsonb(v_place.power), to_jsonb(v_power), 'eigenaar', v_reply);
      v_queued := v_queued + 1;
    end if;
    if v_water is not null and v_place.water is distinct from v_water then
      insert into public.updates_queue (place_id, field_changed, old_value, new_value, source, owner_reply_id)
      values (v_place.id, 'water', to_jsonb(v_place.water), to_jsonb(v_water), 'eigenaar', v_reply);
      v_queued := v_queued + 1;
    end if;
    if v_dump is not null and v_place.dump_station is distinct from v_dump then
      insert into public.updates_queue (place_id, field_changed, old_value, new_value, source, owner_reply_id)
      values (v_place.id, 'dump_station', to_jsonb(v_place.dump_station), to_jsonb(v_dump), 'eigenaar', v_reply);
      v_queued := v_queued + 1;
    end if;
    if v_open is not null and v_place.open_all_year is distinct from v_open then
      insert into public.updates_queue (place_id, field_changed, old_value, new_value, source, owner_reply_id)
      values (v_place.id, 'open_all_year', to_jsonb(v_place.open_all_year), to_jsonb(v_open), 'eigenaar', v_reply);
      v_queued := v_queued + 1;
    end if;
    if v_season is not null and v_place.season is distinct from v_season then
      insert into public.updates_queue (place_id, field_changed, old_value, new_value, source, owner_reply_id)
      values (v_place.id, 'season', to_jsonb(v_place.season), to_jsonb(v_season), 'eigenaar', v_reply);
      v_queued := v_queued + 1;
    end if;
    if v_queued > 0 then v_outcome := 'queued'; end if;
  elsif v_matched is not null and v_intent = 'confirm' and v_sender then
    update public.places set verified_at = now() where id = v_place.id;
    v_outcome := 'verified';
  end if;

  -- Een antwoord op onze mail: het logboek van de uitgaande mail weet dat er reactie is
  if v_matched is not null and v_intent <> 'unsubscribe' then
    update private.outreach_log set status = 'replied', updated_at = now()
     where place_id = v_place.id and status in ('sent', 'delivered');
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

-- ── Bewaartermijn: het logboek van uitgaande mail (alleen hashes) 24 maanden; de afmeldlijst blijft ──────────────
do $$ begin
  if exists (select 1 from cron.job where jobname = 'outreach-retention') then
    perform cron.unschedule('outreach-retention');
  end if;
  perform cron.schedule('outreach-retention', '33 3 * * *',
    $c$delete from private.outreach_log where claimed_at < now() - interval '24 months'$c$);
end $$;
