-- plan.md B2.2 en B4 (20 november 2026): de lezer herkent de boekingsmodule van de site (Tommy, Booking Experts,
-- Camping.care, ...) en of er met een zuil of app wordt afgerekend (Aanuit.net, i-Marina, betaalautomaat).
-- apply_scrape bewaart dat als aanwijzing in sources.booking en sources.payment_hint. Het is geen feit voor de
-- plekpagina en verandert geen kolom; de vertrekregel volgt er nooit uit. Alleen met een geslaagde lezing: bij een
-- haperende site (_pages_failed) blijft de vorige aanwijzing staan.
-- Basis: de live apply_scrape van 20 november 2026, 22:10 UTC (na vertrek_niet_stil_wissen, versie 20261120500000).

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
  keep_departure boolean := false;
  fields text[] := array['price_eur','tourist_tax_included','power','water','dump_station','toilet','shower','wifi','dogs',
                         'capacity','max_length_m','max_stay_nights','open_all_year','season','reservation','phone','email','street','postcode',
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
  keep_departure := p.departure is not null and not (p_data ? 'departure') and not coalesce(p.sources->'beheer' ? 'departure', false);
  -- Een vertrekregel verdwijnt nooit stil: het wissen wordt een voorstel voor Beheer (bron 'pipeline', nieuw = leeg)
  if keep_departure and prev ? 'departure' and not (p_data ? '_pages_failed') and not exists (select 1 from public.updates_queue q
                                     where q.place_id = p.id and q.field_changed = 'departure' and q.source = 'pipeline'
                                       and q.status = 'pending' and q.new_value = 'null'::jsonb) then
    insert into public.updates_queue (place_id, field_changed, old_value, new_value, source)
    values (p.id, 'departure', to_jsonb(p.departure), 'null'::jsonb, 'pipeline');
  end if;

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
    -- Nieuw (herlezing 20 november 2026): zegt deze lezing niets over het vertrek terwijl de plek een vertrekregel heeft,
    -- dan blijven regel, tijd en bronzin staan; ook een notitie "Twee vertrektijden" vervangt de bronzin niet
    if keep_departure and f = any (array['departure', 'checkout_until', 'times_note']) then
      if prev ? f then applied := applied || to_jsonb(f); end if;
      continue;
    end if;
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

  -- R62: elke wijziging van een kernfeit in het veldlog, met oude en nieuwe waarde en de parser
  insert into private.field_log (place_id, field, old_value, new_value, parser)
  select p.id, e.key, to_jsonb(p)->e.key, e.value, p_data->>'_parser'
    from jsonb_each(patch) e
   where e.key = any(core || array['times_note', 'price_extras'])
     and e.value is distinct from coalesce(to_jsonb(p)->e.key, 'null'::jsonb);

  r := jsonb_populate_record(p, patch);
  update public.places t set
    price_eur = r.price_eur, price_note = r.price_note, tourist_tax_included = r.tourist_tax_included,
    power = r.power, water = r.water, dump_station = r.dump_station, toilet = r.toilet, shower = r.shower,
    wifi = r.wifi, dogs = r.dogs, capacity = r.capacity, max_length_m = r.max_length_m, max_stay_nights = r.max_stay_nights,
    open_all_year = r.open_all_year, season = r.season, reservation = r.reservation,
    phone = r.phone, email = r.email, street = r.street, postcode = r.postcode,
    description = r.description, description_source = r.description_source,
    image_url = r.image_url, image_credit = r.image_credit,
    departure = r.departure, checkout_until = r.checkout_until, checkin_from = r.checkin_from, checkin_until = r.checkin_until,
    reservation_rule = r.reservation_rule,
    access_hours = r.access_hours, access_24h = r.access_24h, times_note = r.times_note, price_extras = r.price_extras,
    photos = case when p_data ? 'photos' then p_data->'photos' when prev ? 'image_url' and not (p_data ? 'image_url') and not (p_data ? '_pages_failed') then '[]'::jsonb else t.photos end,
    sources = (coalesce(t.sources, '{}'::jsonb) - 'website_error'
               - case when p_data ? '_pages_failed' then array[]::text[] else array['booking', 'payment_hint'] end) || jsonb_build_object('website', now(), 'website_fields', applied)
              || case when p_data ? '_parser' then jsonb_build_object('website_parser', p_data->>'_parser') else '{}'::jsonb end
              -- plan.md B2.2 en B4: aanwijzingen, alleen bij een volledige lezing bijwerken (ook wissen als ze weg zijn)
              || case when p_data ? '_pages_failed' then '{}'::jsonb
                      else jsonb_strip_nulls(jsonb_build_object('booking', p_data->'_booking', 'payment_hint', p_data->'_payment')) end,
    last_scraped_at = now(),
    verified_at = case when n_core > 0 then now() else t.verified_at end
  where t.id = p_id;
  update private.scrape_queue set done_at = now(), last_error = null where place_id = p_id;
end $function$;
