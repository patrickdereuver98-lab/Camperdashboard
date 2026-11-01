-- Beveiligingsaudit 1 november 2026 (docs/beveiliging/verbeterplan.md): B5, B6, B11 en B17.
-- Losstaand van de websitecode: kan live zodra hij getest is.

-- ── B5: bezoekers schrijven alleen via functies, nooit rechtstreeks in tabellen ─────────────────────────────────────
-- Supabase geeft anon en authenticated standaard alle rechten; RLS hield alles tegen, maar één verkeerde policy was
-- genoeg voor een lek. TRUNCATE valt buiten RLS en hoort bij niemand behalve de eigenaar.
do $$
declare t text;
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('revoke insert, update, delete, truncate on public.%I from anon', t);
    execute format('revoke truncate on public.%I from authenticated', t);
  end loop;
end $$;

-- Tabellen waar ingelogde gebruikers niets rechtstreeks schrijven (geen policy, of alleen via functies en de pipeline)
revoke insert, update, delete on public.admins, public.app_logs, public.audit_log, public.consent_log, public.events,
  public.ingest_runs, public.internal_secrets, public.nl_towns, public.osm_queries, public.osm_regions,
  public.osm_staging, public.route_cache from authenticated;
-- Profiel: alleen bijwerken (policy "eigen profiel wijzigen"); aanmaken doet de trigger
revoke insert, delete on public.profiles from authenticated;

-- Nieuwe tabellen krijgen deze rechten ook niet meer vanzelf
alter default privileges for role postgres in schema public revoke insert, update, delete, truncate on tables from anon;
alter default privileges for role postgres in schema public revoke truncate on tables from authenticated;

-- ── B11: hulpfuncties die bezoekers zonder account niet nodig hebben ───────────────────────────────────────────────
-- is_admin() blijft: de leespolicies van places en reviews gelden ook voor anon en roepen hem aan.
revoke execute on function public.is_trip_member(uuid) from anon, public;

-- ── B17: grootte van reizen en uitgaven begrenzen (grootste bestaande rij: 280 bytes) ──────────────────────────────
alter table public.user_trips drop constraint if exists user_trips_stops_size;
alter table public.user_trips add constraint user_trips_stops_size check (pg_column_size(stops) < 200000);
alter table public.shared_trips drop constraint if exists shared_trips_stops_size;
alter table public.shared_trips add constraint shared_trips_stops_size check (pg_column_size(stops) < 200000);
alter table public.user_expenses drop constraint if exists user_expenses_entries_size;
alter table public.user_expenses add constraint user_expenses_entries_size check (pg_column_size(entries) < 500000);

-- ── B6: bewaartermijnen uit de privacyverklaring (was web/supabase/retention.sql, nooit uitgevoerd) ─────────────────
create or replace function private.apply_retention()
 returns jsonb language plpgsql security definer set search_path to ''
as $$
declare r jsonb := '{}'; n int;
begin
  delete from public.events where ts < now() - interval '13 months';
  get diagnostics n = row_count; r := r || jsonb_build_object('events', n);
  delete from public.consent_log where ts < now() - interval '24 months';
  get diagnostics n = row_count; r := r || jsonb_build_object('consent_log', n);
  delete from public.app_logs where (level <> 'error' and ts < now() - interval '90 days') or ts < now() - interval '12 months';
  get diagnostics n = row_count; r := r || jsonb_build_object('app_logs', n);
  delete from public.reviews where status = 'rejected' and created_at < now() - interval '3 months';
  get diagnostics n = row_count; r := r || jsonb_build_object('rejected_reviews', n);
  delete from public.tickets where status in ('opgelost', 'gesloten') and updated_at < now() - interval '12 months';
  get diagnostics n = row_count; r := r || jsonb_build_object('tickets', n);
  update public.submissions set contact_name = null, contact_email = null
   where status <> 'nieuw' and created_at < now() - interval '12 months' and (contact_name is not null or contact_email is not null);
  get diagnostics n = row_count; r := r || jsonb_build_object('submission_contacts', n);
  delete from private.rate_counter where window_start < now() - interval '2 days';
  delete from cron.job_run_details where end_time < now() - interval '7 days';
  get diagnostics n = row_count; r := r || jsonb_build_object('cron_runs', n);
  perform private.log('info', 'retention', 'Bewaartermijnen toegepast', r);
  return r;
end $$;
revoke all on function private.apply_retention() from public, anon, authenticated;

do $$ begin
  if exists (select 1 from cron.job where jobname = 'retention') then perform cron.unschedule('retention'); end if;
  perform cron.schedule('retention', '17 3 * * *', 'select private.apply_retention()');
end $$;
