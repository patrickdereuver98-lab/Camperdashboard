-- Gedragstests voor de bronnen- en claimslaag. Elke controle die mislukt, stopt de run met een melding.
create temp table result (label text);
grant insert, select on result to public;
create function pg_temp.eq(label text, got text, want text) returns void language plpgsql as $$
begin
  if got is distinct from want then raise exception '% — kreeg %, verwacht %', label, coalesce(got, 'null'), coalesce(want, 'null'); end if;
  insert into pg_temp.result values (label);
end $$;
create function pg_temp.err(q text) returns text language plpgsql as $$
begin execute q; return 'geen fout'; exception when others then return 'fout'; end $$;

insert into public.places (id, slug, name, town, website, lat, lng, departure) values
 ('00000000-0000-0000-0000-000000000001','camper-a','Camperplaats De Brink','Assen','https://www.camper-a.nl/',53.0,6.56, null),
 ('00000000-0000-0000-0000-000000000002','camper-b','Jachthaven Zuid','Emmen',null,52.78,6.9,'vast');

-- Bronnen
select pg_temp.eq('eigen site herkend', public.bron_resolve_source('https://camper-a.nl/tarieven', null, '00000000-0000-0000-0000-000000000001') ->> 'source_id', 'eigen-site');
select pg_temp.eq('onbekend forum = tier 4', public.bron_resolve_source('https://forum.kampeer.org/t/1', 'forum', null) ->> 'tier', '4');
select pg_temp.eq('gemeente = tier 1', public.bron_resolve_source('https://www.gemeente-assen.nl/x', 'directory', null) ->> 'tier', '1');
select pg_temp.eq('eigen_site zonder plek geeft geen tier 2', public.bron_resolve_source('https://sneaky.nl/x', 'eigen_site', null) ->> 'tier', '4');
select pg_temp.eq('facebook geblokkeerd', public.bron_resolve_source('https://m.facebook.com/groups/1', 'forum', null) ->> 'status', 'geblokkeerd');
select pg_temp.eq('document van geblokkeerde bron geweigerd', pg_temp.err($q$select public.bron_store_document('facebook','https://facebook.com/x',null,'server',200,null,'tekst','t')$q$), 'fout');
select pg_temp.eq('publicatiedatum in de toekomst geweigerd', pg_temp.err($q$select public.bron_store_document('eigen-site','https://camper-a.nl/x',null,'server',200,'2099-01-01','tekst','t')$q$), 'fout');

-- Claims en citaatcontrole
select pg_temp.eq('document 1', public.bron_store_document('eigen-site','https://camper-a.nl/tarieven','00000000-0000-0000-0000-000000000001','server',200,null,
  E'Tarieven 2026\nU kunt zelf bepalen wanneer u vertrekt; er is geen vaste vertrektijd.\nPrijs € 15,00 per nacht. Het motto is “vrij staan” – altijd.','test')::text, '1');
create temp table c1 as select public.bron_submit_claims(1, '[
 {"place_id":"00000000-0000-0000-0000-000000000001","field":"departure","value":"vrij","evidence":"U kunt  zelf bepalen wanneer u vertrekt"},
 {"place_id":"00000000-0000-0000-0000-000000000001","field":"price_eur","value":15,"evidence":"Prijs € 15,00 per nacht"},
 {"place_id":"00000000-0000-0000-0000-000000000001","field":"power","value":true,"evidence":"gratis stroom voor iedereen"},
 {"place_id":"00000000-0000-0000-0000-000000000001","field":"kleur","value":"rood","evidence":"Tarieven"},
 {"place_id":"00000000-0000-0000-0000-000000000001","field":"checkout_until","value":"11.00","evidence":"Tarieven"},
 {"place_id":"00000000-0000-0000-0000-000000000001","field":"departure","value":"vrij","evidence":"U kunt zelf bepalen wanneer u vertrekt"},
 {"place_id":"00000000-0000-0000-0000-000000000001","field":"access_24h","value":true,"evidence":"Het motto is \"vrij staan\" - altijd"}
]'::jsonb, 'test') r;
select pg_temp.eq('claim met citaat opgenomen', (select r->0->>'fout' from c1), null);
select pg_temp.eq('verzonnen citaat geweigerd', (select r->2->>'fout' from c1), 'citaat staat niet letterlijk in het document');
select pg_temp.eq('onbekend veld geweigerd', (select r->3->>'fout' from c1), 'onbekend veld: kleur');
select pg_temp.eq('tijd in verkeerd formaat geweigerd', (select r->4->>'fout' from c1), 'checkout_until is uu:mm');
select pg_temp.eq('dubbele claim geweigerd', (select r->5->>'fout' from c1), 'staat er al');
select pg_temp.eq('aanhalingstekens en streepjes gelijk', (select r->6->>'fout' from c1), null);
select pg_temp.eq('eigen site alleen = geaccepteerd', (select besluit from bron.decisions('00000000-0000-0000-0000-000000000001') where field = 'departure'), 'geaccepteerd');

-- Twee losse vermeldingen uit een forum (besluit 18 oktober)
select public.bron_store_document('forum.kampeer.org','https://forum.kampeer.org/t/1',null,'server',200,'2026-08-01',
  E'Post 12: bij Jachthaven Zuid mag je blijven zolang je wilt, geen vertrektijd!\nPost 13: klopt, ook bij ons geen vertrektijd daar.','test');
select public.bron_submit_claims(2, '[{"place_id":"00000000-0000-0000-0000-000000000002","field":"departure","value":"vrij","evidence":"mag je blijven zolang je wilt","mention_ref":"post-12","observed_on":"2026-08-01"}]'::jsonb,'test');
select pg_temp.eq('één forumvermelding = onvoldoende', (select besluit from bron.decisions('00000000-0000-0000-0000-000000000002')), 'onvoldoende');
select public.bron_submit_claims(2, '[{"place_id":"00000000-0000-0000-0000-000000000002","field":"departure","value":"vrij","evidence":"ook bij ons geen vertrektijd daar","mention_ref":"post-13","observed_on":"2026-08-02"}]'::jsonb,'test');
select pg_temp.eq('twee vermeldingen = geaccepteerd', (select besluit from bron.decisions('00000000-0000-0000-0000-000000000002')), 'geaccepteerd');

-- Oud telt niet, nieuwer tegenspreken = conflict, geblokkeerde bron telt niet meer
select public.bron_store_document('zoover','https://www.zoover.nl/r/9',null,'server',200,'2023-05-01',E'Review mei 2023: je moest om 11:00 weg.','test');
select public.bron_submit_claims(3, '[{"place_id":"00000000-0000-0000-0000-000000000002","field":"checkout_until","value":"11:00","evidence":"je moest om 11:00 weg","observed_on":"2023-05-01"}]'::jsonb,'test');
select pg_temp.eq('vermelding ouder dan 24 maanden telt niet', (select count(*)::text from bron.decisions('00000000-0000-0000-0000-000000000002') where field = 'checkout_until'), '0');
select public.bron_store_document('reddit','https://www.reddit.com/r/camper/1',null,'server',200,'2026-09-15',E'Afgelopen maand: vertrek voor 12 uur verplicht.','test');
select public.bron_submit_claims(4, '[{"place_id":"00000000-0000-0000-0000-000000000002","field":"departure","value":"vast","evidence":"vertrek voor 12 uur verplicht","observed_on":"2026-09-15"}]'::jsonb,'test');
select pg_temp.eq('nieuwere tegenspraak = conflict', (select besluit from bron.decisions('00000000-0000-0000-0000-000000000002') where field = 'departure'), 'conflict');
select public.bron_block_source('reddit','test','t');
select pg_temp.eq('geblokkeerde bron telt niet mee', (select besluit from bron.decisions('00000000-0000-0000-0000-000000000002') where field = 'departure'), 'geaccepteerd');
select pg_temp.eq('eigen-site niet te blokkeren', pg_temp.err($q$select public.bron_block_source('eigen-site','x','t')$q$), 'fout');

-- Tekst van een sessie = controle
select public.bron_store_document('eigen-site','https://camper-a.nl/faq','00000000-0000-0000-0000-000000000001','agent',null,null,E'Honden zijn welkom aan de lijn.','test');
select public.bron_submit_claims(5, '[{"place_id":"00000000-0000-0000-0000-000000000001","field":"dogs","value":true,"evidence":"Honden zijn welkom"}]'::jsonb,'test');
select pg_temp.eq('alleen door sessie ingestuurd = controle', (select besluit from bron.decisions('00000000-0000-0000-0000-000000000001') where field = 'dogs'), 'controle');
select pg_temp.eq('preview toont verschil met places', (select voorstel::text from bron.preview_changes() where slug = 'camper-b' and field = 'departure'), '"vrij"');

-- Kandidaten koppelen
create temp table k as select public.bron_submit_candidates(null, 2, '[
 {"name":"Camperplek Brink Assen","lat":53.0002,"lng":6.5601},
 {"name":"Nieuwe plek Ergens","lat":52.0,"lng":5.0},
 {"name":"De Brink","website":"https://camper-a.nl/","lat":53.01,"lng":6.57},
 {"name":"Buiten Nederland","lat":40,"lng":5}
]'::jsonb,'test') r;
select pg_temp.eq('dichtbij gekoppeld', (select r->0->>'status' from k), 'gekoppeld');
select pg_temp.eq('ver weg nieuw', (select r->1->>'status' from k), 'nieuw');
select pg_temp.eq('zelfde website gekoppeld', (select r->2->>'match_reason' from k), 'zelfde website');
select pg_temp.eq('buiten Nederland geweigerd', (select (r->3 ? 'fout')::text from k), 'true');

-- Werkverdeling en wachttijd
select pg_temp.eq('lease a', public.bron_lease_work('agent-a', array['ontdek_gemeenten'])->'scope'->>'provincie', 'Groningen');
select pg_temp.eq('lease b krijgt ander werk', public.bron_lease_work('agent-b', array['ontdek_gemeenten'])->'scope'->>'provincie', 'Friesland');
select pg_temp.eq('andermans werk niet afronden', pg_temp.err($q$select public.bron_finish_work(1,'agent-b','klaar')$q$), 'fout');
select pg_temp.eq('eigen werk afronden', public.bron_finish_work(1,'agent-a','klaar','test')->>'status', 'klaar');
select pg_temp.eq('eerste verzoek mag meteen', public.bron_fetch_slot('camper-a.nl','eigen-site')::text, '0');
select pg_temp.eq('tweede verzoek moet wachten', (public.bron_fetch_slot('camper-a.nl','eigen-site') > 0)::text, 'true');
select public.bron_set_robots('campercontact', false);
select pg_temp.eq('robots dicht blokkeert bron', (select status from bron.sources where id = 'campercontact'), 'geblokkeerd');

-- Rechten
select set_config('request.jwt.claims', '{"role":"authenticated"}', false);
select pg_temp.eq('ingelogde bezoeker geen overzicht', pg_temp.err('select public.bron_overview()'), 'fout');
select set_config('request.jwt.claims', '{"role":"service_role"}', false);
select pg_temp.eq('service-rol wel overzicht', pg_temp.err('select public.bron_overview()'), 'geen fout');
set role anon;
select pg_temp.eq('anon kan schema niet lezen', pg_temp.err('select * from bron.claims'), 'fout');
select pg_temp.eq('anon kan niet insturen', pg_temp.err($q$select public.bron_submit_claims(1,'[]','x')$q$), 'fout');
reset role;
