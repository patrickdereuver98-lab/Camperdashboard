# 7. Marketing

Spec van het marketing- en contentdashboard (`/admin/marketing`), gebouwd op 2 november 2026 volgens
[`docs/marketing/plan.md`](../marketing/plan.md). Het dashboard promoot **VrijStaan zelf**, niet losse plekken. De
naam blijft VrijStaan, het domein vrijstaan.nl en het logo het huidige (geen rebrand, besluit eigenaar 2 november).

## Spelregels

- **Doelgroep en toon:** de site blijft gericht op 40+ en gebruikt de je/jij-vorm. Advertenties mogen inhoudelijk
  mikken op 55+ (leeftijd in de campagne, onderwerpen), ook in de je-vorm. Nuchter, geen emoji, geen uitroeptekens,
  geen superlatieven.
- **Alleen echte cijfers:** elk getal komt uit de feitenbank (`public.marketing_facts()`), met meetdatum. Aantallen
  onder 50 zijn niet publiek (`PUBLIC_MIN`): dan noem je de functie, niet het aantal. Teksten doen niet alsof elke plek
  een prijs of vertrektijd heeft ("als we die weten").
- **Geen tracking van derden:** geen pixels of tags van Meta, TikTok of Google. Herkomst via `?bron=` en
  `?campagne=` in de eigen tabel `events`, alleen met toestemming.
- **Prijs:** "inclusief toeslagen" alleen bij een vaste prijs met een volledig totaal voor 2 personen; nooit bij een
  vanaf-prijs (`lib/place-seo.ts`).

## Onderdelen

| Pagina | Wat | Gegevens |
|---|---|---|
| Overzicht `/admin/marketing` | Google (28 dagen, tegenover de vorige 28), bezoekers per bron, content van deze week, budget, feitenbank | `seo_totals`, `marketing_traffic()`, `content_items`, `campaigns`, `marketing_facts()` |
| Vindbaarheid | Cijfers en staafdiagrammen, kansen (vaste regels: weinig klikken, bijna top 10, nieuwe pagina), zoekvragen, pagina's, techniek (sitemaps, indexering, Core Web Vitals); per kans een Gemini-voorstel voor titel en omschrijving | `marketing_seo_rows()`, `seo_pages`, `seo_status`, `lib/marketing/seo.ts` |
| Content | Onderwerp + kanaal + wens → 3 varianten (Gemini); controle in code (getallen, emoji, uitroeptekens, superlatieven, u-vorm, lengte); bewaren als idee of (alleen bij groene controle) klaar | `/api/admin/marketing/write`, `lib/marketing/content.ts` |
| Studio | Filmpjes: 5 sjablonen in 3 formaten, live voorbeeld, "Maak MP4" (GitHub Action), schermopnames van de app. Afbeeldingen: 5 sjablonen + carrousel in 3 formaten | `lib/marketing/video.ts`, `/api/marketing/beeld`, `marketing_jobs` |
| Kalender | Content per dag, status idee → in de maak → klaar → geplaatst, link naar de post; Bibliotheek met filmpjes, omslagen en schermopnames | `content_items`, `marketing_assets`, bucket `marketing` |
| Campagnes | Linkmaker met QR-code, campagnes met budget, uitgegeven bedrag en bezoeken per campagne, sociale cijfers | `campaigns`, `social_stats`, `marketing_traffic()` |

## Achter de schermen

- **Nachtrun** (`.github/workflows/marketing.yml`, 05:17 UTC): `scripts/marketing/search-console.ts` haalt Search
  Console (16 maanden bij de eerste run), PageSpeed en Instagram op en schrijft via `SUPABASE_DB_URL`.
- **Opdrachten** (elke 10 minuten tussen 06 en 22 UTC, maandag ook nieuwe schermopnames): `scripts/marketing/jobs.ts`
  pakt een job, maakt schermopnames van de live site (390 × 844, zonder account, cookiebalk en welkom vooraf
  "gezien"), rendert het filmpje frame voor frame met Chromium en ffmpeg (H.264, 30 fps), maakt een omslag en uploadt
  naar `jobs/<id>/` in de privé bucket.
- **Launch-video's** met `/brag-slim` (latent-spaces/brag, MIT) in een Claude Code-sessie; huisregels in
  `.claude/skills/brag-slim/VRIJSTAAN.md`.

## SEO per plek (blijft)

- Titel `Camperplaats [naam] in [plaats]: [prijs] incl. toeslagen` (alleen bij een vast, volledig totaal),
  omschrijving met prijs en `Vertrektijd: [tijd]`; onbekend valt weg.
- JSON-LD `Campground` met `checkoutTime`, `checkinTime` en `priceRange`; sitemap met alleen gepubliceerde plekken.
- Deelafbeelding `/api/og?slug=` (Geist, grote letters, prijs en vertrektijd).

## Budget

€ 50 tot € 100 voor betaalde promotie (plan §3.6). Gereedschap € 0. Vóór de eerste betaalde campagne: Vercel Hobby
is niet-commercieel (README 97).
