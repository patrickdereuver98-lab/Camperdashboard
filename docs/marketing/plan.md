# VrijStaan: plan marketing- en contentdashboard (2 november 2026)

Opdracht Patrick, 2 november 2026: de huidige marketingtool (AI-teksten per camperplaats in Mission Control)
verdwijnt. In de plaats komt een eigen **marketing- en contentdashboard** op `/admin/marketing` dat **VrijStaan
zelf promoot**, niet losse plekken: vindbaarheid in Google, promotiefilmpjes en beeld voor Instagram en TikTok,
captions, een contentkalender en een klein advertentiebudget.

Besluiten van Patrick (2 november 2026, keuzevragen):

| Vraag | Besluit |
|---|---|
| Waar komt het dashboard | `/admin/marketing`, eigen onderdeel in het beheer, alleen rol admin |
| Filmpjes | Sjablonen in code (Remotion) met echte cijfers en schermopnames van de app, geen AI-video |
| Instagram en TikTok | Het dashboard maakt het materiaal, Patrick plaatst zelf (geen app-review van Meta of TikTok nodig) |
| "Zoals BRAG" | latent-spaces/brag (agent-skill, Hyperframes); zie README 98 |

Status: ✅ klaar · 🔄 bezig · ⬜ open · 👤 alleen Patrick.

**Stand 2 november 2026:** fase 0 tot en met 4 gebouwd en getest (unit-, SQL- en renderproeven). Open: de migratie
live zetten na het samenvoegen, en de acties van Patrick in §6. Spec: [document 7](../specs/07-marketing-en-rebrand.md).

**Wijziging na het plan (README 98):** "BRAG" bleek [latent-spaces/brag](https://github.com/latent-spaces/brag), een
agent-skill die launch-video's maakt met Hyperframes. De Studio gebruikt daarom geen Remotion maar dezelfde werkwijze
als Hyperframes (HTML-sjabloon met tijdlijn → Chromium → ffmpeg), zonder extra pakket en zonder licentiegrens; P4
vervalt. `/brag-slim` staat in `.claude/skills/brag-slim` voor losse launch-video's.

---

## 1. Uitgangspunten

1. **Marketing voor de app.** Elk stuk content gaat over wat VrijStaan doet en voor wie: camperplaatsen in Nederland
   met echte prijzen, vertrektijd en voorzieningen. Plekken mogen als voorbeeld in beeld komen, maar het doel is
   altijd: mensen naar vrijstaan.nl en "zet op je beginscherm".
2. **Alleen echte cijfers.** Getallen in teksten en filmpjes komen uit de **feitenbank** (§3.1), live uit de
   database. Niemand typt een getal over, ook Gemini niet. Stand 2 november 2026: 2.186 gepubliceerde plekken in 12
   provincies, 1.412 met een vaste vertrektijd, 32 zonder vaste vertrektijd. Dat laatste getal is klein: geen
   campagne mag doen alsof "plekken zonder vertrektijd" het hoofdaanbod is.
3. **Toon:** de huisstijl (stijlgids, skill `vrijstaan-stijl`): je/jij, nuchter, korte zinnen, geen emoji, geen
   uitroeptekens, geen superlatieven. De site blijft gericht op 40+; advertenties mogen inhoudelijk mikken op 55+.
4. **Geen tracking van derden.** Geen Meta-pixel, TikTok-pixel of Google-tag op de site. Resultaat meten we met
   eigen, cookieloze middelen: `?bron=`-parameters (bestaat al voor de PWA: `/?bron=app`), de eigen tabel `events`
   (alleen met toestemming) en de cijfers die Google Search Console, Instagram en TikTok zelf al hebben.
5. **Budget € 50 tot € 100** voor betaalde promotie. Gereedschap kost € 0: Search Console, PageSpeed Insights,
   Gemini (gratis laag), Remotion (gratis tot 3 medewerkers), GitHub Actions, Supabase Storage (binnen de gratis laag).
6. **Mobiel eerst** ook voor het dashboard: Patrick moet onderweg een filmpje kunnen downloaden en een caption kopiëren.

## 2. Wat weg gaat en wat blijft

### Weg (fase 0)

| Onderdeel | Bestand | Waarom |
|---|---|---|
| Tab Marketing in Mission Control | `web/src/app/admin/mission-control/page.tsx` (functie `Marketing`, tab `marketing`) | Promoot plekken, niet de app |
| Route AI-teksten per plek | `web/src/app/api/admin/generate-marketing/route.ts` | Idem |
| Prompt, schema en controle per plek | `MARKETING_PROMPT`, `MARKETING_SCHEMA`, `marketingText`, `marketingFacts`, `parseMarketing` in `web/src/lib/marketing.ts` en de bijbehorende tests | Idem; de nieuwe prompts komen in `lib/marketing/` |
| Document 7 als plan | `docs/specs/07-marketing-en-rebrand.md` | Vervangen door dit plan; document 7 wordt de korte spec van het nieuwe dashboard |

### Blijft (dit is de SEO-fundering, geen marketingtool)

| Onderdeel | Waarom | Aanpassing |
|---|---|---|
| SEO-titel en -omschrijving per plek (`seoTitle`, `seoDescription`) | Gratis verkeer uit Google | "incl. toeslagen" alleen bij een vaste prijs, niet bij een vanaf-prijs (38 plekken, gemeten 2 november; voorbeeld Burgh: "vanaf € 11,62 alles inbegrepen" terwijl de site € 5 tot € 10 noemt) |
| JSON-LD `Campground`, sitemap | Rich results, indexering | `priceRange` volgt dezelfde regel |
| Deelafbeelding `/api/og?slug=` | Voorbeeld als iemand een plek deelt in WhatsApp of Facebook | Zelfde prijsregel. Wordt ook de basis voor de beeldsjablonen van de app (§3.4) |
| `lib/gemini.ts` | Gedeelde AI-aanroep | Geen |

## 3. Het dashboard

`/admin/marketing` met een eigen item in de beheerzijbalk en vijf onderdelen. Elk onderdeel is een eigen pagina
(`/admin/marketing/vindbaarheid` enzovoort), zodat het mobiel overzichtelijk blijft.

### 3.1 Overzicht en feitenbank (`/admin/marketing`)

**Overzicht:** één scherm met wat er deze week toe doet.
- Google: klikken, vertoningen, gemiddelde positie, verschil met vorige week (Search Console, §3.2).
- Eigen site: bezoekers, nieuwe installaties op het beginscherm (`/?bron=app`), bezoekers per `bron` (Instagram,
  TikTok, Facebook, Google Ads), uit `events` en `admin_stats`.
- Content: wat staat er deze week gepland, wat is klaar, wat is geplaatst (§3.5).
- Budget: uitgegeven van € 100, per campagne (§3.6).

**Feitenbank:** een databasefunctie `marketing_facts()` die de cijfers geeft die content mag gebruiken, met de datum
van de meting:

| Feit | Bron |
|---|---|
| Aantal gepubliceerde plekken, per provincie | `places` |
| Plekken met bekende vertrektijd, zonder vaste vertrektijd, uitslapers (12:00 of later) | `places` (`departureKind`) |
| Plekken met prijs, met all-in prijs voor 2 personen, gratis plekken | `places`, `nightTotal` |
| Nieuwe en bijgewerkte plekken deze week en deze maand | `places.created_at`, `verified_at` |
| Reviews, gemiddelde score | `reviews` |
| Bezoekers en installaties (alleen intern, nooit in publieke content zonder akkoord Patrick) | `events` |

Elke prompt en elk sjabloon krijgt alleen deze feiten. Een filmpje toont onderaan klein "Stand: 2 november 2026".

### 3.2 Vindbaarheid (`/admin/marketing/vindbaarheid`)

**Bronnen (allemaal gratis, server-side, geen bezoekersgegevens naar derden):**
- **Google Search Console API** (Search Analytics): klikken, vertoningen, CTR en positie per zoekvraag, pagina,
  land en apparaat. Toegang met een serviceaccount dat leesrechten heeft op de property `vrijstaan.nl`.
- **Search Console URL Inspection API**: is een pagina geïndexeerd, wanneer gecrawld. Limiet 2.000 per dag, dus
  alleen voor de belangrijkste pagina's en steekproeven.
- **Sitemaps API**: is de sitemap verwerkt, hoeveel URL's ingediend en geïndexeerd.
- **PageSpeed Insights API**: Core Web Vitals (veldgegevens uit Chrome) voor start, zoeken en een plekpagina.
- Optioneel later: Bing Webmaster Tools API.

**Opslag:** een dagelijkse cron (Supabase `pg_cron` roept een edge function aan, of een GitHub Action) haalt de
cijfers op en schrijft ze in `seo_daily` (per dag, zoekvraag, pagina). Search Console loopt 2 tot 3 dagen achter;
het dashboard zegt dat erbij. Zo blijft de historie langer dan de 16 maanden die Google bewaart, en is het
dashboard snel.

**Schermen:**
1. **Trend:** klikken en vertoningen per dag, 28 dagen en 3 maanden, met de vorige periode erbij.
2. **Zoekvragen:** tabel met zoekvraag, klikken, vertoningen, CTR en positie. Filters: merknaam ("vrijstaan") of niet,
   provincie, soort ("zonder vertrektijd", "camperplaats [plaats]").
3. **Pagina's:** welke plek- en landingspagina's verkeer krijgen, en welke niet.
4. **Kansen** (het belangrijkste scherm), volgens vaste regels, geen AI-gok:
   - Veel vertoningen, CTR onder het gemiddelde voor die positie → titel en omschrijving verbeteren.
   - Positie 8 tot 20 → pagina aanvullen (meer feiten, interne links), dicht bij pagina 1.
   - Zoekvraag zonder eigen pagina (bv. "camperplaats Texel" als er geen eilandpagina is) → nieuwe landingspagina,
     alleen als er genoeg plekken zijn (`MIN_PLACES`).
   - Niet geïndexeerde pagina uit de sitemap → oorzaak tonen (URL Inspection).
   Gemini mag per kans een voorstel voor titel en omschrijving schrijven, met de feitenbank en de echte zoekvraag;
   Patrick neemt het over of niet. Niets wordt automatisch op de site gezet.
5. **Techniek:** sitemapstatus, aantal geïndexeerde pagina's, Core Web Vitals, en een controle van de
   JSON-LD van een steekproef van plekpagina's.

### 3.3 Contentstudio (`/admin/marketing/content`)

Teksten voor Instagram, TikTok en Facebook over de app.

**Werkwijze:** kies een **onderwerp** (contentpijler) en een **kanaal** → Gemini schrijft 3 varianten → kies,
pas aan, sla op als content-item (§3.5) → koppel beeld of filmpje.

**Contentpijlers (vast, uit de PRD):**

| Pijler | Voorbeeld |
|---|---|
| Wat de app doet | "Zie per plek hoe laat je weg moet, voordat je rijdt" |
| Cijfers | "2.186 camperplaatsen in Nederland, met prijs en voorzieningen" (feitenbank) |
| Hoe werkt het | Zoeken op de kaart, Dichtbij, Mijn reis, op het beginscherm zetten |
| Seizoen en regio | "Camperplaatsen in Zeeland, buiten het hoogseizoen" (provinciecijfers) |
| Doe mee | Vertrektijd melden, foto toevoegen, review schrijven |
| Nieuw | Nieuwe functie of nieuwe plekken deze maand |

**Per kanaal:** Instagram (caption tot 2.200 tekens, eerste regel als haak, 3 tot 5 hashtags), TikTok (korte
caption, tekst-in-beeld voor het filmpje, 3 tot 5 hashtags), Facebook (langere post, link met `?bron=facebook`),
Google Ads (kop tot 30, omschrijving tot 90 tekens). Elke link krijgt automatisch de juiste `bron`.

**Controle na Gemini (code, niet het model):** emoji en uitroeptekens eruit, lengte per kanaal, en elk getal in
de tekst moet in de feitenbank staan. Een getal dat er niet in staat, wordt rood gemarkeerd en het item kan niet
op "klaar".

### 3.4 Beeld- en videostudio (`/admin/marketing/studio`)

**Filmpjes met Remotion** (React-sjablonen die een MP4 opleveren), in de huisstijl: zandpapier, bosgroen, de
lettertypen van de site, grote letters (leesbaar zonder geluid, ondertitels altijd in beeld).

Formaten: 9:16 (Reels, TikTok, Stories, 1080 × 1920), 1:1 en 4:5 (tijdlijn). Lengte 8 tot 30 seconden.

**Eerste vijf sjablonen:**

| Sjabloon | Inhoud | Gegevens |
|---|---|---|
| Cijfers | Teller "2.186 camperplaatsen", daarna 3 feiten, eind met logo en vrijstaan.nl | Feitenbank |
| Zo werkt het | Schermopnames van de app (zoeken → plek → vertrektijd → route) met korte ondertitels | Schermopnames (hieronder) |
| Provincie | Kaart van één provincie, aantal plekken, prijsbereik, uitslapers | Feitenbank per provincie |
| Nieuw deze maand | Nieuwe functie of nieuwe plekken, met schermopname | Feitenbank, changelog |
| Doe mee | "Weet jij hoe laat je weg moet? Meld het" met schermopname van het meldformulier | Vast |

**Schermopnames, automatisch:** een GitHub Action met Playwright (staat al in het project) maakt elke week echte
schermopnames en korte opnames van de app op een telefoonformaat (start, zoeken, plekpagina, Dichtbij, Mijn reis) en
zet ze in Supabase Storage (bucket `marketing`). Zo tonen filmpjes altijd de app zoals hij nu is.

**Voorbeeld en maken:**
- **Voorbeeld:** `@remotion/player` in het dashboard: direct afspelen, tekst en sjabloon aanpassen.
- **Renderen naar MP4:** niet op Vercel (Hobby heeft te weinig tijd en geheugen). De knop "Maak MP4" zet een
  opdracht in de tabel `render_jobs`; een GitHub Action (gratis minuten) rendert met `@remotion/renderer` en zet
  het bestand in Storage. Het dashboard toont de status en daarna de downloadknop. Duur: 1 tot 3 minuten per filmpje.
- Alternatief om te onderzoeken in fase 2: renderen in de browser (`@remotion/web-renderer`). Scheelt de Action,
  maar is nog experimenteel.

**Afbeeldingen** (sneller dan video, ook nodig): met `ImageResponse` (zoals `/api/og`) sjablonen voor carrousels
(4:5, 5 tot 8 dia's), Stories (9:16) en een tijdlijnpost (1:1). Gegenereerd op aanvraag, direct te downloaden.

**"Zoals BRAG":** zodra de naam bekend is (O1), vergelijken we wat die tool doet met deze aanpak en nemen we de
bruikbare ideeën over (sjablonen, stijl, werkwijze). Koppelen alleen als er een API is, het binnen het budget past en
er geen bezoekersgegevens heen gaan.

### 3.5 Kalender en bibliotheek (`/admin/marketing/kalender`)

- **Kalender:** week- en maandoverzicht van content-items per kanaal, met status: idee → in de maak → klaar →
  geplaatst. Bij "geplaatst" vult Patrick de link naar de post in.
- **Bibliotheek:** alle filmpjes, afbeeldingen en schermopnames uit Storage, met zoeken op sjabloon, kanaal en datum.
- **Herinnering (optioneel):** pushmelding of mail op de dag dat iets gepland staat (de site heeft al pushmeldingen).

### 3.6 Kanalen en campagnes (`/admin/marketing/campagnes`)

- **Linkmaker:** maakt `vrijstaan.nl/...?bron=instagram&campagne=voorjaar` en een QR-code (voor flyers op
  camperplaatsen). De site bewaart `bron` en `campagne` in `events` als de bezoeker toestemming gaf, verder niet.
- **Campagnes:** naam, kanaal, budget, start en eind, uitgegeven bedrag (Patrick vult in vanuit Meta of Google Ads),
  en de resultaten uit `events` (bezoekers en installaties per `bron`/`campagne`).
- **Instagram- en TikTok-cijfers:** fase 4 en optioneel. Instagram Insights via de Graph API kan met een zakelijk
  account en een Meta-app in ontwikkelmodus (alleen eigen account, geen review nodig voor lezen). TikTok vraagt een
  ontwikkelaarsapp met goedkeuring; tot die er is vult Patrick de weergaven handmatig in of laten we het weg.

**Voorstel voor het budget (€ 100):**

| Post | Bedrag | Doel |
|---|---|---|
| Instagram/Facebook: 2 filmpjes promoten, 7 dagen, 45+, interesse camper | € 40 | Welke boodschap werkt: cijfers of "zo werkt het" |
| Google Ads: zoekwoorden "camperplaats [provincie]", "camperplaats zonder vertrektijd" (exact), dagbudget € 3 | € 40 | Verkeer met koopintentie, vergelijken met organisch |
| Reserve voor de winnaar | € 20 | Verlengen wat werkt |

Organisch (€ 0, meeste effect bij deze doelgroep): posten in Facebook-groepen van camperaars (met toestemming van de
beheerders), Instagram en TikTok 2 tot 3 keer per week, QR-flyers bij camperplaatsen die meedoen.

## 4. Datamodel (nieuwe migratie, RLS: alleen `has_admin_role()`)

| Tabel / functie | Kolommen (kort) | Bewaartermijn |
|---|---|---|
| `marketing_facts()` | Functie, geeft de feitenbank als JSON met meetdatum | — |
| `seo_daily` | date, query, page, country, device, clicks, impressions, ctr, position | 3 jaar |
| `seo_pages` | url, indexed, last_crawl, verdict, checked_at | Laatste stand |
| `content_items` | id, pillar, channel, title, body, hashtags, link, status, planned_at, posted_url, asset_ids, created_by | Onbeperkt (eigen content) |
| `marketing_assets` | id, kind (video, afbeelding, schermopname), template, format, storage_path, facts_snapshot, created_at | 2 jaar, daarna opruimen |
| `marketing_jobs` | id, kind (video, schermopnames), template, format, props, status (wacht, bezig, klaar, fout), error, created_at | 30 dagen |
| `campaigns` | id, name, channel, budget_eur, spent_eur, starts_on, ends_on, bron, campagne | Onbeperkt |
| Storage-bucket `marketing` | Privé, alleen admin; downloadlinks met korte geldigheid | Zoals `marketing_assets` |

`events` krijgt geen nieuwe kolommen: `bron` en `campagne` gaan in `props`.

Geheimen (alleen in GitHub, niet in de website): `SUPABASE_DB_URL` (bestond al; jobs oppakken via
`private.marketing_claim_job()`), `GSC_SERVICE_ACCOUNT_JSON`, optioneel `PAGESPEED_API_KEY`, `IG_ACCESS_TOKEN`, `IG_USER_ID`.
Uploaden naar de bucket gaat met de publishable key en een opslagregel die alleen `jobs/<id>/` van een lopende job toestaat.

## 5. Fasering

Elke fase is een eigen PR naar `acceptatie`, met `npm run check`, `npm test` en `VRIJSTAAN_OFFLINE=1 npm run build`
groen. Migraties gaan pas live als de code samengevoegd is.

### Fase 0: opruimen en basis (± 1 dag)

| Taak | Klaar als |
|---|---|
| ✅ Tab Marketing en `/api/admin/generate-marketing` verwijderen, ongebruikte code en tests uit `lib/marketing.ts` | Mission Control heeft weer drie tabbladen; build groen |
| ✅ Prijsregel: geen "incl. toeslagen" bij een vanaf-prijs (titel, omschrijving, JSON-LD, `/api/og`) | Test met Burgh-achtig geval; de 38 plekken tonen "vanaf € x per nacht" |
| ✅ `/admin/marketing` met zijbalkitem en lege onderdelen | Alleen admin ziet het |
| ✅ Migratie: tabellen en `marketing_facts()` (§4), SQL-tests | Tests groen; live na samenvoegen |
| ✅ Specs: document 7 herschrijven tot spec van het dashboard, App Flow, Backend Schema, TRD, implementatieplan | In dezelfde PR |

### Fase 1: vindbaarheid en overzicht (± 2 tot 3 dagen)

| Taak | Klaar als | Afhankelijk van |
|---|---|---|
| ✅ Search Console-koppeling (serviceaccount, Search Analytics, Sitemaps) | Cijfers van gisteren in `seo_daily` | 👤 P1, P2 |
| ✅ Dagelijkse cron en ophalen van 16 maanden historie bij de eerste run | Trend toont 3 maanden | — |
| ✅ Schermen Trend, Zoekvragen, Pagina's, Techniek | Werkt op telefoon | — |
| ✅ Kansen met vaste regels, optioneel Gemini-voorstel per kans | Minstens één regel per soort kans getest | — |
| ✅ Overzicht met Google, eigen bezoekers per `bron`, installaties | Getallen gelijk aan Statistieken en Search Console | — |
| ✅ Site: `bron` en `campagne` uit de URL meesturen in `events` (alleen met toestemming) | Test: `?bron=instagram` verschijnt in het overzicht | — |

### Fase 2: content en beeld (± 3 dagen)

| Taak | Klaar als |
|---|---|
| ✅ Contentstudio: pijlers, kanalen, Gemini (3 varianten), controle op emoji, lengte en getallen | Een tekst met een verzonnen getal kan niet op "klaar" |
| ✅ Kalender en bibliotheek | Item van idee tot geplaatst, met link |
| ✅ Afbeeldingssjablonen (carrousel, Story, tijdlijn) met `ImageResponse` | Download in drie formaten |
| ✅ Linkmaker met QR-code | QR leidt naar de juiste `bron` |

### Fase 3: video (± 3 tot 4 dagen)

| Taak | Klaar als | Afhankelijk van |
|---|---|---|
| ✅ ~~Remotion~~ eigen HTML-sjablonen (werkwijze Hyperframes), sjablonen Cijfers en Provincie | Voorbeeld speelt in het dashboard | — |
| ✅ GitHub Action: wekelijkse schermopnames met Playwright naar Storage | Nieuwe opnames na elke week | — |
| ✅ Sjablonen Zo werkt het, Nieuw, Doe mee | Vijf sjablonen | — |
| ✅ Renderen via `marketing_jobs` en GitHub Action, downloadknop | MP4 binnen 3 minuten | — |
| ✅ Vergelijking met "BRAG" en wat we overnemen | Notitie in dit plan | O1 |

### Fase 4: campagnes en sociale cijfers (± 2 dagen, optioneel)

| Taak | Klaar als | Afhankelijk van |
|---|---|---|
| ✅ Campagnes met budget en resultaat per `bron` | Budgetbalk klopt met ingevulde bedragen | — |
| ✅ Instagram Insights (Graph API, eigen account) | Bereik en weergaven per post | 👤 P5 |
| ✅ TikTok-cijfers handmatig invullen (API vraagt een goedgekeurde app) | Weergaven per post | 👤 P6 alleen voor de API |

## 6. Wat Patrick moet regelen (👤)

| # | Wat | Voor fase |
|---|---|---|
| P1 | vrijstaan.nl verifiëren in Google Search Console (domeinproperty, via een DNS-record) en de sitemap insturen | 1 |
| P2 | In Google Cloud een project en serviceaccount maken, de Search Console API (en PageSpeed Insights API) aanzetten, het serviceaccount als gebruiker (beperkt) toevoegen in Search Console, de JSON-sleutel als **GitHub-secret** `GSC_SERVICE_ACCOUNT_JSON` (Settings → Secrets and variables → Actions) | 1 |
| P3 | Naam of link van "BRAG" | 3 |
| P4 | ~~Remotion-licentie~~ vervallen: geen Remotion gebruikt (README 98) | — |
| P5 | Instagram omzetten naar een zakelijk of creatoraccount, gekoppeld aan een Facebook-pagina; een Meta-app (ontwikkelmodus) met een langlevend token; `IG_ACCESS_TOKEN` en `IG_USER_ID` als GitHub-secrets (token elke 60 dagen vernieuwen) | 4 |
| P6 | Eventueel een TikTok-ontwikkelaarsaccount aanvragen | 4 |
| P7 | Advertentieaccounts bij Meta en Google Ads, en het budget vrijgeven | 4 |

## 7. Risico's en open punten

| # | Punt | Voorstel |
|---|---|---|
| O1 | ~~"Zoals BRAG": tool onbekend~~ | Opgelost: latent-spaces/brag (README 98) |
| O2 | Vercel Hobby is niet-commercieel (specs README 6); betaalde advertenties voor de site kunnen als commercieel gelden | Vóór de eerste betaalde campagne beoordelen; zo nodig Vercel Pro (± $ 20 per maand, buiten het marketingbudget) |
| O3 | Gemini gratis laag: Google mag invoer gebruiken om het product te verbeteren | Alleen feitenbank en eigen teksten gaan erheen, geen bezoekers- of accountgegevens |
| O4 | Cijfers in content verouderen | Elk filmpje en elke afbeelding bewaart de meetdatum (`facts_snapshot`) en toont "Stand: [datum]" |
| O5 | Kleine aantallen kunnen overdreven overkomen (32 plekken zonder vaste vertrektijd) | Pijler Cijfers gebruikt alleen feiten boven een drempel; "zonder vertrektijd" alleen als functie (filter), niet als aantal |
| O6 | GitHub Actions-minuten (gratis 2.000 per maand voor privé-repo's; de repo is openbaar, dan onbeperkt) | Een run zonder opdracht stopt na de telling (±15 s). Wordt de repo privé, zet de jobs-cron dan op elk uur |
| O7 | Search Console geeft alleen data van de eigen property | Geen concurrentieanalyse; daarvoor zijn betaalde tools nodig die buiten het budget vallen |
| O8 | Schermopnames kunnen persoonlijke gegevens tonen (Mijn reis, account) | Opnames met een vast testaccount zonder echte gegevens, nooit met een echt account |

## 8. Documenten die meeveranderen

In dezelfde PR als de code: `docs/specs/07-marketing-en-rebrand.md` (wordt de spec van het dashboard),
`03-app-flow.md` (beheer → Marketing), `05-backend-schema.md` (tabellen, bucket, bewaartermijnen), `02-TRD.md`
(Search Console, PageSpeed, Remotion, GitHub Action, geheimen), `06-implementatieplan.md` (fasen als taken),
`docs/specs/README.md` (O2 als open punt), privacyverklaring (`bron`/`campagne` in `events`).
