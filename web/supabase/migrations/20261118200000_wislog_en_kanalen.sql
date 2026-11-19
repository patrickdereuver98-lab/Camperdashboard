-- Review 16 november 2026, R62 en R64: zien wat de dataketen doet.
-- 1. private.field_log: apply_scrape legt elke wijziging van een kernfeit vast (prijs, toeslagen, vertrekregel, tijd,
--    bronzin, seizoen, jaarrond) met oude en nieuwe waarde en de parser. Nodig vóór de grote herlezing (R58): een
--    parserwissel mag velden wissen, en tot nu toe zag niemand welke. Bewaard 180 dagen (cron veldlog-opschonen).
-- 2. public.health() per kanaal: laatste lezing van de gewone lezer en van de stealth-lezer, open werk en het oudste
--    item per wachtrij, en kernvelden gewist of gewijzigd in 24 uur. last_scrape bleef het maximum over alle kanalen,
--    waardoor de stealth-lezer van 9 tot 16 november stil lag zonder alarm.
-- Basis apply_scrape: 20261118100000_beheerslot (R61); alleen het insert-blok vóór de update is nieuw.

create table if not exists private.field_log (
  id bigint generated always as identity primary key,
  place_id uuid not null,
  field text not null,
  old_value jsonb,
  new_value jsonb,
  parser text,
  at timestamptz not null default now()
);
create index if not exists field_log_at on private.field_log (at);
create index if not exists field_log_place on private.field_log (place_id, at desc);
alter table private.field_log enable row level security;
revoke all on private.field_log from public, anon, authenticated;

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

  -- R62: elke wijziging van een kernfeit in het veldlog, met oude en nieuwe waarde en de parser. Zo is te zien wat een
  -- run wiste of veranderde, en is het per veld terug te zetten.
  insert into private.field_log (place_id, field, old_value, new_value, parser)
  select p.id, e.key, to_jsonb(p)->e.key, e.value, p_data->>'_parser'
    from jsonb_each(patch) e
   where e.key = any(core || array['times_note', 'price_extras'])
     and e.value is distinct from coalesce(to_jsonb(p)->e.key, 'null'::jsonb);

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

create or replace function public.health() returns jsonb
 language sql stable security definer set search_path to ''
as $$
  select jsonb_build_object(
    'ts', now(),
    'published', p.published,
    'with_departure', p.with_departure,
    'with_price', p.with_price,
    'last_scrape', p.last_scrape,
    'net_calls_24h', n.total,
    'net_failed_24h', n.failed,
    'app_errors_24h', (select count(*) from public.app_logs where level = 'error' and ts > now() - interval '24 hours'),
    'db_bytes', pg_database_size(current_database()),
    -- R64: per kanaal
    'web_last', (select max(done_at) from private.scrape_queue where last_error is null),
    'stealth_last', (select max(done_at) from private.stealth_queue where last_error is null),
    'scrape_open', (select count(*) from private.scrape_queue where done_at is null),
    'stealth_open', (select count(*) from private.stealth_queue where done_at is null),
    'stealth_oldest_open', (select min(created_at) from private.stealth_queue where done_at is null),
    'core_changed_24h', (select count(*) from private.field_log where at > now() - interval '24 hours'),
    'core_wiped_24h', (select count(*) from private.field_log
                        where at > now() - interval '24 hours' and (new_value is null or new_value = 'null'::jsonb)
                          and old_value is not null and old_value <> 'null'::jsonb)
  )
  from (select count(*) filter (where status = 'published') as published,
               count(*) filter (where status = 'published' and departure is not null) as with_departure,
               count(*) filter (where status = 'published' and price_eur is not null) as with_price,
               max(last_scraped_at) as last_scrape
          from public.places) p,
       (select count(*) as total,
               count(*) filter (where r.timed_out or r.error_msg is not null or r.status_code >= 500) as failed
          from net._http_response r
         where r.created > now() - interval '24 hours'
           and not exists (select 1 from public.admin_logs l where l.kind = 'api' and l.request_id = r.id)) n;
$$;
revoke all on function public.health() from public;
grant execute on function public.health() to anon, authenticated, service_role;

-- Veldlog 180 dagen bewaren (dagelijks, buiten de drukke uren)
select cron.schedule('veldlog-opschonen', '29 3 * * *', $$delete from private.field_log where at < now() - interval '180 days'$$);
