-- Reviews alleen met account of code per mail (PRD open vraag 6, besluit 18 oktober 2026). Moderatie blijft.
--
-- submit_review accepteert alleen nog een ingelogde bezoeker (auth.uid()) met een bevestigd e-mailadres
-- (auth.users.email_confirmed_at, zoals private.on_auth_user_created dat ook eist). Inloggen met de code uit de mail
-- (verifyOtp) bevestigt het adres; Google, Apple en Facebook leveren een bevestigd adres. Het e-mailadres bij de review
-- komt uit het account, niet meer uit het formulier. Anoniem (anon) kan de functie niet meer aanroepen.
--
-- Uitrollen: deze migratie en de nieuwe site horen samen. De oude site stuurt p_author_email mee en vindt de functie
-- na deze migratie niet meer; de nieuwe site vindt hem vóór deze migratie niet. Pas de migratie toe vlak voor of na
-- de deploy.
--
-- Terugdraaien: drop function public.submit_review(uuid, text, integer, integer, integer, integer, integer, text, text,
-- text, date); de vorige versie staat in 20261015090000_misbruik_en_bewaartermijnen.sql. De kolom user_id mag blijven.

-- ── Wie schreef de review ───────────────────────────────────────────────────
-- Bij het verwijderen van een account blijft de review staan, zonder koppeling (zoals bij place_photos).
alter table public.reviews
  add column if not exists user_id uuid references auth.users (id) on delete set null;
comment on column public.reviews.user_id is
  'Account van de schrijver (ingelogd of bevestigd met een code per mail). Leeg bij reviews van vóór 22 oktober 2026 of na het verwijderen van het account.';
create index if not exists reviews_user_idx on public.reviews (user_id, created_at) where user_id is not null;

-- ── Indienen ────────────────────────────────────────────────────────────────
drop function if exists public.submit_review(uuid, text, text, integer, integer, integer, integer, integer, text, text, text, date);

create or replace function public.submit_review(p_place_id uuid, p_author_name text, p_rating integer,
  p_score_location integer, p_score_quiet integer, p_score_facilities integer, p_score_value integer, p_title text,
  p_body text, p_vehicle text, p_visited_month date)
 returns uuid language plpgsql security definer set search_path to ''
as $$
declare uid uuid := auth.uid(); mail text; rid uuid;
begin
  if uid is null then
    raise exception 'Log in of bevestig je e-mailadres met een code om een review te versturen.' using errcode = '42501';
  end if;
  select email into mail from auth.users where id = uid and email_confirmed_at is not null and email is not null;
  if mail is null then
    raise exception 'Je e-mailadres is nog niet bevestigd. Log in met de code uit de mail en probeer het opnieuw.' using errcode = '42501';
  end if;
  if not exists (select 1 from public.places where id = p_place_id and status = 'published') then
    raise exception 'Onbekende plek';
  end if;
  if (select count(*) from public.reviews where user_id = uid and created_at > now() - interval '1 hour') >= 5 then
    raise exception 'Te veel reviews in korte tijd. Probeer het later opnieuw.';
  end if;
  if not private.rate_take('review:' || p_place_id, 5, interval '1 hour')
     or not private.rate_take('review:dag', 400, interval '1 day') then
    raise exception 'Het is even erg druk. Probeer het later opnieuw.';
  end if;
  insert into public.reviews (place_id, user_id, author_name, author_email, rating, score_location, score_quiet,
    score_facilities, score_value, title, body, vehicle, visited_month)
  values (p_place_id, uid, trim(p_author_name), lower(mail), p_rating, p_score_location, p_score_quiet,
    p_score_facilities, p_score_value, nullif(trim(p_title), ''), trim(p_body), p_vehicle, p_visited_month)
  returning id into rid;
  insert into public.events (name, props) values ('review', jsonb_build_object('place_id', p_place_id));
  return rid;
end $$;
revoke all on function public.submit_review(uuid, text, integer, integer, integer, integer, integer, text, text, text, date) from public, anon;
grant execute on function public.submit_review(uuid, text, integer, integer, integer, integer, integer, text, text, text, date) to authenticated;

-- ── FAQ ─────────────────────────────────────────────────────────────────────
-- Alleen bijwerken als beheer de tekst niet zelf heeft aangepast (dan blijft die staan; pas hem aan in beheer).
update public.faq set answer = 'Iedereen die op de plek heeft gestaan. Je logt in, of je bevestigt je e-mailadres met een code die we je mailen. Schrijf over je eigen ervaring, zonder persoonsgegevens van anderen, reclame of beledigingen. Ben je eigenaar of werk je voor een plek, schrijf dan geen review over die plek of over een concurrent.', updated_at = now()
 where question = 'Wie mag een review schrijven?'
   and answer = 'Iedereen die op de plek heeft gestaan. Je hebt geen account nodig. Schrijf over je eigen ervaring, zonder persoonsgegevens van anderen, reclame of beledigingen. Ben je eigenaar of werk je voor een plek, schrijf dan geen review over die plek of over een concurrent.';

update public.faq set answer = 'Een review versturen kan alleen als je bent ingelogd of je e-mailadres hebt bevestigd met een code uit de mail. Daarna leest iemand van ons elke review voordat hij online komt, meestal binnen twee werkdagen. We kijken of hij over de plek gaat. Reviews met persoonsgegevens van anderen, beledigingen, haat of reclame plaatsen we niet. We veranderen niets aan de tekst, en een negatieve review plaatsen we net zo goed als een positieve. We controleren niet of je echt op de plek bent geweest, want we nemen geen boekingen aan. Eigenaren kunnen reviews niet laten verwijderen.', updated_at = now()
 where question = 'Hoe controleren jullie reviews?'
   and answer = 'Iemand van ons leest elke review voordat hij online komt, meestal binnen twee werkdagen. We kijken of hij over de plek gaat. Reviews met persoonsgegevens van anderen, beledigingen, haat of reclame plaatsen we niet. We veranderen niets aan de tekst, en een negatieve review plaatsen we net zo goed als een positieve. We controleren niet of je echt op de plek bent geweest en ook niet wie je bent. We nemen geen boekingen aan en sturen geen bevestigingsmail. Reviews zijn dus niet geverifieerd. Eigenaren kunnen reviews niet laten verwijderen.';
