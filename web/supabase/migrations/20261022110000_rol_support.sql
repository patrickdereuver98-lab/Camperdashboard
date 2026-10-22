-- Rol support beperken (PRD "Rollen in beheer", besluit Patrick 18 oktober 2026; README open punt #1).
--
-- Tot nu toe gaf public.is_admin() elke rij in public.admins alle rechten, ook rol 'support'. Na deze migratie:
--   public.is_admin()   → alleen rol 'admin' (alles)
--   public.is_staff()   → 'admin' of 'support' (inzendingen, reviews, foto's, meldingen/tickets afhandelen)
--   public.admin_role() → 'admin', 'support' of null, voor de beheeromgeving (menu en pagina's)
--
-- Omdat is_admin() smaller wordt, valt alles wat hieronder niet expliciet naar is_staff() gaat vanzelf onder
-- "alleen beheerder": site_settings, admins, audit_log, app_logs, consent_log, events, ingest_runs, crowd_reports,
-- faq (schrijven), duplicate_dismissals, places insert/delete, reviews delete, admin_pipeline, admin_stats,
-- admin_duplicate_candidates en admin_merge_places. Veilig standaard: support krijgt alleen wat erbij staat.
--
-- Niet live uitvoeren zonder akkoord van Patrick. Terugdraaien: zie onderaan.

-- ── Rolfuncties ─────────────────────────────────────────────────────────────
create or replace function public.is_staff()
 returns boolean language sql stable security definer set search_path to ''
as $$
  select exists (select 1 from public.admins where user_id = (select auth.uid()) and role in ('admin', 'support'));
$$;
comment on function public.is_staff() is 'Beheerder of support: inzendingen, reviews, foto''s en meldingen afhandelen.';
-- Net als is_admin(): ook anon voert hem uit, omdat policies voor anon hem aanroepen (geeft dan false)
grant execute on function public.is_staff() to anon, authenticated;

create or replace function public.is_admin()
 returns boolean language sql stable security definer set search_path to ''
as $$
  select exists (select 1 from public.admins where user_id = (select auth.uid()) and role = 'admin');
$$;
comment on function public.is_admin() is 'Alleen rol admin: instellingen, beheerders, verwijderingen, logs en statistieken.';

create or replace function public.admin_role()
 returns text language sql stable security definer set search_path to ''
as $$
  select role from public.admins where user_id = (select auth.uid());
$$;
comment on function public.admin_role() is 'Rol van de ingelogde gebruiker in beheer (admin, support) of null.';
revoke all on function public.admin_role() from public, anon;
grant execute on function public.admin_role() to authenticated;

-- ── Beheerfuncties die support ook mag gebruiken ────────────────────────────
-- De live definities lopen voor op schema.sql (README #3). Daarom geen kopie van de functies hier, maar de huidige
-- definitie met alleen is_admin() vervangen door is_staff(). Rechten (grants) blijven bij create or replace staan.
--   admin_overview   dashboard; alleen tellingen, geen persoonsgegevens
--   admin_mark_beheer handmatig gewijzigde velden markeren bij het verwerken van een correctie
--   check_departure  vertrektijd controleren na een melding
--   user_trust       vertrouwensscore bij foto's keuren
--   sync_place_photo reviewed_by invullen als support een foto keurt
do $$
declare
  f regprocedure;
  def text;
begin
  foreach f in array array[
    'public.admin_overview()'::regprocedure,
    'public.admin_mark_beheer(uuid, text[])'::regprocedure,
    'public.check_departure(uuid, text, text)'::regprocedure,
    'public.user_trust(uuid)'::regprocedure,
    'private.sync_place_photo()'::regprocedure
  ] loop
    def := pg_get_functiondef(f);
    if position('public.is_admin()' in def) = 0 then
      raise exception '% roept public.is_admin() niet (meer) aan; migratie nakijken', f;
    end if;
    execute replace(def, 'public.is_admin()', 'public.is_staff()');
  end loop;
end $$;

-- ── Policies: wat support wel mag ───────────────────────────────────────────
-- Plekken: lezen (ook concept/verborgen) en bewerken om correcties te verwerken. Aanmaken en verwijderen blijven
-- beheerder ("admins plekken insert/delete" gebruiken is_admin()). Status wijzigen bewaakt de trigger hieronder.
drop policy if exists "plekken lezen" on public.places;
create policy "plekken lezen" on public.places for select to anon, authenticated
  using (status = 'published' or (select public.is_staff()));
drop policy if exists "admins plekken update" on public.places;
create policy "beheer plekken update" on public.places for update to authenticated
  using ((select public.is_staff())) with check ((select public.is_staff()));

-- Reviews: lezen en keuren/afwijzen. Definitief verwijderen blijft beheerder ("admins reviews delete").
drop policy if exists "reviews lezen" on public.reviews;
create policy "reviews lezen" on public.reviews for select to anon, authenticated
  using (status = 'approved' or (select public.is_staff()));
drop policy if exists "admins reviews update" on public.reviews;
create policy "beheer reviews update" on public.reviews for update to authenticated
  using ((select public.is_staff())) with check ((select public.is_staff()));

-- Inzendingen, tickets (support en Meld inhoud) en ticketberichten: lezen, toevoegen, bijwerken. Verwijderen alleen
-- beheerder (voorheen zat dat in één "for all"-policy).
drop policy if exists "admins inzendingen" on public.submissions;
create policy "beheer inzendingen lezen" on public.submissions for select to authenticated using ((select public.is_staff()));
create policy "beheer inzendingen toevoegen" on public.submissions for insert to authenticated with check ((select public.is_staff()));
create policy "beheer inzendingen bijwerken" on public.submissions for update to authenticated
  using ((select public.is_staff())) with check ((select public.is_staff()));
create policy "beheerder inzendingen verwijderen" on public.submissions for delete to authenticated using ((select public.is_admin()));

drop policy if exists "admins tickets" on public.tickets;
create policy "beheer tickets lezen" on public.tickets for select to authenticated using ((select public.is_staff()));
create policy "beheer tickets toevoegen" on public.tickets for insert to authenticated with check ((select public.is_staff()));
create policy "beheer tickets bijwerken" on public.tickets for update to authenticated
  using ((select public.is_staff())) with check ((select public.is_staff()));
create policy "beheerder tickets verwijderen" on public.tickets for delete to authenticated using ((select public.is_admin()));

drop policy if exists "admins berichten" on public.ticket_messages;
create policy "beheer berichten lezen" on public.ticket_messages for select to authenticated using ((select public.is_staff()));
create policy "beheer berichten toevoegen" on public.ticket_messages for insert to authenticated with check ((select public.is_staff()));
create policy "beheer berichten bijwerken" on public.ticket_messages for update to authenticated
  using ((select public.is_staff())) with check ((select public.is_staff()));
create policy "beheerder berichten verwijderen" on public.ticket_messages for delete to authenticated using ((select public.is_admin()));

-- Foto's van bezoekers: lezen en keuren.
drop policy if exists "eigen foto's en beheer lezen" on public.place_photos;
create policy "eigen foto's en beheer lezen" on public.place_photos for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_staff()));
drop policy if exists "beheer foto's" on public.place_photos;
create policy "beheer foto's" on public.place_photos for update to authenticated
  using ((select public.is_staff())) with check ((select public.is_staff()));

-- ── Plekken: status alleen door de beheerder ────────────────────────────────
-- Verbergen haalt een plek van de site; dat telt als verwijderen. Support mag velden aanpassen, maar niet status,
-- status_locked of merged_into. De naam begint met "places_alleen" zodat hij vóór places_before_write draait (triggers
-- met hetzelfde moment gaan op alfabet) en dus alleen ziet wat de gebruiker zelf wijzigt, niet wat die trigger daarna
-- herberekent. De pipeline (service_role, geen auth.uid()) valt buiten is_staff() en merkt hier niets van.
create or replace function private.places_alleen_admin_status()
 returns trigger language plpgsql security definer set search_path to ''
as $$
begin
  if (new.status is distinct from old.status
      or new.status_locked is distinct from old.status_locked
      or new.merged_into is distinct from old.merged_into)
     and public.is_staff() and not public.is_admin() then
    raise exception 'Alleen een beheerder kan de status van een plek wijzigen' using errcode = '42501';
  end if;
  return new;
end $$;
revoke all on function private.places_alleen_admin_status() from public, anon, authenticated;

drop trigger if exists places_alleen_admin_status on public.places;
create trigger places_alleen_admin_status before update on public.places
  for each row execute function private.places_alleen_admin_status();

-- ── Terugdraaien ────────────────────────────────────────────────────────────
-- 1. is_admin() terug naar: select exists (select 1 from public.admins where user_id = (select auth.uid()));
-- 2. drop trigger places_alleen_admin_status on public.places; drop function private.places_alleen_admin_status();
-- 3. De policies hierboven terug naar is_admin() (submissions, tickets, ticket_messages weer één "for all"-policy).
-- 4. In de vijf functies is_staff() weer vervangen door is_admin() (zelfde do-blok, omgekeerd).
-- 5. drop function public.admin_role(); drop function public.is_staff();
