-- Vangnet in de pipeline (datareview 18 oktober, stap 1):
-- * Een site waarvan subpagina's haperden (ook na een tweede poging, geen 404) levert `_pages_failed`; dan wist
--   apply_scrape niets wat deze keer ontbreekt, ook de gewone velden niet.
-- * `verified_at` alleen als de website iets opleverde.
-- * Een website die na drie pogingen niet te lezen is krijgt `sources.website_error` (tijd en fout); een geslaagde
--   scrape haalt die weer weg.
-- * enqueue_stale_scrape neemt ook plekken mee die nooit gelezen zijn, en sluit rijen af die bleven hangen omdat de
--   achtergrondtaak na de derde poging stopte zonder resultaat.
-- * Twee OSM-runs van 10 oktober stonden nog op "running" (nu "error").

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
    elsif prev ? f and not (f = any(keep)) and not (p_data ? '_pages_failed') then
      patch := patch || jsonb_build_object(f, null);
    elsif prev ? f then
      -- Blijft van de website komen, ook al vonden we het deze keer niet
      applied := applied || to_jsonb(f);
    end if;
  end loop;
  -- Vertrekregel en vaste tijd horen bij elkaar
  if patch ? 'departure' and patch->>'departure' is distinct from 'vast' and not (p.sources->'beheer' ? 'checkout_until') then
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
    sources = (coalesce(t.sources, '{}'::jsonb) - 'website_error') || jsonb_build_object('website', now(), 'website_fields', applied),
    last_scraped_at = now(),
    -- Alleen "gecontroleerd" als de website deze keer ook echt iets over de plek zei
    verified_at = case when n_found > 0 then now() else t.verified_at end
  where t.id = p_id;
  update private.scrape_queue set done_at = now(), last_error = null where place_id = p_id;
end $function$;

create or replace function private.enqueue_stale_scrape(p_days integer default 30, p_limit integer default 10)
 returns integer
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare n int;
begin
  -- Derde poging gestart maar nooit afgerond (achtergrondtaak afgebroken): afsluiten als mislukt
  update private.scrape_queue
     set done_at = now(), last_error = coalesce(last_error, 'Afgebroken zonder resultaat')
   where done_at is null and attempts >= 3 and next_attempt_at < now() - interval '1 hour';

  insert into private.scrape_queue (place_id)
  select id from public.places
   where website is not null
     and (last_scraped_at is null or last_scraped_at < now() - make_interval(days => p_days))
     -- Niet wat al in de wachtrij staat of nu gelezen wordt (de hangende rijen zijn hierboven afgesloten)
     and not exists (select 1 from private.scrape_queue q where q.place_id = places.id and q.done_at is null)
   order by last_scraped_at nulls first
   limit p_limit
  on conflict (place_id) do update set done_at = null, attempts = 0, next_attempt_at = now(), last_error = null
   where private.scrape_queue.done_at is not null;
  get diagnostics n = row_count;
  return n;
end $function$;

update public.ingest_runs set status = 'error', finished_at = now(), stats = coalesce(stats, '{}'::jsonb) || '{"reden":"bleef hangen op running"}'::jsonb
 where status = 'running' and started_at < now() - interval '1 day';
