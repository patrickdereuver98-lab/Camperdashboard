-- Review november 2026, DB-11 (README 38): één standaard voor de publicatiedrempel.
--
-- Ontbreekt site_settings.publish_threshold, dan gold 0,7 in de trigger places_before_write en 0,8 in
-- private.publish_threshold(). Live staat de instelling op 0,45 (implementatieplan, besluit Patrick), en seed.sql
-- zet ook 0,45. Nu is 0,45 overal de standaard. De trigger leest de instelling zelf (en niet via
-- private.publish_threshold()), omdat hij ook draait onder rollen zonder toegang tot het schema private.
-- Verder gelijk aan de live versies van 6 november 2026.
--
-- admin_pipeline('apply-threshold') zocht kandidaten alleen op de score; plekken die de verplichte velden
-- (place_meets_must_haves) niet meer halen, bleven daardoor gepubliceerd tot hun volgende wijziging.
-- Live pas toepassen na samenvoegen (CLAUDE.md).

create or replace function private.publish_threshold()
 returns numeric
 language sql
 stable
 set search_path to ''
as $$
  select coalesce((select (value #>> '{}')::numeric from public.site_settings where key = 'publish_threshold'), 0.45);
$$;

create or replace function private.places_before_write()
 returns trigger
 language plpgsql
 set search_path to ''
as $$
declare t numeric := coalesce((select (value #>> '{}')::numeric from public.site_settings where key = 'publish_threshold'), 0.45);
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
  new.completeness := public.place_completeness(new);
  if not new.status_locked then
    new.status := case when new.completeness >= t and public.place_meets_must_haves(new) then 'published' else 'draft' end;
  end if;
  return new;
end $$;

create or replace function public.admin_pipeline(p_action text)
 returns text
 language plpgsql
 security definer
 set search_path to ''
as $$
declare n int := 0; t numeric;
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
    t := private.publish_threshold();
    -- Massa-update niet per rij in het auditlog zetten
    perform set_config('request.jwt.claims', '{}', true);
    update public.places set updated_at = now()
     where not status_locked
       and ((completeness >= t and public.place_meets_must_haves(places)) <> (status = 'published'));
    get diagnostics n = row_count;
  else
    raise exception 'Onbekende actie %', p_action;
  end if;
  return n::text;
end $$;
