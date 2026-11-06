-- Bug in apply_scrape: zonder `sources.beheer` was `p.sources->'beheer' ? 'checkout_until'` null, dus `not (…)` ook,
-- en dan werd de vaste tijd niet gewist als de vertrekregel van "vast" naar "vrij" of "per24" ging (d-n-mastendol:
-- per24 met 12:00). Ook de bestaande gevallen rechtzetten.
-- Daarnaast: kernvelden (keep) bleven staan als een nieuwe parser ze niet meer vond, ook als de oude ze ten onrechte vond
-- (trailerhelling, FAQ-vraag). Nu bewaart sources.website_parser de versie; alleen bij dezelfde versie of een haperende
-- site blijft een ontbrekend kernveld staan.

create or replace function public.apply_scrape(p_id uuid, p_data jsonb, p_error text default null)
 returns void
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  p public.places;
  r public.places;
  prev jsonb;
  patch jsonb := '{}'::jsonb;
  applied jsonb := '[]'::jsonb;
  n_found int := 0;
  f text;
  old jsonb;
  fields text[] := array['price_eur','tourist_tax_included','power','water','dump_station','toilet','shower','wifi','dogs',
                         'capacity','max_length_m','open_all_year','season','reservation','phone','email','street','postcode',
                         'description','image_url','departure','checkout_until','checkin_from','access_hours','access_24h','times_note','price_extras'];
  -- De eigen website gaat voor OpenStreetMap
  priority text[] := array['price_extras','price_eur','open_all_year','season','departure','checkout_until','checkin_from','access_hours','times_note'];
  -- Niet wissen als ze één keer ontbreken (haperende site); wel overschrijven met een nieuwe waarde
  keep text[] := array['price_extras','price_eur','open_all_year','season','departure','checkout_until','checkin_from','times_note'];
begin
  if p_error is not null then
    update private.scrape_queue set last_error = left(p_error, 500) where place_id = p_id;
    if (select attempts from private.scrape_queue where place_id = p_id) >= 3 then
      update private.scrape_queue set done_at = now() where place_id = p_id;
      -- Dode of onbereikbare website: zichtbaar in sources, zodat Beheer hem kan nalopen
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
    continue when p.sources->'beheer' ? f;
    old := to_jsonb(p)->f;
    if p_data ? f then
      if f = any(priority) or old is null or old = 'null'::jsonb or prev ? f then
        patch := patch || jsonb_build_object(f, p_data->f);
        applied := applied || to_jsonb(f);
      end if;
      n_found := n_found + 1;
    elsif prev ? f and not (p_data ? '_pages_failed')
          and (not (f = any(keep)) or (p_data ? '_parser' and p_data->>'_parser' is distinct from p.sources->>'website_parser')) then
      -- Kernvelden blijven alleen staan als dezelfde parserversie ze eerder vond (haperende site); een nieuwe versie die
      -- ze niet meer vindt, ruimt een fout van de oude op
      patch := patch || jsonb_build_object(f, null);
    elsif prev ? f then
      -- Blijft van de website komen, ook al vonden we het deze keer niet
      applied := applied || to_jsonb(f);
    end if;
  end loop;
  -- Vertrekregel en vaste tijd horen bij elkaar
  -- (coalesce: zonder beheer is `null ? x` null, en dan bleef een oude vaste tijd staan naast "vrij" of "per 24 uur")
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
    departure = r.departure, checkout_until = r.checkout_until, checkin_from = r.checkin_from,
    access_hours = r.access_hours, access_24h = r.access_24h, times_note = r.times_note, price_extras = r.price_extras,
    photos = case when p_data ? 'photos' then p_data->'photos' when prev ? 'image_url' and not (p_data ? 'image_url') and not (p_data ? '_pages_failed') then '[]'::jsonb else t.photos end,
    sources = (coalesce(t.sources, '{}'::jsonb) - 'website_error') || jsonb_build_object('website', now(), 'website_fields', applied)
              || case when p_data ? '_parser' then jsonb_build_object('website_parser', p_data->>'_parser') else '{}'::jsonb end,
    last_scraped_at = now(),
    -- Alleen "gecontroleerd" als de website deze keer ook echt iets over de plek zei
    verified_at = case when n_found > 0 then now() else t.verified_at end
  where t.id = p_id;
  update private.scrape_queue set done_at = now(), last_error = null where place_id = p_id;
end $function$;

update public.places
   set checkout_until = null
 where departure is distinct from 'vast' and checkout_until is not null
   and not coalesce(sources->'beheer' ? 'checkout_until', false);
