-- Google aanvullen en kandidaten (README 141, opdracht Patrick 22 november 2026): wat Google weet wordt een voorstel in de
-- Triage Inbox (bron 'google-api') en nieuwe plekken worden kandidaten voor Beheer (bron 'google'). Niets gaat zonder
-- controle in places: een plek alleen bij Google heeft nog een tweede bron nodig (bronnenbeleid §2).
alter table public.updates_queue drop constraint if exists updates_queue_source_check;
alter table public.updates_queue add constraint updates_queue_source_check check (
  source = any (array['doe-mee', 'plekpuls', 'beheer', 'pipeline', 'eigenaar', 'mail (onbevestigd)', 'ai-lezer', 'google-review', 'google-api']));

alter table public.discovery_candidates drop constraint if exists discovery_candidates_source_check;
alter table public.discovery_candidates add constraint discovery_candidates_source_check
  check (source = any (array['officielebekendmakingen', 'google']));

-- Voorstellen uit de API-velden: alleen als wij het niet weten (leeg) of, bij honden, als Google iets anders zegt.
create or replace function public.google_aanvullen(p_dry_run boolean default true, p_limit integer default 5000)
 returns jsonb
 language plpgsql security definer set search_path to ''
as $$
declare
  r record;
  pr record;
  v jsonb;
  cur jsonb;
  n integer := 0;
  per_veld jsonb := '{}';
  v_reading uuid := gen_random_uuid();
begin
  for r in
    select p.id, to_jsonb(p) as cur, d.details
      from private.place_google_details d
      join public.places p on p.id = d.place_id
     where p.merged_into is null and p.status <> 'hidden'
     order by d.fetched_at desc
     limit greatest(1, least(coalesce(p_limit, 5000), 20000))
  loop
    cur := r.cur;
    for pr in
      select * from (values
        ('website', case when r.details ->> 'websiteUri' ~ '^https?://' then to_jsonb(left(r.details ->> 'websiteUri', 300)) end, 'leeg'),
        ('phone', case when length(coalesce(r.details ->> 'nationalPhoneNumber', '')) between 6 and 30 then to_jsonb(r.details ->> 'nationalPhoneNumber') end, 'leeg'),
        ('dogs', case when r.details ? 'allowsDogs' and jsonb_typeof(r.details -> 'allowsDogs') = 'boolean' then r.details -> 'allowsDogs' end, 'anders'),
        ('toilet', case when r.details ? 'restroom' and jsonb_typeof(r.details -> 'restroom') = 'boolean' then r.details -> 'restroom' end, 'leeg')
      ) as t(veld, waarde, regel)
    loop
      v := pr.waarde;
      continue when v is null;
      continue when cur -> pr.veld = v;
      -- 'leeg': alleen als wij het niet weten; 'anders': ook als Google iets anders zegt (Beheer kijkt)
      continue when pr.regel = 'leeg' and cur -> pr.veld is not null and cur -> pr.veld <> 'null'::jsonb;
      continue when exists (
        select 1 from public.updates_queue q
         where q.place_id = r.id and q.field_changed = pr.veld and q.new_value = v
           and (q.status = 'pending' or (q.source = 'google-api' and q.status = 'rejected')));
      n := n + 1;
      per_veld := jsonb_set(per_veld, array[pr.veld], to_jsonb(coalesce((per_veld ->> pr.veld)::int, 0) + 1));
      if not p_dry_run then
        insert into public.updates_queue (place_id, field_changed, old_value, new_value, source, quote, source_url, reading_id)
        values (r.id, pr.veld, cur -> pr.veld, v, 'google-api',
                left('Google Maps: ' || case pr.veld when 'website' then 'website' when 'phone' then 'telefoon' when 'dogs' then 'honden toegestaan' else 'toilet' end
                     || ' = ' || (v #>> '{}'), 500),
                case when r.details ->> 'googleMapsUri' ~ '^https://' then left(r.details ->> 'googleMapsUri', 500) end, v_reading);
      end if;
    end loop;
  end loop;
  return jsonb_build_object('dry_run', p_dry_run, 'voorstellen', n, 'per_veld', per_veld);
end $$;
revoke all on function public.google_aanvullen(boolean, integer) from public, anon, authenticated;
grant execute on function public.google_aanvullen(boolean, integer) to service_role;

-- Nieuwe plekken van Google als kandidaten voor Beheer: kampeertype, in bedrijf, wij kennen ze niet.
create or replace function public.google_kandidaten(p_dry_run boolean default true)
 returns jsonb
 language plpgsql security definer set search_path to ''
as $$
declare
  n integer;
  n_site integer;
begin
  select count(*), count(*) filter (where coalesce(g.website, '') ~ '^https://' or coalesce(g.website, '') ~ '^http://')
    into n, n_site
    from private.google_found g
   where g.matched_place_id is null and g.business_status is not distinct from 'OPERATIONAL'
     and g.primary_type in ('campground', 'rv_park', 'camping_cabin')
     and g.lat between 50.7 and 53.7 and g.lng between 3.2 and 7.3
     and not exists (select 1 from public.discovery_candidates c where c.source = 'google' and c.external_id = g.google_place_id);
  if not p_dry_run then
    insert into public.discovery_candidates (source, external_id, title, url, doc_type, street, postcode, town, lat, lng, nearest_place_id, nearest_m, status)
    select 'google', g.google_place_id, left(coalesce(g.name, 'Naamloos'), 600),
           -- https is verplicht in dit veld: een http-site wordt https (de site zelf wordt later gecontroleerd), anders de kaartlink
           case when coalesce(g.website, '') ~ '^https?://' then regexp_replace(g.website, '^http://', 'https://')
                else 'https://www.google.com/maps/place/?q=place_id:' || g.google_place_id end,
           g.primary_type,
           nullif(split_part(coalesce(g.address, ''), ',', 1), ''),
           substring(coalesce(g.address, '') from '\d{4}\s?[A-Z]{2}'),
           nullif(trim(regexp_replace(split_part(coalesce(g.address, ''), ',', 2), '^\s*\d{4}\s?[A-Z]{2}\s*', '')), ''),
           g.lat, g.lng, near.id, near.m, 'nieuw'
      from private.google_found g
      left join lateral (
        select p.id, round(6371000 * 2 * asin(sqrt(power(sin(radians(p.lat - g.lat) / 2), 2)
               + cos(radians(g.lat)) * cos(radians(p.lat)) * power(sin(radians(p.lng - g.lng) / 2), 2))))::integer as m
          from public.places p where p.merged_into is null
         order by (p.lat - g.lat) ^ 2 + (p.lng - g.lng) ^ 2 limit 1) near on true
     where g.matched_place_id is null and g.business_status is not distinct from 'OPERATIONAL'
       and g.primary_type in ('campground', 'rv_park', 'camping_cabin')
       and g.lat between 50.7 and 53.7 and g.lng between 3.2 and 7.3
     on conflict (source, external_id) do nothing;
  end if;
  return jsonb_build_object('dry_run', p_dry_run, 'kandidaten', n, 'met_website', n_site);
end $$;
revoke all on function public.google_kandidaten(boolean) from public, anon, authenticated;
grant execute on function public.google_kandidaten(boolean) to service_role;
