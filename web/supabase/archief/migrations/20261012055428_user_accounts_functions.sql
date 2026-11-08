-- Live migratie 20261012055428 (user_accounts_functions), letterlijk uit supabase_migrations.schema_migrations.statements
-- (opgehaald 8 november 2026, review R5). Niet wijzigen: dit is de geschiedenis zoals live toegepast.

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

insert into public.profiles (id, display_name)
select id, left(split_part(email, '@', 1), 80) from auth.users on conflict (id) do nothing;
