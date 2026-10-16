-- Status: live toegepast op 2026-10-12.
-- Fase 4: community-moderatie.
--   1. Trust-score: foto's van gebruikers met een bewezen geschiedenis gaan automatisch online.
--   2. Dubbele plekken (OSM en inzendingen op dezelfde plek) vinden en samenvoegen vanuit beheer.

-- ── 1. Trust-score ─────────────────────────────────────────────────────────

insert into public.site_settings (key, value)
values ('trust', '{"auto_approve_min_approved": 3, "min_account_age_days": 1}'::jsonb)
on conflict (key) do nothing;

-- Goedgekeurd telt +1, afgewezen telt -3. Vertrouwd = genoeg goedgekeurd, nooit iets afgewezen, account oud genoeg.
create or replace function private.user_trust(p_user uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  with cfg as (
    select coalesce((value->>'auto_approve_min_approved')::int, 3) as min_ok,
           coalesce((value->>'min_account_age_days')::int, 1) as min_age
    from (select (select value from public.site_settings where key = 'trust') as value) s
  ), stats as (
    select count(*) filter (where status = 'approved')::int as approved,
           count(*) filter (where status = 'rejected')::int as rejected,
           count(*) filter (where status = 'pending')::int as pending
    from public.place_photos where user_id = p_user
  ), acct as (select created_at from auth.users where id = p_user)
  select jsonb_build_object(
    'approved', s.approved, 'rejected', s.rejected, 'pending', s.pending,
    'score', s.approved - 3 * s.rejected,
    'trusted', p_user is not null and s.approved >= c.min_ok and s.rejected = 0
               and coalesce((select created_at from acct) < now() - make_interval(days => c.min_age), false))
  from stats s, cfg c;
$$;

-- Eigen trust-score of (beheer) die van een ander
create or replace function public.user_trust(p_user uuid default null)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare u uuid := coalesce(p_user, auth.uid());
begin
  if u is null then raise exception 'Niet ingelogd'; end if;
  if u <> auth.uid() and not public.is_admin() then raise exception 'Geen toegang'; end if;
  return private.user_trust(u);
end $$;
revoke all on function public.user_trust(uuid) from public, anon;
grant execute on function public.user_trust(uuid) to authenticated;

-- Na het insturen: vertrouwde gebruiker → meteen goedkeuren (de status-trigger zet de foto dan op de plek)
create or replace function private.auto_approve_photo()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if (private.user_trust(new.user_id)->>'trusted')::boolean then
    update public.place_photos set status = 'approved' where id = new.id;
  end if;
  return null;
end $$;
create trigger place_photos_auto_approve after insert on public.place_photos
  for each row execute function private.auto_approve_photo();

-- reviewed_by alleen invullen bij een beheerder (niet bij automatische goedkeuring)
create or replace function private.sync_place_photo()
returns trigger language plpgsql security definer set search_path = '' as $$
declare url text := 'https://qkrmthrhwmmmwswmfgwc.supabase.co/storage/v1/object/public/place-photos/' || new.storage_path;
begin
  if new.status = 'approved' and old.status is distinct from 'approved' then
    update public.places
    set photos = coalesce(photos, '[]'::jsonb) || jsonb_build_array(jsonb_strip_nulls(jsonb_build_object(
          'url', url, 'credit', coalesce(new.credit, 'Bezoeker van VrijStaan'), 'caption', new.caption, 'user', true)))
    where id = new.place_id and not coalesce(photos, '[]'::jsonb) @> jsonb_build_array(jsonb_build_object('url', url));
  elsif new.status <> 'approved' and old.status = 'approved' then
    update public.places
    set photos = (select coalesce(jsonb_agg(p), '[]'::jsonb) from jsonb_array_elements(photos) p where p->>'url' <> url)
    where id = new.place_id;
  end if;
  if new.status <> old.status then
    new.reviewed_at := now();
    new.reviewed_by := case when public.is_admin() then auth.uid() end;
  end if;
  return new;
end $$;

-- ── 2. Dubbele plekken ─────────────────────────────────────────────────────

alter table public.places add column if not exists merged_into uuid references public.places (id) on delete set null;
create index if not exists places_merged_into_idx on public.places (merged_into) where merged_into is not null;

-- "Geen dubbel": paren die beheer al heeft bekeken
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

-- Kandidaten: twee niet-samengevoegde plekken binnen p_meters van elkaar (afstand over de aarde)
create or replace function public.admin_duplicate_candidates(p_meters int default 150, p_limit int default 300)
returns table (
  a_id uuid, a_slug text, a_name text, a_status text, a_lat float8, a_lng float8, a_osm boolean, a_completeness numeric,
  b_id uuid, b_slug text, b_name text, b_status text, b_lat float8, b_lng float8, b_osm boolean, b_completeness numeric,
  distance_m int, name_similarity real
) language plpgsql stable security definer set search_path = '' as $$
declare deg float8 := greatest(10, least(p_meters, 2000)) / 60000.0; -- ruime voorselectie in graden
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

-- Samenvoegen: p_remove gaat op in p_keep. Lege velden van p_keep worden aangevuld, foto's, reviews, foto-inzendingen,
-- tickets en inzendingen verhuizen, p_remove gaat offline (hidden + vergrendeld) en verwijst door naar p_keep.
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
  -- Eerdere samenvoegingen naar r wijzen voortaan naar k (geen doorverwijzing via een verborgen plek)
  update public.places set merged_into = k.id where merged_into = r.id;
  update public.places set status = 'hidden', status_locked = true, merged_into = k.id where id = r.id;

  return jsonb_build_object('keep', k.slug, 'removed', r.slug);
end $$;
revoke all on function public.admin_merge_places(uuid, uuid) from public, anon;
grant execute on function public.admin_merge_places(uuid, uuid) to authenticated;

-- Oude link van een samengevoegde plek → slug van de plek die bleef (alleen als die online staat)
create or replace function public.place_redirect(p_slug text)
returns text language sql stable security definer set search_path = '' as $$
  select k.slug from public.places r join public.places k on k.id = r.merged_into
  where r.slug = p_slug and k.status = 'published';
$$;
grant execute on function public.place_redirect(text) to anon, authenticated;

-- Volledige ruimtelijke index (ook concepten), zodat de dubbelen-zoektocht < 0,1 s duurt
create index if not exists places_geom_all_gist on public.places using gist (geom);
