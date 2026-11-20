-- AI-lezer, ontdekken via officiële bekendmakingen en de herlees-rem (besluit Patrick 20 november 2026, README 140).
--
-- 1. private.page_texts: per plek de ingekorte tekst van de website (alleen relevante regels, hoogstens 12.000 tekens)
--    met een hash. De pipeline schrijft hem bij elke gelukte lezing; de AI-lezer leest alleen plekken waarvan de hash
--    nieuw is (cache: een ongewijzigde site kost geen modelaanroep).
-- 2. updates_queue: bron 'ai-lezer', plus citaat, bronpagina en een lezing-id. Voorstellen uit één lezing worden samen
--    geaccepteerd of afgewezen (regel en tijd horen bij elkaar). De AI-lezer schrijft nooit zelf in places.
-- 3. public.discovery_candidates: publicaties van gemeenten (vergunningen, besluiten) over camperplaatsen, met de
--    dichtstbijzijnde bekende plek. Geen plek binnen 300 m: status 'nieuw', voor Beheer.
-- 4. private.reread_guard(): wist een herlezing in 6 uur bij meer dan 5% van de gelezen plekken een kernfeit, dan gaan
--    de scrape-taken uit en komt er een fout in app_logs (dataplan 1.4).

-- ── 1. Tekst per plek ────────────────────────────────────────────────────────────────────────────────────────────────
create table if not exists private.page_texts (
  place_id uuid primary key references public.places (id) on delete cascade,
  text text not null check (char_length(text) <= 12000),
  hash text not null check (hash ~ '^[0-9a-f]{64}$'),
  source text not null check (source in ('scrape', 'stealth')),
  stored_at timestamptz not null default now(),
  ai_hash text,
  ai_model text,
  ai_at timestamptz,
  ai_tries smallint not null default 0,
  ai_error text check (char_length(ai_error) <= 300),
  ai_result jsonb
);
comment on table private.page_texts is 'Ingekorte websitetekst per plek voor de AI-lezer; ai_hash = hash bij de laatste gelukte lezing';
alter table private.page_texts enable row level security;
revoke all on private.page_texts from public, anon, authenticated;

create or replace function public.store_page_text(p_id uuid, p_text text, p_hash text, p_source text) returns void
 language sql security definer set search_path to ''
as $$
  insert into private.page_texts as t (place_id, text, hash, source)
  values (p_id, left(p_text, 12000), p_hash, p_source)
  on conflict (place_id) do update
    set text = excluded.text, hash = excluded.hash, source = excluded.source, stored_at = now(),
        -- Nieuwe tekst: opnieuw proberen mag weer
        ai_tries = case when t.hash = excluded.hash then t.ai_tries else 0 end,
        ai_error = case when t.hash = excluded.hash then t.ai_error else null end;
$$;
revoke all on function public.store_page_text(uuid, text, text, text) from public, anon, authenticated;
grant execute on function public.store_page_text(uuid, text, text, text) to service_role;

-- Volgende plekken voor de AI-lezer, met een lease van een uur (ai_at). Eerst wat het meest oplevert: zonder
-- vertrekregel, camperplaatsen, zonder prijs.
create or replace function public.next_ai_batch(p_limit integer default 2)
 returns table (id uuid, name text, kind text, text text, hash text)
 language sql security definer set search_path to ''
as $$
  with pick as (
    select t.place_id
      from private.page_texts t
      join public.places p on p.id = t.place_id
     where t.ai_hash is distinct from t.hash
       and t.ai_tries < 3
       and (t.ai_at is null or t.ai_at < now() - interval '1 hour')
       and p.merged_into is null and p.status <> 'hidden'
     order by (p.departure is null) desc, (p.kind = 'camperplaats') desc, (p.price_eur is null) desc, t.stored_at
     limit least(greatest(p_limit, 1), 10)
     for update of t skip locked
  )
  update private.page_texts t
     set ai_at = now(), ai_tries = t.ai_tries + 1
    from pick, public.places p
   where t.place_id = pick.place_id and p.id = t.place_id
  returning t.place_id, p.name, p.kind, t.text, t.hash;
$$;
revoke all on function public.next_ai_batch(integer) from public, anon, authenticated;
grant execute on function public.next_ai_batch(integer) to service_role;

-- ── 2. Voorstellen van de AI-lezer in de Triage Inbox ────────────────────────────────────────────────────────────────
alter table public.updates_queue add column if not exists quote text check (char_length(quote) <= 500);
alter table public.updates_queue add column if not exists source_url text check (char_length(source_url) <= 500);
alter table public.updates_queue add column if not exists reading_id uuid;
comment on column public.updates_queue.quote is 'Letterlijk citaat dat het voorstel onderbouwt (AI-lezer)';
comment on column public.updates_queue.source_url is 'Pagina waar het citaat staat';
comment on column public.updates_queue.reading_id is 'Eén lezing van de AI-lezer: regel en tijd worden samen afgehandeld';
create index if not exists updates_queue_reading on public.updates_queue (reading_id) where reading_id is not null;

alter table public.updates_queue drop constraint if exists updates_queue_source_check;
alter table public.updates_queue add constraint updates_queue_source_check check (
  source = any (array['doe-mee', 'plekpuls', 'beheer', 'pipeline', 'eigenaar', 'mail (onbevestigd)', 'ai-lezer']));

-- Regel en tijd uit dezelfde lezing horen bij elkaar (zoals bij een inzending of een mail van de eigenaar)
create or replace function private.queue_group(u public.updates_queue) returns uuid[]
 language sql stable security definer set search_path to ''
as $$
  select case when u.field_changed in ('departure', 'checkout_until') then (
    select array_agg(q.id order by q.field_changed desc)
      from public.updates_queue q
     where q.status = 'pending' and q.place_id = u.place_id and q.field_changed in ('departure', 'checkout_until')
       and (q.id = u.id
            or (u.submission_id is not null and q.submission_id = u.submission_id)
            or (u.owner_reply_id is not null and q.owner_reply_id = u.owner_reply_id)
            or (u.reading_id is not null and q.reading_id = u.reading_id)))
  else array[u.id] end;
$$;
revoke all on function private.queue_group(public.updates_queue) from public, anon, authenticated;

-- Resultaat van één lezing vastleggen. p_proposals: [{field, value, quote, url, confirmed}], alleen wat de controle in
-- ai.ts heeft doorstaan. Een voorstel komt er niet als de plek die waarde al heeft, als hetzelfde voorstel al openstaat,
-- of als Beheer precies dit voorstel van de AI-lezer eerder afwees. Een door een mens bevestigde vertrekregel
-- (departure_check 'bevestigd') krijgt geen AI-voorstel.
create or replace function public.apply_ai_reading(
  p_id uuid, p_hash text, p_model text, p_result jsonb, p_proposals jsonb, p_closed jsonb default null, p_error text default null
) returns jsonb
 language plpgsql security definer set search_path to ''
as $$
declare
  cur jsonb;
  pr jsonb;
  f text;
  v jsonb;
  n integer := 0;
  v_reading uuid := gen_random_uuid();
  v_departure text;
begin
  if p_error is not null then
    -- "limiet:" (Gemini 429): geen echte mislukking, de poging telt niet
    update private.page_texts
       set ai_error = left(p_error, 300), ai_model = p_model,
           ai_tries = case when p_error like 'limiet:%' then greatest(ai_tries - 1, 0) else ai_tries end
     where place_id = p_id;
    return jsonb_build_object('id', p_id, 'error', true);
  end if;
  update private.page_texts
     set ai_hash = p_hash, ai_model = p_model, ai_at = now(), ai_error = null, ai_result = p_result
   where place_id = p_id;

  select to_jsonb(p) into cur from public.places p where p.id = p_id and p.merged_into is null and p.status <> 'hidden';
  if cur is null then return jsonb_build_object('id', p_id, 'proposals', 0); end if;

  for pr in select * from jsonb_array_elements(coalesce(p_proposals, '[]'::jsonb)) loop
    f := pr ->> 'field';
    v := pr -> 'value';
    continue when f is null or not (f = any (private.queue_fields())) or v is null or v = 'null'::jsonb;
    continue when f in ('departure', 'checkout_until') and cur ->> 'departure_check' = 'bevestigd';
    continue when cur -> f = v;
    continue when exists (
      select 1 from public.updates_queue q
       where q.place_id = p_id and q.field_changed = f and q.new_value = v
         and (q.status = 'pending' or (q.source = 'ai-lezer' and q.status = 'rejected')));
    insert into public.updates_queue (place_id, field_changed, old_value, new_value, source, quote, source_url, reading_id)
    values (p_id, f, cur -> f, v, 'ai-lezer', left(pr ->> 'quote', 500), left(pr ->> 'url', 500), v_reading);
    n := n + 1;
    if f = 'departure' then v_departure := v #>> '{}'; end if;
  end loop;

  -- Vrij of per 24 uur in plaats van een vaste tijd: de oude tijd moet dan mee weg (zelfde lezing, samen afgehandeld)
  if v_departure in ('vrij', 'per24') and cur ->> 'checkout_until' is not null then
    insert into public.updates_queue (place_id, field_changed, old_value, new_value, source, quote, source_url, reading_id)
    select p_id, 'checkout_until', cur -> 'checkout_until', 'null'::jsonb, 'ai-lezer', q.quote, q.source_url, v_reading
      from public.updates_queue q where q.reading_id = v_reading and q.field_changed = 'departure';
    n := n + 1;
  end if;

  -- Mogelijk gesloten: geen veld in de inbox, wel een inzending voor Beheer (één open melding per plek)
  if p_closed is not null and p_closed ? 'quote' and not exists (
       select 1 from public.submissions s
        where s.place_id = p_id and s.status = 'nieuw' and s.contact_name = 'AI-lezer (automatisch)' and s.payload ->> 'veld' = 'status') then
    insert into public.submissions (kind, place_id, contact_name, payload)
    values ('correctie', p_id, 'AI-lezer (automatisch)', jsonb_build_object(
      'veld', 'status', 'voorstel', 'gesloten', 'citaat', left(p_closed ->> 'quote', 500), 'bron', left(p_closed ->> 'url', 500),
      'toelichting', 'De AI-lezer vond op de website dat deze plek gesloten is. Controleer het en zet de plek zo nodig op verborgen.'));
    n := n + 1;
  end if;
  return jsonb_build_object('id', p_id, 'proposals', n);
end $$;
revoke all on function public.apply_ai_reading(uuid, text, text, jsonb, jsonb, jsonb, text) from public, anon, authenticated;
grant execute on function public.apply_ai_reading(uuid, text, text, jsonb, jsonb, jsonb, text) to service_role;

-- Elke 10 minuten twee plekken (±290 per dag: binnen de gratis limiet van Gemini Flash). Zonder GEMINI_API_KEY in de
-- edge-geheimen doet de actie niets.
do $$ begin
  perform cron.unschedule('ai-lezer') where exists (select 1 from cron.job where jobname = 'ai-lezer');
  perform cron.schedule('ai-lezer', '*/10 * * * *', $c$select private.call_pipeline('{"action":"ai","n":2,"background":true}'::jsonb) where exists (select 1 from private.page_texts t where t.ai_hash is distinct from t.hash and t.ai_tries < 3 and (t.ai_at is null or t.ai_at < now() - interval '1 hour'))$c$);
end $$;

-- ── 3. Kandidaten uit officiële bekendmakingen ───────────────────────────────────────────────────────────────────────
create table if not exists public.discovery_candidates (
  id bigint generated always as identity primary key,
  source text not null check (source in ('officielebekendmakingen')),
  external_id text not null check (char_length(external_id) <= 100),
  title text not null check (char_length(title) <= 600),
  url text not null check (url ~ '^https://'),
  authority text,
  doc_type text,
  street text,
  postcode text,
  town text,
  published_on date,
  lat double precision check (lat between 50.7 and 53.7),
  lng double precision check (lng between 3.2 and 7.3),
  nearest_place_id uuid references public.places (id) on delete set null,
  nearest_m integer,
  status text not null default 'nieuw' check (status in ('nieuw', 'bekend', 'toegevoegd', 'geen_plek')),
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  unique (source, external_id)
);
comment on table public.discovery_candidates is 'Mogelijke nieuwe plekken uit overheidspublicaties (tier 1); Beheer beslist';
alter table public.discovery_candidates enable row level security;
revoke all on public.discovery_candidates from public, anon;
grant select, update on public.discovery_candidates to authenticated;
drop policy if exists discovery_candidates_admin_read on public.discovery_candidates;
create policy discovery_candidates_admin_read on public.discovery_candidates for select to authenticated using (public.has_admin_role());
drop policy if exists discovery_candidates_admin_update on public.discovery_candidates;
create policy discovery_candidates_admin_update on public.discovery_candidates for update to authenticated
  using (public.has_admin_role()) with check (public.has_admin_role());
create index if not exists discovery_candidates_status on public.discovery_candidates (status, published_on desc);

-- Opslaan zonder dubbelingen; de dichtstbijzijnde bekende plek bepaalt of het nieuw is (300 m)
create or replace function public.store_discovery_candidates(p_items jsonb) returns jsonb
 language plpgsql security definer set search_path to ''
as $$
declare
  it jsonb;
  v_lat double precision;
  v_lng double precision;
  v_near uuid;
  v_m integer;
  n_new integer := 0;
  n_known integer := 0;
begin
  for it in select * from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) loop
    continue when coalesce(it ->> 'id', '') = '' or coalesce(it ->> 'title', '') = '' or coalesce(it ->> 'url', '') !~ '^https://';
    continue when exists (select 1 from public.discovery_candidates c where c.source = 'officielebekendmakingen' and c.external_id = it ->> 'id');
    v_lat := nullif(it ->> 'lat', '')::double precision;
    v_lng := nullif(it ->> 'lng', '')::double precision;
    if v_lat is null or v_lng is null or v_lat not between 50.7 and 53.7 or v_lng not between 3.2 and 7.3 then
      v_lat := null; v_lng := null;
    end if;
    v_near := null; v_m := null;
    if v_lat is not null then
      select p.id, round(extensions.st_distance(p.geom::extensions.geography,
                                                extensions.st_setsrid(extensions.st_makepoint(v_lng, v_lat), 4326)::extensions.geography))::integer
        into v_near, v_m
        from public.places p
       where p.merged_into is null and p.geom is not null
       order by p.geom operator(extensions.<->) extensions.st_setsrid(extensions.st_makepoint(v_lng, v_lat), 4326)
       limit 1;
    end if;
    insert into public.discovery_candidates (source, external_id, title, url, authority, doc_type, street, postcode, town,
                                             published_on, lat, lng, nearest_place_id, nearest_m, status)
    values ('officielebekendmakingen', left(it ->> 'id', 100), left(it ->> 'title', 600), it ->> 'url', it ->> 'authority',
            it ->> 'type', it ->> 'street', it ->> 'postcode', it ->> 'town', nullif(it ->> 'date', '')::date, v_lat, v_lng,
            v_near, v_m, case when v_m is not null and v_m <= 300 then 'bekend' else 'nieuw' end)
    on conflict (source, external_id) do nothing;
    if v_m is not null and v_m <= 300 then n_known := n_known + 1; else n_new := n_new + 1; end if;
  end loop;
  return jsonb_build_object('nieuw', n_new, 'bekend', n_known);
end $$;
revoke all on function public.store_discovery_candidates(jsonb) from public, anon, authenticated;
grant execute on function public.store_discovery_candidates(jsonb) to service_role;

-- Elke maandag de publicaties ophalen (±700, in pagina's van 100)
do $$ begin
  perform cron.unschedule('bekendmakingen') where exists (select 1 from cron.job where jobname = 'bekendmakingen');
  perform cron.schedule('bekendmakingen', '47 4 * * 1', $c$select private.call_pipeline('{"action":"bekendmakingen","background":true}'::jsonb)$c$);
end $$;

-- ── 4. Herlees-rem ───────────────────────────────────────────────────────────────────────────────────────────────────
create or replace function private.reread_guard() returns jsonb
 language plpgsql security definer set search_path to ''
as $$
declare
  v_read integer;
  v_wiped integer;
  v_parser text;
  j record;
begin
  -- Alleen de nieuwste parser telt: wat een oudere versie wiste, is al gebeurd en zegt niets over de huidige
  select parser into v_parser from private.field_log
   where at > now() - interval '6 hours' and parser ~ '^\d+$'
   order by parser::integer desc limit 1;
  if v_parser is null then return jsonb_build_object('gepauzeerd', false); end if;
  select count(*) into v_read from public.places where last_scraped_at > now() - interval '6 hours';
  select count(distinct place_id) into v_wiped
    from private.field_log
   where at > now() - interval '6 hours'
     and parser = v_parser
     and field in ('departure', 'checkout_until', 'price_eur', 'season', 'open_all_year')
     and old_value is not null and old_value <> 'null'::jsonb
     and (new_value is null or new_value = 'null'::jsonb);
  -- Al gepauzeerd: niet elk uur opnieuw melden
  if not exists (select 1 from cron.job where jobname in ('scrape', 'scrape-refresh') and active) then
    return jsonb_build_object('gepauzeerd', true, 'parser', v_parser);
  end if;
  if v_read >= 50 and v_wiped::numeric / v_read > 0.05 then
    for j in select jobid, jobname from cron.job where jobname in ('scrape', 'scrape-refresh', 'stealth-enqueue') and active loop
      perform cron.alter_job(j.jobid, active := false);
    end loop;
    insert into public.app_logs (level, source, message, context)
    values ('error', 'herlees-rem',
            format('Herlezing gepauzeerd: parser %s wiste in 6 uur bij %s van %s gelezen plekken een kernfeit (meer dan 5%%). Zet de taken scrape, scrape-refresh en stealth-enqueue weer aan na controle.', v_parser, v_wiped, v_read),
            jsonb_build_object('parser', v_parser, 'gelezen', v_read, 'gewist', v_wiped));
    return jsonb_build_object('gepauzeerd', true, 'parser', v_parser, 'gelezen', v_read, 'gewist', v_wiped);
  end if;
  return jsonb_build_object('gepauzeerd', false, 'parser', v_parser, 'gelezen', v_read, 'gewist', v_wiped);
end $$;
revoke all on function private.reread_guard() from public, anon, authenticated;

do $$ begin
  perform cron.unschedule('herlees-rem') where exists (select 1 from cron.job where jobname = 'herlees-rem');
  perform cron.schedule('herlees-rem', '19 * * * *', 'select private.reread_guard()');
end $$;
