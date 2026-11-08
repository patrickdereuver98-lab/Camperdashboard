-- De snapshot neemt de nieuwe velden mee. jsonb_build_object kan maximaal 100 argumenten aan (de plek zit daar al op):
-- nieuwe velden in een tweede object.
CREATE OR REPLACE FUNCTION public.export_snapshot()
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
      'departureCheck', departure_check, 'departureCheckedAt', departure_checked_at, 'departureCheckedBy', departure_checked_by)
      || jsonb_build_object('checkinUntil', checkin_until, 'reservationRule', reservation_rule)) order by slug)
      from public.places where status = 'published'), '[]'::jsonb),
    'towns', (select jsonb_agg(jsonb_build_object('name', name, 'province', province, 'lat', lat, 'lng', lng) order by name) from public.nl_towns),
    'faq', (select jsonb_agg(jsonb_build_object('id', id, 'category', category, 'question', question, 'answer', answer, 'position', position) order by category, position) from public.faq where published),
    'reviews', coalesce((select jsonb_agg(jsonb_strip_nulls(jsonb_build_object('id', id, 'placeId', place_id, 'authorName', author_name, 'rating', rating,
      'scoreLocation', score_location, 'scoreQuiet', score_quiet, 'scoreFacilities', score_facilities, 'scoreValue', score_value,
      'title', title, 'body', body, 'vehicle', vehicle, 'visitedMonth', visited_month, 'createdAt', created_at))) from public.reviews where status = 'approved'), '[]'::jsonb)
  );
$function$;
