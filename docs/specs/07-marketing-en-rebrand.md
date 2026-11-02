# 7. Marketing

> **Wordt vervangen (2 november 2026).** De AI-teksten per camperplaats verdwijnen; er komt een eigen marketing- en
> contentdashboard dat de app promoot. Plan: [`docs/marketing/plan.md`](../marketing/plan.md). De SEO-fundering hieronder
> (titels, JSON-LD, sitemap, `/api/og`) blijft. Dit document wordt de spec van het nieuwe dashboard zodra fase 0 klaar is.

Opdracht eigenaar, 2 november 2026: een geautomatiseerde SEO- en marketingmachine met een micro-budget (€ 50 tot
€ 100). Dit document is het plan; de status staat in het [implementatieplan](06-implementatieplan.md#marketing-opdracht-2-november-2026-).

**Geen rebrand (besluit eigenaar 2 november 2026):** de naam blijft **VrijStaan**, het domein **vrijstaan.nl**. Het
huidige logo, de huisstijl en de technische namen blijven zoals ze zijn. Er komt geen nieuw logo en geen globale
vervanging. Nieuwe code leest naam en domein uit `web/src/lib/brand.ts`.

## Stand

| Onderdeel | Status |
|---|---|
| Naam, domein en logo | Blijven VrijStaan, vrijstaan.nl en het huidige logo |
| SEO-titels en omschrijvingen per plek | ✅ Gebouwd (`lib/marketing.ts`, plekpagina) |
| JSON-LD Campground | ✅ Bestond al; aangevuld met `checkoutTime`, `checkinTime` en `priceRange` |
| Sitemap met alleen gepubliceerde plekken | ✅ Bestond al (`app/sitemap.ts`, `getSlugs` filtert op `status=published`) |
| Deelafbeelding per plek (`/api/og`) | ✅ Gebouwd |
| Mission Control → Marketing (Gemini) | ✅ Gebouwd (`/api/admin/generate-marketing`, gedeelde helper `lib/gemini.ts`) |

## Doelgroep en aanspreekvorm

- **De hele site en de codebase:** doelgroep 40+ (README 65) en de je/jij-vorm uit de stijlgids en de skill
  `vrijstaan-stijl`. Dat verandert niet.
- **Alleen de advertentieteksten** (Facebook-posts en Google Ads uit Mission Control) richten zich inhoudelijk op
  camperaars van 55+, ook in de leeftijdsinstelling van de campagne. Ook die teksten gebruiken je/jij.

## Toon

Nuchter, betrouwbaar, praktisch: je weet wat je krijgt, er wordt niets mooier gemaakt dan het is.

- Feiten eerst: prijs met alle toeslagen, vertrektijd, voorzieningen. Wat we niet weten, zeggen we niet.
- Gewoon Nederlands, je-vorm, korte zinnen. Geen Engelse vaktermen ("app" mag, "seamless", "smart", "AI-powered" niet).
- Geen emoji, geen uitroeptekens, geen superlatieven ("de beste", "uniek", "verborgen parel").
- Getallen exact: "€ 22,70 per nacht voor 2 personen, inclusief toeslagen", niet "rond de 20 euro".
- Kleur en letter volgen het vaste thema "natuur & vrijheid" (UI/UX-brief): zandpapier, bosgroen, inkt.

## Programmatische SEO

Doel: gratis verkeer uit Google op zoekvragen als "camperplaats Ede", "camperplaats zonder vertrektijd Zeeland".

**Per plek (gebouwd):**
- Titel: `Camperplaats [naam] in [plaats]: [prijs] incl. toeslagen` (de layout zet de merknaam erachter). "incl.
  toeslagen" alleen als het totaal voor 2 personen vaststaat (`nightTotal`); anders alleen de bekende prijs.
- Omschrijving: `Camperplaats [naam] in [plaats] ([provincie]): [prijs]. Vertrektijd: [tijd].` Onbekende feiten
  vallen weg, nooit "onbekend" in een zoekresultaat.
- JSON-LD `Campground` met adres, coördinaten, voorzieningen, score, `checkoutTime` (alleen een vaste, leesbare tijd),
  `checkinTime` en `priceRange` (dezelfde prijszin als de omschrijving).
- `og:image` en `twitter:image` wijzen naar `/api/og?slug=...`.

**Overzichtspagina's (bestond al):** provincie, eiland en vertrekgroep (`zonder-vertrektijd`, `uitslapers`), alleen
in de sitemap en op index als er genoeg plekken zijn (`MIN_PLACES`), zodat Google geen dunne pagina's ziet.

**Sitemap (bestond al):** vaste pagina's, provincies, landingspagina's en alle gepubliceerde plekken met
`lastModified` = laatste controle.

**Volgende stappen (geen code nodig, € 0):** de site aanmelden bij Google Search Console en Bing Webmaster Tools,
de sitemap insturen, en na 4 weken de zoekvragen met veel vertoningen en weinig klikken bekijken.

## Deelafbeelding (`/api/og`)

`GET /api/og?slug=...` maakt een PNG van 1200 × 630 met `ImageResponse` (Satori): naam, plaats, all-in prijs en
vertrektijd in grote letters (68/64 px, ook leesbaar als klein voorbeeld op een telefoon), merknaam en domein onderaan.
Onbekende feiten laten we weg. Cache: 1 uur in de browser, 1 dag op de CDN. Ongeldige slug geeft 400, onbekende
plek 404.

## AI-marketing (Mission Control → Marketing)

**Flow:** beheerder zoekt een plek (naam of plaats, alleen gepubliceerd) → "Teksten schrijven" → 2 Facebook-posts en
2 Google Ads-teksten (kop ≤ 30, omschrijving ≤ 90 tekens) met kopieerknop → deelafbeelding bekijken of downloaden.
Niets wordt opgeslagen; de beheerder leest na en plaatst zelf.

**Techniek:** `POST /api/admin/generate-marketing { slug }` met het sessietoken van de beheerder. De route controleert
`has_admin_role` met dat token (RLS beslist, geen service-role-sleutel), haalt de openbare plekgegevens en stuurt
alleen bekende feiten naar Gemini via `geminiJson` uit `lib/gemini.ts` (`GEMINI_MODEL`, standaard `gemini-2.5-flash`, sleutel `GEMINI_API_KEY` alleen op
de server). Geen telefoonnummers, e-mailadressen of gebruikersgegevens. Het antwoord wordt gecontroleerd
(`parseMarketing`): precies 2 + 2, emoji eruit, lengtes begrensd. Rate limit 20 per minuut per IP.

**Prompt (vast, `MARKETING_PROMPT`):** de opdracht van de eigenaar letterlijk, aangevuld met "gebruik alleen de
feiten hieronder, wat onbekend is noem je niet", je/jij (nooit u), geen uitroeptekens of superlatieven, en de lengtes van Google Ads.

## Budget (€ 50 tot € 100)

| Post | Kosten | Waarom |
|---|---|---|
| SEO, sitemap, deelafbeeldingen, Search Console | € 0 | Gebouwd of gratis dienst |
| Gemini Flash | ± € 0 | Gratis laag ruim genoeg voor tientallen plekken per week |
| Facebook: organisch posten in camperaarsgroepen (met toestemming van de beheerders) | € 0 | Grootste bereik bij 55+; deelafbeelding doet het werk |
| Facebook-advertentie: 3 plekken, 1 week, regio's met veel camperaars, leeftijd 55+ | € 30 tot € 50 | Testen welke boodschap werkt (prijs of vertrektijd) |
| Google Ads: 2 advertentiegroepen ("camperplaats zonder vertrektijd", "camperplaats [provincie]") | € 20 tot € 50 | Alleen exacte zoekwoorden, dagbudget € 3 |

Meten zonder tracking van derden: geen Facebook-pixel of Google-tag op de site. We gebruiken UTM-parameters in de
links en de eigen, cookieloze statistieken van Beheer → Statistieken.
