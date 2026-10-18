# VrijStaan: technische UI/UX-review

> Datum: 15 oktober 2026. Scope: `web/src/app/(site)/**`, `web/src/app/admin/**`, `web/src/components/**`, layouts,
> `manifest.ts`, `public/sw.js`, getoetst aan `docs/specs/01..06`, `docs/design.md`, `.claude/skills/vrijstaan-stijl`.
> Methode: code gelezen, plus de app lokaal bekeken met Playwright (Chromium, 390 × 844, licht en donker; dataset uit
> de offline snapshot met 680 plekken). Screenshots staan in
> een lokale map tijdens de review (niet in de repo).
> In de sandbox laadde de kaart niet (OpenFreeMap was niet bereikbaar). Kaartbevindingen komen dus uit de code.
> Er is niets in de repo gewijzigd.

Prioriteit: **P1** = raakt de hoofdroute, toegankelijkheid (AA) of vertrouwen; **P2** = merkbare frictie of
inconsistentie; **P3** = afwerking.

---

## 0. Samenvatting: de 10 belangrijkste bevindingen

| # | Prio | Bevinding | Waar |
|---|---|---|---|
| 1 | P1 | **Het kernfeit (vertrektijd) staat niet op de kaart.** Markers kleuren alleen op gratis of betaald. De pop-up toont naam, plaats en prijs, zonder vertrekregel en zonder hartje. Markers zijn 12 tot 18 px groot. | `components/place-map.tsx:188-199, 53-80` |
| 2 | P1 | **Op mobiel staat er bijna alleen chrome boven de vouw.** Op `/zonder-vertrektijd` begint het eerste resultaat pas rond 500 px: header, tabbladen, intro, zoekbalk, filters, titel en legenda gaan voor. Bij een scherm van 844 px is één kaart zichtbaar, en de knop "Toon kaart" ligt over de prijs. | `zoeken/search-app.tsx:109-187, 209-221` (screenshot `zonder-dark.png`) |
| 3 | P1 | **De hele resultatenlijst is een `aria-live`-gebied.** Elke filterwijziging leest 20 kaarten voor aan een schermlezer. | `zoeken/search-app.tsx:175` |
| 4 | P1 | **Rand-contrast faalt (WCAG 1.4.11).** Alle invoervelden, filterknoppen en secundaire knoppen hebben alleen `border-line` als begrenzing: 1,26:1 op paper en 1,4:1 op surface (licht), 1,34:1 (donker). Het minimum is 3:1. | `globals.css:14,44`; o.a. `contact-form.tsx:19`, `filter-sheet.tsx:28`, `admin/ui.tsx:80-86` |
| 5 | P1 | **Ontwerpsysteem bestaat alleen als tokens, niet als componenten.** Knoppen, velden en chips worden per bestand met losse class-strings gebouwd: `field`/`input` staat 5× gedupliceerd, er zijn 3 verschillende filter-chipstijlen, `border-2 border-line` komt 45× voor. Het beheer heeft wél een eigen mini-kit (`admin/ui.tsx`), de site niet. Daardoor groeien site en beheer uit elkaar. | zie §1 |
| 6 | P1 | **Terug naar de lijst verliest je plek.** "Toon meer plekken" (`limit`) en de kaart/lijst-stand staan niet in de URL. Vanaf een plekpagina terug geeft opnieuw 20 resultaten. `kaart=1` wordt alleen gelezen, niet geschreven. Op Dichtbij gaan alle filters verloren. | `search-app.tsx:72, 326`; `nearby-app.tsx:27-30` |
| 7 | P1 | **Onbekende plaats geeft het hele land** ("680 plekken in xyzqqq"). Dit is bekend, maar het staat nog open en raakt vertrouwen meteen. | `search-app.tsx:92, 181` (screenshot `onbekend-light.png`) |
| 8 | P2 | **Plekpagina zonder laadstaat.** Er is nergens een `loading.tsx`, en `params` wordt buiten `<Suspense>` ge-await. De dev-server meldt dat de navigatie daardoor niet direct kan zijn. Na een tik op een kaart gebeurt dus zichtbaar niets tot de server klaar is. | `plek/[slug]/page.tsx:80`; dev-log |
| 9 | P2 | **Twee "dichtbij"-routes met ander gedrag.** "Dichtbij mijn locatie" in het zoekveld gaat naar `/zoeken` (hemelsbreed, filters in de URL). Het tabblad Dichtbij gebruikt rijtijd, eigen chips en geen URL. Dat is overlap zonder duidelijke reden. | `destination-search.tsx:70,146-167` vs `dichtbij/nearby-app.tsx` |
| 10 | P2 | **De toegankelijkheidsverklaring belooft meer dan de code waarmaakt.** Ze noemt WCAG 2.2 AA (de brief zegt 2.1), "minstens 17 px" (er staat `text-xs` = 12 px op 8 plekken) en "minstens 44 × 44" (chips zijn 36 px, kaartmarkers ~12 px). | `toegankelijkheid/page.tsx:12-14` |

---

## 1. Stijlverschillen en inconsistenties

### 1.1 Hardcoded waarden in plaats van tokens

| Bestand:regel | Wat | Voorstel |
|---|---|---|
| `app/(site)/page.tsx:13` | `SCRIM` met `#14281d` | Token `--scrim-photo` (vast donker, in beide thema's) |
| `app/(site)/page.tsx:81, 84, 161, 162` | `text-[#fffcf6]`, `text-[#efe9dc]`, `[text-shadow:…rgb(10_24_16/0.45)]` | Tokens `--on-photo`, `--on-photo-2` |
| `app/(site)/page.tsx:81` | `text-[2.4rem]`, `lg:text-[4rem]` | Display-schaal in `@theme` (`--text-display`) |
| `app/(site)/page.tsx:106`, `home-search.tsx:36` | `text-[15px]` | `text-base` of `text-sm` (15 px valt buiten de schaal) |
| `components/chrome.tsx:137` | Tabbalklabels `text-[13px]` | Minstens 14 px (vrijstaan-stijl: "tekst minstens 14 px") |
| `components/destination-search.tsx:269` | `text-[17px]` | Dit is `text-base`; gebruik de token |
| `components/destination-search.tsx:235`, `home-search.tsx:27` | `shadow-[inset_0_1px_3px_rgb(0_0_0/0.06)]` | Token `--elev-inset` (zwart past niet bij de warm getinte schaduwen) |
| `components/destination-search.tsx:292` | Knopschaduw `0_8px_20px_-8px_var(--ember)` | Token `--elev-cta` |
| `components/home-search.tsx:44` | `shadow-[0_2px_6px_-2px_rgb(20_40_28/0.5)]` | `shadow-low` |
| `components/place-map.tsx:39-40` | Kaarttint (`#141b16`, `#cfe3e4`, …) | Uit CSS-variabelen lezen (net als `surface`/`ink` op r.127) |
| `components/place-map.tsx:124-126` | `ember`/`forest` donker: `#d9783f`/`#3f7a5a`. **Wijkt af van de tokens** `#e8915c`/`#8dbf9f` | Uit `getComputedStyle` lezen; afwijkingen alleen als `--map-*`-token |
| `components/place-map.tsx:186` | Clustertekst `#ffffff` | `--on-forest` |
| `components/place-map.tsx:317` | Locatiestip `#1a73e8`, Google-blauw, valt buiten het palet | `--lake` met `--surface`-rand |
| `globals.css:296` | Donkere attributie `rgb(21 34 56 / 0.8)`, blauwig. Dit is een restant van een ouder thema | `color-mix(in srgb, var(--surface) 85%, transparent)` |
| `components/icons.tsx:84-89` | Logo met vaste hexwaarden | Mag (merk), maar `var(--forest)` enz. voorkomt dat het logo in het donker "valt" |
| `app/global-error.tsx:6,12` | Inline hex, `#fff` | Begrijpelijk, want CSS is daar niet geladen. Gebruik wel `#fffcf6` (on-forest) i.p.v. `#fff` |
| `app/layout.tsx:25-26` vs `manifest.ts:84` | `themeColor` surface (`#fffcf6`), maar manifest `theme_color` forest (`#2d5a43`) | Eén keuze. Bij een geïnstalleerde PWA geeft dit nu een groene statusbalk tijdens het starten en daarna een crèmekleurige |

### 1.2 Afronding (radii)

De skill vraagt "grote vlakken 24–28 px, kaarten 16–20 px, knoppen 12 px, chips rond". De code gebruikt
`rounded-[1.25rem]` (6×), `rounded-[1.5rem]` (1×) en `rounded-[1.75rem]` (4×) naast `rounded-2xl`/`rounded-3xl`. Er
zijn geen radius-tokens.

- Resultaatkaart `rounded-[1.25rem]` (`place-ui.tsx:231`), maar het skelet ervan `rounded-2xl` (`place-ui.tsx:283`).
  Hoogte en vorm springen bij het laden (draagt bij aan CLS, zie M5).
- **Chips zijn niet rond**: vertrekbadge `rounded-md` (`place-ui.tsx:307`), badge "Gratis" `rounded-md` (`place-ui.tsx:244`),
  Dichtbij-chips `rounded-xl` (`nearby-app.tsx:151,168,183`), terwijl actieve filterchips wél `rounded-full` zijn
  (`search-app.tsx:158`) en de "Overige"-subkeuze ook (`search-app.tsx:304`).
- Voorstel: in `@theme` `--radius-surface: 1.75rem; --radius-card: 1.25rem; --radius-control: .75rem` en die overal gebruiken.

### 1.3 Diepte: randen versus schaduw

De skill zegt "diepte met schaduw in lagen, niet met randen om alles heen". In de praktijk:

- **`shadow-lift` (de oude token) wordt nog 10× gebruikt** naast `shadow-low/raised/float`: `chrome.tsx:208`,
  `cookie-banner.tsx:57`, `destination-search.tsx:188`, `place-ui.tsx:160`, `search-app.tsx:216`, `not-found.tsx:8`,
  `nearby-app.tsx:104`, `trip-app.tsx:148`, `plek/[slug]/client.tsx:83,88`. Ook de MapLibre-pop-up en -knoppen
  (`globals.css:261,282`). Kies één systeem en verwijder `--lift`.
- **Randen als vlakbegrenzing**: `outline-1 outline-line` in de FAQ (`faq-list.tsx:26`), het vertrekblok
  (`plek/[slug]/page.tsx:406`), supportberichten (`ticket-view.tsx:91`), privacy en cookies (`privacy/page.tsx:74,87`,
  `cookies/page.tsx:28,41`) en vrijwel elke beheerkaart (`admin/ui.tsx:41`, `admin/page.tsx:176`, `support/page.tsx:169,207`, …).
  Elders is hetzelfde soort vlak `shadow-low` (Praktisch, Voorzieningen, reviews).
- Header, tabbalk, sticky zoekbalk, sheet-kop en -voet en footer hebben allemaal `border-line`. Dat kan voor
  scheidingslijnen, maar de cookiebanner heeft rand én schaduw (`cookie-banner.tsx:57`), net als de suggestielijst
  (`destination-search.tsx:188`).

### 1.4 Knoppen: zeven varianten van "secundair"

| Variant | Voorbeeld |
|---|---|
| Rand 2 px `border-line`, hover rand forest | `search-app.tsx:116, 341`, `trip-app.tsx:204, 218`, `client.tsx:166, 234, 497` |
| Rand 2 px, actief `bg-forest-tint` | `filter-sheet.tsx:28`, `nearby-app.tsx:151` |
| Rand 2 px, actief **vol forest** | `admin/ui.tsx:107` (Segmented), `client.tsx:256` (ScorePicker) |
| Rand 2 px forest + tint (cookie) | `cookie-banner.tsx:100,103` |
| Rand 1 px | `chrome.tsx:88` ("Plek aanmelden" in de header) |
| Onderstreepte tekstlink als knop | `filter-sheet.tsx:112`, `trip-app.tsx:137, 237, 444`, `client.tsx:418` |
| Rond, wit met schaduw (hartje) | `place-ui.tsx:160`, en in de actiebalk naast vierkante knoppen met rand (`plek/[slug]/page.tsx:311-321`) |

Hoogtes wisselen tussen `h-9` (36), `h-10`, `h-11`, `h-12` en `h-14`, ook voor dezelfde rol. Primaire knoppen zijn soms
in Fraunces (`filter-sheet.tsx:123`, `client.tsx:370`, `contact-form.tsx:97`, `nearby-app.tsx:115`) en soms in Inter
(`plek/[slug]/page.tsx:322`, `trip-app.tsx:408`). Het beheer gebruikt `h-11` voor primair (`admin/ui.tsx:83`), de site `h-12`.

**Voorstel:** een `Button`-component met `variant: primary | accent | secondary | quiet | danger` en
`size: md (48) | lg (56)`, plus `Field`, `Chip` en `ToggleTile`. Gebruik die in site én beheer. Het aantal varianten
daalt dan van ~15 naar 5.

### 1.5 Iconen

- Er zijn twee systemen: `Icon` (24 px stroke, `icons.tsx`) en `Sign` (32 px in een afgerond vlak, `sign.tsx`), met
  **dubbele glyphs** (clock, calendar). Dat klopt met de brief, maar er is geen regel wanneer welk systeem geldt.
  In de chips van Dichtbij staan `Sign`-tegels in een omrande knop. In de header staan `Icon`s.
- Bewaard-hartje: **rood (`text-alert`)** in kaart en plekpagina (`place-ui.tsx:150,162`), maar **avondzon** in de
  toast (`chrome.tsx:212`) en de teller (`chrome.tsx:52`). `alert` is volgens de brief voor fouten en "niet aanwezig".
  Gebruik ember.
- Beheer FAQ verwijderen met het teken "✕" in plaats van `Icon name="x"` (`admin/faq/page.tsx:85`).
- `inbox`, `chart` en `log` worden alleen in het beheer gebruikt. Dat is prima.

### 1.6 Typografie

- `text-xs` (12 px) op de site: fotobijschrift (`place-ui.tsx:97`, `client.tsx:69`), aantal reviews
  (`place-ui.tsx:120`), stopnummer (`trip-app.tsx:290`), datum in support (`ticket-view.tsx:93`), cookie-tabel
  (`cookies/page.tsx:29,54`), tellerbadge (`chrome.tsx:52`). Dat strijdt met "tekst minstens 14 px".
- Koppen binnen hetzelfde niveau verschillen. Op de plekpagina: "Prijs en extra kosten" is `font-semibold` Inter
  (`page.tsx:440`), "Aankomen en vertrekken" Fraunces `text-lg` (`page.tsx:412`), "Hoe ver is het?" Fraunces `text-xl`
  (`client.tsx:139`) en sectiekoppen Fraunces `text-2xl`.
- **Kopvolgorde**: op de zoekpagina's komt de `h2` uit `DepartureTabs` ("Zonder vertrektijd", `search-app.tsx:286`)
  vóór de `h1` ("19 plekken in Nederland", `search-app.tsx:176`). Die `h2` staat bovendien binnen een `<nav>`.

### 1.7 Tekst en huisstijl (vrijstaan-stijl)

De copy is over het algemeen goed. Er staan geen verboden woorden, middenpunten of hoofdletterlabels in. Wel:

| Bestand:regel | Probleem |
|---|---|
| `plek/[slug]/client.tsx:310` | Titel "Bedankt!", met een uitroepteken |
| `components/filter-sheet.tsx:153` | "de website zegt letterlijk dat…" is bronuitleg bij een gegeven; dat mag niet meer (besluit eigenaar) |
| `components/prose.tsx:9`, `melden/page.tsx:37` | "Laatst bijgewerkt" terwijl de brief en de rest van de site "Laatste update" zeggen |
| Naamgeving vertrekgroepen | "Uitslapers" (tab, home-zoekkaart) / "Voor uitslapers" (home-kaart, footer, paginatitel); "Overige" / "Overige plekken"; "Alle" / "Alle plekken" (filtersheet) / "Alle camperplaatsen" (home, footer). De skill zegt dat dezelfde handeling overal hetzelfde heet |
| Fout melden | Knop "Klopt er iets niet? Meld het" → sheettitel "Gegevens aanpassen" → knop "Melding versturen" → titel "Bedankt voor je melding". De sheettitel past niet bij de rest |
| Reviews | Kop "Ervaringen van camperaars", knop "Schrijf een review", tekst "Nog geen reviews" |
| Bewaren | "Bewaar" / "Bewaard" (`place-ui.tsx:151`) tegenover de aria-label "Bewaren in mijn reis" en de toast "Bewaard in Mijn reis" (hoofdletter wisselt: "mijn reis" / "Mijn reis") |
| Pijlen | De skill verbiedt "Bekijk →". Chevron-iconen achter "Bekijk plekken" (`page.tsx:133`) en "Bekijk alle" (`page.tsx:190`) hebben hetzelfde effect |
| `trip-app.tsx:365` | Een gedachtestreepje "–" als lege waarde; schrijf "Onbekend" |
| `plek/[slug]/page.tsx:373` | "100% van de gegevens bekend" terwijl op dezelfde pagina Toeristenbelasting, Ondergrond en Maximaal verblijf "Onbekend" zijn (screenshot `plekpart1.png`). `completeness` meet kernvelden, maar de tekst belooft "alle gegevens" |

### 1.8 Site tegenover beheer

| Aspect | Site | Beheer |
|---|---|---|
| Kaartvlak | `shadow-low` | `outline-1 outline-line` (`admin/ui.tsx:41`) |
| Primaire knop | `h-12`, soms Fraunces | `h-11`, Inter |
| Segmentkeuze | Tint bij actief | Vol forest (`ui.tsx:107`), `h-10` |
| Bevestigen | Inline vlak (`trip-app.tsx:424`) | Browser-`confirm()` (`faq/page.tsx:28`, `reviews/page.tsx:37`, `instellingen/page.tsx:45`) |
| Chrome | Header en tabbalk uit `chrome.tsx` | Eigen header en zijbalk (`shell.tsx`); **cookiebanner en bewaartoast uit de root-layout verschijnen ook in het beheer** (`app/layout.tsx:40-41`), met `bottom-[76px]` terwijl daar geen tabbalk is |

Beheer is voor Patrick en mag zakelijker zijn, maar laat het dezelfde componenten gebruiken. Verplaats `CookieBanner`
en `SaveToast` naar `(site)/layout.tsx`.

---

## 2. Navigatie en informatiearchitectuur

### 2.1 Routekaart

```
/                      Start
├─ /zoeken             Alle      ┐ zelfde SearchApp, 4 tabbladen
├─ /zonder-vertrektijd           │ (filtersheet kiest óók de vertrekgroep → tweede besturing voor dezelfde keuze)
├─ /uitslapers                   │
├─ /overige-plekken (+ ruim/vroeg/onbekend)┘
├─ /camperplaatsen/[provincie]   SEO-ingang → linkt naar /zoeken?provincie
├─ /plek/[slug]
├─ /dichtbij           eigen app, eigen chips, geen URL-state
├─ /mijn-reis (?r=)
├─ /doe-mee  /plek-aanmelden  /melden  /contact → /support/[token]
├─ /veelgestelde-vragen
└─ juridisch: over-ons, privacy, cookies, voorwaarden, disclaimer, toegankelijkheid, reviews-en-ranking
```

### 2.2 Bevindingen

1. **Vertrekgroep op twee plaatsen (P2).** De tabbladen (`search-app.tsx:235-315`) en de sectie "Aankomen en
   vertrekken" in de filtersheet (`filter-sheet.tsx:143-155`) doen hetzelfde, maar de sheet laat het niet als
   paginawissel voelen. Haal de vertrekgroep uit de sheet, of toon daar alleen de subkeuze van Overige.
2. **Het vierde tabblad valt buiten beeld (P2).** Op 390 px is "Overige" niet zichtbaar en "Uitslapers" afgekapt
   (`zoeken-light.png`). Er is geen hint dat je kunt scrollen. Kortere labels ("Vrij vertrek", "Uitslapers",
   "Overig") of een segmented control in 2 × 2.
3. **Tabbladen scrollen weg en de zoekbalk blijft plakken (P2).** De sticky laag (`search-app.tsx:110`) is ~125 px hoog,
   bovenop de header van 64 px. Dat is samen een kwart van het scherm. Patroon van Booking en Airbnb: een compacte
   samenvattingsbalk ("Zeeland · 3 filters") die bij het scrollen inklapt.
4. **Twee "dichtbij"-ingangen (P2)**, zie top 10 #9. Laat "Dichtbij mijn locatie" in het zoekveld naar `/dichtbij`
   gaan, of laat `/dichtbij` filters in de URL zetten en dezelfde `FilterSheet` gebruiken.
5. **Kruimelpad (P2).** Op de plekpagina is het op mobiel verborgen (`plek/[slug]/page.tsx:111`, `hidden sm:flex`),
   en het linkt naar `/zoeken?provincie=` in plaats van de SEO-pagina `/camperplaatsen/[provincie]`. De provinciepagina
   heeft "Start › Provincie" (`camperplaatsen/[provincie]/page.tsx:39`). Geen consistent model. Voorstel op mobiel:
   een kleine terugregel "← Zeeland" onder de foto, die naar de provinciepagina gaat.
6. **Terugknop (P2).** `window.history.length > 1` (`chrome.tsx:227`) is ook waar als je via Google binnenkomt in een
   tab met eerdere geschiedenis. Dan gaat "Terug" de site uit. Gebruik een eigen sessie-vlag ("kwam ik van een interne
   pagina?") of `document.referrer`-origin. De terugknop staat alleen op `/plek/*`. Op `/support/[token]`,
   `/camperplaatsen/*` en de juridische pagina's zit je in de geïnstalleerde PWA (zonder browserknop) alleen met logo
   of tabbalk terug.
7. **Header verschilt van de app-flow (P3).** De app-flow zegt "Header: + naar Plek aanmelden, ? naar FAQ". Op mobiel
   staat alleen "?" (`chrome.tsx:93-99`). Op desktop staat "Plek aanmelden", maar FAQ ontbreekt en "Start" bestaat
   alleen via het logo.
8. **Twee `<nav aria-label="Hoofdmenu">`** (`chrome.tsx:73` en `:126`). Ze zijn nooit tegelijk zichtbaar, maar beter
   is één label "Hoofdmenu" en voor de tabbalk "Tabbalk".
9. **Footer (P3).** Op mobiel ~1.000 px hoog (`plekpart2.png`), met 21 links en 12 provincie-chips. Op de plekpagina
   staat daarboven ~250 px lege ruimte (`pb-24` van het artikel plus `mt-16` van de footer, `plek/[slug]/page.tsx:106`).
   Zet de juridische links in een inklapbaar blok.
10. **Doodlopende routes en terugwegen.**
    - `/contact`: na versturen alleen "Naar mijn bericht". Er gaat geen e-mail met de link (geen SMTP); wie de pagina
      sluit, is het ticket kwijt (`contact-form.tsx:69-81`). Voorstel: "Kopieer link" en "Stuur naar mijn mail"
      (zodra SMTP er is), en de link in `localStorage` bewaren onder "Mijn berichten".
    - `/plek-aanmelden`: de bevestiging heeft geen vervolgactie (`submit-form.tsx:66-72`).
    - `/support/[token]` "niet gevonden" heeft geen link naar Contact (`ticket-view.tsx:89-95`).
    - De reviewsheet "Bedankt!" heeft alleen "Sluiten".
11. **Lege, fout- en laadstaten.**
    - Zoeken: de lege staat met verruimingsvoorstellen is goed (`search-app.tsx:354-375`).
    - Onbekende plaats geeft het hele land (top 10 #7).
    - Kaart mislukt: "De kaart kon niet worden geladen. Controleer je verbinding." zonder knop "Toon lijst" of
      "Opnieuw" (`place-map.tsx:331-335`), terwijl de app-flow die knop belooft (`kaart-light.png`).
    - Plekpagina: geen `loading.tsx` en geen skelet (top 10 #8). Dat geldt voor alle server-routes: home,
      provincie, FAQ.
    - Mijn reis laden: kale tekst "Je reis laden…" (`trip-app.tsx:162`) en geen skelet (de bekende CLS 0,41).
    - Dichtbij: bij `!places` maar één skeletkaart (`nearby-app.tsx:209`).
    - 404 (`not-found.tsx`) is goed. Het foutscherm `error.tsx:13` gebruikt een **ember**-rand voor een fout; de brief
      zegt `bg-alert-tint`.
12. **Deep links.** Zoekfilters staan netjes in de URL, maar `kaart`, `limit`, Dichtbij-filters en de open plek op de
    kaart niet. `/mijn-reis?r=` is goed (voorbeeld eerst, dan keuze). De manifest-shortcut "Zoeken op de kaart"
    (`manifest.ts:26`) opent `/zoeken` zonder `kaart=1`.

---

## 3. Look & feel, soepelheid, PWA en toegankelijkheid

### 3.1 Mobiele ergonomie

- **Duimzone (P2).** Zoeken en filteren zitten bovenaan de pagina. De zwevende kaart/lijst-knop zit wel in de duimzone
  (`search-app.tsx:216`), maar ligt over de prijs van de kaart (`zoeken-light.png`). Overweeg een vaste onderbalk
  "Filters · Sorteren · Kaart" boven de tabbalk, het patroon van Booking.
- **Tikdoelen onder 44 px (P1/P2):**
  - Actieve filterchips `h-9` (`search-app.tsx:158`).
  - Admin Segmented `h-10` (`admin/ui.tsx:107`), snelantwoorden `h-9` (`admin/support/page.tsx:210`), knoppen `h-9 w-11`
    (`admin/plekken/page.tsx:314`).
  - Sorteerselect: het `<label>` is 44 px, maar de `select` zelf 26 px (gemeten). Prima zolang het label klikbaar is.
    Op iOS opent een tik op het icoon niet.
  - ScorePicker in een sheet: 10 kolommen op 350 px geeft 32 px breed (`client.tsx:249`). Alternatief: 1 tot 10 in
    twee rijen van 5, of een slider met grote duim.
  - MapLibre-pop-up sluiten 36 px (`globals.css:272-273`), zoomknoppen 40 px (`globals.css:285-286`).
  - Kaartmarkers 12 tot 18 px (`place-map.tsx:195`). Gebruik een prijslabel-pin (Airbnb) of een onzichtbare
    hit-cirkel van 22 px.
  - Skiplink en footerlinks met `md:py-1.5` (32 px) op desktop is acceptabel.
- **Actiebalk plekpagina (P2).** Prijs + hartje (rond, 44) + bellen (48, vierkant met rand) + website + Route op
  360 px laat de prijs krimpen. De vormen verschillen. Voorstel: prijs links, "Route" primair rechts, en bellen, website
  en bewaren in één rij gelijke pictogramknoppen.
- **Dubbele vertrekinformatie (P3).** Op de plekpagina staat de vertrekregel in de kerngegevens én direct daaronder in
  het blok "Aankomen en vertrekken" (`plek-light.png`). Toon het blok alleen, groot, en vervang die kerngegevenstegel
  door bijvoorbeeld "Aantal plekken" of "Stroom".
- **"Toon op kaart" (P3)** springt naar `#ligging`, dat op mobiel diep in de zijkolom staat, onder de routekaart
  (`page.tsx:136, 361`).
- **Scroll en focus onder de sticky balk (P2).** `scroll-padding-top: 5rem` (`globals.css:97`) houdt geen rekening
  met de sticky zoekbalk (64 + ~125 px). In de Playwright-test lag de eerste kaartlink na `scrollIntoView` onder de
  zoekbalk ("subtree intercepts pointer events"). Voor toetsenbordgebruikers verdwijnt de focus dan onder de balk
  (WCAG 2.4.11 in 2.2, en hinderlijk voor 2.4.7).
- **Cookiebanner (P2)** ligt over het eerste resultaat. In de test onderschepte hij de tik op de eerste kaart. Op de
  plekpagina staat hij op 76 px boven de actiebalk van ~72 px plus safe area: krap en deels overlappend.

### 3.2 Sheets en filters

Goed: portal, focus-trap, Escape, vegen om te sluiten, live teller, voorstel bij 0, "Wis filters", `reduce` →
opacity-animatie (`sheet.tsx`).

Verbeterpunten:
- Vegen werkt alleen vanaf de greep en de kop (`onPointerDownCapture` stopt het op de inhoud, `sheet.tsx:422`). Dat
  is goed, maar geef de kop een grotere sleepzone.
- `document.body.style.overflow = "hidden"` (`sheet.tsx:350`) blokkeert scrollen niet betrouwbaar op iOS Safari.
  Gebruik `overscroll-behavior: contain` op `html` of `position: fixed` met een scroll-offset.
- Zonder `footer` krijgt de inhoud geen safe-area-padding onderaan (`sheet.tsx:422`). Bij de reviewsheet valt de
  laatste knop dan onder de home-indicator.
- De filtersheet heeft geen sorteren. Sorteren staat los als `<select>`. Bij Booking zit sorteren als eerste sectie in
  de sheet; dat scheelt een besturing in de sticky balk.
- Filter-toggles hebben bij "Alle plekken" ook in actieve stand een zandkleurig klokje (`filter-sheet.tsx:147`). Dat
  ziet eruit als "niet geselecteerd".
- Het checkbox-patroon voor voorzieningen verschilt per scherm: in de filtersheet `aria-pressed`-knoppen, in
  plek-aanmelden verborgen checkboxen met een `has-[:checked]`-label en een **inktkleurige** focusring
  (`submit-form.tsx:183`), terwijl elders de bosgroene ring geldt.

### 3.3 Kaartinteractie

- Geen "Zoek in dit gebied" of verversen bij pannen. De kaart volgt de lijst, niet andersom (`place-map.tsx`).
  Booking, Airbnb, park4night en Campercontact laten je de kaart als zoekmiddel gebruiken.
- Maximaal 600 markers (`search-app.tsx:96`) zonder melding.
- Geen bottom-sheet-kaart bij een geselecteerde plek. Op mobiel gaat de pop-up meteen naar de plekpagina, zonder
  bewaren, vertrek of route.
- Het donkere thema wordt eenmalig gelezen (`place-map.tsx:121`). Wisselt het systeem van thema, dan blijft de kaart
  licht of donker.
- De pop-upfoto gebruikt `p.image` zonder `photoProxy` (`place-map.tsx:59`). Dat is een volle websitefoto per tik.
- Mislukte kaart zonder herstelknop (zie 2.2-11).
- Toegankelijkheid: de kaart is niet met het toetsenbord te bedienen. Dat staat terecht als beperking in de verklaring,
  en de lijst is het alternatief. Geef de kaartcontainer wel `role="region"` en een `aria-label`, en zet een
  `aria-hidden` op het canvas.

### 3.4 Transities en beweging

Goed: één georkestreerd moment (`animate-rise`), foto-morph via `ViewTransition`, chips met `AnimatePresence`,
`MotionConfig reducedMotion="user"` en de globale reduce-regel (`globals.css:304-317`).

Wel:
- `SaveToast` verdwijnt na 3,2 s (`chrome.tsx:194`) met een actieknop "Bekijk". Voor 55+ op een telefoon is dat kort
  (WCAG 2.2.1 bij interactieve inhoud). Neem 6 s, of pauzeer bij focus en hover.
- De toast wordt alleen getoond bij bewaren, niet bij verwijderen. Er is geen "Ongedaan maken" bij een stop
  verwijderen in Mijn reis (`trip-app.tsx:326`), en dat staat naast "Reis wissen" met bevestiging. Dat is ongelijk.
- `scrollIntoView({behavior:"smooth"})` (`search-app.tsx:87`) respecteert reduced motion via de globale CSS niet,
  want JS-smooth-scroll valt daar buiten. Check `matchMedia`.

### 3.5 Prestatie-indruk

- **`/api/places`**: alle samenvattingen in één keer. Gemeten met de snapshot: 369 KB voor 680 plekken. Doorgerekend
  naar de 1.509 gepubliceerde plekken is dat ~870 KB JSON (~170 KB gzip). Dit wordt al op de **startpagina** geladen
  voor de suggesties (`destination-search.tsx:66`). Op 4G is dat goed, op een camping met 1 streepje traag.
  Overweeg een slanke suggestie-index (naam, plaats, slug; ~60 KB) en de volle set pas op `/zoeken`.
- `DepartureTabs` draait 4× `applyFilters` over alle plekken bij elke render (`search-app.tsx:236-245`). Dat is nu
  goedkoop, maar gebeurt bij elke filterwijziging. De suggesties doen `nearbyCount` per woonplaats over alle plekken
  bij elke toets (`destination-search.tsx:84-105`), ~650 × 1.500 afstandsberekeningen per toetsaanslag. Debounce of
  vooraf berekenen.
- `snapshot.json` (1,3 MB) wordt alleen server-side geïmporteerd (`lib/places.ts:2`). De client importeert alleen
  het type. Dat is in orde.
- De plekpagina zonder loading-shell (zie top 10 #8). Alleen de 100 meest complete plekken worden vooraf gebouwd
  (`page.tsx:21-27`); de rest wordt bij het eerste bezoek gerenderd, zonder zichtbare feedback.
- Foto's: wsrv.nl-proxy met `srcSet` is goed. Externe proxy betekent wel een derde partij die IP-adressen ziet. Noem
  dit in de privacyverklaring, of draai de proxy zelf (Next Image of Supabase transform).

### 3.6 PWA en offline

| Punt | Bestand:regel | Toelichting |
|---|---|---|
| Geen offline-pagina | `sw.js:283` | Een onbekende pagina offline valt terug op `/mijn-reis`. Dat is verwarrend: je tikt op een plek en ziet je reis. Maak een `/offline` met "Geen verbinding" + bewaarde plekken |
| `ignoreSearch: true` bij paginacache | `sw.js:283` | `/zoeken?waar=Texel` offline geeft de laatst gecachte `/zoeken?…` van een andere zoekopdracht. De titel klopt dan niet |
| Client-navigaties (RSC-fetch) | `sw.js:271` | Alleen `mode === "navigate"` wordt gecachet. Interne `<Link>`-navigatie (RSC-payload) faalt offline, ook naar eerder bekeken plekken. Dat ondergraaft "eerder bekeken pagina's werken" |
| Tegelcache zonder vervaldatum | `sw.js:216-229` | Cache-first voor altijd; de stijl-JSON van OpenFreeMap wordt nooit ververst |
| Offline kaarten | — | Geen "Download regio". Bij concurrenten is dit de belangrijkste betaalde functie |
| Geen update-melding | `sw.js:191` | `skipWaiting` + `clients.claim` zonder melding "Nieuwe versie, ververs" |
| Precache | `sw.js:183` | `/` en `/zoeken` precachen een HTML-shell zonder data. `/api/places` is niet geprecachet, dus een eerste offline start toont het zoekscherm met een foutmelding |
| Manifest | `manifest.ts:82` | `orientation: "portrait"` blokkeert liggend gebruik op tablets (de PRD noemt "thuis op telefoon of tablet"). Geen `screenshots` (installatiedialoog op Android), geen `share_target` |
| Installatie-uitleg | — | Alleen in de FAQ. Een niet-opdringerige "Zet op beginscherm"-kaart in Mijn reis na de eerste bewaarde plek zou passen |
| Offline-melding | `chrome.tsx:106-114` | Een goede balk. Hij zit in de header, dus niet op de plekpagina-actiebalk, maar dat is acceptabel |

### 3.7 Toegankelijkheid (WCAG 2.1 AA)

| Criterium | Bevinding | Bestand:regel | Prio |
|---|---|---|---|
| 1.4.11 Non-text contrast | Veldranden en knopranden `--line`: 1,26–1,4:1 (min. 3:1) | `globals.css:14,44`, alle `border-2 border-line` | P1 |
| 1.4.3 Contrast | Tokens kloppen: muted/paper 5,3, muted/sunken 4,8, lake/lake-tint **4,54**, on-ember/ember **4,53**. De laatste twee zitten op het randje; bij antialiasing en 14 px is dat krap. Fotobijschrift wit op `black/55` boven een lichte foto ≈ 3,4:1 bij 12 px | `place-ui.tsx:97`, `client.tsx:69` | P2 |
| 4.1.3 / 1.3.1 Statusberichten | Hele resultatenlijst in `aria-live` | `search-app.tsx:175` | P1 |
| 4.1.3 | "Locatie bepalen…" zonder `role="status"` | `destination-search.tsx:301` | P3 |
| 1.3.1 | `h2` vóór `h1`, en een kop in een `nav` | `search-app.tsx:286` vs `176` | P2 |
| 2.4.7 Focus zichtbaar | Velden zetten `focus:outline-none` en alleen de rand verandert van kleur (2 px, van line naar forest). Dat is zichtbaar, maar zwakker dan de globale 3 px-ring en anders dan elders. Kaart-titel-link `focus-visible:outline-none` (`place-ui.tsx:255`); de kaart zelf krijgt geen ring | `contact-form.tsx:19`, `place-ui.tsx:255` | P2 |
| 2.5.5 / brief 44 px | Zie 3.1 | — | P2 |
| 3.3.1 / 3.3.3 Foutmeldingen | Eén alert onderaan het formulier, geen fout onder het veld, geen `aria-invalid` of `aria-describedby`. Validatie is native (browser-bubbels, niet in de huisstijl) | alle formulieren | P2 |
| 3.3.2 Labels | Verplichte velden: `*` bij review en aanmelden, maar niet bij contact (`contact-form.tsx:74-90`) en melden. Bij aanmelden worden naam en e-mail verplicht in eigenaar-modus, zonder `*` (`submit-form.tsx:212-219`) | | P2 |
| 1.3.1 | Combobox: `aria-activedescendant` verwijst naar een optie terwijl `active=1` en de lijst nog leeg kan zijn. Er is geen `aria-live` voor "n suggesties" | `destination-search.tsx:246, 255` | P3 |
| 2.1.1 | `CookieBanner` als `role="dialog"` zonder focusbeheer (`aria-modal=false` is wel correct) | `cookie-banner.tsx:54` | P3 |
| 2.2.1 | Toast met actie 3,2 s | `chrome.tsx:194` | P3 |
| 2.3.3 / reduced motion | Goed geregeld, behalve JS smooth-scroll | `search-app.tsx:87`, `client.tsx:25` | P3 |
| 1.4.4 / tekst | `text-xs` op 8 plekken; tabbalk 13 px | §1.6 | P2 |
| Verklaring | Belooft meer dan de code waarmaakt | `toegankelijkheid/page.tsx:12-14` | P1 (juridisch) |

---

## 4. Concurrentie- en marktonderzoek

### 4.1 Overzicht

| Product | Sterk in (UX-patronen en features) | Betaald | Relevant voor VrijStaan |
|---|---|---|---|
| **park4night** | Community-kaart, plekken toevoegen met pin, foto's en reviews van gebruikers, favorieten (gratis tot ~200), gesloten-melding | park4night+: geavanceerde filters, **offline kaarten**, **meerdaagse reis**, **favorietenmappen**, satellietkaart, geen advertenties (~€12/jaar) | Kaart als zoekmiddel; mappen; offline als killer-feature |
| **Campercontact (NKC)** | Camperspecifieke velden, 70+ filters, beschikbaarheid en boeken bij aangesloten plekken (koppeling Camping.care), reviews met foto's | PRO/PRO+: **offline (land downloaden, incl. foto's, reviews en filters)**, routeplanner, sommige filters (o.a. honden) | Grootste NL-concurrent. Gebruikers klagen over betaalmuur en over missend "aantal plekken" |
| **ACSI / CampingCard** | Jaarlijks geïnspecteerde campings, filters op voorzieningen, maximale afstand tot je locatie, offline per landpakket, boeken, kortingskaart | App-aankoop per regio | Inspectie is een betrouwbaarheidssignaal. Vergelijk met "Laatste update" en (straks) "volgens n bezoekers" |
| **Stellplatz.info** | Deelscores: Lage, Ruhe, Stellplatz, Technik, Sanitär, Versorgung, Preis-Leistung + Gesamt; geen anonieme reviews | — | VrijStaan heeft 4 deelscores. "Ondergrond/vlak" en "Sanitair" ontbreken |
| **Promobil Stellplatz-Radar** | Tourenplaner met start, bestemming en stops, per etappe naar Google of Apple Maps; filters op prijs, afstand, score, gasflessen; favorieten met mappen en **notities**; offline database incl. foto's | Plus ~€10/jaar (routes, filters, offline kaarten) | Apple Maps-keuze; notities bij favorieten |
| **Searchforsites** | **Alles offline** (31.000+ plekken), kaarten per land, offline plaatsnamen-index, **eigen lijsten**, snelle filters, toegangsinfo voor grote voertuigen | ~£6/jaar | Offline-first en toegang voor grote campers |
| **iOverlander** | Data lokaal op de telefoon, **toevoegen, reviewen en bewaren werkt offline** (wachtrij), "laatst bezocht"-datum, check-ins, veel categorieën (water, LPG, wasserette) | Pro: offline kaarten, opgeslagen filters | Offline wachtrij voor meldingen; POI's als water en LPG |
| **Camperstop (Europe)** | Gedrukte en digitale gids met camperplaatsen per land, offline | Betaald | Weinig online materiaal gevonden; laag in prioriteit |
| **Booking.com / Airbnb** | Kaart en lijst gekoppeld, **"zoek als ik de kaart verplaats"**, **prijspins** op de kaart, ~30–50 pins i.p.v. alles (Airbnb), sleepbare bottom sheet (peek, half, vol), filters met live teller, sortering in de filtersheet, compacte inklapbare zoekbalk, verlanglijsten met meerdere lijsten, datums en beschikbaarheid | — | Interactiepatronen voor zoeken, kaart en lijsten |
| **Komoot** | Meerdaagse planner met etappes per dag, slepen van waypoints, **collecties** (bundels routes en plekken, deelbaar), offline regio's | Premium | Etappes en dagafstanden voor Mijn reis; collecties |

### 4.2 Wat VrijStaan al beter doet

- Vertrektijd als veld, filter en eigen pagina's: geen concurrent heeft dat (PRD).
- Prijs met toeslagen en toeristenbelasting, kostenraming in Mijn reis.
- Gratis, zonder account en zonder betaalmuur op filters (Campercontact en park4night zetten juist filters en offline
  achter betaling).
- Echte rijtijd op Dichtbij en in de plekpagina.
- Duidelijk "Onbekend" in plaats van gokken, met de zand/groen/doorgestreept-legenda.
- Reiskosten- en nachtplanning (vergelijkbaar met Stellplatz-Radar Plus en park4night+ multi-stop).

### 4.3 Waar VrijStaan achterloopt

1. Offline: geen kaarttegels voor een regio, geen offline zoekset vooraf, geen offline wachtrij voor meldingen of
   reviews.
2. Kaart als zoekmiddel (pannen = zoeken, prijspins, geselecteerde plek als sheet).
3. Foto's en reviews van gebruikers (fase B gepland).
4. Lijsten en mappen in plaats van één reis.
5. Navigatiekeuze (Apple Maps, Waze, Google), nu alleen Google (`lib/geo.ts:26-34`, `trip-app.tsx:178-184`).
   Waypoints worden stil afgekapt op 9.
6. Camperspecifieke filters: ondergrond, verhard of vlak, maximale hoogte en gewicht, toegang 24 uur of slagboom,
   reserveren mogelijk, LPG, wasserette, rolstoeltoegankelijk.
7. Beschikbaarheid en drukte: niemand heeft live vrije plekken, maar "Aantal plekken" staat bij VrijStaan alleen
   onder Praktisch en niet als filter.
8. Meertaligheid (DE en EN): Duitse camperaars zijn een grote groep in NL (fase C).

---

## 5. Feature-gap lijst

Omvang: **S** ≤ 1 dag, **M** 2–5 dagen, **L** > 1 week.

### Must have

| # | Feature | Onderbouwing | Omvang |
|---|---|---|---|
| M1 | **Vertrektijd op de kaart**: markerkleur of -icoon per vertrekgroep (forest, lake, neutraal) en een pop-up met `DepartureChip`, prijs en hartje | Kernbelofte (PRD); geen concurrent heeft het; nu onzichtbaar op de kaart | S |
| M2 | **Grotere kaartmarkers / prijspins + geselecteerde plek als mini-sheet** onderaan (foto, vertrek, prijs, Bewaren, Route) | Airbnb en Booking; M5 open taak; tikdoelen 55+ | M |
| M3 | **Gedeelde UI-componenten** (`Button`, `Field`, `Chip`, `ToggleTile`, `Card`) voor site en beheer, plus radius- en schaduwtokens; `shadow-lift` weg | 45× ad-hoc randen; 7 secundaire knopvarianten; site en beheer lopen uiteen | M |
| M4 | **AA-herstel**: randcontrast ≥ 3:1 (nieuwe token `--field-border`), `aria-live` alleen op de telregel, kopvolgorde, `text-xs` weg, fouten per veld met `aria-describedby`, toegankelijkheidsverklaring rechtzetten | WCAG 2.1 AA is een doel in de brief; de verklaring is nu onjuist | M |
| M5 | **Zoekstaat behouden**: `kaart` en "toon meer" in de URL (of scroll-restore), Dichtbij-filters in de URL | Terug van de plek naar de lijst is de meest gebruikte route; Booking en Airbnb behouden de positie | S |
| M6 | **Onbekende plaats = "niet gevonden"** met suggesties | Bekende fout (App Flow, M5); vertrouwen | S |
| M7 | **Laadstaten**: `loading.tsx` voor `/plek/[slug]`, `/camperplaatsen/*` en home; skelet voor Mijn reis; kaartfout met "Toon lijst" en "Opnieuw" | Directe respons op een tik; CLS-taken in M5 | S |
| M8 | **Compacte mobiele zoekkop** die bij het scrollen inklapt tot "Waar · n filters · Kaart"; tabbladen passend op 390 px | Nu 1 resultaat boven de vouw; Booking en Airbnb | M |
| M9 | **Offline-basis op orde**: `/offline`-pagina, geen `ignoreSearch` op zoekresultaten, RSC-payloads van bekeken plekken cachen, `/api/places` precachen na de eerste bezoek, melding bij een nieuwe versie | PRD-userstory "offline onderweg"; Searchforsites en iOverlander zijn offline-first | M |
| M10 | **Navigatiekeuze**: Apple Maps, Google Maps, Waze (en `geo:` op Android); geen stille afkapping van waypoints | 55+ op iPhone; Stellplatz-Radar biedt Google en Apple | S |

### Should have

| # | Feature | Onderbouwing | Omvang |
|---|---|---|---|
| S1 | **Zoek in dit kaartgebied** (knop na pannen) | Airbnb, Booking, park4night | M |
| S2 | **Offline regio downloaden** (tegels per provincie + data), met opslagindicator | Belangrijkste betaalde feature bij park4night+, Campercontact PRO, Searchforsites en iOverlander. Gratis aanbieden is een sterk verkoopargument | L |
| S3 | **Foto's van bezoekers bij reviews** + vertrektijdvraag in de review ("volgens n bezoekers") | park4night en Campercontact; fase B al gepland; data compleet maken | L |
| S4 | **Meerdere lijsten / favorieten los van de reis** (bijvoorbeeld "Zeeland voorjaar", "Ooit") met notities | park4night+ mappen, Stellplatz-Radar notities, Airbnb-verlanglijsten. Nu is bewaren hetzelfde als een reisstop | M |
| S5 | **Reis met datums**: aankomst per stop, waarschuwing bij gesloten seizoen, dagafstanden en etappes | Fase B; Komoot meerdaagse planner | M |
| S6 | **Camperfilters uitbreiden**: ondergrond/verhard, reserveren mogelijk, 24 uur toegankelijk, aantal plekken, maximaal verblijf | Campercontact 70+ filters; Searchforsites toegang voor grote voertuigen; velden bestaan deels al (`surface`, `access24h`, `capacity`, `reservation`) | S |
| S7 | **Eén Dichtbij**: zoekveld-optie naar `/dichtbij`, dezelfde `FilterSheet`, plus "Overige" | IA-overlap opheffen | S |
| S8 | **Offline wachtrij** voor "Fout melden", "Doe mee" en reviews (versturen zodra er bereik is) | iOverlander; camperaars melden vaak ter plekke zonder bereik | M |
| S9 | **Supportlink bewaren** ("Mijn berichten" in localStorage) en mail met link zodra er SMTP is | Nu is het ticket weg als je de pagina sluit | S |
| S10 | **Undo** bij stop verwijderen en bij ontbewaren (toast "Verwijderd · Ongedaan maken") | Fouttolerantie voor 55+; Gmail/Airbnb-patroon | S |
| S11 | **Deelscores uitbreiden** met "Ondergrond/vlak" en "Sanitair" | Stellplatz.info; relevant voor campers | S |
| S12 | **Plek aanmelden met kaartpin** (locatie kiezen op de kaart, "gebruik mijn locatie") | park4night en iOverlander; nu geen coördinaten in het formulier | M |
| S13 | **Lichtere suggestie-index** op de startpagina i.p.v. de volledige dataset; debounce van de suggesties | ~870 KB JSON op de home bij 1.509 plekken | S |

### Nice to have

| # | Feature | Onderbouwing | Omvang |
|---|---|---|---|
| N1 | Duits en Engels | PRD fase C; grote groep Duitse bezoekers in NL; alle concurrenten zijn meertalig | L |
| N2 | POI-lagen: losplaatsen (servicezuilen) los van overnachten, LPG, wasserette, supermarkt | iOverlander, Stellplatz-Radar (gasflessen) | M |
| N3 | Satelliet- of luchtfotolaag (PDOK luchtfoto is gratis in NL) | park4night+ satelliet; inschatten of de plek vlak is en bomen heeft | S |
| N4 | Meldingen: "plek in je reis is gewijzigd of gesloten" (web push in de PWA) | Vertrouwen; vraagt toestemming en push-infra | M |
| N5 | Installatiekaart "Zet VrijStaan op je beginscherm" (iOS-instructie, Android-prompt) | Vindbaarheid van PWA-gebruik; nu alleen in de FAQ | S |
| N6 | Vergelijken van 2–3 plekken naast elkaar | Booking-patroon; beslissen tussen plekken | M |
| N7 | Eigenaarsantwoord op reviews | Campercontact en Booking; komt mee met de claimflow | M |
| N8 | Beschikbaarheid of drukte ("vaak vol in juli", bezoekersmelding "nu vol") | Niemand heeft live data; een community-signaal is haalbaar | M |
| N9 | Collecties en thema-pagina's ("Aan het water", "Bij een boerderij") voor SEO en inspiratie | Komoot-collecties, Airbnb-categorieën | S |
| N10 | Manifest: `screenshots`, `share_target`, geen vaste portretstand | Betere installatiedialoog; tabletgebruik | S |

---

## 6. Snelle winst (≤ 1 dag samen)

1. `CookieBanner` en `SaveToast` naar `(site)/layout.tsx` (niet in het beheer).
2. `aria-live` van `<section>` naar alleen de `h1`-teller (`search-app.tsx:175`).
3. "Bedankt!" → "Bedankt", "Laatst bijgewerkt" → "Laatste update", filtersheet-tekst zonder bronuitleg.
4. Hartje overal `text-ember`.
5. `--line` voor velden donkerder (licht ~`#a89c86`, donker ~`#5a6a60` haalt 3:1). Controleer met de validator.
6. `theme_color` in het manifest gelijk aan de `viewport` (`#fffcf6`/`#18201b`).
7. Kaart-donker-kleuren uit de tokens lezen; locatiestip in `--lake`.
8. Kaartfout met knop "Toon lijst".
9. Duur van de toast naar 6 s.
10. "100% van de gegevens bekend" → "Kerngegevens compleet" of het echte percentage van alle velden.

---

## Bronnen (marktonderzoek)

- park4night: [App Store](https://apps.apple.com/app/id430946556), [openvan.camp: best motorhome apps 2026](https://openvan.camp/en/news/lifestyle/best-motorhome-caravan-apps-2026), [Similarweb](https://similarweb.com/fr/app/google/fr.tramb.park4night)
- Campercontact: [PRO+ features](https://campercontact.com/en/content/features-pro), [features pro (NL)](https://www.campercontact.com/nl/content/features-pro), [App Store NL](https://apps.apple.com/nl/app/campercontact-camping/id633972355), [Camping.care-koppeling](https://business.campercontact.com/blog-posts/campercontact-and-camping-care-launch-integration), [camperforum.nl](https://camperforum.nl/viewtopic.php?p=2021894)
- ACSI: [CampingCard ACSI App Store](https://apps.apple.com/DE/app/id949457505), [camperstyle.de](https://camperstyle.de/?p=252489), [Eurocampings ACSI-producten](https://www.eurocampings.co.uk/extra-information/acsi-products/)
- Stellplatz.info: [blog over beoordelingscategorieën](https://stellplatz.info/blog/jetzt-stellplatz-bewerten-und-samsung-galaxy-tab-gewinnen)
- Promobil Stellplatz-Radar: [promobil.de](https://www.promobil.de/stellplatz-radar), [GIGA](https://www.giga.de/tech/geheime-stellplaetze-finden-diese-apps-nutzen-camper-statt-google-maps--01J5QTSZQKNNZR186BXH5RG0MZ), [web.de](https://web.de/magazine/reise/campingplaetze-stellplaetze-stellplatz-radar-app-bekommt-funktionen-41302334)
- Searchforsites: [App Store](https://apps.apple.com/app/id1391657133), [Swift Group 2026](https://www.swiftgroup.co.uk/resources/best-touring-apps/), [Lifesure](https://www.lifesure.co.uk/articles/15-useful-apps-for-motorhome-and-caravanning)
- iOverlander: [App Store](https://apps.apple.com/app/id1486556203), [Bearfoot Theory review](https://bearfoottheory.com/ioverlander-app-review/), [Mowgli Adventures](https://mowgli-adventures.com/ioverlander-offline-mobile-app/)
- Airbnb en Booking: [Airbnb tech: search ranking for maps](https://airbnb.tech/?p=683), [techscoop: map search](https://techscoop.substack.com/p/how-airbnb-made-map-search-smarter), [VP0: bottom sheet](https://vp0.com/blogs/airbnb-style-bottom-sheet-react-native), [Baymard: Airbnb search field](https://baymard.com/ecommerce-design-examples/32-search-field/19311-airbnb)
- Komoot: [Premium](https://www.komoot.com/premium), [BikeRadar guide](https://www.bikeradar.com/guide-to-using-komoot)

Kanttekening: prijzen en functies van betaalde lagen verschillen per bron en per datum. Ze zijn alleen indicatief
gebruikt. Over Camperstop is online weinig actueels gevonden.
