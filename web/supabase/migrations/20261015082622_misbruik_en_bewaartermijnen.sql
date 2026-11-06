-- Review oktober 2026, fase 0 (docs/review-2026-10.md 0.1 tot 0.4 en 0.6).
-- Limieten die niet van de aanvrager afhangen, het support-token uit statistieken en logs, bewaartermijnen
-- uit de privacyverklaring en een veilige markering van handmatig gewijzigde velden.

-- ── Tellers per tijdvak ─────────────────────────────────────────────────────
-- Geen IP-adres en geen sessie: alleen een emmer per functie en tijdvak. Rijen verdwijnen na twee dagen.
create table if not exists private.rate_counter (
  bucket text not null,
  window_start timestamptz not null,
  hits int not null default 0,
  primary key (bucket, window_start)
);

-- true zolang de emmer onder de limiet zit. Bij de eerste overschrijding één waarschuwing in app_logs.
create or replace function private.rate_take(p_bucket text, p_limit int, p_window interval)
 returns boolean language plpgsql security definer set search_path to ''
as $$
declare w timestamptz := date_bin(p_window, now(), timestamptz '2000-01-01'); n int;
begin
  insert into private.rate_counter (bucket, window_start, hits) values (p_bucket, w, 1)
  on conflict (bucket, window_start) do update set hits = private.rate_counter.hits + 1
  returning hits into n;
  if n = p_limit + 1 then
    perform private.log('warn', 'limiet', 'Limiet bereikt: ' || p_bucket,
      jsonb_build_object('limit', p_limit, 'window', p_window::text));
  end if;
  return n <= p_limit;
end $$;
revoke all on function private.rate_take(text, int, interval) from public, anon, authenticated;

-- Geheime links naar een ticket nooit opslaan
create or replace function private.safe_path(p text)
 returns text language sql immutable set search_path to ''
as $$ select regexp_replace(left(p, 300), '^/support/[^/?#]+', '/support/[token]') $$;

-- ── Statistieken en cookiekeuze ─────────────────────────────────────────────
create or replace function public.track(p_name text, p_path text, p_props jsonb, p_session text)
 returns void language plpgsql security definer set search_path to ''
as $$
begin
  if p_name not in ('page_view','search','place_view','outbound','route','save') then return; end if;
  if jsonb_typeof(coalesce(p_props, '{}')) <> 'object' or pg_column_size(p_props) > 600 then return; end if;
  if not private.rate_take('track:min', 300, interval '1 minute')
     or not private.rate_take('track:dag', 20000, interval '1 day') then return; end if;
  insert into public.events (name, path, props, session_id)
  values (p_name, private.safe_path(p_path), coalesce(p_props, '{}'), left(p_session, 64));
end $$;

create or replace function public.log_consent(p_consent_id text, p_analytics boolean, p_marketing boolean, p_version text)
 returns void language plpgsql security definer set search_path to ''
as $$
begin
  if not private.rate_take('consent:min', 60, interval '1 minute')
     or not private.rate_take('consent:dag', 3000, interval '1 day') then return; end if;
  insert into public.consent_log (consent_id, analytics, marketing, version)
  values (left(p_consent_id, 64), p_analytics, p_marketing, left(p_version, 20));
end $$;

create or replace function public.report_client_error(p_message text, p_context jsonb)
 returns void language plpgsql security definer set search_path to ''
as $$
declare ctx jsonb := case when pg_column_size(p_context) > 4000 or jsonb_typeof(p_context) <> 'object' then '{}'::jsonb else p_context end;
begin
  if not private.rate_take('client-error:min', 30, interval '1 minute')
     or not private.rate_take('client-error:dag', 1000, interval '1 day') then return; end if;
  if ctx ? 'path' then ctx := jsonb_set(ctx, '{path}', to_jsonb(private.safe_path(ctx->>'path'))); end if;
  perform private.log('error', 'client', regexp_replace(left(p_message, 500), '/support/[A-Za-z0-9_-]+', '/support/[token]', 'g'), ctx);
end $$;

-- ── Formulieren ─────────────────────────────────────────────────────────────
create or replace function public.submit_place(p_kind text, p_place_id uuid, p_payload jsonb, p_contact_name text, p_contact_email text)
 returns uuid language plpgsql security definer set search_path to ''
as $$
declare sid uuid;
begin
  if pg_column_size(p_payload) > 20000 then raise exception 'Te veel gegevens'; end if;
  if p_contact_email is not null and (
    select count(*) from public.submissions where lower(contact_email) = lower(p_contact_email) and created_at > now() - interval '1 hour'
  ) >= 10 then
    raise exception 'Te veel inzendingen in korte tijd.';
  end if;
  if not private.rate_take('submit:uur', 60, interval '1 hour')
     or not private.rate_take('submit:dag', 300, interval '1 day') then
    raise exception 'Het is even erg druk. Probeer het later opnieuw.';
  end if;
  insert into public.submissions (kind, place_id, payload, contact_name, contact_email)
  values (p_kind, p_place_id, p_payload, nullif(trim(p_contact_name), ''), nullif(trim(p_contact_email), ''))
  returning id into sid;
  perform private.log('info', 'inzending', 'Nieuwe inzending: ' || p_kind, jsonb_build_object('id', sid));
  return sid;
end $$;

create or replace function public.create_ticket(p_name text, p_email text, p_subject text, p_category text, p_body text, p_place_id uuid default null)
 returns table(number bigint, access_token text) language plpgsql security definer set search_path to ''
as $$
declare t public.tickets;
begin
  if (select count(*) from public.tickets where lower(email) = lower(p_email) and created_at > now() - interval '1 hour') >= 5 then
    raise exception 'Je hebt al een aantal berichten gestuurd. We nemen zo snel mogelijk contact op.';
  end if;
  if char_length(coalesce(p_body, '')) < 10 then
    raise exception 'Je bericht is te kort.';
  end if;
  if char_length(p_body) > 5000 then
    raise exception 'Je bericht is te lang. Houd het onder de 5.000 tekens.';
  end if;
  if not private.rate_take('ticket:uur', 30, interval '1 hour')
     or not private.rate_take('ticket:dag', 150, interval '1 day') then
    raise exception 'Het is even erg druk. Probeer het later opnieuw of mail ons.';
  end if;
  insert into public.tickets (name, email, subject, category, place_id)
  values (trim(p_name), trim(p_email), trim(p_subject), coalesce(p_category, 'vraag'), p_place_id)
  returning * into t;
  insert into public.ticket_messages (ticket_id, author, body) values (t.id, 'klant', trim(p_body));
  insert into public.events (name, props) values ('ticket', jsonb_build_object('category', t.category));
  perform private.log('info', 'support', 'Nieuw ticket #' || t.number, jsonb_build_object('category', t.category));
  return query select t.number, t.access_token;
end $$;

-- Reviews: per plek een eigen limiet, zodat een aanval op één plek de rest niet blokkeert
create or replace function public.submit_review(p_place_id uuid, p_author_name text, p_author_email text, p_rating integer,
  p_score_location integer, p_score_quiet integer, p_score_facilities integer, p_score_value integer, p_title text,
  p_body text, p_vehicle text, p_visited_month date)
 returns uuid language plpgsql security definer set search_path to ''
as $$
declare rid uuid;
begin
  if not exists (select 1 from public.places where id = p_place_id and status = 'published') then
    raise exception 'Onbekende plek';
  end if;
  if p_author_email is not null and (
    select count(*) from public.reviews where lower(author_email) = lower(p_author_email) and created_at > now() - interval '1 hour'
  ) >= 5 then
    raise exception 'Te veel reviews in korte tijd. Probeer het later opnieuw.';
  end if;
  if not private.rate_take('review:' || p_place_id, 5, interval '1 hour')
     or not private.rate_take('review:dag', 400, interval '1 day') then
    raise exception 'Het is even erg druk. Probeer het later opnieuw.';
  end if;
  insert into public.reviews (place_id, author_name, author_email, rating, score_location, score_quiet,
    score_facilities, score_value, title, body, vehicle, visited_month)
  values (p_place_id, trim(p_author_name), nullif(trim(p_author_email), ''), p_rating, p_score_location, p_score_quiet,
    p_score_facilities, p_score_value, nullif(trim(p_title), ''), trim(p_body), p_vehicle, p_visited_month)
  returning id into rid;
  insert into public.events (name, props) values ('review', jsonb_build_object('place_id', p_place_id));
  return rid;
end $$;

-- ── Beheer: handmatige velden markeren zonder de rest van sources te overschrijven ──
create or replace function public.admin_mark_beheer(p_place_id uuid, p_fields text[])
 returns void language plpgsql security definer set search_path to ''
as $$
begin
  if not public.is_admin() then raise exception 'Geen toegang'; end if;
  update public.places
     set sources = jsonb_set(coalesce(sources, '{}'), '{beheer}', (
       select coalesce(jsonb_agg(f order by f), '[]'::jsonb)
         from (select jsonb_array_elements_text(coalesce(sources->'beheer', '[]')) f union select unnest(p_fields)) x))
   where id = p_place_id;
end $$;
revoke all on function public.admin_mark_beheer(uuid, text[]) from public, anon;
grant execute on function public.admin_mark_beheer(uuid, text[]) to authenticated;

-- ── Bewaartermijnen (privacyverklaring) ─────────────────────────────────────
create or replace function private.apply_retention()
 returns jsonb language plpgsql security definer set search_path to ''
as $$
declare r jsonb := '{}'; n int;
begin
  delete from public.events where ts < now() - interval '13 months';
  get diagnostics n = row_count; r := r || jsonb_build_object('events', n);
  delete from public.consent_log where ts < now() - interval '24 months';
  get diagnostics n = row_count; r := r || jsonb_build_object('consent_log', n);
  delete from public.app_logs where (level <> 'error' and ts < now() - interval '90 days') or ts < now() - interval '12 months';
  get diagnostics n = row_count; r := r || jsonb_build_object('app_logs', n);
  delete from public.reviews where status = 'rejected' and created_at < now() - interval '3 months';
  get diagnostics n = row_count; r := r || jsonb_build_object('rejected_reviews', n);
  delete from public.tickets where status in ('opgelost', 'gesloten') and updated_at < now() - interval '12 months';
  get diagnostics n = row_count; r := r || jsonb_build_object('tickets', n);
  update public.submissions set contact_name = null, contact_email = null
   where status <> 'nieuw' and created_at < now() - interval '12 months' and (contact_name is not null or contact_email is not null);
  get diagnostics n = row_count; r := r || jsonb_build_object('submission_contacts', n);
  delete from private.rate_counter where window_start < now() - interval '2 days';
  delete from cron.job_run_details where end_time < now() - interval '7 days';
  get diagnostics n = row_count; r := r || jsonb_build_object('cron_runs', n);
  return r;
end $$;
revoke all on function private.apply_retention() from public, anon, authenticated;

do $$ begin
  if exists (select 1 from cron.job where jobname = 'retention') then perform cron.unschedule('retention'); end if;
  perform cron.schedule('retention', '17 3 * * *', 'select private.apply_retention()');
end $$;

-- Bestaande rijen met een token opschonen
update public.events set path = private.safe_path(path) where path like '/support/%';
update public.app_logs set context = jsonb_set(context, '{path}', to_jsonb(private.safe_path(context->>'path')))
 where context->>'path' like '/support/%';
