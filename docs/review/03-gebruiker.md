# VrijStaan: review vanuit de eindgebruiker

*15 oktober 2026. Gebaseerd op de code in `web/src`, de specs in `docs/`, de offline snapshot (`web/src/data/snapshot.json`) en een echte doorloop van de app (dev-server met `VRIJSTAAN_OFFLINE=1`, Playwright/Chromium, 390×844, NL-locale, nep-locatie bij Giethoorn).*

> **Kanttekening bij de cijfers.** De live-database was vanuit de sandbox niet bereikbaar (403 via de proxy). Alle data-cijfers komen dus uit de snapshot: **680 plekken**. Volgens de PRD staan er live 1.509 gepubliceerd. Verhoudingen kunnen live dus anders liggen. Kaarttegels, websitefoto's (wsrv.nl) en de routeplanner waren in de sandbox ook niet bereikbaar. "Kaart kon niet worden geladen", lege foto's en "rijtijden niet beschikbaar" in de screenshots komen daardoor en tellen hier niet als bevinding.

---

## 1. Hoe de app nu werkt (functies per pagina)

| Pagina | Wat de gebruiker kan |
|---|---|
| **Start** `/` | Hero "Waar sta je vannacht?", zoekkaart (bestemming + keuze Alle / Zonder vertrektijd / Uitslapers), link "Of zoek plekken dichtbij mij". Daarna drie vertrouwensregels, drie vertrekkaarten met aantallen (19 / 137 / 680), populaire provincies met foto, zes uitgelichte plekken (eerst plekken zonder vertrektijd), snelknoppen (Nu open, Stroom, Lozen, Honden), "Zo werkt het" en een blok voor eigenaren. |
| **Zoeken** `/zoeken` + `/zonder-vertrektijd`, `/uitslapers`, `/overige-plekken` | Tabbladen per vertrekgroep met aantallen. Zoekbalk met suggesties (plaats, streek/eiland, provincie, plek). Filtersheet met live teller, verwijderbare chips, sortering (Aanbevolen / Afstand / Laagste prijs / Score). Lijst in blokken van 20 met "Toon meer". Zwevende knop om tussen kaart en lijst te wisselen. Bij nul resultaten voorstellen om één filter weg te halen. Alle filters staan in de URL. |
| **Plek** `/plek/[slug]` | Fotocarrousel met bron, soort, naam, adres, open-chip, "Laatste update". Kerngegevens: prijs, vertrekken, open, max. lengte. Vertrekblok, prijsblok, contactknoppen, voorzieningen (ja/nee/onbekend), beschrijving, "Hoe ver is het?" (rijtijd + "Open in navigatie"), minikaart, "x% van de gegevens bekend" + "Klopt er iets niet?", Praktisch (reserveren, plekken, toeristenbelasting, ondergrond, max. verblijf, adres), reviews + "Schrijf een review", "In de buurt". Op mobiel een vaste actiebalk: prijs, hartje, bellen, website, **Route**. |
| **Dichtbij** `/dichtbij` | Locatie vragen (of automatisch als die al is toegestaan). Tot 30 plekken binnen 80 km, gesorteerd op rijtijd. Chips: Nu open (staat standaard aan), Zonder vertrektijd, Uitslapers, zeven voorzieningen. Minikaart. |
| **Mijn reis** `/mijn-reis` | Eén reis in `localStorage`. Het hartje elders zet een plek in de reis. Per stop: nachten (1–21), omhoog/omlaag, verwijderen. "Slimste volgorde" (dichtstbijzijnde eerst), vertrekpunt = eigen locatie. Kosten: overnachtingen + brandstof + toeristenbelasting, met instelbare uitgangspunten. Delen via `?r=` (met voorbeeldscherm en Toevoegen/Vervangen), "Open route in Google Maps" (max. 9 tussenstops), kaart met route, "Reis wissen". |
| **Doe mee** `/doe-mee` | Lijst van plekken met onbekende vertrektijd (372), per provincie. Per plek: "Ik weet het" → keuze + bron ("zelf gestaan", "bord", "gebeld", "website", "eigenaar"). |
| **Plek aanmelden** `/plek-aanmelden` | Keuze "Ik ken een plek" of "Ik ben eigenaar". Naam, plaats, provincie, adres, website, telefoon, vertrekregel, prijs, plekken, open, langste camper, voorzieningen, toelichting, contact. |
| **Contact** `/contact` → `/support/[token]` | Ticket met onderwerp. De klant leest het antwoord via een persoonlijke link. |
| **Meld inhoud** `/melden` | DSA-melding met reden, URL, verklaring en een persoonlijke link. |
| **FAQ, Over ons, Reviews en ranking, juridische pagina's** | 26 FAQ's met zoekveld. Uitleg over bron en publicatiedrempel. Privacy, cookies, voorwaarden en disclaimer (bedrijfsgegevens zijn nog plaatshouders). |
| **Provinciepagina's** `/camperplaatsen/[provincie]` | SEO-pagina met aantal, gemiddelde prijs, uitgelichte plekken en "Bekijk op de kaart". |
| **PWA** | Manifest met shortcuts (Zoeken, Dichtbij, Mijn reis). Service worker (alleen in productie): app-shell, dataset `/api/places` (stale-while-revalidate), eerder bekeken pagina's (max. 80), kaarttegels (max. 1.500). Offline-balk in de header. |

---

## 2. Bevindingen per persona en reis

### Persona A: Gepensioneerd stel, integraal 8,5 m, plant vooruit (thuis op de tablet)

**Reis: Start → bestemming → filteren → plek → route**

1. **Zoeken met een typfout kiest de verkeerde plaats.** "Giethorn" geeft als eerste suggestie **Giethmen** (66 plekken) en pas daarna **Giethoorn** (44). Enter neemt de bovenste, dus de gebruiker zit ineens in Giethmen (screenshot `02-suggest.png`; URL `?waar=Giethmen`). Oorzaak: alle bijna-goede treffers krijgen rang 3 en worden daarna op aantal plekken gesorteerd, niet op spellingsafstand (`components/destination-search.tsx`, `rankOf` + `matches.sort(...)`). Voor een 55+-gebruiker die niet controleert wat er gekozen is, betekent dit een verkeerde zoekopdracht.
2. **Een getypte of gedeelde URL met een onbekende of eiland-bestemming toont alle plekken van Nederland.** `/zoeken?waar=Texel`, `?waar=Ameland` en `?waar=Amsterdam` geven allemaal **"680 plekken in Texel/Ameland/Amsterdam"** met plekken in Leek en Beekbergen bovenaan. Bekende fout (03-app-flow, "fase B"), maar die raakt precies gedeelde links, links uit fora en zoekmachines. Een gebruiker denkt dan dat er op Texel 680 plekken zijn.
3. **Filter lengte is te grof en te optimistisch.** De keuzes zijn 7/8/9/10 m (`components/filter-sheet.tsx:10`). Plekken met onbekende lengte blijven staan, en dat is 86% van de plekken (95 van 680 hebben een lengte). Het filter sluit dus bijna niets uit, terwijl het chiplabel "Camper 8 m" zekerheid suggereert. Hoogte (bomen, slagboom), gewicht (>3,5 t, belangrijk voor grote integralen) en draaicirkel/toegankelijkheid ontbreken helemaal. Forumgebruikers klagen juist dat een lengtefilter geschikte plekken onterecht uitsluit, of dat de lengte niet klopt (zie bronnen).
4. **Verdachte lengtewaarden.** 33 plekken hebben "max. 6 m" en 6 plekken "5 m", vaak grote campings (De Lange Paal, De Bosgraaf). Waarschijnlijk is dat de breedte van een staanplaats of een maat voor iets anders. Voor de 8,5 m-camper betekent dit onterecht "past niet".
5. **"100% van de gegevens bekend" terwijl er vier keer "Onbekend" staat.** Bij Camperplaats Giethmen staan vertrektijd, max. lengte, reserveren en ondergrond allemaal op onbekend, en toch staat er "100% van de gegevens bekend" (`plek/[slug]/page.tsx:373`). `completeness` is een gewogen publicatiescore, geen dekking van wat de gebruiker ziet. Dat ondermijnt het vertrouwen dat de site juist wil winnen.
6. **"Maximaal verblijf" staat altijd op Onbekend.** `maxStayNights` komt in de snapshot nergens voor, maar de regel staat op elke plekpagina (`page.tsx:249`). Hetzelfde geldt grotendeels voor Ondergrond (91% onbekend). Rijen die altijd leeg zijn maken de pagina langer en wekken de indruk van slordigheid. Toon ze alleen als ze gevuld zijn, of vat ze samen ("Nog onbekend: ondergrond, max. verblijf").
7. **Prijs: wat betaal je met z'n tweeën?** De kaart toont "vanaf € 5 per nacht" (bijv. Boerderij Hazenveld: vanaf € 5, hoogste € 31). Bij campings is dat vaak een prijs per persoon of buiten het seizoen. "Laagste prijs" sorteert op dit vanaf-bedrag (`lib/search.ts:248`), dus de goedkoopste lijken vaak goedkoper dan ze zijn. Camperaars denken in "camper + 2 personen + stroom + toeristenbelasting". **`priceExtras` ontbreekt in de hele snapshot**, terwijl de startpagina belooft: "Prijzen met toeristenbelasting, stroom en andere bijkomende kosten" (`page.tsx`, vertrouwensregel 2). Offline wordt die belofte dus nergens waargemaakt. Toeristenbelasting is voor 64% onbekend.
8. **Verdachte prijzen.** "Camperplaats Diekmanstadion € 1,60" (waarschijnlijk een uurtarief voor parkeren), "Oensels Fruitweike € 75", "Aspergeboerderij Oppe Haes € 45". Daar ontbreekt een sanity-check.
9. **Route openen gaat alleen via Google Maps** (`lib/geo.ts directionsUrl`, `trip-app.tsx` gmaps). Er is geen keuze voor Apple Kaarten, Waze, TomTom/Garmin-camper of het delen van coördinaten. Ook de rijtijd wordt berekend met het profiel `driving-car` (`lib/routing.ts:40`), niet met `driving-hgv` en voertuigmaten, terwijl `docs/onderzoek.md` dat wel noemt. Voor een grote camper is "echte rijtijd" daardoor optimistisch en kan de route door smalle dorpsstraten gaan.
10. **Mijn reis is één lijst zonder datums.** Je kunt geen aankomstdatum invullen, dus er komt ook geen waarschuwing als een stop in die periode dicht is (PRD noemt dit "Could, fase B"). Je kunt maar één reis hebben, zonder naam. Er is geen eindpunt of terugreis naar huis. Het hartje betekent "bewaren" én "stop in mijn reis" tegelijk (`store.ts toggle`). Wie 15 kandidaten bewaart, krijgt een reis met 15 stops en een routeberekening.
11. **Positief:** het beslispaneel is helder (kerngegevens in 2×2, vertrekblok, "Bel even voor je gaat"). De legenda voor de bordjes werkt, de actiebalk onderin is goed bereikbaar met de duim, en grote knoppen (≥44 px) passen bij de 55+-doelgroep.

### Persona B: Jong stel met buscamper, zoekt om 20:30 een plek voor vannacht (telefoon, slecht bereik)

**Reis: Dichtbij → kiezen → route**

1. **Dichtbij werkt snel en logisch.** Locatie wordt automatisch opgehaald als die eerder is toegestaan, de chips voor vertrek en voorzieningen staan bovenaan en "Nu open" staat standaard aan.
2. **"Nu open" zegt niets over vannacht.** Het filter kijkt alleen naar het seizoen. Er is geen informatie over **aankomst tot hoe laat**, receptie- of slagboomtijden (`accessHours` ontbreekt in de snapshot, `access24h` is bij 12 plekken bekend) of **zelf inchecken**. Om 20:30 is dat de belangrijkste vraag. Van 445 plekken is ook de aankomsttijd (`checkinFrom`) onbekend. Wens: een chip "Laat aankomen kan" / "24 uur toegankelijk".
3. **Geen informatie over vol of druk.** Geen aantal vrije plekken, geen "vaak vol in juli" en geen "reserveren nodig". Reserveren is voor 48% onbekend. Forumgebruikers noemen "weten dat er plek is voordat je erheen rijdt" expliciet (bron 1).
4. **Weinig echt vrije plekken.** De kernbelofte geldt voor **19 van 680 plekken (2,8%)**. In de buurt van Giethoorn gaf "Zonder vertrektijd" 1 resultaat. De jonge spontane camperaar die "vrij staan" leest, komt vaak bij een lege lijst uit. Het lege-resultatenscherm doet terecht voorstellen ("Bekijk uitslapers").
5. **Gratis plekken en camperparkeerplaatsen ontbreken bijna.** Er zijn 4 gratis plekken, en soort "parkeerplaats" (camperparkeerplaats) heeft 0 plekken, terwijl die soort wel als filterknop staat (`filter-sheet.tsx:197`, `types.ts KIND_LABEL`). Voor deze persona, die gewend is aan park4night, is dat de kerncategorie. De filterknop "Camperparkeerplaats" geeft altijd 0.
6. **Grotendeels campings.** 403 van de 680 plekken (59%) zijn campings, 200 zijn camperplaatsen. De site noemt alles "camperplaatsen" (hero: "680 camperplaatsen in Nederland"). Een buscamperaar die een camperplaats zoekt, voelt zich misleid als het een camping met receptietijden blijkt te zijn.
7. **Offline onderweg.** Een plekpagina is alleen offline beschikbaar als je hem eerder hebt geopend. **Bewaren zet de plekpagina niet in de cache** (`public/sw.js` cachet alleen bezochte navigaties). Een onbekende pagina valt offline terug op `/mijn-reis` (`sw.js`, laatste `catch`), zonder uitleg waarom je daar uitkomt. Bovendien registreert de service worker alleen in productie (`chrome.tsx:168`), dus testen in dev zegt niets.
8. **Hemelsbrede afstand als terugval** wordt eerlijk gemeld ("Rijtijden zijn even niet beschikbaar"). Goed.
9. **Terminologie:** "Lozen", "Water innemen" en "Uitslapers" zijn herkenbaar. "Uitslapers" als naam voor een vertrektijd van 12:00 is grappig, maar 12:00 is bij campings gewoon de norm (130 van 289 vaste tijden zijn precies 12:00). "Voor uitslapers" belooft meer dan het is.

### Persona C: Gezin met kinderen, zomervakantie, camper van 7 m + hond

1. **Ontbrekende filters en velden:** kindvriendelijk (speeltuin, zwembad), afstand tot strand/centrum/supermarkt, schaduw, rust/geluid, en of er een aparte camperplek op de camping is. Hond: 31% onbekend, en er is geen info over toeslag of aanlijnplicht.
2. **Kosten van de reis kloppen niet voor een gezin.** "Personen" telt alleen mee voor de toeristenbelasting (`trip-app.tsx:174`). De nachtprijs blijft het vanaf-bedrag per plek, ook bij 4 personen en een hond. Het totaal ("Totaal met jouw schatting") is daardoor structureel te laag. Toeristenbelasting gebruikt een vaste € 1,50 p.p. terwijl gemeenten verschillen. Kinderen tellen niet anders.
3. **Reviews: 0 in de hele dataset.** Er zijn geen deelscores voor kinderen of sanitair en er kunnen geen foto's bij een review. Het reviewformulier is verder goed (cijfer 1–10, deelscores, maand, voertuig). Optie "Caravan" bij voertuig is vreemd voor een campergids. Er ontbreken opties als "Integraal / Halfintegraal / Alkoof / Buscamper / Camper met aanhanger".
4. **Seizoen:** "Open t/m 2 november" staat er goed. Maar 35% van de plekken heeft geen bekende openingsperiode. Voor de zomer maakt dat minder uit.

### Persona D: Duitse of Belgische toerist

1. **Alles is Nederlandstalig** (PRD: EN/DE "Could, fase C"). Duitsers zijn de grootste buitenlandse groep camperaars in NL. Zonder Duits zijn "Lozen", "Uitslapers", "Toeristenbelasting komt bij de prijs" en "Vertrek uiterlijk" onbegrijpelijk. De bordjes/iconen helpen, maar de kernbelofte (vertrektijd) is tekst.
2. **Zoeken op bekende toeristische plaatsen:** Amsterdam heeft 1 plek, Texel staat niet in de woonplaatsenlijst (alleen via de streek-suggestie) en Ameland/Terschelling/Vlieland hebben 0 plekken in de snapshot. Typen ze de naam en drukken ze op Enter of volgen ze een link, dan krijgen ze alle 680 plekken (zie A2).
3. **Belgen/Duitsers verwachten Campercontact/park4night-iconen en de termen "Stellplatz" en "Ver- und Entsorgung".** Een simpele taalkeuze voor de vaste labels (voorzieningen, vertrekregel, prijsregel) levert al veel op.

### Persona E: Eigenaar of beheerder van een camperplaats

1. **Aanmelden en corrigeren kan via twee routes** ("Klopt er iets niet?" met vinkje "Ik ben de eigenaar", of `/plek-aanmelden?soort=eigenaar`). Daarna zie je niets meer: je krijgt geen ticketlink (in tegenstelling tot Contact en Melden), geen status en geen bevestigingsmail. "Meestal binnen twee werkdagen" valt niet te controleren.
2. **Geen eigen beheer.** Er is geen account of link waarmee de eigenaar zelf tarieven, toeslagen, vertrektijd, foto's en "vol"-status bijwerkt. Voor actuele data is dat de krachtigste bron. Het correctieformulier is één tekstvak. Toeslagen (stroom per kWh, per persoon, hond) kun je niet gestructureerd invullen. In `/plek-aanmelden` ontbreken velden voor toeslagen, honden, ondergrond, hoogte, aankomsttijden en slagboom.
3. **Foto's:** websitefoto's worden zonder toestemming getoond via hotlink/proxy (wsrv.nl), met verwijdering op verzoek. Sommige eigenaren zullen dat ervaren als "mijn foto's staan zonder te vragen op een andere site". Er is geen uploadmogelijkheid (fase B).
4. **Mobiele header mist "+ Plek aanmelden"**, terwijl `03-app-flow.md` ("Header: … + naar Plek aanmelden") dat beschrijft. Op mobiel staat alleen "?" (`chrome.tsx:93`). Aanmelden is alleen te vinden in de footer of onderaan de startpagina.
5. **Juridische pagina's tonen plaatshouders** als "[Naam onderneming nog invullen]" en "[KvK-nummer nog invullen]" (`lib/company.ts`). Voor een eigenaar die gegevens moet afstaan, en voor elke bezoeker, oogt dat onbetrouwbaar. Dit moet vóór livegang opgelost zijn.

### Overkoepelend: installeren, vertrouwen en eerste indruk

- **Cookiebanner** bedekt bij het eerste bezoek de zoekkaart op 390 px bijna helemaal (`01b-banner.png`). De keuzes wegen even zwaar, dat is netjes, maar de banner valt over de kernactie. De FAQ zegt bovendien "Gebruiken jullie cookies? Nee", terwijl de banner "Cookies en statistieken" heet. Dat verwart.
- **Installeren:** er is geen prompt of knop in de UI, alleen een FAQ-antwoord. Een korte "Zet op je beginscherm"-kaart in Mijn reis of na de tweede bewaarde plek helpt de 55+-doelgroep, zeker op iOS.
- **"Laatste update: 11 oktober 2026"** staat op elke plek (alle `updatedAt` liggen op dezelfde ochtend). Dat is de datum van de pipeline-run, niet van een controle. Bij elke plek dezelfde datum maakt het label betekenisloos. Toon per veld of per bron: "Vertrektijd: website, gecontroleerd 11-10" of "Gemeld door camperaar, 3 dagen geleden".
- **Third-party verzoeken:** foto's lopen via wsrv.nl en tegels via OpenFreeMap. Dat is netjes vermeld in privacy en cookies, maar botst met de vaste regel "geen tracking van derden" in de beleving van privacybewuste gebruikers. Het is geen tracking, wel een gegevensstroom.
- **"0 m hemelsbreed"** op de kaart van de plek die zelf het zoekmiddelpunt is (`05-filtered.png`) is een detail, maar oogt vreemd.

---

## 3. Inhoudsanalyse van de data (snapshot, 680 plekken)

### Soorten en spreiding

| Soort | Aantal | Aandeel |
|---|---|---|
| Camping | 403 | 59% |
| Camperplaats | 200 | 29% |
| Boerderij | 54 | 8% |
| Jachthaven | 23 | 3% |
| Camperparkeerplaats | **0** | 0% |

| Provincie | Plekken | Vertrek bekend | Waarvan vrij/24u | Prijs bekend | Foto | Max. lengte | Honden bekend |
|---|---|---|---|---|---|---|---|
| Gelderland | 118 | 53% | 4 | 68% | 92% | 15% | 72% |
| Overijssel | 101 | 45% | 2 | 74% | 97% | 8% | 66% |
| Noord-Brabant | 69 | 48% | 1 | 67% | 94% | 10% | 78% |
| Friesland | 68 | 31% | 1 | 68% | 99% | 19% | 69% |
| Zeeland | 63 | 54% | 3 | 52% | 98% | 16% | 75% |
| Limburg | 56 | 52% | 3 | 70% | 98% | 9% | 54% |
| Drenthe | 54 | 43% | 0 | 59% | 94% | 17% | 72% |
| Noord-Holland | 49 | 35% | 0 | 65% | 92% | 8% | 57% |
| Zuid-Holland | 38 | 58% | 2 | 61% | 100% | 26% | 79% |
| Groningen | 30 | 20% | 2 | 93% | 93% | 13% | 73% |
| Flevoland | 19 | 58% | 0 | 74% | 89% | 21% | 68% |
| Utrecht | 15 | 33% | 1 | 67% | 87% | 20% | 80% |

Opvallend: **Utrecht (15)** en **Flevoland (19)** zijn erg dun. Op de **Waddeneilanden** staat 0 tot een handvol plekken (Den Burg 8, De Cocksdorp 1, Ameland/Terschelling/Vlieland/Schiermonnikoog 0), terwijl daar veel naar gezocht wordt.

### Dekking per veld

| Veld | Bekend | Toelichting |
|---|---|---|
| **Vertrekregel** | 308 (45%) | vast 289, **vrij 18, per 24 uur 1 (2,8%)**, onbekend 372 |
| Vertrektijd (vast) | 289 | 12:00 → 130; 11:00 → 107; 11:30 → 12; 10:00 → 25; 14:00 → 5; 08:00 → 3 (verdacht) |
| Aankomsttijd | 235 (35%) | |
| Slagboom/toegang | `access24h` 12, `accessHours` 0 | Cruciaal voor laat aankomen |
| **Prijs** | 458 (67%) | mediaan € 16, 4× gratis, uitschieters € 1,60 en € 75 |
| Prijsnotitie (vanaf/hoogste) | 179 | |
| **Toeslagen (`priceExtras`)** | **0** | Veld zit niet in de snapshot |
| Toeristenbelasting in de prijs | 248 (36%) | |
| Seizoen of hele jaar open | 443 (65%) | |
| Stroom | 677 (99,6%) | 597 ja; stroomprijs en ampère onbekend |
| Water | 554 (81%) | |
| Lozen | 524 (77%) | geen onderscheid tussen grijs en zwart (cassette) water |
| Toilet / Douche | 98% / 94% | |
| Wifi | 655 (96%) | **570 "ja" (84%)**, verdacht hoog voor camperplaatsen |
| Honden | 474 (70%) | |
| Aantal plekken | 405 (60%) | |
| Reserveren | 356 (52%) | |
| **Max. lengte** | **95 (14%)** | 39 waarden ≤ 6 m, verdacht |
| **Ondergrond** | **62 (9%)** | gras 29, verhard 19, grind 14 |
| Max. verblijf | **0** | Wel als rij op elke plekpagina |
| Hoogte / gewicht / vlak / schaduw | — | Bestaat niet in het model |
| Adres (straat) | 376 (55%) | |
| Telefoon / e-mail / website | 86% / 87% / 99,9% | |
| Beschrijving | 505 (74%) | 495 van de website, mediaan ±130 tekens |
| **Foto's** | 647 (95%) met ≥ 1 | **100% websitefoto's** (4.263), 0 Wikimedia, 0 eigen/gebruiker |
| **Reviews** | **0** | `ratingCount` is overal 0 |
| Laatste update | 100% | Allemaal 11-10-2026 tussen 07:57 en 11:17 (pipeline-run) |

### Kwaliteit van de kernfeiten

- **Alle vier de beslisfeiten** (vertrek, open, stroom, prijs) zijn bekend bij 143 plekken (21%). Drie van vier: 285. Twee: 208. **Minder dan twee: 44 plekken**, terwijl de publicatieregel "minstens twee van de vier" zegt. Dat moet nagekeken worden: is het een verschil tussen de snapshot en de live-regel?
- **Bruikbaar voor een beslissing** (vertrek + prijs + foto + honden bekend): 145 plekken (21%).
- PRD-doelen versus snapshot: vertrekregel bekend 45% (doel 40%, gehaald); vrij of 24 uur **19** (doel 150); prijs 67% (doel 75%); reviews **0** (doel 200).

### Wat inhoudelijk ontbreekt (vergeleken met wat camperaars gewend zijn)

| Wens | park4night | Campercontact | ACSI | Searchforsites | VrijStaan |
|---|---|---|---|---|---|
| Veel gebruikersreviews en -foto's | ✔✔ | ✔✔ | ✔ | ✔ | ✘ (0) |
| Camperparkeerplaatsen / gratis / "dag en nacht parkeren" | ✔✔ | ✔ | — | ✔✔ | ✘ (0 / 4) |
| Offline volledige dataset | betaald | Pro | ✔ (landenpakket) | ✔ | deels (alleen eerder bezochte pagina's) |
| Reisplanner met meerdere stops | betaald | ✔ | ✔ | — | ✔ (één reis, geen datums) |
| Favorietenmappen | betaald | ✔ | ✔ | ✔ | ✘ (bewaren = reis) |
| Vertrektijd als filter | ✘ | ✘ | ✘ | ✘ | **✔ (uniek)** |
| Prijs inclusief toeslagen | vrije tekst | deels | ✔ (gecontroleerd) | vrije tekst | belofte, data ontbreekt |
| Inspecteur of geverifieerde data | ✘ | deels | ✔ | ✘ | scraper (bron niet per veld zichtbaar) |
| Meerdere talen | ✔ | ✔ | ✔ | EN | ✘ |
| Advertenties / betaalmuur | ✔ (klacht) | Pro (klacht) | abonnement | klein bedrag | **gratis, geen ads (sterk punt)** |

---

## 4. Gebruikerswensen, geprioriteerd

### Must (vóór of direct na livegang)

1. **Zoekfouten oplossen.** Bij de suggesties gaat spellingsafstand vóór het aantal plekken (Giethoorn boven Giethmen). Een onbekende of eiland-bestemming in de URL resolven of "niet gevonden" tonen, in plaats van "680 plekken in Texel". *Onderbouwing:* zoeken is de eerste stap van elke reis, en gedeelde links en SEO-links komen precies hier binnen.
2. **Eerlijke volledigheid en actualiteit.** Vervang "x% van de gegevens bekend" door een telling die klopt met wat de gebruiker ziet ("7 van 12 punten bekend; onbekend: vertrektijd, lengte, …"). Toon bron en datum per kernfeit (vertrektijd, prijs) in plaats van één pipeline-datum. *Onderbouwing:* vertrouwen is een PRD-doel, en "100%" naast vier keer "Onbekend" breekt dat.
3. **Prijs zoals camperaars rekenen.** Laat toeslagen echt zien (`priceExtras` in de dataset en de snapshot), toon "camper + 2 personen" als standaardprijs of maak het verschil duidelijk ("vanaf, per persoon?"), en voeg een sanity-check toe op uitschieters. Neem in Mijn reis personen, hond en stroom mee in de nachtprijs. *Onderbouwing:* de startpagina belooft het, het is een kernfunctie in de PRD, en 32% van de NKC-respondenten klaagt over onvolledige info.
4. **Aankomen 's avonds.** Toon aankomsttijd, slagboom- en receptietijden en "24 uur toegankelijk / zelf inchecken" op de kaart en als chip in Dichtbij. *Onderbouwing:* de primaire persona zoekt "laat op de dag" (PRD), en "Nu open" beantwoordt die vraag niet.
5. **Bedrijfsgegevens invullen en plaatshouders weghalen** uit voorwaarden, privacy en disclaimer. Bevestig eigenaarsmeldingen met een ticketlink of statuslink. *Onderbouwing:* basisvertrouwen en wettelijke informatieplicht.
6. **Lengtefilter betrouwbaar maken.** Markeer of verwijder verdachte waarden ≤ 6 m bij campings. Zeg in het chiplabel eerlijk "Camper 8 m (lengte bij 14% bekend)". Laat de gebruiker "alleen plekken waarvan bekend is dat ik pas" kiezen. *Onderbouwing:* user story in de PRD, en forumklachten over onterecht uitgesloten plekken.
7. **Lege categorieën verbergen** (filter Camperparkeerplaats = 0) en de "Maximaal verblijf"-rij tonen alleen als die gevuld is. *Onderbouwing:* knoppen die altijd 0 geven of rijen die altijd leeg zijn, kosten vertrouwen.

### Should (eerste maanden na livegang)

8. **Meer "vrij staan"-plekken en camperparkeerplaatsen.** OSM `amenity=parking + motorhome=designated` en gemeentelijke camperplaatsen gericht ophalen, "per 24 uur"-plekken (vaak automaten) herkennen, en Doe mee actief inzetten (372 open plekken). *Onderbouwing:* de kernbelofte geldt nu voor 2,8% van de plekken (doel 150), en concurrenten zijn sterk in juist deze categorie.
9. **Reviews op gang brengen.** Vraag een review na het bewaren of bezoeken van een plek ("Ben je er geweest?"). Snelle feedback met één tik: "Vertrektijd klopt / klopt niet", "Er was plek / vol". Review met foto. *Onderbouwing:* 0 reviews, PRD-doel 200, en reviews zijn de reden dat mensen park4night gebruiken.
10. **Offline écht maken.** Bij het bewaren de plekpagina in de cache zetten. Een knop "Download plekken voor offline" (de dataset is al gecachet). Geen stille terugval naar `/mijn-reis`, maar een offline-pagina met uitleg. *Onderbouwing:* PRD-user story, en ACSI en Searchforsites bieden dit standaard.
11. **Bewaren en reis scheiden** (favorieten/lijstjes en een of meer reizen met naam), plus **datums per stop** met een waarschuwing "op 3 november gesloten". *Onderbouwing:* de vooruitplanner (persona A) en concurrenten (favorietenmappen).
12. **Navigatiekeuze** (Google, Apple, Waze, coördinaten kopiëren) en een routeprofiel voor campers (`driving-hgv` met lengte en hoogte uit de reisinstellingen). *Onderbouwing:* veel camperaars gebruiken een camper-navigatiesysteem, en de rijtijd voor een grote camper klopt nu niet.
13. **Eigenaarsportaal light:** een magische link per plek waarmee de eigenaar tarieven, toeslagen, vertrektijd, foto's (met toestemming) en "tijdelijk vol of gesloten" bijwerkt. *Onderbouwing:* de meest betrouwbare databron, en het lost ook het fotorechtenvraagstuk op.
14. **Extra velden en filters:** hoogte, gewicht > 3,5 t, ondergrond en vlak, stroomprijs en ampère, lozen grijs/cassette apart, rust en afstand tot centrum of winkels, kindvriendelijk. *Onderbouwing:* de volgorde in `docs/onderzoek.md` (punten 5–6) en de gezinspersona.
15. **Installatie-uitnodiging in de UI** (iOS-uitleg met plaatje) en de cookiebanner compacter op mobiel, onderaan, zonder de zoekkaart te bedekken.

### Nice to have

16. **Duits en Engels** voor de vaste labels en de kernregels (vertrek, prijs, voorzieningen); later volledige pagina's.
17. **Drukte-indicatie** ("vaak vol in juli/augustus", op basis van reviews en meldingen) en een melding "nu vol" die na 24 uur vervalt.
18. **Plekken langs je route** (corridor-zoeken tussen A en B) in Mijn reis.
19. **"Uitslapers" herdefiniëren of nuanceren:** 12:00 is de standaard bij campings. Overweeg "Vertrek 13:00 of later" of een tijd-slider.
20. **Detailpolish:** geen "0 m hemelsbreed" bij de plek zelf, voertuigopties in reviews afgestemd op campers, de FAQ over cookies laten aansluiten bij de banner, de mobiele header met "+" zoals de app-flow beschrijft.

---

## Bronnen (gebruikerswensen en concurrenten)

- Camperforum: [Het boeken van campings en camperplaatsen](https://camperforum.nl/viewtopic.php?p=2379733), [vervolg](https://camperforum.nl/viewtopic.php?p=2379187), [vervolg](https://camperforum.nl/viewtopic.php?p=2379173), [vervolg](https://camperforum.nl/viewtopic.php?p=2379726): lengtefilter sluit onterecht uit, wil weten of er plek is
- Camperforum: [Hoe vrij staan plekje vinden?](https://camperforum.nl/viewtopic.php?p=2249715), [Ervaringen met Camping Car Park](https://camperforum.nl/viewtopic.php?p=2366930), [vervolg](https://camperforum.nl/viewtopic.php?p=2366548), [vervolg](https://camperforum.nl/viewtopic.php?p=2371078), [vervolg](https://camperforum.nl/viewtopic.php?p=2371240): filter "dag en nacht parkeren", reviews lezen
- Camperforum over Campercontact: [App-problemen](https://camperforum.nl/viewtopic.php?p=1399873), [vervolg](https://camperforum.nl/viewtopic.php?p=1399874), [vervolg](https://camperforum.nl/viewtopic.php?p=1399914), [reviews maar een paar zichtbaar](https://camperforum.nl/viewtopic.php?p=2382161), [vervolg](https://camperforum.nl/viewtopic.php?p=2382120), [overig](https://camperforum.nl/viewtopic.php?p=2270780), [overig](https://camperforum.nl/viewtopic.php?p=2270792), [overig](https://camperforum.nl/viewtopic.php?p=2325232), [overig](https://camperforum.nl/viewtopic.php?p=2325273)
- park4night: [App Store](https://apps.apple.com/app/id430946556), [AppFollow](https://apps.appfollow.io/ios/park4night/430946556?country=us), [AppFollow (AE)](https://apps.appfollow.io/ios/park4night/430946556?country=ae), [App Store (KR)](https://apps.apple.com/kr/app/app/id430946556), [Trustpilot](https://au.trustpilot.com/review/park4night.com), [mwm.ai-samenvatting](https://mwm.ai/Pictures/apps/park4night/430946556), [Cafe Bazaar](https://cafebazaar.ir/app/fr.tramb.park4night?l=en), [Yandex-review](https://portal.yandex.com.tr/yaozet/how_to/park4night-van-parking-app-review-jgUboOzF), [OpenVan](https://openvan.camp/en/news/lifestyle/park4night-onmisbare-app-voor-je-reis-met-de): klachten over advertenties, betaalmuur en bugs; betaalde functies offline, meerdere stops, favorietenmappen
- ACSI: [ACSI Campsites Europe](https://apps.apple.com/app/id949457901), [AppFollow DE](https://apps.appfollow.io/ios/acsi-camping-eu-campingplatze/949457901?country=de), [Similarweb](https://www.similarweb.com/app/apple/949457901), [Similarweb DE](https://similarweb.com/de/app/apple/633972355), [CampingCard ACSI](https://apps.apple.com/DE/app/id949457505), [AppFollow](https://apps.appfollow.io/ios/campingcard-acsi/949457505?country=us), [mwm.ai](https://spark.mwm.ai/us/apps/campingcard-acsi/949457505), [mwm.ai KR](https://spark.mwm.ai/kr/apps/campingcard-acsi/949457505), [camperstyle.de](https://camperstyle.de/?p=252489): offline met landenpakketten, abonnement, gecontroleerde data

*Screenshots van de doorloop (390 px):* lokaal gemaakt tijdens de review, niet in de repo *(o.a. `02-suggest.png`, `01b-banner.png`, `04-filters.png`, `05-filtered.png`, `07b-place-top.png`, `12b-reis.png`).*
