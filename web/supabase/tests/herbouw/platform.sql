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
