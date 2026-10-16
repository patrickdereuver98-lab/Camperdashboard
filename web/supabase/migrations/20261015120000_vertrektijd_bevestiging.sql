-- Kernbelofte: een plek staat pas op "Zonder vertrektijd" als een mens het heeft bevestigd.
--
-- De pipeline vindt kandidaten (een letterlijke zin op de eigen website, in times_note). Beheer controleert de bron,
-- of de eigenaar bevestigt het. Verandert de vertrekregel of de bronzin daarna, of is de bevestiging ouder dan een jaar,
-- dan vervalt ze en staat de plek weer in de controlelijst. Alleen toevoegingen: bestaande kolommen blijven gelijk.

alter table public.places
  add column if not exists departure_check text
    constraint places_departure_check_check check (departure_check in ('bevestigd', 'voorwaardelijk', 'afgewezen')),
  add column if not exists departure_checked_at timestamptz,
  add column if not exists departure_checked_by text
    constraint places_departure_checked_by_check check (departure_checked_by in ('beheer', 'eigenaar'));

comment on column public.places.departure_check is
  'Menselijke controle van de vertrekregel: bevestigd (op Zonder vertrektijd), voorwaardelijk (bv. "bij drukte vóór 13:00", niet op de kernpagina), afgewezen (bron zegt het niet).';

-- Bevestiging vervalt als de vertrekregel of de bronzin verandert, tenzij dezelfde update de controle zelf zet.
create or replace function private.places_before_write()
 returns trigger
 language plpgsql
 set search_path to ''
as $function$
declare t numeric := coalesce((select (value #>> '{}')::numeric from public.site_settings where key = 'publish_threshold'), 0.7);
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
end $function$;

-- Controle vastleggen vanuit beheer. Alleen beheerders; "eigenaar" als de eigenaar het zelf bevestigde (mail, telefoon).
create or replace function public.check_departure(p_id uuid, p_check text, p_by text default 'beheer')
 returns void
 language plpgsql
 security definer
 set search_path to ''
as $function$
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
end $function$;

revoke all on function public.check_departure(uuid, text, text) from public, anon;
grant execute on function public.check_departure(uuid, text, text) to authenticated;

-- Een bevestiging is een jaar geldig: daarna terug in de controlelijst (elke nacht).
select cron.schedule('departure-recheck', '41 3 * * *', $$
  update public.places set departure_check = null, departure_checked_at = null, departure_checked_by = null
  where departure_check is not null and departure_checked_at < now() - interval '1 year'
$$);

-- De snapshot (offline build en terugval) krijgt de vertrekgegevens en de controle mee.
create or replace function public.export_snapshot()
 returns jsonb
 language sql
 stable security definer
 set search_path to ''
as $function$
  select jsonb_build_object(
    'places', coalesce((select jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
      'id', id, 'slug', slug, 'name', name, 'kind', kind, 'lat', lat, 'lng', lng, 'street', street, 'postcode', postcode,
      'town', town, 'province', province, 'description', description, 'descriptionSource', description_source,
      'priceEur', price_eur, 'priceNote', price_note, 'touristTaxIncluded', tourist_tax_included, 'power', power,
      'water', water, 'dumpStation', dump_station, 'toilet', toilet, 'shower', shower, 'wifi', wifi, 'dogs', dogs,
      'capacity', capacity, 'maxLengthM', max_length_m, 'surface', surface, 'openAllYear', open_all_year, 'season', season,
      'reservation', reservation, 'maxStayNights', max_stay_nights, 'website', website, 'phone', phone, 'email', email,
      'imageUrl', image_url, 'imageCredit', image_credit, 'photos', photos, 'ratingAvg', rating_avg, 'ratingCount', rating_count,
      'completeness', completeness, 'verifiedAt', verified_at, 'updatedAt', updated_at,
      'departure', departure, 'checkoutUntil', checkout_until, 'checkinFrom', checkin_from, 'accessHours', access_hours,
      'access24h', access_24h, 'timesNote', times_note, 'priceExtras', price_extras,
      'departureCheck', departure_check, 'departureCheckedAt', departure_checked_at, 'departureCheckedBy', departure_checked_by)) order by slug)
      from public.places where status = 'published'), '[]'::jsonb),
    'towns', (select jsonb_agg(jsonb_build_object('name', name, 'province', province, 'lat', lat, 'lng', lng) order by name) from public.nl_towns),
    'faq', (select jsonb_agg(jsonb_build_object('id', id, 'category', category, 'question', question, 'answer', answer, 'position', position) order by category, position) from public.faq where published),
    'reviews', coalesce((select jsonb_agg(jsonb_strip_nulls(jsonb_build_object('id', id, 'placeId', place_id, 'authorName', author_name, 'rating', rating,
      'scoreLocation', score_location, 'scoreQuiet', score_quiet, 'scoreFacilities', score_facilities, 'scoreValue', score_value,
      'title', title, 'body', body, 'vehicle', vehicle, 'visitedMonth', visited_month, 'createdAt', created_at))) from public.reviews where status = 'approved'), '[]'::jsonb)
  );
$function$;
