# 6. Implementatieplan

> Doel: een geordende bouwvolgorde met controlepunten, voor mensen en AI-agents.
> Bijgewerkt: 16 oktober 2026. Het samengevoegde plan voor de afronding staat in [`plan.md`](../../plan.md). Status: ✅ klaar, 🔄 bezig, ⬜ open.
> Eigenaar: "Patrick" = de eigenaar van VrijStaan; "Agent" = een AI-codeeragent (Claude Code) in deze repository.

## Mijlpaal 1: projectopzet ✅

| Taak | Eigenaar | Input | Output | Klaar als | Afhankelijk van |
|---|---|---|---|---|---|
| ✅ Repository en Next.js-app in `web/` | Agent | PRD, TRD | Next.js 16-app, Tailwind 4, ESLint | `npm run check` en `next build` schoon | — |
| ✅ Supabase-project in Frankfurt | Agent | TRD | Project `qkrmthrhwmmmwswmfgwc` | REST bereikbaar met publishable key | — |
| ✅ Streamlit-app vervangen | Agent | Toestemming Patrick | `main` bevat alleen de nieuwe site | PR #1 gemerged | — |
| ⬜ Vercel koppelen | Patrick | Vercel-account, GitHub | Live adres `*.vercel.app` | Startpagina laadt op de telefoon | `main` |
| ✅ Supabase actief houden | Agent | — | `.github/workflows/keepalive.yml` | Workflow draait dagelijks groen | `main` |

## Mijlpaal 2: data en authenticatie 🔄

| Taak | Eigenaar | Input | Output | Klaar als | Afhankelijk van |
|---|---|---|---|---|---|
| ✅ Schema, RLS en RPC's | Agent | Backend Schema | Tabellen, policies, functies | Anon leest alleen gepubliceerde data; beheer via `is_admin()` | M1 |
| ✅ OSM-import per provincie | Agent | OSM-tags | `osm_regions`, cron, edge function | Alle 12 provincies binnen 7 dagen ververst | Schema |
| ✅ Website-scraper (prijs, toeslagen, seizoen, voorzieningen, vertrektijden) | Agent | Echte voorbeeldzinnen | Edge function `pipeline` v17 | Testscripts geven verwacht resultaat; steekproef van 10 plekken klopt | Schema |
| ✅ Herscrape alle websites met v17 (12 okt 13:38–±15:30, 3.211 sites; 322 fouten aan de kant van de sites: 404, 403, onbereikbaar, time-out) | Agent | — | Bijgewerkte plekken | `private.scrape_queue` leeg; steekproef foto's en teksten correct | Scraper |
| ✅ Publicatiedrempel definitief instellen (0,45) | Agent + Patrick | Cijfers na herscrape | `site_settings.publish_threshold` | 1.509 plekken online, allemaal met contact en 2 van 4 kernfeiten | Herscrape |
| ✅ Beheeraccounts via uitnodiging | Agent | E-mail Patrick | `private.admin_invites`, trigger | Patrick kan inloggen | Schema |
| ⬜ Rollen `admin` en `support` echt scheiden | Agent | Besluit Patrick | Policies per rol | Support kan geen instellingen of plekken verwijderen | Besluit |
| ⬜ Bewaartermijnen activeren | Patrick | Deel "Bewaartermijnen" van `web/supabase/migrations/20261015090000_misbruik_en_bewaartermijnen.sql` | Cron `retention` | `cron.job` bevat `retention` | — |
| ✅ Tickets na 12 maanden opruimen | Agent | Privacyverklaring | Uitbreiding van `apply_retention` | Gesloten tickets ouder dan 12 maanden verdwijnen | Bewaartermijnen |
| ⬜ `web/supabase/schema.sql` opnieuw genereren | Agent | Live database | Actueel schemabestand | Nieuw project op te zetten met schema + seed | — |
| ✅ Test-infrastructuur: Playwright E2E (mobiel + desktop), unit tests, CI-workflow | Agent | Opdracht Patrick | `web/e2e`, `web/tests`, `.github/workflows/ci.yml` | `npm run test:unit` en `npm run test:e2e` groen | — |
| ✅ Kaart laadt per bounding box (PostGIS) met clustering | Agent | Opdracht Patrick | `places_in_bbox`, `/api/places?bbox=` | Geen limiet van 600 markers; gedeelde CDN-cache | Schema |
| ✅ OSM-toelating, naam-fallback, strikte booleans | Agent | Opdracht Patrick, besluit B2 | `osm.ts` + tests | Toelating zoals voorheen (caravan_site, motorhome=yes/designated, campings zonder motorhome=no); booleans alleen uit een vaste lijst waarden | — |
| ~~Strikte OSM-query live zetten~~ | — | Besluit B2 (16 oktober 2026): nee | Migratie verwijderd | — | — |
| ✅ Optionele bezoekersaccounts + synchronisatie Mijn reis | Agent | Opdracht Patrick | `/inloggen`, `/account`, `user_trips` | E2E groen | — |
| ✅ Inloggen met een code uit de mail (naast de link) | Agent | Opdracht Patrick | `/inloggen`, `verifyOtp` | E2E groen | — |
| ⬜ Mailsjablonen met `{{ .Token }}` (Magic Link en Confirm signup) | Patrick | Handleiding stap 4 | Supabase-instellingen | Mail toont een code | SMTP |
| ⬜ OAuth-sleutels Google, Apple, Facebook + SMTP | Patrick | Handleiding stap 4 | Supabase-instellingen | Inloggen met elke dienst werkt | Vercel-adres |
| 🔄 `delete_my_account` met tweestaps-bevestiging | Agent + Patrick | Akkoord Patrick (12 okt) | UI klaar; SQL onderaan `migrations/20261012_user_accounts.sql` | Live na uitvoeren van de SQL (de MCP-bevestiging verliep) | — |
| ✅ Foto-upload door bezoekers met moderatie en trust-score | Agent | Opdracht Patrick | Storage, `place_photos`, `/admin/fotos` | Foto verschijnt na goedkeuring; geen EXIF | Accounts |
| ✅ Live drukte (crowdsourced: rustig, druk, vol) | Agent | Opdracht Patrick (Fase 5) | `crowd_reports`, kaart op de plekpagina | Alleen echte meldingen van de laatste 3 uur, met aantal en tijd | Accounts |
| ✅ Pushmelding als een gevolgde plek rustig wordt | Agent | Fase 5 | Edge function `push`, `crowd_watches`, `push_subscriptions`, service worker | Versleutelde melding (getest met web-push tegen een nep-pushdienst); één melding per volger | Drukte |
| ✅ Voertuigkluis: camperprofiel met automatisch lengtefilter, papieren in een privé-map | Agent | Opdracht Patrick (Fase 5) | `/mijn-camper`, `user_vehicles`, Storage `vehicle-docs` | Lengtefilter vanzelf aan; uitzetten blijft uit; papieren alleen voor de eigenaar | Accounts |
| ✅ Losse toeslagen (`price_extras`) in de reiskosten | Agent | Voorstel audit-sessie, akkoord Patrick (16 okt) | `trip-extras.ts` | Alleen eenduidige toeslagen tellen mee; de rest wordt per plek genoemd | Mijn reis |
| ✅ Kosten- en brandstoftracker in Mijn reis | Agent | Opdracht Patrick (Fase 5) | `ExpensesPanel`, `user_expenses` | Uitgaven naast de begroting; werkt zonder account | Mijn reis |
| ✅ Reisstatistieken (dashboard) | Agent | Opdracht Patrick (Fase 5) | `/mijn-reis/statistieken`, `trip-stats.ts` | Alleen berekend uit bekende gegevens; tabel bij elke grafiek | Mijn reis, uitgaven |
| ✅ Samen een reis plannen (realtime) | Agent | Opdracht Patrick (Fase 5) | `shared_trips`, `/samen/<code>`, `SharedCard` | Leden zien wijzigingen direct; buitenstaanders niet | Accounts |
| ✅ Dubbele plekken samenvoegen (beheer) | Agent | Opdracht Patrick | `/admin/dubbelen`, `admin_merge_places` | Oude link stuurt door | Schema |
| ⬜ Testtabellen `private.probe*` verwijderen | Agent of Patrick | — | — | Tabellen bestaan niet meer | — |

## Mijlpaal 3: hoofdroute ✅

In afhankelijkheidsvolgorde, allemaal klaar: startpagina met zoeken → zoekresultaten met filters en
sortering → vertrekpagina's `/zonder-vertrektijd`, `/uitslapers`, `/overige-plekken` met tabbladen → kaart → plekpagina met vertrekblok en prijsblok → Dichtbij met rijtijden → route naar
navigatie. Klaar als de acceptatiecriteria in de PRD op een iPhone-formaat slagen.

## Mijlpaal 4: overige functies 🔄

| Taak | Eigenaar | Input | Output | Klaar als | Afhankelijk van |
|---|---|---|---|---|---|
| ✅ Professionele startpagina (zoekkaart met vertrekkeuze, bestemmingen met foto's, drie stappen) | Agent | Verzoek Patrick, Booking/Campspace | `web/src/app/(site)/page.tsx`, `home-search.tsx` | Zoeken vanaf de start komt op de juiste vertrekpagina | M3 |
| ✅ Vertrekgroep "ruim" (11:00 tot 12:00), bronzinnen van de site, "Laatste update" per pagina, legenda, schaduwlagen, teksten herschreven | Agent | Verzoek Patrick | `search.ts`, plekpagina, `legend.tsx`, `globals.css`, alle pagina's en FAQ | Geen "volgens de website" meer op de site; legenda opent op zoek- en plekpagina | M3 |
| ✅ Mijn reis (offline, delen, kosten) | Agent | App Flow | `/mijn-reis` | Werkt zonder verbinding met bewaarde gegevens | M3 |
| ✅ Reviews, aanmelden, fout melden, contact, support | Agent | App Flow | Formulieren + RPC's | Inzending verschijnt in beheer | M2 |
| ✅ Beheer, inclusief statistieken | Agent | PRD | `/admin/*` | Patrick kan alles beheren zonder code | M2 |
| ✅ Juridische pagina's, Reviews en ranking, Meld inhoud | Agent | Juridisch onderzoek | Pagina's | Teksten kloppen met wat de code doet | — |
| 🔄 Reviewformulier: ✅ vertrektijdvraag (als inzending), ✅ bezoekdatum, ⬜ foto-upload (max. 5, verkleind, zonder EXIF) | Agent | Fase B | Supabase Storage-bucket, RPC, formulier, moderatie | Foto verschijnt na goedkeuring; geen locatie in het bestand | M2 |
| ⬜ "Volgens n bezoekers" bij de vertrekregel | Agent | Reviewantwoorden | Weergave op de plekpagina | Bron (website of bezoekers) is altijd duidelijk | Reviewformulier |
| ⬜ Eigenaar claimen en zelf bewerken (incl. toestemming foto's) | Agent | Fase B | Claimflow + beheer | Eigenaar past gegevens aan na controle | M2 |
| ✅ Websites zoeken voor plekken zonder website (edge function `discover`, cron `discover`) | Agent | Verzoek Patrick | `discover.ts`, `next_discover_batch`, `apply_discovery` | Gevonden site staat in `sources->'discovery'` en gaat de scrape-wachtrij in | Scraper |
| ✅ Pagina "Doe mee" voor de Facebookgroep: vertrektijden invullen per provincie | Agent | Verzoek Patrick | `/doe-mee` | Inzending komt in Beheer → Inzendingen | — |
| ⬜ Inzending "vertrektijd" met één klik overnemen in beheer | Agent | Eerste inzendingen | Knop in Inzendingen | Beheerder hoeft niet apart naar Plekken | Doe mee |
| ✅ Aanmeldformulier: vertrektijd en maximale lengte | Agent | Audit | Extra velden | Velden komen in `submissions.payload` (`vertrek`, `vertrek_uiterlijk`, `max_lengte_m`) | — |
| ✅ Foto's: verkleind via wsrv.nl met terugval, kapotte adressen hersteld, logo's overgeslagen; scraper v16 leest ook achtergrondfoto's en `<picture>` | Agent | Verzoek Patrick | `place-ui.tsx`, `places.ts`, `extract.ts` | 93 plekken zonder foto opnieuw gescraped | — |
| ⬜ Tarieven uit PDF lezen | Agent | Voorbeeld-PDF's | Uitbreiding extractor | Steekproef van 10 PDF's klopt | Scraper |
| ⬜ Reis met datums en waarschuwing bij gesloten plek | Agent | Fase B | Mijn reis | Waarschuwing bij seizoen buiten de datum | — |

## Mijlpaal 5: kwaliteit 🔄

| Taak | Eigenaar | Input | Output | Klaar als | Afhankelijk van |
|---|---|---|---|---|---|
| ✅ Plekpagina rustiger op mobiel: beslisblok, voorzieningen als labels, niets dubbel, kleinere koppen en header, basis 16 px op de telefoon | Agent | Verzoek Patrick, UX-onderzoek | `plek/[slug]/page.tsx`, `chrome.tsx`, `globals.css` | Vertrekken, prijs, open en lengte in één scherm op iPhone-formaat | — |
| ✅ Plekkaart opnieuw ingedeeld: waar (plaats, afstand vanaf je locatie), wanneer (vertrek + aankomst), wat en hoeveel (voorzieningen, prijs + toeslagen) | Agent | Verzoek Patrick | `place-ui.tsx`, `lib/my-location.ts`, samenvattingen met aankomsttijden | Afstand, vertrek, aankomst en prijs op elke kaart zonder doortikken | — |
| ✅ Zoekscherm compacter op mobiel (Booking als voorbeeld): kleinere tabbladen en zoekveld, één rij Filters/Sorteren/Kaart, kleinere kop, compactere kaarten, prijs past altijd | Agent | Verzoek Patrick | `search-app.tsx`, `destination-search.tsx`, `place-ui.tsx` | Eerste plek direct in beeld op iPhone | — |
| ✅ Scherpe foto's: grote versie bij bekende beeldbanken, geen keurmerken/stockfoto's/miniaturen, beste foto vooraan, logo passend | Agent | Verzoek Patrick | `web/src/lib/photos.ts`, `PlacePhoto` | Geen onscherpe of half bijgesneden eerste foto | — |
| ✅ "Over deze plek" opgeschoond: alleen hele Nederlandse zinnen | Agent | Verzoek Patrick | `web/src/lib/description.ts` | Geen "Lees meer", "…" of halve zinnen op de site | — |
| ✅ Zelfde foto- en tekstregels in de scraper: `extract.ts` importeert `web/src/lib/photos.ts` en `description.ts` (één bron), leest de eerste alinea's van de pagina naast de meta-omschrijving, houdt WordPress/Wix-miniaturen (de site vraagt de grote versie op) | Agent | Pipeline v16 (#3) | Pipeline v17, in Supabase uitgerold als functieversie 20 (wrapper vastgezet op commit `3606568`; terug naar v16: wrapper naar `50819c6`) | Steekproef: Breukink (SVR-logo weg, volledige tekst) en Het Oever (geen brokstukken) kloppen | Herscrape |
| ✅ Startpagina, Dichtbij en Mijn reis compacter op de telefoon (lagere kop en zoekkaart, kleinere provinciefoto's en koppen, ronde filterchips, lagere kaart) | Agent | Verzoek Patrick | `page.tsx`, `home-search.tsx`, `nearby-app.tsx`, `trip-app.tsx` | Meer inhoud in één scherm op iPhone | — |
| ⬜ Kaartmarkers ≥ 44 px, pop-up met vertrekregel en hartje | Agent | UX-audit | `place-map.tsx` | Marker raakbaar met duim op iPhone | — |
| ⬜ Onbekende plaats in URL toont "niet gevonden" | Agent | UX-audit | `search-app.tsx` | `/zoeken?waar=xyzqqq` toont geen hele land | — |
| ⬜ Layoutverspringing Mijn reis (CLS 0,41) en plekpagina (0,13) | Agent | UX-audit | Skelet en vaste foto-verhouding | CLS < 0,1 | — |
| ⬜ Totaal in Mijn reis eerlijk ("€ x + 2 onbekend") | Agent | UX-audit | `trip-app.tsx` | Geen totaal dat volledig lijkt bij onbekende prijzen | — |
| ⬜ Plaatsnaam per postcode (dorp in plaats van gemeente) | Agent | UX-audit | Pipeline | Steekproef van 20 plekken klopt | — |
| ✅ Automatische tests voor extractor en filters | Agent | Testscripts in sessie | `web/tests/` + `npm test` (node --test) | Draait in CI | — |
| ✅ CI op GitHub (lint, typecheck, tests, offline build) | Agent | TRD | `.github/workflows/ci.yml` | Groen op elke PR | Tests |
| 🔄 Beveiligingsadviezen van Supabase nalopen | Agent | Supabase advisors | Opgeloste waarschuwingen | Geen kritieke meldingen (16 oktober: geen kritieke; 13 openbare SECURITY DEFINER-functies nog nalopen, zie `plan.md` §4b) | — |
| ✅ Standaard-deelafbeelding voor links in WhatsApp en sociale media | Agent | Huisstijl | `web/public/og.png`, `web/src/lib/meta.ts` | Elke pagina zonder eigen foto toont `og.png` | — |
| 🔄 Fase 0 van de review uitvoeren (limieten op rpc's, token uit statistieken, bewaartermijnen, terugval op snapshot): alles klaar behalve 0.4 (uitvoeren), 0.7 en 0.8 | Agent + Patrick | [Review oktober 2026](../review-2026-10.md) | Migraties en code | Alle punten 0.1 tot 0.8 afgevinkt | — |
| ✅ Fase 1 van de review uitvoeren (snelle winst voor de gebruiker) | Agent | [Review oktober 2026](../review-2026-10.md) | Code | Punten 1.1 tot 1.14 afgevinkt; Lighthouse opnieuw gemeten | — |
| ✅ Kaartbibliotheek 6.14 (kritiek XSS-lek in 5.x), CSP, HSTS en COOP | Agent | `npm audit` | `package.json`, `place-map.tsx`, `next.config.ts`, `scripts/copy-maplibre-worker.mjs` | `npm audit --omit=dev` geeft 0; kaart en 8 pagina's zonder CSP-meldingen | — |
| ✅ Dependabot | Agent | — | `.github/dependabot.yml` | Wekelijkse PR's naar `acceptatie` | — |
| ✅ Websites eens per 30 dagen opnieuw lezen | Agent | Besluit B12 | Cron `scrape-refresh`, `private.enqueue_stale_scrape` | Geen website ouder dan ±31 dagen | Scraper |
| 🔄 Acceptatieomgeving: branch `acceptatie`, PR's eerst daarheen, Vercel-preview | Agent + Patrick | `plan.md` E5 | Branch + CI; Vercel en branch protection door Patrick | Niets gaat meer direct naar `main` | CI |
| 🔄 Kernbelofte 100% zeker: bevestiging door mens vóór Zonder vertrektijd | Agent | `plan.md` K1–K3 | Migratie `20261015120000_vertrektijd_bevestiging.sql` (live sinds 16 oktober), Beheer → Vertrektijden | Eerste ronde gecontroleerd | Beheeraccount |

## Mijlpaal 6: release ⬜

| Taak | Eigenaar | Input | Output | Klaar als | Afhankelijk van |
|---|---|---|---|---|---|
| ⬜ Bedrijfsgegevens invullen | Patrick | KvK-gegevens | `web/src/lib/company.ts` | Geen "[… nog invullen]" meer op de site | — |
| ⬜ Juridische teksten laten nalezen | Patrick | Pagina's | Akkoord jurist | Aanpassingen verwerkt | Bedrijfsgegevens |
| ⬜ Supabase Auth: Site URL, redirect-URL's, eigen SMTP | Patrick | Vercel-adres | Instellingen | Inloggen en wachtwoord-reset werken | Vercel |
| ⬜ Domein koppelen en `NEXT_PUBLIC_SITE_URL` zetten | Patrick | Domein | DNS + Vercel | Site bereikbaar op eigen domein met HTTPS | Vercel |
| ⬜ Testplan uitvoeren | Patrick + Agent | Acceptatiecriteria PRD | Testverslag | Alle criteria geslaagd op iPhone en Android | M3–M5 |
| 🔄 Monitoring | Agent | — | `.github/workflows/monitor.yml` (site, database, aantal plekken, elk uur); nog open: serverfouten naar `app_logs` | Fouten worden binnen een dag gezien | Vercel, variabele `SITE_URL` |
| 🔄 Back-up met hersteltest | Agent + Patrick | — | `.github/workflows/backup.yml`, wekelijks, versleuteld | Eerste run groen | Geheimen `SUPABASE_DB_URL`, `BACKUP_PASSPHRASE` |
| ✅ Terugdraaien | Agent | — | Vercel "Instant Rollback" naar vorige deployment; database: migratie terugdraaien met omgekeerde SQL | Procedure staat in `docs/draaiboek.md` | Vercel |

## Voor je verdergaat (bij elke mijlpaal)

1. Draai de app (`cd web && npm run dev`) en bekijk de wijziging op iPhone-formaat, licht en donker.
2. Controleer de acceptatiecriteria uit de PRD die bij de mijlpaal horen.
3. `npm run check` en `VRIJSTAAN_OFFLINE=1 npm run build` zijn schoon.
4. Werk deze documenten bij als iets verandert, en noteer open punten in `docs/specs/README.md`.
