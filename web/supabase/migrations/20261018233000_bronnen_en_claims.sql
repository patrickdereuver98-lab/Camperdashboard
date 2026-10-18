-- Bronnen- en claimslaag (dataplan Fase 0, taak W0.3).
--
-- Elk feit over een plek komt eerst binnen als claim: een waarde voor één veld, met de bron, de datum en een
-- letterlijk citaat. Het citaat moet in het opgeslagen document staan, anders wordt de claim geweigerd. Eén
-- beslisregel (bron.decisions) bepaalt per plek en veld welke waarde onderbouwd is:
--   - tier 1 of 2 (open data, overheid, eigen site of eigenaar): één bron is genoeg;
--   - tier 3 tot 5 (directories, fora, reviews): twee losse vermeldingen met dezelfde waarde (besluit 18 oktober 2026);
--   - alleen vermeldingen uit de laatste 24 maanden tellen;
--   - een nieuwere vermelding die iets anders zegt, maakt er een conflict van (voor een mens).
-- Deze migratie schrijft niets in public.places: overnemen in places is taak W4.1 en wordt afgestemd met de
-- pipeline-sessie. De tabellen staan in het schema `bron`, dat niet via de API openstaat; alles loopt via functies.
-- Alleen toevoegingen; bestaande tabellen en functies blijven gelijk.

create schema if not exists bron;
revoke all on schema bron from public, anon, authenticated;
grant usage on schema bron to service_role;

-- ── Bronnenregister ────────────────────────────────────────────────────────────────────────────────────────────

create table if not exists bron.sources (
  id text primary key check (id ~ '^[a-z0-9][a-z0-9.-]{1,62}$'),
  name text not null check (length(name) between 2 and 120),
  domain text unique check (domain ~ '^[a-z0-9.-]+\.[a-z]{2,}$'),
  kind text not null check (kind in ('open_data', 'overheid', 'eigen_site', 'eigenaar', 'directory', 'forum', 'reviews', 'api')),
  tier smallint not null check (tier between 1 and 5),
  status text not null default 'te_beoordelen'
    check (status in ('toegestaan', 'alleen_aanwijzing', 'te_beoordelen', 'geblokkeerd')),
  robots_ok boolean,
  robots_checked_at timestamptz,
  min_delay_s integer not null default 10 check (min_delay_s between 1 and 3600),
  terms_note text check (length(terms_note) <= 2000),
  auto_registered boolean not null default false,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table bron.sources is
  'Bronnenregister: per bron of domein wat mag. Tier 1 open data/overheid, 2 eigen site/eigenaar, 3 directory, 4 forum, 5 reviews.';

-- Laatste ophaalmoment per host, voor de wachttijd tussen twee verzoeken.
create table if not exists bron.host_throttle (
  host text primary key,
  last_fetch_at timestamptz not null default now()
);

-- ── Documenten: wat er is opgehaald ────────────────────────────────────────────────────────────────────────────

create table if not exists bron.documents (
  id bigint generated always as identity primary key,
  source_id text not null references bron.sources (id),
  url text not null check (url ~ '^https?://' and length(url) <= 2000),
  place_id uuid references public.places (id) on delete set null,
  fetched_at timestamptz not null default now(),
  fetched_by text not null check (fetched_by in ('server', 'agent')),
  http_status integer,
  content_hash text not null,
  published_on date,
  extract text not null check (length(extract) between 1 and 60000),
  submitted_by text not null check (length(submitted_by) between 1 and 80),
  unique (url, content_hash)
);
comment on column bron.documents.fetched_by is
  'server = de MCP-server haalde de pagina zelf op (citaat is gecontroleerd tegen de echte pagina); agent = tekst ingestuurd door een sessie (besluit krijgt dan "controle").';
comment on column bron.documents.extract is
  'Platte tekst van de pagina (max 60.000 tekens). Na 30 dagen teruggebracht tot de citaten van de claims (bron.prune).';
create index if not exists documents_place_idx on bron.documents (place_id);
create index if not exists documents_source_idx on bron.documents (source_id);

-- ── Kandidaten: gevonden plekken ───────────────────────────────────────────────────────────────────────────────

create table if not exists bron.candidates (
  id bigint generated always as identity primary key,
  source_id text not null references bron.sources (id),
  document_id bigint references bron.documents (id) on delete set null,
  external_ref text check (length(external_ref) <= 300),
  name text not null check (length(name) between 2 and 160),
  lat double precision check (lat between 50.6 and 53.7),
  lng double precision check (lng between 3.2 and 7.3),
  town text check (length(town) <= 80),
  province text check (length(province) <= 40),
  website text check (website ~ '^https?://' and length(website) <= 500),
  phone text check (length(phone) <= 30),
  kind_hint text check (kind_hint in ('camperplaats', 'camping', 'parkeerplaats', 'boerderij', 'jachthaven')),
  matched_place_id uuid references public.places (id) on delete set null,
  match_score numeric(4, 3),
  match_reason text,
  status text not null default 'nieuw'
    check (status in ('nieuw', 'gekoppeld', 'nieuwe_plek', 'afgewezen', 'dubbel')),
  submitted_by text not null check (length(submitted_by) between 1 and 80),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((lat is null) = (lng is null)),
  unique (source_id, external_ref)
);
create index if not exists candidates_status_idx on bron.candidates (status);
create index if not exists candidates_place_idx on bron.candidates (matched_place_id);

-- ── Claims: één bewering over één veld ─────────────────────────────────────────────────────────────────────────

create table if not exists bron.claims (
  id bigint generated always as identity primary key,
  place_id uuid references public.places (id) on delete cascade,
  candidate_id bigint references bron.candidates (id) on delete cascade,
  field text not null,
  value jsonb not null,
  document_id bigint not null references bron.documents (id) on delete cascade,
  evidence text not null check (length(evidence) between 3 and 500),
  mention_ref text check (length(mention_ref) <= 120),
  observed_on date,
  method text not null check (method in ('regel', 'agent', 'mens')),
  status text not null default 'open' check (status in ('open', 'afgewezen', 'ingehaald')),
  status_reason text,
  submitted_by text not null check (length(submitted_by) between 1 and 80),
  created_at timestamptz not null default now(),
  check (place_id is not null or candidate_id is not null),
  unique nulls not distinct (place_id, candidate_id, field, document_id, mention_ref, value)
);
comment on column bron.claims.mention_ref is
  'Welke vermelding op de pagina (review-id, postnummer, datum). Twee reviews op één pagina zijn twee vermeldingen.';
comment on column bron.claims.observed_on is
  'Datum van de vermelding zelf (review of post); leeg = datum van ophalen.';
create index if not exists claims_place_field_idx on bron.claims (place_id, field);
create index if not exists claims_candidate_idx on bron.claims (candidate_id);
create index if not exists claims_document_idx on bron.claims (document_id);

-- ── Werkverdeling over sessies ─────────────────────────────────────────────────────────────────────────────────

create table if not exists bron.work_items (
  id bigint generated always as identity primary key,
  kind text not null check (kind in ('ontdek_gemeenten', 'ontdek_jachthavens', 'ontdek_boerderij', 'ontdek_fora',
                                     'ontdek_directory', 'aanvullen', 'koppelen', 'controle')),
  scope jsonb not null,
  instructions text check (length(instructions) <= 2000),
  priority integer not null default 100,
  status text not null default 'open' check (status in ('open', 'bezig', 'klaar', 'mislukt', 'geblokkeerd')),
  leased_by text,
  lease_until timestamptz,
  attempts integer not null default 0,
  result jsonb,
  note text check (length(note) <= 4000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (kind, scope)
);
create index if not exists work_items_open_idx on bron.work_items (priority, id) where status in ('open', 'bezig');

alter table bron.sources enable row level security;
alter table bron.host_throttle enable row level security;
alter table bron.documents enable row level security;
alter table bron.candidates enable row level security;
alter table bron.claims enable row level security;
alter table bron.work_items enable row level security;
revoke all on all tables in schema bron from public, anon, authenticated;
grant select, insert, update, delete on all tables in schema bron to service_role;

-- ── Hulpfuncties ───────────────────────────────────────────────────────────────────────────────────────────────

-- Tekst vergelijkbaar maken: kleine letters, zonder accenten, één spatie, aanhalingstekens en streepjes gelijk.
create or replace function bron.norm(t text)
 returns text
 language sql
 stable
 set search_path to ''
as $$
  select trim(regexp_replace(
    translate(lower(extensions.unaccent('extensions.unaccent'::regdictionary, coalesce(t, ''))),
              chr(8216) || chr(8217) || chr(8218) || chr(8219) || chr(8220) || chr(8221) || chr(8222) || chr(8223)
                || chr(8211) || chr(8212) || chr(8722) || chr(160) || chr(8239),
              repeat(chr(39), 4) || repeat('"', 4) || '---' || '  '),
    '\s+', ' ', 'g'))
$$;

-- Velden die een claim mag hebben, met hun controle. Geeft een foutmelding terug, of null als de waarde goed is.
create or replace function bron.check_value(p_field text, p_value jsonb)
 returns text
 language plpgsql
 immutable
 set search_path to ''
as $$
declare t text := jsonb_typeof(p_value);
begin
  case p_field
    when 'departure' then
      if t <> 'string' or p_value #>> '{}' not in ('vrij', 'per24', 'vast') then return 'departure is vrij, per24 of vast'; end if;
    when 'checkout_until', 'checkin_from' then
      if t <> 'string' or p_value #>> '{}' !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' then return p_field || ' is uu:mm'; end if;
    when 'access_hours' then
      if t <> 'string' or p_value #>> '{}' !~ '^([01][0-9]|2[0-3]):[0-5][0-9]–([01][0-9]|2[0-4]):[0-5][0-9]$' then
        return 'access_hours is uu:mm–uu:mm (met een en-dash)';
      end if;
    when 'max_stay_nights' then
      if t <> 'number' or (p_value #>> '{}')::numeric not between 1 and 365 or (p_value #>> '{}')::numeric % 1 <> 0 then
        return 'max_stay_nights is een geheel getal van 1 tot 365';
      end if;
    when 'capacity' then
      if t <> 'number' or (p_value #>> '{}')::numeric not between 3 and 1999 or (p_value #>> '{}')::numeric % 1 <> 0 then
        return 'capacity is een geheel getal van 3 tot 1999 (aantal camperplekken, niet personen)';
      end if;
    when 'price_eur' then
      if t <> 'number' or (p_value #>> '{}')::numeric not between 0 and 500 then return 'price_eur is een bedrag van 0 tot 500'; end if;
    when 'max_length_m' then
      if t <> 'number' or (p_value #>> '{}')::numeric not between 3 and 25 then return 'max_length_m ligt tussen 3 en 25'; end if;
    when 'power', 'water', 'dump_station', 'toilet', 'shower', 'wifi', 'dogs', 'open_all_year', 'reservation',
         'access_24h', 'tourist_tax_included', 'gesloten' then
      if t <> 'boolean' then return p_field || ' is true of false'; end if;
    when 'season' then
      if t <> 'string' or length(p_value #>> '{}') not between 3 and 60 then return 'season is tekst van 3 tot 60 tekens'; end if;
    when 'phone' then
      if t <> 'string' or p_value #>> '{}' !~ '^\+?[0-9 ()-]{8,20}$' then return 'phone is een telefoonnummer'; end if;
    when 'website' then
      if t <> 'string' or p_value #>> '{}' !~ '^https?://[^ ]+$' or length(p_value #>> '{}') > 500 then return 'website is een http(s)-adres'; end if;
    else
      return 'onbekend veld: ' || coalesce(p_field, '(leeg)');
  end case;
  return null;
end $$;

-- Tier voor een domein: geregistreerd domein, eigen site van de plek, of overheidsdomein. De rest valt op het
-- opgegeven soort (directory 3, forum 4, reviews 5); een sessie kan zichzelf zo nooit tier 1 of 2 geven.
create or replace function bron.source_for(p_host text, p_kind text, p_place uuid)
 returns text
 language plpgsql
 security definer
 set search_path to ''
as $$
declare
  h text := lower(regexp_replace(p_host, '^www\.', ''));
  s text;
  site_host text;
  k text;
begin
  select id into s from bron.sources
   where domain is not null and (h = domain or h like '%.' || domain)
   order by length(domain) desc limit 1;
  if s is not null then return s; end if;

  if p_place is not null then
    select lower(regexp_replace(substring(website from '^https?://([^/:?#]+)'), '^www\.', '')) into site_host
      from public.places where id = p_place;
    if site_host is not null and (h = site_host or h like '%.' || site_host) then return 'eigen-site'; end if;
  end if;

  k := case
         when h ~ '(^|\.)(gemeente[a-z-]*|provincie[a-z-]*|rijksoverheid|overheid)\.nl$' then 'overheid'
         when p_kind in ('directory', 'forum', 'reviews') then p_kind
         else 'forum'
       end;
  insert into bron.sources (id, name, domain, kind, tier, status, auto_registered, terms_note)
  values (left(regexp_replace(h, '[^a-z0-9.-]', '-', 'g'), 63), h, h, k,
          case k when 'overheid' then 1 when 'directory' then 3 when 'forum' then 4 else 5 end,
          'toegestaan', true,
          'Automatisch geregistreerd bij eerste gebruik; coördinator beoordeelt dit domein.')
  on conflict (id) do nothing;
  return left(regexp_replace(h, '[^a-z0-9.-]', '-', 'g'), 63);
end $$;

-- ── Beslisregel ────────────────────────────────────────────────────────────────────────────────────────────────

-- Per plek en veld: de best onderbouwde waarde en het besluit.
--   geaccepteerd  onderbouwd volgens de regels
--   controle      onderbouwd, maar alleen uit tekst die een sessie zelf instuurde: een mens kijkt mee
--   conflict      een andere of nieuwere vermelding zegt iets anders
--   onvoldoende   nog één vermelding uit tier 3 tot 5
create or replace function bron.decisions(p_place uuid default null)
 returns table (place_id uuid, field text, value jsonb, besluit text, support integer, best_tier smallint,
                newest date, claim_ids bigint[], reden text)
 language sql
 stable
 set search_path to ''
as $$
  with c as (
    select cl.id, cl.place_id, cl.field, cl.value,
           coalesce(cl.observed_on, d.published_on, d.fetched_at::date) as obs,
           s.tier, d.fetched_by, d.url, coalesce(cl.mention_ref, '') as mref
      from bron.claims cl
      join bron.documents d on d.id = cl.document_id
      join bron.sources s on s.id = d.source_id
     where cl.place_id is not null
       and cl.status = 'open'
       and s.status in ('toegestaan', 'alleen_aanwijzing')
       and coalesce(cl.observed_on, d.published_on, d.fetched_at::date) >= (current_date - interval '24 months')::date
       and (p_place is null or cl.place_id = p_place)
  ), g as (
    select c.place_id, c.field, c.value,
           count(distinct (c.url, c.mref))::integer as support,
           min(c.tier)::smallint as best_tier,
           max(c.obs) as newest,
           bool_and(c.fetched_by = 'agent') as only_agent,
           array_agg(c.id order by c.id) as ids
      from c group by c.place_id, c.field, c.value
  ), e as (
    select g.*, (g.best_tier <= 2 or g.support >= 2) as eligible from g
  ), r as (
    select e.*, row_number() over (partition by e.place_id, e.field
                                   order by e.eligible desc, e.newest desc, e.best_tier, e.support desc) as rn
      from e
  )
  select r.place_id, r.field, r.value,
         case
           when not r.eligible then 'onvoldoende'
           when exists (select 1 from e o
                         where o.place_id = r.place_id and o.field = r.field and o.value <> r.value
                           and (o.newest > r.newest or (o.eligible and o.newest >= r.newest - 90))) then 'conflict'
           when r.only_agent then 'controle'
           else 'geaccepteerd'
         end,
         r.support, r.best_tier, r.newest, r.ids,
         case
           when not r.eligible then 'één vermelding uit tier ' || r.best_tier || '; een tweede nodig'
           when r.best_tier <= 2 then 'bron uit tier ' || r.best_tier
           else r.support || ' losse vermeldingen'
         end
    from r where r.rn = 1
$$;

-- Wat zou er in places veranderen? Alleen lezen; schrijven komt in W4.1.
create or replace function bron.preview_changes(p_place uuid default null)
 returns table (place_id uuid, slug text, field text, huidig jsonb, voorstel jsonb, besluit text, reden text,
                in_beheer boolean)
 language sql
 stable
 set search_path to ''
as $$
  select d.place_id, p.slug, d.field,
         case when d.field = 'gesloten' then null else to_jsonb(p) -> d.field end,
         d.value, d.besluit, d.reden,
         coalesce(p.sources -> 'beheer' ? d.field, false)
    from bron.decisions(p_place) d
    join public.places p on p.id = d.place_id
   where d.field = 'gesloten' or (to_jsonb(p) -> d.field) is distinct from d.value
$$;

-- Koppel een kandidaat aan een bestaande plek: zelfde website, of dichtbij met een lijkende naam.
create or replace function bron.match_candidate(p_id bigint)
 returns void
 language plpgsql
 security definer
 set search_path to ''
as $$
declare
  c bron.candidates;
  hit uuid; score numeric; why text;
  host text;
begin
  select * into c from bron.candidates where id = p_id;
  if c.id is null or c.status not in ('nieuw', 'gekoppeld') then return; end if;
  host := lower(regexp_replace(substring(c.website from '^https?://([^/:?#]+)'), '^www\.', ''));

  if host is not null then
    select p.id into hit from public.places p
     where p.merged_into is null
       and lower(regexp_replace(substring(p.website from '^https?://([^/:?#]+)'), '^www\.', '')) = host
       and (c.lat is null or extensions.st_dwithin(p.geom::extensions.geography,
              extensions.st_setsrid(extensions.st_makepoint(c.lng, c.lat), 4326)::extensions.geography, 5000))
     order by case when c.lat is null then 0 else extensions.st_distance(p.geom::extensions.geography,
              extensions.st_setsrid(extensions.st_makepoint(c.lng, c.lat), 4326)::extensions.geography) end
     limit 1;
    if hit is not null then score := 1; why := 'zelfde website'; end if;
  end if;

  if hit is null and c.lat is not null then
    select p.id,
           case when dist <= 60 then greatest(0.7, sim) else sim end,
           round(dist) || ' m, naam ' || round(sim * 100) || '% gelijk'
      into hit, score, why
      from (select p.id,
                   extensions.st_distance(p.geom::extensions.geography,
                     extensions.st_setsrid(extensions.st_makepoint(c.lng, c.lat), 4326)::extensions.geography) as dist,
                   extensions.similarity(lower(p.name), lower(c.name)) as sim
              from public.places p
             where p.merged_into is null
               and extensions.st_dwithin(p.geom::extensions.geography,
                     extensions.st_setsrid(extensions.st_makepoint(c.lng, c.lat), 4326)::extensions.geography, 400)) p
     where p.dist <= 60 or (p.dist <= 150 and p.sim >= 0.3) or p.sim >= 0.6
     order by p.dist <= 60 desc, p.sim desc, p.dist
     limit 1;
  end if;

  if hit is null and c.lat is null and c.town is not null then
    select p.id, extensions.similarity(lower(p.name), lower(c.name)), 'zelfde plaats, naam lijkt'
      into hit, score, why
      from public.places p
     where p.merged_into is null and lower(p.town) = lower(c.town)
       and extensions.similarity(lower(p.name), lower(c.name)) >= 0.7
     order by extensions.similarity(lower(p.name), lower(c.name)) desc
     limit 1;
  end if;

  update bron.candidates
     set matched_place_id = hit, match_score = score, match_reason = why,
         status = case when hit is null then 'nieuw' else 'gekoppeld' end, updated_at = now()
   where id = p_id;
end $$;

-- Na 30 dagen alleen de citaten bewaren; documenten zonder claims of kandidaten verdwijnen.
create or replace function bron.prune()
 returns void
 language plpgsql
 security definer
 set search_path to ''
as $$
begin
  delete from bron.documents d
   where d.fetched_at < now() - interval '30 days'
     and not exists (select 1 from bron.claims c where c.document_id = d.id)
     and not exists (select 1 from bron.candidates k where k.document_id = d.id);
  update bron.documents d
     set extract = coalesce((select string_agg(distinct c.evidence, E'\n') from bron.claims c where c.document_id = d.id), '(kandidaat)')
   where d.fetched_at < now() - interval '30 days'
     and length(d.extract) > 2000;
  delete from bron.host_throttle where last_fetch_at < now() - interval '7 days';
  update bron.work_items set status = 'open', leased_by = null, lease_until = null, updated_at = now()
   where status = 'bezig' and lease_until < now() - interval '1 day';
end $$;

-- ── Functies voor de MCP-server en sessies (alleen service_role) ───────────────────────────────────────────────

-- Wachttijd per host: 0 = je mag nu, anders het aantal seconden om te wachten.
create or replace function public.bron_fetch_slot(p_host text, p_source text)
 returns integer
 language plpgsql
 security definer
 set search_path to ''
as $$
declare
  delay integer := coalesce((select min_delay_s from bron.sources where id = p_source), 10);
  last timestamptz;
  wait numeric;
begin
  insert into bron.host_throttle (host, last_fetch_at) values (lower(p_host), now() - interval '1 day')
  on conflict (host) do nothing;
  select last_fetch_at into last from bron.host_throttle where host = lower(p_host) for update;
  wait := extract(epoch from (last + make_interval(secs => delay) - now()));
  if wait > 0 then return ceil(wait)::integer; end if;
  update bron.host_throttle set last_fetch_at = now() where host = lower(p_host);
  return 0;
end $$;

-- Bron bepalen voor een adres. Geeft de bron terug, met status en tier.
create or replace function public.bron_resolve_source(p_url text, p_kind text default null, p_place uuid default null)
 returns jsonb
 language plpgsql
 security definer
 set search_path to ''
as $$
declare
  host text := substring(p_url from '^https?://([^/:?#]+)');
  sid text;
  s bron.sources;
begin
  if host is null then raise exception 'Geen geldig http(s)-adres'; end if;
  sid := bron.source_for(host, p_kind, p_place);
  select * into s from bron.sources where id = sid;
  return jsonb_build_object('source_id', s.id, 'kind', s.kind, 'tier', s.tier, 'status', s.status,
                            'robots_ok', s.robots_ok, 'min_delay_s', s.min_delay_s, 'host', lower(host));
end $$;

-- robots.txt-uitkomst vastleggen. De MCP-server roept dit met false aan als de hele site voor ons dicht is
-- ("Disallow: /"); dan gaat de bron op geblokkeerd. Een verbod op losse paden weigert alleen dat adres.
create or replace function public.bron_set_robots(p_source text, p_ok boolean)
 returns void
 language sql
 security definer
 set search_path to ''
as $$
  update bron.sources
     set robots_ok = p_ok, robots_checked_at = now(), updated_at = now(),
         status = case when not p_ok and domain is not null then 'geblokkeerd' else status end
   where id = p_source and id not in ('eigen-site', 'eigenaar');
$$;

-- Document opslaan (opgehaald door de server of ingestuurd door een sessie).
create or replace function public.bron_store_document(p_source text, p_url text, p_place uuid, p_fetched_by text,
                                                      p_http_status integer, p_published_on date, p_text text,
                                                      p_agent text)
 returns bigint
 language plpgsql
 security definer
 set search_path to ''
as $$
declare
  st text;
  hash text := encode(extensions.digest(coalesce(p_text, ''), 'sha256'), 'hex');
  doc bigint;
begin
  select status into st from bron.sources where id = p_source;
  if st is null then raise exception 'Onbekende bron %', p_source; end if;
  if st = 'geblokkeerd' then raise exception 'Bron % is geblokkeerd', p_source; end if;
  if p_published_on > current_date then raise exception 'Publicatiedatum ligt in de toekomst'; end if;
  insert into bron.documents (source_id, url, place_id, fetched_by, http_status, content_hash, published_on, extract, submitted_by)
  values (p_source, p_url, p_place, p_fetched_by, p_http_status, hash, p_published_on, left(p_text, 60000), left(p_agent, 80))
  on conflict (url, content_hash) do update set fetched_at = now()
  returning id into doc;
  return doc;
end $$;

-- Claims insturen. Elke claim wordt apart gecontroleerd; het antwoord zegt per claim of hij is opgenomen.
-- p_claims: [{place_id | candidate_id, field, value, evidence, observed_on?, mention_ref?, method?}]
create or replace function public.bron_submit_claims(p_document bigint, p_claims jsonb, p_agent text)
 returns jsonb
 language plpgsql
 security definer
 set search_path to ''
as $$
declare
  doc bron.documents;
  cl jsonb;
  out jsonb := '[]'::jsonb;
  err text;
  pid uuid; cid bigint; obs date; new_id bigint;
begin
  select * into doc from bron.documents where id = p_document;
  if doc.id is null then raise exception 'Document % bestaat niet', p_document; end if;
  if jsonb_typeof(p_claims) <> 'array' or jsonb_array_length(p_claims) > 100 then
    raise exception 'p_claims is een lijst van hoogstens 100 claims';
  end if;

  for cl in select * from jsonb_array_elements(p_claims) loop
    err := null; new_id := null;
    begin
      pid := nullif(cl ->> 'place_id', '')::uuid;
      cid := nullif(cl ->> 'candidate_id', '')::bigint;
      obs := nullif(cl ->> 'observed_on', '')::date;
    exception when others then
      err := 'place_id, candidate_id of observed_on heeft een verkeerd formaat';
    end;
    if err is null and pid is null and cid is null then err := 'place_id of candidate_id ontbreekt'; end if;
    if err is null and pid is not null and not exists (select 1 from public.places where id = pid) then err := 'plek bestaat niet'; end if;
    if err is null and cid is not null and not exists (select 1 from bron.candidates where id = cid) then err := 'kandidaat bestaat niet'; end if;
    if err is null then err := bron.check_value(cl ->> 'field', cl -> 'value'); end if;
    if err is null and length(bron.norm(cl ->> 'evidence')) < 3 then err := 'citaat ontbreekt'; end if;
    if err is null and position(bron.norm(cl ->> 'evidence') in bron.norm(doc.extract)) = 0 then
      err := 'citaat staat niet letterlijk in het document';
    end if;
    if err is null and obs > current_date then err := 'observed_on ligt in de toekomst'; end if;
    if err is null and coalesce(cl ->> 'method', 'agent') not in ('regel', 'agent') then err := 'method is regel of agent'; end if;

    if err is null then
      insert into bron.claims (place_id, candidate_id, field, value, document_id, evidence, mention_ref, observed_on, method, submitted_by)
      values (pid, cid, cl ->> 'field', cl -> 'value', p_document, left(cl ->> 'evidence', 500),
              nullif(left(cl ->> 'mention_ref', 120), ''), obs, coalesce(cl ->> 'method', 'agent'), left(p_agent, 80))
      on conflict do nothing
      returning id into new_id;
      if new_id is null then err := 'staat er al'; end if;
    end if;
    out := out || jsonb_build_object('field', cl ->> 'field', 'claim_id', new_id, 'fout', err);
  end loop;
  return out;
end $$;

-- Kandidaten insturen en meteen proberen te koppelen. p_source mag leeg zijn als p_document is gegeven.
-- p_items: [{name, lat?, lng?, town?, province?, website?, phone?, kind_hint?, external_ref?}]
create or replace function public.bron_submit_candidates(p_source text, p_document bigint, p_items jsonb, p_agent text)
 returns jsonb
 language plpgsql
 security definer
 set search_path to ''
as $$
declare
  it jsonb;
  out jsonb := '[]'::jsonb;
  new_id bigint;
  k bron.candidates;
begin
  -- Zonder bron: de bron van het document waarin de plekken zijn gevonden.
  if p_source is null then
    select source_id into p_source from bron.documents where id = p_document;
  end if;
  if not exists (select 1 from bron.sources where id = p_source and status <> 'geblokkeerd') then
    raise exception 'Bron % bestaat niet of is geblokkeerd', coalesce(p_source, '(geen document)');
  end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) > 100 then
    raise exception 'p_items is een lijst van hoogstens 100 kandidaten';
  end if;
  for it in select * from jsonb_array_elements(p_items) loop
    begin
      insert into bron.candidates (source_id, document_id, external_ref, name, lat, lng, town, province, website, phone,
                                   kind_hint, submitted_by)
      values (p_source, p_document, coalesce(nullif(it ->> 'external_ref', ''), md5(lower(it ->> 'name') || coalesce(it ->> 'town', ''))),
              it ->> 'name', (it ->> 'lat')::double precision, (it ->> 'lng')::double precision, it ->> 'town',
              it ->> 'province', nullif(it ->> 'website', ''), nullif(it ->> 'phone', ''), nullif(it ->> 'kind_hint', ''),
              left(p_agent, 80))
      on conflict (source_id, external_ref) do update set updated_at = now()
      returning id into new_id;
      perform bron.match_candidate(new_id);
      select * into k from bron.candidates where id = new_id;
      out := out || jsonb_build_object('name', k.name, 'candidate_id', k.id, 'status', k.status,
                                       'matched_place_id', k.matched_place_id, 'match_reason', k.match_reason);
    exception when others then
      out := out || jsonb_build_object('name', it ->> 'name', 'fout', sqlerrm);
    end;
  end loop;
  return out;
end $$;

-- Volgend werk claimen (lease van een uur).
create or replace function public.bron_lease_work(p_agent text, p_kinds text[] default null)
 returns jsonb
 language plpgsql
 security definer
 set search_path to ''
as $$
declare w bron.work_items;
begin
  select * into w from bron.work_items
   where (status = 'open' or (status = 'bezig' and lease_until < now()))
     and (p_kinds is null or kind = any (p_kinds))
   order by priority, id
   limit 1
   for update skip locked;
  if w.id is null then return null; end if;
  update bron.work_items
     set status = 'bezig', leased_by = left(p_agent, 80), lease_until = now() + interval '1 hour',
         attempts = attempts + 1, updated_at = now()
   where id = w.id
  returning * into w;
  return to_jsonb(w);
end $$;

create or replace function public.bron_finish_work(p_id bigint, p_agent text, p_status text, p_note text default null,
                                                   p_result jsonb default null)
 returns jsonb
 language plpgsql
 security definer
 set search_path to ''
as $$
declare w bron.work_items;
begin
  if p_status not in ('klaar', 'mislukt', 'geblokkeerd', 'open') then raise exception 'Status is klaar, mislukt, geblokkeerd of open'; end if;
  update bron.work_items
     set status = p_status, note = left(p_note, 4000), result = p_result, updated_at = now(),
         leased_by = case when p_status = 'open' then null else leased_by end,
         lease_until = null
   where id = p_id and leased_by = left(p_agent, 80)
  returning * into w;
  if w.id is null then raise exception 'Werk % is niet aan % uitgegeven', p_id, p_agent; end if;
  return to_jsonb(w);
end $$;

-- Een bron melden als geblokkeerd (nooit weer openzetten: dat doet een mens).
create or replace function public.bron_block_source(p_source text, p_reason text, p_agent text)
 returns void
 language plpgsql
 security definer
 set search_path to ''
as $$
begin
  update bron.sources
     set status = 'geblokkeerd', updated_at = now(),
         terms_note = left(coalesce(terms_note || E'\n', '') || to_char(now(), 'YYYY-MM-DD') || ' ' || left(p_agent, 40)
                           || ': ' || left(p_reason, 400), 2000)
   where id = p_source and id not in ('eigen-site', 'eigenaar', 'osm');
  if not found then raise exception 'Bron % niet gevonden of niet te blokkeren', p_source; end if;
end $$;

create or replace function public.bron_decisions(p_place uuid)
 returns jsonb
 language sql
 security definer
 set search_path to ''
as $$
  select coalesce(jsonb_agg(to_jsonb(x) order by x.field), '[]'::jsonb) from bron.preview_changes(p_place) x;
$$;

-- Overzicht voor beheer en de MCP-server.
create or replace function public.bron_overview()
 returns jsonb
 language plpgsql
 security definer
 set search_path to ''
as $$
begin
  -- Beheer, de service-rol (MCP-server) of een directe databaseverbinding (SQL-editor, MCP van sessies).
  if not (public.is_admin()
          or nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role' = 'service_role'
          or (nullif(current_setting('request.jwt.claims', true), '') is null and session_user in ('postgres', 'supabase_admin'))) then
    raise exception 'Geen beheerrechten' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'bronnen', (select jsonb_object_agg(status, n) from (select status, count(*) n from bron.sources group by 1) s),
    'documenten', (select count(*) from bron.documents),
    'kandidaten', (select jsonb_object_agg(status, n) from (select status, count(*) n from bron.candidates group by 1) s),
    'claims', (select count(*) from bron.claims where status = 'open'),
    'besluiten', (select jsonb_object_agg(besluit, n) from (select besluit, count(*) n from bron.decisions() group by 1) s),
    'werk', (select jsonb_object_agg(status, n) from (select status, count(*) n from bron.work_items group by 1) s));
end $$;

revoke execute on function public.bron_fetch_slot(text, text), public.bron_resolve_source(text, text, uuid),
  public.bron_set_robots(text, boolean),
  public.bron_store_document(text, text, uuid, text, integer, date, text, text),
  public.bron_submit_claims(bigint, jsonb, text), public.bron_submit_candidates(text, bigint, jsonb, text),
  public.bron_lease_work(text, text[]), public.bron_finish_work(bigint, text, text, text, jsonb),
  public.bron_block_source(text, text, text), public.bron_decisions(uuid), public.bron_overview()
  from public, anon, authenticated;
grant execute on function public.bron_fetch_slot(text, text), public.bron_resolve_source(text, text, uuid),
  public.bron_set_robots(text, boolean),
  public.bron_store_document(text, text, uuid, text, integer, date, text, text),
  public.bron_submit_claims(bigint, jsonb, text), public.bron_submit_candidates(text, bigint, jsonb, text),
  public.bron_lease_work(text, text[]), public.bron_finish_work(bigint, text, text, text, jsonb),
  public.bron_block_source(text, text, text), public.bron_decisions(uuid), public.bron_overview()
  to service_role;
grant execute on function public.bron_overview() to authenticated;
revoke execute on all functions in schema bron from public, anon, authenticated;

-- ── Startdata ──────────────────────────────────────────────────────────────────────────────────────────────────

insert into bron.sources (id, name, domain, kind, tier, status, min_delay_s, terms_note) values
  ('osm', 'OpenStreetMap (Overpass)', 'openstreetmap.org', 'open_data', 1, 'toegestaan', 5, 'ODbL; naamsvermelding staat op de site.'),
  ('pdok', 'PDOK Locatieserver en BAG', 'pdok.nl', 'open_data', 1, 'toegestaan', 1, 'Open data van de overheid.'),
  ('eigen-site', 'Eigen website van de plek', null, 'eigen_site', 2, 'toegestaan', 5,
   'Geldt alleen als het domein gelijk is aan places.website van die plek (bron.source_for).'),
  ('eigenaar', 'Bevestiging door de eigenaar (site, Doe mee)', null, 'eigenaar', 2, 'toegestaan', 1, 'Geen e-mail naar eigenaren (besluit 18 oktober 2026).'),
  ('campercontact', 'Campercontact', 'campercontact.com', 'directory', 3, 'toegestaan', 15, 'Alleen feiten, laag tempo, geen bulk-overname (Databankenwet).'),
  ('park4night', 'park4night', 'park4night.com', 'directory', 3, 'toegestaan', 15, 'Alleen feiten, laag tempo, geen bulk-overname.'),
  ('acsi', 'ACSI / Eurocampings', 'eurocampings.nl', 'directory', 3, 'toegestaan', 15, 'Alleen feiten, laag tempo, geen bulk-overname.'),
  ('anwb', 'ANWB Kamperen', 'anwb.nl', 'directory', 3, 'toegestaan', 15, 'Alleen feiten, laag tempo, geen bulk-overname.'),
  ('camping-info', 'Camping.info', 'camping.info', 'directory', 3, 'toegestaan', 15, 'Alleen feiten, laag tempo, geen bulk-overname.'),
  ('zoover', 'Zoover', 'zoover.nl', 'reviews', 5, 'toegestaan', 15, 'Reviews: alleen afgeleide feiten met datum, geen tekst of namen.'),
  ('reddit', 'Reddit', 'reddit.com', 'forum', 4, 'toegestaan', 20, 'Openbare draden; geen gebruikersnamen opslaan.'),
  ('facebook', 'Facebook', 'facebook.com', 'forum', 4, 'geblokkeerd', 60, 'Inlogmuur: niet scrapen. De VrijStaan-groep alleen met toestemming van de beheerders (open besluit).'),
  ('instagram', 'Instagram', 'instagram.com', 'forum', 4, 'geblokkeerd', 60, 'Inlogmuur: niet scrapen.'),
  ('google-maps', 'Google Maps (scrapen)', 'google.com', 'reviews', 5, 'geblokkeerd', 60, 'Niet scrapen; alleen de officiële Places API (W4.4, open besluit).')
on conflict (id) do nothing;

insert into bron.work_items (kind, scope, priority, instructions)
-- Fora eerst in provincies met veel camperplaatsen en nog geen enkele zonder vertrektijd (nulmeting 18 oktober).
select k.kind, jsonb_build_object('provincie', p.name),
       k.prio - case when k.kind = 'ontdek_fora' and p.name in ('Friesland', 'Noord-Holland', 'Drenthe') then 25 else 0 end,
       k.instr
  from (values ('Groningen'), ('Friesland'), ('Drenthe'), ('Overijssel'), ('Flevoland'), ('Gelderland'), ('Utrecht'),
               ('Noord-Holland'), ('Zuid-Holland'), ('Zeeland'), ('Noord-Brabant'), ('Limburg')) p(name)
 cross join (values
   ('ontdek_gemeenten', 10, 'Zoek per gemeente in deze provincie naar officiële camperplaatsen (gemeentesite, VVV, raadsstukken). Lever kandidaten en claims met citaat.'),
   ('ontdek_jachthavens', 30, 'Zoek jachthavens in deze provincie die campers toelaten. Lever kandidaten en claims met citaat.'),
   ('ontdek_boerderij', 40, 'Zoek boerderij- en minicampings met camperplekken in deze provincie. Lever kandidaten en claims met citaat.'),
   ('ontdek_fora', 50, 'Zoek in openbare fora en reviews naar vermeldingen van plekken zonder vertrektijd in deze provincie. Lever claims met citaat, datum en mention_ref.')
 ) k(kind, prio, instr)
on conflict (kind, scope) do nothing;

select cron.schedule('bron-opschonen', '43 4 * * *', 'select bron.prune()');
