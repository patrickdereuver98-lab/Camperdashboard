-- Live migratie 20261010212837 (0001_core_schema), letterlijk uit supabase_migrations.schema_migrations.statements
-- (opgehaald 8 november 2026, review R5). Niet wijzigen: dit is de geschiedenis zoals live toegepast.

create extension if not exists pg_trgm with schema extensions;
create extension if not exists unaccent with schema extensions;
create schema if not exists private;

create table public.places (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  osm_type text,
  osm_id bigint,
  name text not null,
  name_is_generic boolean not null default false,
  kind text check (kind in ('camperplaats','camping','parkeerplaats','boerderij','jachthaven')),
  lat double precision not null,
  lng double precision not null,
  street text, postcode text, town text, province text,
  description text, description_source text,
  price_eur numeric(6,2) check (price_eur >= 0),
  price_note text,
  tourist_tax_included boolean,
  power boolean, power_note text,
  water boolean, dump_station boolean, toilet boolean, shower boolean, wifi boolean, dogs boolean,
  capacity integer check (capacity > 0 and capacity < 2000),
  max_length_m numeric(4,1),
  surface text check (surface in ('verhard','gras','gemengd','grind')),
  open_all_year boolean, season text, reservation boolean, max_stay_nights integer,
  website text, phone text, email text,
  image_url text, image_credit text,
  photos jsonb not null default '[]'::jsonb,
  rating_avg numeric(3,1), rating_count integer not null default 0,
  completeness numeric(4,3) not null default 0,
  status text not null default 'draft' check (status in ('draft','published','hidden')),
  status_locked boolean not null default false,
  sources jsonb not null default '{}'::jsonb,
  last_scraped_at timestamptz, verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (osm_type, osm_id)
);
create index places_status_idx on public.places (status);
create index places_province_idx on public.places (province);
create index places_name_trgm_idx on public.places using gin (name extensions.gin_trgm_ops);

create or replace function public.place_completeness(p public.places)
returns numeric language sql immutable set search_path = '' as $$
  select round((
      (not p.name_is_generic)::int + (p.kind is not null)::int + (p.town is not null)::int
    + (p.price_eur is not null)::int + (p.power is not null)::int + (p.water is not null)::int
    + (p.dump_station is not null)::int + (p.toilet is not null)::int + (p.shower is not null)::int
    + (p.dogs is not null)::int + (p.capacity is not null)::int
    + (p.open_all_year is not null or p.season is not null)::int
    + (p.website is not null or p.phone is not null)::int
    + (p.image_url is not null)::int + (p.description is not null)::int
  )::numeric / 15, 3);
$$;

create or replace function private.places_before_write()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  new.completeness := public.place_completeness(new);
  if not new.status_locked then
    new.status := case when new.completeness >= 0.8 then 'published' else 'draft' end;
  end if;
  return new;
end;
$$;
create trigger places_before_write before insert or update on public.places
  for each row execute function private.places_before_write();

create table public.admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  role text not null default 'admin' check (role in ('admin','support')),
  created_at timestamptz not null default now()
);
create table private.admin_invites (email text primary key, role text not null default 'admin');

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.admins where user_id = (select auth.uid()));
$$;

create or replace function private.on_auth_user_created()
returns trigger language plpgsql security definer set search_path = '' as $$
declare invite private.admin_invites;
begin
  select * into invite from private.admin_invites where lower(email) = lower(new.email);
  if found then
    insert into public.admins (user_id, email, role) values (new.id, new.email, invite.role)
    on conflict (user_id) do nothing;
  end if;
  return new;
end;
$$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function private.on_auth_user_created();

create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  place_id uuid not null references public.places (id) on delete cascade,
  author_name text not null check (char_length(author_name) between 2 and 60),
  author_email text check (author_email is null or author_email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  rating smallint not null check (rating between 1 and 10),
  score_location smallint check (score_location between 1 and 10),
  score_quiet smallint check (score_quiet between 1 and 10),
  score_facilities smallint check (score_facilities between 1 and 10),
  score_value smallint check (score_value between 1 and 10),
  title text check (char_length(title) <= 120),
  body text not null check (char_length(body) between 20 and 3000),
  vehicle text check (vehicle in ('camper','buscamper','caravan','overig')),
  visited_month date,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  admin_note text,
  created_at timestamptz not null default now()
);
create index reviews_place_idx on public.reviews (place_id, status);

create or replace function private.refresh_place_rating()
returns trigger language plpgsql security definer set search_path = '' as $$
declare pid uuid := coalesce(new.place_id, old.place_id);
begin
  update public.places p set rating_avg = s.avg, rating_count = s.cnt
    from (select round(avg(rating)::numeric,1) as avg, count(*)::int as cnt
            from public.reviews where place_id = pid and status = 'approved') s
   where p.id = pid;
  return null;
end;
$$;
create trigger reviews_refresh_rating after insert or update or delete on public.reviews
  for each row execute function private.refresh_place_rating();

create table public.submissions (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('nieuw','correctie','eigenaar')),
  place_id uuid references public.places (id) on delete set null,
  payload jsonb not null,
  contact_name text, contact_email text,
  status text not null default 'nieuw' check (status in ('nieuw','verwerkt','afgewezen')),
  admin_note text,
  created_at timestamptz not null default now()
);

create table public.tickets (
  id uuid primary key default gen_random_uuid(),
  number bigint generated always as identity (start with 1001) unique,
  access_token text not null unique default encode(extensions.gen_random_bytes(18), 'hex'),
  name text not null check (char_length(name) between 2 and 80),
  email text not null check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  subject text not null check (char_length(subject) between 3 and 140),
  category text not null default 'vraag' check (category in ('vraag','fout-in-gegevens','technisch','privacy','eigenaar','samenwerking','overig')),
  status text not null default 'open' check (status in ('open','in-behandeling','wacht-op-klant','opgelost','gesloten')),
  priority text not null default 'normaal' check (priority in ('laag','normaal','hoog')),
  place_id uuid references public.places (id) on delete set null,
  assignee uuid references public.admins (user_id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.ticket_messages (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.tickets (id) on delete cascade,
  author text not null check (author in ('klant','support')),
  admin_id uuid references public.admins (user_id) on delete set null,
  body text not null check (char_length(body) between 1 and 5000),
  internal boolean not null default false,
  created_at timestamptz not null default now()
);
create index ticket_messages_ticket_idx on public.ticket_messages (ticket_id, created_at);

create table public.faq (
  id uuid primary key default gen_random_uuid(),
  category text not null, question text not null, answer text not null,
  position integer not null default 0,
  published boolean not null default true,
  updated_at timestamptz not null default now()
);

create table public.events (
  id bigint generated always as identity primary key,
  ts timestamptz not null default now(),
  name text not null check (name in ('page_view','search','place_view','outbound','route','save','review','ticket')),
  path text, props jsonb not null default '{}'::jsonb, session_id text
);
create index events_ts_idx on public.events (ts desc);

create table public.consent_log (
  id bigint generated always as identity primary key,
  ts timestamptz not null default now(),
  consent_id text not null, analytics boolean not null, marketing boolean not null, version text not null
);

create table public.app_logs (
  id bigint generated always as identity primary key,
  ts timestamptz not null default now(),
  level text not null check (level in ('debug','info','warn','error')),
  source text not null, message text not null, context jsonb not null default '{}'::jsonb
);
create index app_logs_ts_idx on public.app_logs (ts desc);

create table public.audit_log (
  id bigint generated always as identity primary key,
  ts timestamptz not null default now(),
  actor uuid, actor_email text, action text not null, entity text not null, entity_id text,
  details jsonb not null default '{}'::jsonb
);

create table public.route_cache (
  key text primary key, distance_m integer not null, duration_s integer not null,
  geometry jsonb, provider text not null, created_at timestamptz not null default now()
);

create table public.site_settings (key text primary key, value jsonb not null);

create table private.scrape_queue (
  place_id uuid primary key references public.places (id) on delete cascade,
  attempts integer not null default 0, last_error text,
  next_attempt_at timestamptz not null default now(), done_at timestamptz
);

create table public.ingest_runs (
  id bigint generated always as identity primary key,
  kind text not null, started_at timestamptz not null default now(), finished_at timestamptz,
  status text not null default 'running' check (status in ('running','ok','error')),
  stats jsonb not null default '{}'::jsonb
);

create table private.secrets (name text primary key, value text not null);

alter table public.places enable row level security;
alter table public.admins enable row level security;
alter table public.reviews enable row level security;
alter table public.submissions enable row level security;
alter table public.tickets enable row level security;
alter table public.ticket_messages enable row level security;
alter table public.faq enable row level security;
alter table public.events enable row level security;
alter table public.consent_log enable row level security;
alter table public.app_logs enable row level security;
alter table public.audit_log enable row level security;
alter table public.route_cache enable row level security;
alter table public.site_settings enable row level security;
alter table public.ingest_runs enable row level security;

create policy "plekken lezen" on public.places for select to anon, authenticated
  using (status = 'published' or (select public.is_admin()));
create policy "reviews lezen" on public.reviews for select to anon, authenticated
  using (status = 'approved' or (select public.is_admin()));
create policy "faq lezen" on public.faq for select to anon, authenticated
  using (published or (select public.is_admin()));
create policy "instellingen lezen" on public.site_settings for select to anon, authenticated using (true);
create policy "routecache lezen" on public.route_cache for select to anon, authenticated using (true);

create policy "admins plekken insert" on public.places for insert to authenticated with check ((select public.is_admin()));
create policy "admins plekken update" on public.places for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "admins plekken delete" on public.places for delete to authenticated using ((select public.is_admin()));
create policy "admins zien admins" on public.admins for select to authenticated using ((select public.is_admin()));
create policy "admins reviews update" on public.reviews for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "admins reviews delete" on public.reviews for delete to authenticated using ((select public.is_admin()));
create policy "admins inzendingen" on public.submissions for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "admins tickets" on public.tickets for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "admins berichten" on public.ticket_messages for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "admins faq insert" on public.faq for insert to authenticated with check ((select public.is_admin()));
create policy "admins faq update" on public.faq for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "admins faq delete" on public.faq for delete to authenticated using ((select public.is_admin()));
create policy "admins events" on public.events for select to authenticated using ((select public.is_admin()));
create policy "admins consent" on public.consent_log for select to authenticated using ((select public.is_admin()));
create policy "admins logs" on public.app_logs for select to authenticated using ((select public.is_admin()));
create policy "admins audit" on public.audit_log for select to authenticated using ((select public.is_admin()));
create policy "admins instellingen insert" on public.site_settings for insert to authenticated with check ((select public.is_admin()));
create policy "admins instellingen update" on public.site_settings for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "admins runs" on public.ingest_runs for select to authenticated using ((select public.is_admin()));
