-- Masterlijst uit partnerdata en open data (tools/data-collectors → pipeline-actie merge_master, merge_master.ts).
--
-- Eén rij per plek na ontdubbelen: het bron_id van het anker is de sleutel (master_id), bron_ids zijn alle records
-- die erin zijn opgegaan. Faciliteiten staan er alleen in als alle bronnen het eens zijn; anders in conflicten.
-- Dit is een tussenlaag naast `places`: niets hier verschijnt op de site. Overnemen in `places` volgt de beslisregels
-- van de bronnenlaag (dataplan W4.1).
--
-- Alleen service_role (de edge function) leest en schrijft: RLS aan, geen policies, en geen rechten voor de rest.

create table if not exists public.geo_master (
  master_id text primary key,
  geohash text not null check (length(geohash) between 1 and 12),
  naam text,
  namen text[] not null default '{}',
  lat double precision not null check (lat between -90 and 90),
  lon double precision not null check (lon between -180 and 180),
  bron_ids text[] not null check (cardinality(bron_ids) > 0),
  faciliteiten jsonb not null default '{}' check (jsonb_typeof(faciliteiten) = 'object'),
  conflicten jsonb not null default '{}' check (jsonb_typeof(conflicten) = 'object'),
  match_score real not null check (match_score between 0 and 1),
  aangemaakt_op timestamptz not null default now(),
  bijgewerkt_op timestamptz not null default now()
);

-- Opzoeken van eerdere masters per bron_id (overlaps → &&) en per gebied (geohash-voorvoegsel)
create index if not exists geo_master_bron_ids on public.geo_master using gin (bron_ids);
create index if not exists geo_master_geohash on public.geo_master (geohash text_pattern_ops);

alter table public.geo_master enable row level security;
revoke all on public.geo_master from anon, authenticated;
grant select, insert, update, delete on public.geo_master to service_role;
