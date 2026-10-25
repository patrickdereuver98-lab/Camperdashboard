# 5. Backend Schema

> Doel: vastleggen welke data we opslaan, hoe die samenhangt en wie wat mag.
> Bron: live database `qkrmthrhwmmmwswmfgwc` op 11 oktober 2026. Let op: `web/supabase/schema.sql` loopt achter
> (vertrektijden, toeslagen, `admin_stats` ontbreken) en moet opnieuw worden gegenereerd.

## Entiteiten

| Entiteit | Wat het is |
|---|---|
| `places` | Een plek om met de camper te staan (camperplaats, camping, camperparkeerplaats, boerderij, jachthaven) |
| `reviews` | Ervaring van een bezoeker met een plek, gemodereerd |
| `submissions` | Aanmelding van een nieuwe plek, correctie of eigenaarsclaim |
| `tickets` + `ticket_messages` | Supportvraag of DSA-melding, met berichten tussen klant en support |
| `faq` | Veelgestelde vraag met antwoord |
| `site_settings` | Instellingen als sleutel/waarde (contact, mededeling, `publish_threshold`, `website_photos`, `departure_mode`) |
| `admins` | Beheerder of supportmedewerker (gekoppeld aan Supabase Auth) |
| `events` | Anonieme gebeurtenis voor statistieken (alleen met toestemming) |
| `consent_log` | Bewijs van cookiekeuze |
| `audit_log` | Wie heeft wat veranderd in beheer |
| `app_logs` | Systeem- en pipelinemeldingen, clientfouten |
| `ingest_runs` | Verloop van data-imports |
| `nl_towns` | Woonplaatsen met coördinaten (zoeken en dichtstbijzijnde plaats) |
| `route_cache` | Gecachete routes en rijtijden |
| `osm_regions`, `osm_queries`, `osm_staging` | OSM-import per provincie: planning, queries en wachtrij |
| `internal_secrets` | Sleutel waarmee de database de edge function aanroept |
| `private.scrape_queue` | Wachtrij van websites die de scraper moet lezen |
| `private.stealth_queue` | Wachtrij van de stealth-lezer (Scrapling, [bronnenbeleid §3a](../bronnenbeleid.md)) |
| `private.admin_invites` | E-mailadressen die een beheeraccount mogen aanmaken |
| `profiles` | Profiel van een bezoekersaccount (naam en foto van Google/Apple/Facebook) |
| `user_trips` | Mijn reis van een ingelogde bezoeker (`stops` jsonb, ≤ 200) |
| `place_photos` | Foto van een bezoeker bij een plek, met moderatiestatus; goedgekeurd → `places.photos` |
| `duplicate_dismissals` | Paren plekken die beheer als "geen dubbel" heeft gemarkeerd |
| `crowd_reports` | Drukte-melding van een ingelogde camperaar (rustig, druk, vol); de site toont alleen de laatste 3 uur |
| `push_subscriptions` | Push-abonnement van een browser, gekoppeld aan een account |
| `user_vehicles` | Camperprofiel van een account (naam, maten, brandstof, verbruik) |
| `user_expenses` | Uitgaven onderweg van een account (kosten- en brandstoftracker) |
| `shared_trips` + `shared_trip_members` | Gedeelde reis (samen plannen) en wie meedoet |
| Storage `vehicle-docs` | Privé-map per account voor papieren van de camper (PDF of foto, max. 5 MB) |
| `crowd_watches` | Een ingelogde camperaar volgt een plek 24 uur en krijgt één pushmelding als het rustig wordt |
| `bron.sources` | Bronnenregister: per bron of domein de tier (1 open data/overheid tot 5 reviews) en wat mag ([bronnenbeleid](../bronnenbeleid.md)) |
| `bron.documents` | Een opgehaalde pagina (platte tekst, max. 60.000 tekens) met bron, adres en datum |
| `bron.candidates` | Een gevonden plek die nog niet of wel aan een bestaande plek is gekoppeld |
| `bron.claims` | Eén bewering over één veld van een plek, met letterlijk citaat uit een document |
| `bron.work_items` | Werkverdeling over sessies (per provincie en soort werk), met lease |

## Tabellen

### `places`

| Veld | Type | Verplicht | Standaard | Opmerking |
|---|---|---|---|---|
| `id` | uuid | ja | `gen_random_uuid()` | |
| `slug` | text | ja | | uniek, URL `/plek/<slug>` |
| `osm_type`, `osm_id` | text, bigint | | | samen uniek; leeg voor handmatige plekken |
| `name`, `name_is_generic` | text, boolean | ja | `false` | generiek = "Camperplaats Leek" omdat OSM geen naam had |
| `kind` | text | | | `camperplaats`, `camping`, `parkeerplaats`, `boerderij`, `jachthaven` |
| `lat`, `lng` | double | ja | | |
| `street`, `postcode`, `town`, `province` | text | | | |
| `description`, `description_source` | text | | | bron `website` of `openstreetmap` |
| `price_eur` | numeric | | | ≥ 0; laagste nachtprijs voor een kampeerplek |
| `price_note` | text | | | "vanaf € x per nacht; hoogste genoemde tarief € y" |
| `price_extras` | jsonb | | | `[{label, amount, unit?}]`, bv. Toeristenbelasting, Stroom, Per persoon, Kind, Hond, Douche, Water, Lozen, Extra auto |
| `tourist_tax_included` | boolean | | | |
| `power`, `water`, `dump_station`, `toilet`, `shower`, `wifi`, `dogs` | boolean | | | `null` = onbekend |
| `power_note` | text | | | |
| `capacity` | integer | | | 1–1.999 |
| `max_length_m` | numeric | | | |
| `surface` | text | | | `verhard`, `gras`, `gemengd`, `grind` |
| `open_all_year`, `season` | boolean, text | | | seizoen als "1 april – 31 oktober" |
| `reservation` | boolean | | | |
| `max_stay_nights` | integer | | | |
| `departure` | text | | | `vrij`, `per24`, `vast`; `null` = onbekend |
| `departure_check` | text | | | menselijke controle: `bevestigd`, `voorwaardelijk`, `afgewezen`; `null` = nog niet gecontroleerd. `null` en `bevestigd` staan allebei op Zonder vertrektijd zonder zichtbaar verschil (een bron is genoeg, besluit 18 oktober 2026); `bevestigd` sorteert alleen eerder bij gelijke stand; `voorwaardelijk` en `afgewezen` staan bij Overige. Wordt automatisch leeg als `departure`, `checkout_until` of `times_note` verandert, en na een jaar (cron `departure-recheck`) |
| `departure_checked_at`, `departure_checked_by` | timestamptz, text | | | wanneer en door wie (`beheer`, `eigenaar`); te zetten via RPC `check_departure` (alleen beheer) |
| `checkout_until`, `checkin_from` | text | | | formaat `uu:mm` |
| `checkin_until` | text | | | laatste aankomsttijd, `uu:mm` (scraper vanaf parser 41) |
| `reservation_rule` | text | | | `verplicht`, `mogelijk` of `niet_nodig`; leeg = onbekend. Het oude ja/nee-veld `reservation` blijft als terugval |
| `access_hours` | text | | | slagboom of poort, bv. `07:30–23:00` |
| `access_24h` | boolean | | | |
| `times_note` | text | | | letterlijke zin(nen) van de bron, of "Volgens OpenStreetMap" |
| `website`, `phone`, `email` | text | | | |
| `operator` | text | | | Beheerder uit OSM (gemeente, ondernemer); telt als contact voor publicatie (besluit 19 oktober 2026) |
| `image_url`, `image_credit`, `photos` | text, text, jsonb | | `[]` | foto's: `[{url, credit, permission?, license?, source?}]` |
| `rating_avg`, `rating_count` | numeric, integer | | `0` | bijgewerkt bij goedgekeurde reviews |
| `completeness` | numeric | ja | `0` | gewogen score 0–1, berekend door trigger |
| `status` | text | ja | `draft` | `draft`, `published`, `hidden` |
| `status_locked` | boolean | ja | `false` | handmatig vastgezet; trigger verandert de status dan niet |
| `geom` | geometry(Point, 4326) | | gegenereerd | uit `lng`/`lat`; GIST-indexen voor `places_in_bbox` en de dubbelen-zoektocht |
| `merged_into` | uuid | | | samengevoegd in deze plek; de oude slug stuurt door (`place_redirect`) |
| `sources` | jsonb | ja | `{}` | `osm`, `website` (tijdstip), `website_fields`, `beheer` (velden die beheer invulde), `duplicate_of`, `website_error` (`at`, `error`: website na drie pogingen niet te lezen; verdwijnt bij de volgende geslaagde scrape), `pdok` (`at`, `afstand`, `velden`: adres aangevuld via PDOK, ook vastgelegd als er niets binnen 75 m lag), `website_parser` (versie van de extractor bij de laatste scrape; een nieuwe versie wist kernvelden die ze niet meer vindt), `stealth` (stealth-lezer: `at`, `pages`, `robots_disallows`, `proxy`, of bij een fout `at`, `error`, `blocked`; zonder fout plant de gewone scraper de plek niet meer in) |
| `last_scraped_at`, `verified_at`, `created_at`, `updated_at` | timestamptz | | | `verified_at`: laatste scrape waarin de website iets over de plek zei |

Indexen: `slug` (uniek), `(osm_type, osm_id)` (uniek), `status`, `province`, trigram op `name`.

### Overige tabellen

| Tabel | Velden (verplicht met *) | Standaarden en indexen |
|---|---|---|
| `profiles` | id* (= auth.users.id), display_name (≤ 80), avatar_url (https), created_at*, updated_at* | alleen eigen rij lezen/wijzigen |
| `user_trips` | user_id* (pk), stops* (jsonb-array ≤ 200), updated_at* | alleen eigen rij |
| `place_photos` | id*, place_id*, user_id, storage_path* (`<user_id>/<uuid>.webp|jpg`), width/height (200–4.000), caption (≤ 140), credit (≤ 80), status* (`pending`, `approved`, `rejected`), reviewed_by, reviewed_at, created_at* | status `pending`; max. 20 per gebruiker per dag; vertrouwde gebruikers (`site_settings.trust`) worden automatisch goedgekeurd |
| `duplicate_dismissals` | a*, b* (a < b), dismissed_by, created_at* | alleen beheer |
| `shared_trips` | id*, owner_id*, name* (1–60), stops* (≤ 200), invite_code* (uniek, 18 hex), updated_by, updated_at*, created_at* | lezen en `stops`/`name` wijzigen alleen voor leden (`is_trip_member`); in de Realtime-publicatie; maken via `create_shared_trip`, meedoen via `join_shared_trip` (max. 6) |
| `shared_trip_members` | trip_id* + user_id* (pk), display_name, joined_at*, left_at | verlaten via `leave_shared_trip` (zet left_at) |
| `user_expenses` | user_id* (pk), entries* (jsonb-array ≤ 1.000: id, date, category, amountEur, liters?, placeSlug?, note?), updated_at* | alleen eigen rij; samenvoegen op id via `mergeExpenses` |
| `user_vehicles` | user_id* (pk), data* (jsonb, < 2 kB), updated_at* | alleen eigen rij; waarden gecontroleerd door `cleanVehicle` |
| Storage `vehicle-docs` | `<user_id>/<tijd>-<naam>` | niet openbaar; lezen, uploaden en weghalen alleen in je eigen map; openen via een ondertekende link van 60 seconden |
| `push_subscriptions` | id*, user_id*, endpoint* (uniek, https), p256dh*, auth*, created_at*, disabled_at | alleen via `push_subscribe`; uitgezet bij 404/410 van de pushdienst |
| `crowd_watches` | user_id* + place_id* (pk), created_at*, expires_at* (+24 uur), notified_at | via `watch_place` (max. 10 tegelijk); trigger op `crowd_reports` roept edge function `push` aan als de stand "rustig" wordt. VAPID-sleutels in `private.secrets` (alleen service_role) |
| `crowd_reports` | id*, place_id*, user_id*, level* (`rustig`, `druk`, `vol`), created_at* | melden via `report_crowd` (1 per persoon per plek per 30 min, max. 30 per dag); lezen via `crowd_status` (geaggregeerd, zonder persoonsgegevens); cron `crowd-retention` wist na 30 dagen |
| `reviews` | id*, place_id*, author_name*, author_email, rating* (1–10), score_location/quiet/facilities/value (1–10), title (≤120), body* (20–3.000), vehicle (`camper`, `buscamper`, `caravan`, `overig`), visited_month, status*, admin_note, user_id (→ `auth.users`, `ON DELETE SET NULL`), created_at* | status `pending`; index op place_id en op user_id. `author_email` komt uit het account van de schrijver (sinds migratie `20261022100000_reviews_met_account.sql`) |
| `submissions` | id*, kind* (`nieuw`, `correctie`, `eigenaar`), place_id, payload* (jsonb), contact_name, contact_email, status*, admin_note, created_at* | status `nieuw` |
| `tickets` | id*, number* (uniek), access_token* (uniek, willekeurig), name* (2–80), email*, subject* (3–140), category*, status*, priority*, place_id, assignee, created_at*, updated_at* | category `vraag`, status `open`, priority `normaal` |
| `ticket_messages` | id*, ticket_id*, author* (`klant`, `support`), admin_id, body* (1–5.000), internal* | internal `false`; index op ticket_id |
| `faq` | id*, category*, question*, answer*, position*, published*, updated_at* | published `true` |
| `site_settings` | key*, value* (jsonb) | |
| `admins` | user_id* (→ auth.users), email*, role* (`admin`, `support`), created_at* | role `admin` |
| `events` | id*, ts*, name* (page_view, search, place_view, outbound, route, save, review, ticket), path, props*, session_id | index op ts |
| `consent_log` | id*, ts*, consent_id*, analytics*, marketing*, version* | |
| `audit_log` | id*, ts*, actor, actor_email, action*, entity*, entity_id, details* | |
| `app_logs` | id*, ts*, level* (debug, info, warn, error), source*, message*, context* | index op ts |
| `ingest_runs` | id*, kind*, started_at*, finished_at, status* (running, ok, error), stats* | |
| `nl_towns` | id*, name*, province*, lat*, lng* | |
| `route_cache` | key*, distance_m*, duration_s*, geometry, provider*, created_at* | |
| `osm_regions` | code*, name*, last_run_at, places_req, points_req, attempt* | attempt `0` |
| `osm_staging` | id*, kind* (`place`, `point`), row*, created_at*, processed_at | index op onverwerkte rijen |
| `private.scrape_queue` | place_id*, attempts*, last_error, next_attempt_at*, done_at | |
| `private.stealth_queue` | place_id*, reason* (`onleesbaar`, `weinig`, `kernfeit`, `herlezen`), attempts*, next_attempt_at*, done_at, last_error, created_at* | Lease van een uur (`next_stealth_batch`); wegschrijven via `apply_stealth` → `apply_scrape` |

### Bronnenlaag (schema `bron`, dataplan Fase 0)

Migratie `20261018233000_bronnen_en_claims.sql`. Het schema staat niet open via de API: geen enkele rol behalve
`service_role` mag erin, en alles loopt via de functies hieronder. Niets in deze laag schrijft in `places`;
overnemen is taak W4.1 van het dataplan.

| Tabel | Velden (verplicht met *) | Regels |
|---|---|---|
| `bron.sources` | id* (slug), name*, domain (uniek), kind* (`open_data`, `overheid`, `eigen_site`, `eigenaar`, `directory`, `forum`, `reviews`, `api`), tier* (1–5), status* (`toegestaan`, `alleen_aanwijzing`, `te_beoordelen`, `geblokkeerd`), robots_ok, robots_checked_at, min_delay_s* (1–3600), terms_note, auto_registered*, reviewed_at | Onbekende domeinen worden bij het eerste gebruik geregistreerd met tier 3–5; tier 1 zet alleen een mens; tier 2 alleen voor het domein (bij gedeelde hosts het pad) uit `places.website` van de opgegeven plek; geblokkeerd gaat altijd voor |
| `bron.host_throttle` | host* (pk), last_fetch_at* | Wachttijd per host |
| `bron.documents` | id*, source_id*, url*, place_id, fetched_at*, fetched_by* (`server`, `agent`), http_status, content_hash*, published_on, extract* (1–60.000), submitted_by* | Uniek op (url, content_hash); na 30 dagen alleen de citaten (`bron.prune`) |
| `bron.candidates` | id*, source_id*, document_id, external_ref, name*, lat/lng (binnen Nederland, samen of geen van beide), town, province, website, phone, kind_hint, matched_place_id, match_score, match_reason, status* (`nieuw`, `gekoppeld`, `nieuwe_plek`, `afgewezen`, `dubbel`), submitted_by* | Uniek op (source_id, external_ref); gekoppeld bij dezelfde website, ≤ 60 m, ≤ 150 m met naam ≥ 30% gelijk, of naam ≥ 60% gelijk binnen 400 m |
| `bron.claims` | id*, place_id of candidate_id* (één van beide), field*, value* (jsonb, gecontroleerd door `bron.check_value`), document_id*, evidence* (≥ 15 genormaliseerde tekens, letterlijk in het document, met het getal of de tijd van de waarde; bij een eigen-site-document alleen voor die plek; bij tier 4–5 een datum verplicht), mention_ref, observed_on, method* (`regel`, `agent`, `mens`), status* (`open`, `afgewezen`, `ingehaald`), submitted_by* | Uniek op (plek, kandidaat, veld, document, vermelding, waarde) |
| `bron.work_items` | id*, kind*, scope* (jsonb), instructions, priority*, status* (`open`, `bezig`, `klaar`, `mislukt`, `geblokkeerd`), leased_by, lease_until, attempts*, result, note | Uniek op (kind, scope); lease van een uur, vrij na een dag |

**Beslisregel** (`bron.decisions`, per plek en veld, alleen vermeldingen van de laatste 24 maanden en bronnen die
niet geblokkeerd zijn): tier 1 of 2 is genoeg; tier 3 tot 5 vraagt twee losse vermeldingen met dezelfde waarde
(besluit 18 oktober 2026); los betekent een ander document of vermeldingsnummer én een ander citaat. Een nieuwere vermelding met een andere waarde maakt er een `conflict` van. Steunt het
besluit alleen op tekst die een sessie zelf instuurde, dan wordt het `controle`. Eén vermelding uit tier 3–5 is
`onvoldoende`. `bron.preview_changes` zet het besluit naast de huidige waarde in `places`.

**Functies (alleen `service_role`, voor de MCP-server `bronnen-mcp` en sessies):** `bron_resolve_source`,
`bron_fetch_slot`, `bron_set_robots`, `bron_store_document`, `bron_submit_claims`, `bron_submit_candidates`,
`bron_lease_work`, `bron_finish_work`, `bron_block_source`, `bron_decisions`. `bron_overview` mag ook beheer.

## Relaties

- `places` 1 → n `reviews` (`ON DELETE CASCADE`)
- `places` 1 → n `submissions`, `tickets` (`ON DELETE SET NULL`)
- `tickets` 1 → n `ticket_messages` (`CASCADE`)
- `admins` 1 → n `tickets.assignee`, `ticket_messages.admin_id` (`SET NULL`)
- `auth.users` 1 → 1 `admins` (`CASCADE`)
- `places` 1 → 1 `private.scrape_queue` (`CASCADE`)
- `places` 1 → 1 `private.stealth_queue` (`CASCADE`)

## Eigendom van records

- Bezoekers hebben geen account en bezitten geen records in de database. Bewaarde plekken, reis en cookiekeuze staan
  alleen op het apparaat (`localStorage`).
- Een ticket is van wie het `access_token` heeft (de persoonlijke link).
- Reviews en inzendingen zijn na indienen van VrijStaan (licentie via de voorwaarden); de indiener kan verwijdering
  vragen via contact.
- Alle beheerdata is van de beheerders samen; er is geen scheiding per team.

## Authenticatie

1. **Aanmelden:** `/admin` → "Nog geen account? Aanmaken" met een e-mailadres uit `private.admin_invites`.
2. Supabase stuurt een bevestigingsmail; na bevestigen maakt een trigger de rij in `admins` (rol uit de uitnodiging).
3. **Inloggen:** e-mail en wachtwoord (minstens 10 tekens). Sessie via Supabase Auth in de browser.
4. **Wachtwoord vergeten:** Supabase-resetmail (eigen SMTP aanbevolen, de ingebouwde mail is beperkt).
5. **Uitloggen:** knop in beheer; de sessie verloopt volgens de Supabase-instellingen.

## Autorisatie (Row Level Security)

| Tabel | Lezen | Aanmaken | Wijzigen | Verwijderen |
|---|---|---|---|---|
| `places` | iedereen: alleen `published`; beheer: alles | beheer | beheer | beheer |
| `reviews` | iedereen: alleen `approved`; beheer: alles | via `submit_review` (alleen ingelogd, bevestigd e-mailadres) | beheer | beheer |
| `faq` | iedereen: alleen `published`; beheer: alles | beheer | beheer | beheer |
| `site_settings`, `nl_towns`, `route_cache` | iedereen | beheer (instellingen), `cache_route` | beheer | — |
| `submissions` | beheer | via `submit_place` | beheer | beheer |
| `tickets`, `ticket_messages` | beheer; klant via `get_ticket(token)` | via `create_ticket`, `reply_ticket` | beheer | beheer |
| `events`, `consent_log` | beheer | via `track`, `log_consent` | — | — |
| `admins`, `audit_log`, `app_logs`, `ingest_runs` | beheer | systeem | — | — |
| `internal_secrets`, `private.*` | niemand via de API | systeem | systeem | systeem |

"Beheer" = `public.is_admin()`: elke gebruiker in `admins`, ongeacht rol.

**Functies (RPC):**

| Functie | Wie | Wat |
|---|---|---|
| `submit_place`, `create_ticket`, `reply_ticket`, `get_ticket` | iedereen | Invoer met validatie |
| `submit_review` | ingelogd (`authenticated`) met `email_confirmed_at`; anon heeft geen `EXECUTE` | Review indienen; `user_id` = `auth.uid()`, e-mailadres uit `auth.users`. Inloggen met de code per mail (`verifyOtp`) bevestigt het adres. Moderatie blijft: status `pending` |
| `track`, `log_consent`, `report_client_error` | iedereen | Statistieken (na toestemming), cookiekeuze, clientfouten |
| `cache_route` | server | Routecache vullen |
| `admin_overview`, `admin_stats(p_days)`, `admin_pipeline(p_action)` | beheer | Dashboard, statistieken, pipeline-knoppen (`scrape-missing`, `scrape-all`, `osm-refresh`, `apply-threshold`) |
| `apply_scrape`, `next_scrape_batch`, `enqueue_scrape`, `ingest_osm`, `ingest_osm_points`, `process_osm_staging`, `osm_response`, `export_snapshot` | pipeline/systeem | Data-import |
| `place_completeness(p)`, `place_meets_must_haves(p)` | trigger | Score en harde eisen voor publicatie |

## Datavalidatie en bedrijfsregels

- CHECK-constraints zoals in de tabellen hierboven (kind, surface, departure, status, scores, lengtes, e-mailformaat).
- `checkout_until`, `checkin_from` en `checkin_until` in `uu:mm`; `reservation_rule` alleen `verplicht`, `mogelijk` of `niet_nodig`.
- **Publicatie** (trigger `places_before_write`): een plek wordt `published` als
  1. er een website, telefoonnummer, e-mailadres of beheerder (OSM `operator`) is (besluit eigenaar 19 oktober 2026), én
  2. minstens 2 van 4 beslisfeiten bekend zijn: vertrekregel, openingsperiode, stroom, prijs, én
  3. `completeness` ≥ `site_settings.publish_threshold` (nu 0,45).
  Gewichten (20 punten): vertrekregel 4, seizoen 3, prijs 2, stroom 2, contact 2, foto 1,5, water 1, lozen 1, toilet 1,
  honden 1, beschrijving 0,5, echte naam 0,5, douche 0,25, aantal plekken 0,25. `status_locked` slaat dit over.
- **Gezag:** velden in `sources.beheer` worden nooit door de pipeline overschreven; websitewaarden gaan voor OSM bij
  prijs, seizoen en tijden; een websitewaarde die verdwijnt wordt gewist.
- **Niets verzinnen:** een veld zonder letterlijke bron blijft `null`.

## Bewaren en verwijderen

| Data | Termijn | Geautomatiseerd? |
|---|---|---|
| `events` | 13 maanden | Ja, zodra de migratie hieronder is uitgevoerd: `private.apply_retention()`, cron `retention` (03:17) |
| `consent_log` | 24 maanden | Idem |
| `app_logs` | 90 dagen; level `error` 12 maanden | Idem |
| Afgewezen `reviews` | 3 maanden | Idem |
| `tickets` (met berichten) | 12 maanden na `opgelost` of `gesloten` | Idem |
| Naam en e-mail bij inzendingen | 12 maanden na verwerking, daarna leeggemaakt | Idem |
| `private.rate_counter` | 2 dagen | Idem |
| `cron.job_run_details` | 7 dagen | Idem |
| `places` | Zolang relevant; verwijderen op verzoek van de eigenaar | Handmatig |
| `bron.documents` (tekst) | 30 dagen volledig, daarna alleen de citaten; zonder claims of kandidaten weg | Ja: `bron.prune()`, cron `bron-opschonen` (04:43) |
| `bron.host_throttle` | 7 dagen | Idem |

**Nog uit te voeren door de eigenaar:** het deel "Bewaartermijnen" van
`web/supabase/migrations/20261015090000_misbruik_en_bewaartermijnen.sql` in de SQL-editor (de MCP-tool vraagt bij
`delete` een bevestiging die vanuit een agent-sessie niet doorkomt). De rest van die migratie staat live.

## Misbruik beperken

Publieke functies tellen per tijdvak in `private.rate_counter` via `private.rate_take(emmer, limiet, tijdvak)`, zonder
IP-adres of sessie. Bij de eerste overschrijding komt één waarschuwing in `app_logs` (bron `limiet`).

| Functie | Limiet | Bij overschrijding |
|---|---|---|
| `track` | 300 per minuut, 20.000 per dag; `p_props` maximaal 600 bytes | Stil overslaan |
| `log_consent` | 60 per minuut, 3.000 per dag | Stil overslaan |
| `report_client_error` | 30 per minuut, 1.000 per dag | Stil overslaan |
| `submit_place` | 60 per uur, 300 per dag (plus 10 per uur per e-mailadres) | Melding "even erg druk" |
| `create_ticket` | 30 per uur, 150 per dag (plus 5 per uur per e-mailadres); bericht maximaal 5.000 tekens | Idem |
| `submit_review` | 5 per uur per plek, 400 per dag (plus 5 per uur per account) | Idem |

Paden onder `/support/` gaan via `private.safe_path()` als `/support/[token]` de database in, in `track` en
`report_client_error`. De API-routes `/api/route` en `/api/distances` hebben een limiet van 30 per minuut per
bezoeker, in het werkgeheugen van de server.

Beheer markeert handmatig gewijzigde velden met `admin_mark_beheer(plek, velden[])`, dat ze server-side toevoegt aan
`sources.beheer` zonder de rest van `sources` te overschrijven.

Exporteren: `export_snapshot()` geeft alle gepubliceerde plekken, woonplaatsen, FAQ en reviews als JSON.

## Migraties en startdata

- Wijzigingen via Supabase-migraties (MCP `apply_migration` of de SQL-editor), en dezelfde SQL als bestand in
  `web/supabase/migrations/` (vanaf 15 oktober 2026). Na elke wijziging `web/supabase/schema.sql` opnieuw genereren,
  en de TypeScript-types in `web/src/lib/database.types.ts` (MCP `generate_typescript_types`).
- Startdata: `web/supabase/seed.sql` (instellingen, FAQ, woonplaatsen, OSM-queries en provincies).
- Nieuw project opzetten: `schema.sql` → `seed.sql` → edge function `pipeline` deployen (zonder JWT) → sleutel in
  `internal_secrets` (`pipeline_key`) → projectnaam aanpassen in `private.call_pipeline`.
- **Opruimen:** de testtabellen `private.probe` en `private.probe2` mogen weg.
