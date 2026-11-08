-- Live migratie 20261011074802 (apply_scrape_provenance), letterlijk uit supabase_migrations.schema_migrations.statements
-- (opgehaald 8 november 2026, review R5). Niet wijzigen: dit is de geschiedenis zoals live toegepast.

create or replace function public.apply_scrape(p_id uuid, p_data jsonb, p_error text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare
  p public.places;
  r public.places;
  prev jsonb;
  patch jsonb := '{}'::jsonb;
  applied jsonb := '[]'::jsonb;
  f text;
  old jsonb;
  -- Velden die de website mag invullen; prijs en seizoen van de eigen site gaan voor OSM
  fields text[] := array['price_eur','tourist_tax_included','power','water','dump_station','toilet','shower','wifi','dogs',
                         'capacity','max_length_m','open_all_year','season','reservation','phone','email','street','postcode',
                         'description','image_url'];
  priority text[] := array['price_eur','open_all_year','season'];
begin
  if p_error is not null then
    update private.scrape_queue set last_error = left(p_error, 500) where place_id = p_id;
    if (select attempts from private.scrape_queue where place_id = p_id) >= 3 then
      update private.scrape_queue set done_at = now() where place_id = p_id;
      update public.places set last_scraped_at = now() where id = p_id;
    end if;
    return;
  end if;

  select * into p from public.places where id = p_id for update;
  if not found then return; end if;
  prev := coalesce(p.sources->'website_fields', '[]'::jsonb);

  foreach f in array fields loop
    -- Handmatig in beheer ingevulde waarden blijven altijd staan
    continue when p.sources->>f = 'beheer';
    old := to_jsonb(p)->f;
    if p_data ? f then
      if f = any(priority) or old is null or old = 'null'::jsonb or prev ? f then
        patch := patch || jsonb_build_object(f, p_data->f);
        applied := applied || to_jsonb(f);
      end if;
    elsif prev ? f then
      -- De website noemt het niet meer: eerdere websitewaarde vervalt (nooit iets laten staan dat niet meer klopt)
      patch := patch || jsonb_build_object(f, null);
    end if;
  end loop;

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
    photos = case when p_data ? 'photos' then p_data->'photos' when prev ? 'image_url' and not (p_data ? 'image_url') then '[]'::jsonb else t.photos end,
    sources = t.sources || jsonb_build_object('website', now(), 'website_fields', applied),
    last_scraped_at = now(),
    verified_at = now()
  where t.id = p_id;
  update private.scrape_queue set done_at = now(), last_error = null where place_id = p_id;
end $$;

revoke all on function public.apply_scrape(uuid, jsonb, text) from public, anon, authenticated;
