-- Bewaartermijnen uit de privacyverklaring automatisch toepassen (eenmalig uitvoeren in de SQL-editor van Supabase).
-- Statistieken 13 maanden, cookiekeuzes 24 maanden, systeemmeldingen 90 dagen, afgewezen reviews 3 maanden.
create or replace function private.apply_retention()
 returns jsonb language plpgsql security definer set search_path to ''
as $$
declare a int; b int; c int; d int;
begin
  delete from public.events where ts < now() - interval '13 months'; get diagnostics a = row_count;
  delete from public.consent_log where ts < now() - interval '24 months'; get diagnostics b = row_count;
  delete from public.app_logs where ts < now() - interval '90 days' and level <> 'error'; get diagnostics c = row_count;
  delete from public.reviews where status = 'rejected' and created_at < now() - interval '3 months'; get diagnostics d = row_count;
  return jsonb_build_object('events', a, 'consent_log', b, 'app_logs', c, 'rejected_reviews', d);
end $$;
select cron.schedule('retention', '17 3 * * *', 'select private.apply_retention()');
