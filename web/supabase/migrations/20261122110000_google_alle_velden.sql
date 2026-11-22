-- Google: alle velden uit de Places API, kwaliteit van het cijfer en ontdekken van nieuwe plekken (README 141,
-- opdracht Patrick 22 november 2026). Alleen intern, behalve de afgeleide kolommen op place_google die de site nodig heeft.
alter table public.place_google
  add column if not exists primary_type     text check (primary_type ~ '^[a-z_]{2,60}$'),
  add column if not exists types            text[],
  add column if not exists reviews_sampled  smallint check (reviews_sampled >= 0),
  add column if not exists reviews_recent   smallint check (reviews_recent >= 0),
  add column if not exists newest_review_at timestamptz;

-- Alle overige velden van Google (adres, website, telefoon, openingstijden, voorzieningen, enz.), zonder reviews en
-- zonder namen. Alleen intern: private schema, RLS aan, geen rechten voor bezoekers of ingelogde gebruikers.
create table if not exists private.place_google_details (
  place_id   uuid primary key references public.places (id) on delete cascade,
  details    jsonb not null,
  fetched_at timestamptz not null default now()
);
alter table private.place_google_details enable row level security;
revoke all on private.place_google_details from anon, authenticated;

-- Plekken die Google kent en wij mogelijk niet (ontdekken): een lijst met aanwijzingen voor Beheer, geen plekken.
create table if not exists private.google_found (
  google_place_id  text primary key check (google_place_id ~ '^[A-Za-z0-9_-]{10,200}$'),
  name             text,
  lat              double precision,
  lng              double precision,
  primary_type     text,
  types            text[],
  business_status  text,
  rating           numeric(2,1),
  rating_count     integer,
  address          text,
  website          text,
  query            text,
  matched_place_id uuid references public.places (id) on delete set null,
  matched_m        integer,
  found_at         timestamptz not null default now()
);
alter table private.google_found enable row level security;
revoke all on private.google_found from anon, authenticated;
create index if not exists google_found_unmatched_idx on private.google_found (found_at) where matched_place_id is null;

comment on table private.place_google_details is 'Alle velden van Google per plek, alleen intern. Zie docs/bronnenbeleid.md §3c.';
comment on table private.google_found is 'Plekken die Google kent (zoek op camperplaats en camping), met match op onze plekken. Zie README 141.';
