# VrijStaan: verbeterplan na de feature review (15 oktober 2026)

Dit plan voegt drie losse reviews samen tot één aanpak:

| Review | Rol | Rapport |
|---|---|---|
| UI/UX technisch design | stijl, navigatie, look & feel, toegankelijkheid, concurrentieonderzoek | [`docs/review/01-ui-ux.md`](docs/review/01-ui-ux.md) |
| Senior developer + security | schone code, architectuur, tests, volledige security-audit | Niet in deze publieke repo (zie §2) |
| Eindgebruiker | persona's, kernreizen, inhoud van de data, gebruikerswensen | [`docs/review/03-gebruiker.md`](docs/review/03-gebruiker.md) |

Methode: code en de zes basisdocumenten gelezen, de app doorlopen op 390 px (offline snapshot van 680 plekken; kaart
en live database waren in de sandbox niet bereikbaar), de snapshot statistisch geanalyseerd, live Supabase-advisors
alleen gelezen, en vergeleken met park4night, Campercontact (NKC), ACSI, Stellplatz.info, Stellplatz-Radar,
Searchforsites, iOverlander, Airbnb/Booking en Komoot. Voor de security-audit zijn `supabase/agent-skills`,
`trailofbits/skills` en OWASP ASVS 5.0 / Top 10 als checklist gebruikt.

Omvang: **S** ≤ 1 dag, **M** 2–5 dagen, **L** > 1 week.

---

## 1. Waar we staan

**Sterk (behouden):** vertrektijd als kernfeit, eerlijke prijzen, rijtijd i.p.v. hemelsbreed, filters in de URL,
grote duimvriendelijke knoppen, een helder beslispaneel op de plekpagina, bruikbare lege staten, gratis en zonder
advertenties (juist de zwakke plek van park4night en Campercontact). Codebasis: TypeScript strict zonder `any`, nette
store, RLS op alle tabellen, geen geheimen in de repo, `npm run check` en de offline build zijn groen (154 pagina's).

**De vijf grootste problemen:**

1. **De kernbelofte haalt de data niet.** Maar 19 van de 680 plekken (2,8%) staan als "zonder vaste vertrektijd"
   (PRD-doel 150), 55% heeft een onbekende vertrektijd, 59% zijn campings en er zijn 0 camperparkeerplaatsen. De
   prijs met toeslagen, die de startpagina belooft, ontbreekt in de data.
2. **Vertrouwen lekt weg.** "100% van de gegevens bekend" staat naast vier keer "Onbekend". Er is één pipeline-datum
   als "laatste update", er zijn 0 reviews, en in de juridische pagina's staan plaatshouders. De
   toegankelijkheidsverklaring belooft dingen die de code niet waarmaakt.
3. **Zoeken en kaart werken tegen de gebruiker.** "Giethorn" kiest Giethmen. Een onbekende plaats toont het hele
   land. Vertrektijd is niet zichtbaar op de kaart en de markers zijn 12–18 px. Op mobiel staat maar één resultaat
   boven de vouw, en wie teruggaat naar de lijst verliest zijn plek.
4. **Er is geen vangnet.** Geen CI, geen tests en geen Dependabot: elke push naar `main` gaat direct live. De repo
   en de live database lopen ver uiteen.
5. **Beveiliging en privacy:** een aantal punten met ernst Hoog in database-rechten, uploads en beheertoegang. Er is
   niets kritieks dat nu direct uit te buiten is, maar deze punten gaan vóór alle features.

---

## 1b. Kernbelofte: alle plekken zonder vertrektijd, 100% zeker (hoogste prioriteit, besluit 16 oktober 2026)

De pagina **Zonder vertrektijd** is het hart van VrijStaan. Een plek staat daar alleen als het zeker is. De andere
plekken blijven op de site, met Uitslapers en Overige.

**Besluiten van de eigenaar:**
- Een plek komt op de kernpagina pas na **bevestiging door een mens**: beheer heeft de bron gecontroleerd, of de
  eigenaar heeft het bevestigd (mail of telefoon). Een automatische treffer op de website is alleen een kandidaat.
- "In principe geen vertrektijd, bij drukte vóór 13:00" komt **niet** op de kernpagina, maar bij Overige, met de tekst
  "Meestal geen vaste vertrektijd".
- "Je betaalt per 24 uur vanaf aankomst" telt **wel** mee, met het eigen label "Per 24 uur, geen vaste tijd".
- Een bevestiging is een jaar geldig. Ze vervalt meteen als de vertrekregel of de bronzin op de website verandert.

**Uitgangssituatie (live, 16 oktober 2026):** 1.536 gepubliceerde plekken. Daarvan hebben 21 volgens hun website geen
vaste vertrektijd en 769 een onbekende vertrektijd. Er zijn ±2.000 concepten, onder andere 148 camperplaatsen en 15
parkeerplaatsen zonder vertrektijd. Van de 21 zijn er minstens 3 niet eenduidig (tegenstrijdige tijd, "in principe",
afgekapte zin) en staat er één dubbel in.

| # | Taak | Status | Omvang |
|---|---|---|---|
| K1 | **Bevestiging in de database:** kolommen `departure_check`, `departure_checked_at` en `departure_checked_by`, de RPC `check_departure` (alleen beheer), automatisch vervallen bij een wijziging (trigger) en na een jaar (nachtelijke job), en de snapshot met vertrekgegevens (`web/supabase/migrations/20261015120000_vertrektijd_bevestiging.sql`) | Gebouwd, nog niet op live gezet | S |
| K2 | **Site:** de kernpagina toont alleen bevestigde plekken. Kandidaten staan bij Overige als "Vertrektijd nog niet bevestigd", met uitleg op de plekpagina. Een bevestigde plek toont "Gecontroleerd op <datum>" | Gebouwd | S |
| K3 | **Beheer → Vertrektijden:** een controlelijst met de bronzin, een link naar de bron, telefoon en mail, en de knoppen Bevestigd, Eigenaar bevestigde het, Met voorwaarde, Klopt niet en Opnieuw controleren | Gebouwd | S |
| K4 | **Eerste controleronde:** de 21 kandidaten nalopen (minstens Halfweg, Vlisterhoeve, Gideonse en de dubbele Duurswoldje). Hiervoor moet een beheeraccount actief zijn: live is er nog 0 beheerder en 1 openstaande uitnodiging | Open | S |
| K5 | **Alle kandidaten vinden:** alle concepten en plekken met een onbekende vertrektijd opnieuw scrapen met de huisregel- en FAQ-pagina's; gericht ophalen uit OSM (`motorhome=designated`, `amenity=parking` met camperbord, gemeentelijke camperplaatsen); camperplaatsen met een automaat herkennen ("per 24 uur") | Open | M |
| K6 | **Eigenaar laten bevestigen:** een mailtje of telefoonronde met één vraag ("Hoe laat moeten gasten weg?"), en een eenmalige link waarmee de eigenaar "geen vaste vertrektijd" zelf bevestigt (wordt `departure_checked_by = eigenaar`). Ook de antwoorden via Doe mee en Plek aanmelden belanden in de controlelijst | Open | M |
| K7 | **Strengere herkenning:** een treffer met tegelijk een vaste vertrektijd op dezelfde site (zoals Halfweg) of met woorden als "in principe" en "bij drukte" automatisch als "met voorwaarde" voorstellen; dubbele plekken samenvoegen | Open | S |
| K8 | **Meten:** het aantal bevestigde plekken op de kernpagina per provincie in Beheer → Overzicht, met het doel van 150 uit de PRD | Open | S |

---

## 2. Fase 0: beveiliging en privacy (direct, ±1 week)

De volledige security-audit (ernst, bestand:regel, faalscenario, fix) is bewust **niet** in deze publieke repo
gezet, omdat hij live zwakke plekken beschrijft. Hij staat bij de eigenaar. Deze lijst noemt alleen de taken.

| # | Taak | Omvang |
|---|---|---|
| 0.1 | Kolomrechten aanscherpen zodat persoonsgegevens bij reviews (e-mail, interne notities) nooit publiek leesbaar zijn | S |
| 0.2 | Uploads van bezoekers pas publiek na moderatie (privé-bucket + server-side kopie na goedkeuring), met quotum en EXIF-strip op de server | M |
| 0.3 | Database als migraties: `supabase db pull` als baseline, `schema.sql` vervangen door `supabase/migrations/`, standaard `REVOKE`'s voor `anon`/`authenticated`, alle live-only objecten (accounts, gedeelde reizen, foto's, push) in de repo | M |
| 0.4 | Beheer: MFA verplicht, open aanmelding dicht, leaked-password-check aan, rollen `admin` en `support` echt scheiden (open punt 1 in `docs/specs/README.md`) | M |
| 0.5 | Security-headers in `next.config.ts`: CSP (eerst Report-Only), HSTS, COOP, frame-ancestors, met een test | S |
| 0.6 | Misbruik beperken: rate limits per bron i.p.v. globaal, Cloudflare Turnstile op formulieren, `/api/route` en `/api/distances` begrenzen (rate limit, invoerlimiet, cachesleutels normaliseren) | M |
| 0.7 | Edge functions: sleutel als env-secret, vergelijking in constante tijd, generieke foutantwoorden; scraper blokkeert private IP-adressen en redirects daarheen, robots.txt vóór het ophalen | M |
| 0.8 | `maplibre-gl` upgraden naar 6.14+ (kritiek npm-advies) met een kaarttest | S |
| 0.9 | Bewaartermijnen echt aanzetten (`retention.sql` als `pg_cron`, inclusief tickets), events pas na toestemming, `probe`-tabellen weg | S |
| 0.10 | Kleine punten: service worker cachet geen `/support/*`, tokens niet in logs, tokens laten verlopen, `place.website` alleen `http(s)`, `permissions:` in de workflow | S |

---

## 3. Fase 1: snelle winst (samen ≤ 2 dagen)

Weinig risico en direct zichtbaar. Dit komt uit de UI/UX- en gebruikersreview.

1. `CookieBanner` en `SaveToast` alleen in `(site)/layout.tsx`, niet in het beheer. Banner compact onderaan op mobiel.
2. `aria-live` alleen op de telregel, niet op de hele lijst (`zoeken/search-app.tsx:175`).
3. Randcontrast ≥ 3:1: nieuwe token `--field-border` voor velden en secundaire knoppen (`globals.css:14,44`).
4. "100% van de gegevens bekend" vervangen door een eerlijke telling ("7 van 12 bekend; onbekend: vertrektijd, …")
   (`plek/[slug]/page.tsx:373`).
5. Rij "Maximaal verblijf" en de filterknop "Camperparkeerplaats" verbergen zolang ze leeg zijn.
6. Hartje overal `text-ember`, locatiestip in `--lake`, donkere kaartkleuren uit de tokens.
7. `theme_color` in het manifest gelijk aan de viewport.
8. Kaartfout met knoppen "Toon lijst" en "Opnieuw" (belofte uit de app-flow).
9. Teksten volgens `vrijstaan-stijl`: "Bedankt" zonder uitroepteken, overal "Laatste update", vaste namen voor
   Uitslapers/Overige, de cookie-FAQ laten aansluiten bij de banner.
10. Geen "0 m hemelsbreed" bij de plek die het zoekmiddelpunt is. "+" voor Plek aanmelden in de mobiele header.
11. Bedrijfsgegevens invullen in `web/src/lib/company.ts` (open punt 7).
12. Toegankelijkheidsverklaring tijdelijk laten kloppen met de werkelijkheid (WCAG 2.1 AA als doel, bekende
    afwijkingen benoemen) tot fase 2 klaar is.

---

## 4. Fase 2: must have (±3–4 weken)

### 4a. Vangnet: code strak houden (eerst doen, de rest bouwt erop)

| # | Taak | Omvang |
|---|---|---|
| E1 | **CI** (`.github/workflows/ci.yml`, gebouwd: lint, typecheck, offline build en een informatieve audit) op elke PR: `npm ci` → lint → typecheck → Vitest → `VRIJSTAAN_OFFLINE=1 npm run build` → `npm audit --omit=dev --audit-level=high`. Actions op commit-SHA, `permissions: contents: read` | S |
| E2 | **Database-job:** `supabase db reset` op de migraties, advisors (falen bij nieuwe WARN), pgTAP-tests op RLS en grants per rol | M |
| E3 | **Unit-tests** (Vitest) voor `lib/search.ts`, `lib/format.ts`, `lib/geo.ts`, `lib/routing.ts`, `places.ts normalize()`, de reiskosten, en golden tests voor de extractor ("niets verzinnen" als assert) | M |
| E4 | **E2E** (Playwright, iPhone-viewport, licht en donker) voor zes kernflows: zoeken → filter → plek; bewaren → reis → offline; Dichtbij met nep-locatie; contact → supportticket; cookie weigeren = geen event; niet-admin krijgt geen beheer. Met `@axe-core/playwright` en een Lighthouse-budget (LCP < 2,5 s, CLS < 0,1) | M |
| E5 | **Acceptatieomgeving (besluit 16 oktober 2026):** branch `acceptatie` naast `main`. Werkwijze: feature-branch → PR naar `acceptatie` → testen op de vaste Vercel-preview van `acceptatie` → PR van `acceptatie` naar `main`. De preview leest de live database; schemawijzigingen gaan als migratie in `web/supabase/migrations/` mee in de PR en worden pas na akkoord op live gezet. Branch protection op `main` (alleen via PR, CI groen). Dependabot voor `npm` en `github-actions`. Status: branch en CI gebouwd, protection en Vercel nog instellen | S |
| E6 | **Pre-commit:** lefthook of husky + lint-staged (eslint, prettier, tsc) en gitleaks | S |
| E7 | **Monitoring zonder tracking van derden:** `instrumentation.ts` `onRequestError` → `app_logs` (of GlitchTip/Sentry EU zonder PII), een uptime-check en een versheid-endpoint (`max(verified_at)`, alarm na 24 uur), en een wekelijkse advisor-run | M |

### 4b. Code-opschoning

| # | Taak | Omvang |
|---|---|---|
| C1 | **Gedeelde UI-componenten** `Button`, `Field`, `Chip`, `ToggleTile`, `Card` voor site én beheer, plus radius- en schaduwtokens. `border-2 border-line` staat 45× los in de code en er zijn 7 secundaire knopvarianten; `shadow-lift` gaat weg | M |
| C2 | **Grote bestanden opknippen:** `plek/[slug]/client.tsx` (503 regels, 7 exports), `plek/[slug]/page.tsx`, `mijn-reis/trip-app.tsx`, `zoeken/search-app.tsx`, `admin/plekken` | M |
| C3 | **Duplicatie weg:** één formulier-hook voor de vijf formulieren, één robots.txt-parser, één sleutelcheck voor de edge functions | S |
| C4 | **Data-laag:** `withFallback` mag niet stil op de snapshot terugvallen in productie (loggen + melding), gegenereerde Supabase-types i.p.v. de `toCamel`-heuristiek, cache-tags echt invalideren bij verbergen of wijzigen van een plek | M |
| C5 | **Lichtere suggestie-index** op de startpagina i.p.v. de volledige dataset (nu 369 KB, ±870 KB bij 1.509 plekken), met debounce | S |

### 4c. Product: zoeken, kaart, vertrouwen

| # | Feature | Bron | Omvang |
|---|---|---|---|
| P1 | **Zoeken repareren:** spellingsafstand vóór het aantal plekken (`components/destination-search.tsx`); onbekende plaats of eiland geeft "niet gevonden" met suggesties (open punt 9) | UX, gebruiker | S |
| P2 | **Vertrektijd op de kaart:** markerkleur per vertrekgroep, pop-up met `DepartureChip`, prijs en hartje (`components/place-map.tsx:53-80,188-199`) | UX | S |
| P3 | **Grotere pins / prijspins** (≥ 44 px tikdoel) en de gekozen plek als mini-sheet onderaan (foto, vertrek, prijs, Bewaren, Route) | UX, Airbnb/Booking | M |
| P4 | **Compacte mobiele zoekkop** die bij scrollen inklapt tot "Waar · n filters · Kaart"; tabbladen passen op 390 px | UX | M |
| P5 | **Zoekstaat behouden:** `kaart`, "toon meer" en de Dichtbij-filters in de URL plus scroll-restore; terugknop zonder `history.length`-gok | UX | S |
| P6 | **Laadstaten:** `loading.tsx` voor `/plek/[slug]`, `/camperplaatsen/*` en home, `params` binnen `<Suspense>`, skelet voor Mijn reis | UX | S |
| P7 | **Prijs zoals camperaars rekenen:** `priceExtras` echt in de dataset, standaardprijs "camper + 2 personen" (of duidelijk "per persoon"), sanity-check op uitschieters, en Mijn reis telt personen, hond en stroom mee | gebruiker | M |
| P8 | **Eerlijke actualiteit:** bron en datum per kernfeit (vertrektijd, prijs) i.p.v. één pipeline-datum | gebruiker | S |
| P9 | **Lengtefilter betrouwbaar:** verdachte waarden ≤ 6 m bij campings markeren, eerlijk chiplabel ("lengte bij 14% bekend"), optie "alleen plekken waarvan bekend is dat ik pas" | gebruiker | S |
| P10 | **Aankomen 's avonds:** aankomst-, slagboom- en receptietijden en "24 uur toegankelijk / zelf inchecken" in data, plekpagina en als chip in Dichtbij | gebruiker, forum | M |
| P11 | **Navigatiekeuze:** Apple Maps, Google Maps, Waze, `geo:` en coördinaten kopiëren; geen stille afkapping bij 9 tussenstops | UX, gebruiker | S |
| P12 | **Offline-basis:** `/offline`-pagina i.p.v. stille terugval naar Mijn reis, geen `ignoreSearch` op zoekresultaten, bewaarde en bekeken plekken (incl. RSC-payload) automatisch in de cache, kaartcache met vervaltijd, melding "nieuwe versie" | UX, gebruiker | M |
| P13 | **WCAG 2.1 AA afronden:** geen `text-xs` meer voor inhoud, tabbalk en chips ≥ 44 px, kopvolgorde, foutmeldingen per veld met `aria-describedby`; daarna de verklaring weer bijwerken | UX | M |

### 4d. Data: de kernbelofte waarmaken (loopt parallel aan 4c)

| # | Taak | Omvang |
|---|---|---|
| D1 | **Meer "vrij staan"-plekken:** OSM `amenity=parking + motorhome=designated` en gemeentelijke camperplaatsen gericht ophalen, "per 24 uur"-plekken herkennen; doel: 150 plekken zonder vertrektijd en de categorie camperparkeerplaats gevuld | L |
| D2 | **Vertrektijd-campagne:** Doe mee gericht inzetten op de 372 plekken met een onbekende vertrektijd (met regio- en voortgangsdoel) | M |
| D3 | **Snapshot en live gelijktrekken** (680 ↔ 1.509 plekken) en de 44 plekken onder de publicatieregel nakijken | S |

---

## 5. Fase 3: should have (eerste maanden na livegang)

| # | Feature | Waarom | Omvang |
|---|---|---|---|
| S1 | **Bewaren los van de reis:** meerdere lijsten met notities ("Zeeland voorjaar", "Ooit") en een of meer reizen met naam | Het hartje maakt nu van 15 kandidaten een reis van 15 stops; park4night+-mappen, Airbnb-verlanglijsten | M |
| S2 | **Reis met datums:** aankomst per stop, waarschuwing "op 3 november gesloten", dagafstanden en etappes | Persona "vooruitplanner"; Komoot | M |
| S3 | **Reviews op gang brengen:** na bewaren of bezoek "Ben je er geweest?", feedback met één tik ("vertrektijd klopt", "er was plek / vol"), review met foto (na 0.2) | 0 reviews, doel 200; de reden dat mensen park4night gebruiken | L |
| S4 | **Zoek in dit kaartgebied** (knop na pannen) | Airbnb, Booking, park4night | M |
| S5 | **Offline regio downloaden** (kaarttegels en data per provincie, met opslagindicator), gratis | Belangrijkste betaalde feature bij park4night+, Campercontact PRO en Searchforsites: een sterk verkoopargument | L |
| S6 | **Camperprofiel en routeprofiel:** lengte, hoogte, gewicht > 3,5 t in de reisinstellingen; ORS `driving-hgv` voor rijtijden; filters op hoogte en gewicht | Rijtijd voor een grote camper klopt nu niet; `docs/onderzoek.md` | M |
| S7 | **Camperfilters uitbreiden:** ondergrond/verhard/vlak, reserveren, 24 uur toegankelijk, aantal plekken, stroom (ampère, prijs), grijs water en cassette apart, hond, kindvriendelijk | Campercontact 70+ filters; de velden bestaan deels al | S–M |
| S8 | **Eén Dichtbij:** de zoekveld-optie gaat naar `/dichtbij`, met dezelfde `FilterSheet` en "Overige" | Twee routes die verschillend rekenen (IA-overlap) | S |
| S9 | **Eigenaarsportaal light:** magische link per plek voor tarieven, toeslagen, vertrektijd, foto's en "tijdelijk vol/gesloten"; eigenaarsmelding krijgt een ticket- of statuslink | Meest betrouwbare databron; lost ook het fotorechtenvraagstuk op | M |
| S10 | **Plek aanmelden met kaartpin** en "gebruik mijn locatie" | park4night, iOverlander; nu geen coördinaten in het formulier | M |
| S11 | **Offline wachtrij** voor Fout melden, Doe mee en reviews | Melden gebeurt ter plekke, vaak zonder bereik | M |
| S12 | **"Mijn berichten"**: supportlinks lokaal bewaren, plus een mail met de link zodra er SMTP is | Nu is het ticket weg als je de pagina sluit | S |
| S13 | **Ongedaan maken** bij stop verwijderen en ontbewaren (toast van 6 s) | Fouttolerantie voor 55+ | S |
| S14 | **Installatie-uitnodiging** in de UI (iOS-uitleg met plaatje, Android-prompt); manifest met `screenshots`, `share_target`, zonder vaste portretstand | Nu alleen een FAQ-antwoord | S |
| S15 | **Deelscores** "Ondergrond/vlak" en "Sanitair" | Stellplatz.info | S |

---

## 6. Fase 4: nice to have

| # | Feature | Omvang |
|---|---|---|
| N1 | Duits en Engels (eerst vaste labels en de kernregels, later hele pagina's); PRD fase C | L |
| N2 | Drukte-indicatie ("vaak vol in juli") en een bezoekersmelding "nu vol" die na 24 uur vervalt | M |
| N3 | Plekken langs je route (corridor-zoeken tussen A en B) in Mijn reis | M |
| N4 | POI-lagen: losplaatsen/servicezuilen apart, LPG, wasserette, supermarkt | M |
| N5 | Luchtfotolaag (PDOK, gratis) om te zien of een plek vlak is en bomen heeft | S |
| N6 | Web push: "plek in je reis is gewijzigd of gesloten" | M |
| N7 | 2–3 plekken naast elkaar vergelijken | M |
| N8 | Eigenaarsantwoord op reviews (na S9) | M |
| N9 | Thema- en collectiepagina's ("Aan het water", "Bij een boerderij") voor SEO en inspiratie | S |
| N10 | "Uitslapers" herzien: 12:00 is standaard bij campings; liever "vertrek 13:00 of later" of een tijdslider | S |

---

## 7. Volgorde en mijlpalen

```
Nu          Kernbelofte K1–K4 (bevestigen) en acceptatie (E5), daarna K5–K8 doorlopend
Week 1      Fase 0 (security/privacy)  +  Fase 1 (snelle winst)
Week 2      E1–E6 vangnet  +  P1, P2, P5, P6, P11 (kleine productfixes)
Week 3–4    C1 componenten → P3, P4, P13  ·  P7–P10 prijs/vertrouwen  ·  D3
Week 4–5    P12 offline-basis  ·  C2–C5 opschoning  ·  E7 monitoring
Doorlopend  D1, D2 data (de kernbelofte is uiteindelijk een datavraag)
Daarna      Fase 3 in volgorde S1 → S3 → S6 → S5 → S9, dan de rest
```

**Hoe meten we of het werkt** (sluit aan op de PRD):
- het aantal plekken zonder vaste vertrektijd (doel 150) en het aandeel met een bekende vertrektijd;
- het aantal reviews (doel 200);
- een Lighthouse-budget in CI en 0 axe-fouten op de zes kernflows;
- 0 nieuwe WARN in de Supabase-advisors;
- terugkeer naar de lijst behoudt de positie (e2e).

## 8. Werkafspraken

- Elke taak volgt `CLAUDE.md`: specs lezen, documenten bijwerken in dezelfde commit, `npm run check` en de offline
  build vóór de push.
- Taken uit dit plan worden opgenomen in `docs/specs/06-implementatieplan.md` met status. Nieuwe tegenstrijdigheden
  komen in `docs/specs/README.md` (nieuw: punt 12 over de toegankelijkheidsverklaring en punt 13 over de beloofde
  prijs met toeslagen).
- Tekst of uiterlijk aanpassen gaat via de skills `vrijstaan-stijl` en `frontend-design`.
