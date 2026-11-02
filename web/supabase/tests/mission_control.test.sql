-- Test voor migratie 20261101130000_mission_control.sql. Draai met run.sh (eigen database).
\set ON_ERROR_STOP 1

-- Rollen gesynchroniseerd uit admins
do $$ begin
  assert (select role from public.profiles where id = '00000000-0000-0000-0000-00000000000a') = 'admin', 'beheerder niet admin';
  assert (select role from public.profiles where id = '00000000-0000-0000-0000-00000000000b') = 'support', 'support niet support';
  assert (select role from public.profiles where id = '00000000-0000-0000-0000-00000000000c') = 'user', 'gast niet user';
end $$;

-- Bestaande inzendingen staan in de wachtrij: twee voorzieningen en een vertrektijd, met de oude waarde uit places
do $$ begin
  assert (select count(*) from public.updates_queue) = 3, 'verwacht 3 rijen in updates_queue';
  assert (select old_value from public.updates_queue where field_changed = 'power') = 'false'::jsonb, 'oude waarde power';
  assert (select old_value from public.updates_queue where field_changed = 'wifi') = 'null'::jsonb, 'oude waarde wifi';
  assert (select new_value from public.updates_queue where field_changed = 'departure') = '"12:00"'::jsonb, 'nieuwe vertrektijd';
end $$;

-- Nieuwe inzending komt via de trigger binnen; een inzending zonder concrete wijziging niet
insert into public.submissions (kind, place_id, payload) values
  ('correctie', '11111111-1111-1111-1111-111111111111', '{"veld": "price_eur", "voorstel": 17.5}'),
  ('correctie', '11111111-1111-1111-1111-111111111111', '{"toelichting": "alleen tekst"}');
do $$ begin
  assert (select count(*) from public.updates_queue) = 4, 'trigger maakte geen rij voor price_eur';
end $$;

-- Gewone gebruiker: ziet niets, kan zijn rol niet ophogen, kan niet accepteren
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000c';
do $$ begin
  assert (select count(*) from public.updates_queue) = 0, 'gast ziet de wachtrij';
  assert (select count(*) from public.admin_logs) = 0, 'gast ziet admin_logs';
  assert (select count(*) from public.dependency_updates) = 0, 'gast ziet dependency_updates';
  assert not public.has_admin_role(), 'gast heeft admin-rol';
  begin
    update public.profiles set role = 'admin' where id = '00000000-0000-0000-0000-00000000000c';
    assert false, 'gast kon zijn rol wijzigen';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.admin_apply_update((select id from public.updates_queue limit 1));
    assert false, 'gast kon accepteren';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.admin_logs (kind, source, status) values ('api', 'nep', 'ok');
    assert false, 'gast kon in admin_logs schrijven';
  exception when insufficient_privilege then null;
  end;
end $$;

-- Support-rol is geen admin
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
do $$ begin
  assert not public.has_admin_role(), 'support telt als admin';
  assert (select count(*) from public.updates_queue) = 0, 'support ziet de wachtrij';
end $$;

-- Beheerder: ziet alles, accepteert power (schrijft places + merkteken), wijst wifi af
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
do $$
declare p uuid; w uuid; pr uuid;
begin
  assert (select count(*) from public.updates_queue where status = 'pending') = 4, 'beheerder ziet niet alles';
  select id into p from public.updates_queue where field_changed = 'power';
  select id into w from public.updates_queue where field_changed = 'wifi';
  select id into pr from public.updates_queue where field_changed = 'price_eur';
  perform public.admin_apply_update(p);
  perform public.admin_apply_update(pr);
  perform public.admin_reject_update(w, 'Niet te controleren');
  update public.updates_queue set ai_score = 80, ai_advice = 'Logisch.' where id = w;
  begin
    perform public.admin_apply_update(p);
    assert false, 'tweede keer accepteren lukte';
  exception when raise_exception then null;
  end;
end $$;
reset role;
do $$ begin
  assert (select power from public.places) is true, 'power niet overgenomen';
  assert (select price_eur from public.places) = 17.5, 'prijs niet als getal overgenomen';
  assert (select sources -> 'beheer' from public.places) = '["price_eur"]'::jsonb, 'merkteken beheer ontbreekt';
  assert (select status from public.updates_queue where field_changed = 'wifi') = 'rejected', 'wifi niet afgewezen';
  assert (select count(*) from public.audit_log where action in ('update_accepted', 'update_rejected')) = 3, 'audit_log mist regels';
  -- Inzending 1 had power (geaccepteerd) en wifi (afgewezen): verwerkt
  assert (select status from public.submissions where payload ? 'voorzieningen') = 'verwerkt', 'inzending niet verwerkt';
end $$;

-- Veld buiten de lijst kan niet via de inbox
insert into public.updates_queue (place_id, field_changed, new_value) values ('11111111-1111-1111-1111-111111111111', 'status', '"hidden"');
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
do $$ begin
  perform public.admin_apply_update((select id from public.updates_queue where field_changed = 'status'));
  assert false, 'status kon via de inbox worden gezet';
exception when raise_exception then null;
end $$;
reset role;

-- Dependency-radar: zonder sleutel of met een verkeerde sleutel geweigerd, met de goede sleutel opgeslagen
set role anon;
do $$ begin
  perform public.log_dependency('iets', '{"package_name": "next", "category": "kritiek"}');
  assert false, 'log_dependency zonder sleutel in de tabel lukte';
exception when insufficient_privilege then null;
end $$;
reset role;
insert into public.internal_secrets (name, value) values ('dependency_log_key', 'geheim-123');
set role anon;
do $$ begin
  begin
    perform public.log_dependency('fout', '{"package_name": "next", "category": "kritiek"}');
    assert false, 'verkeerde sleutel geaccepteerd';
  exception when insufficient_privilege then null;
  end;
  perform public.log_dependency('geheim-123', '{"package_name": "next", "version_from": "16.0.1", "version_to": "16.0.2",
    "update_type": "patch", "category": "kritiek", "status": "auto-merged", "pr_number": 7,
    "pr_url": "https://github.com/patrickdereuver98-lab/camperdashboard/pull/7", "ai_advice": "Beveiligingsfix."}');
  perform public.log_dependency('geheim-123', '{"package_name": "next", "version_from": "16.0.1", "version_to": "16.0.3",
    "category": "aanbevolen", "pr_number": 7, "pr_url": "https://github.com/patrickdereuver98-lab/camperdashboard/pull/7"}');
end $$;
reset role;
do $$ begin
  assert (select count(*) from public.dependency_updates) = 1, 'upsert op pr_number + pakket werkt niet';
  assert (select version_to || ' ' || status from public.dependency_updates) = '16.0.3 pending_review', 'upsert niet bijgewerkt';
  assert (select count(*) from public.admin_logs where kind = 'deploy') = 2, 'deploy-log ontbreekt';
end $$;

-- Scraper-run komt in admin_logs; de probe zet API-checks klaar en verwerkt de antwoorden
insert into public.ingest_runs (kind, status) values ('osm NL-UT', 'running');
update public.ingest_runs set status = 'ok', finished_at = started_at + interval '2 seconds', stats = '{"places": 12}';
insert into cron.job (jobname) values ('scrape');
insert into cron.job_run_details (jobid, status, return_message) values (1, 'failed', 'ERROR: time-out');
do $$
declare first_id bigint;
begin
  assert (select count(*) from public.admin_logs where kind = 'sync' and source = 'osm NL-UT' and status = 'ok') = 1, 'sync-run niet gelogd';
  perform private.ops_probe();
  assert (select count(*) from public.admin_logs where kind = 'api' and status = 'pending') = 6, 'probes niet klaargezet';
  assert (select count(*) from public.admin_logs where kind = 'cron' and status = 'failed') = 1, 'mislukte cron niet gelogd';
  select min(request_id) into first_id from public.admin_logs where kind = 'api';
  insert into net._http_response (id, status_code, timed_out) values (first_id, 200, false), (first_id + 1, 503, false);
  perform private.ops_probe();
  assert (select status from public.admin_logs where request_id = first_id) = 'ok', 'antwoord 200 niet ok';
  assert (select status from public.admin_logs where request_id = first_id + 1) = 'failed', 'antwoord 503 niet failed';
  assert (select count(*) from public.admin_logs where kind = 'cron' and status = 'failed') = 1, 'cronfout dubbel gelogd';
  assert (select count(*) from cron.job where jobname = 'ops-probe') = 1, 'cron-taak ops-probe ontbreekt';
end $$;

select 'mission control: alle tests geslaagd' as uitkomst;
