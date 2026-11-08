-- Review november 2026, R7 (DB-06, DB-07, DB-16) en DB-12.
--
-- 1. Rustiger ritme (live cron.job gelezen op 6 november 2026). discover, pdok-adres, osm-staging en osm-collect
--    draaiden elke minuut, met een volle tabelscan als bewaker, ook als er niets te doen was (wachtrijen leeg op
--    6 november). Dat gaf ±12.000 cronruns per dag; cron.job_run_details was 42% van de database. Nieuw ritme:
--      discover      elke 10 minuten (6 plekken per aanroep: 216 per uur bij een achterstand)
--      pdok-adres    elke 10 minuten (40 per aanroep: 240 per uur)
--      osm-staging   elke 5 minuten  (300 per aanroep: 3.600 per uur)
--      osm-collect   elke 5 minuten, alleen als er een Overpass-verzoek openstaat
--    De opdrachten zelf blijven gelijk aan live (alleen de bewaker van osm-collect is nieuw).
-- 2. Dode taak retention-cron-log weg (`select 1 where 1=0`; apply_retention ruimt cron.job_run_details al op).
-- 3. apply_retention: verwerkte rijen in osm_staging ouder dan 14 dagen weg. Ze bevatten contactgegevens van
--    beheerders uit OpenStreetMap en worden na verwerking niet meer gebruikt (21.508 rijen, 13.773 ouder dan 14 dagen).
--    De rest is gelijk aan de live versie van 6 november 2026.
-- 4. DB-12: indexen op vier foreign keys zonder index die bij het verwijderen van een plek of account worden
--    doorzocht (dagelijks opruimen van onbereikbare plekken, account verwijderen). De andere elf uit de adviezen van
--    Supabase verwijzen naar beheerders of marketing (weinig rijen) en blijven zo.
-- Live pas toepassen na samenvoegen (CLAUDE.md).

do $$
declare
  j record;
begin
  for j in select * from (values
      ('discover', '*/10 * * * *',
       $c$select private.call_discover(6) where exists (select 1 from public.places p where p.website is null and p.status in ('draft','published') and coalesce(p.name_is_generic,false) = false and p.name is not null and not (coalesce(p.sources,'{}'::jsonb) ? 'discovery'))$c$),
      ('pdok-adres', '*/10 * * * *',
       $c$select private.call_pipeline('{"action":"adres","n":40,"background":true}'::jsonb) where exists (select 1 from public.places where merged_into is null and (street is null or postcode is null) and not (coalesce(sources, '{}'::jsonb) ? 'pdok'))$c$),
      ('osm-staging', '*/5 * * * *',
       $c$select public.process_osm_staging(300) where exists (select 1 from public.osm_staging where processed_at is null)$c$),
      ('osm-collect', '*/5 * * * *',
       $c$select private.collect_osm() where exists (select 1 from public.osm_regions where places_req is not null)$c$)
    ) as v(name, schedule, command) loop
    if exists (select 1 from cron.job where jobname = j.name) then perform cron.unschedule(j.name); end if;
    perform cron.schedule(j.name, j.schedule, j.command);
  end loop;
  if exists (select 1 from cron.job where jobname = 'retention-cron-log') then perform cron.unschedule('retention-cron-log'); end if;
end $$;

create or replace function private.apply_retention()
 returns jsonb
 language plpgsql
 security definer
 set search_path to ''
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
  delete from public.osm_staging where processed_at < now() - interval '14 days';
  get diagnostics n = row_count; r := r || jsonb_build_object('osm_staging', n);
  delete from private.rate_counter where window_start < now() - interval '2 days';
  delete from cron.job_run_details where end_time < now() - interval '7 days';
  get diagnostics n = row_count; r := r || jsonb_build_object('cron_runs', n);
  perform private.log('info', 'retention', 'Bewaartermijnen toegepast', r);
  return r;
end $$;
revoke all on function private.apply_retention() from public, anon, authenticated;

create index if not exists geo_master_place_id on public.geo_master (place_id);
create index if not exists tickets_place_id on public.tickets (place_id);
create index if not exists duplicate_dismissals_b on public.duplicate_dismissals (b);
create index if not exists shared_trips_owner_id on public.shared_trips (owner_id);
