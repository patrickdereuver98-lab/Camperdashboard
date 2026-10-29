-- Publicatie-eis: de vertrekregel telt dubbel (besluit eigenaar 29 oktober 2026, README nummer 66).
-- Een plek met contact en een bekende vertrekregel haalt daarmee al de eis "2 van 4 beslisfeiten"; de score
-- (`publish_threshold`) blijft gelden. Vertrektijd is het kernfeit van de site (PRD).
create or replace function public.place_meets_must_haves(p public.places)
 returns boolean
 language sql
 immutable
 set search_path to ''
as $function$
  select (p.website is not null or p.phone is not null or p.email is not null or nullif(trim(p.operator), '') is not null)
     and ((p.departure is not null)::int * 2 + (p.open_all_year is not null or p.season is not null)::int
          + (p.power is not null)::int + (p.price_eur is not null)::int) >= 2;
$function$;

-- Status opnieuw berekenen voor concepten met een vertrekregel (de trigger places_before_write rekent bij elke update)
update public.places
   set updated_at = now()
 where status = 'draft'
   and not status_locked
   and departure is not null;
