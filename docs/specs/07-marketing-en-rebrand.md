# 7. Marketing en rebrand

Opdracht eigenaar, 2 november 2026: rebrand en een geautomatiseerde SEO- en marketingmachine met een micro-budget
(€ 50 tot € 100). Dit document is het plan; de status staat in het [implementatieplan](06-implementatieplan.md#marketing-en-rebrand-opdracht-2-november-2026-).

## Stand

| Onderdeel | Status |
|---|---|
| Merknaam | **Open.** De opdracht noemt de naam letterlijk "[NAAM]" (een invulplek). Zonder echte naam en domein is er niets om naar te vervangen (README 97) |
| Globale vervanging VrijStaan → nieuwe naam | **Wacht op de naam.** Voorbereid: nieuwe code leest `BRAND_NAME` en `BRAND_DOMAIN` uit `web/src/lib/brand.ts` |
| Logo (`web/public/logo.svg`) | **Wacht op de naam.** Ontwerpregels staan hieronder |
| SEO-titels en omschrijvingen per plek | ✅ Gebouwd (`lib/marketing.ts`, plekpagina) |
| JSON-LD Campground | ✅ Bestond al; aangevuld met `checkoutTime`, `checkinTime` en `priceRange` |
| Sitemap met alleen gepubliceerde plekken | ✅ Bestond al (`app/sitemap.ts`, `getSlugs` filtert op `status=published`) |
| Deelafbeelding per plek (`/api/og`) | ✅ Gebouwd |
| Mission Control → Marketing (Gemini) | ✅ Gebouwd (`/api/admin/generate-marketing`) |

## Merkidentiteit

**Karakter:** nuchter, betrouwbaar, praktisch. Zoals een goede pechhulp of een degelijke reisgids: je weet wat je
krijgt, er wordt niets mooier gemaakt dan het is. We lenen het gevoel van een vertrouwde Nederlandse
reisorganisatie, niet het uiterlijk: geen geel-blauw, geen huisstijl of beeldmerk dat op een bestaand merk lijkt.

**Doelgroep van de campagnes:** camperaars van 55+. Het product zelf richt zich op 40+ (README 65); de campagnes
mikken op de oudere, kapitaalkrachtige kern daarvan. Ontwerpregels blijven getoetst aan de oudere lezer (README 96).

**Toon (sluit aan op de stijlgids en `vrijstaan-stijl`):**
- Feiten eerst: prijs met alle toeslagen, vertrektijd, voorzieningen. Wat we niet weten, zeggen we niet.
- Gewoon Nederlands, je-vorm, korte zinnen. Geen Engelse vaktermen ("app" mag, "seamless", "smart", "AI-powered" niet).
- Geen emoji, geen uitroeptekens, geen superlatieven ("de beste", "uniek", "verborgen parel").
- Getallen exact: "€ 22,70 per nacht voor 2 personen, inclusief toeslagen", niet "rond de 20 euro".

**Kleur en letter:** het thema "natuur & vrijheid" staat vast (UI/UX-brief): zandpapier, bosgroen, inkt. De
rebrand verandert naam en logo, niet het thema.

**Logo, ontwerpregels (zodra de naam er is):**
- Alleen typografisch: de naam in één schreefloze letter met open vormen (zoals de huidige lettertypen van de site),
  halfvet, geen hoofdletters-alleen, geen afgekapte of in elkaar geschoven letters.
- Bosgroen `#2d5a43` op licht, `#fffcf6` op donker; contrast minstens 7:1 (AAA) op zandpapier.
- Leesbaar vanaf 16 px hoog; geen dunne lijnen onder 2 px bij 32 px hoogte.
- Tekst als paden in de SVG (geen afhankelijkheid van een lettertype), met `<title>` voor schermlezers.
- Optioneel één eenvoudig teken vóór de naam (bijvoorbeeld een stip of een open hoek als "vrij staan"), nooit een
  camper-icoon dat op een bestaand merk lijkt.

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
alleen bekende feiten naar Gemini (`GEMINI_MODEL`, standaard `gemini-2.5-flash`, sleutel `GEMINI_API_KEY` alleen op
de server). Geen telefoonnummers, e-mailadressen of gebruikersgegevens. Het antwoord wordt gecontroleerd
(`parseMarketing`): precies 2 + 2, emoji eruit, lengtes begrensd. Rate limit 20 per minuut per IP.

**Prompt (vast, `MARKETING_PROMPT`):** de opdracht van de eigenaar letterlijk, aangevuld met "gebruik alleen de
feiten hieronder, wat onbekend is noem je niet", de je-vorm uit de huisstijl en de lengtes van Google Ads.

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

## Rebrand: wat er verandert zodra de naam er is

1. Naam en domein in `web/src/lib/brand.ts`.
2. Zichtbare teksten, metadata (`layout.tsx`, `lib/meta.ts`, `manifest.ts`), juridische pagina's, e-mailsjablonen,
   `og.png` en iconen. Telling 2 november 2026: 119 bestanden, ± 400 vermeldingen.
3. Niet blind vervangen: technische namen die gebruikers niet zien en die bestaande data of koppelingen dragen
   (`vrijstaan:`-sleutels in localStorage, header `x-vrijstaan-key`, `VRIJSTAAN_OFFLINE`, pakketnaam, Supabase-project,
   edge functions, GitHub-workflows). Die blijven, of gaan over met een migratiepad.
4. Nieuw domein: 301 van het oude domein, Search Console "adreswijziging", `NEXT_PUBLIC_SITE_URL` in Vercel, de
   redirect-URL's in Supabase Auth en de afzender van de mail.
5. Logo als `web/public/logo.svg` volgens de regels hierboven; skill `vrijstaan-stijl` en stijlgids bijwerken.
