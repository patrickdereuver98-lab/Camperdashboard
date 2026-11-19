-- Geschiedenis per plek per veld (vraag Patrick, 18 november 2026).
--
-- Tot nu toe legde de trigger places_audit alleen wijzigingen van een ingelogde beheerder vast, en alleen de nieuwe
-- waarde. Wat de pipeline (OSM, website, PDOK, ontdekken) aan een plek veranderde, stond nergens. Een fout van een
-- scraper (vertrektijd gewist, prijs overschreven) was zo niet te zien en niet terug te zetten.
--
-- Nu:
--   * public.place_history: per gewijzigd kernveld één rij met oude en nieuwe waarde, bron en (bij beheer) wie;
--   * trigger place_history op places (na elke update, voor elke schrijver, ook de pipeline);
--   * bron: vrijstaan.bron (als een functie die zet) > beheerder ingelogd > welk deel van `sources` in dezelfde
--     update veranderde (website, stealth, pdok, osm, discovery, merged) > service_role ('pipeline') > 'systeem';
--   * public.admin_revert_place_change(id): beheer zet één wijziging terug, alleen als het veld sindsdien niet
--     opnieuw veranderde. Het veld krijgt het merkteken van beheer, zodat de pipeline het niet opnieuw overschrijft;
--   * bewaartermijn 24 maanden (cron plekgeschiedenis-opschonen, 03:29).
-- Alleen toevoegingen; places_audit en audit_log blijven zoals ze zijn.
--
-- Uitrollen: na het samenvoegen van de beheerpagina (admin/plekken/page.tsx). De oude pagina werkt ook zonder.

create table if not exists public.place_history (
  id bigint generated always as identity primary key,
  ts timestamptz not null default now(),
  place_id uuid not null references public.places (id) on delete cascade,
  field text not null check (length(field) between 1 and 64),
  old_value jsonb,
  new_value jsonb,
  source text not null check (source in
    ('beheer', 'osm', 'website', 'pdok', 'ontdekken', 'samenvoegen', 'eigenaar', 'doe-mee', 'pipeline', 'systeem')),
  actor uuid,
  actor_email text,
  revert_of bigint references public.place_history (id) on delete set null
);
comment on table public.place_history is
  'Geschiedenis per plek per kernveld: oude en nieuwe waarde, bron en (bij beheer) wie. 24 maanden bewaard.';
create index if not exists place_history_place_ts on public.place_history (place_id, ts desc);
create index if not exists place_history_ts on public.place_history (ts);

alter table public.place_history enable row level security;
revoke all on public.place_history from public, anon, authenticated;
grant select on public.place_history to authenticated;
drop policy if exists "beheer leest plekgeschiedenis" on public.place_history;
create policy "beheer leest plekgeschiedenis" on public.place_history for select to authenticated
  using ((select public.is_admin() as is_admin));

-- Velden die we volgen: wat een bezoeker ziet of waar de publicatie van afhangt. Niet: tijdstempels, completeness,
-- sources, foto's, beoordelingen, geom (volgt uit lat/lng) en slug.
create or replace function private.place_history_fields() returns text[]
 language sql immutable set search_path to ''
as $$
  select array[
    'name', 'kind', 'operator', 'status', 'merged_into',
    'lat', 'lng', 'street', 'postcode', 'town', 'province',
    'description',
    'price_eur', 'price_note', 'price_extras', 'tourist_tax_included',
    'power', 'power_note', 'water', 'dump_station', 'toilet', 'shower', 'wifi', 'dogs',
    'capacity', 'max_length_m', 'surface', 'open_all_year', 'season',
    'reservation', 'reservation_rule', 'max_stay_nights',
    'departure', 'checkout_until', 'checkin_from', 'checkin_until', 'access_hours', 'access_24h', 'times_note',
    'website', 'phone', 'email'
  ]::text[]
$$;

create or replace function private.place_history_log() returns trigger
 language plpgsql security definer set search_path to ''
as $$
declare
  o jsonb := to_jsonb(old);
  n jsonb := to_jsonb(new);
  uid uuid := (select auth.uid());
  v_email text;
  v_source text := nullif(current_setting('vrijstaan.bron', true), '');
  v_revert bigint := nullif(current_setting('vrijstaan.revert_of', true), '')::bigint;
  v_role text;
  k text;
begin
  if v_source is not null and v_source not in
     ('beheer', 'osm', 'website', 'pdok', 'ontdekken', 'samenvoegen', 'eigenaar', 'doe-mee', 'pipeline', 'systeem') then
    v_source := null;
  end if;

  if uid is not null then
    select email into v_email from public.admins where user_id = uid;
    if found then
      v_source := coalesce(v_source, 'beheer');
    else
      uid := null;  -- geen beheerder: geen id van een bezoeker bewaren
    end if;
  end if;

  if v_source is null then
    -- Welk deel van de herkomst veranderde in dezelfde update?
    foreach k in array array['website', 'stealth', 'pdok', 'osm', 'discovery', 'merged'] loop
      if (o -> 'sources' -> k) is distinct from (n -> 'sources' -> k) then
        v_source := case k when 'stealth' then 'website' when 'discovery' then 'ontdekken'
                           when 'merged' then 'samenvoegen' else k end;
        exit;
      end if;
    end loop;
  end if;

  if v_source is null then
    v_role := coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role',
                       nullif(current_setting('request.jwt.claim.role', true), ''));
    v_source := case when v_role = 'service_role' then 'pipeline' else 'systeem' end;
  end if;

  insert into public.place_history (place_id, field, old_value, new_value, source, actor, actor_email, revert_of)
  select new.id, f, o -> f, n -> f, v_source, uid, v_email, v_revert
    from unnest(private.place_history_fields()) f
   where (o -> f) is distinct from (n -> f)
     -- Coördinaten: verschuivingen kleiner dan ongeveer een meter zijn ruis
     and not (f in ('lat', 'lng')
              and round((o ->> f)::numeric, 5) is not distinct from round((n ->> f)::numeric, 5));
  return null;
end $$;

drop trigger if exists place_history on public.places;
create trigger place_history after update on public.places
  for each row when (old.* is distinct from new.*) execute function private.place_history_log();

-- Eén wijziging terugzetten
create or replace function public.admin_revert_place_change(p_id bigint) returns jsonb
 language plpgsql security definer set search_path to ''
as $$
declare
  h public.place_history;
  v_now jsonb;
begin
  if not public.is_admin() then raise exception 'Geen toegang' using errcode = '42501'; end if;
  select * into h from public.place_history where id = p_id;
  if not found then raise exception 'Onbekende wijziging'; end if;
  if not (h.field = any (private.place_history_fields())) then
    raise exception 'Dit veld kan niet worden teruggezet' using errcode = '22023';
  end if;

  select to_jsonb(p) -> h.field into v_now from public.places p where p.id = h.place_id for update;
  if not found then raise exception 'Onbekende plek'; end if;
  if v_now is distinct from h.new_value then
    raise exception 'Dit veld is sindsdien weer veranderd. Zet eerst de nieuwere wijziging terug.' using errcode = '22023';
  end if;

  perform set_config('vrijstaan.revert_of', h.id::text, true);
  if h.field <> 'status' then perform public.admin_mark_beheer(h.place_id, array[h.field]); end if;
  execute format('update public.places p set %1$I = r.%1$I%2$s from jsonb_populate_record(null::public.places, $1) r where p.id = $2',
                 h.field, case when h.field = 'status' then ', status_locked = true' else '' end)
    using jsonb_build_object(h.field, h.old_value), h.place_id;
  perform set_config('vrijstaan.revert_of', '', true);

  return jsonb_build_object('id', h.id, 'place_id', h.place_id, 'field', h.field, 'value', h.old_value);
end $$;
revoke all on function public.admin_revert_place_change(bigint) from public, anon;
grant execute on function public.admin_revert_place_change(bigint) to authenticated;

-- Bewaartermijn: 24 maanden
create or replace function private.place_history_prune() returns integer
 language plpgsql security definer set search_path to ''
as $$
declare v integer;
begin
  delete from public.place_history where ts < now() - interval '24 months';
  get diagnostics v = row_count;
  return v;
end $$;
revoke all on function private.place_history_prune() from public;

do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'cron') then
    if exists (select 1 from cron.job where jobname = 'plekgeschiedenis-opschonen') then
      perform cron.unschedule('plekgeschiedenis-opschonen');
    end if;
    perform cron.schedule('plekgeschiedenis-opschonen', '29 3 * * *', 'select private.place_history_prune()');
  end if;
end $$;
