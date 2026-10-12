# 6. Implementatieplan

> Doel: een geordende bouwvolgorde met controlepunten, voor mensen en AI-agents.
> Bijgewerkt: 11 oktober 2026. Status: ✅ klaar, 🔄 bezig, ⬜ open.
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
| ✅ Website-scraper (prijs, toeslagen, seizoen, voorzieningen, vertrektijden) | Agent | Echte voorbeeldzinnen | Edge function `pipeline` v15 | Testscripts geven verwacht resultaat; steekproef van 10 plekken klopt | Schema |
| 🔄 Herscrape alle websites met v15 | Agent | — | Bijgewerkte plekken | `private.scrape_queue` leeg; steekproef "vrij" en toeslagen correct | Scraper |
| ⬜ Publicatiedrempel definitief instellen | Agent + Patrick | Cijfers na herscrape | `site_settings.publish_threshold` | ±1.000 plekken van goede kwaliteit online | Herscrape |
| ✅ Beheeraccounts via uitnodiging | Agent | E-mail Patrick | `private.admin_invites`, trigger | Patrick kan inloggen | Schema |
| ⬜ Rollen `admin` en `support` echt scheiden | Agent | Besluit Patrick | Policies per rol | Support kan geen instellingen of plekken verwijderen | Besluit |
| ⬜ Bewaartermijnen activeren | Patrick | `web/supabase/retention.sql` | Cron `retention` | `cron.job` bevat `retention` | — |
| ⬜ Tickets na 12 maanden opruimen | Agent | Privacyverklaring | Uitbreiding van `apply_retention` | Gesloten tickets ouder dan 12 maanden verdwijnen | Bewaartermijnen |
| ⬜ `web/supabase/schema.sql` opnieuw genereren | Agent | Live database | Actueel schemabestand | Nieuw project op te zetten met schema + seed | — |
| ✅ Test-infrastructuur: Playwright E2E (mobiel + desktop), unit tests, CI-workflow | Agent | Opdracht Patrick | `web/e2e`, `web/tests`, `.github/workflows/ci.yml` | `npm run test:unit` en `npm run test:e2e` groen | — |
| ✅ Kaart laadt per bounding box (PostGIS) met clustering | Agent | Opdracht Patrick | `places_in_bbox`, `/api/places?bbox=` | Geen limiet van 600 markers; gedeelde CDN-cache | Schema |
| ✅ Strikte OSM-toelating, naam-fallback, booleans | Agent | Opdracht Patrick | `osm.ts` + tests | Alleen `caravan_site` of `motorhome=yes|designated` | — |
| ⬜ Strikte OSM-query live zetten + edge function deployen | Patrick | Besluit (zie README #12) | `migrations/20261012_strict_osm_query.sql` | Volgende import gebruikt de nieuwe regels | Besluit |
| ✅ Optionele bezoekersaccounts + synchronisatie Mijn reis | Agent | Opdracht Patrick | `/inloggen`, `/account`, `user_trips` | E2E groen | — |
| ⬜ OAuth-sleutels Google, Apple, Facebook + SMTP | Patrick | Handleiding stap 4 | Supabase-instellingen | Inloggen met elke dienst werkt | Vercel-adres |
| ⬜ `delete_my_account` toepassen | Patrick | Bevestiging | `migrations/20261012_user_accounts.sql` (onderaan) | Knop verwijdert account direct | — |
| ✅ Foto-upload door bezoekers met moderatie en trust-score | Agent | Opdracht Patrick | Storage, `place_photos`, `/admin/fotos` | Foto verschijnt na goedkeuring; geen EXIF | Accounts |
| ✅ Live drukte (crowdsourced: rustig, druk, vol) | Agent | Opdracht Patrick (Fase 5) | `crowd_reports`, kaart op de plekpagina | Alleen echte meldingen van de laatste 3 uur, met aantal en tijd | Accounts |
| ✅ Pushmelding als een gevolgde plek rustig wordt | Agent | Fase 5 | Edge function `push`, `crowd_watches`, `push_subscriptions`, service worker | Versleutelde melding (getest met web-push tegen een nep-pushdienst); één melding per volger | Drukte |
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
| ⬜ Reviewformulier: vertrektijdvraag, bezoekdatum, foto-upload (max. 5, verkleind, zonder EXIF) | Agent | Fase B | Supabase Storage-bucket, RPC, formulier, moderatie | Foto verschijnt na goedkeuring; geen locatie in het bestand | M2 |
| ⬜ "Volgens n bezoekers" bij de vertrekregel | Agent | Reviewantwoorden | Weergave op de plekpagina | Bron (website of bezoekers) is altijd duidelijk | Reviewformulier |
| ⬜ Eigenaar claimen en zelf bewerken (incl. toestemming foto's) | Agent | Fase B | Claimflow + beheer | Eigenaar past gegevens aan na controle | M2 |
| ⬜ Aanmeldformulier: vertrektijd, lengte, ondergrond | Agent | Audit | Extra velden | Velden komen in `submissions.payload` | — |
| ⬜ Tarieven uit PDF lezen | Agent | Voorbeeld-PDF's | Uitbreiding extractor | Steekproef van 10 PDF's klopt | Scraper |
| ⬜ Reis met datums en waarschuwing bij gesloten plek | Agent | Fase B | Mijn reis | Waarschuwing bij seizoen buiten de datum | — |

## Mijlpaal 5: kwaliteit 🔄

| Taak | Eigenaar | Input | Output | Klaar als | Afhankelijk van |
|---|---|---|---|---|---|
| ⬜ Kaartmarkers ≥ 44 px, pop-up met vertrekregel en hartje | Agent | UX-audit | `place-map.tsx` | Marker raakbaar met duim op iPhone | — |
| ⬜ Onbekende plaats in URL toont "niet gevonden" | Agent | UX-audit | `search-app.tsx` | `/zoeken?waar=xyzqqq` toont geen hele land | — |
| ⬜ Layoutverspringing Mijn reis (CLS 0,41) en plekpagina (0,13) | Agent | UX-audit | Skelet en vaste foto-verhouding | CLS < 0,1 | — |
| ⬜ Totaal in Mijn reis eerlijk ("€ x + 2 onbekend") | Agent | UX-audit | `trip-app.tsx` | Geen totaal dat volledig lijkt bij onbekende prijzen | — |
| ⬜ Plaatsnaam per postcode (dorp in plaats van gemeente) | Agent | UX-audit | Pipeline | Steekproef van 20 plekken klopt | — |
| ⬜ Automatische tests voor extractor en filters | Agent | Testscripts in sessie | `web/tests/` + script in `package.json` | Draait in CI | — |
| ⬜ CI op GitHub (lint, typecheck, offline build) | Agent | TRD | `.github/workflows/ci.yml` | Groen op elke PR | Tests |
| ⬜ Beveiligingsadviezen van Supabase nalopen | Agent | Supabase advisors | Opgeloste waarschuwingen | Geen kritieke meldingen | — |

## Mijlpaal 6: release ⬜

| Taak | Eigenaar | Input | Output | Klaar als | Afhankelijk van |
|---|---|---|---|---|---|
| ⬜ Bedrijfsgegevens invullen | Patrick | KvK-gegevens | `web/src/lib/company.ts` | Geen "[… nog invullen]" meer op de site | — |
| ⬜ Juridische teksten laten nalezen | Patrick | Pagina's | Akkoord jurist | Aanpassingen verwerkt | Bedrijfsgegevens |
| ⬜ Supabase Auth: Site URL, redirect-URL's, eigen SMTP | Patrick | Vercel-adres | Instellingen | Inloggen en wachtwoord-reset werken | Vercel |
| ⬜ Domein koppelen en `NEXT_PUBLIC_SITE_URL` zetten | Patrick | Domein | DNS + Vercel | Site bereikbaar op eigen domein met HTTPS | Vercel |
| ⬜ Testplan uitvoeren | Patrick + Agent | Acceptatiecriteria PRD | Testverslag | Alle criteria geslaagd op iPhone en Android | M3–M5 |
| ⬜ Monitoring | Agent | — | Controle op `app_logs`, Vercel-logs, wekelijkse controle pipeline | Fouten worden binnen een dag gezien | Vercel |
| ⬜ Terugdraaien | — | — | Vercel "Instant Rollback" naar vorige deployment; database: migratie terugdraaien met omgekeerde SQL | Procedure staat in `docs/HANDLEIDING.md` | Vercel |

## Voor je verdergaat (bij elke mijlpaal)

1. Draai de app (`cd web && npm run dev`) en bekijk de wijziging op iPhone-formaat, licht en donker.
2. Controleer de acceptatiecriteria uit de PRD die bij de mijlpaal horen.
3. `npm run check` en `VRIJSTAAN_OFFLINE=1 npm run build` zijn schoon.
4. Werk deze documenten bij als iets verandert, en noteer open punten in `docs/specs/README.md`.
