-- R9 / SEC-01 / B1 en B19 (review november 2026): het e-mailadres van een reviewer lekte.
--
-- De policy "reviews lezen" laat iedereen goedgekeurde reviews lezen, en anon en authenticated hadden SELECT op de hele
-- tabel. Daarmee waren `author_email`, `admin_note` en `user_id` van elke goedgekeurde review openbaar (submit_review
-- vult `author_email` altijd met het adres van het account). Nu:
--   * anon en authenticated mogen alleen de openbare kolommen lezen (kolomrechten). `select *` werkt voor hen dus niet
--     meer; de site en de snapshot vragen al alleen openbare kolommen op (places.ts, refresh-snapshot.mjs).
--   * beheer leest reviews via public.admin_reviews() (security definer, alleen rol admin), met e-mailadres.
--   * authenticated mag in de tabel alleen `status` en `admin_note` wijzigen (en dan nog alleen als beheerder, RLS).
--   * de oude public.submit_review met p_author_email (zonder account, B19) verdwijnt; live stond hij er nog.
--
-- Uitrollen: na het samenvoegen van de nieuwe beheerpagina (admin/reviews/page.tsx gebruikt admin_reviews). De oude
-- beheerpagina doet `select("*")` en krijgt na deze migratie een rechtenfout; de publieke site merkt niets.
-- Terugdraaien: grant select on public.reviews to anon, authenticated; drop function public.admin_reviews(text, integer).

-- ── Kolomrechten ────────────────────────────────────────────────────────────────────────────────────────────────────
revoke select, insert, update on public.reviews from anon, authenticated;
grant select (id, place_id, author_name, rating, score_location, score_quiet, score_facilities, score_value, title, body,
              vehicle, visited_month, status, created_at)
  on public.reviews to anon, authenticated;
grant update (status, admin_note) on public.reviews to authenticated;

-- ── Beheer: reviews met e-mailadres en notitie ──────────────────────────────────────────────────────────────────────
create or replace function public.admin_reviews(p_status text default 'pending', p_limit integer default 100)
 returns table (
   id uuid, place_id uuid, place_name text, place_slug text, author_name text, author_email text, rating smallint,
   title text, body text, vehicle text, visited_month date, status text, admin_note text, created_at timestamptz,
   has_account boolean)
 language plpgsql stable security definer set search_path to ''
as $$
begin
  if not public.is_admin() then raise exception 'Geen toegang' using errcode = '42501'; end if;
  return query
    select r.id, r.place_id, p.name, p.slug, r.author_name, r.author_email, r.rating, r.title, r.body, r.vehicle,
           r.visited_month, r.status, r.admin_note, r.created_at, r.user_id is not null
      from public.reviews r
      left join public.places p on p.id = r.place_id
     where r.status = coalesce(p_status, 'pending')
     order by r.created_at desc
     limit least(greatest(coalesce(p_limit, 100), 1), 500);
end $$;
revoke all on function public.admin_reviews(text, integer) from public, anon;
grant execute on function public.admin_reviews(text, integer) to authenticated;

-- ── B19: oude submit_review zonder account weg ──────────────────────────────────────────────────────────────────────
drop function if exists public.submit_review(uuid, text, text, integer, integer, integer, integer, integer, text, text, text, date);
