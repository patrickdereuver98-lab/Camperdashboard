-- Review 16 november 2026, R61: correcties van beheer overleven de volgende lezing.
-- 1. Bevestigen of voorwaardelijk markeren (check_departure) en een geaccepteerde vertrektijd uit de inbox
--    (mark_departure_checked) zetten departure, checkout_until en times_note in sources.beheer. Zonder times_note in het
--    slot wiste de trigger places_before_write de controle zodra de site een andere bronzin gaf.
-- 2. apply_scrape slaat een veld van beheer nog steeds over, maar zet een afwijkende waarde voor een kernfeit nu als
--    voorstel (bron 'pipeline') in updates_queue, zodat beheer het ziet.
-- 3. De 40 prijzen die de nacontrole van 8 november corrigeerde (private.nacontrole_20261108, actie 'gecorrigeerd'),
--    krijgen met terugwerkende kracht een slot op price_eur. De geleegde prijzen niet: die mag de nieuwe parser vullen.
-- Basis apply_scrape: 20261106300000 (gelijk aan live op 18 november 2026); alleen het beheerblok in de lus is nieuw.

-- Slot zetten zonder rechtencontrole, voor gebruik binnen functies die zelf al controleren
create or replace function private.lock_fields(p_place uuid, p_fields text[])
 returns void
 language sql
 security definer
 set search_path to ''
as $$
  update public.places
     set sources = jsonb_set(coalesce(sources, '{}'), '{beheer}', (
       select coalesce(jsonb_agg(f order by f), '[]'::jsonb)
         from (select jsonb_array_elements_text(case jsonb_typeof(sources->'beheer') when 'array' then sources->'beheer' else '[]' end) f
               union select jsonb_object_keys(case jsonb_typeof(sources->'beheer') when 'object' then sources->'beheer' else '{}' end)
               union select unnest(p_fields)) x))
   where id = p_place;
$$;
revoke all on function private.lock_fields(uuid, text[]) from public, anon, authenticated;

CREATE OR REPLACE FUNCTION public.check_departure(p_id uuid, p_check text, p_by text DEFAULT 'beheer'::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if not public.is_admin() then
    raise exception 'Geen beheerrechten' using errcode = '42501';
  end if;
  if p_check is not null and p_check not in ('bevestigd', 'voorwaardelijk', 'afgewezen') then
    raise exception 'Onbekende controle: %', p_check;
  end if;
  if p_by not in ('beheer', 'eigenaar') then
    raise exception 'Onbekende bron: %', p_by;
  end if;
  if p_check = 'bevestigd' and not exists (select 1 from public.places where id = p_id and departure in ('vrij', 'per24')) then
    raise exception 'Alleen een plek met "geen vaste vertrektijd" of "per 24 uur" kan bevestigd worden';
  end if;
  update public.places set
    departure_check = p_check,
    departure_checked_at = case when p_check is null then null else now() end,
    departure_checked_by = case when p_check is null then null else p_by end
  where id = p_id;
  -- R61: een bevestigde of voorwaardelijke regel blijft staan; afwijzen zet geen slot (de regel klopt dan juist niet)
  if p_check in ('bevestigd', 'voorwaardelijk') then
    perform private.lock_fields(p_id, array['departure', 'checkout_until', 'times_note']);
  end if;
end $function$;

CREATE OR REPLACE FUNCTION private.mark_departure_checked(p_place uuid, p_by text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  -- In een aparte update: de trigger places_before_write wist de controle als de regel verandert zonder nieuwe datum
  update public.places
     set departure_checked_at = now(),
         departure_checked_by = p_by,
         departure_check = case when departure = 'vast' then 'bevestigd' else null end
   where id = p_place;
  -- R61: de geaccepteerde regel, tijd en bronzin samen op slot
  perform private.lock_fields(p_place, array['departure', 'checkout_until', 'times_note']);
end $function$;

CREATE OR REPLACE FUNCTION public.apply_scrape(p_id uuid, p_data jsonb, p_error text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  p public.places;
  r public.places;
  prev jsonb;
  patch jsonb := '{}'::jsonb;
  applied jsonb := '[]'::jsonb;
  n_found int := 0;
  -- Alleen deze velden maken een controledatum: zonder prijs, vertrek of seizoen is de plek niet 'gecontroleerd'
  n_core int := 0;
  core text[] := array['price_eur','departure','checkout_until','season','open_all_year'];
  f text;
  old jsonb;
  fields text[] := array['price_eur','tourist_tax_included','power','water','dump_station','toilet','shower','wifi','dogs',
                         'capacity','max_length_m','open_all_year','season','reservation','phone','email','street','postcode',
                         'description','image_url','departure','checkout_until','checkin_from','checkin_until','access_hours','access_24h','times_note','price_extras',
                         'reservation_rule'];
  priority text[] := array['price_extras','price_eur','open_all_year','season','departure','checkout_until','checkin_from','access_hours','times_note'];
  keep text[] := array['price_extras','price_eur','open_all_year','season','departure','checkout_until','checkin_from','times_note'];
begin
  if p_error is not null then
    update private.scrape_queue set last_error = left(p_error, 500) where place_id = p_id;
    if (select attempts from private.scrape_queue where place_id = p_id) >= 3 then
      update private.scrape_queue set done_at = now() where place_id = p_id;
      update public.places
         set last_scraped_at = now(),
             sources = coalesce(sources, '{}'::jsonb) || jsonb_build_object('website_error', jsonb_build_object('at', now(), 'error', left(p_error, 200)))
       where id = p_id;
    end if;
    return;
  end if;

  select * into p from public.places where id = p_id for update;
  if not found then return; end if;
  prev := coalesce(p.sources->'website_fields', '[]'::jsonb);

  foreach f in array fields loop
    if p.sources->'beheer' ? f then
      -- R61: beheer gaat voor. Zegt de site iets anders bij een kernfeit, dan wordt dat een voorstel in de inbox in
      -- plaats van een stille overschrijving (één open voorstel per plek, veld en waarde).
      if f = any(core || array['times_note']) and p_data ? f and p_data->f is distinct from to_jsonb(p)->f
         and p_data->f is distinct from 'null'::jsonb
         and not exists (select 1 from public.updates_queue q
                          where q.place_id = p.id and q.field_changed = f and q.source = 'pipeline'
                            and q.status = 'pending' and q.new_value = p_data->f) then
        insert into public.updates_queue (place_id, field_changed, old_value, new_value, source)
        values (p.id, f, to_jsonb(p)->f, p_data->f, 'pipeline');
      end if;
      continue;
    end if;
    old := to_jsonb(p)->f;
    if p_data ? f then
      if f = any(priority) or old is null or old = 'null'::jsonb or prev ? f then
        patch := patch || jsonb_build_object(f, p_data->f);
        applied := applied || to_jsonb(f);
      end if;
      n_found := n_found + 1;
      if f = any(core) then n_core := n_core + 1; end if;
    elsif prev ? f and not (p_data ? '_pages_failed')
          and (not (f = any(keep)) or (p_data ? '_parser' and p_data->>'_parser' is distinct from p.sources->>'website_parser')) then
      patch := patch || jsonb_build_object(f, null);
    elsif prev ? f then
      applied := applied || to_jsonb(f);
    end if;
  end loop;
  if patch ? 'departure' and patch->>'departure' is distinct from 'vast' and not coalesce(p.sources->'beheer' ? 'checkout_until', false) then
    patch := patch || jsonb_build_object('checkout_until', null);
  end if;

  if patch ? 'price_eur' then patch := patch || jsonb_build_object('price_note', p_data->'price_note'); end if;
  if patch ? 'description' then
    patch := patch || jsonb_build_object('description_source', case when patch->>'description' is null then null else 'website' end);
  end if;
  if patch ? 'image_url' then
    patch := patch || jsonb_build_object('image_credit', case when patch->>'image_url' is null then null else coalesce(p_data->>'image_credit', p.website) end);
  end if;

  r := jsonb_populate_record(p, patch);
  update public.places t set
    price_eur = r.price_eur, price_note = r.price_note, tourist_tax_included = r.tourist_tax_included,
    power = r.power, water = r.water, dump_station = r.dump_station, toilet = r.toilet, shower = r.shower,
    wifi = r.wifi, dogs = r.dogs, capacity = r.capacity, max_length_m = r.max_length_m,
    open_all_year = r.open_all_year, season = r.season, reservation = r.reservation,
    phone = r.phone, email = r.email, street = r.street, postcode = r.postcode,
    description = r.description, description_source = r.description_source,
    image_url = r.image_url, image_credit = r.image_credit,
    departure = r.departure, checkout_until = r.checkout_until, checkin_from = r.checkin_from, checkin_until = r.checkin_until,
    reservation_rule = r.reservation_rule,
    access_hours = r.access_hours, access_24h = r.access_24h, times_note = r.times_note, price_extras = r.price_extras,
    photos = case when p_data ? 'photos' then p_data->'photos' when prev ? 'image_url' and not (p_data ? 'image_url') and not (p_data ? '_pages_failed') then '[]'::jsonb else t.photos end,
    sources = (coalesce(t.sources, '{}'::jsonb) - 'website_error') || jsonb_build_object('website', now(), 'website_fields', applied)
              || case when p_data ? '_parser' then jsonb_build_object('website_parser', p_data->>'_parser') else '{}'::jsonb end,
    last_scraped_at = now(),
    verified_at = case when n_core > 0 then now() else t.verified_at end
  where t.id = p_id;
  update private.scrape_queue set done_at = now(), last_error = null where place_id = p_id;
end $function$;

-- Nacontrole 8 november: gecorrigeerde prijzen met terugwerkende kracht op slot (40 plekken op 18 november)
select private.lock_fields(n.place_id, array['price_eur'])
  from private.nacontrole_20261108 n
 where n.actie = 'gecorrigeerd';
