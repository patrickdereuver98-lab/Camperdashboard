-- Herbouwtest (R5): de image supabase/postgres heeft alleen de eerste versie van auth en storage; GoTrue en de
-- storage-API zetten de rest bij hun eigen start. Dit vult de kolommen aan die de app (triggers, policies, buckets)
-- gebruikt, met de typen van live (8 november 2026). Hoort bij de test, niet bij de migraties: op een echt project
-- staan deze kolommen er al.
alter table auth.users
  add column if not exists email_confirmed_at timestamptz,
  add column if not exists phone text,
  add column if not exists phone_confirmed_at timestamptz,
  add column if not exists banned_until timestamptz,
  add column if not exists is_sso_user boolean not null default false,
  add column if not exists deleted_at timestamptz,
  add column if not exists is_anonymous boolean not null default false;

alter table storage.buckets
  add column if not exists public boolean default false,
  add column if not exists avif_autodetection boolean default false,
  add column if not exists file_size_limit bigint,
  add column if not exists allowed_mime_types text[],
  add column if not exists owner_id text;

alter table storage.objects
  add column if not exists version text,
  add column if not exists owner_id text,
  add column if not exists user_metadata jsonb;

-- auth.mfa_factors (GoTrue maakt hem zelf aan): migratie 20261124100000 controleert vóór het aanscherpen van is_admin
-- dat elke beheerder een geverifieerde TOTP-factor heeft. Live zijn factor_type en status enums; tekst volstaat hier.
create table if not exists auth.mfa_factors (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  friendly_name text,
  factor_type text not null,
  status text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
