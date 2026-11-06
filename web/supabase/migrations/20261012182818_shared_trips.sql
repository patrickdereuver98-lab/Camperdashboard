-- Status: live toegepast op 2026-10-12.
-- Fase 5e: samen een reis plannen (bijvoorbeeld met je partner). Eén gedeelde reis, realtime bijgewerkt.
-- Lezen en wijzigen alleen voor leden; meedoen via een geheime uitnodigingscode; laatste wijziging wint.

create table if not exists public.shared_trips (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  name text not null default 'Onze reis' check (char_length(name) between 1 and 60),
  stops jsonb not null default '[]'::jsonb check (jsonb_typeof(stops) = 'array' and jsonb_array_length(stops) <= 200),
  invite_code text not null unique default encode(extensions.gen_random_bytes(9), 'hex'),
  updated_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.shared_trip_members (
  trip_id uuid not null references public.shared_trips (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  display_name text check (char_length(display_name) <= 80),
  joined_at timestamptz not null default now(),
  left_at timestamptz,
  primary key (trip_id, user_id)
);
create index if not exists shared_trip_members_user_idx on public.shared_trip_members (user_id) where left_at is null;

create or replace function public.is_trip_member(p_trip uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.shared_trip_members where trip_id = p_trip and user_id = auth.uid() and left_at is null);
$$;
grant execute on function public.is_trip_member(uuid) to authenticated;

alter table public.shared_trips enable row level security;
alter table public.shared_trip_members enable row level security;
create policy "leden lezen de reis" on public.shared_trips for select to authenticated using ((select public.is_trip_member(id)));
create policy "leden wijzigen de reis" on public.shared_trips for update to authenticated
  using ((select public.is_trip_member(id))) with check ((select public.is_trip_member(id)));
create policy "leden zien elkaar" on public.shared_trip_members for select to authenticated using ((select public.is_trip_member(trip_id)));
revoke all on public.shared_trips, public.shared_trip_members from anon, authenticated;
grant select on public.shared_trips, public.shared_trip_members to authenticated;
grant update (name, stops, updated_by, updated_at) on public.shared_trips to authenticated;

create or replace function private.shared_trip_touch()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end $$;
create trigger shared_trips_touch before update on public.shared_trips for each row execute function private.shared_trip_touch();

-- Nieuwe gedeelde reis maken vanuit je eigen reis
create or replace function public.create_shared_trip(p_stops jsonb, p_name text default 'Onze reis')
returns jsonb language plpgsql security definer set search_path = '' as $$
declare t public.shared_trips;
begin
  if auth.uid() is null then raise exception 'Log in om samen te plannen'; end if;
  if (select count(*) from public.shared_trips where owner_id = auth.uid()) >= 20 then raise exception 'Je hebt al veel gedeelde reizen.'; end if;
  insert into public.shared_trips (owner_id, name, stops, updated_by)
  values (auth.uid(), coalesce(nullif(trim(p_name), ''), 'Onze reis'), coalesce(p_stops, '[]'::jsonb), auth.uid())
  returning * into t;
  insert into public.shared_trip_members (trip_id, user_id, display_name)
  values (t.id, auth.uid(), (select display_name from public.profiles where id = auth.uid()));
  return jsonb_build_object('id', t.id, 'code', t.invite_code, 'name', t.name);
end $$;
revoke all on function public.create_shared_trip(jsonb, text) from public, anon;
grant execute on function public.create_shared_trip(jsonb, text) to authenticated;

-- Meedoen met de code uit de uitnodiging (opnieuw meedoen na verlaten mag)
create or replace function public.join_shared_trip(p_code text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare t public.shared_trips;
begin
  if auth.uid() is null then raise exception 'Log in om mee te doen'; end if;
  select * into t from public.shared_trips where invite_code = p_code;
  if not found then raise exception 'Deze uitnodiging bestaat niet (meer)'; end if;
  if (select count(*) from public.shared_trip_members where trip_id = t.id and left_at is null and user_id <> auth.uid()) >= 6 then
    raise exception 'Deze reis heeft al 6 deelnemers.';
  end if;
  insert into public.shared_trip_members (trip_id, user_id, display_name)
  values (t.id, auth.uid(), (select display_name from public.profiles where id = auth.uid()))
  on conflict (trip_id, user_id) do update set left_at = null, joined_at = now();
  return jsonb_build_object('id', t.id, 'name', t.name, 'stops', t.stops);
end $$;
revoke all on function public.join_shared_trip(text) from public, anon;
grant execute on function public.join_shared_trip(text) to authenticated;

create or replace function public.leave_shared_trip(p_trip uuid)
returns void language sql security definer set search_path = '' as $$
  update public.shared_trip_members set left_at = now() where trip_id = p_trip and user_id = auth.uid();
$$;
revoke all on function public.leave_shared_trip(uuid) from public, anon;
grant execute on function public.leave_shared_trip(uuid) to authenticated;

-- Realtime: wijzigingen direct naar de andere deelnemers (Realtime past RLS toe)
alter publication supabase_realtime add table public.shared_trips;
