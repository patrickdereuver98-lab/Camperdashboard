-- Status: live toegepast op 2026-10-12.
-- Fase 5b: voertuigkluis. Camperprofiel (afmetingen, brandstof, verbruik) per account, en een privé-map voor
-- documenten (bijvoorbeeld kentekenbewijs of verzekering, als PDF of foto). Alleen de eigenaar kan erbij.

create table if not exists public.user_vehicles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  data jsonb not null default '{}'::jsonb check (jsonb_typeof(data) = 'object' and pg_column_size(data) < 2000),
  updated_at timestamptz not null default now()
);
alter table public.user_vehicles enable row level security;
create policy "eigen camper" on public.user_vehicles for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
revoke all on public.user_vehicles from anon;
grant select, insert, update on public.user_vehicles to authenticated;

-- Privé (niet openbaar), max. 5 MB, PDF of foto
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('vehicle-docs', 'vehicle-docs', false, 5242880, array['application/pdf', 'image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy "eigen documenten lezen" on storage.objects for select to authenticated
  using (bucket_id = 'vehicle-docs' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "eigen documenten uploaden" on storage.objects for insert to authenticated
  with check (bucket_id = 'vehicle-docs' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "eigen documenten weghalen" on storage.objects for delete to authenticated
  using (bucket_id = 'vehicle-docs' and (storage.foldername(name))[1] = (select auth.uid())::text);
