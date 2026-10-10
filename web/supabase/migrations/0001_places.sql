-- VrijStaan: camperplaatsen. Velden spiegelen src/lib/types.ts (snake_case).
-- NULL betekent overal: onbekend.

create table if not exists public.places (
  slug        text primary key,
  name        text not null,
  unnamed     boolean not null default false,
  town        text not null,
  province    text not null,
  lat         double precision not null,
  lng         double precision not null,
  price       text check (price in ('gratis', 'betaald')),
  price_eur   numeric(6,2) check (price_eur > 0),
  price_text  text,
  power       boolean,
  dogs        boolean,
  water       boolean,
  spots       integer check (spots > 0),
  hours       text,
  website     text,
  phone       text,
  updated_at  timestamptz not null default now()
);

create index if not exists places_province_idx on public.places (province);

-- Iedereen mag lezen, alleen de service role (batch engine / beheer) mag schrijven.
alter table public.places enable row level security;

drop policy if exists "places zijn openbaar leesbaar" on public.places;
create policy "places zijn openbaar leesbaar"
  on public.places for select
  to anon, authenticated
  using (true);
