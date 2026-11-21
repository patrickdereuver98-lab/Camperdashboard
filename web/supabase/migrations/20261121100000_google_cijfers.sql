-- Google-cijfers (README 141, opdracht Patrick 21 november 2026): één ronde voor alle plekken, daarna per plek
-- vernieuwen als de check 30 dagen oud is (workflow google-cijfers, scripts/google-ratings.mjs).
-- Eigen tabel en niet kolommen op places: elke update van places zet updated_at op nu en draait het logboek, en dan
-- lijken alle plekken vandaag bijgewerkt. Alleen cijfer, aantal en place_id; geen reviewteksten of namen.
-- De place_id mag onbeperkt bewaard worden; cijfer en aantal tonen we alleen als checked_at jonger is dan 30 dagen.
create table if not exists public.place_google (
  place_id        uuid primary key references public.places (id) on delete cascade,
  google_place_id text check (google_place_id ~ '^[A-Za-z0-9_-]{10,300}$'),
  rating          numeric(2,1) check (rating between 1 and 5),
  rating_count    integer check (rating_count >= 0),
  business_status text check (business_status in ('OPERATIONAL', 'CLOSED_TEMPORARILY', 'CLOSED_PERMANENTLY')),
  checked_at      timestamptz not null default now()
);

alter table public.place_google enable row level security;

create policy "google cijfers lezen" on public.place_google for select to anon, authenticated using (true);

-- Schrijven doet alleen de job (databaserol postgres, buiten RLS om)
revoke all on public.place_google from anon, authenticated;
grant select on public.place_google to anon, authenticated;

create index if not exists place_google_checked_at_idx on public.place_google (checked_at);

comment on table public.place_google is 'Cijfer en aantal reviews van Google Maps per plek, met datum van de check. Geen teksten. Zie docs/specs/README.md punt 141.';
