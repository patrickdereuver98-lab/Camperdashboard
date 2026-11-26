-- Beheerrechten alleen met tweestapsverificatie (audit 24 november 2026, H2).
--
-- is_admin() en has_admin_role() geven pas true als de sessie op niveau aal2 zit (wachtwoord plus TOTP-code). Een
-- geraden of gelekt wachtwoord alleen geeft dan geen beheerrechten meer: RLS, admin-RPC's en de API-routes die het token
-- van de beheerder doorgeven (api/admin/*) volgen deze twee functies.
--
-- Volgorde, zodat niemand zich buitensluit:
--   1. De code met de TOTP-stap in de beheeromgeving (app/admin/shell.tsx) staat live.
--   2. Elke beheerder logt in op /admin en koppelt een authenticator-app.
--   3. Pas dan deze migratie toepassen. De controle hieronder breekt de migratie af (er verandert dan niets) zolang een
--      beheerder nog geen geverifieerde TOTP-factor heeft.
-- Het niveau komt uit request.jwt.claims (wat auth.jwt() ook leest), zodat de herbouwtest op de kale image werkt.
-- Terugdraaien: de vorige definities staan in 20261102132558_baseline.sql (is_admin) en 20261106100100_is_admin_rol.sql
-- (has_admin_role); zonder de aal-voorwaarde opnieuw aanmaken.

do $$
declare v_missing text;
begin
  select string_agg(distinct coalesce(u.email, x.user_id::text), ', ')
    into v_missing
    from (
      select user_id from public.admins where role = 'admin'
      union
      select id from public.profiles where role = 'admin'
    ) x
    left join auth.users u on u.id = x.user_id
   where not exists (
     select 1 from auth.mfa_factors f
      where f.user_id = x.user_id and f.factor_type = 'totp' and f.status = 'verified'
   );
  if v_missing is not null then
    raise exception 'Nog niet toepassen: deze beheerders hebben geen authenticator-app gekoppeld: %', v_missing
      using hint = 'Log in op /admin, koppel de app en voer de migratie daarna opnieuw uit.';
  end if;
end $$;

create or replace function public.is_admin()
 returns boolean
 language sql
 stable security definer
 set search_path to ''
as $function$
  select coalesce((select nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'aal') = 'aal2', false)
     and exists (select 1 from public.admins where user_id = (select auth.uid()) and role = 'admin');
$function$;

create or replace function public.has_admin_role()
 returns boolean
 language sql
 stable security definer
 set search_path to ''
as $function$
  select coalesce((select nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'aal') = 'aal2', false)
     and exists (select 1 from public.profiles where id = (select auth.uid()) and role = 'admin');
$function$;
