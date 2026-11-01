-- Mission Control, stap 1 (opdracht 1 november 2026): rol per account, logboek, update-wachtrij met AI-advies en
-- de dependency-radar. Zie docs/specs/05-backend-schema.md en README nummer 88 voor de keuzes.
--
-- Rol: `profiles.role` ('user', 'support', 'admin'). Bron blijft `public.admins` (uitnodiging via
-- private.admin_invites); een trigger houdt `profiles.role` gelijk. Gebruikers kunnen hun eigen rol niet wijzigen
-- (kolomrechten). Toegang tot de nieuwe tabellen: alleen `role = 'admin'` (public.has_admin_role()).

-- ── Rol ─────────────────────────────────────────────────────────────────────────────────────────────────────────────
alter table public.profiles add column if not exists role text not null default 'user';
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check check (role in ('user', 'support', 'admin'));

-- Eigen profiel wijzigen mag alleen naam en avatar; de rol nooit
revoke update on public.profiles from authenticated;
grant update (display_name, avatar_url, updated_at) on public.profiles to authenticated;

create or replace function private.sync_profile_role() returns trigger
 language plpgsql security definer set search_path to ''
as $$
begin
  if tg_op = 'DELETE' then
    update public.profiles set role = 'user' where id = old.user_id;
    return old;
  end if;
  insert into public.profiles (id, role) values (new.user_id, new.role)
  on conflict (id) do update set role = excluded.role;
  return new;
end $$;
revoke all on function private.sync_profile_role() from public, anon, authenticated;

drop trigger if exists admins_sync_profile_role on public.admins;
create trigger admins_sync_profile_role after insert or update of role or delete on public.admins
  for each row execute function private.sync_profile_role();

update public.profiles p set role = a.role from public.admins a where a.user_id = p.id and p.role is distinct from a.role;

/** true als de ingelogde gebruiker rol 'admin' heeft (niet 'support') */
create or replace function public.has_admin_role() returns boolean
 language sql stable security definer set search_path to ''
as $$
  select exists (select 1 from public.profiles where id = (select auth.uid()) and role = 'admin');
$$;
revoke all on function public.has_admin_role() from public, anon;
grant execute on function public.has_admin_role() to authenticated;

-- ── admin_logs: cron-resultaten, API-statussen en scraper-runs ─────────────────────────────────────────────────────
create table if not exists public.admin_logs (
  id bigint generated always as identity primary key,
  ts timestamptz not null default now(),
  kind text not null check (kind in ('cron', 'api', 'scraper', 'sync', 'deploy', 'security')),
  source text not null check (char_length(source) between 1 and 60),
  status text not null check (status in ('ok', 'failed', 'warn', 'pending')),
  message text check (char_length(message) <= 1000),
  http_status integer,
  duration_ms integer,
  request_id bigint,
  details jsonb not null default '{}'
);
create index if not exists admin_logs_ts on public.admin_logs (ts desc);
create index if not exists admin_logs_kind_source on public.admin_logs (kind, source, ts desc);
create index if not exists admin_logs_pending on public.admin_logs (request_id) where status = 'pending';

-- ── updates_queue: wijzigingen van gebruikers (Doe mee, later Plekpuls) met AI-advies ──────────────────────────────
create table if not exists public.updates_queue (
  id uuid primary key default gen_random_uuid(),
  place_id uuid not null references public.places (id) on delete cascade,
  field_changed text not null check (field_changed ~ '^[a-z_]{2,40}$'),
  old_value jsonb,
  new_value jsonb not null,
  source text not null default 'doe-mee' check (source in ('doe-mee', 'plekpuls', 'beheer', 'pipeline')),
  submission_id uuid references public.submissions (id) on delete set null,
  user_id uuid references auth.users (id) on delete set null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  ai_score smallint check (ai_score between 0 and 100),
  ai_advice text check (char_length(ai_advice) <= 300),
  ai_model text,
  ai_checked_at timestamptz,
  decided_by uuid references auth.users (id) on delete set null,
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  unique (submission_id, field_changed)
);
create index if not exists updates_queue_open on public.updates_queue (created_at) where status = 'pending';
create index if not exists updates_queue_place on public.updates_queue (place_id);

-- ── dependency_updates: de update-radar (Dependabot-PR's met AI-advies) ────────────────────────────────────────────
create table if not exists public.dependency_updates (
  id uuid primary key default gen_random_uuid(),
  package_name text not null check (char_length(package_name) between 1 and 214),
  version_from text check (char_length(version_from) <= 64),
  version_to text check (char_length(version_to) <= 64),
  update_type text check (update_type in ('major', 'minor', 'patch', 'onbekend')),
  ecosystem text check (char_length(ecosystem) <= 40),
  category text not null check (category in ('kritiek', 'aanbevolen', 'uitstellen')),
  ai_advice text check (char_length(ai_advice) <= 600),
  ai_model text check (char_length(ai_model) <= 80),
  status text not null default 'pending_review' check (status in ('auto-merged', 'pending_review', 'rejected')),
  pr_number integer,
  pr_url text check (pr_url ~ '^https://github\.com/[A-Za-z0-9._-]+/[A-Za-z0-9._-]+/pull/[0-9]+$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (pr_number, package_name)
);
create index if not exists dependency_updates_status on public.dependency_updates (status, updated_at desc);

-- ── RLS: alleen role = 'admin', via de frontend (anon niets) ───────────────────────────────────────────────────────
do $$
declare t text;
begin
  foreach t in array array['admin_logs', 'updates_queue', 'dependency_updates'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, public', t);
    execute format('revoke truncate, references, trigger on public.%I from authenticated', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format('drop policy if exists "alleen admin" on public.%I', t);
    execute format('create policy "alleen admin" on public.%I for all to authenticated
      using ((select public.has_admin_role())) with check ((select public.has_admin_role()))', t);
  end loop;
end $$;
grant all on public.admin_logs, public.updates_queue, public.dependency_updates to service_role;

-- ── Doe mee → updates_queue: elke inzending met een concrete wijziging wordt rijen per veld ───────────────────────
-- Drie vormen (src/lib/facility-update.ts, src/lib/submissions.ts, pipeline verify): voorzieningen {kolom: {was,
-- nieuw}}, {veld, voorstel} en {onderwerp: 'vertrektijd', vertrek_uiterlijk}. Andere inzendingen blijven alleen in
-- Beheer → Inzendingen staan.
create or replace function private.queue_from_submission(s public.submissions) returns integer
 language plpgsql security definer set search_path to ''
as $$
declare
  cur jsonb;
  n integer := 0;
  k text;
  v jsonb;
begin
  if s.place_id is null or s.kind <> 'correctie' then return 0; end if;
  select to_jsonb(p) into cur from public.places p where p.id = s.place_id;
  if cur is null then return 0; end if;

  if jsonb_typeof(s.payload -> 'voorzieningen') = 'object' then
    for k, v in select * from jsonb_each(s.payload -> 'voorzieningen') loop
      continue when k !~ '^[a-z_]{2,40}$' or not (v ? 'nieuw');
      insert into public.updates_queue (place_id, field_changed, old_value, new_value, submission_id, user_id)
      values (s.place_id, k, cur -> k, v -> 'nieuw', s.id, s.user_id)
      on conflict (submission_id, field_changed) do nothing;
      n := n + 1;
    end loop;
  elsif s.payload ->> 'veld' ~ '^[a-z_]{2,40}$' and s.payload ? 'voorstel' then
    insert into public.updates_queue (place_id, field_changed, old_value, new_value, submission_id, user_id)
    values (s.place_id, s.payload ->> 'veld', cur -> (s.payload ->> 'veld'), s.payload -> 'voorstel', s.id, s.user_id)
    on conflict (submission_id, field_changed) do nothing;
    n := 1;
  elsif s.payload ->> 'onderwerp' = 'vertrektijd' and coalesce(s.payload ->> 'vertrek_uiterlijk', '') <> '' then
    insert into public.updates_queue (place_id, field_changed, old_value, new_value, submission_id, user_id)
    values (s.place_id, 'departure', cur -> 'departure', to_jsonb(s.payload ->> 'vertrek_uiterlijk'), s.id, s.user_id)
    on conflict (submission_id, field_changed) do nothing;
    n := 1;
  end if;
  return n;
end $$;
revoke all on function private.queue_from_submission(public.submissions) from public, anon, authenticated;

create or replace function private.on_submission_queue() returns trigger
 language plpgsql security definer set search_path to ''
as $$
begin
  perform private.queue_from_submission(new);
  return new;
end $$;
revoke all on function private.on_submission_queue() from public, anon, authenticated;

drop trigger if exists submissions_to_queue on public.submissions;
create trigger submissions_to_queue after insert on public.submissions
  for each row execute function private.on_submission_queue();

-- Bestaande open inzendingen meenemen
do $$ begin perform private.queue_from_submission(s) from public.submissions s where s.status = 'nieuw'; end $$;

-- ── Accepteren en afwijzen (beheer) ────────────────────────────────────────────────────────────────────────────────
-- Accepteren schrijft in places (niet in geo_master: dat is de bronnenlaag, alleen voor de pipeline), zet het merkteken
-- van beheer (gaat voor website en OSM) en legt alles vast in audit_log. Alleen velden uit deze lijst.
create or replace function private.queue_fields() returns text[] language sql immutable set search_path to '' as $$
  select array['power', 'water', 'dump_station', 'toilet', 'shower', 'wifi', 'dogs', 'departure', 'checkout_until',
               'checkin_from', 'checkin_until', 'price_eur', 'price_note', 'capacity', 'max_length_m', 'open_all_year',
               'season', 'reservation', 'max_stay_nights', 'website', 'phone', 'email', 'operator']
$$;

-- Inzending afsluiten zodra al haar velden beoordeeld zijn: verwerkt als er minstens één is overgenomen, anders afgewezen
create or replace function private.close_submission(p_submission uuid, p_note text default null) returns void
 language plpgsql security definer set search_path to ''
as $$
begin
  if p_submission is null
     or exists (select 1 from public.updates_queue where submission_id = p_submission and status = 'pending') then
    return;
  end if;
  update public.submissions
     set status = case when exists (select 1 from public.updates_queue where submission_id = p_submission and status = 'approved')
                       then 'verwerkt' else 'afgewezen' end,
         admin_note = coalesce(nullif(trim(coalesce(p_note, '')), ''), admin_note)
   where id = p_submission and status = 'nieuw';
end $$;
revoke all on function private.close_submission(uuid, text) from public, anon, authenticated;

create or replace function public.admin_apply_update(p_id uuid) returns jsonb
 language plpgsql security definer set search_path to ''
as $$
declare
  u public.updates_queue;
  rec public.places;
begin
  if not public.has_admin_role() then raise exception 'Geen toegang' using errcode = '42501'; end if;
  select * into u from public.updates_queue where id = p_id for update;
  if not found then raise exception 'Onbekende update'; end if;
  if u.status <> 'pending' then raise exception 'Deze update is al afgehandeld'; end if;
  if not (u.field_changed = any (private.queue_fields())) then
    raise exception 'Veld % kan niet via de inbox worden aangepast', u.field_changed;
  end if;

  -- De waarde via het rijtype van places omzetten: een verkeerd type geeft een fout in plaats van rommel
  rec := jsonb_populate_record(null::public.places, jsonb_build_object(u.field_changed, u.new_value));
  execute format('update public.places set %1$I = ($1).%1$I where id = $2', u.field_changed) using rec, u.place_id;
  perform public.admin_mark_beheer(u.place_id, array[u.field_changed]);

  update public.updates_queue set status = 'approved', decided_by = auth.uid(), decided_at = now() where id = u.id;
  perform private.close_submission(u.submission_id);
  insert into public.audit_log (actor, actor_email, action, entity, entity_id, details)
  values (auth.uid(), (select email from auth.users where id = auth.uid()), 'update_accepted', 'places', u.place_id::text,
          jsonb_build_object('veld', u.field_changed, 'was', u.old_value, 'nieuw', u.new_value, 'update', u.id,
                             'ai_score', u.ai_score));
  return jsonb_build_object('id', u.id, 'status', 'approved');
end $$;
revoke all on function public.admin_apply_update(uuid) from public, anon;
grant execute on function public.admin_apply_update(uuid) to authenticated;

create or replace function public.admin_reject_update(p_id uuid, p_note text default null) returns jsonb
 language plpgsql security definer set search_path to ''
as $$
declare u public.updates_queue;
begin
  if not public.has_admin_role() then raise exception 'Geen toegang' using errcode = '42501'; end if;
  update public.updates_queue set status = 'rejected', decided_by = auth.uid(), decided_at = now()
   where id = p_id and status = 'pending' returning * into u;
  if not found then raise exception 'Onbekende of al afgehandelde update'; end if;
  perform private.close_submission(u.submission_id, p_note);
  insert into public.audit_log (actor, actor_email, action, entity, entity_id, details)
  values (auth.uid(), (select email from auth.users where id = auth.uid()), 'update_rejected', 'places', u.place_id::text,
          jsonb_build_object('veld', u.field_changed, 'nieuw', u.new_value, 'update', u.id, 'notitie', p_note));
  return jsonb_build_object('id', u.id, 'status', 'rejected');
end $$;
revoke all on function public.admin_reject_update(uuid, text) from public, anon;
grant execute on function public.admin_reject_update(uuid, text) to authenticated;

-- ── Dependency-radar: GitHub Actions → /api/admin/log-dependency → deze functie ────────────────────────────────────
-- De route heeft geen service-role-sleutel: ze geeft het geheim door en de database vergelijkt het (als SHA-256) met
-- internal_secrets.dependency_log_key. Zonder sleutel in de tabel weigert de functie alles.
create or replace function public.log_dependency(p_secret text, p_update jsonb) returns jsonb
 language plpgsql security definer set search_path to ''
as $$
declare
  expected text;
  d public.dependency_updates;
begin
  select value into expected from public.internal_secrets where name = 'dependency_log_key';
  if expected is null or p_secret is null
     or extensions.digest(p_secret, 'sha256') <> extensions.digest(expected, 'sha256') then
    raise exception 'Geen toegang' using errcode = '42501';
  end if;
  if not private.rate_take('dependency_log', 200, interval '1 hour') then
    raise exception 'Te veel meldingen';
  end if;

  insert into public.dependency_updates (package_name, version_from, version_to, update_type, ecosystem, category,
    ai_advice, ai_model, status, pr_number, pr_url)
  values (p_update ->> 'package_name', p_update ->> 'version_from', p_update ->> 'version_to',
          coalesce(p_update ->> 'update_type', 'onbekend'), p_update ->> 'ecosystem', p_update ->> 'category',
          left(p_update ->> 'ai_advice', 600), p_update ->> 'ai_model', coalesce(p_update ->> 'status', 'pending_review'),
          (p_update ->> 'pr_number')::integer, p_update ->> 'pr_url')
  on conflict (pr_number, package_name) do update set
    version_from = excluded.version_from, version_to = excluded.version_to, update_type = excluded.update_type,
    ecosystem = excluded.ecosystem, category = excluded.category, ai_advice = excluded.ai_advice,
    ai_model = excluded.ai_model, status = excluded.status, pr_url = excluded.pr_url, updated_at = now()
  returning * into d;

  insert into public.admin_logs (kind, source, status, message, details)
  values ('deploy', 'dependabot', case when d.category = 'kritiek' then 'warn' else 'ok' end,
          format('%s %s → %s: %s', d.package_name, coalesce(d.version_from, '?'), coalesce(d.version_to, '?'), d.category),
          jsonb_build_object('pr', d.pr_number, 'status', d.status));
  return jsonb_build_object('id', d.id, 'status', d.status);
end $$;
revoke all on function public.log_dependency(text, jsonb) from public;
grant execute on function public.log_dependency(text, jsonb) to anon, authenticated;

-- ── admin_logs vullen ──────────────────────────────────────────────────────────────────────────────────────────────
-- 1. Scraper- en sync-runs: zodra een ingest_run klaar is
create or replace function private.on_ingest_run_done() returns trigger
 language plpgsql security definer set search_path to ''
as $$
begin
  if new.finished_at is not null and (old.finished_at is null or tg_op = 'INSERT') then
    insert into public.admin_logs (kind, source, status, message, duration_ms, details)
    values (case when split_part(new.kind, ' ', 1) in ('osm', 'pdok', 'merge_master', 'promote') then 'sync' else 'scraper' end,
            left(new.kind, 60), case when new.status = 'ok' then 'ok' when new.status = 'error' then 'failed' else 'warn' end,
            left(coalesce(new.stats ->> 'error', new.stats ->> 'region', new.kind), 1000),
            (extract(epoch from new.finished_at - new.started_at) * 1000)::integer,
            coalesce(new.stats, '{}') || jsonb_build_object('run', new.id));
  end if;
  return new;
end $$;
revoke all on function private.on_ingest_run_done() from public, anon, authenticated;
drop trigger if exists ingest_runs_to_admin_logs on public.ingest_runs;
create trigger ingest_runs_to_admin_logs after insert or update of finished_at on public.ingest_runs
  for each row execute function private.on_ingest_run_done();

-- 2. API-statussen: elke 10 minuten een GET naar de diensten waar de site op leunt (pg_net, asynchroon). De volgende
--    ronde leest de antwoorden uit net._http_response; wie na 30 minuten niet antwoordde, telt als mislukt.
-- 3. Cron: elke mislukte run van pg_cron sinds de vorige ronde.
create or replace function private.ops_probe() returns jsonb
 language plpgsql security definer set search_path to ''
as $$
declare
  t record;
  rid bigint;
  last_run bigint;
  n_resolved integer;
  n_cron integer;
begin
  update public.admin_logs l
     set status = case when r.timed_out or r.error_msg is not null or r.status_code >= 400 then 'failed' else 'ok' end,
         http_status = r.status_code,
         duration_ms = greatest(0, (extract(epoch from r.created - l.ts) * 1000)::integer),
         message = coalesce(left(r.error_msg, 300), case when r.timed_out then 'time-out' end,
                            'HTTP ' || r.status_code)
    from net._http_response r
   where l.status = 'pending' and l.kind = 'api' and r.id = l.request_id;
  get diagnostics n_resolved = row_count;
  update public.admin_logs set status = 'failed', message = 'Geen antwoord binnen 30 minuten'
   where status = 'pending' and kind = 'api' and ts < now() - interval '30 minutes';

  for t in select * from (values
      ('pdok', 'https://api.pdok.nl/bzk/locatieserver/search/v3_1/suggest?q=utrecht&rows=1'),
      ('osrm', 'https://routing.openstreetmap.de/routed-car/route/v1/driving/5.12,52.09;5.38,52.24?overview=false'),
      ('overpass', 'https://overpass-api.de/api/status'),
      ('openfreemap', 'https://tiles.openfreemap.org/styles/liberty'),
      ('wsrv', 'https://wsrv.nl/?url=wsrv.nl/lichtenstein.jpg&w=16'),
      ('site', 'https://camperdashboard-vrijstaan.vercel.app/api/towns')
    ) as v(source, url) loop
    rid := net.http_get(url := t.url, timeout_milliseconds := 15000);
    insert into public.admin_logs (kind, source, status, request_id, details)
    values ('api', t.source, 'pending', rid, jsonb_build_object('url', t.url));
  end loop;

  select coalesce(max((details ->> 'runid')::bigint), 0) into last_run from public.admin_logs where kind = 'cron';
  insert into public.admin_logs (ts, kind, source, status, message, details)
  select d.start_time, 'cron', j.jobname, 'failed', left(d.return_message, 1000),
         jsonb_build_object('runid', d.runid, 'job', j.jobid)
    from cron.job_run_details d join cron.job j using (jobid)
   where d.runid > last_run and d.status = 'failed';
  get diagnostics n_cron = row_count;
  if last_run = 0 and n_cron = 0 then
    -- Watermerk zetten, zodat een eerste ronde zonder fouten niet steeds alles opnieuw bekijkt
    insert into public.admin_logs (kind, source, status, message, details)
    select 'cron', 'pg_cron', 'ok', 'Bewaking gestart', jsonb_build_object('runid', coalesce(max(runid), 0))
      from cron.job_run_details;
  end if;

  delete from public.admin_logs where (status = 'ok' and ts < now() - interval '30 days') or ts < now() - interval '180 days';
  return jsonb_build_object('resolved', n_resolved, 'cron_failed', n_cron);
end $$;
revoke all on function private.ops_probe() from public, anon, authenticated;

do $$ begin
  if exists (select 1 from cron.job where jobname = 'ops-probe') then perform cron.unschedule('ops-probe'); end if;
  perform cron.schedule('ops-probe', '*/10 * * * *', 'select private.ops_probe()');
end $$;
