-- Eigen database voor de tests van de plekgeschiedenis (run.sh maakt hem aan). Stuk van het live schema op
-- 18 november 2026: rollen, auth.uid(), admins, is_admin(), admin_mark_beheer (letterlijk uit de nulmigratie) en
-- places met de kolommen die de test raakt.
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin bypassrls; end if;
end $$;
create schema private;
create schema auth;
grant usage on schema public to anon, authenticated, service_role;

create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
grant usage on schema auth to anon, authenticated;
grant execute on function auth.uid() to anon, authenticated;

create table public.admins (user_id uuid primary key, email text not null, role text not null default 'admin');
create function public.is_admin() returns boolean language sql stable security definer set search_path to '' as $$
  select exists (select 1 from public.admins where user_id = (select auth.uid()))
$$;
grant execute on function public.is_admin() to anon, authenticated;

create table public.places (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  status text not null default 'draft',
  status_locked boolean not null default false,
  lat double precision, lng double precision,
  price_eur numeric,
  departure text, checkout_until text,
  power boolean,
  completeness numeric,
  sources jsonb not null default '{}',
  updated_at timestamptz not null default now()
);
alter table public.places enable row level security;
grant select, update on public.places to authenticated;
create policy "lezen" on public.places for select to authenticated using (true);
create policy "admins update" on public.places for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

create function public.admin_mark_beheer(p_place_id uuid, p_fields text[]) returns void
 language plpgsql security definer set search_path to ''
as $function$
begin
  if not public.is_admin() then raise exception 'Geen toegang'; end if;
  update public.places
     set sources = jsonb_set(coalesce(sources, '{}'), '{beheer}', (
       select coalesce(jsonb_agg(f order by f), '[]'::jsonb)
         from (select jsonb_array_elements_text(coalesce(sources->'beheer', '[]')) f union select unnest(p_fields)) x))
   where id = p_place_id;
end $function$;
grant execute on function public.admin_mark_beheer(uuid, text[]) to authenticated;
