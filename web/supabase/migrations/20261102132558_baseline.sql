-- Nulmigratie (baseline) van VrijStaan: het live schema op 2026-11-08, tot en met live migratie 20261102132558.
-- Gemaakt met web/scripts/baseline/maak-baseline.py uit de catalogus van de live database (introspectie, geen data).
-- Vervangt alle eerdere migraties (die staan in web/supabase/archief/migrations/ als geschiedenis); zie
-- docs/specs/05-backend-schema.md, "Herbouwen". Niet met de hand wijzigen: nieuwe wijzigingen gaan in een nieuwe
-- migratie. Draait op een nieuw Supabase-project (of de image supabase/postgres) als rol postgres.
-- Live staat deze versie als 20261102132558 geregistreerd; op live wordt dit bestand dus nooit uitgevoerd.
-- Geen rijen, geen geheimen; cron-taken staan in web/supabase/baseline/cron.sql.

set check_function_bodies = false;
set client_min_messages = warning;

create extension if not exists "pg_cron";
create extension if not exists "pg_net" with schema extensions;
create extension if not exists "pg_trgm" with schema extensions;
create extension if not exists "pgcrypto" with schema extensions;
create extension if not exists "postgis" with schema extensions;
create extension if not exists "unaccent" with schema extensions;
create extension if not exists "uuid-ossp" with schema extensions;

-- Schema's
create schema if not exists private;

-- Reeksen
create sequence if not exists private.nacontrole_20261108_id_seq as bigint increment by 1 minvalue 1 maxvalue 9223372036854775807 start with 1 cache 1;
create sequence if not exists public.nl_towns_id_seq as integer increment by 1 minvalue 1 maxvalue 2147483647 start with 1 cache 1;

-- Tabellen
create table if not exists private.admin_invites (
  email text not null,
  role text not null
);
create table if not exists private.nacontrole_20261108 (
  id bigint not null,
  place_id uuid not null,
  naam text,
  punt text not null,
  oordeel text not null,
  actie text not null,
  oud jsonb,
  nieuw jsonb,
  reden text,
  bron text,
  ts timestamp with time zone
);
create table if not exists private.pdok_woonplaats_20261024 (
  place_id uuid not null,
  req_id bigint,
  aangevraagd_op timestamp with time zone
);
create table if not exists private.rate_counter (
  bucket text not null,
  window_start timestamp with time zone not null,
  hits integer not null
);
create table if not exists private.scrape_baseline_20261023 (
  id uuid,
  status text,
  departure text,
  checkout_until text,
  checkin_from text,
  checkin_until text,
  reservation_rule text,
  price_eur numeric(6,2),
  access_24h boolean,
  access_hours text,
  n_extras bigint
);
create table if not exists private.scrape_baseline_20261024 (
  id uuid,
  status text,
  price_eur numeric(6,2),
  departure text,
  checkout_until text,
  price_note text
);
create table if not exists private.scrape_na_ronde1_20261023 (
  id uuid,
  status text,
  departure text,
  checkout_until text,
  checkin_from text,
  checkin_until text,
  reservation_rule text,
  price_eur numeric(6,2)
);
create table if not exists private.scrape_queue (
  place_id uuid not null,
  attempts integer not null,
  last_error text,
  next_attempt_at timestamp with time zone not null,
  done_at timestamp with time zone
);
create table if not exists private.secrets (
  name text not null,
  value text not null
);
create table if not exists private.snap_v34 (
  id uuid,
  status text,
  price_eur numeric(6,2),
  season text,
  open_all_year boolean,
  water boolean,
  dogs boolean,
  reservation boolean,
  capacity integer,
  departure text,
  checkout_until text,
  power boolean,
  toilet boolean,
  shower boolean,
  wifi boolean,
  dump_station boolean
);
create table if not exists private.snap_v35 (
  id uuid,
  status text,
  departure text,
  checkout_until text,
  checkin_from text,
  price_eur numeric(6,2),
  season text,
  open_all_year boolean,
  water boolean,
  dogs boolean,
  reservation boolean,
  capacity integer,
  verified_at timestamp with time zone,
  n_photos integer
);
create table if not exists private.snap_v36 (
  id uuid,
  status text,
  departure text,
  checkout_until text,
  checkin_from text,
  times_note text,
  price_eur numeric(6,2),
  season text,
  open_all_year boolean,
  water boolean,
  dogs boolean,
  reservation boolean,
  capacity integer,
  verified_at timestamp with time zone,
  n_photos integer
);
create table if not exists private.snap_v38 (
  id uuid,
  status text,
  departure text,
  checkout_until text,
  times_note text,
  price_eur numeric(6,2),
  price_note text,
  n_extras integer,
  season text,
  open_all_year boolean,
  water boolean,
  dogs boolean,
  capacity integer,
  n_photos integer
);
create table if not exists private.snap_velden (
  id uuid,
  status text,
  price_eur numeric(6,2),
  season text,
  open_all_year boolean,
  water boolean,
  dogs boolean,
  reservation boolean,
  capacity integer,
  max_length_m numeric(4,1),
  departure text,
  checkout_until text,
  power boolean,
  toilet boolean,
  shower boolean,
  wifi boolean,
  dump_station boolean,
  street text,
  phone text,
  email text
);
create table if not exists private.stealth_queue (
  place_id uuid not null,
  reason text not null,
  attempts integer not null,
  next_attempt_at timestamp with time zone not null,
  done_at timestamp with time zone,
  last_error text,
  created_at timestamp with time zone not null
);
create table if not exists private.town_correcties_20261024 (
  place_id uuid not null,
  slug text,
  oud text,
  nieuw text,
  bron text,
  gedaan_op timestamp with time zone
);
create table if not exists private.verwijderde_plekken (
  id uuid not null,
  osm_type text,
  osm_id bigint,
  slug text,
  name text,
  website text,
  reden text not null,
  gegevens jsonb not null,
  removed_at timestamp with time zone not null
);
create table if not exists public.admin_logs (
  id bigint generated always as identity not null,
  ts timestamp with time zone not null,
  kind text not null,
  source text not null,
  status text not null,
  message text,
  http_status integer,
  duration_ms integer,
  request_id bigint,
  details jsonb not null
);
create table if not exists public.admins (
  user_id uuid not null,
  email text not null,
  role text not null,
  created_at timestamp with time zone not null
);
create table if not exists public.app_logs (
  id bigint generated always as identity not null,
  ts timestamp with time zone not null,
  level text not null,
  source text not null,
  message text not null,
  context jsonb not null
);
create table if not exists public.audit_log (
  id bigint generated always as identity not null,
  ts timestamp with time zone not null,
  actor uuid,
  actor_email text,
  action text not null,
  entity text not null,
  entity_id text,
  details jsonb not null
);
create table if not exists public.campaigns (
  id uuid not null,
  name text not null,
  channel text not null,
  bron text not null,
  campagne text not null,
  budget_eur numeric(8,2) not null,
  spent_eur numeric(8,2) not null,
  starts_on date,
  ends_on date,
  notes text,
  created_at timestamp with time zone not null
);
create table if not exists public.consent_log (
  id bigint generated always as identity not null,
  ts timestamp with time zone not null,
  consent_id text not null,
  analytics boolean not null,
  marketing boolean not null,
  version text not null
);
create table if not exists public.content_items (
  id uuid not null,
  pillar text not null,
  channel text not null,
  title text not null,
  body text not null,
  hashtags text[] not null,
  link text,
  status text not null,
  planned_on date,
  posted_url text,
  posted_at timestamp with time zone,
  facts_snapshot jsonb,
  created_by uuid,
  created_at timestamp with time zone not null,
  updated_at timestamp with time zone not null
);
create table if not exists public.crowd_reports (
  id bigint generated always as identity not null,
  place_id uuid not null,
  user_id uuid not null,
  level text not null,
  created_at timestamp with time zone not null
);
create table if not exists public.crowd_watches (
  user_id uuid not null,
  place_id uuid not null,
  created_at timestamp with time zone not null,
  expires_at timestamp with time zone not null,
  notified_at timestamp with time zone
);
create table if not exists public.dependency_updates (
  id uuid not null,
  package_name text not null,
  version_from text,
  version_to text,
  update_type text,
  ecosystem text,
  category text not null,
  ai_advice text,
  ai_model text,
  status text not null,
  pr_number integer,
  pr_url text,
  created_at timestamp with time zone not null,
  updated_at timestamp with time zone not null
);
create table if not exists public.duplicate_dismissals (
  a uuid not null,
  b uuid not null,
  dismissed_by uuid,
  created_at timestamp with time zone not null
);
create table if not exists public.events (
  id bigint generated always as identity not null,
  ts timestamp with time zone not null,
  name text not null,
  path text,
  props jsonb not null,
  session_id text
);
create table if not exists public.faq (
  id uuid not null,
  category text not null,
  question text not null,
  answer text not null,
  "position" integer not null,
  published boolean not null,
  updated_at timestamp with time zone not null
);
create table if not exists public.geo_bronnen (
  bron text not null,
  naam text not null,
  tier smallint not null,
  status text not null,
  soort text,
  notitie text,
  beoordeeld_op timestamp with time zone,
  aangemaakt_op timestamp with time zone not null
);
create table if not exists public.geo_master (
  master_id text not null,
  geohash text not null,
  naam text,
  namen text[] not null,
  lat double precision not null,
  lon double precision not null,
  bron_ids text[] not null,
  faciliteiten jsonb not null,
  conflicten jsonb not null,
  match_score real not null,
  aangemaakt_op timestamp with time zone not null,
  bijgewerkt_op timestamp with time zone not null,
  place_id uuid,
  promotie text,
  promotie_reden text,
  gepromoveerd_op timestamp with time zone
);
create table if not exists public.ingest_runs (
  id bigint generated always as identity not null,
  kind text not null,
  started_at timestamp with time zone not null,
  finished_at timestamp with time zone,
  status text not null,
  stats jsonb not null
);
create table if not exists public.internal_secrets (
  name text not null,
  value text not null
);
create table if not exists public.manual_review (
  place_id uuid not null,
  requires_manual_review boolean not null,
  reden text not null,
  sinds timestamp with time zone not null
);
create table if not exists public.marketing_assets (
  id uuid not null,
  kind text not null,
  template text,
  format text,
  title text,
  storage_path text not null,
  job_id uuid,
  content_item_id uuid,
  facts_snapshot jsonb,
  created_at timestamp with time zone not null
);
create table if not exists public.marketing_jobs (
  id uuid not null,
  kind text not null,
  template text,
  format text,
  props jsonb not null,
  status text not null,
  error text,
  created_by uuid,
  created_at timestamp with time zone not null,
  started_at timestamp with time zone,
  finished_at timestamp with time zone
);
create table if not exists public.nl_towns (
  id integer not null,
  name text not null,
  province text not null,
  lat double precision not null,
  lng double precision not null
);
create table if not exists public.osm_queries (
  name text not null,
  template text not null
);
create table if not exists public.osm_regions (
  code text not null,
  name text not null,
  last_run_at timestamp with time zone,
  places_req bigint,
  points_req bigint,
  attempt integer not null
);
create table if not exists public.osm_staging (
  id bigint generated always as identity not null,
  kind text not null,
  "row" jsonb not null,
  created_at timestamp with time zone not null,
  processed_at timestamp with time zone
);
create table if not exists public.owner_replies (
  id uuid not null,
  email_id text not null,
  received_at timestamp with time zone not null,
  from_email text not null,
  subject text,
  place_id uuid,
  matched_by text,
  sender_matches boolean not null,
  intent text not null,
  price_eur numeric,
  departure_time text,
  summary text,
  ai_model text,
  outcome text not null,
  queued smallint not null
);
create table if not exists public.place_photos (
  id uuid not null,
  place_id uuid not null,
  user_id uuid,
  storage_path text not null,
  width integer,
  height integer,
  caption text,
  credit text,
  status text not null,
  reviewed_by uuid,
  reviewed_at timestamp with time zone,
  created_at timestamp with time zone not null
);
create table if not exists public.places (
  id uuid not null,
  slug text not null,
  osm_type text,
  osm_id bigint,
  name text not null,
  name_is_generic boolean not null,
  kind text,
  lat double precision not null,
  lng double precision not null,
  street text,
  postcode text,
  town text,
  province text,
  description text,
  description_source text,
  price_eur numeric(6,2),
  price_note text,
  tourist_tax_included boolean,
  power boolean,
  power_note text,
  water boolean,
  dump_station boolean,
  toilet boolean,
  shower boolean,
  wifi boolean,
  dogs boolean,
  capacity integer,
  max_length_m numeric(4,1),
  surface text,
  open_all_year boolean,
  season text,
  reservation boolean,
  max_stay_nights integer,
  website text,
  phone text,
  email text,
  image_url text,
  image_credit text,
  photos jsonb not null,
  rating_avg numeric(3,1),
  rating_count integer not null,
  completeness numeric(4,3) not null,
  status text not null,
  status_locked boolean not null,
  sources jsonb not null,
  last_scraped_at timestamp with time zone,
  verified_at timestamp with time zone,
  created_at timestamp with time zone not null,
  updated_at timestamp with time zone not null,
  departure text,
  checkout_until text,
  checkin_from text,
  access_hours text,
  access_24h boolean,
  times_note text,
  price_extras jsonb,
  geom extensions.geometry(Point,4326) generated always as (extensions.st_setsrid(extensions.st_makepoint(lng, lat), 4326)) stored,
  merged_into uuid,
  departure_check text,
  departure_checked_at timestamp with time zone,
  departure_checked_by text,
  operator text,
  checkin_until text,
  reservation_rule text
);
create table if not exists public.profiles (
  id uuid not null,
  display_name text,
  avatar_url text,
  created_at timestamp with time zone not null,
  updated_at timestamp with time zone not null,
  role text not null
);
create table if not exists public.push_subscriptions (
  id uuid not null,
  user_id uuid not null,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  created_at timestamp with time zone not null,
  disabled_at timestamp with time zone
);
create table if not exists public.reviews (
  id uuid not null,
  place_id uuid not null,
  author_name text not null,
  author_email text,
  rating smallint not null,
  score_location smallint,
  score_quiet smallint,
  score_facilities smallint,
  score_value smallint,
  title text,
  body text not null,
  vehicle text,
  visited_month date,
  status text not null,
  admin_note text,
  created_at timestamp with time zone not null,
  user_id uuid
);
create table if not exists public.route_cache (
  key text not null,
  distance_m integer not null,
  duration_s integer not null,
  geometry jsonb,
  provider text not null,
  created_at timestamp with time zone not null
);
create table if not exists public.seo_daily (
  date date not null,
  query text not null,
  page text not null,
  clicks integer not null,
  impressions integer not null,
  "position" numeric(6,2)
);
create table if not exists public.seo_pages (
  url text not null,
  indexed boolean,
  verdict text,
  coverage text,
  last_crawl timestamp with time zone,
  checked_at timestamp with time zone not null
);
create table if not exists public.seo_status (
  key text not null,
  value jsonb not null,
  checked_at timestamp with time zone not null
);
create table if not exists public.seo_totals (
  date date not null,
  device text not null,
  clicks integer not null,
  impressions integer not null,
  "position" numeric(6,2)
);
create table if not exists public.shared_trip_members (
  trip_id uuid not null,
  user_id uuid not null,
  display_name text,
  joined_at timestamp with time zone not null,
  left_at timestamp with time zone
);
create table if not exists public.shared_trips (
  id uuid not null,
  owner_id uuid not null,
  name text not null,
  stops jsonb not null,
  invite_code text not null,
  updated_by uuid,
  updated_at timestamp with time zone not null,
  created_at timestamp with time zone not null
);
create table if not exists public.site_settings (
  key text not null,
  value jsonb not null
);
create table if not exists public.social_stats (
  id uuid not null,
  platform text not null,
  post_url text not null,
  content_item_id uuid,
  measured_on date not null,
  views integer,
  reach integer,
  likes integer,
  comments integer,
  shares integer,
  saves integer,
  source text not null
);
create table if not exists public.submissions (
  id uuid not null,
  kind text not null,
  place_id uuid,
  payload jsonb not null,
  contact_name text,
  contact_email text,
  status text not null,
  admin_note text,
  created_at timestamp with time zone not null,
  user_id uuid
);
create table if not exists public.ticket_messages (
  id uuid not null,
  ticket_id uuid not null,
  author text not null,
  admin_id uuid,
  body text not null,
  internal boolean not null,
  created_at timestamp with time zone not null
);
create table if not exists public.tickets (
  id uuid not null,
  number bigint generated always as identity not null,
  access_token text not null,
  name text not null,
  email text not null,
  subject text not null,
  category text not null,
  status text not null,
  priority text not null,
  place_id uuid,
  assignee uuid,
  created_at timestamp with time zone not null,
  updated_at timestamp with time zone not null
);
create table if not exists public.updates_queue (
  id uuid not null,
  place_id uuid not null,
  field_changed text not null,
  old_value jsonb,
  new_value jsonb not null,
  source text not null,
  submission_id uuid,
  user_id uuid,
  status text not null,
  ai_score smallint,
  ai_advice text,
  ai_model text,
  ai_checked_at timestamp with time zone,
  decided_by uuid,
  decided_at timestamp with time zone,
  created_at timestamp with time zone not null,
  owner_reply_id uuid
);
create table if not exists public.user_expenses (
  user_id uuid not null,
  entries jsonb not null,
  updated_at timestamp with time zone not null
);
create table if not exists public.user_trips (
  user_id uuid not null,
  stops jsonb not null,
  updated_at timestamp with time zone not null
);
create table if not exists public.user_vehicles (
  user_id uuid not null,
  data jsonb not null,
  updated_at timestamp with time zone not null
);

-- Reeksen aan kolommen
alter sequence private.nacontrole_20261108_id_seq owned by private.nacontrole_20261108.id;
alter sequence public.nl_towns_id_seq owned by public.nl_towns.id;

-- Functies
CREATE OR REPLACE FUNCTION private.apply_retention()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
  perform private.log('info', 'retention', 'Bewaartermijnen toegepast', r);
  return r;
end $function$
;

CREATE OR REPLACE FUNCTION private.audit()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare uid uuid := (select auth.uid());
begin
  if uid is null then return coalesce(new, old); end if;
  insert into public.audit_log (actor, actor_email, action, entity, entity_id, details)
  values (uid, (select email from public.admins where user_id = uid), lower(tg_op), tg_table_name,
          coalesce(new.id, old.id)::text,
          case when tg_op = 'UPDATE' then
            (select coalesce(jsonb_object_agg(n.key, n.value), '{}'::jsonb)
               from jsonb_each(to_jsonb(new)) n
              where to_jsonb(old) -> n.key is distinct from n.value and n.key not in ('updated_at','completeness'))
          else '{}'::jsonb end);
  return coalesce(new, old);
end;
$function$
;

CREATE OR REPLACE FUNCTION private.auto_approve_photo()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if (private.user_trust(new.user_id)->>'trusted')::boolean then
    update public.place_photos set status = 'approved' where id = new.id;
  end if;
  return null;
end $function$
;

CREATE OR REPLACE FUNCTION private.call_discover(p_n integer DEFAULT 6)
 RETURNS bigint
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare k text; rid bigint;
begin
  select value into k from public.internal_secrets where name = 'pipeline_key';
  select net.http_post(
    url := 'https://qkrmthrhwmmmwswmfgwc.supabase.co/functions/v1/discover',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-pipeline-key', k),
    body := jsonb_build_object('n', p_n),
    timeout_milliseconds := 150000
  ) into rid;
  return rid;
end $function$
;

CREATE OR REPLACE FUNCTION private.call_pipeline(p_body jsonb)
 RETURNS bigint
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare k text; rid bigint;
begin
  select value into k from public.internal_secrets where name = 'pipeline_key';
  select net.http_post(
    url := 'https://qkrmthrhwmmmwswmfgwc.supabase.co/functions/v1/pipeline',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-pipeline-key', k),
    body := p_body,
    timeout_milliseconds := 150000
  ) into rid;
  return rid;
end;
$function$
;

CREATE OR REPLACE FUNCTION private.close_submission(p_submission uuid, p_note text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if p_submission is null
     or exists (select 1 from public.updates_queue where submission_id = p_submission and status = 'pending') then
    return;
  end if;
  update public.submissions
     set status = case when exists (select 1 from public.updates_queue where submission_id = p_submission and status = 'approved')
                       then 'verwerkt' else 'afgewezen' end,
         admin_note = coalesce(nullif(trim(coalesce(p_note, '')), ''), admin_note)
   where id = p_submission and status = 'nieuw';
end $function$
;

CREATE OR REPLACE FUNCTION private.collect_osm()
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare r public.osm_regions; a_status int; b_status int; a_err text; b_err text; a_found boolean; b_found boolean; wait interval;
begin
  select * into r from public.osm_regions where places_req is not null limit 1;
  if not found then return null; end if;
  -- Overpass is vaak overbelast: wacht steeds langer (10, 20, 40 … minuten, hooguit 6 uur), wissel van server
  wait := least(interval '10 minutes' * power(2, least(r.attempt, 6)), interval '6 hours');
  select true, status_code, coalesce(error_msg, left(content::text, 200)) into a_found, a_status, a_err from net._http_response where id = r.places_req;
  select true, status_code, coalesce(error_msg, left(content::text, 200)) into b_found, b_status, b_err from net._http_response where id = r.points_req;
  if a_found is null or b_found is null then
    if r.last_run_at < now() - interval '10 minutes' then
      update public.osm_regions set places_req = null, points_req = null, attempt = attempt + 1,
             last_run_at = now() - interval '7 days' + wait where code = r.code;
    end if;
    return 'wacht';
  end if;
  if a_status = 200 and b_status = 200 then
    perform private.call_pipeline(jsonb_build_object('action', 'parse', 'region', r.code, 'places_req', r.places_req, 'points_req', r.points_req));
    update public.osm_regions set places_req = null, points_req = null, attempt = 0 where code = r.code;
  else
    insert into public.app_logs (level, source, message, context) values (case when r.attempt >= 3 then 'error' else 'warn' end, 'pipeline',
      'Overpass gaf geen data voor ' || r.name || ' (poging ' || (r.attempt + 1) || ', volgende poging over ' || extract(epoch from wait)::int / 60 || ' minuten via andere server)',
      jsonb_build_object('places', a_status, 'points', b_status));
    update public.osm_regions set places_req = null, points_req = null, attempt = attempt + 1,
           last_run_at = now() - interval '7 days' + wait where code = r.code;
  end if;
  return r.code;
end $function$
;

CREATE OR REPLACE FUNCTION private.concept_reden(p public.places)
 RETURNS text
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
  select case
    when p.status <> 'draft' then null
    when p.status_locked then 'vastgezet door beheer'
    when not (p.website is not null or p.phone is not null or p.email is not null or nullif(trim(p.operator), '') is not null)
      then 'geen contact (website, telefoon of e-mail)'
    when not public.place_meets_must_haves(p) and p.departure is null then 'te weinig kernfeiten, geen vertrekregel'
    when not public.place_meets_must_haves(p) then 'te weinig kernfeiten'
    else 'onder de publicatiedrempel'
  end;
$function$
;

CREATE OR REPLACE FUNCTION private.create_profile()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare m jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb); avatar text;
begin
  avatar := coalesce(m->>'avatar_url', m->>'picture');
  insert into public.profiles (id, display_name, avatar_url)
  values (new.id,
          left(nullif(trim(coalesce(m->>'full_name', m->>'name', split_part(new.email, '@', 1))), ''), 80),
          case when avatar ~ '^https://' then avatar end)
  on conflict (id) do nothing;
  return new;
end $function$
;

CREATE OR REPLACE FUNCTION private.crowd_notify()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare k text;
begin
  if new.level <> 'rustig' then return null; end if;
  if not exists (select 1 from public.crowd_watches where place_id = new.place_id and notified_at is null and expires_at > now()) then return null; end if;
  if public.crowd_status(new.place_id)->>'level' is distinct from 'rustig' then return null; end if;
  select value into k from public.internal_secrets where name = 'pipeline_key';
  perform net.http_post(
    url := 'https://qkrmthrhwmmmwswmfgwc.supabase.co/functions/v1/push',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-pipeline-key', k),
    body := jsonb_build_object('action', 'notify', 'place_id', new.place_id),
    timeout_milliseconds := 20000);
  return null;
end $function$
;

CREATE OR REPLACE FUNCTION private.decode_entities(s text)
 RETURNS text
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO ''
AS $function$
declare m text[]; out text := s;
begin
  if out is null then return null; end if;
  for m in select regexp_matches(out, '&#x([0-9a-fA-F]+);', 'g') loop
    out := replace(out, '&#x' || m[1] || ';', chr(('x' || lpad(m[1], 8, '0'))::bit(32)::int));
  end loop;
  for m in select regexp_matches(out, '&#([0-9]+);', 'g') loop
    out := replace(out, '&#' || m[1] || ';', chr(m[1]::int));
  end loop;
  return replace(out, '&amp;', '&');
end $function$
;

CREATE OR REPLACE FUNCTION private.enqueue_stale_scrape(p_days integer DEFAULT 30, p_limit integer DEFAULT 10)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
end $function$
;

CREATE OR REPLACE FUNCTION private.enqueue_stealth(p_days integer DEFAULT 30, p_limit integer DEFAULT 300)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
end $function$
;

CREATE OR REPLACE FUNCTION private.forceer_kernfeit_scrape(p_limit integer DEFAULT 2000)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare n int;
begin
  insert into private.scrape_queue (place_id)
  select p.id from public.places p
   where p.merged_into is null
     and p.status = 'draft'
     and p.website is not null
     and p.departure is null
     -- Alleen met de stealth-lezer leesbaar: die plekken lopen via de stealth-wachtrij (14 dagen, B1)
     and not (p.sources ? 'stealth' and not (p.sources->'stealth' ? 'error'))
     and not exists (select 1 from private.scrape_queue q where q.place_id = p.id and q.done_at is null)
   order by p.completeness desc
   limit p_limit
  on conflict (place_id) do update set done_at = null, attempts = 0, next_attempt_at = now(), last_error = null
   where private.scrape_queue.done_at is not null;
  get diagnostics n = row_count;
  return n;
end $function$
;

CREATE OR REPLACE FUNCTION private.geo_afstand_m(lat1 double precision, lon1 double precision, lat2 double precision, lon2 double precision)
 RETURNS double precision
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO ''
AS $function$
  select 2 * 6371008.8 * asin(least(1, sqrt(
    sin(radians(lat2 - lat1) / 2) ^ 2 + cos(radians(lat1)) * cos(radians(lat2)) * sin(radians(lon2 - lon1) / 2) ^ 2)));
$function$
;

CREATE OR REPLACE FUNCTION private.geo_bestaande_plek(m public.geo_master)
 RETURNS uuid
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
  select p.id
    from public.places p
   where p.merged_into is null
     and m.lat is not null and m.lon is not null
     and p.lat between m.lat - 0.0018 and m.lat + 0.0018
     and p.lng between m.lon - 0.003 and m.lon + 0.003
     and (private.geo_afstand_m(m.lat, m.lon, p.lat, p.lng) <= 60
          or (private.geo_afstand_m(m.lat, m.lon, p.lat, p.lng) <= 150
              and not private.geo_nummers_botsen(p.name, m.naam)
              and extensions.similarity(private.geo_naam_kern(p.name), private.geo_naam_kern(m.naam)) >= 0.3))
   order by private.geo_afstand_m(m.lat, m.lon, p.lat, p.lng)
   limit 1;
$function$
;

CREATE OR REPLACE FUNCTION private.geo_bool(f jsonb, k text)
 RETURNS boolean
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO ''
AS $function$
  select case when jsonb_typeof(f -> k) = 'boolean' then (f ->> k)::boolean end;
$function$
;

CREATE OR REPLACE FUNCTION private.geo_eerder_verwijderd(m public.geo_master)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select exists (
    select 1
      from private.verwijderde_plekken v
      cross join lateral (select (v.gegevens ->> 'lat')::float8 as lat, (v.gegevens ->> 'lng')::float8 as lng) g
     where g.lat between m.lat - 0.0018 and m.lat + 0.0018
       and g.lng between m.lon - 0.003 and m.lon + 0.003
       and (private.geo_afstand_m(m.lat, m.lon, g.lat, g.lng) <= 60
            or (private.geo_afstand_m(m.lat, m.lon, g.lat, g.lng) <= 150
                and not private.geo_nummers_botsen(v.name, m.naam)
                and extensions.similarity(private.geo_naam_kern(v.name), private.geo_naam_kern(m.naam)) >= 0.3)));
$function$
;

CREATE OR REPLACE FUNCTION private.geo_naam_kern(p text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO ''
AS $function$
  select coalesce(string_agg(w, ' ' order by i), '')
  from regexp_split_to_table(lower(extensions.unaccent(coalesce(p, ''))), '[^a-z0-9]+') with ordinality as t(w, i)
  where w <> '' and w not in (
    'camperplaats', 'camperplaatsen', 'camperplek', 'camperplekken', 'camperpark', 'camperparkeerplaats',
    'campervoorziening', 'camperstandplaats', 'camperhaven', 'camping', 'minicamping', 'kampeerterrein',
    'boerderijcamping', 'natuurcamping', 'parking', 'parkeerplaats', 'jachthaven', 'passantenhaven', 'stellplatz',
    'wohnmobilstellplatz', 'reisemobilstellplatz', 'campingplatz', 'aire', 'motorhome', 'camper', 'campers',
    'vakantiepark', 'recreatiepark', 'de', 'het', 't', 'van', 'aan', 'bij', 'op');
$function$
;

CREATE OR REPLACE FUNCTION private.geo_nummers_botsen(a text, b text)
 RETURNS boolean
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO ''
AS $function$
  with n as (
    select (select string_agg(x[1], ',' order by x[1]) from regexp_matches(a, '[0-9]+', 'g') x) as na,
           (select string_agg(x[1], ',' order by x[1]) from regexp_matches(b, '[0-9]+', 'g') x) as nb
  )
  select na is not null and nb is not null and na <> nb from n;
$function$
;

CREATE OR REPLACE FUNCTION private.geo_promotie_bezwaar(m public.geo_master)
 RETURNS text
 LANGUAGE plpgsql
 STABLE
 SET search_path TO ''
AS $function$
declare
  n_sterk int; n_zwak int; n_geblokkeerd int; namen text; t public.nl_towns;
begin
  select count(*) filter (where b.status = 'toegestaan' and b.tier <= 2),
         count(distinct b.bron) filter (where b.status = 'toegestaan' and b.tier >= 3),
         count(*) filter (where b.status = 'geblokkeerd')
    into n_sterk, n_zwak, n_geblokkeerd
    from (select distinct split_part(id, ':', 1) as bron from unnest(m.bron_ids) id) s
    join public.geo_bronnen b on b.bron = s.bron;
  if n_sterk = 0 and n_zwak = 0 then
    return case when n_geblokkeerd > 0 then 'alleen geblokkeerde bronnen' else 'geen toegestane bron' end;
  end if;
  if n_sterk = 0 and n_zwak < 2 then
    return 'één bron uit tier 3–5: een tweede toegestane bron is nodig';
  end if;
  if m.lat is null or m.lon is null or m.lat not between 50.70 and 53.60 or m.lon not between 3.30 and 7.30 then
    return 'buiten Nederland';
  end if;
  t := public.nearest_town(m.lat, m.lon);
  if t.id is null or private.geo_afstand_m(m.lat, m.lon, t.lat, t.lng) > 16000 then
    return 'buiten Nederland';
  end if;
  if m.naam is null or length(trim(m.naam)) not between 3 and 120 then
    return 'naam ontbreekt of heeft een vreemde lengte';
  end if;
  if private.geo_naam_kern(m.naam) = '' then
    return 'naam is alleen een soortwoord';
  end if;
  if m.naam ~* '(https?://|www\.|@|\.(nl|com|de|be|eu)\b)' or m.naam ~ '^[0-9 .,-]+$' then
    return 'naam lijkt een adres, URL of nummer';
  end if;
  namen := lower(extensions.unaccent(m.naam || ' ' || array_to_string(m.namen, ' ')));
  if namen ~ '(wild ?kampe|wildcamp|wild camp|free ?camp|wildes? camp|paalkampe|bivak)'
     or m.faciliteiten ?| array['wildkamperen', 'paalkamperen', 'wildcamping'] then
    return 'wildkamperen of paalkamperen (geen camperplek)';
  end if;
  return null;
end $function$
;

CREATE OR REPLACE FUNCTION private.log(p_level text, p_source text, p_message text, p_context jsonb DEFAULT '{}'::jsonb)
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
  insert into public.app_logs (level, source, message, context) values (p_level, p_source, left(p_message, 2000), coalesce(p_context, '{}'));
$function$
;

CREATE OR REPLACE FUNCTION private.markeer_handmatig()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
end $function$
;

CREATE OR REPLACE FUNCTION private.marketing_claim_job()
 RETURNS public.marketing_jobs
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare j public.marketing_jobs;
begin
  update public.marketing_jobs set status = 'bezig', started_at = now(), error = null
  where id = (select id from public.marketing_jobs
              where status = 'wacht' or (status = 'bezig' and started_at < now() - interval '2 hours')
              order by created_at limit 1 for update skip locked)
  returning * into j;
  return j;
end $function$
;

CREATE OR REPLACE FUNCTION private.marketing_cleanup()
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
  delete from public.marketing_jobs where finished_at < now() - interval '30 days';
  delete from public.seo_daily where date < current_date - interval '3 years';
$function$
;

CREATE OR REPLACE FUNCTION private.marketing_finish_job(p_id uuid, p_assets jsonb, p_error text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare j public.marketing_jobs;
begin
  select * into j from public.marketing_jobs where id = p_id for update;
  if j.id is null then raise exception 'Onbekende job %', p_id; end if;
  if p_error is not null then
    update public.marketing_jobs set status = 'fout', error = left(p_error, 1000), finished_at = now() where id = p_id;
    return;
  end if;
  insert into public.marketing_assets (kind, template, format, title, storage_path, job_id, facts_snapshot)
  select a ->> 'kind', j.template, coalesce(a ->> 'format', j.format), left(a ->> 'title', 120), a ->> 'path', j.id, j.props -> 'facts'
  from jsonb_array_elements(coalesce(p_assets, '[]')) a
  where (a ->> 'path') like 'jobs/' || p_id::text || '/%';
  update public.marketing_jobs set status = 'klaar', finished_at = now() where id = p_id;
end $function$
;

CREATE OR REPLACE FUNCTION private.next_osm_region()
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare r public.osm_regions;
begin
  if exists (select 1 from public.osm_regions where places_req is not null) then return null; end if;
  select * into r from public.osm_regions
   where last_run_at is null or last_run_at < now() - interval '7 days'
   order by last_run_at nulls first limit 1;
  if not found then return null; end if;
  -- Bij een eerdere mislukte poging een andere Overpass-server
  update public.osm_regions
     set last_run_at = now(),
         places_req = private.overpass_get('places', r.code, r.attempt),
         points_req = private.overpass_get('points', r.code, r.attempt)
   where code = r.code;
  return r.code;
end $function$
;

CREATE OR REPLACE FUNCTION private.on_auth_user_created()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare invite private.admin_invites;
begin
  if new.email_confirmed_at is null then return new; end if;
  select * into invite from private.admin_invites where lower(email) = lower(new.email);
  if found then
    insert into public.admins (user_id, email, role) values (new.id, new.email, invite.role)
    on conflict (user_id) do nothing;
  end if;
  return new;
end $function$
;

CREATE OR REPLACE FUNCTION private.on_ingest_run_done()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if new.finished_at is not null and (old.finished_at is null or tg_op = 'INSERT') then
    insert into public.admin_logs (kind, source, status, message, duration_ms, details)
    values (case when split_part(new.kind, ' ', 1) in ('osm', 'pdok', 'merge_master', 'promote') then 'sync' else 'scraper' end,
            left(new.kind, 60), case when new.status = 'ok' then 'ok' when new.status = 'error' then 'failed' else 'warn' end,
            left(coalesce(new.stats ->> 'error', new.stats ->> 'region', new.kind), 1000),
            (extract(epoch from new.finished_at - new.started_at) * 1000)::integer,
            coalesce(new.stats, '{}') || jsonb_build_object('run', new.id));
  end if;
  return new;
end $function$
;

CREATE OR REPLACE FUNCTION private.on_submission_queue()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  perform private.queue_from_submission(new);
  return new;
end $function$
;

CREATE OR REPLACE FUNCTION private.ops_probe()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  t record;
  rid bigint;
  last_run bigint;
  n_resolved integer;
  n_cron integer;
begin
  update public.admin_logs l
     set status = case when r.timed_out or r.error_msg is not null or r.status_code >= 400 then 'failed' else 'ok' end,
         http_status = r.status_code,
         duration_ms = greatest(0, (extract(epoch from r.created - l.ts) * 1000)::integer),
         message = coalesce(left(r.error_msg, 300), case when r.timed_out then 'time-out' end,
                            'HTTP ' || r.status_code)
    from net._http_response r
   where l.status = 'pending' and l.kind = 'api' and r.id = l.request_id;
  get diagnostics n_resolved = row_count;
  update public.admin_logs set status = 'failed', message = 'Geen antwoord binnen 30 minuten'
   where status = 'pending' and kind = 'api' and ts < now() - interval '30 minutes';

  for t in select * from (values
      ('pdok', 'https://api.pdok.nl/bzk/locatieserver/search/v3_1/suggest?q=utrecht&rows=1'),
      ('osrm', 'https://routing.openstreetmap.de/routed-car/route/v1/driving/5.12,52.09;5.38,52.24?overview=false'),
      ('overpass', 'https://overpass-api.de/api/status'),
      ('openfreemap', 'https://tiles.openfreemap.org/styles/liberty'),
      ('wsrv', 'https://wsrv.nl/?url=wsrv.nl/lichtenstein.jpg&w=16'),
      ('site', 'https://camperdashboard-vrijstaan.vercel.app/api/towns')
    ) as v(source, url) loop
    rid := net.http_get(url := t.url, timeout_milliseconds := 15000);
    insert into public.admin_logs (kind, source, status, request_id, details)
    values ('api', t.source, 'pending', rid, jsonb_build_object('url', t.url));
  end loop;

  select coalesce(max((details ->> 'runid')::bigint), 0) into last_run from public.admin_logs where kind = 'cron';
  insert into public.admin_logs (ts, kind, source, status, message, details)
  select d.start_time, 'cron', j.jobname, 'failed', left(d.return_message, 1000),
         jsonb_build_object('runid', d.runid, 'job', j.jobid)
    from cron.job_run_details d join cron.job j using (jobid)
   where d.runid > last_run and d.status = 'failed';
  get diagnostics n_cron = row_count;
  if last_run = 0 and n_cron = 0 then
    insert into public.admin_logs (kind, source, status, message, details)
    select 'cron', 'pg_cron', 'ok', 'Bewaking gestart', jsonb_build_object('runid', coalesce(max(runid), 0))
      from cron.job_run_details;
  end if;

  delete from public.admin_logs where (status = 'ok' and ts < now() - interval '30 days') or ts < now() - interval '180 days';
  return jsonb_build_object('resolved', n_resolved, 'cron_failed', n_cron);
end $function$
;

CREATE OR REPLACE FUNCTION private.overpass_get(p_name text, p_region text)
 RETURNS bigint
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select net.http_get('https://overpass-api.de/api/interpreter',
    params := jsonb_build_object('data', format((select template from public.osm_queries where name = p_name), p_region)),
    headers := '{"User-Agent":"VrijStaanBot/1.0 (+https://vrijstaan.nl/bot)"}'::jsonb,
    timeout_milliseconds := 120000);
$function$
;

CREATE OR REPLACE FUNCTION private.overpass_get(p_name text, p_region text, p_mirror integer DEFAULT 0)
 RETURNS bigint
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select net.http_get(
    (array['https://overpass-api.de/api/interpreter',
           'https://overpass.kumi.systems/api/interpreter',
           'https://overpass.private.coffee/api/interpreter'])[1 + (p_mirror % 3)],
    params := jsonb_build_object('data', format((select template from public.osm_queries where name = p_name), p_region)),
    headers := '{"User-Agent":"VrijStaanBot/1.0 (+https://vrijstaan.nl/bot)"}'::jsonb,
    timeout_milliseconds := 120000);
$function$
;

CREATE OR REPLACE FUNCTION private.photo_rate_limit()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if (select count(*) from public.place_photos where user_id = new.user_id and created_at > now() - interval '1 day') >= 20 then
    raise exception 'Je hebt vandaag al veel foto''s gestuurd. Probeer het morgen weer.';
  end if;
  return new;
end $function$
;

CREATE OR REPLACE FUNCTION private.places_before_write()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare t numeric := coalesce((select (value #>> '{}')::numeric from public.site_settings where key = 'publish_threshold'), 0.7);
begin
  if new.image_url like '%&#%' or new.photos::text like '%&#%' then
    new.image_url := private.decode_entities(new.image_url);
    new.photos := (select coalesce(jsonb_agg(jsonb_set(ph, '{url}', to_jsonb(private.decode_entities(ph->>'url')))), '[]'::jsonb)
                     from jsonb_array_elements(new.photos) ph);
  end if;
  if tg_op = 'UPDATE'
     and (new.departure, new.checkout_until, new.times_note) is distinct from (old.departure, old.checkout_until, old.times_note)
     and new.departure_checked_at is not distinct from old.departure_checked_at then
    new.departure_check := null;
    new.departure_checked_at := null;
    new.departure_checked_by := null;
  end if;
  new.updated_at := now();
  new.completeness := public.place_completeness(new);
  if not new.status_locked then
    new.status := case when new.completeness >= t and public.place_meets_must_haves(new) then 'published' else 'draft' end;
  end if;
  return new;
end $function$
;

CREATE OR REPLACE FUNCTION private.publish_threshold()
 RETURNS numeric
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
  select coalesce((select (value #>> '{}')::numeric from public.site_settings where key = 'publish_threshold'), 0.8);
$function$
;

CREATE OR REPLACE FUNCTION private.queue_fields()
 RETURNS text[]
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO ''
AS $function$
  select array['power', 'water', 'dump_station', 'toilet', 'shower', 'wifi', 'dogs', 'departure', 'checkout_until',
               'checkin_from', 'checkin_until', 'price_eur', 'price_note', 'capacity', 'max_length_m', 'open_all_year',
               'season', 'reservation', 'max_stay_nights', 'website', 'phone', 'email', 'operator']
$function$
;

CREATE OR REPLACE FUNCTION private.queue_from_submission(s public.submissions)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  cur jsonb;
  n integer := 0;
  k text;
  v jsonb;
  v_kind text;
  v_raw text;
  v_time text;
  v_parts text[];
  v_text text;
begin
  if s.place_id is null or s.kind <> 'correctie' then return 0; end if;
  select to_jsonb(p) into cur from public.places p where p.id = s.place_id;
  if cur is null then return 0; end if;

  if jsonb_typeof(s.payload -> 'voorzieningen') = 'object' then
    for k, v in select * from jsonb_each(s.payload -> 'voorzieningen') loop
      continue when not (k = any (private.queue_fields())) or not (v ? 'nieuw');
      insert into public.updates_queue (place_id, field_changed, old_value, new_value, submission_id, user_id)
      values (s.place_id, k, cur -> k, v -> 'nieuw', s.id, s.user_id)
      on conflict (submission_id, field_changed) do nothing;
      n := n + 1;
    end loop;
  elsif s.payload ->> 'veld' = any (private.queue_fields()) and s.payload ? 'voorstel' then
    insert into public.updates_queue (place_id, field_changed, old_value, new_value, submission_id, user_id)
    values (s.place_id, s.payload ->> 'veld', cur -> (s.payload ->> 'veld'), s.payload -> 'voorstel', s.id, s.user_id)
    on conflict (submission_id, field_changed) do nothing;
    n := 1;
  elsif s.payload ->> 'onderwerp' = 'vertrektijd'
        or (s.payload ->> 'veld' = 'vertrektijd' and jsonb_typeof(s.payload -> 'voorstel') = 'string') then
    if s.payload ->> 'onderwerp' = 'vertrektijd' then
      v_raw := trim(coalesce(s.payload ->> 'vertrek_uiterlijk', ''));
      v_kind := s.payload ->> 'vertrek';
    else
      v_text := lower(trim(s.payload ->> 'voorstel'));
      v_raw := coalesce(substring(v_text from '([0-9]{1,2}[:.][0-9]{2})'), '');
      v_kind := case
        when v_text ~ 'per ?24' then 'per24'
        when v_text ~ '^(vrij|geen vaste)' then 'vrij'
        when v_text ~ '^vast' or v_raw <> '' then 'vast'
      end;
    end if;
    v_parts := regexp_match(v_raw, '^([01]?[0-9]|2[0-3])[:.]([0-5][0-9])$');
    if v_parts is not null then v_time := lpad(v_parts[1], 2, '0') || ':' || v_parts[2]; end if;
    if v_kind is null and v_time is not null then v_kind := 'vast'; end if;
    if v_kind is null or v_kind not in ('vrij', 'per24', 'vast') or (v_kind = 'vast' and v_time is null) then return 0; end if;

    if cur ->> 'departure' is distinct from v_kind then
      insert into public.updates_queue (place_id, field_changed, old_value, new_value, submission_id, user_id)
      values (s.place_id, 'departure', cur -> 'departure', to_jsonb(v_kind), s.id, s.user_id)
      on conflict (submission_id, field_changed) do nothing;
      n := n + 1;
    end if;
    if (v_kind = 'vast' and cur ->> 'checkout_until' is distinct from v_time)
       or (v_kind <> 'vast' and cur ->> 'checkout_until' is not null) then
      insert into public.updates_queue (place_id, field_changed, old_value, new_value, submission_id, user_id)
      values (s.place_id, 'checkout_until', cur -> 'checkout_until', coalesce(to_jsonb(v_time), 'null'::jsonb), s.id, s.user_id)
      on conflict (submission_id, field_changed) do nothing;
      n := n + 1;
    end if;
  end if;
  return n;
end $function$
;

CREATE OR REPLACE FUNCTION private.rate_take(p_bucket text, p_limit integer, p_window interval)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
end $function$
;

CREATE OR REPLACE FUNCTION private.refresh_place_rating()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare pid uuid := coalesce(new.place_id, old.place_id);
begin
  update public.places p set rating_avg = s.avg, rating_count = s.cnt
    from (select round(avg(rating)::numeric,1) as avg, count(*)::int as cnt
            from public.reviews where place_id = pid and status = 'approved') s
   where p.id = pid;
  return null;
end;
$function$
;

CREATE OR REPLACE FUNCTION private.safe_path(p text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO ''
AS $function$ select regexp_replace(left(p, 300), '^/support/[^/?#]+', '/support/[token]') $function$
;

CREATE OR REPLACE FUNCTION private.shared_trip_touch()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end $function$
;

CREATE OR REPLACE FUNCTION private.sync_place_photo()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare url text := 'https://qkrmthrhwmmmwswmfgwc.supabase.co/storage/v1/object/public/place-photos/' || new.storage_path;
begin
  if new.status = 'approved' and old.status is distinct from 'approved' then
    update public.places
    set photos = coalesce(photos, '[]'::jsonb) || jsonb_build_array(jsonb_strip_nulls(jsonb_build_object(
          'url', url, 'credit', coalesce(new.credit, 'Bezoeker van VrijStaan'), 'caption', new.caption, 'user', true)))
    where id = new.place_id and not coalesce(photos, '[]'::jsonb) @> jsonb_build_array(jsonb_build_object('url', url));
  elsif new.status <> 'approved' and old.status = 'approved' then
    update public.places
    set photos = (select coalesce(jsonb_agg(p), '[]'::jsonb) from jsonb_array_elements(photos) p where p->>'url' <> url)
    where id = new.place_id;
  end if;
  if new.status <> old.status then
    new.reviewed_at := now();
    new.reviewed_by := case when public.is_admin() then auth.uid() end;
  end if;
  return new;
end $function$
;

CREATE OR REPLACE FUNCTION private.sync_profile_role()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if tg_op = 'DELETE' then
    update public.profiles set role = 'user' where id = old.user_id;
    return old;
  end if;
  insert into public.profiles (id, role) values (new.user_id, new.role)
  on conflict (id) do update set role = excluded.role;
  return new;
end $function$
;

CREATE OR REPLACE FUNCTION private.time_minutes(t text)
 RETURNS integer
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO ''
AS $function$
  select case when m is null or m[1]::int > 24 or m[2]::int > 59 then null else m[1]::int * 60 + m[2]::int end
  from (select regexp_match(coalesce(t, ''), '^\s*(\d{1,2})[:.](\d{2})\s*$') as m) x
$function$
;

CREATE OR REPLACE FUNCTION private.touch_ticket()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  update public.tickets set updated_at = now(),
    status = case when new.author = 'support' and not new.internal and status in ('open','in-behandeling') then 'wacht-op-klant' else status end
   where id = new.ticket_id;
  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION private.touch_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin new.updated_at := now(); return new; end $function$
;

CREATE OR REPLACE FUNCTION private.user_trust(p_user uuid)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  with cfg as (
    select coalesce((value->>'auto_approve_min_approved')::int, 3) as min_ok,
           coalesce((value->>'min_account_age_days')::int, 1) as min_age
    from (select (select value from public.site_settings where key = 'trust') as value) s
  ), stats as (
    select count(*) filter (where status = 'approved')::int as approved,
           count(*) filter (where status = 'rejected')::int as rejected,
           count(*) filter (where status = 'pending')::int as pending
    from public.place_photos where user_id = p_user
  ), acct as (select created_at from auth.users where id = p_user)
  select jsonb_build_object(
    'approved', s.approved, 'rejected', s.rejected, 'pending', s.pending,
    'score', s.approved - 3 * s.rejected,
    'trusted', p_user is not null and s.approved >= c.min_ok and s.rejected = 0
               and coalesce((select created_at from acct) < now() - make_interval(days => c.min_age), false))
  from stats s, cfg c;
$function$
;

CREATE OR REPLACE FUNCTION private.verwijder_onbereikbare_plekken(p_proef boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  n_geen_site int;
  n_dood int;
begin
  drop table if exists _weg;
  create temp table _weg on commit drop as
  select p.*,
         case when p.website is null then 'geen website'
              else 'website onleesbaar, ook met stealth: ' || left(p.sources->'stealth'->>'error', 120) end as reden
    from public.places p
   where p.merged_into is null
     and p.status <> 'published'
     and not p.status_locked
     and p.price_eur is null
     and p.departure is null
     -- coalesce: zonder sources.beheer zou een vergelijking met null de hele voorwaarde null maken (dan valt alles af)
     and coalesce(p.sources->'beheer', '{}'::jsonb) in ('{}'::jsonb, '[]'::jsonb)
     and not exists (select 1 from public.places m where m.merged_into = p.id)
     and (p.website is null
          or (p.sources->'stealth' ? 'error'
              and not exists (select 1 from private.stealth_queue q where q.place_id = p.id and q.done_at is null)));

  select count(*) filter (where website is null), count(*) filter (where website is not null)
    into n_geen_site, n_dood from _weg;

  if not p_proef then
    insert into private.verwijderde_plekken (id, osm_type, osm_id, slug, name, website, reden, gegevens)
    select w.id, w.osm_type, w.osm_id, w.slug, w.name, w.website, w.reden, to_jsonb(w) - 'reden' - 'geom'
      from _weg w
    on conflict (id) do nothing;
    delete from public.places p using _weg w where p.id = w.id;
  end if;

  return jsonb_build_object('proef', p_proef, 'geen_website', n_geen_site, 'website_dood', n_dood);
end $function$
;

CREATE OR REPLACE FUNCTION private.weiger_verwijderde_plek()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if new.osm_id is not null and exists (
    select 1 from private.verwijderde_plekken v where v.osm_type = new.osm_type and v.osm_id = new.osm_id
  ) then
    return null;
  end if;
  return new;
end $function$
;

CREATE OR REPLACE FUNCTION public.admin_apply_update(p_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  u public.updates_queue;
  rec public.places;
begin
  if not public.has_admin_role() then raise exception 'Geen toegang' using errcode = '42501'; end if;
  select * into u from public.updates_queue where id = p_id for update;
  if not found then raise exception 'Onbekende update'; end if;
  if u.status <> 'pending' then raise exception 'Deze update is al afgehandeld'; end if;
  if not (u.field_changed = any (private.queue_fields())) then
    raise exception 'Veld % kan niet via de inbox worden aangepast', u.field_changed;
  end if;

  rec := jsonb_populate_record(null::public.places, jsonb_build_object(u.field_changed, u.new_value));
  execute format('update public.places set %1$I = ($1).%1$I where id = $2', u.field_changed) using rec, u.place_id;
  perform public.admin_mark_beheer(u.place_id, array[u.field_changed]);

  update public.updates_queue set status = 'approved', decided_by = auth.uid(), decided_at = now() where id = u.id;
  perform private.close_submission(u.submission_id);
  insert into public.audit_log (actor, actor_email, action, entity, entity_id, details)
  values (auth.uid(), (select email from auth.users where id = auth.uid()), 'update_accepted', 'places', u.place_id::text,
          jsonb_build_object('veld', u.field_changed, 'was', u.old_value, 'nieuw', u.new_value, 'update', u.id,
                             'ai_score', u.ai_score));
  return jsonb_build_object('id', u.id, 'status', 'approved');
end $function$
;

CREATE OR REPLACE FUNCTION public.admin_concept_redenen()
 RETURNS TABLE(reden text, aantal bigint, met_website bigint, zonder_adres bigint)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if not public.is_admin() and current_user not in ('postgres', 'service_role') then raise exception 'Geen toegang'; end if;
  return query
    select r.reden, count(*), count(*) filter (where p.website is not null), count(*) filter (where p.street is null or p.postcode is null)
      from public.places p cross join lateral (select private.concept_reden(p) as reden) r
     where p.merged_into is null and p.status = 'draft'
     group by r.reden
     order by count(*) desc;
end $function$
;

CREATE OR REPLACE FUNCTION public.admin_duplicate_candidates(p_meters integer DEFAULT 150, p_limit integer DEFAULT 300)
 RETURNS TABLE(a_id uuid, a_slug text, a_name text, a_status text, a_lat double precision, a_lng double precision, a_osm boolean, a_completeness numeric, b_id uuid, b_slug text, b_name text, b_status text, b_lat double precision, b_lng double precision, b_osm boolean, b_completeness numeric, distance_m integer, name_similarity real)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare deg float8 := greatest(10, least(p_meters, 2000)) / 60000.0;
begin
  if not public.is_admin() then raise exception 'Geen toegang'; end if;
  return query
  select a.id, a.slug, a.name, a.status, a.lat, a.lng, a.osm_id is not null, a.completeness::numeric,
         b.id, b.slug, b.name, b.status, b.lat, b.lng, b.osm_id is not null, b.completeness::numeric,
         round(extensions.st_distance(a.geom::extensions.geography, b.geom::extensions.geography))::int,
         extensions.similarity(a.name, b.name)
  from public.places a
  join public.places b
    on a.id < b.id
   and b.geom operator(extensions.&&) extensions.st_expand(a.geom, deg)
  where a.merged_into is null and b.merged_into is null
    and a.status <> 'hidden' and b.status <> 'hidden'
    and extensions.st_dwithin(a.geom::extensions.geography, b.geom::extensions.geography, p_meters)
    and not exists (select 1 from public.duplicate_dismissals d where d.a = a.id and d.b = b.id)
  order by 17 asc, 18 desc
  limit greatest(1, least(p_limit, 1000));
end $function$
;

CREATE OR REPLACE FUNCTION public.admin_manual_review()
 RETURNS TABLE(place_id uuid, reden text, sinds timestamp with time zone)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if not public.is_admin() then raise exception 'Geen toegang'; end if;
  return query select m.place_id, m.reden, m.sinds from public.manual_review m where m.requires_manual_review order by m.sinds;
end $function$
;

CREATE OR REPLACE FUNCTION public.admin_mark_beheer(p_place_id uuid, p_fields text[])
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if not public.is_admin() then raise exception 'Geen toegang'; end if;
  update public.places
     set sources = jsonb_set(coalesce(sources, '{}'), '{beheer}', (
       select coalesce(jsonb_agg(f order by f), '[]'::jsonb)
         from (select jsonb_array_elements_text(coalesce(sources->'beheer', '[]')) f union select unnest(p_fields)) x))
   where id = p_place_id;
end $function$
;

CREATE OR REPLACE FUNCTION public.admin_merge_places(p_keep uuid, p_remove uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare k public.places; r public.places;
begin
  if not public.is_admin() then raise exception 'Geen toegang'; end if;
  if p_keep = p_remove then raise exception 'Kies twee verschillende plekken'; end if;
  select * into k from public.places where id = p_keep for update;
  select * into r from public.places where id = p_remove for update;
  if k.id is null or r.id is null then raise exception 'Plek niet gevonden'; end if;
  if k.merged_into is not null then raise exception 'De plek die je bewaart is zelf al samengevoegd'; end if;
  if r.merged_into is not null then raise exception 'Deze plek is al samengevoegd'; end if;

  update public.places p set
    street = coalesce(k.street, r.street), postcode = coalesce(k.postcode, r.postcode),
    description = coalesce(k.description, r.description), description_source = coalesce(k.description_source, r.description_source),
    price_eur = coalesce(k.price_eur, r.price_eur), price_note = coalesce(k.price_note, r.price_note),
    tourist_tax_included = coalesce(k.tourist_tax_included, r.tourist_tax_included),
    power = coalesce(k.power, r.power), water = coalesce(k.water, r.water), dump_station = coalesce(k.dump_station, r.dump_station),
    toilet = coalesce(k.toilet, r.toilet), shower = coalesce(k.shower, r.shower), wifi = coalesce(k.wifi, r.wifi),
    dogs = coalesce(k.dogs, r.dogs), capacity = coalesce(k.capacity, r.capacity), max_length_m = coalesce(k.max_length_m, r.max_length_m),
    surface = coalesce(k.surface, r.surface), open_all_year = coalesce(k.open_all_year, r.open_all_year),
    season = coalesce(k.season, r.season), reservation = coalesce(k.reservation, r.reservation),
    max_stay_nights = coalesce(k.max_stay_nights, r.max_stay_nights),
    website = coalesce(k.website, r.website), phone = coalesce(k.phone, r.phone), email = coalesce(k.email, r.email),
    image_url = coalesce(k.image_url, r.image_url), image_credit = case when k.image_url is null then r.image_credit else k.image_credit end,
    photos = coalesce(k.photos, '[]'::jsonb) || coalesce((
      select jsonb_agg(ph) from jsonb_array_elements(coalesce(r.photos, '[]'::jsonb)) ph
      where not coalesce(k.photos, '[]'::jsonb) @> jsonb_build_array(jsonb_build_object('url', ph->>'url'))), '[]'::jsonb),
    departure = coalesce(k.departure, r.departure), checkout_until = coalesce(k.checkout_until, r.checkout_until),
    checkin_from = coalesce(k.checkin_from, r.checkin_from), access_hours = coalesce(k.access_hours, r.access_hours),
    access_24h = coalesce(k.access_24h, r.access_24h), times_note = coalesce(k.times_note, r.times_note),
    price_extras = coalesce(k.price_extras, r.price_extras),
    sources = coalesce(k.sources, '{}'::jsonb) || jsonb_build_object('merged', coalesce(k.sources->'merged', '[]'::jsonb) || to_jsonb(r.slug))
  where p.id = k.id;

  update public.reviews set place_id = k.id where place_id = r.id;
  update public.place_photos set place_id = k.id where place_id = r.id;
  update public.tickets set place_id = k.id where place_id = r.id;
  update public.submissions set place_id = k.id where place_id = r.id;
  update public.places set merged_into = k.id where merged_into = r.id;
  update public.places set status = 'hidden', status_locked = true, merged_into = k.id where id = r.id;

  return jsonb_build_object('keep', k.slug, 'removed', r.slug);
end $function$
;

CREATE OR REPLACE FUNCTION public.admin_overview()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare out jsonb;
begin
  if not public.is_admin() then raise exception 'Geen toegang'; end if;
  select jsonb_build_object(
    'places', (select jsonb_build_object(
        'total', count(*),
        'published', count(*) filter (where status = 'published'),
        'draft', count(*) filter (where status = 'draft'),
        'hidden', count(*) filter (where status = 'hidden'),
        'locked', count(*) filter (where status_locked),
        'near', count(*) filter (where status = 'draft' and completeness >= 0.6),
        'blocked_contact', count(*) filter (where status = 'draft' and website is null and phone is null),
        'blocked_facts', count(*) filter (where status = 'draft' and ((price_eur is not null)::int + (open_all_year is not null or season is not null)::int + (power is not null)::int) < 2),
        'blocked_score', count(*) filter (where status = 'draft' and public.place_meets_must_haves(places) and completeness < (select (value #>> '{}')::numeric from public.site_settings where key = 'publish_threshold')),
        'with_website', count(*) filter (where website is not null)
      ) from public.places),
    'buckets', (select coalesce(jsonb_agg(jsonb_build_object('from', b, 'count', c) order by b), '[]') from (
        select floor(completeness * 10) / 10 as b, count(*) c from public.places group by 1) x),
    'coverage', (select jsonb_build_object(
        'price', count(*) filter (where price_eur is not null),
        'power', count(*) filter (where power is not null),
        'water', count(*) filter (where water is not null),
        'dump_station', count(*) filter (where dump_station is not null),
        'toilet', count(*) filter (where toilet is not null),
        'shower', count(*) filter (where shower is not null),
        'wifi', count(*) filter (where wifi is not null),
        'dogs', count(*) filter (where dogs is not null),
        'capacity', count(*) filter (where capacity is not null),
        'season', count(*) filter (where open_all_year is not null or season is not null),
        'photos', count(*) filter (where jsonb_array_length(coalesce(photos, '[]')) > 0 or image_url is not null),
        'description', count(*) filter (where description is not null),
        'phone', count(*) filter (where phone is not null),
        'total', count(*)
      ) from public.places),
    'kinds', (select jsonb_object_agg(kind, c) from (select kind, count(*) c from public.places where status = 'published' group by 1) k),
    'provinces', (select jsonb_object_agg(province, c) from (select coalesce(province, 'onbekend') province, count(*) c from public.places where status = 'published' group by 1) k),
    'scrape', (select jsonb_build_object(
        'queued', count(*) filter (where done_at is null and attempts < 3),
        'done', count(*) filter (where done_at is not null and last_error is null),
        'failed', count(*) filter (where last_error is not null),
        'last', max(done_at)
      ) from private.scrape_queue),
    'osm', (select coalesce(jsonb_agg(jsonb_build_object('code', code, 'name', name, 'last_run_at', last_run_at, 'busy', places_req is not null) order by name), '[]') from public.osm_regions),
    'support', jsonb_build_object(
        'open_tickets', (select count(*) from public.tickets where status in ('open', 'in-behandeling')),
        'pending_reviews', (select count(*) from public.reviews where status = 'pending'),
        'new_submissions', (select count(*) from public.submissions where status = 'nieuw'),
        'errors_24h', (select count(*) from public.app_logs where level = 'error' and ts > now() - interval '24 hours')
      ),
    'traffic', (select coalesce(jsonb_agg(jsonb_build_object('day', d, 'views', v, 'sessions', s, 'searches', q, 'outbound', o) order by d), '[]') from (
        select date_trunc('day', ts)::date d,
               count(*) filter (where name = 'page_view') v,
               count(distinct session_id) s,
               count(*) filter (where name = 'search') q,
               count(*) filter (where name = 'outbound') o
          from public.events where ts > now() - interval '14 days' group by 1) t),
    'top_pages', (select coalesce(jsonb_agg(jsonb_build_object('path', path, 'views', c) order by c desc), '[]') from (
        select path, count(*) c from public.events where name = 'page_view' and ts > now() - interval '30 days' group by 1 order by 2 desc limit 10) t),
    'consent', (select jsonb_build_object(
        'total', count(*),
        'analytics', count(*) filter (where analytics),
        'marketing', count(*) filter (where marketing),
        'last_30d', count(*) filter (where ts > now() - interval '30 days')
      ) from public.consent_log)
  ) into out;
  return out;
end $function$
;

CREATE OR REPLACE FUNCTION public.admin_pipeline(p_action text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare n int := 0; t numeric;
begin
  if not public.is_admin() then raise exception 'Geen toegang'; end if;
  insert into public.audit_log (actor, actor_email, action, entity, entity_id, details)
  values (auth.uid(), (select email from public.admins where user_id = auth.uid()), 'pipeline', 'pipeline', p_action, '{}'::jsonb);
  if p_action = 'scrape-missing' then
    perform public.enqueue_scrape(true);
  elsif p_action = 'scrape-all' then
    perform public.enqueue_scrape(false);
  elsif p_action = 'osm-refresh' then
    update public.osm_regions set last_run_at = null where places_req is null;
  elsif p_action = 'apply-threshold' then
    t := private.publish_threshold();
    -- Massa-update niet per rij in het auditlog zetten
    perform set_config('request.jwt.claims', '{}', true);
    update public.places set updated_at = now()
     where not status_locked and ((completeness >= t) <> (status = 'published'));
    get diagnostics n = row_count;
  else
    raise exception 'Onbekende actie %', p_action;
  end if;
  return n::text;
end $function$
;

CREATE OR REPLACE FUNCTION public.admin_reject_update(p_id uuid, p_note text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare u public.updates_queue;
begin
  if not public.has_admin_role() then raise exception 'Geen toegang' using errcode = '42501'; end if;
  update public.updates_queue set status = 'rejected', decided_by = auth.uid(), decided_at = now()
   where id = p_id and status = 'pending' returning * into u;
  if not found then raise exception 'Onbekende of al afgehandelde update'; end if;
  perform private.close_submission(u.submission_id, p_note);
  insert into public.audit_log (actor, actor_email, action, entity, entity_id, details)
  values (auth.uid(), (select email from auth.users where id = auth.uid()), 'update_rejected', 'places', u.place_id::text,
          jsonb_build_object('veld', u.field_changed, 'nieuw', u.new_value, 'update', u.id, 'notitie', p_note));
  return jsonb_build_object('id', u.id, 'status', 'rejected');
end $function$
;

CREATE OR REPLACE FUNCTION public.admin_stats(p_days integer DEFAULT 30)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare d int := greatest(1, least(coalesce(p_days, 30), 400)); since timestamptz := now() - make_interval(days => d);
begin
  if not public.is_admin() then raise exception 'Geen toegang'; end if;
  return jsonb_build_object(
    'days', d,
    'totals', (select jsonb_build_object(
        'page_views', count(*) filter (where name = 'page_view'),
        'sessions', count(distinct session_id),
        'searches', count(*) filter (where name = 'search'),
        'place_views', count(*) filter (where name = 'place_view'),
        'outbound', count(*) filter (where name = 'outbound'),
        'routes', count(*) filter (where name = 'route'),
        'saves', count(*) filter (where name = 'save'))
      from public.events where ts >= since),
    'per_day', (select coalesce(jsonb_agg(x order by x->>'day'), '[]') from (
        select jsonb_build_object('day', to_char(date_trunc('day', ts at time zone 'Europe/Amsterdam'), 'YYYY-MM-DD'),
          'page_views', count(*) filter (where name = 'page_view'), 'sessions', count(distinct session_id)) x
        from public.events where ts >= since group by date_trunc('day', ts at time zone 'Europe/Amsterdam')) s),
    'top_pages', (select coalesce(jsonb_agg(jsonb_build_object('path', path, 'n', n) order by n desc), '[]') from (
        select path, count(*) n from public.events where ts >= since and name = 'page_view' group by path order by n desc limit 15) s),
    'top_searches', (select coalesce(jsonb_agg(jsonb_build_object('q', q, 'n', n) order by n desc), '[]') from (
        select lower(trim(coalesce(props->>'q', props->>'waar', props->>'provincie'))) q, count(*) n from public.events
        where ts >= since and name = 'search' and coalesce(trim(coalesce(props->>'q', props->>'waar', props->>'provincie')), '') <> '' group by 1 order by n desc limit 15) s),
    'top_places', (select coalesce(jsonb_agg(jsonb_build_object('slug', slug, 'name', name, 'views', views, 'routes', routes, 'outbound', outbound) order by views desc), '[]') from (
        select coalesce(e.props->>'slug', substring(e.path from '^/plek/([^/?#]+)')) slug, max(p.name) name,
          count(*) filter (where e.name = 'place_view') views, count(*) filter (where e.name = 'route') routes,
          count(*) filter (where e.name = 'outbound') outbound
        from public.events e left join public.places p on p.slug = coalesce(e.props->>'slug', substring(e.path from '^/plek/([^/?#]+)'))
        where e.ts >= since and e.name in ('place_view','route','outbound') and (e.props ? 'slug' or e.path like '/plek/%')
        group by 1 order by views desc limit 15) s),
    'consent', (select jsonb_build_object('total', count(*), 'analytics', count(*) filter (where analytics))
        from (select distinct on (consent_id) consent_id, analytics from public.consent_log where ts >= since order by consent_id, ts desc) c)
  );
end $function$
;

CREATE OR REPLACE FUNCTION public.apply_discovery(p_id uuid, p_url text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  update public.places
     set website = coalesce(website, p_url),
         sources = coalesce(sources, '{}'::jsonb) || jsonb_build_object('discovery', jsonb_build_object('at', now(), 'url', p_url))
   where id = p_id;
  if p_url is not null then
    insert into private.scrape_queue (place_id) values (p_id)
    on conflict (place_id) do update set done_at = null, attempts = 0, next_attempt_at = now(), last_error = null;
  end if;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.apply_pdok(p_id uuid, p_street text, p_postcode text, p_afstand integer)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  p public.places;
  beheer jsonb;
  new_street text;
  new_postcode text;
begin
  select * into p from public.places where id = p_id for update;
  if not found then return; end if;
  beheer := coalesce(p.sources->'beheer', '[]'::jsonb);
  new_street := p.street;
  new_postcode := p.postcode;
  if p_street is not null then
    if p.street is null and not (beheer ? 'street') then
      new_street := p_street;
      if p.postcode is null and not (beheer ? 'postcode') then new_postcode := p_postcode; end if;
    elsif p.postcode is null and not (beheer ? 'postcode') and lower(p.street) = lower(p_street) then
      new_postcode := p_postcode;
    end if;
  end if;
  update public.places
     set street = new_street,
         postcode = new_postcode,
         sources = coalesce(sources, '{}'::jsonb) || jsonb_build_object('pdok', jsonb_build_object(
           'at', now(), 'afstand', p_afstand,
           'velden', to_jsonb(array_remove(array[
             case when new_street is distinct from p.street then 'street' end,
             case when new_postcode is distinct from p.postcode then 'postcode' end], null))))
   where id = p_id;
end $function$
;

CREATE OR REPLACE FUNCTION public.apply_scrape(p_id uuid, p_data jsonb, p_error text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  p public.places;
  r public.places;
  prev jsonb;
  patch jsonb := '{}'::jsonb;
  applied jsonb := '[]'::jsonb;
  n_found int := 0;
  f text;
  old jsonb;
  fields text[] := array['price_eur','tourist_tax_included','power','water','dump_station','toilet','shower','wifi','dogs',
                         'capacity','max_length_m','open_all_year','season','reservation','phone','email','street','postcode',
                         'description','image_url','departure','checkout_until','checkin_from','checkin_until','access_hours','access_24h','times_note','price_extras',
                         'reservation_rule'];
  priority text[] := array['price_extras','price_eur','open_all_year','season','departure','checkout_until','checkin_from','access_hours','times_note'];
  keep text[] := array['price_extras','price_eur','open_all_year','season','departure','checkout_until','checkin_from','times_note'];
begin
  if p_error is not null then
    update private.scrape_queue set last_error = left(p_error, 500) where place_id = p_id;
    if (select attempts from private.scrape_queue where place_id = p_id) >= 3 then
      update private.scrape_queue set done_at = now() where place_id = p_id;
      update public.places
         set last_scraped_at = now(),
             sources = coalesce(sources, '{}'::jsonb) || jsonb_build_object('website_error', jsonb_build_object('at', now(), 'error', left(p_error, 200)))
       where id = p_id;
    end if;
    return;
  end if;

  select * into p from public.places where id = p_id for update;
  if not found then return; end if;
  prev := coalesce(p.sources->'website_fields', '[]'::jsonb);

  foreach f in array fields loop
    continue when p.sources->'beheer' ? f;
    old := to_jsonb(p)->f;
    if p_data ? f then
      if f = any(priority) or old is null or old = 'null'::jsonb or prev ? f then
        patch := patch || jsonb_build_object(f, p_data->f);
        applied := applied || to_jsonb(f);
      end if;
      n_found := n_found + 1;
    elsif prev ? f and not (p_data ? '_pages_failed')
          and (not (f = any(keep)) or (p_data ? '_parser' and p_data->>'_parser' is distinct from p.sources->>'website_parser')) then
      patch := patch || jsonb_build_object(f, null);
    elsif prev ? f then
      applied := applied || to_jsonb(f);
    end if;
  end loop;
  if patch ? 'departure' and patch->>'departure' is distinct from 'vast' and not coalesce(p.sources->'beheer' ? 'checkout_until', false) then
    patch := patch || jsonb_build_object('checkout_until', null);
  end if;

  if patch ? 'price_eur' then patch := patch || jsonb_build_object('price_note', p_data->'price_note'); end if;
  if patch ? 'description' then
    patch := patch || jsonb_build_object('description_source', case when patch->>'description' is null then null else 'website' end);
  end if;
  if patch ? 'image_url' then
    patch := patch || jsonb_build_object('image_credit', case when patch->>'image_url' is null then null else coalesce(p_data->>'image_credit', p.website) end);
  end if;

  r := jsonb_populate_record(p, patch);
  update public.places t set
    price_eur = r.price_eur, price_note = r.price_note, tourist_tax_included = r.tourist_tax_included,
    power = r.power, water = r.water, dump_station = r.dump_station, toilet = r.toilet, shower = r.shower,
    wifi = r.wifi, dogs = r.dogs, capacity = r.capacity, max_length_m = r.max_length_m,
    open_all_year = r.open_all_year, season = r.season, reservation = r.reservation,
    phone = r.phone, email = r.email, street = r.street, postcode = r.postcode,
    description = r.description, description_source = r.description_source,
    image_url = r.image_url, image_credit = r.image_credit,
    departure = r.departure, checkout_until = r.checkout_until, checkin_from = r.checkin_from, checkin_until = r.checkin_until,
    reservation_rule = r.reservation_rule,
    access_hours = r.access_hours, access_24h = r.access_24h, times_note = r.times_note, price_extras = r.price_extras,
    photos = case when p_data ? 'photos' then p_data->'photos' when prev ? 'image_url' and not (p_data ? 'image_url') and not (p_data ? '_pages_failed') then '[]'::jsonb else t.photos end,
    sources = (coalesce(t.sources, '{}'::jsonb) - 'website_error') || jsonb_build_object('website', now(), 'website_fields', applied)
              || case when p_data ? '_parser' then jsonb_build_object('website_parser', p_data->>'_parser') else '{}'::jsonb end,
    last_scraped_at = now(),
    verified_at = case when n_found > 0 then now() else t.verified_at end
  where t.id = p_id;
  update private.scrape_queue set done_at = now(), last_error = null where place_id = p_id;
end $function$
;

CREATE OR REPLACE FUNCTION public.apply_stealth(p_id uuid, p_data jsonb, p_error text DEFAULT NULL::text, p_meta jsonb DEFAULT '{}'::jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
end $function$
;

CREATE OR REPLACE FUNCTION public.cache_route(p_key text, p_distance integer, p_duration integer, p_geometry jsonb, p_provider text)
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
  insert into public.route_cache (key, distance_m, duration_s, geometry, provider)
  values (left(p_key, 200), p_distance, p_duration, case when pg_column_size(p_geometry) > 200000 then null else p_geometry end, left(p_provider, 20))
  on conflict (key) do update set distance_m = excluded.distance_m, duration_s = excluded.duration_s,
    geometry = excluded.geometry, provider = excluded.provider, created_at = now();
$function$
;

CREATE OR REPLACE FUNCTION public.check_departure(p_id uuid, p_check text, p_by text DEFAULT 'beheer'::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if not public.is_admin() then
    raise exception 'Geen beheerrechten' using errcode = '42501';
  end if;
  if p_check is not null and p_check not in ('bevestigd', 'voorwaardelijk', 'afgewezen') then
    raise exception 'Onbekende controle: %', p_check;
  end if;
  if p_by not in ('beheer', 'eigenaar') then
    raise exception 'Onbekende bron: %', p_by;
  end if;
  if p_check = 'bevestigd' and not exists (select 1 from public.places where id = p_id and departure in ('vrij', 'per24')) then
    raise exception 'Alleen een plek met "geen vaste vertrektijd" of "per 24 uur" kan bevestigd worden';
  end if;
  update public.places set
    departure_check = p_check,
    departure_checked_at = case when p_check is null then null else now() end,
    departure_checked_by = case when p_check is null then null else p_by end
  where id = p_id;
end $function$
;

CREATE OR REPLACE FUNCTION public.create_shared_trip(p_stops jsonb, p_name text DEFAULT 'Onze reis'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare t public.shared_trips;
begin
  if auth.uid() is null then raise exception 'Log in om samen te plannen'; end if;
  if (select count(*) from public.shared_trips where owner_id = auth.uid()) >= 20 then raise exception 'Je hebt al veel gedeelde reizen.'; end if;
  insert into public.shared_trips (owner_id, name, stops, updated_by)
  values (auth.uid(), coalesce(nullif(trim(p_name), ''), 'Onze reis'), coalesce(p_stops, '[]'::jsonb), auth.uid())
  returning * into t;
  insert into public.shared_trip_members (trip_id, user_id, display_name)
  values (t.id, auth.uid(), (select display_name from public.profiles where id = auth.uid()));
  return jsonb_build_object('id', t.id, 'code', t.invite_code, 'name', t.name);
end $function$
;

CREATE OR REPLACE FUNCTION public.create_ticket(p_name text, p_email text, p_subject text, p_category text, p_body text, p_place_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(number bigint, access_token text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
end $function$
;

CREATE OR REPLACE FUNCTION public.crowd_status(p_place_id uuid)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  with recent as (
    select level, created_at, greatest(0.1, 1 - extract(epoch from now() - created_at) / 10800.0) as w
    from public.crowd_reports
    where place_id = p_place_id and created_at > now() - interval '3 hours'
  ), score as (
    select level, sum(w) as s from recent group by level
  )
  select jsonb_build_object(
    'reports', (select count(*) from recent),
    'last_at', (select max(created_at) from recent),
    'counts', coalesce((select jsonb_object_agg(level, n) from (select level, count(*) as n from recent group by level) c), '{}'::jsonb),
    'level', (select level from score order by s desc, case level when 'vol' then 0 when 'druk' then 1 else 2 end limit 1)
  );
$function$
;

CREATE OR REPLACE FUNCTION public.departure_visitors(p_place_id uuid)
 RETURNS integer
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select count(distinct s.user_id)::integer
    from public.submissions s
    join public.places p on p.id = s.place_id
   where s.place_id = p_place_id
     and p.status = 'published'
     and p.departure is not null
     and s.user_id is not null
     and s.kind = 'correctie'
     and s.payload ->> 'onderwerp' = 'vertrektijd'
     and s.status <> 'afgewezen'
     and s.created_at > now() - interval '2 years'
     and s.payload ->> 'vertrek' = p.departure
     and (p.departure <> 'vast' or s.payload ->> 'vertrek_uiterlijk' = p.checkout_until);
$function$
;

CREATE OR REPLACE FUNCTION public.enqueue_scrape(p_only_missing boolean DEFAULT true)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare n int;
begin
  if p_only_missing then
    insert into private.scrape_queue (place_id)
    select id from public.places where website is not null and last_scraped_at is null
    on conflict (place_id) do nothing;
  else
    insert into private.scrape_queue (place_id)
    select id from public.places where website is not null
    on conflict (place_id) do update set done_at = null, attempts = 0, next_attempt_at = now(), last_error = null;
  end if;
  get diagnostics n = row_count;
  return n;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.export_snapshot()
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select jsonb_build_object(
    'places', coalesce((select jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
      'id', id, 'slug', slug, 'name', name, 'kind', kind, 'lat', lat, 'lng', lng, 'street', street, 'postcode', postcode,
      'town', town, 'province', province, 'description', description, 'descriptionSource', description_source,
      'priceEur', price_eur, 'priceNote', price_note, 'touristTaxIncluded', tourist_tax_included, 'power', power,
      'water', water, 'dumpStation', dump_station, 'toilet', toilet, 'shower', shower, 'wifi', wifi, 'dogs', dogs,
      'capacity', capacity, 'maxLengthM', max_length_m, 'surface', surface, 'openAllYear', open_all_year, 'season', season,
      'reservation', reservation, 'maxStayNights', max_stay_nights, 'website', website, 'phone', phone, 'email', email,
      'imageUrl', image_url, 'imageCredit', image_credit, 'photos', photos, 'ratingAvg', rating_avg, 'ratingCount', rating_count,
      'completeness', completeness, 'verifiedAt', verified_at, 'updatedAt', updated_at,
      'departure', departure, 'checkoutUntil', checkout_until, 'checkinFrom', checkin_from, 'accessHours', access_hours,
      'access24h', access_24h, 'timesNote', times_note, 'priceExtras', price_extras,
      'departureCheck', departure_check, 'departureCheckedAt', departure_checked_at, 'departureCheckedBy', departure_checked_by)
      -- jsonb_build_object kan maximaal 100 argumenten aan: nieuwe velden in een tweede object
      || jsonb_build_object('checkinUntil', checkin_until, 'reservationRule', reservation_rule)) order by slug)
      from public.places where status = 'published'), '[]'::jsonb),
    'towns', (select jsonb_agg(jsonb_build_object('name', name, 'province', province, 'lat', lat, 'lng', lng) order by name) from public.nl_towns),
    'faq', (select jsonb_agg(jsonb_build_object('id', id, 'category', category, 'question', question, 'answer', answer, 'position', position) order by category, position) from public.faq where published),
    'reviews', coalesce((select jsonb_agg(jsonb_strip_nulls(jsonb_build_object('id', id, 'placeId', place_id, 'authorName', author_name, 'rating', rating,
      'scoreLocation', score_location, 'scoreQuiet', score_quiet, 'scoreFacilities', score_facilities, 'scoreValue', score_value,
      'title', title, 'body', body, 'vehicle', vehicle, 'visitedMonth', visited_month, 'createdAt', created_at))) from public.reviews where status = 'approved'), '[]'::jsonb)
  );
$function$
;

CREATE OR REPLACE FUNCTION public.get_ticket(p_token text)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select jsonb_build_object(
    'number', t.number, 'subject', t.subject, 'status', t.status, 'category', t.category,
    'name', t.name, 'created_at', t.created_at, 'updated_at', t.updated_at,
    'messages', coalesce((
      select jsonb_agg(jsonb_build_object('author', m.author, 'body', m.body, 'created_at', m.created_at) order by m.created_at)
        from public.ticket_messages m where m.ticket_id = t.id and not m.internal
    ), '[]'::jsonb)
  )
  from public.tickets t where t.access_token = p_token;
$function$
;

CREATE OR REPLACE FUNCTION public.has_admin_role()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select exists (select 1 from public.profiles where id = (select auth.uid()) and role = 'admin');
$function$
;

CREATE OR REPLACE FUNCTION public.ingest_osm(p_rows jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  r jsonb; town public.nl_towns; ins int := 0; upd int := 0; v_slug text; base text; n int;
  existing uuid; v_name text; generic boolean; v_town text;
begin
  for r in select * from jsonb_array_elements(p_rows) loop
    town := public.nearest_town((r->>'lat')::float8, (r->>'lng')::float8);
    v_town := coalesce(nullif(r->>'town', ''), town.name);
    v_name := nullif(trim(r->>'name'), '');
    generic := v_name is null;
    if generic then
      v_name := case r->>'kind' when 'camping' then 'Camping ' when 'parkeerplaats' then 'Camperparkeerplaats ' else 'Camperplaats ' end || v_town;
    end if;

    select id into existing from public.places where osm_type = r->>'osm_type' and osm_id = (r->>'osm_id')::bigint;
    if existing is null then
      base := public.slugify(v_name || case when generic then '' else '-' || v_town end);
      if base = '' then base := 'camperplaats'; end if;
      v_slug := base; n := 1;
      while exists (select 1 from public.places where slug = v_slug) loop
        n := n + 1; v_slug := base || '-' || n;
      end loop;
      insert into public.places (slug, osm_type, osm_id, name, name_is_generic, kind, lat, lng, street, postcode, town, province,
        description, description_source, price_eur, power, water, dump_station, toilet, shower, wifi, dogs,
        capacity, max_length_m, surface, open_all_year, season, reservation, website, phone, email, operator, image_url, image_credit,
        departure, checkout_until, checkin_from, max_stay_nights, access_24h, times_note, sources)
      values (v_slug, r->>'osm_type', (r->>'osm_id')::bigint, v_name, generic, r->>'kind',
        (r->>'lat')::float8, (r->>'lng')::float8, r->>'street', r->>'postcode',
        v_town, coalesce(nullif(r->>'province', ''), town.province),
        r->>'description', case when r ? 'description' then 'openstreetmap' end,
        (r->>'price_eur')::numeric,
        (r->>'power')::boolean, (r->>'water')::boolean, (r->>'dump_station')::boolean, (r->>'toilet')::boolean,
        (r->>'shower')::boolean, (r->>'wifi')::boolean, (r->>'dogs')::boolean,
        (r->>'capacity')::int, (r->>'max_length_m')::numeric, r->>'surface',
        (r->>'open_all_year')::boolean, r->>'season', (r->>'reservation')::boolean,
        r->>'website', r->>'phone', r->>'email', r->>'operator', r->>'image_url', r->>'image_credit',
        r->>'departure', r->>'checkout_until', r->>'checkin_from', (r->>'max_stay_nights')::int, (r->>'access_24h')::boolean,
        case when r ? 'departure' or r ? 'checkin_from' then 'Volgens OpenStreetMap' end,
        jsonb_build_object('osm', now()));
      ins := ins + 1;
    else
      -- Volgorde van gezag: beheer > eigen website (prijs, seizoen, tijden) > OpenStreetMap
      update public.places p set
        name = case when p.name_is_generic and not generic then v_name else p.name end,
        name_is_generic = p.name_is_generic and generic,
        kind = case when p.sources->'beheer' ? 'kind' then p.kind else coalesce(r->>'kind', p.kind) end,
        province = coalesce(nullif(r->>'province', ''), p.province),
        street = case when p.sources->'beheer' ? 'street' then p.street else coalesce(r->>'street', p.street) end,
        postcode = case when p.sources->'beheer' ? 'postcode' then p.postcode else coalesce(r->>'postcode', p.postcode) end,
        description = coalesce(p.description, r->>'description'),
        price_eur = case when p.sources->'beheer' ? 'price_eur' or p.sources->'website_fields' ? 'price_eur' then p.price_eur
                         else (r->>'price_eur')::numeric end,
        power = case when p.sources->'beheer' ? 'power' then p.power else coalesce((r->>'power')::boolean, p.power) end,
        water = case when p.sources->'beheer' ? 'water' then p.water else coalesce((r->>'water')::boolean, p.water) end,
        dump_station = case when p.sources->'beheer' ? 'dump_station' then p.dump_station else coalesce((r->>'dump_station')::boolean, p.dump_station) end,
        toilet = case when p.sources->'beheer' ? 'toilet' then p.toilet else coalesce((r->>'toilet')::boolean, p.toilet) end,
        shower = case when p.sources->'beheer' ? 'shower' then p.shower else coalesce((r->>'shower')::boolean, p.shower) end,
        wifi = case when p.sources->'beheer' ? 'wifi' then p.wifi else coalesce((r->>'wifi')::boolean, p.wifi) end,
        dogs = case when p.sources->'beheer' ? 'dogs' then p.dogs else coalesce((r->>'dogs')::boolean, p.dogs) end,
        capacity = case when p.sources->'beheer' ? 'capacity' then p.capacity else coalesce((r->>'capacity')::int, p.capacity) end,
        max_length_m = case when p.sources->'beheer' ? 'max_length_m' then p.max_length_m else coalesce((r->>'max_length_m')::numeric, p.max_length_m) end,
        surface = case when p.sources->'beheer' ? 'surface' then p.surface else coalesce(r->>'surface', p.surface) end,
        open_all_year = case when p.sources->'beheer' ? 'open_all_year' or p.sources->'website_fields' ? 'open_all_year' then p.open_all_year
                             else coalesce((r->>'open_all_year')::boolean, p.open_all_year) end,
        season = case when p.sources->'beheer' ? 'season' or p.sources->'website_fields' ? 'season' then p.season
                      else coalesce(r->>'season', p.season) end,
        reservation = case when p.sources->'beheer' ? 'reservation' then p.reservation else coalesce((r->>'reservation')::boolean, p.reservation) end,
        website = case when p.sources->'beheer' ? 'website' then p.website else coalesce(r->>'website', p.website) end,
        phone = case when p.sources->'beheer' ? 'phone' then p.phone else coalesce(r->>'phone', p.phone) end,
        email = case when p.sources->'beheer' ? 'email' then p.email else coalesce(r->>'email', p.email) end,
        operator = case when p.sources->'beheer' ? 'operator' then p.operator else coalesce(r->>'operator', p.operator) end,
        image_url = coalesce(p.image_url, r->>'image_url'),
        image_credit = case when p.image_url is null then r->>'image_credit' else p.image_credit end,
        departure = case when p.sources->'beheer' ? 'departure' or p.sources->'website_fields' ? 'departure' then p.departure
                         else coalesce(r->>'departure', p.departure) end,
        checkout_until = case when p.sources->'beheer' ? 'checkout_until' or p.sources->'website_fields' ? 'departure' then p.checkout_until
                              else coalesce(r->>'checkout_until', p.checkout_until) end,
        checkin_from = case when p.sources->'beheer' ? 'checkin_from' or p.sources->'website_fields' ? 'checkin_from' then p.checkin_from
                            else coalesce(r->>'checkin_from', p.checkin_from) end,
        times_note = case when p.sources->'beheer' ? 'departure' or p.sources->'website_fields' ? 'times_note' then p.times_note
                          when r ? 'departure' or r ? 'checkin_from' then 'Volgens OpenStreetMap' else p.times_note end,
        max_stay_nights = case when p.sources->'beheer' ? 'max_stay_nights' then p.max_stay_nights else coalesce((r->>'max_stay_nights')::int, p.max_stay_nights) end,
        access_24h = case when p.sources->'beheer' ? 'access_24h' or p.sources->'website_fields' ? 'access_24h' then p.access_24h
                          else coalesce((r->>'access_24h')::boolean, p.access_24h) end,
        sources = p.sources || jsonb_build_object('osm', now())
      where p.id = existing;
      upd := upd + 1;
    end if;
  end loop;
  return jsonb_build_object('inserted', ins, 'updated', upd);
end $function$
;

CREATE OR REPLACE FUNCTION public.ingest_osm_points(p_points jsonb)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare r jsonb; n int := 0; c int; v_lat float8; v_lng float8;
begin
  for r in select * from jsonb_array_elements(p_points) loop
    v_lat := (r->>'lat')::float8;
    v_lng := (r->>'lng')::float8;
    update public.places p
       set dump_station = case when r->>'type' = 'dump' then coalesce(p.dump_station, true) else p.dump_station end,
           water = case when r->>'type' in ('dump', 'water')
                        then coalesce(p.water, case when r->>'type' = 'water' or (r->>'water')::boolean then true end)
                        else p.water end
     where p.id = (
       select q.id from public.places q
        where q.merged_into is null
          and abs(q.lat - v_lat) < 0.002 and abs(q.lng - v_lng) < 0.003
          and (q.lat - v_lat) ^ 2 + ((q.lng - v_lng) * 0.62) ^ 2 < (150.0 / 111000) ^ 2
        order by (q.lat - v_lat) ^ 2 + ((q.lng - v_lng) * 0.62) ^ 2
        limit 1)
       -- Niets te doen (al bekend): niet aanraken, anders verandert updated_at zonder reden
       and ((r->>'type' = 'dump' and p.dump_station is null)
            or (p.water is null and (r->>'type' = 'water' or (r->>'water')::boolean)));
    get diagnostics c = row_count;
    n := n + c;
  end loop;
  return n;
end $function$
;

CREATE OR REPLACE FUNCTION public.is_admin()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select exists (select 1 from public.admins where user_id = (select auth.uid()));
$function$
;

CREATE OR REPLACE FUNCTION public.is_trip_member(p_trip uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select exists (select 1 from public.shared_trip_members where trip_id = p_trip and user_id = auth.uid() and left_at is null);
$function$
;

CREATE OR REPLACE FUNCTION public.join_shared_trip(p_code text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare t public.shared_trips;
begin
  if auth.uid() is null then raise exception 'Log in om mee te doen'; end if;
  select * into t from public.shared_trips where invite_code = p_code;
  if not found then raise exception 'Deze uitnodiging bestaat niet (meer)'; end if;
  if (select count(*) from public.shared_trip_members where trip_id = t.id and left_at is null and user_id <> auth.uid()) >= 6 then
    raise exception 'Deze reis heeft al 6 deelnemers.';
  end if;
  insert into public.shared_trip_members (trip_id, user_id, display_name)
  values (t.id, auth.uid(), (select display_name from public.profiles where id = auth.uid()))
  on conflict (trip_id, user_id) do update set left_at = null, joined_at = now();
  return jsonb_build_object('id', t.id, 'name', t.name, 'stops', t.stops);
end $function$
;

CREATE OR REPLACE FUNCTION public.leave_shared_trip(p_trip uuid)
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
  update public.shared_trip_members set left_at = now() where trip_id = p_trip and user_id = auth.uid();
$function$
;

CREATE OR REPLACE FUNCTION public.log_consent(p_consent_id text, p_analytics boolean, p_marketing boolean, p_version text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if not private.rate_take('consent:min', 60, interval '1 minute')
     or not private.rate_take('consent:dag', 3000, interval '1 day') then return; end if;
  insert into public.consent_log (consent_id, analytics, marketing, version)
  values (left(p_consent_id, 64), p_analytics, p_marketing, left(p_version, 20));
end $function$
;

CREATE OR REPLACE FUNCTION public.log_dependency(p_secret text, p_update jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  expected text;
  d public.dependency_updates;
begin
  select value into expected from public.internal_secrets where name = 'dependency_log_key';
  if expected is null or p_secret is null
     or extensions.digest(p_secret, 'sha256') <> extensions.digest(expected, 'sha256') then
    raise exception 'Geen toegang' using errcode = '42501';
  end if;
  if not private.rate_take('dependency_log', 200, interval '1 hour') then
    raise exception 'Te veel meldingen';
  end if;

  insert into public.dependency_updates (package_name, version_from, version_to, update_type, ecosystem, category,
    ai_advice, ai_model, status, pr_number, pr_url)
  values (p_update ->> 'package_name', p_update ->> 'version_from', p_update ->> 'version_to',
          coalesce(p_update ->> 'update_type', 'onbekend'), p_update ->> 'ecosystem', p_update ->> 'category',
          left(p_update ->> 'ai_advice', 600), p_update ->> 'ai_model', coalesce(p_update ->> 'status', 'pending_review'),
          (p_update ->> 'pr_number')::integer, p_update ->> 'pr_url')
  on conflict (pr_number, package_name) do update set
    version_from = excluded.version_from, version_to = excluded.version_to, update_type = excluded.update_type,
    ecosystem = excluded.ecosystem, category = excluded.category, ai_advice = excluded.ai_advice,
    ai_model = excluded.ai_model, status = excluded.status, pr_url = excluded.pr_url, updated_at = now()
  returning * into d;

  insert into public.admin_logs (kind, source, status, message, details)
  values ('deploy', 'dependabot', case when d.category = 'kritiek' then 'warn' else 'ok' end,
          format('%s %s → %s: %s', d.package_name, coalesce(d.version_from, '?'), coalesce(d.version_to, '?'), d.category),
          jsonb_build_object('pr', d.pr_number, 'status', d.status));
  return jsonb_build_object('id', d.id, 'status', d.status);
end $function$
;

CREATE OR REPLACE FUNCTION public.log_owner_reply(p_secret text, p_reply jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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

  if jsonb_typeof(p_reply -> 'price') = 'number' and (p_reply ->> 'price')::numeric between 0 and 500 then
    v_price := round((p_reply ->> 'price')::numeric, 2);
  end if;
  if v_time !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' then v_time := null; end if;

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

  insert into public.admin_logs (kind, source, status, message, details)
  values ('api', 'inbound-email', case when v_outcome in ('no_place', 'ambiguous') then 'warn' else 'ok' end,
          left(format('Antwoord eigenaar (%s): %s', v_intent, coalesce(v_place.name, 'geen plek gevonden')), 1000),
          jsonb_build_object('reply', v_reply, 'outcome', v_outcome, 'queued', v_queued));

  return jsonb_build_object('id', v_reply, 'place_id', v_place.id, 'matched_by', v_matched, 'intent', v_intent,
                            'outcome', v_outcome, 'queued', v_queued);
end $function$
;

CREATE OR REPLACE FUNCTION public.marketing_facts()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare out jsonb;
begin
  if not public.has_admin_role() then raise exception 'Alleen voor beheerders' using errcode = '42501'; end if;
  with p as (
    select province, price_eur, created_at, verified_at, power, water, dump_station, dogs,
      case
        when departure in ('vrij', 'per24') and coalesce(departure_check, '') not in ('voorwaardelijk', 'afgewezen') then 'vrij'
        when departure = 'vast' and private.time_minutes(checkout_until) >= 720 then 'uitslapers'
        when departure = 'vast' and private.time_minutes(checkout_until) >= 660 then 'ruim'
        when departure = 'vast' and private.time_minutes(checkout_until) is not null then 'vroeg'
        else 'onbekend'
      end as dep
    from public.places where status = 'published'
  )
  select jsonb_build_object(
    'measured_at', now(),
    'places', (select count(*) from p),
    'provinces', coalesce((select jsonb_agg(jsonb_build_object('province', province, 'places', n) order by n desc)
                           from (select province, count(*) n from p where province is not null group by province) x), '[]'),
    'departure', (select jsonb_build_object(
        'known', count(*) filter (where dep <> 'onbekend'), 'vrij', count(*) filter (where dep = 'vrij'),
        'uitslapers', count(*) filter (where dep = 'uitslapers'), 'ruim', count(*) filter (where dep = 'ruim'),
        'vroeg', count(*) filter (where dep = 'vroeg')) from p),
    'price', (select jsonb_build_object(
        'known', count(*) filter (where price_eur is not null), 'free', count(*) filter (where price_eur = 0),
        'median', round((percentile_cont(0.5) within group (order by price_eur) filter (where price_eur > 0))::numeric, 2)) from p),
    'facilities', (select jsonb_build_object(
        'power', count(*) filter (where power), 'water', count(*) filter (where water),
        'dump', count(*) filter (where dump_station), 'dogs', count(*) filter (where dogs)) from p),
    'new_7d', (select count(*) from p where created_at > now() - interval '7 days'),
    'new_30d', (select count(*) from p where created_at > now() - interval '30 days'),
    'checked_30d', (select count(*) from p where verified_at > now() - interval '30 days'),
    'reviews', (select jsonb_build_object('count', count(*), 'avg', round(avg(rating)::numeric, 1)) from public.reviews where status = 'approved')
  ) into out;
  return out;
end $function$
;

CREATE OR REPLACE FUNCTION public.marketing_seo_rows(p_days integer DEFAULT 28, p_by text DEFAULT 'query'::text, p_limit integer DEFAULT 500)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare last_day date; out jsonb;
begin
  if not public.has_admin_role() then raise exception 'Alleen voor beheerders' using errcode = '42501'; end if;
  if p_by not in ('query', 'page') then raise exception 'p_by moet query of page zijn'; end if;
  select max(date) into last_day from public.seo_daily;
  if last_day is null then return '[]'::jsonb; end if;
  with d as (
    select * from public.seo_daily where date > last_day - least(greatest(coalesce(p_days, 28), 1), 480) and date <= last_day
  ), g as (
    select case when p_by = 'query' then query else page end as k,
      sum(clicks) clicks, sum(impressions) impressions,
      round(sum(position * impressions) / nullif(sum(impressions) filter (where position is not null), 0), 2) position,
      (array_agg(case when p_by = 'query' then page else query end order by impressions desc))[1] as other,
      count(distinct case when p_by = 'query' then page else query end) as n_other
    from d group by 1
  )
  select coalesce(jsonb_agg(jsonb_build_object(
      'query', case when p_by = 'query' then k else other end,
      'page', case when p_by = 'page' then k else other end,
      'clicks', clicks, 'impressions', impressions, 'position', position, 'count', n_other) order by impressions desc), '[]')
  into out
  from (select * from g order by impressions desc limit least(greatest(coalesce(p_limit, 500), 1), 2000)) x;
  return out;
end $function$
;

CREATE OR REPLACE FUNCTION public.marketing_traffic(p_days integer DEFAULT 28)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare since timestamptz := now() - make_interval(days => least(greatest(coalesce(p_days, 28), 1), 400));
declare out jsonb;
begin
  if not public.has_admin_role() then raise exception 'Alleen voor beheerders' using errcode = '42501'; end if;
  with e as (
    select session_id, coalesce(nullif(props ->> 'bron', ''), 'direct') bron, nullif(props ->> 'campagne', '') campagne, ts
    from public.events where name = 'page_view' and ts >= since
  )
  select jsonb_build_object(
    'since', since,
    'sessions', (select count(distinct session_id) from e),
    'per_bron', coalesce((select jsonb_agg(jsonb_build_object('bron', bron, 'sessions', n) order by n desc)
                          from (select bron, count(distinct session_id) n from e group by bron) x), '[]'),
    'per_campagne', coalesce((select jsonb_agg(jsonb_build_object('bron', bron, 'campagne', campagne, 'sessions', n) order by n desc)
                              from (select bron, campagne, count(distinct session_id) n from e where campagne is not null group by 1, 2) x), '[]'),
    'per_dag', coalesce((select jsonb_agg(jsonb_build_object('date', d, 'sessions', n) order by d)
                         from (select ts::date d, count(distinct session_id) n from e group by 1) x), '[]')
  ) into out;
  return out;
end $function$
;

CREATE OR REPLACE FUNCTION public.marketing_upload_allowed(p_name text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select exists (
    select 1 from public.marketing_jobs j
    where j.status = 'bezig' and j.started_at > now() - interval '2 hours'
      and split_part(p_name, '/', 1) = 'jobs' and split_part(p_name, '/', 2) = j.id::text
  )
$function$
;

CREATE OR REPLACE FUNCTION public.nearest_town(p_lat double precision, p_lng double precision)
 RETURNS public.nl_towns
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
  select t.* from public.nl_towns t
   order by (t.lat - p_lat)^2 + ((t.lng - p_lng) * cos(radians(p_lat)))^2
   limit 1;
$function$
;

CREATE OR REPLACE FUNCTION public.next_discover_batch(p_limit integer)
 RETURNS TABLE(id uuid, name text, town text, postcode text, phone text)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
  with picked as (
    select p.id from public.places p
     where p.website is null
       and p.status in ('draft', 'published')
       and coalesce(p.name_is_generic, false) = false
       and p.name is not null
       and not (coalesce(p.sources, '{}'::jsonb) ? 'discovery')
     order by p.completeness desc
     limit p_limit
     for update skip locked
  ), mark as (
    -- Meteen markeren, zodat een volgende batch dezelfde plekken niet nog eens pakt
    update public.places p set sources = coalesce(p.sources, '{}'::jsonb) || jsonb_build_object('discovery', jsonb_build_object('started', now()))
      from picked where p.id = picked.id
    returning p.id, p.name, p.town, p.postcode, p.phone
  )
  select * from mark;
$function$
;

CREATE OR REPLACE FUNCTION public.next_pdok_batch(p_limit integer)
 RETURNS TABLE(id uuid, lat double precision, lng double precision)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select p.id, p.lat, p.lng from public.places p
   where p.merged_into is null and (p.street is null or p.postcode is null)
     and not (coalesce(p.sources, '{}'::jsonb) ? 'pdok')
   order by random()
   limit least(p_limit, 50);
$function$
;

CREATE OR REPLACE FUNCTION public.next_scrape_batch(p_limit integer)
 RETURNS TABLE(id uuid, website text, name text, town text, focus boolean)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.next_stealth_batch(p_limit integer)
 RETURNS TABLE(id uuid, website text, name text, town text, reason text, focus boolean)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.next_stealth_batch(p_limit integer, p_shard integer, p_shards integer)
 RETURNS TABLE(id uuid, website text, name text, town text, reason text, focus boolean)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.osm_response(p_id bigint)
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select content::text from net._http_response where id = p_id and status_code = 200;
$function$
;

CREATE OR REPLACE FUNCTION public.place_completeness(p public.places)
 RETURNS numeric
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO ''
AS $function$
  select round((
      4 * (p.departure is not null)::int
    + 3 * (p.open_all_year is not null or p.season is not null)::int
    + 2 * (p.price_eur is not null)::int
    + 2 * (p.power is not null)::int
    + 2 * (p.website is not null or p.phone is not null)::int
    + 1.5 * (p.image_url is not null)::int
    + 1 * (p.water is not null)::int
    + 1 * (p.dump_station is not null)::int
    + 1 * (p.toilet is not null)::int
    + 1 * (p.dogs is not null)::int
    + 0.5 * (p.description is not null)::int
    + 0.5 * (not p.name_is_generic)::int
    + 0.25 * (p.shower is not null)::int
    + 0.25 * (p.capacity is not null)::int
  )::numeric / 20, 3);
$function$
;

CREATE OR REPLACE FUNCTION public.place_meets_must_haves(p public.places)
 RETURNS boolean
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO ''
AS $function$
  select (p.website is not null or p.phone is not null or p.email is not null or nullif(trim(p.operator), '') is not null)
     and ((p.departure is not null)::int * 2 + (p.open_all_year is not null or p.season is not null)::int
          + (p.power is not null)::int + (p.price_eur is not null)::int) >= 2;
$function$
;

CREATE OR REPLACE FUNCTION public.place_redirect(p_slug text)
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select k.slug from public.places r join public.places k on k.id = r.merged_into
  where r.slug = p_slug and k.status = 'published';
$function$
;

CREATE OR REPLACE FUNCTION public.places_in_bbox(min_lng double precision, min_lat double precision, max_lng double precision, max_lat double precision)
 RETURNS SETOF public.places
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
  select p.*
  from public.places p
  where p.status = 'published'
    and p.geom operator(extensions.&&) extensions.st_makeenvelope(min_lng, min_lat, max_lng, max_lat, 4326)
  order by p.slug
  limit 5000;
$function$
;

CREATE OR REPLACE FUNCTION public.process_osm_staging(p_limit integer DEFAULT 300)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare rows_ jsonb; ids bigint[]; res jsonb; pts jsonb; n int;
begin
  select coalesce(jsonb_agg(row), '[]'::jsonb), array_agg(id) into rows_, ids
    from (select id, row from public.osm_staging where kind = 'place' and processed_at is null order by id limit p_limit) s;
  if jsonb_array_length(rows_) > 0 then
    res := public.ingest_osm(rows_);
    update public.osm_staging set processed_at = now() where id = any(ids);
    return res || jsonb_build_object('remaining', (select count(*) from public.osm_staging where kind = 'place' and processed_at is null));
  end if;
  select coalesce(jsonb_agg(row), '[]'::jsonb), array_agg(id) into pts, ids
    from (select id, row from public.osm_staging where kind = 'point' and processed_at is null order by id limit 2000) s;
  if jsonb_array_length(pts) > 0 then
    n := public.ingest_osm_points(pts);
    update public.osm_staging set processed_at = now() where id = any(ids);
    return jsonb_build_object('points_marked', n);
  end if;
  return jsonb_build_object('remaining', 0);
end;
$function$
;

CREATE OR REPLACE FUNCTION public.promote_geo_master(p_dry_run boolean DEFAULT true, p_limit integer DEFAULT 500)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  m public.geo_master;
  bezwaar text;
  match_id uuid;
  v_kind text; v_town text; v_province text; v_slug text; base text; n int; new_id uuid;
  f jsonb; v_len numeric; v_cap int; v_prijs numeric;
  c_nieuw int := 0; c_gekoppeld int := 0; c_alleen_gekoppeld int := 0; c_geweigerd int := 0; c_bekeken int := 0;
  redenen jsonb := '{}';
  redenen_gekoppeld jsonb := '{}';
  voorbeelden jsonb := '[]';
begin
  for m in
    select * from public.geo_master g
     where g.place_id is null
     order by g.bijgewerkt_op, g.master_id
     limit greatest(1, least(coalesce(p_limit, 500), 5000))
  loop
    c_bekeken := c_bekeken + 1;
    bezwaar := private.geo_promotie_bezwaar(m);
    match_id := private.geo_bestaande_plek(m);

    -- Bestaat de plek al: koppelen, ook als de master zelf niet door de bronregels komt (A3). Places blijft gelijk.
    if match_id is not null then
      if bezwaar is null then
        c_gekoppeld := c_gekoppeld + 1;
      else
        c_alleen_gekoppeld := c_alleen_gekoppeld + 1;
        redenen_gekoppeld := jsonb_set(redenen_gekoppeld, array[bezwaar],
                                       to_jsonb(coalesce((redenen_gekoppeld ->> bezwaar)::int, 0) + 1));
      end if;
      if not p_dry_run then
        update public.geo_master
           set place_id = match_id, promotie = 'gekoppeld', promotie_reden = bezwaar, gepromoveerd_op = now()
         where master_id = m.master_id;
      end if;
      continue;
    end if;

    -- Nieuw mag alleen zonder bezwaar, en niet op een plek die eerder is opgeruimd (open punt 73)
    if bezwaar is null and private.geo_eerder_verwijderd(m) then
      bezwaar := 'eerder opgeruimd (onbereikbaar): niet opnieuw aanmaken';
    end if;
    if bezwaar is not null then
      c_geweigerd := c_geweigerd + 1;
      redenen := jsonb_set(redenen, array[bezwaar], to_jsonb(coalesce((redenen ->> bezwaar)::int, 0) + 1));
      if not p_dry_run then
        update public.geo_master set promotie = 'geweigerd', promotie_reden = bezwaar where master_id = m.master_id;
      end if;
      continue;
    end if;

    c_nieuw := c_nieuw + 1;
    if jsonb_array_length(voorbeelden) < 20 then
      voorbeelden := voorbeelden || jsonb_build_object('master_id', m.master_id, 'naam', m.naam);
    end if;
    if p_dry_run then continue; end if;

    -- Soort alleen als alle toegestane bronnen van deze master dezelfde soort noemen
    select case when count(distinct b.soort) = 1 and count(*) = count(b.soort) then min(b.soort) end into v_kind
      from (select distinct split_part(id, ':', 1) as bron from unnest(m.bron_ids) id) s
      join public.geo_bronnen b on b.bron = s.bron and b.status = 'toegestaan';
    select t.name, t.province into v_town, v_province from public.nearest_town(m.lat, m.lon) t;

    base := public.slugify(m.naam || coalesce('-' || v_town, ''));
    if base = '' then base := 'camperplaats'; end if;
    v_slug := base; n := 1;
    while exists (select 1 from public.places where slug = v_slug) loop
      n := n + 1; v_slug := base || '-' || n;
    end loop;

    -- Alleen waarden met het juiste type en binnen de grenzen van places; de rest blijft leeg (onbekend)
    f := m.faciliteiten;
    v_len := case when jsonb_typeof(f -> 'max_lengte_m') = 'number' and (f ->> 'max_lengte_m')::numeric between 3 and 30
                  then (f ->> 'max_lengte_m')::numeric end;
    -- Nachtprijs uit de bron (OSM charge, of 0 bij fee=no), alleen als getal binnen de grenzen van places
    v_prijs := case when jsonb_typeof(f -> 'prijs_eur') = 'number' and (f ->> 'prijs_eur')::numeric >= 0
                         and (f ->> 'prijs_eur')::numeric < 150 then (f ->> 'prijs_eur')::numeric end;
    v_cap := case when jsonb_typeof(f -> 'capaciteit') = 'number' and (f ->> 'capaciteit')::numeric between 1 and 1999
                       and (f ->> 'capaciteit')::numeric = trunc((f ->> 'capaciteit')::numeric)
                  then (f ->> 'capaciteit')::int end;

    insert into public.places (slug, name, name_is_generic, kind, lat, lng, town, province,
      power, water, dump_station, toilet, shower, wifi, dogs, open_all_year, reservation, max_length_m, capacity, price_eur, sources)
    values (v_slug, trim(m.naam), false, v_kind, m.lat, m.lon, v_town, v_province,
      private.geo_bool(f, 'stroom'), private.geo_bool(f, 'water'), private.geo_bool(f, 'lozing'),
      private.geo_bool(f, 'toilet'), private.geo_bool(f, 'douche'), private.geo_bool(f, 'wifi'),
      private.geo_bool(f, 'honden'), private.geo_bool(f, 'jaarrond_open'), private.geo_bool(f, 'reserveren'),
      v_len, v_cap, v_prijs,
      jsonb_build_object('geo_master', jsonb_build_object('master_id', m.master_id, 'bron_ids', to_jsonb(m.bron_ids), 'at', now())))
    returning id into new_id;

    update public.geo_master
       set place_id = new_id, promotie = 'nieuw', promotie_reden = null, gepromoveerd_op = now()
     where master_id = m.master_id;
  end loop;

  return jsonb_build_object('dry_run', p_dry_run, 'bekeken', c_bekeken, 'nieuw', c_nieuw, 'gekoppeld', c_gekoppeld,
                            'gekoppeld_zonder_promotie', c_alleen_gekoppeld, 'redenen_gekoppeld', redenen_gekoppeld,
                            'geweigerd', c_geweigerd, 'redenen', redenen, 'voorbeelden_nieuw', voorbeelden);
end $function$
;

CREATE OR REPLACE FUNCTION public.push_disable_subscriptions(p_ids uuid[])
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
  update public.push_subscriptions set disabled_at = now() where id = any(p_ids);
$function$
;

CREATE OR REPLACE FUNCTION public.push_public_key()
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select value from private.secrets where name = 'vapid_public';
$function$
;

CREATE OR REPLACE FUNCTION public.push_set_vapid_keys(p_public text, p_private text)
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
  insert into private.secrets (name, value) values ('vapid_public', p_public), ('vapid_private', p_private)
  on conflict (name) do nothing;
$function$
;

CREATE OR REPLACE FUNCTION public.push_subscribe(p_endpoint text, p_p256dh text, p_auth text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if auth.uid() is null then raise exception 'Niet ingelogd'; end if;
  if p_endpoint !~ '^https://' or length(p_endpoint) > 1000 or length(p_p256dh) > 200 or length(p_auth) > 100 then
    raise exception 'Ongeldig abonnement';
  end if;
  insert into public.push_subscriptions (user_id, endpoint, p256dh, auth)
  values (auth.uid(), p_endpoint, p_p256dh, p_auth)
  on conflict (endpoint) do update set user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth, disabled_at = null;
end $function$
;

CREATE OR REPLACE FUNCTION public.push_take_targets(p_place_id uuid)
 RETURNS TABLE(subscription_id uuid, endpoint text, p256dh text, auth text, place_name text, place_slug text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  return query
  with w as (
    update public.crowd_watches cw set notified_at = now()
    where cw.place_id = p_place_id and cw.notified_at is null and cw.expires_at > now()
    returning cw.user_id
  )
  select s.id, s.endpoint, s.p256dh, s.auth, p.name, p.slug
  from w join public.push_subscriptions s on s.user_id = w.user_id and s.disabled_at is null
  join public.places p on p.id = p_place_id;
end $function$
;

CREATE OR REPLACE FUNCTION public.push_vapid_keys()
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select jsonb_build_object(
    'publicKey', (select value from private.secrets where name = 'vapid_public'),
    'privateKey', (select value from private.secrets where name = 'vapid_private'));
$function$
;

CREATE OR REPLACE FUNCTION public.reply_ticket(p_token text, p_body text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare t public.tickets;
begin
  select * into t from public.tickets where access_token = p_token;
  if not found then raise exception 'Ticket niet gevonden'; end if;
  if t.status = 'gesloten' then raise exception 'Dit ticket is gesloten. Open een nieuw bericht via de contactpagina.'; end if;
  if (select count(*) from public.ticket_messages where ticket_id = t.id and created_at > now() - interval '10 minutes') >= 10 then
    raise exception 'Te veel berichten in korte tijd.';
  end if;
  insert into public.ticket_messages (ticket_id, author, body) values (t.id, 'klant', trim(p_body));
  update public.tickets set status = 'open', updated_at = now() where id = t.id;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.report_client_error(p_message text, p_context jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare ctx jsonb := case when pg_column_size(p_context) > 4000 or jsonb_typeof(p_context) <> 'object' then '{}'::jsonb else p_context end;
begin
  if not private.rate_take('client-error:min', 30, interval '1 minute')
     or not private.rate_take('client-error:dag', 1000, interval '1 day') then return; end if;
  if ctx ? 'path' then ctx := jsonb_set(ctx, '{path}', to_jsonb(private.safe_path(ctx->>'path'))); end if;
  perform private.log('error', 'client', regexp_replace(left(p_message, 500), '/support/[A-Za-z0-9_-]+', '/support/[token]', 'g'), ctx);
end $function$
;

CREATE OR REPLACE FUNCTION public.report_crowd(p_place_id uuid, p_level text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare uid uuid := auth.uid(); recent bigint;
begin
  if uid is null then raise exception 'Log in om de drukte door te geven'; end if;
  if p_level not in ('rustig', 'druk', 'vol') then raise exception 'Kies rustig, druk of vol'; end if;
  if not exists (select 1 from public.places where id = p_place_id and status = 'published') then raise exception 'Onbekende plek'; end if;
  if (select count(*) from public.crowd_reports where user_id = uid and created_at > now() - interval '1 day') >= 30 then
    raise exception 'Je hebt vandaag al veel meldingen gedaan. Probeer het morgen weer.';
  end if;
  select id into recent from public.crowd_reports
  where user_id = uid and place_id = p_place_id and created_at > now() - interval '30 minutes'
  order by created_at desc limit 1;
  if recent is not null then
    update public.crowd_reports set level = p_level, created_at = now() where id = recent;
  else
    insert into public.crowd_reports (place_id, user_id, level) values (p_place_id, uid, p_level);
  end if;
  return public.crowd_status(p_place_id);
end $function$
;

CREATE OR REPLACE FUNCTION public.slugify(p text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO ''
AS $function$
  select trim(both '-' from regexp_replace(lower(extensions.unaccent(coalesce(p, ''))), '[^a-z0-9]+', '-', 'g'));
$function$
;

CREATE OR REPLACE FUNCTION public.submit_place(p_kind text, p_place_id uuid, p_payload jsonb, p_contact_name text, p_contact_email text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
  insert into public.submissions (kind, place_id, payload, contact_name, contact_email, user_id)
  values (p_kind, p_place_id, p_payload, nullif(trim(p_contact_name), ''), nullif(trim(p_contact_email), ''), auth.uid())
  returning id into sid;
  perform private.log('info', 'inzending', 'Nieuwe inzending: ' || p_kind, jsonb_build_object('id', sid));
  return sid;
end $function$
;

CREATE OR REPLACE FUNCTION public.submit_review(p_place_id uuid, p_author_name text, p_rating integer, p_score_location integer, p_score_quiet integer, p_score_facilities integer, p_score_value integer, p_title text, p_body text, p_vehicle text, p_visited_month date)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare uid uuid := auth.uid(); mail text; rid uuid;
begin
  if uid is null then
    raise exception 'Log in of bevestig je e-mailadres met een code om een review te versturen.' using errcode = '42501';
  end if;
  select email into mail from auth.users where id = uid and email_confirmed_at is not null and email is not null;
  if mail is null then
    raise exception 'Je e-mailadres is nog niet bevestigd. Log in met de code uit de mail en probeer het opnieuw.' using errcode = '42501';
  end if;
  if not exists (select 1 from public.places where id = p_place_id and status = 'published') then
    raise exception 'Onbekende plek';
  end if;
  if (select count(*) from public.reviews where user_id = uid and created_at > now() - interval '1 hour') >= 5 then
    raise exception 'Te veel reviews in korte tijd. Probeer het later opnieuw.';
  end if;
  if not private.rate_take('review:' || p_place_id, 5, interval '1 hour')
     or not private.rate_take('review:dag', 400, interval '1 day') then
    raise exception 'Het is even erg druk. Probeer het later opnieuw.';
  end if;
  insert into public.reviews (place_id, user_id, author_name, author_email, rating, score_location, score_quiet,
    score_facilities, score_value, title, body, vehicle, visited_month)
  values (p_place_id, uid, trim(p_author_name), lower(mail), p_rating, p_score_location, p_score_quiet,
    p_score_facilities, p_score_value, nullif(trim(p_title), ''), trim(p_body), p_vehicle, p_visited_month)
  returning id into rid;
  insert into public.events (name, props) values ('review', jsonb_build_object('place_id', p_place_id));
  return rid;
end $function$
;

CREATE OR REPLACE FUNCTION public.submit_review(p_place_id uuid, p_author_name text, p_author_email text, p_rating integer, p_score_location integer, p_score_quiet integer, p_score_facilities integer, p_score_value integer, p_title text, p_body text, p_vehicle text, p_visited_month date)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
end $function$
;

CREATE OR REPLACE FUNCTION public.track(p_name text, p_path text, p_props jsonb, p_session text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if p_name not in ('page_view','search','place_view','outbound','route','save') then return; end if;
  if jsonb_typeof(coalesce(p_props, '{}')) <> 'object' or pg_column_size(p_props) > 600 then return; end if;
  if not private.rate_take('track:min', 300, interval '1 minute')
     or not private.rate_take('track:dag', 20000, interval '1 day') then return; end if;
  insert into public.events (name, path, props, session_id)
  values (p_name, private.safe_path(p_path), coalesce(p_props, '{}'), left(p_session, 64));
end $function$
;

CREATE OR REPLACE FUNCTION public.user_trust(p_user uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare u uuid := coalesce(p_user, auth.uid());
begin
  if u is null then raise exception 'Niet ingelogd'; end if;
  if u <> auth.uid() and not public.is_admin() then raise exception 'Geen toegang'; end if;
  return private.user_trust(u);
end $function$
;

CREATE OR REPLACE FUNCTION public.user_trust_many(p_users uuid[])
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if not public.is_admin() then raise exception 'Geen toegang'; end if;
  return coalesce((select jsonb_object_agg(u, private.user_trust(u)) from (select distinct unnest(p_users[1:200]) u) s where u is not null), '{}'::jsonb);
end $function$
;

CREATE OR REPLACE FUNCTION public.watch_place(p_place_id uuid, p_on boolean DEFAULT true)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if auth.uid() is null then raise exception 'Niet ingelogd'; end if;
  if p_on then
    if (select count(*) from public.crowd_watches where user_id = auth.uid() and expires_at > now()) >= 10 then
      raise exception 'Je volgt al 10 plekken. Stop eerst met een andere.';
    end if;
    insert into public.crowd_watches (user_id, place_id) values (auth.uid(), p_place_id)
    on conflict (user_id, place_id) do update set created_at = now(), expires_at = now() + interval '24 hours', notified_at = null;
  else
    update public.crowd_watches set expires_at = now() where user_id = auth.uid() and place_id = p_place_id;
  end if;
  return p_on;
end $function$
;


-- Standaardwaarden
alter table only private.admin_invites alter column role set default 'admin'::text;
alter table only private.nacontrole_20261108 alter column id set default nextval('private.nacontrole_20261108_id_seq'::regclass);
alter table only private.nacontrole_20261108 alter column ts set default now();
alter table only private.pdok_woonplaats_20261024 alter column aangevraagd_op set default now();
alter table only private.rate_counter alter column hits set default 0;
alter table only private.scrape_queue alter column attempts set default 0;
alter table only private.scrape_queue alter column next_attempt_at set default now();
alter table only private.stealth_queue alter column attempts set default 0;
alter table only private.stealth_queue alter column created_at set default now();
alter table only private.stealth_queue alter column next_attempt_at set default now();
alter table only private.town_correcties_20261024 alter column gedaan_op set default now();
alter table only private.verwijderde_plekken alter column removed_at set default now();
alter table only public.admin_logs alter column details set default '{}'::jsonb;
alter table only public.admin_logs alter column ts set default now();
alter table only public.admins alter column created_at set default now();
alter table only public.admins alter column role set default 'admin'::text;
alter table only public.app_logs alter column context set default '{}'::jsonb;
alter table only public.app_logs alter column ts set default now();
alter table only public.audit_log alter column details set default '{}'::jsonb;
alter table only public.audit_log alter column ts set default now();
alter table only public.campaigns alter column budget_eur set default 0;
alter table only public.campaigns alter column created_at set default now();
alter table only public.campaigns alter column id set default gen_random_uuid();
alter table only public.campaigns alter column spent_eur set default 0;
alter table only public.consent_log alter column ts set default now();
alter table only public.content_items alter column body set default ''::text;
alter table only public.content_items alter column created_at set default now();
alter table only public.content_items alter column created_by set default auth.uid();
alter table only public.content_items alter column hashtags set default '{}'::text[];
alter table only public.content_items alter column id set default gen_random_uuid();
alter table only public.content_items alter column status set default 'idee'::text;
alter table only public.content_items alter column updated_at set default now();
alter table only public.crowd_reports alter column created_at set default now();
alter table only public.crowd_watches alter column created_at set default now();
alter table only public.crowd_watches alter column expires_at set default (now() + '24:00:00'::interval);
alter table only public.dependency_updates alter column created_at set default now();
alter table only public.dependency_updates alter column id set default gen_random_uuid();
alter table only public.dependency_updates alter column status set default 'pending_review'::text;
alter table only public.dependency_updates alter column updated_at set default now();
alter table only public.duplicate_dismissals alter column created_at set default now();
alter table only public.events alter column props set default '{}'::jsonb;
alter table only public.events alter column ts set default now();
alter table only public.faq alter column id set default gen_random_uuid();
alter table only public.faq alter column "position" set default 0;
alter table only public.faq alter column published set default true;
alter table only public.faq alter column updated_at set default now();
alter table only public.geo_bronnen alter column aangemaakt_op set default now();
alter table only public.geo_bronnen alter column status set default 'te_beoordelen'::text;
alter table only public.geo_master alter column aangemaakt_op set default now();
alter table only public.geo_master alter column bijgewerkt_op set default now();
alter table only public.geo_master alter column conflicten set default '{}'::jsonb;
alter table only public.geo_master alter column faciliteiten set default '{}'::jsonb;
alter table only public.geo_master alter column namen set default '{}'::text[];
alter table only public.ingest_runs alter column started_at set default now();
alter table only public.ingest_runs alter column stats set default '{}'::jsonb;
alter table only public.ingest_runs alter column status set default 'running'::text;
alter table only public.manual_review alter column requires_manual_review set default true;
alter table only public.manual_review alter column sinds set default now();
alter table only public.marketing_assets alter column created_at set default now();
alter table only public.marketing_assets alter column id set default gen_random_uuid();
alter table only public.marketing_jobs alter column created_at set default now();
alter table only public.marketing_jobs alter column created_by set default auth.uid();
alter table only public.marketing_jobs alter column id set default gen_random_uuid();
alter table only public.marketing_jobs alter column props set default '{}'::jsonb;
alter table only public.marketing_jobs alter column status set default 'wacht'::text;
alter table only public.nl_towns alter column id set default nextval('public.nl_towns_id_seq'::regclass);
alter table only public.osm_regions alter column attempt set default 0;
alter table only public.osm_staging alter column created_at set default now();
alter table only public.owner_replies alter column id set default gen_random_uuid();
alter table only public.owner_replies alter column queued set default 0;
alter table only public.owner_replies alter column received_at set default now();
alter table only public.owner_replies alter column sender_matches set default false;
alter table only public.place_photos alter column created_at set default now();
alter table only public.place_photos alter column id set default gen_random_uuid();
alter table only public.place_photos alter column status set default 'pending'::text;
alter table only public.places alter column completeness set default 0;
alter table only public.places alter column created_at set default now();
alter table only public.places alter column id set default gen_random_uuid();
alter table only public.places alter column name_is_generic set default false;
alter table only public.places alter column photos set default '[]'::jsonb;
alter table only public.places alter column rating_count set default 0;
alter table only public.places alter column sources set default '{}'::jsonb;
alter table only public.places alter column status set default 'draft'::text;
alter table only public.places alter column status_locked set default false;
alter table only public.places alter column updated_at set default now();
alter table only public.profiles alter column created_at set default now();
alter table only public.profiles alter column role set default 'user'::text;
alter table only public.profiles alter column updated_at set default now();
alter table only public.push_subscriptions alter column created_at set default now();
alter table only public.push_subscriptions alter column id set default gen_random_uuid();
alter table only public.reviews alter column created_at set default now();
alter table only public.reviews alter column id set default gen_random_uuid();
alter table only public.reviews alter column status set default 'pending'::text;
alter table only public.route_cache alter column created_at set default now();
alter table only public.seo_daily alter column clicks set default 0;
alter table only public.seo_daily alter column impressions set default 0;
alter table only public.seo_pages alter column checked_at set default now();
alter table only public.seo_status alter column checked_at set default now();
alter table only public.seo_status alter column value set default '{}'::jsonb;
alter table only public.seo_totals alter column clicks set default 0;
alter table only public.seo_totals alter column device set default 'alle'::text;
alter table only public.seo_totals alter column impressions set default 0;
alter table only public.shared_trip_members alter column joined_at set default now();
alter table only public.shared_trips alter column created_at set default now();
alter table only public.shared_trips alter column id set default gen_random_uuid();
alter table only public.shared_trips alter column invite_code set default encode(extensions.gen_random_bytes(9), 'hex'::text);
alter table only public.shared_trips alter column name set default 'Onze reis'::text;
alter table only public.shared_trips alter column stops set default '[]'::jsonb;
alter table only public.shared_trips alter column updated_at set default now();
alter table only public.social_stats alter column id set default gen_random_uuid();
alter table only public.social_stats alter column measured_on set default CURRENT_DATE;
alter table only public.social_stats alter column source set default 'handmatig'::text;
alter table only public.submissions alter column created_at set default now();
alter table only public.submissions alter column id set default gen_random_uuid();
alter table only public.submissions alter column status set default 'nieuw'::text;
alter table only public.ticket_messages alter column created_at set default now();
alter table only public.ticket_messages alter column id set default gen_random_uuid();
alter table only public.ticket_messages alter column internal set default false;
alter table only public.tickets alter column access_token set default encode(extensions.gen_random_bytes(18), 'hex'::text);
alter table only public.tickets alter column category set default 'vraag'::text;
alter table only public.tickets alter column created_at set default now();
alter table only public.tickets alter column id set default gen_random_uuid();
alter table only public.tickets alter column priority set default 'normaal'::text;
alter table only public.tickets alter column status set default 'open'::text;
alter table only public.tickets alter column updated_at set default now();
alter table only public.updates_queue alter column created_at set default now();
alter table only public.updates_queue alter column id set default gen_random_uuid();
alter table only public.updates_queue alter column source set default 'doe-mee'::text;
alter table only public.updates_queue alter column status set default 'pending'::text;
alter table only public.user_expenses alter column entries set default '[]'::jsonb;
alter table only public.user_expenses alter column updated_at set default now();
alter table only public.user_trips alter column stops set default '[]'::jsonb;
alter table only public.user_trips alter column updated_at set default now();
alter table only public.user_vehicles alter column data set default '{}'::jsonb;
alter table only public.user_vehicles alter column updated_at set default now();

-- Primaire sleutels
alter table only private.admin_invites add constraint admin_invites_pkey PRIMARY KEY (email);
alter table only private.nacontrole_20261108 add constraint nacontrole_20261108_pkey PRIMARY KEY (id);
alter table only private.pdok_woonplaats_20261024 add constraint pdok_woonplaats_20261024_pkey PRIMARY KEY (place_id);
alter table only private.rate_counter add constraint rate_counter_pkey PRIMARY KEY (bucket, window_start);
alter table only private.scrape_queue add constraint scrape_queue_pkey PRIMARY KEY (place_id);
alter table only private.secrets add constraint secrets_pkey PRIMARY KEY (name);
alter table only private.stealth_queue add constraint stealth_queue_pkey PRIMARY KEY (place_id);
alter table only private.town_correcties_20261024 add constraint town_correcties_20261024_pkey PRIMARY KEY (place_id);
alter table only private.verwijderde_plekken add constraint verwijderde_plekken_pkey PRIMARY KEY (id);
alter table only public.admin_logs add constraint admin_logs_pkey PRIMARY KEY (id);
alter table only public.admins add constraint admins_pkey PRIMARY KEY (user_id);
alter table only public.app_logs add constraint app_logs_pkey PRIMARY KEY (id);
alter table only public.audit_log add constraint audit_log_pkey PRIMARY KEY (id);
alter table only public.campaigns add constraint campaigns_pkey PRIMARY KEY (id);
alter table only public.consent_log add constraint consent_log_pkey PRIMARY KEY (id);
alter table only public.content_items add constraint content_items_pkey PRIMARY KEY (id);
alter table only public.crowd_reports add constraint crowd_reports_pkey PRIMARY KEY (id);
alter table only public.crowd_watches add constraint crowd_watches_pkey PRIMARY KEY (user_id, place_id);
alter table only public.dependency_updates add constraint dependency_updates_pkey PRIMARY KEY (id);
alter table only public.duplicate_dismissals add constraint duplicate_dismissals_pkey PRIMARY KEY (a, b);
alter table only public.events add constraint events_pkey PRIMARY KEY (id);
alter table only public.faq add constraint faq_pkey PRIMARY KEY (id);
alter table only public.geo_bronnen add constraint geo_bronnen_pkey PRIMARY KEY (bron);
alter table only public.geo_master add constraint geo_master_pkey PRIMARY KEY (master_id);
alter table only public.ingest_runs add constraint ingest_runs_pkey PRIMARY KEY (id);
alter table only public.internal_secrets add constraint internal_secrets_pkey PRIMARY KEY (name);
alter table only public.manual_review add constraint manual_review_pkey PRIMARY KEY (place_id);
alter table only public.marketing_assets add constraint marketing_assets_pkey PRIMARY KEY (id);
alter table only public.marketing_jobs add constraint marketing_jobs_pkey PRIMARY KEY (id);
alter table only public.nl_towns add constraint nl_towns_pkey PRIMARY KEY (id);
alter table only public.osm_queries add constraint osm_queries_pkey PRIMARY KEY (name);
alter table only public.osm_regions add constraint osm_regions_pkey PRIMARY KEY (code);
alter table only public.osm_staging add constraint osm_staging_pkey PRIMARY KEY (id);
alter table only public.owner_replies add constraint owner_replies_pkey PRIMARY KEY (id);
alter table only public.place_photos add constraint place_photos_pkey PRIMARY KEY (id);
alter table only public.places add constraint places_pkey PRIMARY KEY (id);
alter table only public.profiles add constraint profiles_pkey PRIMARY KEY (id);
alter table only public.push_subscriptions add constraint push_subscriptions_pkey PRIMARY KEY (id);
alter table only public.reviews add constraint reviews_pkey PRIMARY KEY (id);
alter table only public.route_cache add constraint route_cache_pkey PRIMARY KEY (key);
alter table only public.seo_daily add constraint seo_daily_pkey PRIMARY KEY (date, query, page);
alter table only public.seo_pages add constraint seo_pages_pkey PRIMARY KEY (url);
alter table only public.seo_status add constraint seo_status_pkey PRIMARY KEY (key);
alter table only public.seo_totals add constraint seo_totals_pkey PRIMARY KEY (date, device);
alter table only public.shared_trip_members add constraint shared_trip_members_pkey PRIMARY KEY (trip_id, user_id);
alter table only public.shared_trips add constraint shared_trips_pkey PRIMARY KEY (id);
alter table only public.site_settings add constraint site_settings_pkey PRIMARY KEY (key);
alter table only public.social_stats add constraint social_stats_pkey PRIMARY KEY (id);
alter table only public.submissions add constraint submissions_pkey PRIMARY KEY (id);
alter table only public.ticket_messages add constraint ticket_messages_pkey PRIMARY KEY (id);
alter table only public.tickets add constraint tickets_pkey PRIMARY KEY (id);
alter table only public.updates_queue add constraint updates_queue_pkey PRIMARY KEY (id);
alter table only public.user_expenses add constraint user_expenses_pkey PRIMARY KEY (user_id);
alter table only public.user_trips add constraint user_trips_pkey PRIMARY KEY (user_id);
alter table only public.user_vehicles add constraint user_vehicles_pkey PRIMARY KEY (user_id);

-- Unieke sleutels
alter table only public.campaigns add constraint campaigns_bron_campagne_key UNIQUE (bron, campagne);
alter table only public.dependency_updates add constraint dependency_updates_pr_number_package_name_key UNIQUE (pr_number, package_name);
alter table only public.owner_replies add constraint owner_replies_email_id_key UNIQUE (email_id);
alter table only public.place_photos add constraint place_photos_storage_path_key UNIQUE (storage_path);
alter table only public.places add constraint places_osm_type_osm_id_key UNIQUE (osm_type, osm_id);
alter table only public.places add constraint places_slug_key UNIQUE (slug);
alter table only public.push_subscriptions add constraint push_subscriptions_endpoint_key UNIQUE (endpoint);
alter table only public.shared_trips add constraint shared_trips_invite_code_key UNIQUE (invite_code);
alter table only public.social_stats add constraint social_stats_post_url_measured_on_key UNIQUE (post_url, measured_on);
alter table only public.tickets add constraint tickets_access_token_key UNIQUE (access_token);
alter table only public.tickets add constraint tickets_number_key UNIQUE (number);
alter table only public.updates_queue add constraint updates_queue_submission_id_field_changed_key UNIQUE (submission_id, field_changed);

-- Checks
alter table only public.admin_logs add constraint admin_logs_kind_check CHECK ((kind = ANY (ARRAY['cron'::text, 'api'::text, 'scraper'::text, 'sync'::text, 'deploy'::text, 'security'::text])));
alter table only public.admin_logs add constraint admin_logs_message_check CHECK ((char_length(message) <= 1000));
alter table only public.admin_logs add constraint admin_logs_source_check CHECK (((char_length(source) >= 1) AND (char_length(source) <= 60)));
alter table only public.admin_logs add constraint admin_logs_status_check CHECK ((status = ANY (ARRAY['ok'::text, 'failed'::text, 'warn'::text, 'pending'::text])));
alter table only public.admins add constraint admins_role_check CHECK ((role = ANY (ARRAY['admin'::text, 'support'::text])));
alter table only public.app_logs add constraint app_logs_level_check CHECK ((level = ANY (ARRAY['debug'::text, 'info'::text, 'warn'::text, 'error'::text])));
alter table only public.campaigns add constraint campaigns_bron_check CHECK ((bron ~ '^[a-z0-9-]{1,40}$'::text));
alter table only public.campaigns add constraint campaigns_budget_eur_check CHECK ((budget_eur >= (0)::numeric));
alter table only public.campaigns add constraint campaigns_campagne_check CHECK ((campagne ~ '^[a-z0-9-]{1,40}$'::text));
alter table only public.campaigns add constraint campaigns_channel_check CHECK ((channel = ANY (ARRAY['instagram'::text, 'tiktok'::text, 'facebook'::text, 'google-ads'::text, 'flyer'::text, 'overig'::text])));
alter table only public.campaigns add constraint campaigns_name_check CHECK (((char_length(name) >= 1) AND (char_length(name) <= 80)));
alter table only public.campaigns add constraint campaigns_notes_check CHECK ((char_length(notes) <= 1000));
alter table only public.campaigns add constraint campaigns_spent_eur_check CHECK ((spent_eur >= (0)::numeric));
alter table only public.content_items add constraint content_items_body_check CHECK ((char_length(body) <= 3000));
alter table only public.content_items add constraint content_items_channel_check CHECK ((channel = ANY (ARRAY['instagram'::text, 'tiktok'::text, 'facebook'::text, 'google-ads'::text])));
alter table only public.content_items add constraint content_items_link_check CHECK ((char_length(link) <= 500));
alter table only public.content_items add constraint content_items_pillar_check CHECK ((pillar = ANY (ARRAY['app'::text, 'cijfers'::text, 'hoe'::text, 'regio'::text, 'doe-mee'::text, 'nieuw'::text])));
alter table only public.content_items add constraint content_items_posted_url_check CHECK ((char_length(posted_url) <= 500));
alter table only public.content_items add constraint content_items_status_check CHECK ((status = ANY (ARRAY['idee'::text, 'in-de-maak'::text, 'klaar'::text, 'geplaatst'::text])));
alter table only public.content_items add constraint content_items_title_check CHECK (((char_length(title) >= 1) AND (char_length(title) <= 120)));
alter table only public.crowd_reports add constraint crowd_reports_level_check CHECK ((level = ANY (ARRAY['rustig'::text, 'druk'::text, 'vol'::text])));
alter table only public.dependency_updates add constraint dependency_updates_ai_advice_check CHECK ((char_length(ai_advice) <= 600));
alter table only public.dependency_updates add constraint dependency_updates_ai_model_check CHECK ((char_length(ai_model) <= 80));
alter table only public.dependency_updates add constraint dependency_updates_category_check CHECK ((category = ANY (ARRAY['kritiek'::text, 'aanbevolen'::text, 'uitstellen'::text])));
alter table only public.dependency_updates add constraint dependency_updates_ecosystem_check CHECK ((char_length(ecosystem) <= 40));
alter table only public.dependency_updates add constraint dependency_updates_package_name_check CHECK (((char_length(package_name) >= 1) AND (char_length(package_name) <= 214)));
alter table only public.dependency_updates add constraint dependency_updates_pr_url_check CHECK ((pr_url ~ '^https://github\.com/[A-Za-z0-9._-]+/[A-Za-z0-9._-]+/pull/[0-9]+$'::text));
alter table only public.dependency_updates add constraint dependency_updates_status_check CHECK ((status = ANY (ARRAY['auto-merged'::text, 'pending_review'::text, 'rejected'::text])));
alter table only public.dependency_updates add constraint dependency_updates_update_type_check CHECK ((update_type = ANY (ARRAY['major'::text, 'minor'::text, 'patch'::text, 'onbekend'::text])));
alter table only public.dependency_updates add constraint dependency_updates_version_from_check CHECK ((char_length(version_from) <= 64));
alter table only public.dependency_updates add constraint dependency_updates_version_to_check CHECK ((char_length(version_to) <= 64));
alter table only public.duplicate_dismissals add constraint duplicate_dismissals_check CHECK ((a < b));
alter table only public.events add constraint events_name_check CHECK ((name = ANY (ARRAY['page_view'::text, 'search'::text, 'place_view'::text, 'outbound'::text, 'route'::text, 'save'::text, 'review'::text, 'ticket'::text])));
alter table only public.geo_bronnen add constraint geo_bronnen_bron_check CHECK ((bron ~ '^[a-z0-9_]{2,40}$'::text));
alter table only public.geo_bronnen add constraint geo_bronnen_soort_check CHECK ((soort = ANY (ARRAY['camperplaats'::text, 'camping'::text, 'parkeerplaats'::text, 'boerderij'::text, 'jachthaven'::text])));
alter table only public.geo_bronnen add constraint geo_bronnen_status_check CHECK ((status = ANY (ARRAY['toegestaan'::text, 'te_beoordelen'::text, 'geblokkeerd'::text])));
alter table only public.geo_bronnen add constraint geo_bronnen_tier_check CHECK (((tier >= 1) AND (tier <= 5)));
alter table only public.geo_master add constraint geo_master_bron_ids_check CHECK ((cardinality(bron_ids) > 0));
alter table only public.geo_master add constraint geo_master_conflicten_check CHECK ((jsonb_typeof(conflicten) = 'object'::text));
alter table only public.geo_master add constraint geo_master_faciliteiten_check CHECK ((jsonb_typeof(faciliteiten) = 'object'::text));
alter table only public.geo_master add constraint geo_master_geohash_check CHECK (((length(geohash) >= 1) AND (length(geohash) <= 12)));
alter table only public.geo_master add constraint geo_master_lat_check CHECK (((lat >= ('-90'::integer)::double precision) AND (lat <= (90)::double precision)));
alter table only public.geo_master add constraint geo_master_lon_check CHECK (((lon >= ('-180'::integer)::double precision) AND (lon <= (180)::double precision)));
alter table only public.geo_master add constraint geo_master_match_score_check CHECK (((match_score >= (0)::double precision) AND (match_score <= (1)::double precision)));
alter table only public.geo_master add constraint geo_master_promotie_check CHECK ((promotie = ANY (ARRAY['nieuw'::text, 'gekoppeld'::text, 'geweigerd'::text])));
alter table only public.ingest_runs add constraint ingest_runs_status_check CHECK ((status = ANY (ARRAY['running'::text, 'ok'::text, 'error'::text])));
alter table only public.marketing_assets add constraint marketing_assets_kind_check CHECK ((kind = ANY (ARRAY['video'::text, 'afbeelding'::text, 'schermopname'::text])));
alter table only public.marketing_assets add constraint marketing_assets_storage_path_check CHECK ((char_length(storage_path) <= 300));
alter table only public.marketing_assets add constraint marketing_assets_template_check CHECK ((char_length(template) <= 40));
alter table only public.marketing_assets add constraint marketing_assets_title_check CHECK ((char_length(title) <= 120));
alter table only public.marketing_jobs add constraint marketing_jobs_error_check CHECK ((char_length(error) <= 1000));
alter table only public.marketing_jobs add constraint marketing_jobs_format_check CHECK ((format = ANY (ARRAY['vertical'::text, 'square'::text, 'portrait'::text, 'landscape'::text])));
alter table only public.marketing_jobs add constraint marketing_jobs_kind_check CHECK ((kind = ANY (ARRAY['video'::text, 'schermopnames'::text])));
alter table only public.marketing_jobs add constraint marketing_jobs_status_check CHECK ((status = ANY (ARRAY['wacht'::text, 'bezig'::text, 'klaar'::text, 'fout'::text])));
alter table only public.marketing_jobs add constraint marketing_jobs_template_check CHECK ((char_length(template) <= 40));
alter table only public.osm_staging add constraint osm_staging_kind_check CHECK ((kind = ANY (ARRAY['place'::text, 'point'::text])));
alter table only public.owner_replies add constraint owner_replies_ai_model_check CHECK ((char_length(ai_model) <= 80));
alter table only public.owner_replies add constraint owner_replies_departure_time_check CHECK ((departure_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'::text));
alter table only public.owner_replies add constraint owner_replies_email_id_check CHECK (((char_length(email_id) >= 1) AND (char_length(email_id) <= 100)));
alter table only public.owner_replies add constraint owner_replies_from_email_check CHECK (((char_length(from_email) >= 3) AND (char_length(from_email) <= 254)));
alter table only public.owner_replies add constraint owner_replies_intent_check CHECK ((intent = ANY (ARRAY['confirm'::text, 'update'::text, 'unknown'::text])));
alter table only public.owner_replies add constraint owner_replies_matched_by_check CHECK ((matched_by = ANY (ARRAY['id'::text, 'email'::text])));
alter table only public.owner_replies add constraint owner_replies_outcome_check CHECK ((outcome = ANY (ARRAY['queued'::text, 'verified'::text, 'logged'::text, 'no_place'::text, 'ambiguous'::text])));
alter table only public.owner_replies add constraint owner_replies_price_eur_check CHECK (((price_eur >= (0)::numeric) AND (price_eur <= (500)::numeric)));
alter table only public.owner_replies add constraint owner_replies_subject_check CHECK ((char_length(subject) <= 300));
alter table only public.owner_replies add constraint owner_replies_summary_check CHECK ((char_length(summary) <= 500));
alter table only public.place_photos add constraint place_photos_caption_check CHECK ((char_length(caption) <= 140));
alter table only public.place_photos add constraint place_photos_credit_check CHECK ((char_length(credit) <= 80));
alter table only public.place_photos add constraint place_photos_height_check CHECK (((height >= 200) AND (height <= 4000)));
alter table only public.place_photos add constraint place_photos_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text])));
alter table only public.place_photos add constraint place_photos_storage_path_check CHECK ((storage_path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.(webp|jpg)$'::text));
alter table only public.place_photos add constraint place_photos_width_check CHECK (((width >= 200) AND (width <= 4000)));
alter table only public.places add constraint places_capacity_check CHECK (((capacity > 0) AND (capacity < 2000)));
alter table only public.places add constraint places_checkin_from_check CHECK ((checkin_from ~ '^\d{2}:\d{2}$'::text));
alter table only public.places add constraint places_checkin_until_check CHECK ((checkin_until ~ '^\d{2}:\d{2}$'::text));
alter table only public.places add constraint places_checkout_until_check CHECK ((checkout_until ~ '^\d{2}:\d{2}$'::text));
alter table only public.places add constraint places_departure_check CHECK ((departure = ANY (ARRAY['vrij'::text, 'per24'::text, 'vast'::text])));
alter table only public.places add constraint places_departure_check_check CHECK ((departure_check = ANY (ARRAY['bevestigd'::text, 'voorwaardelijk'::text, 'afgewezen'::text])));
alter table only public.places add constraint places_departure_checked_by_check CHECK ((departure_checked_by = ANY (ARRAY['beheer'::text, 'eigenaar'::text])));
alter table only public.places add constraint places_kind_check CHECK ((kind = ANY (ARRAY['camperplaats'::text, 'camping'::text, 'parkeerplaats'::text, 'boerderij'::text, 'jachthaven'::text])));
alter table only public.places add constraint places_price_eur_check CHECK ((price_eur >= (0)::numeric));
alter table only public.places add constraint places_reservation_rule_check CHECK ((reservation_rule = ANY (ARRAY['verplicht'::text, 'mogelijk'::text, 'niet_nodig'::text])));
alter table only public.places add constraint places_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'published'::text, 'hidden'::text])));
alter table only public.places add constraint places_surface_check CHECK ((surface = ANY (ARRAY['verhard'::text, 'gras'::text, 'gemengd'::text, 'grind'::text])));
alter table only public.profiles add constraint profiles_avatar_url_check CHECK ((avatar_url ~ '^https://'::text));
alter table only public.profiles add constraint profiles_display_name_check CHECK ((char_length(display_name) <= 80));
alter table only public.profiles add constraint profiles_role_check CHECK ((role = ANY (ARRAY['user'::text, 'support'::text, 'admin'::text])));
alter table only public.push_subscriptions add constraint push_subscriptions_endpoint_check CHECK ((endpoint ~ '^https://'::text));
alter table only public.reviews add constraint reviews_author_email_check CHECK (((author_email IS NULL) OR (author_email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'::text)));
alter table only public.reviews add constraint reviews_author_name_check CHECK (((char_length(author_name) >= 2) AND (char_length(author_name) <= 60)));
alter table only public.reviews add constraint reviews_body_check CHECK (((char_length(body) >= 20) AND (char_length(body) <= 3000)));
alter table only public.reviews add constraint reviews_rating_check CHECK (((rating >= 1) AND (rating <= 10)));
alter table only public.reviews add constraint reviews_score_facilities_check CHECK (((score_facilities >= 1) AND (score_facilities <= 10)));
alter table only public.reviews add constraint reviews_score_location_check CHECK (((score_location >= 1) AND (score_location <= 10)));
alter table only public.reviews add constraint reviews_score_quiet_check CHECK (((score_quiet >= 1) AND (score_quiet <= 10)));
alter table only public.reviews add constraint reviews_score_value_check CHECK (((score_value >= 1) AND (score_value <= 10)));
alter table only public.reviews add constraint reviews_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text])));
alter table only public.reviews add constraint reviews_title_check CHECK ((char_length(title) <= 120));
alter table only public.reviews add constraint reviews_vehicle_check CHECK ((vehicle = ANY (ARRAY['camper'::text, 'buscamper'::text, 'caravan'::text, 'overig'::text])));
alter table only public.seo_daily add constraint seo_daily_clicks_check CHECK ((clicks >= 0));
alter table only public.seo_daily add constraint seo_daily_impressions_check CHECK ((impressions >= 0));
alter table only public.seo_pages add constraint seo_pages_url_check CHECK ((char_length(url) <= 500));
alter table only public.seo_status add constraint seo_status_key_check CHECK ((char_length(key) <= 80));
alter table only public.seo_totals add constraint seo_totals_device_check CHECK ((device = ANY (ARRAY['alle'::text, 'mobile'::text, 'desktop'::text, 'tablet'::text])));
alter table only public.shared_trip_members add constraint shared_trip_members_display_name_check CHECK ((char_length(display_name) <= 80));
alter table only public.shared_trips add constraint shared_trips_name_check CHECK (((char_length(name) >= 1) AND (char_length(name) <= 60)));
alter table only public.shared_trips add constraint shared_trips_stops_check CHECK (((jsonb_typeof(stops) = 'array'::text) AND (jsonb_array_length(stops) <= 200)));
alter table only public.shared_trips add constraint shared_trips_stops_size CHECK ((pg_column_size(stops) < 200000));
alter table only public.social_stats add constraint social_stats_comments_check CHECK ((comments >= 0));
alter table only public.social_stats add constraint social_stats_likes_check CHECK ((likes >= 0));
alter table only public.social_stats add constraint social_stats_platform_check CHECK ((platform = ANY (ARRAY['instagram'::text, 'tiktok'::text, 'facebook'::text])));
alter table only public.social_stats add constraint social_stats_post_url_check CHECK ((char_length(post_url) <= 500));
alter table only public.social_stats add constraint social_stats_reach_check CHECK ((reach >= 0));
alter table only public.social_stats add constraint social_stats_saves_check CHECK ((saves >= 0));
alter table only public.social_stats add constraint social_stats_shares_check CHECK ((shares >= 0));
alter table only public.social_stats add constraint social_stats_source_check CHECK ((source = ANY (ARRAY['handmatig'::text, 'api'::text])));
alter table only public.social_stats add constraint social_stats_views_check CHECK ((views >= 0));
alter table only public.submissions add constraint submissions_kind_check CHECK ((kind = ANY (ARRAY['nieuw'::text, 'correctie'::text, 'eigenaar'::text])));
alter table only public.submissions add constraint submissions_status_check CHECK ((status = ANY (ARRAY['nieuw'::text, 'verwerkt'::text, 'afgewezen'::text])));
alter table only public.ticket_messages add constraint ticket_messages_author_check CHECK ((author = ANY (ARRAY['klant'::text, 'support'::text])));
alter table only public.ticket_messages add constraint ticket_messages_body_check CHECK (((char_length(body) >= 1) AND (char_length(body) <= 5000)));
alter table only public.tickets add constraint tickets_category_check CHECK ((category = ANY (ARRAY['vraag'::text, 'fout-in-gegevens'::text, 'technisch'::text, 'privacy'::text, 'eigenaar'::text, 'samenwerking'::text, 'overig'::text])));
alter table only public.tickets add constraint tickets_email_check CHECK ((email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'::text));
alter table only public.tickets add constraint tickets_name_check CHECK (((char_length(name) >= 2) AND (char_length(name) <= 80)));
alter table only public.tickets add constraint tickets_priority_check CHECK ((priority = ANY (ARRAY['laag'::text, 'normaal'::text, 'hoog'::text])));
alter table only public.tickets add constraint tickets_status_check CHECK ((status = ANY (ARRAY['open'::text, 'in-behandeling'::text, 'wacht-op-klant'::text, 'opgelost'::text, 'gesloten'::text])));
alter table only public.tickets add constraint tickets_subject_check CHECK (((char_length(subject) >= 3) AND (char_length(subject) <= 140)));
alter table only public.updates_queue add constraint updates_queue_ai_advice_check CHECK ((char_length(ai_advice) <= 300));
alter table only public.updates_queue add constraint updates_queue_ai_score_check CHECK (((ai_score >= 0) AND (ai_score <= 100)));
alter table only public.updates_queue add constraint updates_queue_field_changed_check CHECK ((field_changed ~ '^[a-z_]{2,40}$'::text));
alter table only public.updates_queue add constraint updates_queue_source_check CHECK ((source = ANY (ARRAY['doe-mee'::text, 'plekpuls'::text, 'beheer'::text, 'pipeline'::text, 'eigenaar'::text])));
alter table only public.updates_queue add constraint updates_queue_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text])));
alter table only public.user_expenses add constraint user_expenses_entries_check CHECK (((jsonb_typeof(entries) = 'array'::text) AND (jsonb_array_length(entries) <= 1000)));
alter table only public.user_expenses add constraint user_expenses_entries_size CHECK ((pg_column_size(entries) < 500000));
alter table only public.user_trips add constraint user_trips_stops_check CHECK (((jsonb_typeof(stops) = 'array'::text) AND (jsonb_array_length(stops) <= 200)));
alter table only public.user_trips add constraint user_trips_stops_size CHECK ((pg_column_size(stops) < 200000));
alter table only public.user_vehicles add constraint user_vehicles_data_check CHECK (((jsonb_typeof(data) = 'object'::text) AND (pg_column_size(data) < 2000)));

-- Verwijzingen
alter table only private.scrape_queue add constraint scrape_queue_place_id_fkey FOREIGN KEY (place_id) REFERENCES public.places(id) ON DELETE CASCADE;
alter table only private.stealth_queue add constraint stealth_queue_place_id_fkey FOREIGN KEY (place_id) REFERENCES public.places(id) ON DELETE CASCADE;
alter table only public.admins add constraint admins_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table only public.crowd_reports add constraint crowd_reports_place_id_fkey FOREIGN KEY (place_id) REFERENCES public.places(id) ON DELETE CASCADE;
alter table only public.crowd_reports add constraint crowd_reports_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table only public.crowd_watches add constraint crowd_watches_place_id_fkey FOREIGN KEY (place_id) REFERENCES public.places(id) ON DELETE CASCADE;
alter table only public.crowd_watches add constraint crowd_watches_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table only public.duplicate_dismissals add constraint duplicate_dismissals_a_fkey FOREIGN KEY (a) REFERENCES public.places(id) ON DELETE CASCADE;
alter table only public.duplicate_dismissals add constraint duplicate_dismissals_b_fkey FOREIGN KEY (b) REFERENCES public.places(id) ON DELETE CASCADE;
alter table only public.duplicate_dismissals add constraint duplicate_dismissals_dismissed_by_fkey FOREIGN KEY (dismissed_by) REFERENCES auth.users(id) ON DELETE SET NULL;
alter table only public.geo_master add constraint geo_master_place_id_fkey FOREIGN KEY (place_id) REFERENCES public.places(id) ON DELETE SET NULL;
alter table only public.manual_review add constraint manual_review_place_id_fkey FOREIGN KEY (place_id) REFERENCES public.places(id) ON DELETE CASCADE;
alter table only public.marketing_assets add constraint marketing_assets_content_item_id_fkey FOREIGN KEY (content_item_id) REFERENCES public.content_items(id) ON DELETE SET NULL;
alter table only public.marketing_assets add constraint marketing_assets_job_id_fkey FOREIGN KEY (job_id) REFERENCES public.marketing_jobs(id) ON DELETE SET NULL;
alter table only public.owner_replies add constraint owner_replies_place_id_fkey FOREIGN KEY (place_id) REFERENCES public.places(id) ON DELETE SET NULL;
alter table only public.place_photos add constraint place_photos_place_id_fkey FOREIGN KEY (place_id) REFERENCES public.places(id) ON DELETE CASCADE;
alter table only public.place_photos add constraint place_photos_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES auth.users(id) ON DELETE SET NULL;
alter table only public.place_photos add constraint place_photos_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;
alter table only public.places add constraint places_merged_into_fkey FOREIGN KEY (merged_into) REFERENCES public.places(id) ON DELETE SET NULL;
alter table only public.profiles add constraint profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table only public.push_subscriptions add constraint push_subscriptions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table only public.reviews add constraint reviews_place_id_fkey FOREIGN KEY (place_id) REFERENCES public.places(id) ON DELETE CASCADE;
alter table only public.reviews add constraint reviews_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;
alter table only public.shared_trip_members add constraint shared_trip_members_trip_id_fkey FOREIGN KEY (trip_id) REFERENCES public.shared_trips(id) ON DELETE CASCADE;
alter table only public.shared_trip_members add constraint shared_trip_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table only public.shared_trips add constraint shared_trips_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table only public.shared_trips add constraint shared_trips_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES auth.users(id) ON DELETE SET NULL;
alter table only public.social_stats add constraint social_stats_content_item_id_fkey FOREIGN KEY (content_item_id) REFERENCES public.content_items(id) ON DELETE SET NULL;
alter table only public.submissions add constraint submissions_place_id_fkey FOREIGN KEY (place_id) REFERENCES public.places(id) ON DELETE SET NULL;
alter table only public.submissions add constraint submissions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;
alter table only public.ticket_messages add constraint ticket_messages_admin_id_fkey FOREIGN KEY (admin_id) REFERENCES public.admins(user_id) ON DELETE SET NULL;
alter table only public.ticket_messages add constraint ticket_messages_ticket_id_fkey FOREIGN KEY (ticket_id) REFERENCES public.tickets(id) ON DELETE CASCADE;
alter table only public.tickets add constraint tickets_assignee_fkey FOREIGN KEY (assignee) REFERENCES public.admins(user_id) ON DELETE SET NULL;
alter table only public.tickets add constraint tickets_place_id_fkey FOREIGN KEY (place_id) REFERENCES public.places(id) ON DELETE SET NULL;
alter table only public.updates_queue add constraint updates_queue_decided_by_fkey FOREIGN KEY (decided_by) REFERENCES auth.users(id) ON DELETE SET NULL;
alter table only public.updates_queue add constraint updates_queue_owner_reply_id_fkey FOREIGN KEY (owner_reply_id) REFERENCES public.owner_replies(id) ON DELETE SET NULL;
alter table only public.updates_queue add constraint updates_queue_place_id_fkey FOREIGN KEY (place_id) REFERENCES public.places(id) ON DELETE CASCADE;
alter table only public.updates_queue add constraint updates_queue_submission_id_fkey FOREIGN KEY (submission_id) REFERENCES public.submissions(id) ON DELETE SET NULL;
alter table only public.updates_queue add constraint updates_queue_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;
alter table only public.user_expenses add constraint user_expenses_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table only public.user_trips add constraint user_trips_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table only public.user_vehicles add constraint user_vehicles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- Indexen
CREATE UNIQUE INDEX verwijderde_plekken_osm ON private.verwijderde_plekken USING btree (osm_type, osm_id) WHERE (osm_id IS NOT NULL);
CREATE INDEX admin_logs_kind_source ON public.admin_logs USING btree (kind, source, ts DESC);
CREATE INDEX admin_logs_pending ON public.admin_logs USING btree (request_id) WHERE (status = 'pending'::text);
CREATE INDEX admin_logs_ts ON public.admin_logs USING btree (ts DESC);
CREATE INDEX app_logs_ts_idx ON public.app_logs USING btree (ts DESC);
CREATE INDEX content_items_planned_idx ON public.content_items USING btree (planned_on);
CREATE INDEX crowd_reports_place_time_idx ON public.crowd_reports USING btree (place_id, created_at DESC);
CREATE INDEX crowd_reports_user_time_idx ON public.crowd_reports USING btree (user_id, created_at DESC);
CREATE INDEX crowd_watches_place_idx ON public.crowd_watches USING btree (place_id) WHERE (notified_at IS NULL);
CREATE INDEX dependency_updates_status ON public.dependency_updates USING btree (status, updated_at DESC);
CREATE INDEX events_ts_idx ON public.events USING btree (ts DESC);
CREATE INDEX geo_master_bron_ids ON public.geo_master USING gin (bron_ids);
CREATE INDEX geo_master_geohash ON public.geo_master USING btree (geohash text_pattern_ops);
CREATE INDEX geo_master_te_promoveren ON public.geo_master USING btree (bijgewerkt_op) WHERE (place_id IS NULL);
CREATE INDEX marketing_assets_created_idx ON public.marketing_assets USING btree (created_at DESC);
CREATE INDEX marketing_jobs_open_idx ON public.marketing_jobs USING btree (created_at) WHERE (status = ANY (ARRAY['wacht'::text, 'bezig'::text]));
CREATE INDEX osm_staging_todo_idx ON public.osm_staging USING btree (kind, id) WHERE (processed_at IS NULL);
CREATE INDEX owner_replies_place ON public.owner_replies USING btree (place_id, received_at DESC);
CREATE INDEX owner_replies_received ON public.owner_replies USING btree (received_at DESC);
CREATE INDEX place_photos_place_idx ON public.place_photos USING btree (place_id);
CREATE INDEX place_photos_status_idx ON public.place_photos USING btree (status, created_at);
CREATE INDEX place_photos_user_idx ON public.place_photos USING btree (user_id);
CREATE INDEX places_geom_all_gist ON public.places USING gist (geom);
CREATE INDEX places_geom_gist ON public.places USING gist (geom) WHERE (status = 'published'::text);
CREATE INDEX places_lat_lng ON public.places USING btree (lat, lng) WHERE (merged_into IS NULL);
CREATE INDEX places_merged_into_idx ON public.places USING btree (merged_into) WHERE (merged_into IS NOT NULL);
CREATE INDEX places_name_trgm_idx ON public.places USING gin (name extensions.gin_trgm_ops);
CREATE INDEX places_province_idx ON public.places USING btree (province);
CREATE INDEX places_status_idx ON public.places USING btree (status);
CREATE INDEX push_subscriptions_user_idx ON public.push_subscriptions USING btree (user_id) WHERE (disabled_at IS NULL);
CREATE INDEX reviews_place_idx ON public.reviews USING btree (place_id, status);
CREATE INDEX reviews_user_idx ON public.reviews USING btree (user_id, created_at) WHERE (user_id IS NOT NULL);
CREATE INDEX seo_daily_page_idx ON public.seo_daily USING btree (page, date);
CREATE INDEX shared_trip_members_user_idx ON public.shared_trip_members USING btree (user_id) WHERE (left_at IS NULL);
CREATE INDEX submissions_place_user_idx ON public.submissions USING btree (place_id, user_id) WHERE (user_id IS NOT NULL);
CREATE INDEX ticket_messages_ticket_idx ON public.ticket_messages USING btree (ticket_id, created_at);
CREATE INDEX updates_queue_open ON public.updates_queue USING btree (created_at) WHERE (status = 'pending'::text);
CREATE UNIQUE INDEX updates_queue_owner_reply ON public.updates_queue USING btree (owner_reply_id, field_changed) WHERE (owner_reply_id IS NOT NULL);
CREATE INDEX updates_queue_place ON public.updates_queue USING btree (place_id);

-- Triggers
CREATE TRIGGER on_auth_user_confirmed AFTER UPDATE OF email_confirmed_at ON auth.users FOR EACH ROW WHEN (((old.email_confirmed_at IS NULL) AND (new.email_confirmed_at IS NOT NULL))) EXECUTE FUNCTION private.on_auth_user_created();
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION private.on_auth_user_created();
CREATE TRIGGER on_auth_user_profile AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION private.create_profile();
CREATE TRIGGER admins_sync_profile_role AFTER INSERT OR DELETE OR UPDATE OF role ON public.admins FOR EACH ROW EXECUTE FUNCTION private.sync_profile_role();
CREATE TRIGGER content_items_touch BEFORE UPDATE ON public.content_items FOR EACH ROW EXECUTE FUNCTION private.touch_updated_at();
CREATE TRIGGER crowd_reports_notify AFTER INSERT OR UPDATE OF level ON public.crowd_reports FOR EACH ROW EXECUTE FUNCTION private.crowd_notify();
CREATE TRIGGER faq_audit AFTER INSERT OR DELETE OR UPDATE ON public.faq FOR EACH ROW EXECUTE FUNCTION private.audit();
CREATE TRIGGER ingest_runs_to_admin_logs AFTER INSERT OR UPDATE OF finished_at ON public.ingest_runs FOR EACH ROW EXECUTE FUNCTION private.on_ingest_run_done();
CREATE TRIGGER place_photos_auto_approve AFTER INSERT ON public.place_photos FOR EACH ROW EXECUTE FUNCTION private.auto_approve_photo();
CREATE TRIGGER place_photos_rate_limit BEFORE INSERT ON public.place_photos FOR EACH ROW EXECUTE FUNCTION private.photo_rate_limit();
CREATE TRIGGER place_photos_sync BEFORE UPDATE OF status ON public.place_photos FOR EACH ROW EXECUTE FUNCTION private.sync_place_photo();
CREATE TRIGGER places_audit AFTER DELETE OR UPDATE ON public.places FOR EACH ROW EXECUTE FUNCTION private.audit();
CREATE TRIGGER places_before_write BEFORE INSERT OR UPDATE ON public.places FOR EACH ROW EXECUTE FUNCTION private.places_before_write();
CREATE TRIGGER weiger_verwijderde_plek BEFORE INSERT ON public.places FOR EACH ROW EXECUTE FUNCTION private.weiger_verwijderde_plek();
CREATE TRIGGER reviews_audit AFTER DELETE OR UPDATE ON public.reviews FOR EACH ROW EXECUTE FUNCTION private.audit();
CREATE TRIGGER reviews_refresh_rating AFTER INSERT OR DELETE OR UPDATE ON public.reviews FOR EACH ROW EXECUTE FUNCTION private.refresh_place_rating();
CREATE TRIGGER shared_trips_touch BEFORE UPDATE ON public.shared_trips FOR EACH ROW EXECUTE FUNCTION private.shared_trip_touch();
CREATE TRIGGER submissions_audit AFTER DELETE OR UPDATE ON public.submissions FOR EACH ROW EXECUTE FUNCTION private.audit();
CREATE TRIGGER submissions_to_queue AFTER INSERT ON public.submissions FOR EACH ROW EXECUTE FUNCTION private.on_submission_queue();
CREATE TRIGGER ticket_messages_touch AFTER INSERT ON public.ticket_messages FOR EACH ROW EXECUTE FUNCTION private.touch_ticket();
CREATE TRIGGER tickets_audit AFTER DELETE OR UPDATE ON public.tickets FOR EACH ROW EXECUTE FUNCTION private.audit();

-- Rijbeveiliging
alter table private.stealth_queue enable row level security;
alter table private.verwijderde_plekken enable row level security;
alter table public.admin_logs enable row level security;
alter table public.admins enable row level security;
alter table public.app_logs enable row level security;
alter table public.audit_log enable row level security;
alter table public.campaigns enable row level security;
alter table public.consent_log enable row level security;
alter table public.content_items enable row level security;
alter table public.crowd_reports enable row level security;
alter table public.crowd_watches enable row level security;
alter table public.dependency_updates enable row level security;
alter table public.duplicate_dismissals enable row level security;
alter table public.events enable row level security;
alter table public.faq enable row level security;
alter table public.geo_bronnen enable row level security;
alter table public.geo_master enable row level security;
alter table public.ingest_runs enable row level security;
alter table public.internal_secrets enable row level security;
alter table public.manual_review enable row level security;
alter table public.marketing_assets enable row level security;
alter table public.marketing_jobs enable row level security;
alter table public.nl_towns enable row level security;
alter table public.osm_queries enable row level security;
alter table public.osm_regions enable row level security;
alter table public.osm_staging enable row level security;
alter table public.owner_replies enable row level security;
alter table public.place_photos enable row level security;
alter table public.places enable row level security;
alter table public.profiles enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.reviews enable row level security;
alter table public.route_cache enable row level security;
alter table public.seo_daily enable row level security;
alter table public.seo_pages enable row level security;
alter table public.seo_status enable row level security;
alter table public.seo_totals enable row level security;
alter table public.shared_trip_members enable row level security;
alter table public.shared_trips enable row level security;
alter table public.site_settings enable row level security;
alter table public.social_stats enable row level security;
alter table public.submissions enable row level security;
alter table public.ticket_messages enable row level security;
alter table public.tickets enable row level security;
alter table public.updates_queue enable row level security;
alter table public.user_expenses enable row level security;
alter table public.user_trips enable row level security;
alter table public.user_vehicles enable row level security;

-- Policies
create policy "alleen admin" on public.admin_logs as permissive for all to authenticated using (( SELECT public.has_admin_role() AS has_admin_role)) with check (( SELECT public.has_admin_role() AS has_admin_role));
create policy "admins zien admins" on public.admins as permissive for select to authenticated using (( SELECT public.is_admin() AS is_admin));
create policy "admins logs" on public.app_logs as permissive for select to authenticated using (( SELECT public.is_admin() AS is_admin));
create policy "admins audit" on public.audit_log as permissive for select to authenticated using (( SELECT public.is_admin() AS is_admin));
create policy campaigns_admin on public.campaigns as permissive for all to authenticated using (( SELECT public.has_admin_role() AS has_admin_role)) with check (( SELECT public.has_admin_role() AS has_admin_role));
create policy "admins consent" on public.consent_log as permissive for select to authenticated using (( SELECT public.is_admin() AS is_admin));
create policy content_items_admin on public.content_items as permissive for all to authenticated using (( SELECT public.has_admin_role() AS has_admin_role)) with check (( SELECT public.has_admin_role() AS has_admin_role));
create policy "beheer leest drukte" on public.crowd_reports as permissive for select to authenticated using (( SELECT public.is_admin() AS is_admin));
create policy "eigen volgers lezen" on public.crowd_watches as permissive for select to authenticated using ((user_id = ( SELECT auth.uid() AS uid)));
create policy "alleen admin" on public.dependency_updates as permissive for all to authenticated using (( SELECT public.has_admin_role() AS has_admin_role)) with check (( SELECT public.has_admin_role() AS has_admin_role));
create policy "beheer dubbelen" on public.duplicate_dismissals as permissive for all to authenticated using (( SELECT public.is_admin() AS is_admin)) with check (( SELECT public.is_admin() AS is_admin));
create policy "admins events" on public.events as permissive for select to authenticated using (( SELECT public.is_admin() AS is_admin));
create policy "admins faq delete" on public.faq as permissive for delete to authenticated using (( SELECT public.is_admin() AS is_admin));
create policy "admins faq insert" on public.faq as permissive for insert to authenticated with check (( SELECT public.is_admin() AS is_admin));
create policy "admins faq update" on public.faq as permissive for update to authenticated using (( SELECT public.is_admin() AS is_admin)) with check (( SELECT public.is_admin() AS is_admin));
create policy "faq lezen" on public.faq as permissive for select to anon, authenticated using ((published OR ( SELECT public.is_admin() AS is_admin)));
create policy "admins runs" on public.ingest_runs as permissive for select to authenticated using (( SELECT public.is_admin() AS is_admin));
create policy marketing_assets_admin on public.marketing_assets as permissive for all to authenticated using (( SELECT public.has_admin_role() AS has_admin_role)) with check (( SELECT public.has_admin_role() AS has_admin_role));
create policy marketing_jobs_admin on public.marketing_jobs as permissive for all to authenticated using (( SELECT public.has_admin_role() AS has_admin_role)) with check (( SELECT public.has_admin_role() AS has_admin_role));
create policy "woonplaatsen lezen" on public.nl_towns as permissive for select to anon, authenticated using (true);
create policy "alleen admin" on public.owner_replies as permissive for all to authenticated using (( SELECT public.has_admin_role() AS has_admin_role)) with check (( SELECT public.has_admin_role() AS has_admin_role));
create policy "beheer foto's" on public.place_photos as permissive for update to authenticated using (( SELECT public.is_admin() AS is_admin)) with check (( SELECT public.is_admin() AS is_admin));
create policy "eigen foto's en beheer lezen" on public.place_photos as permissive for select to authenticated using (((user_id = ( SELECT auth.uid() AS uid)) OR ( SELECT public.is_admin() AS is_admin)));
create policy "foto insturen" on public.place_photos as permissive for insert to authenticated with check (((user_id = ( SELECT auth.uid() AS uid)) AND (status = 'pending'::text) AND (reviewed_by IS NULL) AND (split_part(storage_path, '/'::text, 1) = (( SELECT auth.uid() AS uid))::text)));
create policy "admins plekken delete" on public.places as permissive for delete to authenticated using (( SELECT public.is_admin() AS is_admin));
create policy "admins plekken insert" on public.places as permissive for insert to authenticated with check (( SELECT public.is_admin() AS is_admin));
create policy "admins plekken update" on public.places as permissive for update to authenticated using (( SELECT public.is_admin() AS is_admin)) with check (( SELECT public.is_admin() AS is_admin));
create policy "plekken lezen" on public.places as permissive for select to anon, authenticated using (((status = 'published'::text) OR ( SELECT public.is_admin() AS is_admin)));
create policy "eigen profiel lezen" on public.profiles as permissive for select to authenticated using ((( SELECT auth.uid() AS uid) = id));
create policy "eigen profiel wijzigen" on public.profiles as permissive for update to authenticated using ((( SELECT auth.uid() AS uid) = id)) with check ((( SELECT auth.uid() AS uid) = id));
create policy "eigen abonnementen lezen" on public.push_subscriptions as permissive for select to authenticated using ((user_id = ( SELECT auth.uid() AS uid)));
create policy "admins reviews delete" on public.reviews as permissive for delete to authenticated using (( SELECT public.is_admin() AS is_admin));
create policy "admins reviews update" on public.reviews as permissive for update to authenticated using (( SELECT public.is_admin() AS is_admin)) with check (( SELECT public.is_admin() AS is_admin));
create policy "reviews lezen" on public.reviews as permissive for select to anon, authenticated using (((status = 'approved'::text) OR ( SELECT public.is_admin() AS is_admin)));
create policy "routecache lezen" on public.route_cache as permissive for select to anon, authenticated using (true);
create policy seo_daily_admin on public.seo_daily as permissive for all to authenticated using (( SELECT public.has_admin_role() AS has_admin_role)) with check (( SELECT public.has_admin_role() AS has_admin_role));
create policy seo_pages_admin on public.seo_pages as permissive for all to authenticated using (( SELECT public.has_admin_role() AS has_admin_role)) with check (( SELECT public.has_admin_role() AS has_admin_role));
create policy seo_status_admin on public.seo_status as permissive for all to authenticated using (( SELECT public.has_admin_role() AS has_admin_role)) with check (( SELECT public.has_admin_role() AS has_admin_role));
create policy seo_totals_admin on public.seo_totals as permissive for all to authenticated using (( SELECT public.has_admin_role() AS has_admin_role)) with check (( SELECT public.has_admin_role() AS has_admin_role));
create policy "leden zien elkaar" on public.shared_trip_members as permissive for select to authenticated using (( SELECT public.is_trip_member(shared_trip_members.trip_id) AS is_trip_member));
create policy "leden lezen de reis" on public.shared_trips as permissive for select to authenticated using (( SELECT public.is_trip_member(shared_trips.id) AS is_trip_member));
create policy "leden wijzigen de reis" on public.shared_trips as permissive for update to authenticated using (( SELECT public.is_trip_member(shared_trips.id) AS is_trip_member)) with check (( SELECT public.is_trip_member(shared_trips.id) AS is_trip_member));
create policy "admins instellingen insert" on public.site_settings as permissive for insert to authenticated with check (( SELECT public.is_admin() AS is_admin));
create policy "admins instellingen update" on public.site_settings as permissive for update to authenticated using (( SELECT public.is_admin() AS is_admin)) with check (( SELECT public.is_admin() AS is_admin));
create policy "instellingen lezen" on public.site_settings as permissive for select to anon, authenticated using (true);
create policy social_stats_admin on public.social_stats as permissive for all to authenticated using (( SELECT public.has_admin_role() AS has_admin_role)) with check (( SELECT public.has_admin_role() AS has_admin_role));
create policy "admins inzendingen" on public.submissions as permissive for all to authenticated using (( SELECT public.is_admin() AS is_admin)) with check (( SELECT public.is_admin() AS is_admin));
create policy "admins berichten" on public.ticket_messages as permissive for all to authenticated using (( SELECT public.is_admin() AS is_admin)) with check (( SELECT public.is_admin() AS is_admin));
create policy "admins tickets" on public.tickets as permissive for all to authenticated using (( SELECT public.is_admin() AS is_admin)) with check (( SELECT public.is_admin() AS is_admin));
create policy "alleen admin" on public.updates_queue as permissive for all to authenticated using (( SELECT public.has_admin_role() AS has_admin_role)) with check (( SELECT public.has_admin_role() AS has_admin_role));
create policy "eigen uitgaven" on public.user_expenses as permissive for all to authenticated using ((( SELECT auth.uid() AS uid) = user_id)) with check ((( SELECT auth.uid() AS uid) = user_id));
create policy "eigen reis" on public.user_trips as permissive for all to authenticated using ((( SELECT auth.uid() AS uid) = user_id)) with check ((( SELECT auth.uid() AS uid) = user_id));
create policy "eigen camper" on public.user_vehicles as permissive for all to authenticated using ((( SELECT auth.uid() AS uid) = user_id)) with check ((( SELECT auth.uid() AS uid) = user_id));
create policy "eigen documenten lezen" on storage.objects as permissive for select to authenticated using (((bucket_id = 'vehicle-docs'::text) AND ((storage.foldername(name))[1] = (( SELECT auth.uid() AS uid))::text)));
create policy "eigen documenten uploaden" on storage.objects as permissive for insert to authenticated with check (((bucket_id = 'vehicle-docs'::text) AND ((storage.foldername(name))[1] = (( SELECT auth.uid() AS uid))::text)));
create policy "eigen documenten weghalen" on storage.objects as permissive for delete to authenticated using (((bucket_id = 'vehicle-docs'::text) AND ((storage.foldername(name))[1] = (( SELECT auth.uid() AS uid))::text)));
create policy "foto uploaden in eigen map" on storage.objects as permissive for insert to authenticated with check (((bucket_id = 'place-photos'::text) AND ((storage.foldername(name))[1] = (( SELECT auth.uid() AS uid))::text)));
create policy marketing_admin_all on storage.objects as permissive for all to authenticated using (((bucket_id = 'marketing'::text) AND ( SELECT public.has_admin_role() AS has_admin_role))) with check (((bucket_id = 'marketing'::text) AND ( SELECT public.has_admin_role() AS has_admin_role)));
create policy marketing_job_upload on storage.objects as permissive for insert to anon with check (((bucket_id = 'marketing'::text) AND public.marketing_upload_allowed(name)));

-- Rechten op tabellen
revoke all on table private.admin_invites from public, anon, authenticated, service_role;
revoke all on table private.nacontrole_20261108 from public, anon, authenticated, service_role;
revoke all on table private.pdok_woonplaats_20261024 from public, anon, authenticated, service_role;
revoke all on table private.rate_counter from public, anon, authenticated, service_role;
revoke all on table private.scrape_baseline_20261023 from public, anon, authenticated, service_role;
revoke all on table private.scrape_baseline_20261024 from public, anon, authenticated, service_role;
revoke all on table private.scrape_na_ronde1_20261023 from public, anon, authenticated, service_role;
revoke all on table private.scrape_queue from public, anon, authenticated, service_role;
revoke all on table private.secrets from public, anon, authenticated, service_role;
revoke all on table private.snap_v34 from public, anon, authenticated, service_role;
revoke all on table private.snap_v35 from public, anon, authenticated, service_role;
revoke all on table private.snap_v36 from public, anon, authenticated, service_role;
revoke all on table private.snap_v38 from public, anon, authenticated, service_role;
revoke all on table private.snap_velden from public, anon, authenticated, service_role;
revoke all on table private.stealth_queue from public, anon, authenticated, service_role;
revoke all on table private.town_correcties_20261024 from public, anon, authenticated, service_role;
revoke all on table private.verwijderde_plekken from public, anon, authenticated, service_role;
revoke all on table public.admin_logs from public, anon, authenticated, service_role;
revoke all on table public.admins from public, anon, authenticated, service_role;
revoke all on table public.app_logs from public, anon, authenticated, service_role;
revoke all on table public.audit_log from public, anon, authenticated, service_role;
revoke all on table public.campaigns from public, anon, authenticated, service_role;
revoke all on table public.consent_log from public, anon, authenticated, service_role;
revoke all on table public.content_items from public, anon, authenticated, service_role;
revoke all on table public.crowd_reports from public, anon, authenticated, service_role;
revoke all on table public.crowd_watches from public, anon, authenticated, service_role;
revoke all on table public.dependency_updates from public, anon, authenticated, service_role;
revoke all on table public.duplicate_dismissals from public, anon, authenticated, service_role;
revoke all on table public.events from public, anon, authenticated, service_role;
revoke all on table public.faq from public, anon, authenticated, service_role;
revoke all on table public.geo_bronnen from public, anon, authenticated, service_role;
revoke all on table public.geo_master from public, anon, authenticated, service_role;
revoke all on table public.ingest_runs from public, anon, authenticated, service_role;
revoke all on table public.internal_secrets from public, anon, authenticated, service_role;
revoke all on table public.manual_review from public, anon, authenticated, service_role;
revoke all on table public.marketing_assets from public, anon, authenticated, service_role;
revoke all on table public.marketing_jobs from public, anon, authenticated, service_role;
revoke all on table public.nl_towns from public, anon, authenticated, service_role;
revoke all on table public.osm_queries from public, anon, authenticated, service_role;
revoke all on table public.osm_regions from public, anon, authenticated, service_role;
revoke all on table public.osm_staging from public, anon, authenticated, service_role;
revoke all on table public.owner_replies from public, anon, authenticated, service_role;
revoke all on table public.place_photos from public, anon, authenticated, service_role;
revoke all on table public.places from public, anon, authenticated, service_role;
revoke all on table public.profiles from public, anon, authenticated, service_role;
revoke all on table public.push_subscriptions from public, anon, authenticated, service_role;
revoke all on table public.reviews from public, anon, authenticated, service_role;
revoke all on table public.route_cache from public, anon, authenticated, service_role;
revoke all on table public.seo_daily from public, anon, authenticated, service_role;
revoke all on table public.seo_pages from public, anon, authenticated, service_role;
revoke all on table public.seo_status from public, anon, authenticated, service_role;
revoke all on table public.seo_totals from public, anon, authenticated, service_role;
revoke all on table public.shared_trip_members from public, anon, authenticated, service_role;
revoke all on table public.shared_trips from public, anon, authenticated, service_role;
revoke all on table public.site_settings from public, anon, authenticated, service_role;
revoke all on table public.social_stats from public, anon, authenticated, service_role;
revoke all on table public.submissions from public, anon, authenticated, service_role;
revoke all on table public.ticket_messages from public, anon, authenticated, service_role;
revoke all on table public.tickets from public, anon, authenticated, service_role;
revoke all on table public.updates_queue from public, anon, authenticated, service_role;
revoke all on table public.user_expenses from public, anon, authenticated, service_role;
revoke all on table public.user_trips from public, anon, authenticated, service_role;
revoke all on table public.user_vehicles from public, anon, authenticated, service_role;
grant delete, insert, maintain, select, update on table public.admin_logs to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.admin_logs to service_role;
grant maintain, references, select, trigger on table public.admins to anon;
grant maintain, references, select, trigger on table public.admins to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.admins to service_role;
grant maintain, references, select, trigger on table public.app_logs to anon;
grant maintain, references, select, trigger on table public.app_logs to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.app_logs to service_role;
grant maintain, references, select, trigger on table public.audit_log to anon;
grant maintain, references, select, trigger on table public.audit_log to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.audit_log to service_role;
grant delete, insert, select, update on table public.campaigns to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.campaigns to service_role;
grant maintain, references, select, trigger on table public.consent_log to anon;
grant maintain, references, select, trigger on table public.consent_log to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.consent_log to service_role;
grant delete, insert, select, update on table public.content_items to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.content_items to service_role;
grant select on table public.crowd_reports to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.crowd_reports to service_role;
grant select on table public.crowd_watches to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.crowd_watches to service_role;
grant delete, insert, maintain, select, update on table public.dependency_updates to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.dependency_updates to service_role;
grant delete, insert, maintain, references, select, trigger, update on table public.duplicate_dismissals to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.duplicate_dismissals to service_role;
grant maintain, references, select, trigger on table public.events to anon;
grant maintain, references, select, trigger on table public.events to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.events to service_role;
grant maintain, references, select, trigger on table public.faq to anon;
grant delete, insert, maintain, references, select, trigger, update on table public.faq to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.faq to service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.geo_bronnen to service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.geo_master to service_role;
grant maintain, references, select, trigger on table public.ingest_runs to anon;
grant maintain, references, select, trigger on table public.ingest_runs to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.ingest_runs to service_role;
grant maintain, references, select, trigger on table public.internal_secrets to anon;
grant maintain, references, select, trigger on table public.internal_secrets to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.internal_secrets to service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.manual_review to service_role;
grant delete, insert, select, update on table public.marketing_assets to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.marketing_assets to service_role;
grant delete, insert, select, update on table public.marketing_jobs to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.marketing_jobs to service_role;
grant maintain, references, select, trigger on table public.nl_towns to anon;
grant maintain, references, select, trigger on table public.nl_towns to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.nl_towns to service_role;
grant maintain, references, select, trigger on table public.osm_queries to anon;
grant maintain, references, select, trigger on table public.osm_queries to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.osm_queries to service_role;
grant maintain, references, select, trigger on table public.osm_regions to anon;
grant maintain, references, select, trigger on table public.osm_regions to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.osm_regions to service_role;
grant maintain, references, select, trigger on table public.osm_staging to anon;
grant maintain, references, select, trigger on table public.osm_staging to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.osm_staging to service_role;
grant delete, insert, maintain, select, update on table public.owner_replies to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.owner_replies to service_role;
grant delete, insert, maintain, references, select, trigger, update on table public.place_photos to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.place_photos to service_role;
grant maintain, references, select, trigger on table public.places to anon;
grant delete, insert, maintain, references, select, trigger, update on table public.places to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.places to service_role;
grant maintain, references, select, trigger on table public.profiles to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.profiles to service_role;
grant select on table public.push_subscriptions to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.push_subscriptions to service_role;
grant maintain, references, select, trigger on table public.reviews to anon;
grant delete, insert, maintain, references, select, trigger, update on table public.reviews to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.reviews to service_role;
grant maintain, references, select, trigger on table public.route_cache to anon;
grant maintain, references, select, trigger on table public.route_cache to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.route_cache to service_role;
grant delete, insert, select, update on table public.seo_daily to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.seo_daily to service_role;
grant delete, insert, select, update on table public.seo_pages to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.seo_pages to service_role;
grant delete, insert, select, update on table public.seo_status to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.seo_status to service_role;
grant delete, insert, select, update on table public.seo_totals to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.seo_totals to service_role;
grant select on table public.shared_trip_members to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.shared_trip_members to service_role;
grant select on table public.shared_trips to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.shared_trips to service_role;
grant maintain, references, select, trigger on table public.site_settings to anon;
grant delete, insert, maintain, references, select, trigger, update on table public.site_settings to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.site_settings to service_role;
grant delete, insert, select, update on table public.social_stats to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.social_stats to service_role;
grant maintain, references, select, trigger on table public.submissions to anon;
grant delete, insert, maintain, references, select, trigger, update on table public.submissions to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.submissions to service_role;
grant maintain, references, select, trigger on table public.ticket_messages to anon;
grant delete, insert, maintain, references, select, trigger, update on table public.ticket_messages to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.ticket_messages to service_role;
grant maintain, references, select, trigger on table public.tickets to anon;
grant delete, insert, maintain, references, select, trigger, update on table public.tickets to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.tickets to service_role;
grant delete, insert, maintain, select, update on table public.updates_queue to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.updates_queue to service_role;
grant delete, insert, maintain, references, select, trigger, update on table public.user_expenses to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.user_expenses to service_role;
grant delete, insert, maintain, references, select, trigger, update on table public.user_trips to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.user_trips to service_role;
grant delete, insert, maintain, references, select, trigger, update on table public.user_vehicles to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.user_vehicles to service_role;

-- Kolomrechten
grant update (avatar_url) on table public.profiles to authenticated;
grant update (display_name) on table public.profiles to authenticated;
grant update (updated_at) on table public.profiles to authenticated;
grant update (name) on table public.shared_trips to authenticated;
grant update (stops) on table public.shared_trips to authenticated;
grant update (updated_at) on table public.shared_trips to authenticated;
grant update (updated_by) on table public.shared_trips to authenticated;

-- Rechten op reeksen
revoke all on sequence private.nacontrole_20261108_id_seq from public, anon, authenticated, service_role;
revoke all on sequence public.admin_logs_id_seq from public, anon, authenticated, service_role;
revoke all on sequence public.app_logs_id_seq from public, anon, authenticated, service_role;
revoke all on sequence public.audit_log_id_seq from public, anon, authenticated, service_role;
revoke all on sequence public.consent_log_id_seq from public, anon, authenticated, service_role;
revoke all on sequence public.crowd_reports_id_seq from public, anon, authenticated, service_role;
revoke all on sequence public.events_id_seq from public, anon, authenticated, service_role;
revoke all on sequence public.ingest_runs_id_seq from public, anon, authenticated, service_role;
revoke all on sequence public.nl_towns_id_seq from public, anon, authenticated, service_role;
revoke all on sequence public.osm_staging_id_seq from public, anon, authenticated, service_role;
revoke all on sequence public.tickets_number_seq from public, anon, authenticated, service_role;
grant select, update, usage on sequence public.admin_logs_id_seq to anon;
grant select, update, usage on sequence public.admin_logs_id_seq to authenticated;
grant select, update, usage on sequence public.admin_logs_id_seq to service_role;
grant select, update, usage on sequence public.app_logs_id_seq to anon;
grant select, update, usage on sequence public.app_logs_id_seq to authenticated;
grant select, update, usage on sequence public.app_logs_id_seq to service_role;
grant select, update, usage on sequence public.audit_log_id_seq to anon;
grant select, update, usage on sequence public.audit_log_id_seq to authenticated;
grant select, update, usage on sequence public.audit_log_id_seq to service_role;
grant select, update, usage on sequence public.consent_log_id_seq to anon;
grant select, update, usage on sequence public.consent_log_id_seq to authenticated;
grant select, update, usage on sequence public.consent_log_id_seq to service_role;
grant select, update, usage on sequence public.crowd_reports_id_seq to anon;
grant select, update, usage on sequence public.crowd_reports_id_seq to authenticated;
grant select, update, usage on sequence public.crowd_reports_id_seq to service_role;
grant select, update, usage on sequence public.events_id_seq to anon;
grant select, update, usage on sequence public.events_id_seq to authenticated;
grant select, update, usage on sequence public.events_id_seq to service_role;
grant select, update, usage on sequence public.ingest_runs_id_seq to anon;
grant select, update, usage on sequence public.ingest_runs_id_seq to authenticated;
grant select, update, usage on sequence public.ingest_runs_id_seq to service_role;
grant select, update, usage on sequence public.nl_towns_id_seq to anon;
grant select, update, usage on sequence public.nl_towns_id_seq to authenticated;
grant select, update, usage on sequence public.nl_towns_id_seq to service_role;
grant select, update, usage on sequence public.osm_staging_id_seq to anon;
grant select, update, usage on sequence public.osm_staging_id_seq to authenticated;
grant select, update, usage on sequence public.osm_staging_id_seq to service_role;
grant select, update, usage on sequence public.tickets_number_seq to anon;
grant select, update, usage on sequence public.tickets_number_seq to authenticated;
grant select, update, usage on sequence public.tickets_number_seq to service_role;

-- Rechten op functies
revoke all on function private.apply_retention() from public, anon, authenticated, service_role;
revoke all on function private.audit() from public, anon, authenticated, service_role;
revoke all on function private.auto_approve_photo() from public, anon, authenticated, service_role;
revoke all on function private.call_discover(integer) from public, anon, authenticated, service_role;
revoke all on function private.call_pipeline(jsonb) from public, anon, authenticated, service_role;
revoke all on function private.close_submission(uuid,text) from public, anon, authenticated, service_role;
revoke all on function private.collect_osm() from public, anon, authenticated, service_role;
revoke all on function private.concept_reden(public.places) from public, anon, authenticated, service_role;
revoke all on function private.create_profile() from public, anon, authenticated, service_role;
revoke all on function private.crowd_notify() from public, anon, authenticated, service_role;
revoke all on function private.decode_entities(text) from public, anon, authenticated, service_role;
revoke all on function private.enqueue_stale_scrape(integer,integer) from public, anon, authenticated, service_role;
revoke all on function private.enqueue_stealth(integer,integer) from public, anon, authenticated, service_role;
revoke all on function private.forceer_kernfeit_scrape(integer) from public, anon, authenticated, service_role;
revoke all on function private.geo_afstand_m(double precision,double precision,double precision,double precision) from public, anon, authenticated, service_role;
revoke all on function private.geo_bestaande_plek(public.geo_master) from public, anon, authenticated, service_role;
revoke all on function private.geo_bool(jsonb,text) from public, anon, authenticated, service_role;
revoke all on function private.geo_eerder_verwijderd(public.geo_master) from public, anon, authenticated, service_role;
revoke all on function private.geo_naam_kern(text) from public, anon, authenticated, service_role;
revoke all on function private.geo_nummers_botsen(text,text) from public, anon, authenticated, service_role;
revoke all on function private.geo_promotie_bezwaar(public.geo_master) from public, anon, authenticated, service_role;
revoke all on function private.log(text,text,text,jsonb) from public, anon, authenticated, service_role;
revoke all on function private.markeer_handmatig() from public, anon, authenticated, service_role;
revoke all on function private.marketing_claim_job() from public, anon, authenticated, service_role;
revoke all on function private.marketing_cleanup() from public, anon, authenticated, service_role;
revoke all on function private.marketing_finish_job(uuid,jsonb,text) from public, anon, authenticated, service_role;
revoke all on function private.next_osm_region() from public, anon, authenticated, service_role;
revoke all on function private.on_auth_user_created() from public, anon, authenticated, service_role;
revoke all on function private.on_ingest_run_done() from public, anon, authenticated, service_role;
revoke all on function private.on_submission_queue() from public, anon, authenticated, service_role;
revoke all on function private.ops_probe() from public, anon, authenticated, service_role;
revoke all on function private.overpass_get(text,text) from public, anon, authenticated, service_role;
revoke all on function private.overpass_get(text,text,integer) from public, anon, authenticated, service_role;
revoke all on function private.photo_rate_limit() from public, anon, authenticated, service_role;
revoke all on function private.places_before_write() from public, anon, authenticated, service_role;
revoke all on function private.publish_threshold() from public, anon, authenticated, service_role;
revoke all on function private.queue_fields() from public, anon, authenticated, service_role;
revoke all on function private.queue_from_submission(public.submissions) from public, anon, authenticated, service_role;
revoke all on function private.rate_take(text,integer,interval) from public, anon, authenticated, service_role;
revoke all on function private.refresh_place_rating() from public, anon, authenticated, service_role;
revoke all on function private.safe_path(text) from public, anon, authenticated, service_role;
revoke all on function private.shared_trip_touch() from public, anon, authenticated, service_role;
revoke all on function private.sync_place_photo() from public, anon, authenticated, service_role;
revoke all on function private.sync_profile_role() from public, anon, authenticated, service_role;
revoke all on function private.time_minutes(text) from public, anon, authenticated, service_role;
revoke all on function private.touch_ticket() from public, anon, authenticated, service_role;
revoke all on function private.touch_updated_at() from public, anon, authenticated, service_role;
revoke all on function private.user_trust(uuid) from public, anon, authenticated, service_role;
revoke all on function private.verwijder_onbereikbare_plekken(boolean) from public, anon, authenticated, service_role;
revoke all on function private.weiger_verwijderde_plek() from public, anon, authenticated, service_role;
revoke all on function public.admin_apply_update(uuid) from public, anon, authenticated, service_role;
revoke all on function public.admin_concept_redenen() from public, anon, authenticated, service_role;
revoke all on function public.admin_duplicate_candidates(integer,integer) from public, anon, authenticated, service_role;
revoke all on function public.admin_manual_review() from public, anon, authenticated, service_role;
revoke all on function public.admin_mark_beheer(uuid,text[]) from public, anon, authenticated, service_role;
revoke all on function public.admin_merge_places(uuid,uuid) from public, anon, authenticated, service_role;
revoke all on function public.admin_overview() from public, anon, authenticated, service_role;
revoke all on function public.admin_pipeline(text) from public, anon, authenticated, service_role;
revoke all on function public.admin_reject_update(uuid,text) from public, anon, authenticated, service_role;
revoke all on function public.admin_stats(integer) from public, anon, authenticated, service_role;
revoke all on function public.apply_discovery(uuid,text) from public, anon, authenticated, service_role;
revoke all on function public.apply_pdok(uuid,text,text,integer) from public, anon, authenticated, service_role;
revoke all on function public.apply_scrape(uuid,jsonb,text) from public, anon, authenticated, service_role;
revoke all on function public.apply_stealth(uuid,jsonb,text,jsonb) from public, anon, authenticated, service_role;
revoke all on function public.cache_route(text,integer,integer,jsonb,text) from public, anon, authenticated, service_role;
revoke all on function public.check_departure(uuid,text,text) from public, anon, authenticated, service_role;
revoke all on function public.create_shared_trip(jsonb,text) from public, anon, authenticated, service_role;
revoke all on function public.create_ticket(text,text,text,text,text,uuid) from public, anon, authenticated, service_role;
revoke all on function public.crowd_status(uuid) from public, anon, authenticated, service_role;
revoke all on function public.departure_visitors(uuid) from public, anon, authenticated, service_role;
revoke all on function public.enqueue_scrape(boolean) from public, anon, authenticated, service_role;
revoke all on function public.export_snapshot() from public, anon, authenticated, service_role;
revoke all on function public.get_ticket(text) from public, anon, authenticated, service_role;
revoke all on function public.has_admin_role() from public, anon, authenticated, service_role;
revoke all on function public.ingest_osm(jsonb) from public, anon, authenticated, service_role;
revoke all on function public.ingest_osm_points(jsonb) from public, anon, authenticated, service_role;
revoke all on function public.is_admin() from public, anon, authenticated, service_role;
revoke all on function public.is_trip_member(uuid) from public, anon, authenticated, service_role;
revoke all on function public.join_shared_trip(text) from public, anon, authenticated, service_role;
revoke all on function public.leave_shared_trip(uuid) from public, anon, authenticated, service_role;
revoke all on function public.log_consent(text,boolean,boolean,text) from public, anon, authenticated, service_role;
revoke all on function public.log_dependency(text,jsonb) from public, anon, authenticated, service_role;
revoke all on function public.log_owner_reply(text,jsonb) from public, anon, authenticated, service_role;
revoke all on function public.marketing_facts() from public, anon, authenticated, service_role;
revoke all on function public.marketing_seo_rows(integer,text,integer) from public, anon, authenticated, service_role;
revoke all on function public.marketing_traffic(integer) from public, anon, authenticated, service_role;
revoke all on function public.marketing_upload_allowed(text) from public, anon, authenticated, service_role;
revoke all on function public.nearest_town(double precision,double precision) from public, anon, authenticated, service_role;
revoke all on function public.next_discover_batch(integer) from public, anon, authenticated, service_role;
revoke all on function public.next_pdok_batch(integer) from public, anon, authenticated, service_role;
revoke all on function public.next_scrape_batch(integer) from public, anon, authenticated, service_role;
revoke all on function public.next_stealth_batch(integer) from public, anon, authenticated, service_role;
revoke all on function public.next_stealth_batch(integer,integer,integer) from public, anon, authenticated, service_role;
revoke all on function public.osm_response(bigint) from public, anon, authenticated, service_role;
revoke all on function public.place_completeness(public.places) from public, anon, authenticated, service_role;
revoke all on function public.place_meets_must_haves(public.places) from public, anon, authenticated, service_role;
revoke all on function public.place_redirect(text) from public, anon, authenticated, service_role;
revoke all on function public.places_in_bbox(double precision,double precision,double precision,double precision) from public, anon, authenticated, service_role;
revoke all on function public.process_osm_staging(integer) from public, anon, authenticated, service_role;
revoke all on function public.promote_geo_master(boolean,integer) from public, anon, authenticated, service_role;
revoke all on function public.push_disable_subscriptions(uuid[]) from public, anon, authenticated, service_role;
revoke all on function public.push_public_key() from public, anon, authenticated, service_role;
revoke all on function public.push_set_vapid_keys(text,text) from public, anon, authenticated, service_role;
revoke all on function public.push_subscribe(text,text,text) from public, anon, authenticated, service_role;
revoke all on function public.push_take_targets(uuid) from public, anon, authenticated, service_role;
revoke all on function public.push_vapid_keys() from public, anon, authenticated, service_role;
revoke all on function public.reply_ticket(text,text) from public, anon, authenticated, service_role;
revoke all on function public.report_client_error(text,jsonb) from public, anon, authenticated, service_role;
revoke all on function public.report_crowd(uuid,text) from public, anon, authenticated, service_role;
revoke all on function public.slugify(text) from public, anon, authenticated, service_role;
revoke all on function public.submit_place(text,uuid,jsonb,text,text) from public, anon, authenticated, service_role;
revoke all on function public.submit_review(uuid,text,integer,integer,integer,integer,integer,text,text,text,date) from public, anon, authenticated, service_role;
revoke all on function public.submit_review(uuid,text,text,integer,integer,integer,integer,integer,text,text,text,date) from public, anon, authenticated, service_role;
revoke all on function public.track(text,text,jsonb,text) from public, anon, authenticated, service_role;
revoke all on function public.user_trust(uuid) from public, anon, authenticated, service_role;
revoke all on function public.user_trust_many(uuid[]) from public, anon, authenticated, service_role;
revoke all on function public.watch_place(uuid,boolean) from public, anon, authenticated, service_role;
grant execute on function private.audit() to public;
grant execute on function private.auto_approve_photo() to public;
grant execute on function private.create_profile() to public;
grant execute on function private.crowd_notify() to public;
grant execute on function private.decode_entities(text) to public;
grant execute on function private.log(text,text,text,jsonb) to public;
grant execute on function private.on_auth_user_created() to public;
grant execute on function private.overpass_get(text,text,integer) to public;
grant execute on function private.photo_rate_limit() to public;
grant execute on function private.places_before_write() to public;
grant execute on function private.publish_threshold() to public;
grant execute on function private.queue_fields() to public;
grant execute on function private.refresh_place_rating() to public;
grant execute on function private.safe_path(text) to public;
grant execute on function private.shared_trip_touch() to public;
grant execute on function private.sync_place_photo() to public;
grant execute on function private.time_minutes(text) to public;
grant execute on function private.touch_ticket() to public;
grant execute on function private.touch_updated_at() to public;
grant execute on function private.user_trust(uuid) to public;
grant execute on function public.admin_apply_update(uuid) to authenticated;
grant execute on function public.admin_apply_update(uuid) to service_role;
grant execute on function public.admin_concept_redenen() to authenticated;
grant execute on function public.admin_concept_redenen() to service_role;
grant execute on function public.admin_duplicate_candidates(integer,integer) to authenticated;
grant execute on function public.admin_duplicate_candidates(integer,integer) to service_role;
grant execute on function public.admin_manual_review() to authenticated;
grant execute on function public.admin_manual_review() to service_role;
grant execute on function public.admin_mark_beheer(uuid,text[]) to authenticated;
grant execute on function public.admin_mark_beheer(uuid,text[]) to service_role;
grant execute on function public.admin_merge_places(uuid,uuid) to authenticated;
grant execute on function public.admin_merge_places(uuid,uuid) to service_role;
grant execute on function public.admin_overview() to authenticated;
grant execute on function public.admin_overview() to service_role;
grant execute on function public.admin_pipeline(text) to authenticated;
grant execute on function public.admin_pipeline(text) to service_role;
grant execute on function public.admin_reject_update(uuid,text) to authenticated;
grant execute on function public.admin_reject_update(uuid,text) to service_role;
grant execute on function public.admin_stats(integer) to authenticated;
grant execute on function public.admin_stats(integer) to service_role;
grant execute on function public.apply_discovery(uuid,text) to service_role;
grant execute on function public.apply_pdok(uuid,text,text,integer) to service_role;
grant execute on function public.apply_scrape(uuid,jsonb,text) to service_role;
grant execute on function public.apply_stealth(uuid,jsonb,text,jsonb) to service_role;
grant execute on function public.cache_route(text,integer,integer,jsonb,text) to service_role;
grant execute on function public.check_departure(uuid,text,text) to authenticated;
grant execute on function public.check_departure(uuid,text,text) to service_role;
grant execute on function public.create_shared_trip(jsonb,text) to authenticated;
grant execute on function public.create_shared_trip(jsonb,text) to service_role;
grant execute on function public.create_ticket(text,text,text,text,text,uuid) to anon;
grant execute on function public.create_ticket(text,text,text,text,text,uuid) to authenticated;
grant execute on function public.create_ticket(text,text,text,text,text,uuid) to service_role;
grant execute on function public.crowd_status(uuid) to anon;
grant execute on function public.crowd_status(uuid) to authenticated;
grant execute on function public.crowd_status(uuid) to public;
grant execute on function public.crowd_status(uuid) to service_role;
grant execute on function public.departure_visitors(uuid) to anon;
grant execute on function public.departure_visitors(uuid) to authenticated;
grant execute on function public.departure_visitors(uuid) to service_role;
grant execute on function public.enqueue_scrape(boolean) to service_role;
grant execute on function public.export_snapshot() to service_role;
grant execute on function public.get_ticket(text) to anon;
grant execute on function public.get_ticket(text) to authenticated;
grant execute on function public.get_ticket(text) to service_role;
grant execute on function public.has_admin_role() to authenticated;
grant execute on function public.has_admin_role() to service_role;
grant execute on function public.ingest_osm(jsonb) to service_role;
grant execute on function public.ingest_osm_points(jsonb) to service_role;
grant execute on function public.is_admin() to anon;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.is_admin() to public;
grant execute on function public.is_admin() to service_role;
grant execute on function public.is_trip_member(uuid) to authenticated;
grant execute on function public.is_trip_member(uuid) to service_role;
grant execute on function public.join_shared_trip(text) to authenticated;
grant execute on function public.join_shared_trip(text) to service_role;
grant execute on function public.leave_shared_trip(uuid) to authenticated;
grant execute on function public.leave_shared_trip(uuid) to service_role;
grant execute on function public.log_consent(text,boolean,boolean,text) to anon;
grant execute on function public.log_consent(text,boolean,boolean,text) to authenticated;
grant execute on function public.log_consent(text,boolean,boolean,text) to service_role;
grant execute on function public.log_dependency(text,jsonb) to anon;
grant execute on function public.log_dependency(text,jsonb) to authenticated;
grant execute on function public.log_dependency(text,jsonb) to service_role;
grant execute on function public.log_owner_reply(text,jsonb) to anon;
grant execute on function public.log_owner_reply(text,jsonb) to authenticated;
grant execute on function public.log_owner_reply(text,jsonb) to service_role;
grant execute on function public.marketing_facts() to authenticated;
grant execute on function public.marketing_facts() to service_role;
grant execute on function public.marketing_seo_rows(integer,text,integer) to authenticated;
grant execute on function public.marketing_seo_rows(integer,text,integer) to service_role;
grant execute on function public.marketing_traffic(integer) to authenticated;
grant execute on function public.marketing_traffic(integer) to service_role;
grant execute on function public.marketing_upload_allowed(text) to anon;
grant execute on function public.marketing_upload_allowed(text) to authenticated;
grant execute on function public.marketing_upload_allowed(text) to service_role;
grant execute on function public.nearest_town(double precision,double precision) to anon;
grant execute on function public.nearest_town(double precision,double precision) to authenticated;
grant execute on function public.nearest_town(double precision,double precision) to public;
grant execute on function public.nearest_town(double precision,double precision) to service_role;
grant execute on function public.next_discover_batch(integer) to service_role;
grant execute on function public.next_pdok_batch(integer) to service_role;
grant execute on function public.next_scrape_batch(integer) to service_role;
grant execute on function public.next_stealth_batch(integer) to service_role;
grant execute on function public.next_stealth_batch(integer,integer,integer) to service_role;
grant execute on function public.osm_response(bigint) to service_role;
grant execute on function public.place_completeness(public.places) to anon;
grant execute on function public.place_completeness(public.places) to authenticated;
grant execute on function public.place_completeness(public.places) to public;
grant execute on function public.place_completeness(public.places) to service_role;
grant execute on function public.place_meets_must_haves(public.places) to anon;
grant execute on function public.place_meets_must_haves(public.places) to authenticated;
grant execute on function public.place_meets_must_haves(public.places) to public;
grant execute on function public.place_meets_must_haves(public.places) to service_role;
grant execute on function public.place_redirect(text) to anon;
grant execute on function public.place_redirect(text) to authenticated;
grant execute on function public.place_redirect(text) to public;
grant execute on function public.place_redirect(text) to service_role;
grant execute on function public.places_in_bbox(double precision,double precision,double precision,double precision) to anon;
grant execute on function public.places_in_bbox(double precision,double precision,double precision,double precision) to authenticated;
grant execute on function public.places_in_bbox(double precision,double precision,double precision,double precision) to service_role;
grant execute on function public.process_osm_staging(integer) to service_role;
grant execute on function public.promote_geo_master(boolean,integer) to service_role;
grant execute on function public.push_disable_subscriptions(uuid[]) to service_role;
grant execute on function public.push_public_key() to anon;
grant execute on function public.push_public_key() to authenticated;
grant execute on function public.push_public_key() to public;
grant execute on function public.push_public_key() to service_role;
grant execute on function public.push_set_vapid_keys(text,text) to service_role;
grant execute on function public.push_subscribe(text,text,text) to authenticated;
grant execute on function public.push_subscribe(text,text,text) to service_role;
grant execute on function public.push_take_targets(uuid) to service_role;
grant execute on function public.push_vapid_keys() to service_role;
grant execute on function public.reply_ticket(text,text) to anon;
grant execute on function public.reply_ticket(text,text) to authenticated;
grant execute on function public.reply_ticket(text,text) to service_role;
grant execute on function public.report_client_error(text,jsonb) to anon;
grant execute on function public.report_client_error(text,jsonb) to authenticated;
grant execute on function public.report_client_error(text,jsonb) to service_role;
grant execute on function public.report_crowd(uuid,text) to authenticated;
grant execute on function public.report_crowd(uuid,text) to service_role;
grant execute on function public.slugify(text) to anon;
grant execute on function public.slugify(text) to authenticated;
grant execute on function public.slugify(text) to public;
grant execute on function public.slugify(text) to service_role;
grant execute on function public.submit_place(text,uuid,jsonb,text,text) to anon;
grant execute on function public.submit_place(text,uuid,jsonb,text,text) to authenticated;
grant execute on function public.submit_place(text,uuid,jsonb,text,text) to service_role;
grant execute on function public.submit_review(uuid,text,integer,integer,integer,integer,integer,text,text,text,date) to authenticated;
grant execute on function public.submit_review(uuid,text,integer,integer,integer,integer,integer,text,text,text,date) to service_role;
grant execute on function public.submit_review(uuid,text,text,integer,integer,integer,integer,integer,text,text,text,date) to service_role;
grant execute on function public.track(text,text,jsonb,text) to anon;
grant execute on function public.track(text,text,jsonb,text) to authenticated;
grant execute on function public.track(text,text,jsonb,text) to service_role;
grant execute on function public.user_trust(uuid) to authenticated;
grant execute on function public.user_trust(uuid) to service_role;
grant execute on function public.user_trust_many(uuid[]) to authenticated;
grant execute on function public.user_trust_many(uuid[]) to service_role;
grant execute on function public.watch_place(uuid,boolean) to authenticated;
grant execute on function public.watch_place(uuid,boolean) to service_role;

-- Standaardrechten
alter default privileges for role postgres in schema public revoke all on sequences from anon, authenticated, service_role;
alter default privileges for role postgres in schema public revoke all on functions from anon, authenticated, service_role;
alter default privileges for role postgres in schema public revoke all on tables from anon, authenticated, service_role;
alter default privileges for role postgres in schema public grant select, update, usage on sequences to anon;
alter default privileges for role postgres in schema public grant select, update, usage on sequences to authenticated;
alter default privileges for role postgres in schema public grant select, update, usage on sequences to service_role;
alter default privileges for role postgres in schema public grant execute on functions to anon;
alter default privileges for role postgres in schema public grant execute on functions to authenticated;
alter default privileges for role postgres in schema public grant execute on functions to service_role;
alter default privileges for role postgres in schema public grant maintain, references, select, trigger on tables to anon;
alter default privileges for role postgres in schema public grant delete, insert, maintain, references, select, trigger, update on tables to authenticated;
alter default privileges for role postgres in schema public grant delete, insert, maintain, references, select, trigger, truncate, update on tables to service_role;

-- Realtime
do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.shared_trips;
  end if;
end $$;

-- Opslagbuckets
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values ('marketing', 'marketing', 'f', 104857600, '{video/mp4,image/png,image/jpeg,image/webp}'::text[]) on conflict (id) do nothing;
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values ('place-photos', 'place-photos', 't', 3145728, '{image/webp,image/jpeg}'::text[]) on conflict (id) do nothing;
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values ('vehicle-docs', 'vehicle-docs', 'f', 5242880, '{application/pdf,image/jpeg,image/png,image/webp}'::text[]) on conflict (id) do nothing;

reset check_function_bodies;
reset client_min_messages;
