# UX-audit: gebaren, slimme zoekbalk en kleine verbeteringen (november 2026)

> Gemaakt op 18 november 2026 op `claude/dreamy-faraday-859bki` (gelijk aan `main`). Alleen gelezen: er is geen code
> veranderd. Vraag van Patrick: "full audit op nice to have functies, kleine verbeteringen, slimme zoekbalken, mobile
> gestures (zoals een iPhone werkt met swipen), slimmigheidjes".
>
> Let op de bevriezing tot de livegang (review R41, [LANCERING.md](LANCERING.md)): bijna alles hier is ná 1 januari
> 2027. Een handvol punten is klein, raakt geen data en lost iets op wat nu stuk voelt; die staan in §1 als "kan vóór de
> livegang" en vragen een besluit van Patrick.

**Stand 18 november 2026:** G1, G2 en K1 zijn gebouwd (op verzoek van Patrick, vóór de livegang), met e2e-tests in
`web/e2e/gestures.spec.ts`. De rest staat open.

Tekens bij elk punt: **S** = een paar uur, **M** = een dag, **L** = meerdere dagen. Plaatsen in de code zijn relatief
aan `web/src/`.

## 1. Samenvatting en top 12

De basis is goed: sheets sluiten met omlaag vegen, de fotocarrousel veegt met snap, het zoekvak vergeeft tikfouten,
kent aliassen en vraagt PDOK via de eigen server, Dichtbij zoekt meteen als je locatie al mag, en de PWA heeft
snelkoppelingen en een offline-modus. Wat ontbreekt, is vooral wat een iPhone-gebruiker blind verwacht: de terugveeg
sluit een sheet niet maar verlaat de pagina, een tik op het actieve tabblad scrollt niet naar boven, en het zoekvak
onthoudt niets.

| # | Punt | Waar | Moeite | Kan vóór de livegang |
|---|---|---|---|---|
| G1 | Terugveeg (iPhone) en terugknop (Android) sluiten eerst de open sheet | `components/sheet-panel.tsx` | S | Ja, voelt nu als een fout |
| G2 | Tik op het actieve tabblad scrollt naar boven; nog een tik op Zoeken zet de cursor in het zoekvak | `components/chrome.tsx` | S | Ja |
| Z1 | Recente zoekopdrachten en laatst bekeken plekken in het lege zoekvak (alleen op het toestel) | `components/destination-search.tsx` | S | Nee |
| K1 | "Toon meer plekken" onthouden: terug van een plek kom je weer op dezelfde plek in de lijst | `app/(site)/zoeken/search-app.tsx` | S | Ja, voelt nu als een fout |
| U1 | Ongedaan maken na weghalen uit Mijn reis | `app/(site)/mijn-reis/trip-app.tsx`, `chrome.tsx` (SaveToast) | S | Nee |
| G3 | Kaartpaneel (MapPick) omlaag vegen om te sluiten, opzij vegen naar de volgende plek | `components/place-ui.tsx` | M | Nee |
| Z2 | Zoekvak begrijpt filters in gewone taal: "texel gratis stroom", "zonder vertrektijd zeeland" | `lib/search.ts`, `destination-search.tsx` | M | Nee |
| K2 | Knop "Mijn locatie" op de kaart en "Zoek in dit gebied" na verschuiven | `components/place-map.tsx` | M | Nee |
| G4 | Foto's schermvullend met knijpen om te zoomen en omlaag vegen om te sluiten | `app/(site)/plek/[slug]/client.tsx` (Gallery) | M | Nee |
| U2 | Mijn reis: volgorde slepen (lang indrukken), zoals de App Flow al belooft | `trip-app.tsx` | M | Nee |
| K3 | Zoekbalk op Zoeken schuift weg bij omlaag scrollen, komt terug bij omhoog | `search-app.tsx` | M | Nee |
| U3 | Delen van een plek met vertrekregel en prijs in de tekst, niet alleen de link | `client.tsx` (ShareButton) | S | Nee |

## 2. Mobiele gebaren (het iPhone-gevoel)

### G1. Terug sluit eerst de sheet (S)

Nu: `SheetPanel` sluit met ×, Escape, tik op de achtergrond en omlaag vegen. Veeg je op een iPhone vanaf de linkerrand
of druk je op Android op terug terwijl een sheet open is (filters, review, melden, uitleg bij de eerste keer), dan gaat
de hele pagina terug en is wat je invulde weg. Dat is het meest gemelde "app voelt kapot"-gevoel bij PWA's.

Voorstel: bij openen `history.pushState({ sheet: id }, "")`, op `popstate` sluiten; bij sluiten met × zelf
`history.back()` als de bovenste staat van ons is. Eén plek, geldt meteen voor alle sheets. Ook voor het kaartpaneel op
Zoeken en Dichtbij (`MapPick`) en de schermvullende foto's (G4).

### G2. Tabbalk zoals iOS (S)

- Tik op het tabblad waar je al bent: soepel naar boven (`window.scrollTo({ top: 0, behavior: "smooth" })`).
- Nog een tik op Zoeken als je al boven bent: cursor in het zoekvak (toetsenbord open).
- Mijn reis: de teller "springt" al (`animate-pop`); goed zo laten.

### G3. Kaartpaneel vegen (M)

`MapPick` is nu een vast paneel met ×. Op Apple Kaarten en Airbnb verwacht je:

- omlaag vegen: sluiten (zelfde `drag="y"` als de sheet);
- opzij vegen: naar de dichtstbijzijnde volgende plek in de huidige resultaten, de kaart schuift mee. Volgorde: op
  Dichtbij de rijtijdvolgorde, op Zoeken de sortering van de lijst. Met knoppen "Vorige" en "Volgende" voor wie niet
  veegt (WCAG 2.5.1).

### G4. Foto's schermvullend (M)

De carrousel veegt al met snap. Een tik op een foto opent hem nu nergens. Voorstel: tik opent schermvullend (zwarte
achtergrond, teller "2 / 5", maker eronder), knijpen of dubbeltik zoomt, omlaag vegen sluit, terug sluit (G1). Geen
nieuwe bibliotheek nodig: `motion` kan slepen en schalen; pinch met `touch-action: pinch-zoom` op het beeld.

### G5. Lang indrukken op een plekkaart (M, na G1)

Snelmenu met Bewaren, Route, Bellen, Delen, zonder de plek te openen. Let op: iOS toont bij lang indrukken op een link
zelf een voorbeeld. Dat moet uit (`-webkit-touch-callout: none` alleen op de kaart) en het menu moet ook via een
knop (⋯) bereikbaar zijn. Pas doen als uit statistieken blijkt dat mensen vaak heen en weer gaan tussen lijst en plek.

### G6. Verversen zonder trekken (S)

Als app op het beginscherm heeft iOS geen "omlaag trekken om te verversen". De plekkenlijst komt tot 3 uur uit de cache
(`public/sw.js`, `DATA_FRESH`). Mijn reis toont al "Gegevens van <datum>". Voorstel: dezelfde regel op Zoeken en
Dichtbij als de gegevens uit de cache komen, met de knop **Ververs**. Een echt trekgebaar raden we af: het botst met
de kaart en met scrollen in sheets.

### Niet doen

- Opzij vegen op een plekkaart om te bewaren of te verwijderen in de zoeklijst: botst met de terugveeg van iOS en met
  de horizontale chiprijen.
- Trillen (haptiek): `navigator.vibrate` werkt niet in Safari op de iPhone; alleen Android zou het merken.
- Eigen spraakinvoer: het toetsenbord van iOS en Android heeft dicteren al, en dat werkt in ons zoekvak.

## 3. Slimme zoekbalk

Wat er al is (`components/destination-search.tsx`, `lib/search.ts`): combobox met pijltjes, Enter en Escape;
tikfouten tot 2 letters; aliassen ("st" → "sint"); provincies, streken en eilanden met eigen straal; woonplaatsen met
"n plekken binnen 25 km"; adressen en postcodes van PDOK via `/api/locatie`; plekken op naam; **Dichtbij mijn locatie**
bovenaan.

### Z1. Onthouden wat je zocht (S)

Leeg zoekvak toont nu altijd Zeeland, Gelderland, Friesland, Limburg. Voorstel, in deze volgorde:

1. **Dichtbij mijn locatie**
2. Laatste 5 zoekopdrachten (met de filters die je toen had, bv. "Texel · stroom · gratis"), met × per regel en
   **Wis geschiedenis**
3. Laatst bekeken plekken (3), met de vertrekregel eronder
4. Pas als 2 en 3 leeg zijn: de vier provincies

Alles in `localStorage` (net als Mijn reis), nooit naar de server, zodat het past bij "geen tracking". Vermelden op de
privacypagina bij "op je toestel".

### Z2. Filters in gewone taal (M)

Een camperaar typt "gratis texel met stroom" of "zonder vertrektijd zeeland". Nu zoekt het vak die hele zin als
plaatsnaam en vindt niets. Voorstel: een kleine, testbare functie `parseQuery(text)` in `lib/search.ts` die bekende
woorden eruit haalt en de rest als plaats gebruikt:

| Woord of zin | Wordt |
|---|---|
| gratis, kosteloos | `free` |
| stroom, water, lozen, toilet, douche, wifi, hond(en) | `facilities` |
| zonder vertrektijd, vrij vertrekken, geen vertrektijd, 24 uur | pagina `/zonder-vertrektijd` |
| uitslapen, uitslapers, laat vertrekken | pagina `/uitslapers` |
| open, nu open | `openNow` |
| onder 15 euro, max 15, tot €15 | `maxPrice` (dichtstbijzijnde stap uit de filtersheet) |
| camperplaats, camping, boerderij (soorten uit `KIND_LABEL`) | `kinds` |

De suggestie bovenaan laat zien wat het vak begreep: "Texel, gratis, stroom (12 plekken)". Zo blijft het voorspelbaar:
je ziet de filters vóór je tikt, en ze staan daarna als chips boven de lijst (wegtikken kan). Niets begrepen? Dan werkt
het vak precies als nu. Unit-tests per regel uit de tabel.

### Z3. Kleine dingen in de suggestielijst (S per stuk)

- **Filtersuggestie**: typ je alleen "stroom" of "honden", dan bovenaan "Filter: Stroom aan" in plaats van "Geen plaats
  gevonden".
- **Kopjes** in de lijst (Plaatsen, Adressen, Plekken) zodat 12 regels niet één blok zijn; met `role="group"`.
- **Gevonden deel vet**: "**Giet**hoorn".
- **Plekken op naam ook met tikfouten**: plaatsen gebruiken `editDistance`, plekken alleen `includes`. "Camperpark
  Zeelandia" vind je nu niet met "zeelndia".
- **Precieze plekmatch eerst**: typ je de hele naam van een plek, dan staat die bovenaan, niet onder 7 woonplaatsen.
- **Home en End** in de lijst, en op een computer `/` om het zoekvak te openen.
- **Postcode**: begint de invoer met 4 cijfers, dan meteen PDOK vragen zonder de 250 ms te wachten.

### Z4. Zoeken in de lijst zelf (M, later)

Bij 40+ resultaten in een provincie: een klein filterveld "Zoek in deze plekken" (naam of plaats), alleen op het
toestel. Pas bouwen als statistieken laten zien dat mensen lang scrollen.

## 4. Kleine verbeteringen per scherm

### Zoeken en kaart

- **K1. "Toon meer" onthouden (S).** `Results` begint bij elke opbouw weer op 20 (`useState(PAGE)`). Had je 60 plekken
  open en tik je een plek aan, dan kom je bij terug bovenaan of op een verkeerde plek. Bewaar het aantal per
  zoekopdracht in `sessionStorage` (sleutel: `filtersToQuery`).
- **Vanzelf meer laden (S).** Bij de onderste kaart de volgende 20 laden (`IntersectionObserver`), knop blijft voor
  toetsenbord en schermlezer.
- **K2. Kaartknoppen (M).** `NavigationControl` staat er, een knop voor je eigen locatie niet. Voeg een knop "Mijn
  locatie" toe (eigen knop met `requestMyLocation`, geen `GeolocateControl` die continu volgt). Na verschuiven of
  zoomen: knop **Zoek in dit gebied** die het middelpunt en de straal uit de kaart haalt (`where` wordt "Kaartgebied").
- **K3. Wegschuivende zoekbalk (M).** Op een telefoon nemen zoekvak, chips, de rij Filters/Sorteren/Kaart en de
  gekozen filters samen ±40% van het scherm. Bij omlaag scrollen alleen een smalle balk "Texel · 3 filters" laten staan;
  bij omhoog scrollen alles terug (zoals de adresbalk van Safari). Met `prefers-reduced-motion` zonder animatie.
- **Telling in de kaartknop**: "Kaart (34)" laat zien dat de kaart dezelfde plekken toont.
- **Lege staat**: de voorstellen met aantallen zijn goed. Staat de straal in de weg, zet "Binnen 50 km" dan bovenaan
  (komt al uit `relaxations()`, alleen de volgorde verandert).

### Plekpagina

- **U3. Delen met inhoud (S).** `navigator.share({ title, url })` deelt alleen de naam. Voeg `text` toe met wat al op
  de pagina staat: "Geen vaste vertrektijd · € 15 per nacht incl. toeslagen". Alleen bekende feiten; onbekend laat je
  weg (spelregel: niets verzinnen).
- **Kopieer adres (S).** Lang indrukken op het adres kopieert op iOS al, maar een knopje "Kopieer" naast adres en
  coördinaten scheelt gepriegel (de coördinaten kunnen al via de navigatieknop).
- **Volgende plek uit je zoekopdracht (M).** Onderaan (of in de actiebalk) "Volgende in je zoekresultaten" met de naam.
  Scheelt heen en weer. Komt van dezelfde lijst als G3.
- **Vandaag-regel (S).** Dichtbij weet al of je nu nog kunt aankomen. Op de plekpagina bij het aankomstvenster: "Nog 2
  uur om aan te komen" of "Vandaag kun je niet meer aankomen", alleen als de tijden bekend zijn.
- **Agenda (S).** In Mijn reis met datums: "Zet in je agenda" (`.ics` met naam, adres, aankomstvenster en
  vertrektijd). Werkt zonder account en zonder dienst van derden.

### Dichtbij

- Gekozen chips onthouden binnen de sessie (`sessionStorage`), zodat terug van een plek niet alle keuzes wist.
- Op de kaart een lijnstuk of ring "30 minuten rijden" is te duur (route-API); de chip **Binnen 30 min** is genoeg.
- Bij weinig bereik: rijtijden komen later binnen. Toon de lijst hemelsbreed meteen (gebeurt al) en een kleine
  "Rijtijden laden…" zodat het verspringen verklaard is.

### Mijn reis

- **U1. Ongedaan maken (S).** Weghalen met het prullenbakje is direct en definitief. Hergebruik de melding van
  `SaveToast` met **Ongedaan maken** (5 seconden).
- **U2. Slepen (M).** De App Flow zegt "volgorde slepen", de code heeft knoppen omhoog en omlaag (zie §7). Voorstel:
  lang indrukken op het greepje en slepen (`motion` `Reorder`), knoppen blijven voor toetsenbord en schermlezer.
- **Reisdag-modus (M).** Op de dag van een stop bovenaan: "Vannacht: <plek>, aankomen tot 22:00, Route". Op een
  vertrekdag: "Vandaag weg om 12:00".
- **Delen als tekst (S).** Naast de link ook een platte lijst (naam, plaats, nachten) voor WhatsApp-groepen die geen
  link openen.

### Start

- Recente zoekopdrachten (Z1) ook als chips onder het zoekvak voor terugkerende bezoekers.
- Als de app op het beginscherm staat (`display-mode: standalone`): de uitleg "zet op je beginscherm" in de FAQ
  verbergen we niet, maar op Start kan een kleine, wegklikbare tip voor iPhone-gebruikers die dat nog niet deden (één
  keer, onthouden in `localStorage`).

## 5. Slimmigheidjes

- **Deeldoel (Share Target).** In `app/manifest.ts` een `share_target`: deel je in Google Maps of WhatsApp een locatie
  naar VrijStaan, dan opent Zoeken rond dat punt. Android en desktop; iOS ondersteunt het niet. M.
- **App-badge.** `navigator.setAppBadge(stops)` met het aantal stops in Mijn reis op het app-icoon (iOS 16.4+ als app
  op het beginscherm, met toestemming voor meldingen die er voor Drukte al is). S.
- **Scherm aanhouden** tijdens de route-uitleg? Niet nodig: navigatie gaat naar de eigen app.
- **Offline-melding met inhoud.** De offlinebalk zegt nu alleen dat er geen verbinding is. Voeg toe welke pagina's wel
  werken: "Mijn reis en de plekken die je bekeek werken gewoon". S.
- **Toetsenbord op formulieren.** `enterKeyHint="next"` en `"send"` op de review-, meld- en eigenaarsformulieren, zodat
  de knop op het toetsenbord zegt wat er gebeurt. S.
- **Donker thema van de statusbalk.** `appleWebApp.statusBarStyle` staat op `default`; met `black-translucent` loopt
  de kop van de app mooi door onder de klok (er is al `viewportFit: "cover"` en `safe-area`). Testen op een echte
  iPhone. S.

## 6. Wat al goed is (niet opnieuw bouwen)

- Sheet: omlaag vegen met veerkracht, alleen vanaf de kop (inhoud scrollt gewoon), focus vast, Escape, `overscroll-contain`.
- Fotocarrousel met `scroll-snap`, teller, pijlen op groot scherm, kapotte foto's vallen weg.
- Zoekvak: tikfouten, aliassen, streken met eigen straal, PDOK via eigen server met terugval, aantallen per suggestie.
- Optimistische chips (`useOptimistic`) en uitgestelde lijst (`useDeferredValue`): voelt snel op een trage telefoon.
- Dichtbij zoekt meteen als locatie al is toegestaan (`navigator.permissions`).
- PWA: snelkoppelingen in het manifest, service worker met reis- en tegelcache, `ViewTransition` van lijst naar plek.
- Navigatieknop met Google, Apple Kaarten, Waze en coördinaten kopiëren; `touch-action: manipulation` tegen
  dubbeltik-vertraging.

## 7. Gevonden tegenstrijdigheid

De App Flow (§ Andere routes, "Reis plannen") zegt "volgorde slepen of Slimste volgorde". In
`app/(site)/mijn-reis/trip-app.tsx` kan je de volgorde alleen met de knoppen **Eerder in de reis** en **Later in de
reis** veranderen; slepen bestaat niet. Genoteerd als open punt 119 in [`specs/README.md`](specs/README.md). Voorstel:
U2 bouwen ná de livegang, of tot dan de App Flow aanpassen naar "volgorde met de pijltjes".

## 8. Voorgestelde volgorde

1. **Vóór de livegang, als Patrick de bevriezing hiervoor opent**: G1, G2, K1. Samen ±1 dag, geen data, geen schema,
   met e2e-test (sheet open, `page.goBack()`, sheet dicht en zelfde URL).
2. **Januari**: Z1, U1, U3, Z3, G6. Kleine dingen die terugkerende gebruikers merken.
3. **Februari**: Z2 (met tests), K2, G3, G4.
4. **Daarna, op basis van statistieken**: K3, U2, G5, Z4, reisdag-modus, share target, app-badge.
