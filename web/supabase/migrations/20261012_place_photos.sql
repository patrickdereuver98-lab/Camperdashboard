-- Status: live toegepast op 2026-10-12.
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
