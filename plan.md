# VrijStaan: plan om de app af te maken (16 oktober 2026)

Dit plan voegt alles samen wat nog open staat, uit:

- de checklist "Vibe code your app, yes. But ..." (35 punten om een app echt productieklaar te maken);
- de zes open PR's en het samenwerkingsbord (`docs/samenwerking.md` op PR #9);
- de audit van 12 oktober (PR #9), de review van oktober (`docs/review-2026-10.md`, PR #10) en het verbeterplan na de
  feature review (`plan.md` op PR #11 en #12);
- een controle van de live database en de Supabase-advisors op 16 oktober.

Dit bestand vervangt de `plan.md` van PR #11 en #12. Wat daar stond, staat hieronder in §4 tot en met §6, met
dezelfde codes (K, P, S, N, E, C, D) zodat je de herkomst kunt nalezen.

Status: ✅ klaar op `main` · 🟢 gebouwd en samengevoegd in `acceptatie` (PR genoemd), live na de merge naar `main` · 🔄 bezig · ⬜ open · 👤 alleen Patrick.

---

## 1. Waar we staan: de checklist

| Punt | Status | Waar |
|---|---|---|
| CI/CD | 🟢 | CI in PR #10 (lint, typecheck, 15 tests, offline build); Playwright in PR #4. Uitrol via Vercel draait al |
| Unit-tests | 🟢 | PR #10 (`web/tests/`, extractor en zoeken) en PR #4 (17 testbestanden) |
| Smoke- en regressietests | 🟢 / ⬜ | Playwright-basis in PR #4. Zes kernflows als e2e (E4) open |
| SEO en vindbaarheid (sitemap, robots.txt, gestructureerde data) | ✅ / 🔄 | Sitemap, robots en JSON-LD op `main`. Landingspagina's per provincie, plaats en vertrekgroep met server-side lijst op `claude/seo-paginas` (22 okt). Het zoekscherm zelf blijft in de browser (B4) |
| Alerting | 🟢 | #13: `monitor.yml` (site, database, aantal plekken), GitHub mailt bij een fout |
| Performance monitoring | ⬜ | Lighthouse-budget in CI (E4). Nu LCP 4 tot 6,6 s door de cookiebanner; banner is verkleind in PR #10 |
| Analytics | ✅ | Eigen statistieken, alleen met toestemming, zonder cookies of derden |
| Auth op elk endpoint | ✅ / ⬜ | RLS op alle tabellen, beheer-RPC's controleren `is_admin()`. Open: rollen admin en support scheiden, MFA, open aanmelding (B-0.4) |
| Dependency audit | 🟢 | #13: `maplibre-gl` 5 → 6.14 (kritiek XSS-lek), `npm audit --omit=dev` = 0, Dependabot |
| Testen op meerdere toestellen | ⬜ 👤 | Testplan M6 op iPhone en Android |
| Testen op trage netwerken | ⬜ | Lighthouse met gesimuleerd 4G (E4); offline-basis (P12) |
| Uitgavenlimieten en betaalmeldingen | 🟢 👤 | Uitgelegd in `docs/draaiboek.md` §4; alles draait nu gratis, dus geen rekening mogelijk |
| Database back-up | 🟢 👤 | #13: `backup.yml` wekelijks, versleuteld. Werkt pas na twee geheimen in GitHub |
| Echt een herstel testen | 🟢 👤 | Zelfde workflow zet elke back-up terug in een lege database en vergelijkt de rijen |
| Plan om terug te draaien | 🟢 | #13: `docs/draaiboek.md` §1 |
| Geheimen buiten de repo | ✅ | Alleen de publieke sleutel staat in de repo. Edge functions lezen de sleutel nog uit de database (B-0.7) |
| Gelekte sleutels vervangen | ✅ | Niets gelekt gevonden |
| Rate limiting | 🟢 | PR #10: limieten per tijdvak op alle publieke RPC's, 30 per minuut op `/api/route` en `/api/distances` |
| Foutregistratie | ✅ / ⬜ | Browserfouten naar `app_logs`. Serverfouten (`onRequestError`) nog niet (E7) |
| Logging | ✅ | `app_logs`, auditlog en ingest-runs in Beheer → Logs |
| Uptime-bewaking | 🟢 | #13: `monitor.yml` elk uur, zodra `SITE_URL` is gezet |
| Testomgeving | 🔄 | Branch `acceptatie` met Vercel-preview (besluit B9 nog bevestigen) |
| Eigen domein en SSL | ⬜ 👤 | Domein koppelen in Vercel, `NEXT_PUBLIC_SITE_URL` zetten |
| E-mail (SPF, DKIM, DMARC) | ⬜ 👤 | Uitleg in `docs/draaiboek.md` §5; eerst mailprovider kiezen (B7) |
| Echte 404-, 500-, lege en laadstaten | ✅ / ⬜ | 404, 500 en lege staten bestaan. Geen `loading.tsx` (P6); kaartfout zonder knoppen (fase 1, punt 8) |
| Evals, prompt-injectie, terugval model, tokenlimieten | n.v.t. | VrijStaan gebruikt geen taalmodel |
| Toegankelijkheid | 🔄 | Tikdoelen en focusring deels in PR #10. Open: P13, kaartmarkers ≥ 44 px (P3), verklaring laten kloppen |
| Privacyverklaring en voorwaarden | ✅ / 👤 | Pagina's staan. Bedrijfsgegevens ontbreken nog (B8); nalezen door een jurist |
| Cookietoestemming | ✅ | Banner met bewijs van toestemming; compacter in PR #10 |
| Account en gegevens laten verwijderen | 🟢 👤 | Accounts in PR #4 met verwijderen in twee stappen. `delete_my_account` moet Patrick live zetten (B5) |
| Wachtwoord-reset | ✅ / 👤 | Zit in beheer. Werkt pas betrouwbaar met eigen SMTP (B7) |
| E-mailverificatie | ⬜ 👤 | Hangt aan SMTP en de Site URL in Supabase Auth |
| Deelafbeeldingen en favicon | ✅ / 🟢 | Favicon en app-icoon op `main`; standaard-deelafbeelding in PR #10 |
| Foto's optimaliseren | ✅ / 🟢 | Verkleind via wsrv.nl; scherpere foto's en miniaturen in PR #5 |
| Caching | ✅ | Cache Components van Next.js, service worker; begrensde cache in PR #10 |
| README | ✅ | `README.md`, `web/README.md`, `docs/HANDLEIDING.md`, nu ook `docs/draaiboek.md` |

**In het kort:** het meeste is gebouwd, maar het ligt verspreid over zes PR's die nog niet zijn samengevoegd. Het
grootste werk is nu samenvoegen, daarna een korte ronde met dingen die alleen Patrick kan doen.

---

## 2. Samenvoegen: gedaan (16 oktober 2026)

Alle open PR's zijn in de goedgekeurde volgorde samengevoegd naar `acceptatie`: #6, #10, #13, #5, #4, #12, en de
documenten van #11 en #9. Na elke stap waren lint, typecheck, 74 unit-tests, de offline build en 90 E2E-tests groen.
Hoe de botsingen zijn opgelost staat in de merge-commits en in `docs/samenwerking.md` §0.

**Nog te doen door Patrick:** de PR van `acceptatie` naar `main` bekijken op de Vercel-preview en samenvoegen. Daarna
branch protection op `main` en `acceptatie` aanzetten (alleen via PR, CI groen).

---

## 3. Besluiten en handelingen die alleen Patrick kan doen

| # | Wat | Waarom het nu telt | Tijd |
|---|---|---|---|
| B6 | Beheeraccount aanmaken op `/admin` (live: 0 gebruikers) | Zonder beheer blijven reviews, inzendingen en tickets liggen, en kan niemand vertrektijden bevestigen (K4) | 5 min |
| B5 | In de SQL-editor van Supabase uitvoeren: `web/supabase/retention.sql` (PR #10), `delete_my_account` (PR #4), en `drop table private.probe, private.probe2;` | De privacyverklaring belooft bewaartermijnen die nu niet draaien; `cron.job_run_details` heeft al 58.126 rijen. De agents kunnen dit niet: de bevestiging komt niet door (ook vandaag opnieuw geprobeerd) | 5 min |
| B8 | Bedrijfsgegevens in `web/src/lib/company.ts` | Juridische pagina's tonen plaatshouders | 10 min |
| B10 | Geheimen `SUPABASE_DB_URL` en `BACKUP_PASSPHRASE` en variabele `SITE_URL` in GitHub (draaiboek §2 en §3) | Zonder deze draaien back-up en uptime-check niet | 10 min |
| B11 | Tweestapsverificatie op GitHub, Vercel en Supabase | Wie daar binnenkomt, heeft de hele site | 10 min |
| B7 | Mailprovider (EU) kiezen, SMTP in Supabase, SPF/DKIM/DMARC (draaiboek §5) | Nodig voor wachtwoord-reset, e-mailverificatie, inloglinks en antwoorden op tickets | 1 uur |
| — | Domein koppelen in Vercel en `NEXT_PUBLIC_SITE_URL` zetten; Site URL en redirect-URL's in Supabase Auth | Livegang | 30 min |
| B2 | ✅ Besloten 16 oktober: geen strikte OSM-toelating | Zoveel mogelijk plekken gaat voor | klaar |
| B3 | ✅ Besloten 16 oktober: geen advertenties | Past bij "geen tracking van derden" | klaar |
| B12 | ✅ Besloten 16 oktober: elke website eens per 30 dagen opnieuw lezen, 10 per half uur (R1) | Websites werden maar één keer gelezen | klaar |
| B13 | Standaard voor de totaalprijs (voorstel: 2 volwassenen, 1 nacht, stroom als die apart kost) | Nodig voor P7 en "prijzen met alle toeslagen" | besluit |
| — | Juridische teksten laten nalezen | Na B8 | extern |

---

## 4. De polishronde (na het samenvoegen)

Alleen wat nog **niet** gebouwd is. Omvang: **S** ≤ 1 dag, **M** 2 tot 5 dagen, **L** meer.

### 4a. Vangnet en operatie

| # | Taak | Omvang | Status |
|---|---|---|---|
| E1 | Eén `ci.yml` (basis #10, plus Playwright uit #4 en `npm audit --omit=dev --audit-level=high`), `permissions: contents: read` | S | 🟢 |
| E2 | Database-job in CI: migraties op een lege database, advisors, RLS-tests per rol | M | ⬜ |
| E4 | Zes kernflows als e2e op iPhone-formaat, licht en donker: zoeken → filter → plek; bewaren → reis → offline; Dichtbij met nep-locatie; contact → ticket; cookie weigeren = geen event; geen beheer zonder rechten. Met axe en een Lighthouse-budget (LCP < 2,5 s, CLS < 0,1) | M | ⬜ |
| E5 | Branch protection op `main` en `acceptatie` | S | ⬜ 👤 na stap 2 |
| E7 | Serverfouten naar `app_logs` via `instrumentation.ts` (`onRequestError`); wekelijkse samenvatting van `app_logs` in Beheer → Overzicht | S | 🔄 serverfouten gebouwd (polishronde); samenvatting open |
| E8 | `schema.sql` vervangen door een nulmeting in `web/supabase/migrations/` (`supabase db dump`), zodat een nieuw project op te bouwen is | M | 🔄 map bestaat in #4 en #10 |
| E9 | Back-up en uptime-check (#13) eerste keer handmatig draaien en groen zien | S | ⬜ na B10 |

### 4b. Beveiliging en privacy

| # | Taak | Omvang | Status |
|---|---|---|---|
| 0.4 | Beheer: MFA verplicht, open aanmelding alleen voor bezoekersaccounts (PR #4), leaked-password-check aan, rollen admin en support scheiden | M | ⬜ |
| 0.5 | CSP, HSTS en COOP | S | 🟢 #13 (getest: geen meldingen op 8 pagina's, kaart werkt) |
| 0.7 | Edge functions: pipelinesleutel als edge-secret, vergelijken in constante tijd, scraper weigert interne adressen; één robots.txt-lezer | M | ⬜ |
| 0.8 | `maplibre-gl` naar 6.14 | S | 🟢 #13 |
| 0.10 | Service worker cachet geen `/support/*`; tokens laten verlopen; `place.website` alleen `http(s)` | S | 🔄 service worker en websites gebouwd (polishronde); verlopen van tokens open |
| A4 | Websites die `discover` vindt eerst door een mens laten bevestigen (een verkeerde match is verzonnen data) | S | ⬜ |
| — | Advisors: 13 openbare SECURITY DEFINER-functies nalopen. Voor de formulieren is dat de bedoeling; `is_admin`, `is_trip_member`, `push_public_key` en `crowd_status` bewust houden of dichtzetten | S | ⬜ |

### 4c. Kernbelofte en data

| # | Taak | Omvang | Status |
|---|---|---|---|
| K4 | Eerste controleronde: de 21 kandidaten voor Zonder vertrektijd nalopen in Beheer → Vertrektijden | S | ⬜ na B6 en #12 |
| K5 / D1 | Meer kandidaten: OSM `motorhome=designated`, gemeentelijke camperplaatsen, "per 24 uur" herkennen. Doel 150 (nu 21) | L | ⬜ |
| K6 | Eigenaar bevestigt zelf via een eenmalige link | M | ⬜ |
| K7 | Strengere herkenning ("in principe", "bij drukte", tegenstrijdige tijd) | S | ⬜ |
| K8 | Teller bevestigde plekken per provincie in Beheer → Overzicht | S | ⬜ |
| D2 | Doe mee gericht inzetten op plekken met onbekende vertrektijd (769 live) | M | ⬜ |
| D3 | Snapshot wekelijks verversen (680 → 1.536 plekken) | S | 🟢 PR #12 |
| R1 | Websites periodiek opnieuw lezen (B12): cron `scrape-refresh`, migratie `20261016200000_opnieuw_lezen.sql` | S | ✅ live sinds 16 oktober |
| A6 | Overpass-ruis in `app_logs` als `warn` | S | ⬜ |

### 4d. UX-polish

| # | Taak | Omvang | Status |
|---|---|---|---|
| P1 | Zoeken repareren: "Giethorn" vindt Giethoorn; onbekende plaats geeft "niet gevonden" (open punt 9) | S | 🟢 polishronde |
| P2 / P3 | Vertrektijd op de kaart (kleur per vertrekgroep), pins ≥ 44 px, gekozen plek als mini-kaart onderaan | M | ⬜ |
| P4 | Zoekkop die bij scrollen inklapt | M | ⬜ na #5 |
| P5 | Zoekstaat behouden bij terug (kaart, "toon meer", scrollpositie) | S | ⬜ |
| P6 | `loading.tsx` voor plekpagina, provinciepagina's en start; skelet voor Mijn reis (CLS 0,41) | S | 🟢 plekpagina met skelet, foto-vak verspringt niet meer (CLS 0,167 → 0); Mijn reis al 0 |
| P7 | Totaalprijs zoals camperaars rekenen (B13), filter rekent ermee | M | 🔄 Mijn reis in #4 |
| P8 | Bron en datum per kernfeit in plaats van één datum | S | ⬜ |
| P9 | Lengtefilter eerlijk ("bij 8% bekend") | S | ⬜ |
| P10 | Laat aankomen: aankomst- en slagboomtijden, "24 uur toegankelijk" | M | ⬜ |
| P11 | Navigatiekeuze: Apple Maps, Google Maps, Waze, coördinaten | S | 🟢 polishronde |
| P12 | Offline-basis: `/offline`-pagina, bewaarde plekken automatisch in de cache, melding "nieuwe versie" | M | ⬜ |
| P13 | WCAG 2.1 AA afronden en de toegankelijkheidsverklaring laten kloppen (open punt 28) | M | 🔄 verklaring klopt nu met de site (polishronde); rest open |
| B4 | Eerste 20 resultaten server-side op zoek- en vertrekpagina's (vindbaarheid, LCP) | M | 🔄 Landingspagina's (provincie, plaats, vertrekgroep per provincie) tonen hun lijst server-side; het zoekscherm zelf nog niet |
| 1.x | Kleine dingen uit fase 1 van PR #11 die #10 niet deed: kaartfout met knoppen "Toon lijst" en "Opnieuw", `theme_color` gelijk aan de viewport, verborgen lege rijen ("Maximaal verblijf") | S | 🔄 kaartfout met knoppen en theme_color klaar (polishronde) |

### 4e. Code-opschoning

| # | Taak | Omvang | Status |
|---|---|---|---|
| C1 | Gedeelde `Button`, `Field`, `Chip`, `Card` voor site en beheer | M | ⬜ na #5 |
| C2 | Grote bestanden opknippen (`plek/[slug]/client.tsx`, `trip-app.tsx`, `search-app.tsx`, `admin/plekken`) | M | ⬜ |
| C3 | Eén formulier-hook voor alle formulieren | S | 🔄 #10 |
| C5 | Lichtere suggestie-index op de startpagina (nu de hele dataset) | S | ⬜ |
| 2.12 | Minder JavaScript op de eerste pagina (kaart en `motion` pas laden als nodig) | M | ⬜ |

---

## 5. Na livegang

Ongewijzigd uit het plan van PR #11, in deze volgorde: **S1** bewaren los van de reis → **S3** reviews op gang
brengen (0 nu, doel 200) → **S6** camperprofiel en routeprofiel → **S5** offline regio downloaden → **S9**
eigenaarsportaal. Daarna S2, S4, S7, S8, S10 tot en met S15 en fase 4 (N1 tot N10). Een deel daarvan zit al in PR #4
(camperprofiel, push, drukte); daar alleen afmaken wat ontbreekt.

---

## 6. Nieuwe bevindingen (16 oktober 2026, live database)

1. **Websites worden maar één keer gelezen.** `scrape-enqueue` roept `enqueue_scrape(true)` aan, en dat plant alleen
   plekken in die nog nooit gescraped zijn. De laatste scrape was op 12 oktober. De handleiding (§6, punt 3) belooft
   dat een waarde verdwijnt als die "bij een volgende controle" niet meer op de site staat, maar die volgende controle
   kwam er niet. Voor de vertrektijd, het kernfeit, was dat het grootste datarisico. **Opgelost (R1):** cron
   `scrape-refresh` zet elk half uur de 10 plekken terug die het langst en minstens 30 dagen niet gelezen zijn.
2. **Bewaartermijnen draaien nog steeds niet.** Geen `private.apply_retention`, geen cron `retention`.
   `cron.job_run_details` telt 58.126 rijen. Vandaag opnieuw geprobeerd via de Supabase-tool: die blijft hangen op de
   bevestiging. Alleen Patrick kan dit (B5).
3. **Nog steeds 0 gebruikers in de database**, dus ook 0 beheerders (B6).
4. **Advisors:** geen kritieke meldingen. Wel 13 SECURITY DEFINER-functies die zonder inloggen aan te roepen zijn en
   27 met inloggen (§4b), en 4 tabellen met RLS zonder policy (bedoeld: alleen intern).
5. **De kaartbibliotheek 6 laadt zijn worker anders.** Na het bundelen vond hij die niet meer; opgelost met een
   kopie in `public/` bij elke build. Wie `maplibre-gl` bijwerkt, hoeft niets te doen.
6. **De Supabase-database is 52 MB** van de 500 MB die gratis is.

---

## 7. Volgorde

```
Deze week    acceptatie → main (§2)  ·  Patrick: B6, B5, B8, B10, B11  ·  K4 bevestigen
Week 2       E5, E7, E9  ·  0.4, 0.7, 0.10  ·  P1, P5, P6, P11, kleine 1.x-punten
Week 3       Domein, SMTP en DNS (B7)  ·  testplan op echte toestellen  ·  E4 e2e met Lighthouse-budget
Week 3 en 4  P2/P3 kaart, P13, B4, C1  ·  P7 prijs (na B13)
Livegang     Als alles in §1 ✅ is, behalve de punten die aan livegang zelf hangen
Doorlopend   K5 tot K8 en D2: de kernbelofte is uiteindelijk een datavraag
```

**Klaar voor livegang als:** CI groen en verplicht op `main`; back-up en hersteltest één keer groen; uptime-check
groen op het eigen domein; 0 meldingen bij `npm audit --omit=dev`; bewaartermijnen actief; een beheeraccount met MFA;
bedrijfsgegevens ingevuld; wachtwoord-reset en e-mailverificatie getest met eigen SMTP; de acceptatiecriteria uit de
PRD geslaagd op een iPhone en een Android-telefoon.
