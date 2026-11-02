-- Marketing- en contentdashboard (/admin/marketing), plan docs/marketing/plan.md §4. Alles alleen voor rol admin
-- (public.has_admin_role(), migratie 20261101130000). Geen persoonsgegevens van bezoekers.
--
-- Wie schrijft wat:
--   seo_*            de dagelijkse GitHub Action (Search Console, PageSpeed) via SUPABASE_DB_URL
--   content_items    beheer (contentstudio, kalender)
--   marketing_jobs   beheer zet een opdracht klaar (video of schermopnames); de GitHub Action pakt hem op via
--                    SUPABASE_DB_URL, uploadt het bestand met de publishable key (alleen naar het eigen pad van
--                    een lopende job, zie public.marketing_upload_allowed) en meldt klaar
--   marketing_assets de Action (renders, schermopnames) en beheer (afbeeldingen)
--   campaigns, social_stats  beheer

-- ── Search Console en techniek ──────────────────────────────────────────────────────────────────────────────────────
create table if not exists public.seo_daily (
  date date not null,
  query text not null,
  page text not null,
  clicks integer not null default 0 check (clicks >= 0),
  impressions integer not null default 0 check (impressions >= 0),
  position numeric(6, 2),
  primary key (date, query, page)
);
create index if not exists seo_daily_page_idx on public.seo_daily (page, date);

-- Totalen per dag en apparaat: Search Console laat zeldzame zoekvragen weg, dus de som van seo_daily is lager
create table if not exists public.seo_totals (
  date date not null,
  device text not null default 'alle' check (device in ('alle', 'mobile', 'desktop', 'tablet')),
  clicks integer not null default 0,
  impressions integer not null default 0,
  position numeric(6, 2),
  primary key (date, device)
);

create table if not exists public.seo_pages (
  url text primary key check (char_length(url) <= 500),
  indexed boolean,
  verdict text,
  coverage text,
  last_crawl timestamptz,
  checked_at timestamptz not null default now()
);

-- Losse standen: sitemaps, Core Web Vitals, laatste run (sleutel → JSON)
create table if not exists public.seo_status (
  key text primary key check (char_length(key) <= 80),
  value jsonb not null default '{}',
  checked_at timestamptz not null default now()
);

-- ── Content ─────────────────────────────────────────────────────────────────────────────────────────────────────────
create table if not exists public.content_items (
  id uuid primary key default gen_random_uuid(),
  pillar text not null check (pillar in ('app', 'cijfers', 'hoe', 'regio', 'doe-mee', 'nieuw')),
  channel text not null check (channel in ('instagram', 'tiktok', 'facebook', 'google-ads')),
  title text not null check (char_length(title) between 1 and 120),
  body text not null default '' check (char_length(body) <= 3000),
  hashtags text[] not null default '{}',
  link text check (char_length(link) <= 500),
  status text not null default 'idee' check (status in ('idee', 'in-de-maak', 'klaar', 'geplaatst')),
  planned_on date,
  posted_url text check (char_length(posted_url) <= 500),
  posted_at timestamptz,
  facts_snapshot jsonb,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists content_items_planned_idx on public.content_items (planned_on);

create table if not exists public.marketing_jobs (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('video', 'schermopnames')),
  template text check (char_length(template) <= 40),
  format text check (format in ('vertical', 'square', 'portrait', 'landscape')),
  props jsonb not null default '{}',
  status text not null default 'wacht' check (status in ('wacht', 'bezig', 'klaar', 'fout')),
  error text check (char_length(error) <= 1000),
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz
);
create index if not exists marketing_jobs_open_idx on public.marketing_jobs (created_at) where status in ('wacht', 'bezig');

create table if not exists public.marketing_assets (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('video', 'afbeelding', 'schermopname')),
  template text check (char_length(template) <= 40),
  format text,
  title text check (char_length(title) <= 120),
  storage_path text not null check (char_length(storage_path) <= 300),
  job_id uuid references public.marketing_jobs (id) on delete set null,
  content_item_id uuid references public.content_items (id) on delete set null,
  facts_snapshot jsonb,
  created_at timestamptz not null default now()
);
create index if not exists marketing_assets_created_idx on public.marketing_assets (created_at desc);

-- ── Campagnes en sociale cijfers ────────────────────────────────────────────────────────────────────────────────────
create table if not exists public.campaigns (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 80),
  channel text not null check (channel in ('instagram', 'tiktok', 'facebook', 'google-ads', 'flyer', 'overig')),
  bron text not null check (bron ~ '^[a-z0-9-]{1,40}$'),
  campagne text not null check (campagne ~ '^[a-z0-9-]{1,40}$'),
  budget_eur numeric(8, 2) not null default 0 check (budget_eur >= 0),
  spent_eur numeric(8, 2) not null default 0 check (spent_eur >= 0),
  starts_on date,
  ends_on date,
  notes text check (char_length(notes) <= 1000),
  created_at timestamptz not null default now(),
  unique (bron, campagne)
);

create table if not exists public.social_stats (
  id uuid primary key default gen_random_uuid(),
  platform text not null check (platform in ('instagram', 'tiktok', 'facebook')),
  post_url text not null check (char_length(post_url) <= 500),
  content_item_id uuid references public.content_items (id) on delete set null,
  measured_on date not null default current_date,
  views integer check (views >= 0),
  reach integer check (reach >= 0),
  likes integer check (likes >= 0),
  comments integer check (comments >= 0),
  shares integer check (shares >= 0),
  saves integer check (saves >= 0),
  source text not null default 'handmatig' check (source in ('handmatig', 'api')),
  unique (post_url, measured_on)
);

-- ── Rechten: alleen admin ───────────────────────────────────────────────────────────────────────────────────────────
do $$
declare t text;
begin
  foreach t in array array['seo_daily', 'seo_totals', 'seo_pages', 'seo_status', 'content_items', 'marketing_jobs',
                           'marketing_assets', 'campaigns', 'social_stats'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format('drop policy if exists %I on public.%I', t || '_admin', t);
    execute format('create policy %I on public.%I for all to authenticated
      using ((select public.has_admin_role())) with check ((select public.has_admin_role()))', t || '_admin', t);
  end loop;
end $$;

create or replace function private.touch_updated_at() returns trigger language plpgsql set search_path to '' as $$
begin new.updated_at := now(); return new; end $$;
drop trigger if exists content_items_touch on public.content_items;
create trigger content_items_touch before update on public.content_items
  for each row execute function private.touch_updated_at();

-- ── Feitenbank ──────────────────────────────────────────────────────────────────────────────────────────────────────
-- "11:30" of "9.00" als minuten; null als het geen tijd is (zelfde regel als timeToMinutes in lib/format.ts)
create or replace function private.time_minutes(t text) returns integer language sql immutable set search_path to '' as $$
  select case when m is null or m[1]::int > 24 or m[2]::int > 59 then null else m[1]::int * 60 + m[2]::int end
  from (select regexp_match(coalesce(t, ''), '^\s*(\d{1,2})[:.](\d{2})\s*$') as m) x
$$;

/**
 * De cijfers die content mag gebruiken (plan §3.1), met meetmoment. Vertrekgroepen volgen departureKind
 * (lib/search.ts): vrij of per 24 uur zonder voorbehoud, uitslapers 12:00 of later, ruim 11:00 tot 12:00, vroeg eerder.
 */
create or replace function public.marketing_facts() returns jsonb
  language plpgsql stable security definer set search_path to ''
as $$
declare out jsonb;
begin
  if not public.has_admin_role() then raise exception 'Alleen voor beheerders' using errcode = '42501'; end if;
  with p as (
    select province, price_eur, created_at, verified_at, power, water, dump_station, dogs,
      case
        when departure in ('vrij', 'per24') and coalesce(departure_check, '') not in ('voorwaardelijk', 'afgewezen') then 'vrij'
        when departure = 'vast' and private.time_minutes(checkout_until) >= 720 then 'uitslapers'
        when departure = 'vast' and private.time_minutes(checkout_until) >= 660 then 'ruim'
        when departure = 'vast' and private.time_minutes(checkout_until) is not null then 'vroeg'
        else 'onbekend'
      end as dep
    from public.places where status = 'published'
  )
  select jsonb_build_object(
    'measured_at', now(),
    'places', (select count(*) from p),
    'provinces', coalesce((select jsonb_agg(jsonb_build_object('province', province, 'places', n) order by n desc)
                           from (select province, count(*) n from p where province is not null group by province) x), '[]'),
    'departure', (select jsonb_build_object(
        'known', count(*) filter (where dep <> 'onbekend'),
        'vrij', count(*) filter (where dep = 'vrij'),
        'uitslapers', count(*) filter (where dep = 'uitslapers'),
        'ruim', count(*) filter (where dep = 'ruim'),
        'vroeg', count(*) filter (where dep = 'vroeg')) from p),
    'price', (select jsonb_build_object(
        'known', count(*) filter (where price_eur is not null),
        'free', count(*) filter (where price_eur = 0),
        'median', round((percentile_cont(0.5) within group (order by price_eur) filter (where price_eur > 0))::numeric, 2)) from p),
    'facilities', (select jsonb_build_object(
        'power', count(*) filter (where power), 'water', count(*) filter (where water),
        'dump', count(*) filter (where dump_station), 'dogs', count(*) filter (where dogs)) from p),
    'new_7d', (select count(*) from p where created_at > now() - interval '7 days'),
    'new_30d', (select count(*) from p where created_at > now() - interval '30 days'),
    'checked_30d', (select count(*) from p where verified_at > now() - interval '30 days'),
    'reviews', (select jsonb_build_object('count', count(*), 'avg', round(avg(rating)::numeric, 1))
                from public.reviews where status = 'approved')
  ) into out;
  return out;
end $$;
revoke all on function public.marketing_facts() from public, anon;
grant execute on function public.marketing_facts() to authenticated;

-- ── Verkeer per bron (eigen statistiek, alleen bezoekers die toestemming gaven) ─────────────────────────────────────
create or replace function public.marketing_traffic(p_days integer default 28) returns jsonb
  language plpgsql stable security definer set search_path to ''
as $$
declare since timestamptz := now() - make_interval(days => least(greatest(coalesce(p_days, 28), 1), 400));
declare out jsonb;
begin
  if not public.has_admin_role() then raise exception 'Alleen voor beheerders' using errcode = '42501'; end if;
  with e as (
    select session_id, coalesce(nullif(props ->> 'bron', ''), 'direct') bron, nullif(props ->> 'campagne', '') campagne, ts
    from public.events where name = 'page_view' and ts >= since
  )
  select jsonb_build_object(
    'since', since,
    'sessions', (select count(distinct session_id) from e),
    'per_bron', coalesce((select jsonb_agg(jsonb_build_object('bron', bron, 'sessions', n) order by n desc)
                          from (select bron, count(distinct session_id) n from e group by bron) x), '[]'),
    'per_campagne', coalesce((select jsonb_agg(jsonb_build_object('bron', bron, 'campagne', campagne, 'sessions', n) order by n desc)
                              from (select bron, campagne, count(distinct session_id) n from e where campagne is not null group by 1, 2) x), '[]'),
    'per_dag', coalesce((select jsonb_agg(jsonb_build_object('date', d, 'sessions', n) order by d)
                         from (select ts::date d, count(distinct session_id) n from e group by 1) x), '[]')
  ) into out;
  return out;
end $$;
revoke all on function public.marketing_traffic(integer) from public, anon;
grant execute on function public.marketing_traffic(integer) to authenticated;

-- ── Search Console samengevat voor het dashboard (per zoekvraag of per pagina, positie gewogen naar vertoningen) ───
create or replace function public.marketing_seo_rows(p_days integer default 28, p_by text default 'query', p_limit integer default 500)
  returns jsonb language plpgsql stable security definer set search_path to ''
as $$
declare
  last_day date;
  out jsonb;
begin
  if not public.has_admin_role() then raise exception 'Alleen voor beheerders' using errcode = '42501'; end if;
  if p_by not in ('query', 'page') then raise exception 'p_by moet query of page zijn'; end if;
  select max(date) into last_day from public.seo_daily;
  if last_day is null then return '[]'::jsonb; end if;
  with d as (
    select * from public.seo_daily
    where date > last_day - least(greatest(coalesce(p_days, 28), 1), 480) and date <= last_day
  ), g as (
    select case when p_by = 'query' then query else page end as k,
      sum(clicks) clicks, sum(impressions) impressions,
      round(sum(position * impressions) / nullif(sum(impressions) filter (where position is not null), 0), 2) position,
      (array_agg(case when p_by = 'query' then page else query end order by impressions desc))[1] as other,
      count(distinct case when p_by = 'query' then page else query end) as n_other
    from d group by 1
  )
  select coalesce(jsonb_agg(jsonb_build_object(
      'query', case when p_by = 'query' then k else other end,
      'page', case when p_by = 'page' then k else other end,
      'clicks', clicks, 'impressions', impressions, 'position', position, 'count', n_other) order by impressions desc), '[]')
  into out
  from (select * from g order by impressions desc limit least(greatest(coalesce(p_limit, 500), 1), 2000)) x;
  return out;
end $$;
revoke all on function public.marketing_seo_rows(integer, text, integer) from public, anon;
grant execute on function public.marketing_seo_rows(integer, text, integer) to authenticated;

-- ── Opslag: privé bucket, admin leest; de Action uploadt alleen naar het pad van een lopende job ────────────────────
create or replace function public.marketing_upload_allowed(p_name text) returns boolean
  language sql stable security definer set search_path to ''
as $$
  select exists (
    select 1 from public.marketing_jobs j
    where j.status = 'bezig' and j.started_at > now() - interval '2 hours'
      and split_part(p_name, '/', 1) = 'jobs' and split_part(p_name, '/', 2) = j.id::text
  )
$$;
-- Staat in public (niet private, dat schema is bewust niet open voor anon): geeft alleen ja/nee voor een
-- niet te raden job-id, nodig voor de opslagregel hieronder
revoke all on function public.marketing_upload_allowed(text) from public;
grant execute on function public.marketing_upload_allowed(text) to anon, authenticated;

do $$
begin
  if to_regclass('storage.buckets') is null then return; end if;  -- tests zonder storage-schema
  insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('marketing', 'marketing', false, 104857600, array['video/mp4', 'image/png', 'image/jpeg', 'image/webp'])
  on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;
  execute 'drop policy if exists marketing_admin_all on storage.objects';
  execute $p$create policy marketing_admin_all on storage.objects for all to authenticated
    using (bucket_id = 'marketing' and (select public.has_admin_role()))
    with check (bucket_id = 'marketing' and (select public.has_admin_role()))$p$;
  execute 'drop policy if exists marketing_job_upload on storage.objects';
  execute $p$create policy marketing_job_upload on storage.objects for insert to anon
    with check (bucket_id = 'marketing' and public.marketing_upload_allowed(name))$p$;
end $$;

-- ── Jobs voor de GitHub Action (verbinding met SUPABASE_DB_URL; niet via de API bereikbaar) ─────────────────────────
-- Pakt de oudste wachtende job, of een job die al 2 uur "bezig" hangt (gecrashte run)
create or replace function private.marketing_claim_job() returns public.marketing_jobs
  language plpgsql security definer set search_path to ''
as $$
declare j public.marketing_jobs;
begin
  update public.marketing_jobs set status = 'bezig', started_at = now(), error = null
  where id = (select id from public.marketing_jobs
              where status = 'wacht' or (status = 'bezig' and started_at < now() - interval '2 hours')
              order by created_at limit 1 for update skip locked)
  returning * into j;
  return j;
end $$;

-- Klaar: de bestanden staan onder jobs/<id>/ in de bucket; p_assets = [{kind, path, title, format}]
create or replace function private.marketing_finish_job(p_id uuid, p_assets jsonb, p_error text default null) returns void
  language plpgsql security definer set search_path to ''
as $$
declare j public.marketing_jobs;
begin
  select * into j from public.marketing_jobs where id = p_id for update;
  if j.id is null then raise exception 'Onbekende job %', p_id; end if;
  if p_error is not null then
    update public.marketing_jobs set status = 'fout', error = left(p_error, 1000), finished_at = now() where id = p_id;
    return;
  end if;
  insert into public.marketing_assets (kind, template, format, title, storage_path, job_id, facts_snapshot)
  select a ->> 'kind', j.template, coalesce(a ->> 'format', j.format), left(a ->> 'title', 120), a ->> 'path', j.id,
         j.props -> 'facts'
  from jsonb_array_elements(coalesce(p_assets, '[]')) a
  where (a ->> 'path') like 'jobs/' || p_id::text || '/%';
  update public.marketing_jobs set status = 'klaar', finished_at = now() where id = p_id;
end $$;
revoke all on function private.marketing_claim_job() from public;
revoke all on function private.marketing_finish_job(uuid, jsonb, text) from public;

-- Bewaartermijnen (plan §4): jobs 30 dagen; assets 2 jaar (bestanden ruimt de Action op bij het opruimen)
create or replace function private.marketing_cleanup() returns void language sql security definer set search_path to '' as $$
  delete from public.marketing_jobs where finished_at < now() - interval '30 days';
  delete from public.seo_daily where date < current_date - interval '3 years';
$$;
revoke all on function private.marketing_cleanup() from public;

do $$
begin
  if to_regnamespace('cron') is null then return; end if;
  perform cron.unschedule(jobname) from cron.job where jobname = 'marketing-opruimen';
  perform cron.schedule('marketing-opruimen', '41 3 * * *', 'select private.marketing_cleanup()');
end $$;
