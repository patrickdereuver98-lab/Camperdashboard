-- Status: live toegepast op 2026-10-12 (delete_my_account later die dag, na akkoord van Patrick, met tweestaps-bevestiging).
-- Accounts voor bezoekers (Google, Apple, Facebook, magic link): profiel en "Mijn reis" in de cloud.
-- Additief. Elke gebruiker ziet en wijzigt alleen zijn eigen rijen (RLS).

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text check (char_length(display_name) <= 80),
  avatar_url text check (avatar_url ~ '^https://'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
create policy "eigen profiel lezen" on public.profiles for select to authenticated using ((select auth.uid()) = id);
create policy "eigen profiel wijzigen" on public.profiles for update to authenticated
  using ((select auth.uid()) = id) with check ((select auth.uid()) = id);
revoke all on public.profiles from anon;
grant select, update (display_name, avatar_url, updated_at) on public.profiles to authenticated;

create table if not exists public.user_trips (
  user_id uuid primary key references auth.users (id) on delete cascade,
  stops jsonb not null default '[]'::jsonb check (jsonb_typeof(stops) = 'array' and jsonb_array_length(stops) <= 200),
  updated_at timestamptz not null default now()
);
alter table public.user_trips enable row level security;
create policy "eigen reis" on public.user_trips for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
revoke all on public.user_trips from anon;
grant select, insert, update, delete on public.user_trips to authenticated;

-- Profiel aanmaken met naam en foto van de provider (Google/Apple/Facebook geven full_name/name en avatar_url/picture)
create or replace function private.create_profile()
returns trigger language plpgsql security definer set search_path = '' as $$
declare m jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb); avatar text;
begin
  avatar := coalesce(m->>'avatar_url', m->>'picture');
  insert into public.profiles (id, display_name, avatar_url)
  values (new.id,
          left(nullif(trim(coalesce(m->>'full_name', m->>'name', split_part(new.email, '@', 1))), ''), 80),
          case when avatar ~ '^https://' then avatar end)
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_profile on auth.users;
create trigger on_auth_user_profile after insert on auth.users for each row execute function private.create_profile();

-- Beheerrechten alleen voor een BEVESTIGD uitgenodigd e-mailadres. Voorheen gebeurde dit al bij het aanmaken van
-- het account; met publieke aanmelding (OAuth, magic link) moet het adres eerst bewezen zijn.
create or replace function private.on_auth_user_created()
returns trigger language plpgsql security definer set search_path = '' as $$
declare invite private.admin_invites;
begin
  if new.email_confirmed_at is null then return new; end if;
  select * into invite from private.admin_invites where lower(email) = lower(new.email);
  if found then
    insert into public.admins (user_id, email, role) values (new.id, new.email, invite.role)
    on conflict (user_id) do nothing;
  end if;
  return new;
end $$;

drop trigger if exists on_auth_user_confirmed on auth.users;
create trigger on_auth_user_confirmed after update of email_confirmed_at on auth.users
  for each row when (old.email_confirmed_at is null and new.email_confirmed_at is not null)
  execute function private.on_auth_user_created();

-- Bestaande accounts een profiel geven
insert into public.profiles (id, display_name)
select id, left(split_part(email, '@', 1), 80) from auth.users on conflict (id) do nothing;

-- Zelf je account verwijderen (AVG art. 17). Profiel, reis, camper, uitgaven en volgers verdwijnen via ON DELETE CASCADE.
-- Tweestaps: de knop in /account en daarna het woord VERWIJDEREN intypen; de functie controleert dat woord zelf.
create or replace function public.delete_my_account(p_confirm text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Niet ingelogd'; end if;
  if upper(trim(coalesce(p_confirm, ''))) <> 'VERWIJDEREN' then raise exception 'Typ VERWIJDEREN om je account te verwijderen'; end if;
  delete from auth.users where id = auth.uid();
end $$;
revoke all on function public.delete_my_account(text) from public, anon;
grant execute on function public.delete_my_account(text) to authenticated;
