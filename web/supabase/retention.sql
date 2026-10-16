-- Bewaartermijnen uit de privacyverklaring automatisch toepassen. Eenmalig uitvoeren in de SQL-editor van Supabase.
-- Zelfde inhoud als het laatste deel van migrations/20261015090000_misbruik_en_bewaartermijnen.sql; de rest van die
-- migratie staat al live. Veilig om opnieuw uit te voeren.

-- ── Bewaartermijnen (privacyverklaring) ─────────────────────────────────────
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
  return r;
end $$;
revoke all on function private.apply_retention() from public, anon, authenticated;

do $$ begin
  if exists (select 1 from cron.job where jobname = 'retention') then perform cron.unschedule('retention'); end if;
  perform cron.schedule('retention', '17 3 * * *', 'select private.apply_retention()');
end $$;

-- Bestaande rijen met een token opschonen
update public.events set path = private.safe_path(path) where path like '/support/%';
update public.app_logs set context = jsonb_set(context, '{path}', to_jsonb(private.safe_path(context->>'path')))
 where context->>'path' like '/support/%';
