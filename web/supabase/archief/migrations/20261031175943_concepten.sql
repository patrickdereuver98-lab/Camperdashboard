-- Concepten publiceren (opdracht eigenaar 31 oktober 2026, C1 en C2).
--
-- C1. private.concept_reden(p): waarom een plek concept is, volgens dezelfde regels als places_before_write
--     (publish_threshold en place_meets_must_haves). Eén hoofdreden per plek, in deze volgorde:
--       vastgezet → geen contact → te weinig kernfeiten (zonder of met vertrekregel) → onder de drempel.
--     public.admin_concept_redenen(): aantallen per reden, voor Beheer en de rapportage.
-- C2. private.forceer_kernfeit_scrape(): zet concepten met een website en zonder vertrekregel in de scrape-wachtrij,
--     ook als ze minder dan 14 dagen geleden zijn gelezen (eenmalig, na de kernfeit-focus van de scraper).
--     Adressen: PDOK vond voor deze plekken geen adres binnen 75 m (sources.pdok, 18 oktober). Opnieuw proberen geeft
--     hetzelfde, en een adres verder weg zou een gok zijn. Een adres is ook geen voorwaarde om te publiceren.

create or replace function private.concept_reden(p public.places)
returns text
language sql
stable
set search_path to ''
as $$
  select case
    when p.status <> 'draft' then null
    when p.status_locked then 'vastgezet door beheer'
    when not (p.website is not null or p.phone is not null or p.email is not null or nullif(trim(p.operator), '') is not null)
      then 'geen contact (website, telefoon of e-mail)'
    when not public.place_meets_must_haves(p) and p.departure is null then 'te weinig kernfeiten, geen vertrekregel'
    when not public.place_meets_must_haves(p) then 'te weinig kernfeiten'
    else 'onder de publicatiedrempel'
  end;
$$;
revoke all on function private.concept_reden(public.places) from public, anon, authenticated;

create or replace function public.admin_concept_redenen()
returns table (reden text, aantal bigint, met_website bigint, zonder_adres bigint)
language plpgsql
stable
security definer
set search_path to ''
as $$
begin
  if not public.is_admin() and current_user not in ('postgres', 'service_role') then raise exception 'Geen toegang'; end if;
  return query
    select r.reden, count(*), count(*) filter (where p.website is not null), count(*) filter (where p.street is null or p.postcode is null)
      from public.places p cross join lateral (select private.concept_reden(p) as reden) r
     where p.merged_into is null and p.status = 'draft'
     group by r.reden
     order by count(*) desc;
end $$;
revoke all on function public.admin_concept_redenen() from public, anon;
grant execute on function public.admin_concept_redenen() to authenticated, service_role;

create or replace function private.forceer_kernfeit_scrape(p_limit integer default 2000)
returns integer
language plpgsql
security definer
set search_path to ''
as $$
declare n int;
begin
  insert into private.scrape_queue (place_id)
  select p.id from public.places p
   where p.merged_into is null
     and p.status = 'draft'
     and p.website is not null
     and p.departure is null
     -- Alleen met de stealth-lezer leesbaar: die plekken lopen via de stealth-wachtrij (14 dagen, B1)
     and not (p.sources ? 'stealth' and not (p.sources->'stealth' ? 'error'))
     and not exists (select 1 from private.scrape_queue q where q.place_id = p.id and q.done_at is null)
   order by p.completeness desc
   limit p_limit
  on conflict (place_id) do update set done_at = null, attempts = 0, next_attempt_at = now(), last_error = null
   where private.scrape_queue.done_at is not null;
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function private.forceer_kernfeit_scrape(integer) from public, anon, authenticated;
