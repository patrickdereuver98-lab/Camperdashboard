-- R14 / SEC-04 (review november 2026): public.is_admin() keek alleen of iemand in public.admins stond. Een account met
-- rol 'support' mocht daardoor alles wat een beheerder mag (plekken wijzigen, reviews, logs, instellingen).
-- Nu telt alleen rol 'admin'. Bron blijft public.admins (de trigger admins_sync_profile_role houdt profiles.role gelijk).
--
-- Live gecontroleerd op 6 november 2026: er is één beheerder, met admins.role = 'admin' en profiles.role = 'admin'.
-- Die houdt dus toegang. Een support-account ziet in beheer daarna "Geen beheertoegang", tot er een eigen
-- support-omgeving is. Terugdraaien: de vorige definitie staat in de nulmigratie 20261102132558_baseline.sql (select exists ... where user_id = ...).

create or replace function public.is_admin() returns boolean
 language sql stable security definer set search_path to ''
as $$
  select exists (select 1 from public.admins where user_id = (select auth.uid()) and role = 'admin');
$$;
-- Rechten blijven zoals ze zijn (create or replace houdt ze): anon moet is_admin() kunnen aanroepen, want de
-- leespolicies ("plekken lezen", "reviews lezen", "faq lezen") gebruiken hem ook voor bezoekers zonder account.
