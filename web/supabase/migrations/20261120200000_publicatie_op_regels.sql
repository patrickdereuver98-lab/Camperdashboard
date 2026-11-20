-- Publiceren op regels in plaats van op een score (besluit Patrick 20 november 2026, dataplan november §7, README 139).
--
-- Een plek staat online als de harde eisen kloppen (place_meets_must_haves): een contact (website, telefoon, e-mail of
-- beheerder) en minstens 2 punten uit vertrekregel (telt 2), seizoen, stroom en prijs. Dat geeft precies de twee
-- soorten uit de PRD:
--   * volledig: vertrekregel bekend en contact;
--   * onvolledig (grijs): geen vertrekregel, wel contact en minstens 2 van prijs, seizoen en stroom.
-- De gewogen score (place_completeness) telt niet meer voor publicatie, alleen voor de volgorde op de site
-- (recommendScore). Hij hield 14 plekken met een vertrekregel verborgen omdat bijvoorbeeld een foto ontbrak.
-- site_settings.publish_threshold blijft staan maar wordt niet meer gelezen.
-- Basis: places_before_write en admin_pipeline uit 20261106200200_publicatiedrempel (gelijk aan live op 20 november).
-- Live pas toepassen na samenvoegen, daarna admin_pipeline('apply-threshold') of de update onderaan.

set local lock_timeout = '5s';

create or replace function private.places_before_write()
 returns trigger
 language plpgsql
 set search_path to ''
as $$
begin
  if new.image_url like '%&#%' or new.photos::text like '%&#%' then
    new.image_url := private.decode_entities(new.image_url);
    new.photos := (select coalesce(jsonb_agg(jsonb_set(ph, '{url}', to_jsonb(private.decode_entities(ph->>'url')))), '[]'::jsonb)
                     from jsonb_array_elements(new.photos) ph);
  end if;
  if tg_op = 'UPDATE'
     and (new.departure, new.checkout_until, new.times_note) is distinct from (old.departure, old.checkout_until, old.times_note)
     and new.departure_checked_at is not distinct from old.departure_checked_at then
    new.departure_check := null;
    new.departure_checked_at := null;
    new.departure_checked_by := null;
  end if;
  new.updated_at := now();
  -- De score blijft voor de volgorde op de site
  new.completeness := public.place_completeness(new);
  if not new.status_locked then
    new.status := case when public.place_meets_must_haves(new) then 'published' else 'draft' end;
  end if;
  return new;
end $$;

create or replace function public.admin_pipeline(p_action text)
 returns text
 language plpgsql
 security definer
 set search_path to ''
as $$
declare n int := 0;
begin
  if not public.is_admin() then raise exception 'Geen toegang'; end if;
  insert into public.audit_log (actor, actor_email, action, entity, entity_id, details)
  values (auth.uid(), (select email from public.admins where user_id = auth.uid()), 'pipeline', 'pipeline', p_action, '{}'::jsonb);
  if p_action = 'scrape-missing' then
    perform public.enqueue_scrape(true);
  elsif p_action = 'scrape-all' then
    perform public.enqueue_scrape(false);
  elsif p_action = 'osm-refresh' then
    update public.osm_regions set last_run_at = null where places_req is null;
  elsif p_action = 'apply-threshold' then
    -- Massa-update niet per rij in het auditlog zetten
    perform set_config('request.jwt.claims', '{}', true);
    update public.places set updated_at = now()
     where not status_locked
       and public.place_meets_must_haves(places) <> (status = 'published');
    get diagnostics n = row_count;
  else
    raise exception 'Onbekende actie %', p_action;
  end if;
  return n::text;
end $$;

comment on column public.places.completeness is 'Gewogen score (0 tot 1) voor de volgorde op de site; telt sinds 20 november 2026 niet meer voor publicatie';
