-- VrijStaan: volledige databasestructuur (tabellen, indexen, functies, triggers, RLS-policies, cron-jobs)
-- Gegenereerd uit de live Supabase-database. Voer uit op een leeg project (extensies: pg_cron, pg_net, unaccent).
-- Geheimen staan NIET in dit bestand: zet na het uitvoeren zelf een sleutel in public.internal_secrets
-- (name = 'pipeline_key') en dezelfde waarde als header x-pipeline-key bij de edge function.

create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;
create extension if not exists unaccent with schema extensions;
create schema if not exists private;

create table if not exists private.admin_invites (
  email text not null,
  role text default 'admin'::text not null,
  constraint admin_invites_pkey PRIMARY KEY (email)
);

create table if not exists private.scrape_queue (
  place_id uuid not null,
  attempts integer default 0 not null,
  last_error text,
  next_attempt_at timestamp with time zone default now() not null,
  done_at timestamp with time zone,
  constraint scrape_queue_pkey PRIMARY KEY (place_id),
  constraint scrape_queue_place_id_fkey FOREIGN KEY (place_id) REFERENCES places(id) ON DELETE CASCADE
);

create table if not exists private.secrets (
  name text not null,
  value text not null,
  constraint secrets_pkey PRIMARY KEY (name)
);

create table if not exists public.admins (
  user_id uuid not null,
  email text not null,
  role text default 'admin'::text not null,
  created_at timestamp with time zone default now() not null,
  constraint admins_pkey PRIMARY KEY (user_id),
  constraint admins_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  constraint admins_role_check CHECK ((role = ANY (ARRAY['admin'::text, 'support'::text])))
);
alter table public.admins enable row level security;

create table if not exists public.app_logs (
  id bigint not null,
  ts timestamp with time zone default now() not null,
  level text not null,
  source text not null,
  message text not null,
  context jsonb default '{}'::jsonb not null,
  constraint app_logs_pkey PRIMARY KEY (id),
  constraint app_logs_level_check CHECK ((level = ANY (ARRAY['debug'::text, 'info'::text, 'warn'::text, 'error'::text])))
);
alter table public.app_logs enable row level security;

create table if not exists public.audit_log (
  id bigint not null,
  ts timestamp with time zone default now() not null,
  actor uuid,
  actor_email text,
  action text not null,
  entity text not null,
  entity_id text,
  details jsonb default '{}'::jsonb not null,
  constraint audit_log_pkey PRIMARY KEY (id)
);
alter table public.audit_log enable row level security;

create table if not exists public.consent_log (
  id bigint not null,
  ts timestamp with time zone default now() not null,
  consent_id text not null,
  analytics boolean not null,
  marketing boolean not null,
  version text not null,
  constraint consent_log_pkey PRIMARY KEY (id)
);
alter table public.consent_log enable row level security;

create table if not exists public.events (
  id bigint not null,
  ts timestamp with time zone default now() not null,
  name text not null,
  path text,
  props jsonb default '{}'::jsonb not null,
  session_id text,
  constraint events_pkey PRIMARY KEY (id),
  constraint events_name_check CHECK ((name = ANY (ARRAY['page_view'::text, 'search'::text, 'place_view'::text, 'outbound'::text, 'route'::text, 'save'::text, 'review'::text, 'ticket'::text])))
);
alter table public.events enable row level security;

create table if not exists public.faq (
  id uuid default gen_random_uuid() not null,
  category text not null,
  question text not null,
  answer text not null,
  "position" integer default 0 not null,
  published boolean default true not null,
  updated_at timestamp with time zone default now() not null,
  constraint faq_pkey PRIMARY KEY (id)
);
alter table public.faq enable row level security;

create table if not exists public.ingest_runs (
  id bigint not null,
  kind text not null,
  started_at timestamp with time zone default now() not null,
  finished_at timestamp with time zone,
  status text default 'running'::text not null,
  stats jsonb default '{}'::jsonb not null,
  constraint ingest_runs_pkey PRIMARY KEY (id),
  constraint ingest_runs_status_check CHECK ((status = ANY (ARRAY['running'::text, 'ok'::text, 'error'::text])))
);
alter table public.ingest_runs enable row level security;

create table if not exists public.internal_secrets (
  name text not null,
  value text not null,
  constraint internal_secrets_pkey PRIMARY KEY (name)
);
alter table public.internal_secrets enable row level security;

create table if not exists public.nl_towns (
  id integer default nextval('nl_towns_id_seq'::regclass) not null,
  name text not null,
  province text not null,
  lat double precision not null,
  lng double precision not null,
  constraint nl_towns_pkey PRIMARY KEY (id)
);
alter table public.nl_towns enable row level security;

create table if not exists public.osm_queries (
  name text not null,
  template text not null,
  constraint osm_queries_pkey PRIMARY KEY (name)
);
alter table public.osm_queries enable row level security;

create table if not exists public.osm_regions (
  code text not null,
  name text not null,
  last_run_at timestamp with time zone,
  places_req bigint,
  points_req bigint,
  attempt integer default 0 not null,
  constraint osm_regions_pkey PRIMARY KEY (code)
);
alter table public.osm_regions enable row level security;

create table if not exists public.osm_staging (
  id bigint not null,
  kind text not null,
  "row" jsonb not null,
  created_at timestamp with time zone default now() not null,
  processed_at timestamp with time zone,
  constraint osm_staging_pkey PRIMARY KEY (id),
  constraint osm_staging_kind_check CHECK ((kind = ANY (ARRAY['place'::text, 'point'::text])))
);
alter table public.osm_staging enable row level security;

create table if not exists public.places (
  id uuid default gen_random_uuid() not null,
  slug text not null,
  osm_type text,
  osm_id bigint,
  name text not null,
  name_is_generic boolean default false not null,
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
  photos jsonb default '[]'::jsonb not null,
  rating_avg numeric(3,1),
  rating_count integer default 0 not null,
  completeness numeric(4,3) default 0 not null,
  status text default 'draft'::text not null,
  status_locked boolean default false not null,
  sources jsonb default '{}'::jsonb not null,
  last_scraped_at timestamp with time zone,
  verified_at timestamp with time zone,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  constraint places_osm_type_osm_id_key UNIQUE (osm_type, osm_id),
  constraint places_slug_key UNIQUE (slug),
  constraint places_pkey PRIMARY KEY (id),
  constraint places_capacity_check CHECK (((capacity > 0) AND (capacity < 2000))),
  constraint places_kind_check CHECK ((kind = ANY (ARRAY['camperplaats'::text, 'camping'::text, 'parkeerplaats'::text, 'boerderij'::text, 'jachthaven'::text]))),
  constraint places_price_eur_check CHECK ((price_eur >= (0)::numeric)),
  constraint places_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'published'::text, 'hidden'::text]))),
  constraint places_surface_check CHECK ((surface = ANY (ARRAY['verhard'::text, 'gras'::text, 'gemengd'::text, 'grind'::text])))
);
alter table public.places enable row level security;

create table if not exists public.reviews (
  id uuid default gen_random_uuid() not null,
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
  status text default 'pending'::text not null,
  admin_note text,
  created_at timestamp with time zone default now() not null,
  constraint reviews_pkey PRIMARY KEY (id),
  constraint reviews_place_id_fkey FOREIGN KEY (place_id) REFERENCES places(id) ON DELETE CASCADE,
  constraint reviews_author_email_check CHECK (((author_email IS NULL) OR (author_email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'::text))),
  constraint reviews_author_name_check CHECK (((char_length(author_name) >= 2) AND (char_length(author_name) <= 60))),
  constraint reviews_body_check CHECK (((char_length(body) >= 20) AND (char_length(body) <= 3000))),
  constraint reviews_rating_check CHECK (((rating >= 1) AND (rating <= 10))),
  constraint reviews_score_facilities_check CHECK (((score_facilities >= 1) AND (score_facilities <= 10))),
  constraint reviews_score_location_check CHECK (((score_location >= 1) AND (score_location <= 10))),
  constraint reviews_score_quiet_check CHECK (((score_quiet >= 1) AND (score_quiet <= 10))),
  constraint reviews_score_value_check CHECK (((score_value >= 1) AND (score_value <= 10))),
  constraint reviews_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text]))),
  constraint reviews_title_check CHECK ((char_length(title) <= 120)),
  constraint reviews_vehicle_check CHECK ((vehicle = ANY (ARRAY['camper'::text, 'buscamper'::text, 'caravan'::text, 'overig'::text])))
);
alter table public.reviews enable row level security;

create table if not exists public.route_cache (
  key text not null,
  distance_m integer not null,
  duration_s integer not null,
  geometry jsonb,
  provider text not null,
  created_at timestamp with time zone default now() not null,
  constraint route_cache_pkey PRIMARY KEY (key)
);
alter table public.route_cache enable row level security;

create table if not exists public.site_settings (
  key text not null,
  value jsonb not null,
  constraint site_settings_pkey PRIMARY KEY (key)
);
alter table public.site_settings enable row level security;

create table if not exists public.submissions (
  id uuid default gen_random_uuid() not null,
  kind text not null,
  place_id uuid,
  payload jsonb not null,
  contact_name text,
  contact_email text,
  status text default 'nieuw'::text not null,
  admin_note text,
  created_at timestamp with time zone default now() not null,
  constraint submissions_pkey PRIMARY KEY (id),
  constraint submissions_place_id_fkey FOREIGN KEY (place_id) REFERENCES places(id) ON DELETE SET NULL,
  constraint submissions_kind_check CHECK ((kind = ANY (ARRAY['nieuw'::text, 'correctie'::text, 'eigenaar'::text]))),
  constraint submissions_status_check CHECK ((status = ANY (ARRAY['nieuw'::text, 'verwerkt'::text, 'afgewezen'::text])))
);
alter table public.submissions enable row level security;

create table if not exists public.ticket_messages (
  id uuid default gen_random_uuid() not null,
  ticket_id uuid not null,
  author text not null,
  admin_id uuid,
  body text not null,
  internal boolean default false not null,
  created_at timestamp with time zone default now() not null,
  constraint ticket_messages_pkey PRIMARY KEY (id),
  constraint ticket_messages_admin_id_fkey FOREIGN KEY (admin_id) REFERENCES admins(user_id) ON DELETE SET NULL,
  constraint ticket_messages_ticket_id_fkey FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE,
  constraint ticket_messages_author_check CHECK ((author = ANY (ARRAY['klant'::text, 'support'::text]))),
  constraint ticket_messages_body_check CHECK (((char_length(body) >= 1) AND (char_length(body) <= 5000)))
);
alter table public.ticket_messages enable row level security;

create table if not exists public.tickets (
  id uuid default gen_random_uuid() not null,
  number bigint not null,
  access_token text default encode(gen_random_bytes(18), 'hex'::text) not null,
  name text not null,
  email text not null,
  subject text not null,
  category text default 'vraag'::text not null,
  status text default 'open'::text not null,
  priority text default 'normaal'::text not null,
  place_id uuid,
  assignee uuid,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  constraint tickets_access_token_key UNIQUE (access_token),
  constraint tickets_number_key UNIQUE (number),
  constraint tickets_pkey PRIMARY KEY (id),
  constraint tickets_assignee_fkey FOREIGN KEY (assignee) REFERENCES admins(user_id) ON DELETE SET NULL,
  constraint tickets_place_id_fkey FOREIGN KEY (place_id) REFERENCES places(id) ON DELETE SET NULL,
  constraint tickets_category_check CHECK ((category = ANY (ARRAY['vraag'::text, 'fout-in-gegevens'::text, 'technisch'::text, 'privacy'::text, 'eigenaar'::text, 'samenwerking'::text, 'overig'::text]))),
  constraint tickets_email_check CHECK ((email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'::text)),
  constraint tickets_name_check CHECK (((char_length(name) >= 2) AND (char_length(name) <= 80))),
  constraint tickets_priority_check CHECK ((priority = ANY (ARRAY['laag'::text, 'normaal'::text, 'hoog'::text]))),
  constraint tickets_status_check CHECK ((status = ANY (ARRAY['open'::text, 'in-behandeling'::text, 'wacht-op-klant'::text, 'opgelost'::text, 'gesloten'::text]))),
  constraint tickets_subject_check CHECK (((char_length(subject) >= 3) AND (char_length(subject) <= 140)))
);
alter table public.tickets enable row level security;

CREATE INDEX places_status_idx ON public.places USING btree (status);

CREATE INDEX places_province_idx ON public.places USING btree (province);

CREATE INDEX places_name_trgm_idx ON public.places USING gin (name gin_trgm_ops);

CREATE INDEX reviews_place_idx ON public.reviews USING btree (place_id, status);

CREATE INDEX ticket_messages_ticket_idx ON public.ticket_messages USING btree (ticket_id, created_at);

CREATE INDEX events_ts_idx ON public.events USING btree (ts DESC);

CREATE INDEX app_logs_ts_idx ON public.app_logs USING btree (ts DESC);

CREATE INDEX osm_staging_todo_idx ON public.osm_staging USING btree (kind, id) WHERE (processed_at IS NULL);

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

CREATE OR REPLACE FUNCTION public.nearest_town(p_lat double precision, p_lng double precision)
 RETURNS nl_towns
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
  select t.* from public.nl_towns t
   order by (t.lat - p_lat)^2 + ((t.lng - p_lng) * cos(radians(p_lat)))^2
   limit 1;
$function$
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

CREATE OR REPLACE FUNCTION public.place_completeness(p places)
 RETURNS numeric
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO ''
AS $function$
  select round((
      (not p.name_is_generic)::int + (p.kind is not null)::int + (p.town is not null)::int
    + (p.price_eur is not null)::int + (p.power is not null)::int + (p.water is not null)::int
    + (p.dump_station is not null)::int + (p.toilet is not null)::int + (p.shower is not null)::int
    + (p.dogs is not null)::int + (p.capacity is not null)::int
    + (p.open_all_year is not null or p.season is not null)::int
    + (p.website is not null or p.phone is not null)::int
    + (p.image_url is not null)::int + (p.description is not null)::int
  )::numeric / 15, 3);
$function$
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

CREATE OR REPLACE FUNCTION private.on_auth_user_created()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare invite private.admin_invites;
begin
  select * into invite from private.admin_invites where lower(email) = lower(new.email);
  if found then
    insert into public.admins (user_id, email, role) values (new.id, new.email, invite.role)
    on conflict (user_id) do nothing;
  end if;
  return new;
end;
$function$
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

CREATE OR REPLACE FUNCTION public.osm_response(p_id bigint)
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select content::text from net._http_response where id = p_id and status_code = 200;
$function$
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

CREATE OR REPLACE FUNCTION private.log(p_level text, p_source text, p_message text, p_context jsonb DEFAULT '{}'::jsonb)
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
  insert into public.app_logs (level, source, message, context) values (p_level, p_source, left(p_message, 2000), coalesce(p_context, '{}'));
$function$
;

CREATE OR REPLACE FUNCTION public.log_consent(p_consent_id text, p_analytics boolean, p_marketing boolean, p_version text)
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
  insert into public.consent_log (consent_id, analytics, marketing, version)
  values (left(p_consent_id, 64), p_analytics, p_marketing, left(p_version, 20));
$function$
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
  if (select count(*) from public.reviews where created_at > now() - interval '1 minute') > 30 then
    raise exception 'Het is even erg druk. Probeer het over een minuut opnieuw.';
  end if;
  insert into public.reviews (place_id, author_name, author_email, rating, score_location, score_quiet,
    score_facilities, score_value, title, body, vehicle, visited_month)
  values (p_place_id, trim(p_author_name), nullif(trim(p_author_email), ''), p_rating, p_score_location, p_score_quiet,
    p_score_facilities, p_score_value, nullif(trim(p_title), ''), trim(p_body), p_vehicle, p_visited_month)
  returning id into rid;
  insert into public.events (name, props) values ('review', jsonb_build_object('place_id', p_place_id));
  return rid;
end;
$function$
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
  insert into public.tickets (name, email, subject, category, place_id)
  values (trim(p_name), trim(p_email), trim(p_subject), coalesce(p_category, 'vraag'), p_place_id)
  returning * into t;
  insert into public.ticket_messages (ticket_id, author, body) values (t.id, 'klant', trim(p_body));
  insert into public.events (name, props) values ('ticket', jsonb_build_object('category', t.category));
  perform private.log('info', 'support', 'Nieuw ticket #' || t.number, jsonb_build_object('category', t.category));
  return query select t.number, t.access_token;
end;
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
  insert into public.submissions (kind, place_id, payload, contact_name, contact_email)
  values (p_kind, p_place_id, p_payload, nullif(trim(p_contact_name), ''), nullif(trim(p_contact_email), ''))
  returning id into sid;
  perform private.log('info', 'inzending', 'Nieuwe inzending: ' || p_kind, jsonb_build_object('id', sid));
  return sid;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.track(p_name text, p_path text, p_props jsonb, p_session text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if p_name not in ('page_view','search','place_view','outbound','route','save') then return; end if;
  if pg_column_size(p_props) > 2000 then return; end if;
  insert into public.events (name, path, props, session_id) values (p_name, left(p_path, 300), coalesce(p_props, '{}'), left(p_session, 64));
end;
$function$
;

CREATE OR REPLACE FUNCTION public.report_client_error(p_message text, p_context jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if (select count(*) from public.app_logs where source = 'client' and ts > now() - interval '1 minute') > 60 then return; end if;
  perform private.log('error', 'client', p_message, case when pg_column_size(p_context) > 4000 then '{}'::jsonb else p_context end);
end;
$function$
;

CREATE OR REPLACE FUNCTION public.ingest_osm_points(p_points jsonb)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare r jsonb; n int := 0; c int;
begin
  for r in select * from jsonb_array_elements(p_points) loop
    update public.places p set
      dump_station = case when r->>'type' = 'dump' then coalesce(p.dump_station, true) else p.dump_station end,
      water = case when r->>'type' in ('dump','water') then coalesce(p.water, case when r->>'type' = 'water' or (r->>'water')::boolean then true end) else p.water end
    where abs(p.lat - (r->>'lat')::float8) < 0.002 and abs(p.lng - (r->>'lng')::float8) < 0.003
      and (p.lat - (r->>'lat')::float8)^2 + ((p.lng - (r->>'lng')::float8) * 0.62)^2 < (150.0 / 111000)^2;
    get diagnostics c = row_count; n := n + c;
  end loop;
  return n;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.next_scrape_batch(p_limit integer)
 RETURNS TABLE(id uuid, website text, name text, town text)
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
  select p.id, p.website, p.name, p.town from public.places p join upd on upd.place_id = p.id;
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
        capacity, max_length_m, surface, open_all_year, season, reservation, website, phone, email, image_url, image_credit, sources)
      values (v_slug, r->>'osm_type', (r->>'osm_id')::bigint, v_name, generic, r->>'kind',
        (r->>'lat')::float8, (r->>'lng')::float8, r->>'street', r->>'postcode',
        v_town, coalesce(nullif(r->>'province', ''), town.province),
        r->>'description', case when r ? 'description' then 'openstreetmap' end,
        (r->>'price_eur')::numeric,
        (r->>'power')::boolean, (r->>'water')::boolean, (r->>'dump_station')::boolean, (r->>'toilet')::boolean,
        (r->>'shower')::boolean, (r->>'wifi')::boolean, (r->>'dogs')::boolean,
        (r->>'capacity')::int, (r->>'max_length_m')::numeric, r->>'surface',
        (r->>'open_all_year')::boolean, r->>'season', (r->>'reservation')::boolean,
        r->>'website', r->>'phone', r->>'email', r->>'image_url', r->>'image_credit',
        jsonb_build_object('osm', now()));
      ins := ins + 1;
    else
      -- Volgorde van gezag: beheer > eigen website (prijs/seizoen) > OpenStreetMap
      update public.places p set
        name = case when p.name_is_generic and not generic then v_name else p.name end,
        name_is_generic = p.name_is_generic and generic,
        kind = case when p.sources->'beheer' ? 'kind' then p.kind else coalesce(r->>'kind', p.kind) end,
        province = coalesce(nullif(r->>'province', ''), p.province),
        street = coalesce(r->>'street', p.street), postcode = coalesce(r->>'postcode', p.postcode),
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
        phone = coalesce(r->>'phone', p.phone), email = coalesce(r->>'email', p.email),
        image_url = coalesce(p.image_url, r->>'image_url'),
        image_credit = case when p.image_url is null then r->>'image_credit' else p.image_credit end,
        sources = p.sources || jsonb_build_object('osm', now())
      where p.id = existing;
      upd := upd + 1;
    end if;
  end loop;
  return jsonb_build_object('inserted', ins, 'updated', upd);
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
      'completeness', completeness, 'verifiedAt', verified_at, 'updatedAt', updated_at)) order by slug)
      from public.places where status = 'published'), '[]'::jsonb),
    'towns', (select jsonb_agg(jsonb_build_object('name', name, 'province', province, 'lat', lat, 'lng', lng) order by name) from public.nl_towns),
    'faq', (select jsonb_agg(jsonb_build_object('id', id, 'category', category, 'question', question, 'answer', answer, 'position', position) order by category, position) from public.faq where published),
    'reviews', coalesce((select jsonb_agg(jsonb_strip_nulls(jsonb_build_object('id', id, 'placeId', place_id, 'authorName', author_name, 'rating', rating,
      'scoreLocation', score_location, 'scoreQuiet', score_quiet, 'scoreFacilities', score_facilities, 'scoreValue', score_value,
      'title', title, 'body', body, 'vehicle', vehicle, 'visitedMonth', visited_month, 'createdAt', created_at))) from public.reviews where status = 'approved'), '[]'::jsonb)
  );
$function$
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
  f text;
  old jsonb;
  -- Velden die de website mag invullen; prijs en seizoen van de eigen site gaan voor OSM
  fields text[] := array['price_eur','tourist_tax_included','power','water','dump_station','toilet','shower','wifi','dogs',
                         'capacity','max_length_m','open_all_year','season','reservation','phone','email','street','postcode',
                         'description','image_url'];
  priority text[] := array['price_eur','open_all_year','season'];
begin
  if p_error is not null then
    update private.scrape_queue set last_error = left(p_error, 500) where place_id = p_id;
    if (select attempts from private.scrape_queue where place_id = p_id) >= 3 then
      update private.scrape_queue set done_at = now() where place_id = p_id;
      update public.places set last_scraped_at = now() where id = p_id;
    end if;
    return;
  end if;

  select * into p from public.places where id = p_id for update;
  if not found then return; end if;
  prev := coalesce(p.sources->'website_fields', '[]'::jsonb);

  foreach f in array fields loop
    -- Handmatig in beheer ingevulde waarden blijven altijd staan
    continue when p.sources->'beheer' ? f;
    old := to_jsonb(p)->f;
    if p_data ? f then
      if f = any(priority) or old is null or old = 'null'::jsonb or prev ? f then
        patch := patch || jsonb_build_object(f, p_data->f);
        applied := applied || to_jsonb(f);
      end if;
    elsif prev ? f then
      -- De website noemt het niet meer: eerdere websitewaarde vervalt (nooit iets laten staan dat niet meer klopt)
      patch := patch || jsonb_build_object(f, null);
    end if;
  end loop;

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
    photos = case when p_data ? 'photos' then p_data->'photos' when prev ? 'image_url' and not (p_data ? 'image_url') then '[]'::jsonb else t.photos end,
    sources = t.sources || jsonb_build_object('website', now(), 'website_fields', applied),
    last_scraped_at = now(),
    verified_at = now()
  where t.id = p_id;
  update private.scrape_queue set done_at = now(), last_error = null where place_id = p_id;
end $function$
;

CREATE OR REPLACE FUNCTION private.collect_osm()
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare r public.osm_regions; a_status int; b_status int; a_err text; b_err text; a_found boolean; b_found boolean;
begin
  select * into r from public.osm_regions where places_req is not null limit 1;
  if not found then return null; end if;
  select true, status_code, coalesce(error_msg, left(content::text, 200)) into a_found, a_status, a_err from net._http_response where id = r.places_req;
  select true, status_code, coalesce(error_msg, left(content::text, 200)) into b_found, b_status, b_err from net._http_response where id = r.points_req;
  if a_found is null or b_found is null then
    if r.last_run_at < now() - interval '10 minutes' then
      update public.osm_regions set places_req = null, points_req = null, attempt = attempt + 1,
             last_run_at = now() - interval '7 days' + interval '10 minutes' where code = r.code;
    end if;
    return 'wacht';
  end if;
  if a_status = 200 and b_status = 200 then
    perform private.call_pipeline(jsonb_build_object('action', 'parse', 'region', r.code, 'places_req', r.places_req, 'points_req', r.points_req));
    update public.osm_regions set places_req = null, points_req = null, attempt = 0 where code = r.code;
  else
    insert into public.app_logs (level, source, message, context) values (case when r.attempt >= 3 then 'error' else 'warn' end, 'pipeline',
      'Overpass gaf geen data voor ' || r.name || ' (poging ' || (r.attempt + 1) || ', volgende poging via andere server)',
      jsonb_build_object('places', a_status, 'points', b_status));
    -- Na 10 minuten opnieuw, via de volgende server
    update public.osm_regions set places_req = null, points_req = null, attempt = attempt + 1,
           last_run_at = now() - interval '7 days' + interval '10 minutes' where code = r.code;
  end if;
  return r.code;
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
        'near', count(*) filter (where status = 'draft' and completeness >= 0.7),
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

CREATE OR REPLACE FUNCTION private.places_before_write()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare t numeric := coalesce((select (value #>> '{}')::numeric from public.site_settings where key = 'publish_threshold'), 0.8);
begin
  -- Foto-URL's met HTML-entiteiten (https&#x3A;&#x2F;…) leesbaar maken
  if new.image_url like '%&#%' or new.photos::text like '%&#%' then
    new.image_url := private.decode_entities(new.image_url);
    new.photos := (select coalesce(jsonb_agg(jsonb_set(ph, '{url}', to_jsonb(private.decode_entities(ph->>'url')))), '[]'::jsonb)
                     from jsonb_array_elements(new.photos) ph);
  end if;
  new.updated_at := now();
  new.completeness := public.place_completeness(new);
  if not new.status_locked then
    new.status := case when new.completeness >= t then 'published' else 'draft' end;
  end if;
  return new;
end $function$
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

CREATE TRIGGER places_before_write BEFORE INSERT OR UPDATE ON public.places FOR EACH ROW EXECUTE FUNCTION private.places_before_write();

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION private.on_auth_user_created();

CREATE TRIGGER reviews_refresh_rating AFTER INSERT OR DELETE OR UPDATE ON public.reviews FOR EACH ROW EXECUTE FUNCTION private.refresh_place_rating();

CREATE TRIGGER places_audit AFTER DELETE OR UPDATE ON public.places FOR EACH ROW EXECUTE FUNCTION private.audit();

CREATE TRIGGER reviews_audit AFTER DELETE OR UPDATE ON public.reviews FOR EACH ROW EXECUTE FUNCTION private.audit();

CREATE TRIGGER tickets_audit AFTER DELETE OR UPDATE ON public.tickets FOR EACH ROW EXECUTE FUNCTION private.audit();

CREATE TRIGGER faq_audit AFTER INSERT OR DELETE OR UPDATE ON public.faq FOR EACH ROW EXECUTE FUNCTION private.audit();

CREATE TRIGGER submissions_audit AFTER DELETE OR UPDATE ON public.submissions FOR EACH ROW EXECUTE FUNCTION private.audit();

CREATE TRIGGER ticket_messages_touch AFTER INSERT ON public.ticket_messages FOR EACH ROW EXECUTE FUNCTION private.touch_ticket();

create policy "plekken lezen" on public.places as PERMISSIVE for SELECT to anon, authenticated using (((status = 'published'::text) OR ( SELECT is_admin() AS is_admin)));

create policy "reviews lezen" on public.reviews as PERMISSIVE for SELECT to anon, authenticated using (((status = 'approved'::text) OR ( SELECT is_admin() AS is_admin)));

create policy "faq lezen" on public.faq as PERMISSIVE for SELECT to anon, authenticated using ((published OR ( SELECT is_admin() AS is_admin)));

create policy "instellingen lezen" on public.site_settings as PERMISSIVE for SELECT to anon, authenticated using (true);

create policy "routecache lezen" on public.route_cache as PERMISSIVE for SELECT to anon, authenticated using (true);

create policy "admins plekken insert" on public.places as PERMISSIVE for INSERT to authenticated with check (( SELECT is_admin() AS is_admin));

create policy "admins audit" on public.audit_log as PERMISSIVE for SELECT to authenticated using (( SELECT is_admin() AS is_admin));

create policy "admins plekken update" on public.places as PERMISSIVE for UPDATE to authenticated using (( SELECT is_admin() AS is_admin)) with check (( SELECT is_admin() AS is_admin));

create policy "admins plekken delete" on public.places as PERMISSIVE for DELETE to authenticated using (( SELECT is_admin() AS is_admin));

create policy "admins zien admins" on public.admins as PERMISSIVE for SELECT to authenticated using (( SELECT is_admin() AS is_admin));

create policy "admins reviews update" on public.reviews as PERMISSIVE for UPDATE to authenticated using (( SELECT is_admin() AS is_admin)) with check (( SELECT is_admin() AS is_admin));

create policy "admins reviews delete" on public.reviews as PERMISSIVE for DELETE to authenticated using (( SELECT is_admin() AS is_admin));

create policy "admins inzendingen" on public.submissions as PERMISSIVE for ALL to authenticated using (( SELECT is_admin() AS is_admin)) with check (( SELECT is_admin() AS is_admin));

create policy "admins tickets" on public.tickets as PERMISSIVE for ALL to authenticated using (( SELECT is_admin() AS is_admin)) with check (( SELECT is_admin() AS is_admin));

create policy "admins berichten" on public.ticket_messages as PERMISSIVE for ALL to authenticated using (( SELECT is_admin() AS is_admin)) with check (( SELECT is_admin() AS is_admin));

create policy "admins faq insert" on public.faq as PERMISSIVE for INSERT to authenticated with check (( SELECT is_admin() AS is_admin));

create policy "admins faq update" on public.faq as PERMISSIVE for UPDATE to authenticated using (( SELECT is_admin() AS is_admin)) with check (( SELECT is_admin() AS is_admin));

create policy "admins faq delete" on public.faq as PERMISSIVE for DELETE to authenticated using (( SELECT is_admin() AS is_admin));

create policy "admins events" on public.events as PERMISSIVE for SELECT to authenticated using (( SELECT is_admin() AS is_admin));

create policy "admins consent" on public.consent_log as PERMISSIVE for SELECT to authenticated using (( SELECT is_admin() AS is_admin));

create policy "admins logs" on public.app_logs as PERMISSIVE for SELECT to authenticated using (( SELECT is_admin() AS is_admin));

create policy "admins instellingen insert" on public.site_settings as PERMISSIVE for INSERT to authenticated with check (( SELECT is_admin() AS is_admin));

create policy "admins instellingen update" on public.site_settings as PERMISSIVE for UPDATE to authenticated using (( SELECT is_admin() AS is_admin)) with check (( SELECT is_admin() AS is_admin));

create policy "admins runs" on public.ingest_runs as PERMISSIVE for SELECT to authenticated using (( SELECT is_admin() AS is_admin));

create policy "woonplaatsen lezen" on public.nl_towns as PERMISSIVE for SELECT to anon, authenticated using (true);

select cron.schedule('osm-staging', '* * * * *', 'select public.process_osm_staging(300) where exists (select 1 from public.osm_staging where processed_at is null)');

select cron.schedule('osm-regions', '*/3 * * * *', 'select private.next_osm_region()');

select cron.schedule('scrape-enqueue', '*/30 * * * *', 'select public.enqueue_scrape(true)');

select cron.schedule('osm-collect', '* * * * *', 'select private.collect_osm()');

select cron.schedule('scrape', '15 seconds', 'select private.call_pipeline(''{"action":"scrape","n":8}''::jsonb) where exists (select 1 from private.scrape_queue where done_at is null and next_attempt_at <= now() and attempts < 3)');

-- ── Migratie 20261012_places_bbox (zie supabase/migrations/) ─────────────────────

create extension if not exists postgis with schema extensions;

alter table public.places
  add column if not exists geom extensions.geometry(Point, 4326)
  generated always as (extensions.st_setsrid(extensions.st_makepoint(lng, lat), 4326)) stored;

create index if not exists places_geom_gist on public.places using gist (geom) where status = 'published';

create or replace function public.places_in_bbox(min_lng double precision, min_lat double precision,
                                                 max_lng double precision, max_lat double precision)
returns setof public.places
language sql
stable
security invoker
set search_path = ''
as $$
  select p.*
  from public.places p
  where p.status = 'published'
    and p.geom operator(extensions.&&) extensions.st_makeenvelope(min_lng, min_lat, max_lng, max_lat, 4326)
  order by p.slug
  limit 5000;
$$;

revoke all on function public.places_in_bbox(double precision, double precision, double precision, double precision) from public;
grant execute on function public.places_in_bbox(double precision, double precision, double precision, double precision) to anon, authenticated;

-- ── Migratie 20261012_user_accounts (zie supabase/migrations/) ─────────────────────
-- Accounts voor bezoekers (Google, Apple, Facebook, magic link): profiel en "Mijn reis" in de cloud.
-- Additief. Elke gebruiker ziet en wijzigt alleen zijn eigen rijen (RLS).

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text check (char_length(display_name) <= 80),
  avatar_url text check (avatar_url ~ '^https://'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
create policy "eigen profiel lezen" on public.profiles for select to authenticated using ((select auth.uid()) = id);
create policy "eigen profiel wijzigen" on public.profiles for update to authenticated
  using ((select auth.uid()) = id) with check ((select auth.uid()) = id);
revoke all on public.profiles from anon;
grant select, update (display_name, avatar_url, updated_at) on public.profiles to authenticated;

create table if not exists public.user_trips (
  user_id uuid primary key references auth.users (id) on delete cascade,
  stops jsonb not null default '[]'::jsonb check (jsonb_typeof(stops) = 'array' and jsonb_array_length(stops) <= 200),
  updated_at timestamptz not null default now()
);
alter table public.user_trips enable row level security;
create policy "eigen reis" on public.user_trips for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
revoke all on public.user_trips from anon;
grant select, insert, update, delete on public.user_trips to authenticated;

-- Profiel aanmaken met naam en foto van de provider (Google/Apple/Facebook geven full_name/name en avatar_url/picture)
create or replace function private.create_profile()
returns trigger language plpgsql security definer set search_path = '' as $$
declare m jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb); avatar text;
begin
  avatar := coalesce(m->>'avatar_url', m->>'picture');
  insert into public.profiles (id, display_name, avatar_url)
  values (new.id,
          left(nullif(trim(coalesce(m->>'full_name', m->>'name', split_part(new.email, '@', 1))), ''), 80),
          case when avatar ~ '^https://' then avatar end)
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_profile on auth.users;
create trigger on_auth_user_profile after insert on auth.users for each row execute function private.create_profile();

-- Beheerrechten alleen voor een BEVESTIGD uitgenodigd e-mailadres. Voorheen gebeurde dit al bij het aanmaken van
-- het account; met publieke aanmelding (OAuth, magic link) moet het adres eerst bewezen zijn.
create or replace function private.on_auth_user_created()
returns trigger language plpgsql security definer set search_path = '' as $$
declare invite private.admin_invites;
begin
  if new.email_confirmed_at is null then return new; end if;
  select * into invite from private.admin_invites where lower(email) = lower(new.email);
  if found then
    insert into public.admins (user_id, email, role) values (new.id, new.email, invite.role)
    on conflict (user_id) do nothing;
  end if;
  return new;
end $$;

drop trigger if exists on_auth_user_confirmed on auth.users;
create trigger on_auth_user_confirmed after update of email_confirmed_at on auth.users
  for each row when (old.email_confirmed_at is null and new.email_confirmed_at is not null)
  execute function private.on_auth_user_created();

-- Bestaande accounts een profiel geven
insert into public.profiles (id, display_name)
select id, left(split_part(email, '@', 1), 80) from auth.users on conflict (id) do nothing;

-- Zelf je account verwijderen (AVG art. 17). Profiel en reis verdwijnen via ON DELETE CASCADE.
create or replace function public.delete_my_account()
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Niet ingelogd'; end if;
  delete from auth.users where id = auth.uid();
end $$;
revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

-- ── Migratie 20261012_place_photos (zie supabase/migrations/) ─────────────────────
-- Foto's van bezoekers: opslag in Supabase Storage, moderatie via public.place_photos.
-- Een foto komt pas in places.photos (en dus op de site) als hij is goedgekeurd.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('place-photos', 'place-photos', true, 3145728, array['image/webp', 'image/jpeg'])
on conflict (id) do nothing;

-- Uploaden alleen ingelogd, en alleen in je eigen map: place-photos/<user_id>/<bestand>
create policy "foto uploaden in eigen map" on storage.objects for insert to authenticated
  with check (bucket_id = 'place-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);

create table if not exists public.place_photos (
  id uuid primary key default gen_random_uuid(),
  place_id uuid not null references public.places (id) on delete cascade,
  user_id uuid references auth.users (id) on delete set null,
  storage_path text not null unique check (storage_path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.(webp|jpg)$'),
  width int check (width between 200 and 4000),
  height int check (height between 200 and 4000),
  caption text check (char_length(caption) <= 140),
  credit text check (char_length(credit) <= 80),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  reviewed_by uuid references auth.users (id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists place_photos_status_idx on public.place_photos (status, created_at);
create index if not exists place_photos_place_idx on public.place_photos (place_id);
create index if not exists place_photos_user_idx on public.place_photos (user_id);
alter table public.place_photos enable row level security;

-- De site toont goedgekeurde foto's via places.photos; deze tabel ziet alleen de inzender zelf en beheer
create policy "eigen foto's en beheer lezen" on public.place_photos for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));
create policy "foto insturen" on public.place_photos for insert to authenticated
  with check (user_id = (select auth.uid()) and status = 'pending' and reviewed_by is null
              and split_part(storage_path, '/', 1) = (select auth.uid())::text);
create policy "beheer foto's" on public.place_photos for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
revoke all on public.place_photos from anon;
grant select, insert, update on public.place_photos to authenticated;

-- Maximaal 20 foto's per gebruiker per dag (tegen misbruik)
create or replace function private.photo_rate_limit()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if (select count(*) from public.place_photos where user_id = new.user_id and created_at > now() - interval '1 day') >= 20 then
    raise exception 'Je hebt vandaag al veel foto''s gestuurd. Probeer het morgen weer.';
  end if;
  return new;
end $$;
create trigger place_photos_rate_limit before insert on public.place_photos
  for each row execute function private.photo_rate_limit();

-- Goedgekeurd → in places.photos; afgekeurd of teruggedraaid → eruit
create or replace function private.sync_place_photo()
returns trigger language plpgsql security definer set search_path = '' as $$
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
    new.reviewed_by := auth.uid();
  end if;
  return new;
end $$;
create trigger place_photos_sync before update of status on public.place_photos
  for each row execute function private.sync_place_photo();
