-- Live migratie 20261012061508 (moderation_duplicates), letterlijk uit supabase_migrations.schema_migrations.statements
-- (opgehaald 8 november 2026, review R5). Niet wijzigen: dit is de geschiedenis zoals live toegepast.

alter table public.places add column if not exists merged_into uuid references public.places (id) on delete set null;
create index if not exists places_merged_into_idx on public.places (merged_into) where merged_into is not null;

create table if not exists public.duplicate_dismissals (
  a uuid not null references public.places (id) on delete cascade,
  b uuid not null references public.places (id) on delete cascade,
  dismissed_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (a, b),
  check (a < b)
);
alter table public.duplicate_dismissals enable row level security;
create policy "beheer dubbelen" on public.duplicate_dismissals for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
revoke all on public.duplicate_dismissals from anon;
grant select, insert on public.duplicate_dismissals to authenticated;

create or replace function public.admin_duplicate_candidates(p_meters int default 150, p_limit int default 300)
returns table (
  a_id uuid, a_slug text, a_name text, a_status text, a_lat float8, a_lng float8, a_osm boolean, a_completeness numeric,
  b_id uuid, b_slug text, b_name text, b_status text, b_lat float8, b_lng float8, b_osm boolean, b_completeness numeric,
  distance_m int, name_similarity real
) language plpgsql stable security definer set search_path = '' as $$
declare deg float8 := greatest(10, least(p_meters, 2000)) / 60000.0;
begin
  if not public.is_admin() then raise exception 'Geen toegang'; end if;
  return query
  select a.id, a.slug, a.name, a.status, a.lat, a.lng, a.osm_id is not null, a.completeness::numeric,
         b.id, b.slug, b.name, b.status, b.lat, b.lng, b.osm_id is not null, b.completeness::numeric,
         round(extensions.st_distance(a.geom::extensions.geography, b.geom::extensions.geography))::int,
         extensions.similarity(a.name, b.name)
  from public.places a
  join public.places b
    on a.id < b.id
   and b.geom operator(extensions.&&) extensions.st_expand(a.geom, deg)
  where a.merged_into is null and b.merged_into is null
    and a.status <> 'hidden' and b.status <> 'hidden'
    and extensions.st_dwithin(a.geom::extensions.geography, b.geom::extensions.geography, p_meters)
    and not exists (select 1 from public.duplicate_dismissals d where d.a = a.id and d.b = b.id)
  order by 17 asc, 18 desc
  limit greatest(1, least(p_limit, 1000));
end $$;
revoke all on function public.admin_duplicate_candidates(int, int) from public, anon;
grant execute on function public.admin_duplicate_candidates(int, int) to authenticated;

create or replace function public.admin_merge_places(p_keep uuid, p_remove uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare k public.places; r public.places;
begin
  if not public.is_admin() then raise exception 'Geen toegang'; end if;
  if p_keep = p_remove then raise exception 'Kies twee verschillende plekken'; end if;
  select * into k from public.places where id = p_keep for update;
  select * into r from public.places where id = p_remove for update;
  if k.id is null or r.id is null then raise exception 'Plek niet gevonden'; end if;
  if k.merged_into is not null then raise exception 'De plek die je bewaart is zelf al samengevoegd'; end if;
  if r.merged_into is not null then raise exception 'Deze plek is al samengevoegd'; end if;

  update public.places p set
    street = coalesce(k.street, r.street), postcode = coalesce(k.postcode, r.postcode),
    description = coalesce(k.description, r.description), description_source = coalesce(k.description_source, r.description_source),
    price_eur = coalesce(k.price_eur, r.price_eur), price_note = coalesce(k.price_note, r.price_note),
    tourist_tax_included = coalesce(k.tourist_tax_included, r.tourist_tax_included),
    power = coalesce(k.power, r.power), water = coalesce(k.water, r.water), dump_station = coalesce(k.dump_station, r.dump_station),
    toilet = coalesce(k.toilet, r.toilet), shower = coalesce(k.shower, r.shower), wifi = coalesce(k.wifi, r.wifi),
    dogs = coalesce(k.dogs, r.dogs), capacity = coalesce(k.capacity, r.capacity), max_length_m = coalesce(k.max_length_m, r.max_length_m),
    surface = coalesce(k.surface, r.surface), open_all_year = coalesce(k.open_all_year, r.open_all_year),
    season = coalesce(k.season, r.season), reservation = coalesce(k.reservation, r.reservation),
    max_stay_nights = coalesce(k.max_stay_nights, r.max_stay_nights),
    website = coalesce(k.website, r.website), phone = coalesce(k.phone, r.phone), email = coalesce(k.email, r.email),
    image_url = coalesce(k.image_url, r.image_url), image_credit = case when k.image_url is null then r.image_credit else k.image_credit end,
    photos = coalesce(k.photos, '[]'::jsonb) || coalesce((
      select jsonb_agg(ph) from jsonb_array_elements(coalesce(r.photos, '[]'::jsonb)) ph
      where not coalesce(k.photos, '[]'::jsonb) @> jsonb_build_array(jsonb_build_object('url', ph->>'url'))), '[]'::jsonb),
    departure = coalesce(k.departure, r.departure), checkout_until = coalesce(k.checkout_until, r.checkout_until),
    checkin_from = coalesce(k.checkin_from, r.checkin_from), access_hours = coalesce(k.access_hours, r.access_hours),
    access_24h = coalesce(k.access_24h, r.access_24h), times_note = coalesce(k.times_note, r.times_note),
    price_extras = coalesce(k.price_extras, r.price_extras),
    sources = coalesce(k.sources, '{}'::jsonb) || jsonb_build_object('merged', coalesce(k.sources->'merged', '[]'::jsonb) || to_jsonb(r.slug))
  where p.id = k.id;

  update public.reviews set place_id = k.id where place_id = r.id;
  update public.place_photos set place_id = k.id where place_id = r.id;
  update public.tickets set place_id = k.id where place_id = r.id;
  update public.submissions set place_id = k.id where place_id = r.id;
  update public.places set merged_into = k.id where merged_into = r.id;
  update public.places set status = 'hidden', status_locked = true, merged_into = k.id where id = r.id;

  return jsonb_build_object('keep', k.slug, 'removed', r.slug);
end $$;
revoke all on function public.admin_merge_places(uuid, uuid) from public, anon;
grant execute on function public.admin_merge_places(uuid, uuid) to authenticated;

create or replace function public.place_redirect(p_slug text)
returns text language sql stable security definer set search_path = '' as $$
  select k.slug from public.places r join public.places k on k.id = r.merged_into
  where r.slug = p_slug and k.status = 'published';
$$;
grant execute on function public.place_redirect(text) to anon, authenticated;
