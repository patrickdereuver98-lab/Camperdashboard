-- Google-kandidaten met website worden concepten die de scraper en de AI-lezer kunnen lezen (README 141, opdracht Patrick
-- 22 november 2026). Elke nieuwe plek staat op 'draft' met status_locked: ook als de scraper alle kernvelden vindt, blijft ze
-- verborgen tot Beheer ze vrijgeeft (bronnenbeleid §2: een plek alleen bij Google heeft een tweede bron nodig, hier de eigen
-- website van de plek). Geen website, geen plek. Camping_cabin (hutten) blijft kandidaat.
create or replace function public.google_kandidaten_naar_plekken(p_dry_run boolean default true, p_limit integer default 50)
 returns jsonb
 language plpgsql security definer set search_path to ''
as $$
declare
  c record;
  v_host text; v_kind text; v_town text; v_province text; v_slug text; base text; n int;
  new_id uuid;
  gemaakt int := 0; bekend int := 0; overgeslagen int := 0;
  redenen jsonb := '{}';
  voorbeelden jsonb := '[]';
  ids uuid[] := '{}';
  bezwaar text;
begin
  for c in
    select d.id, d.external_id, d.title, d.url, d.doc_type, d.lat, d.lng
      from public.discovery_candidates d
     where d.source = 'google' and d.status = 'nieuw' and d.doc_type in ('campground', 'rv_park')
       and d.postcode is not null -- alleen Nederlandse adressen (postcode met twee letters)
       and d.url ~ '^https://' and d.url !~ 'google\.com/maps|wa\.me|facebook\.com|instagram\.com|linktr\.ee'
     order by (d.doc_type = 'rv_park') desc, d.id
     limit greatest(1, least(coalesce(p_limit, 50), 5000))
  loop
    bezwaar := null;
    v_host := lower(regexp_replace(c.url, '^https?://(www\.)?([^/?#]+).*$', '\2'));
    if exists (select 1 from public.places p where p.merged_into is null and p.website is not null
                and lower(regexp_replace(p.website, '^https?://(www\.)?([^/?#]+).*$', '\2')) = v_host) then
      -- Dezelfde website als een plek die we hebben: geen nieuwe plek, wel bekend
      bekend := bekend + 1;
      if not p_dry_run then
        update public.discovery_candidates set status = 'bekend', decided_at = now() where id = c.id;
      end if;
      continue;
    end if;
    if v_host ~ '(park4night|campercontact|camperplaatsen|camping\.info|anwb|acsi|eurocampings|booking\.com|tripadvisor|campspace|pitchup|camperstop|farmcamps|kampeerclub|ncc\.nl|ntkc|capfun|bushcamps|boerderblij|logerenbijdeboswachter|staatsbosbeheer|facebook|instagram|wa\.me|linktr\.ee|sites\.google|wixsite|jouwweb|webnode)' then
      bezwaar := 'website is een directory, netwerk of sociaal netwerk, geen eigen site';
    elsif (select count(*) from public.discovery_candidates d2 where d2.source = 'google' and d2.status = 'nieuw' and d2.url ~ '^https://'
            and lower(regexp_replace(d2.url, '^https?://(www\.)?([^/?#]+).*$', '\2')) = v_host) >= 2 then
      bezwaar := 'website hoort bij meerdere kandidaten (portal of netwerk)';
    elsif length(trim(c.title)) not between 3 and 120 then bezwaar := 'naam heeft een vreemde lengte';
    elsif private.geo_naam_kern(c.title) = '' then bezwaar := 'naam is alleen een soortwoord';
    elsif lower(extensions.unaccent(c.title)) ~ '(wild ?kampe|wildcamp|wild camp|free ?camp|paalkampe|bivak)' then bezwaar := 'wildkamperen of paalkamperen';
    elsif exists (select 1 from private.verwijderde_plekken v
                   where v.removed_at > now() - interval '6 months'
                     and (v.gegevens ->> 'lat')::float8 between c.lat - 0.0018 and c.lat + 0.0018
                     and (v.gegevens ->> 'lng')::float8 between c.lng - 0.003 and c.lng + 0.003) then bezwaar := 'eerder opgeruimd, niet opnieuw aanmaken';
    end if;
    if bezwaar is not null then
      overgeslagen := overgeslagen + 1;
      redenen := jsonb_set(redenen, array[bezwaar], to_jsonb(coalesce((redenen ->> bezwaar)::int, 0) + 1));
      continue;
    end if;
    gemaakt := gemaakt + 1;
    if jsonb_array_length(voorbeelden) < 10 then voorbeelden := voorbeelden || jsonb_build_object('naam', c.title, 'website', c.url); end if;
    if p_dry_run then continue; end if;

    v_kind := case c.doc_type when 'rv_park' then 'camperplaats' else 'camping' end;
    select t.name, t.province into v_town, v_province from public.nearest_town(c.lat, c.lng) t;
    base := public.slugify(trim(c.title) || coalesce('-' || v_town, ''));
    if base = '' then base := 'camperplaats'; end if;
    v_slug := base; n := 1;
    while exists (select 1 from public.places where slug = v_slug) loop
      n := n + 1; v_slug := base || '-' || n;
    end loop;

    insert into public.places (slug, name, name_is_generic, kind, lat, lng, town, province, website, status, status_locked, sources)
    values (v_slug, trim(c.title), false, v_kind, c.lat, c.lng, v_town, v_province, c.url, 'draft', true,
            jsonb_build_object('google', jsonb_build_object('place_id', c.external_id, 'at', now(), 'candidate_id', c.id)))
    returning id into new_id;
    ids := ids || new_id;
    update public.discovery_candidates set status = 'toegevoegd', decided_at = now() where id = c.id;
  end loop;

  if not p_dry_run and array_length(ids, 1) > 0 then
    insert into private.scrape_queue (place_id) select unnest(ids) on conflict (place_id) do nothing;
  end if;
  return jsonb_build_object('dry_run', p_dry_run, 'nieuwe_plekken', gemaakt, 'al_bekend_op_website', bekend, 'overgeslagen', overgeslagen, 'redenen', redenen, 'voorbeelden', voorbeelden);
end $$;
revoke all on function public.google_kandidaten_naar_plekken(boolean, integer) from public, anon, authenticated;
grant execute on function public.google_kandidaten_naar_plekken(boolean, integer) to service_role;
