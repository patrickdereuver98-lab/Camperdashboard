# 2. Technical Requirements Document (TRD)

> Doel: technische keuzes expliciet maken, zodat niemand (mens of AI) hoeft te gokken.
> Bijgewerkt: 11 oktober 2026.

## Platforms

- **Web, mobiel eerst.** Installeerbaar als PWA (manifest + service worker `web/public/sw.js`). Getest op iPhone-formaat
  (390 px), licht en donker. Desktop werkt, maar is secundair.
- Geen native app in versie 1.

## Frontend en hosting

| Onderdeel | Keuze |
|---|---|
| Framework | Next.js **16.4** (App Router, `cacheComponents`, `'use cache'`, Partial Prerendering). Let op: wijkt af van oudere Next-kennis; lees `web/AGENTS.md` en `node_modules/next/dist/docs/` |
| UI | React **19.3** (inclusief `<ViewTransition>`), Tailwind CSS **4** met tokens in `web/src/app/globals.css`, motion v12 |
| Kaart | MapLibre GL 5 met tegels van OpenFreeMap (`tiles.openfreemap.org`) |
| Taal | TypeScript 5, ESLint 9 (`eslint-config-next`) |
| Runtime | Node.js ≥ 20.9 (22 LTS aanbevolen) |
| Hosting | **Vercel** (Hobby, gratis), Root Directory `web`. Elke push naar `main` gaat live |
| Offline build | `VRIJSTAAN_OFFLINE=1` bouwt uit `web/src/data/snapshot.json` (voor CI of afgeschermde omgevingen) |

## Backend en database

| Onderdeel | Keuze |
|---|---|
| Database | Supabase Postgres 17, project `qkrmthrhwmmmwswmfgwc` ("vrijstaan"), regio **eu-central-1 (Frankfurt)** |
| API | Supabase REST (PostgREST) met de publishable key in de browser; alle schrijfacties via `SECURITY DEFINER`-functies (RPC) |
| Pushmeldingen | Supabase Edge Function `push` (Deno, `web-push`), aangeroepen door de database via `pg_net` met dezelfde `x-pipeline-key`; maakt zelf de VAPID-sleutels aan |
| Data-pipeline | Supabase Edge Function `pipeline` (Deno; `index.ts`, `extract.ts`, `osm.ts`), deploy zonder JWT-controle maar met header `x-pipeline-key` |
| Taken | `pg_cron` + `pg_net` in de database (zie Architectuur) |
| Server-side data in Next.js | `web/src/lib/places.ts`: REST-calls met `'use cache'` en `cacheLife("minutes")`, terugval op de snapshot |

## Authenticatie en rollen

- **Bezoekers:** account optioneel. Zonder account staan bewaren, reis en keuzes in `localStorage`. Met account
  (Supabase Auth: Google, Apple, Facebook of magic link, PKCE via `/auth/callback`) wordt Mijn reis gesynchroniseerd
  met `user_trips` en kunnen ze foto's toevoegen (`place_photos`). Elke gebruiker ziet alleen zijn eigen rijen (RLS).
- **Beheerrechten** alleen voor een **bevestigd** e-mailadres uit `private.admin_invites` (trigger bij aanmaken én
  bij bevestigen), zodat een publiek account nooit vanzelf beheerder wordt.
- **Beheerders:** Supabase Auth (e-mail en wachtwoord, minstens 10 tekens). Toegang alleen als het e-mailadres in
  `private.admin_invites` staat; bij aanmelden komt de gebruiker in `public.admins` met rol `admin` of `support`.
- **Rechten:** `public.is_admin()` geeft `true` voor elke rij in `admins`. Er is nog **geen verschil** tussen `admin`
  en `support` (zie Open punten in `docs/specs/README.md`).
- **Support-klanten:** geen account. Elk ticket heeft een geheim `access_token`; de klant leest en antwoordt via
  `/support/<token>`.

## Externe diensten en API's

| Dienst | Doel | Limieten | Sleutel/eigenaar |
|---|---|---|---|
| Supabase | Database, auth, edge function, cron | Gratis: 500 MB database (nu 33 MB) en een maandquotum voor functieaanroepen (zie de prijspagina van Supabase); pauze na 7 dagen met te weinig verkeer | Account van Patrick |
| Vercel | Hosting website | Hobby: niet-commercieel gebruik | Account van Patrick (nog koppelen) |
| OpenStreetMap / Overpass | Plekken, servicepunten, `check_in`/`check_out`/`maxstay` | Publieke servers, vaak overbelast; we wisselen tussen 3 servers en wachten steeds langer (10 min tot 6 uur) | Geen sleutel; ODbL-naamsvermelding verplicht |
| Websites van plekken | Prijzen, toeslagen, seizoen, voorzieningen, vertrektijden | `robots.txt` gerespecteerd, max. 7 pagina's per site, 9 s timeout, eigen user-agent `VrijStaanBot/1.0` | n.v.t. |
| OpenRouteService (HeiGIT, Heidelberg) | Rijtijden en routes | Gratis sleutel met quotum | `ORS_API_KEY` (optioneel, nog niet ingesteld) |
| routing.openstreetmap.de (FOSSGIS) | Rijtijden zonder ORS-sleutel | Publieke dienst, eerlijk gebruik | Geen sleutel |
| OpenFreeMap | Kaarttegels | Gratis, geen sleutel | Geen; IP van bezoeker gaat naar hun server (staat in privacyverklaring) |
| Google Maps | "Open in navigatie" (uitgaande link) | n.v.t. | Geen |
| GitHub Actions | Dagelijkse ping tegen pauzeren (`.github/workflows/keepalive.yml`) | Gratis | Repository |

## Architectuur

```
Bezoeker (telefoon)
   │  HTTPS
   ▼
Vercel: Next.js (pagina's met 'use cache', /api/places, /api/towns, /api/route, /api/distances)
   │  REST + RPC (publishable key, Row Level Security)
   ▼
Supabase Postgres (Frankfurt) ──pg_cron──► pg_net ──► Overpass (OSM)        [elke 3 min: volgende provincie]
   │                              └──────► Edge Function "pipeline"          [elke 15 s: 8 websites]
   │                                         ├─ leest websites (robots.txt)
   │                                         └─ schrijft via apply_scrape / ingest_osm
   └── Beheer (/admin) via Supabase Auth + is_admin()
```

**Cron-taken in de database:**

| Taak | Schema | Wat |
|---|---|---|
| `osm-regions` | elke 3 min | Volgende provincie ophalen die ouder is dan 7 dagen (twee Overpass-verzoeken via `pg_net`) |
| `osm-collect` | elke minuut | Antwoorden ophalen; bij succes de functie `parse` aanroepen, bij fout later opnieuw via een andere server |
| `osm-staging` | elke minuut | 300 rijen uit `osm_staging` verwerken met `ingest_osm` |
| `scrape` | elke 15 s | 8 websites lezen zolang er werk in `private.scrape_queue` staat |
| `scrape-enqueue` | elk half uur | Nieuwe plekken met een website inplannen |
| `retention` | dagelijks 03:17 | **Nog niet actief**: `web/supabase/retention.sql` moet eenmalig worden uitgevoerd |

**Volgorde van gezag bij gegevens:** beheer (`sources.beheer`) > eigen website (`sources.website_fields`) > OSM.
Een websitewaarde die bij een volgende lezing niet meer op de site staat, wordt gewist.

## Beveiliging en privacy

- Row Level Security op alle tabellen in `public`; bezoekers lezen alleen gepubliceerde plekken, goedgekeurde reviews,
  gepubliceerde FAQ, woonplaatsen, instellingen en de routecache.
- Schrijven door bezoekers alleen via RPC's met validatie: `submit_review`, `submit_place`, `create_ticket`,
  `reply_ticket`, `track`, `log_consent`, `report_client_error`.
- Beheer-RPC's (`admin_overview`, `admin_pipeline`, `admin_stats`) controleren `is_admin()`. Beheeracties komen in
  `audit_log`.
- Pipeline-sleutel in `public.internal_secrets` (geen leesrechten voor anon).
- Geen cookies voor bezoekers; statistieken alleen na toestemming, zonder IP, in `events`. Eigen locatie wordt op het
  apparaat afgerond op ±1 km (`coarse()` in `web/src/lib/geo.ts`).
- Beveiligingsheaders in `web/next.config.ts` (nosniff, referrer-policy, permissions-policy, frame-options).
- Bewaartermijnen: statistieken 13 maanden, cookiekeuzes 24 maanden, systeemmeldingen 90 dagen, afgewezen reviews
  3 maanden, tickets 12 maanden na sluiten (laatste nog niet geautomatiseerd).
- Websitefoto's standaard tonen (besluit eigenaar), altijd met bronvermelding ("website domein.nl"), niet zelf
  opgeslagen, verwijdering op verzoek via Meld inhoud; uit te zetten met `website_photos`.

## Prestatie- en betrouwbaarheidsdoelen

| Doel | Waarde |
|---|---|
| Eerste weergave plekpagina op 4G | < 2,5 s (LCP), CLS < 0,1 |
| Zoekresultaten na filteren | < 100 ms (filtering in de browser op samenvattingen) |
| Versheid van data op de site | ≤ enkele minuten (`cacheLife("minutes")`) |
| Website-gegevens | Elke plek met website minstens één keer per volledige ronde gelezen (±4 uur per ronde) |
| OSM | Elke provincie eens per 7 dagen |
| Beschikbaarheid | Vercel en Supabase gratis niveau, geen SLA; terugval op de snapshot als Supabase onbereikbaar is |
| Back-up | Op het gratis niveau niet zelf terug te zetten via het dashboard (check de actuele voorwaarden van Supabase). Maak daarom zelf kopieën: `pg_dump` van de database en `export_snapshot()` + `web/scripts/write_snapshot.py` voor de snapshot in de repo |

## Omgevingen en oplevering

| Omgeving | Waar | Data |
|---|---|---|
| Lokaal | `cd web && npm install && npm run dev` (poort 3000) | Live Supabase (of snapshot met `VRIJSTAAN_OFFLINE=1`) |
| Productie | Vercel, branch `main` | Live Supabase |
| Staging | Nog niet; Vercel maakt per branch automatisch een preview-adres | Live Supabase (let op: dezelfde database) |

**Controles vóór elke push:** `npm run check` (lint + typecheck) en `VRIJSTAAN_OFFLINE=1 npm run build`.
**Edge function wijzigen:** alle drie bestanden samen deployen (`index.ts`, `extract.ts`, `osm.ts`), daarna
`select public.enqueue_scrape(false)` om alle sites opnieuw te laten lezen. Extractor-wijzigingen eerst lokaal testen
met Node (`node test.mjs ./extract.ts`) op echte zinnen.

## Belangrijke technische keuzes

| Keuze | Waarom | Alternatief |
|---|---|---|
| Supabase in plaats van eigen server | Database, auth, cron en functies in één gratis dienst in de EU | Eigen VPS met Postgres (meer beheer) |
| Scrapen met reguliere expressies, geen AI | Voorspelbaar, gratis, en elke waarde is herleidbaar tot een letterlijke zin | LLM-extractie (duurder, kan verzinnen) |
| Overpass via `pg_net` in de database | Edge-IP's werden door Overpass geweigerd | Rechtstreeks vanuit de edge function |
| Filteren in de browser | ~1.000 samenvattingen zijn klein genoeg; direct resultaat zonder server | Zoek-API met paginering |
| Accounts optioneel (sinds 12 oktober 2026) | Synchroniseren en foto's uploaden zonder drempel voor wie geen account wil | Geen accounts |
| Websitefoto's aan, met bron | Besluit eigenaar: foto's helpen kiezen. Risico: auteursrechtclaims; beperkt door bronvermelding, geen kopie en snelle verwijdering | Websitefoto's uit tot er toestemming is |
| Vercel Hobby | Gratis, beste ondersteuning voor Next.js 16 | Cloudflare/Netlify (gratis, commercieel toegestaan, minder zeker voor Next 16) |
