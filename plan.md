# VrijStaan: plan UX-audit "volwassen maken" (27 november 2026)

Eén plan uit twee bronnen, gelegd naast de code op `main` (8422374), de specs, de stijlgids en de besluiten in
`docs/specs/README.md` (vooral 141, 142 en 144):

- **Plan A**: opdracht *Volledige UX-, UI-, informatiearchitectuur- en workflow-audit* (74 punten, Claude-brief).
- **Plan B**: *VrijStaan 2027* van ChatGPT (57 hoofdstukken, taken T01–T70).

Het vorige plan (23 oktober) staat in [`docs/archief/plan-2026-10-23.md`](docs/archief/plan-2026-10-23.md).

Status: ✅ klaar · 🔄 bezig · ⬜ open · 👤 alleen Patrick.

---

## 1. Kern van de analyse

**Een groot deel van beide plannen staat al in de site.** Dat komt door de ronden van 26 november (UI/UX-plan
T1–T50, README 142; plekpagina-ronde, README 144; design-audit #200; ontwerpronde 2 C2–C4). Plan B zag alleen
screenshots en beschrijft daardoor een aantal dingen als werk die er al zijn (zie §3). Die bouwen we niet opnieuw.

Beide plannen zijn het eens over het overgebleven probleem: **de plekpagina geeft te veel dingen hetzelfde
gewicht**. Waarnemingen op screenshots van de offline build (390 × 844 en 1440 × 900, 27 november):

| # | Waarneming | Waar |
|---|---|---|
| W1 | **Desktop: vertrektijd onder de vouw.** Foto 1104 × 470 px; op 1440 × 900 zie je naam en "Nog geen reviews", niet het beslisblok | `Gallery`, `page.tsx` |
| W2 | Beslisblok 2×2 met vier even grote vakken; Reserveren pas onderaan Goed om te weten | `decision-grid.tsx` |
| W3 | Telefoon: vier gelijke tegels (Bewaar, Delen, Website, Bellen) direct onder het beslisblok, plus de vaste balk met Route | `ActionRow` |
| W4 | Desktop: "Reserveren via de website" is een gevulde bosgroene knop; Route staat lager onder de kaart | `PriceCard`, `RouteCard` |
| W5 | Kop op de plekpagina (telefoon): terug, logo, +, ⋯, Inloggen | `chrome.tsx` |
| W6 | "Nog geen reviews" bovenaan elke plek (live: 0 reviews) | kop `page.tsx` |
| W7 | "Check voor vertrek" herhaalt vertrek, prijs en reserveren | `CheckVoorVertrek` |
| W8 | Help-blok: "7 van 12 gegevens bekend. Nog onbekend: …" en tot zes acties | `HelpBlock` |
| W9 | "Mogelijk verouderd" in rood met waarschuwingsicoon | `OutdatedNote` |
| W10 | Ervaringen vóór Over deze plek; hoogte, gewicht en lengte verspreid over Goed om te weten en Praktisch | `page.tsx` |
| W11 | Correctieformulier: één `select` met 8 onderwerpen; Reserveren, Aankomst en Foto ontbreken | `ReportProblem` |
| W12 | Teksten verwijzen naar de knop "Klopt er iets niet?", die niet meer bestaat; "Bedankt!" met uitroepteken | voorwaarden, melden, disclaimer, review-sheet |
| W13 | Cookiebalk + vaste Route-balk samen ±170 px over de inhoud bij het eerste bezoek | `cookie-banner.tsx` |
| W14 | "1 van 300" als volle-breedtekaart boven de foto op desktop | `ResultsNav` |
| W15 | Springlinks (Overzicht, Voorzieningen, …) plakken op de telefoon bovenaan: ±56 px vaste ruimte | `section-nav.tsx` |
| W16 | Prijs staat drie keer: beslisblok, vaste balk en (tablet/desktop) prijskaart | `page.tsx` |

## 2. Plan A en plan B vergeleken

### 2a. Waar ze hetzelfde zeggen (overgenomen)
Beslisblok met vertrek eerst en prijs daarna; één centrale correctieknop met uitzondering voor de vertrektijd;
reserveren eerst uitleggen, dan de externe link; één primaire actie (Route); onbekend is geen fout; mogelijk verouderd
niet rood; reviews lager; kop met minder iconen; vaste termen voor acties; kaart → preview → plek; Dichtbij met
rijtijd; Mijn reis met volgende stop; Doe mee met twee doelen; Plek aanmelden in stappen; huisstijl blijft.

### 2b. Alleen in plan B, en waardevol (overgenomen)
| Plan B | Wat we doen |
|---|---|
| §8, T10: springlinks weg op mobiel | **Overgenomen** (D9). Duidelijke sectiekoppen zijn genoeg, en zo komt het beslisblok hoger |
| §7: vaste balk niet dubbel | **Overgenomen, aangepast** (D4): Route blijft altijd staan, de prijs verschijnt pas in de balk als het beslisblok uit beeld is |
| §4.4, T07: voorzieningen en geschiktheid samen | **Overgenomen** (D8): lengte, hoogte, gewicht, ondergrond en betalen bij Voorzieningen als "Past je camper?" |
| T56: statuscopy-matrix | **Overgenomen** in G1: één tabel voor onbekend, mogelijk verouderd, dicht en in behandeling |
| §28, §51: 320 en 820 px testen, vragen per screenshot | **Overgenomen** in H2 |
| §52: scorecard per release | **Overgenomen** in I1 (`SCREENSHOT-QA.md`) |
| §53: zes begeleide gebruikerstests | **Overgenomen als 👤-spoor** (P1): Patrick in de testweek, scenario's uit plan B §53 en plan A §64 |
| §40: 65+ als stresstest | **Overgenomen** in de QA-vragen |

### 2c. Staat er al (niet opnieuw bouwen)
| Plan B | Waar het al zit |
|---|---|
| T17 clustering | `place-map.tsx` (groepen met aantallen) |
| T18 Zoek in dit gebied | sinds 0.9.1 |
| T19, T59 lijst + kaart naast elkaar op desktop, selectie gekoppeld | `search-app.tsx`, `MapPick` |
| §23 "Met filters: Gratis, Texel, Stroom" | `destination-search.tsx` |
| §24 geen resultaten met voorstellen en aantallen | `nearbySuggestions` (Dichtbij) en zoekpagina |
| T21–T24 Mijn reis volgende stop, kosten "€ 84 + 2 onbekend", statistieken lager | ontwerpronde 2 C2 |
| T25 volgorde zonder slepen | knoppen "Eerder/Later in de reis" in `stop-list.tsx` |
| §20 geen tekening als er geen foto is | `PlacePhoto`: rustig vlak met soort plek |
| T13 filtersheet met "Toon n plekken" en vaste volgorde | C4 |
| §31 compacte footer op taakpagina's | `footer.tsx` |

### 2d. Verschillen: opties en mijn keuze
| # | Onderwerp | Optie A | Optie B | **Gekozen** | Waarom |
|---|---|---|---|---|---|
| K1 | Knoptekst route | "Route openen" (A en B) | "Route" (nu) | **Route openen**, overal | Beide plannen; de balk is breed genoeg; één werkwoord per actie |
| K2 | Knoptekst website | "Website openen" (A) | "Naar de website" (B, nu deels) | **Naar de website** + domein klein eronder | Zegt waar je heen gaat (B §6); sluit aan op wat er staat |
| K3 | Correctieknop | "Gegevens corrigeren of aanvullen" (A, V4) | "Gegevens corrigeren" (B) | **Gegevens corrigeren of aanvullen** | Jouw besluit V4; aanvullen is de helft van de meldingen |
| K4 | Vaste balk | altijd prijs + Route (nu) | pas tonen na 1 scherm (B §7) | **Route altijd, prijs pas als het beslisblok uit beeld is** | Zonder actierij is de balk de enige Route op de telefoon, dus die moet er meteen zijn; de prijs dubbel tonen hoeft niet |
| K5 | Snelle chips Zoeken | Zonder vertrektijd, 12:00+, Nu open, Voorzieningen (nu, T13) | + Stroom en Lozen als chip (B §10) | **Zo laten** | Pas gisteren besloten; geen gebruiksdata die iets anders zegt (A §15: geen chip per veld) |
| K6 | Start: wat eerst | Dichtbij-knop, dan zoekveld (nu, brief) | zoekveld eerst (B §9) | **Zo laten** | Beide staan al boven de vouw; avondzonknop is een vast besluit in de brief |
| K7 | Component-API's | alles nu: Button, Status, DataRow, Section, Card (B T38–T42) | alleen wat de plekpagina nodig heeft | **Alleen `DecisionSummary`, `DataRow` en één status voor onbekend/verouderd** | Bevriezing 19 december; een grote refactor raakt elke pagina en de e2e. De rest na de livegang |
| K8 | Analytics-events (B §54) | nu bouwen | na de livegang | **Na de livegang** | Geen tracking van derden; eerst toestemming en meting op productie (LANCERING 3.3) |
| K9 | Rapporten | in de root (A §69) | – | **`docs/review/`** | Zoals de eerdere reviews |
| K10 | "vanaf € 18" (B §4.6: niet zonder context) | uitleggen | bestaande prijslogica | **Bestaande logica** | A §5.4: de datalogica voor prijzen is leidend; "vanaf" komt uit de bron |

## 3. Matrix behouden / versimpelen / herstructureren / herbouwen

| Onderdeel | Oordeel | Toelichting |
|---|---|---|
| Huisstijl, tokens, Geist, kleuren, kaartstijl | **Niet aanraken** | Vast (brief, stijlgids, besluit 75); beide plannen |
| Startpagina | **Behouden** | Propositie zoals A §22 en B §9; #200 maakte hem rustiger |
| Zoeken: rij, chips, filtersheet, desktop lijst + kaart | **Behouden** | §2c |
| Kaart: stippen, groepen, paneel, Zoek in dit gebied | **Behouden**, C5 afmaken | §2c |
| Dichtbij | **Versimpelen** (klein) | nul resultaten en locatie geweigerd nalopen |
| Mijn reis | **Behouden** | QA op ontbrekende data |
| Plekpagina: kop, foto, springlinks | **Herstructureren** | W1, W5, W6, W14, W15 |
| Plekpagina: beslisblok | **Herbouwen** | W2 |
| Plekpagina: acties en vaste balk | **Herstructureren** | W3, W4, W13, W16 |
| Plekpagina: Goed om te weten, Voorzieningen, Praktisch | **Herstructureren** | W10 |
| Plekpagina: Ervaringen | **Versimpelen** | W6, W7 |
| Plekpagina: help-blok + formulier | **Herstructureren** | W8, W11 |
| Kop (globaal) | **Versimpelen** op de plekpagina | W5 |
| Formulieren (aanmelden, doe mee) | **Nalopen** | A §25–26, B T32–T35 |
| Provincie- en plaatspagina's | **Nalopen** | A §24, B §15 |

## 4. Routes: taak, eerste vraag, primaire actie, risico

| Route | Doel | Eerste vraag | Primaire actie | Grootste risico nu |
|---|---|---|---|---|
| `/` | plek vinden | waar wil ik staan? | Plekken bij mij in de buurt / zoeken | welkomstsheet over de start bij eerste bezoek (besluit 87) |
| `/zoeken`, vertrekgroepen | vergelijken | welke plek past? | plek openen | weinig; QA |
| `/dichtbij` | nabij kiezen | wat haal ik nog? | plek kiezen | nul resultaten, locatie geweigerd |
| `/plek/[slug]` | beslissen | kan ik hier staan, hoe laat weg? | Route openen | **te veel even zware blokken en acties** |
| `/mijn-reis` | reis plannen | volgende stop? | Route openen | weinig; QA bij onbekende data |
| `/camperplaatsen/*` | oriënteren (SEO) | wat is er in deze streek? | plek openen | database-gevoel |
| `/doe-mee`, `/plek-aanmelden`, `/melden` | bijdragen | hoe help ik? | formulier | lange formulieren |
| `/account`, `/inloggen` | ondersteunend | – | inloggen | geen accountdruk (staat goed) |
| 404, fout, offline | herstellen | waar nu heen? | Terug naar Zoeken | QA |

## 5. Besluiten Patrick (27 november 2026)

| Vraag | Besluit |
|---|---|
| V1 Beslisblok | Vertrek groot over de volle breedte, prijs eronder, Aankomst · Open · Reserveren als drie compacte regels |
| V2 Acties telefoon | Alleen Route prominent; tegelrij weg; Bewaren als hartje op de foto, Delen als icoon bij de naam; Website/Bellen als regels bij Reserveren en Contact |
| V3 Kop plekpagina | Terug, Bewaren, ⋯ (Delen, Plek aanmelden, Hulp, Donker, Inloggen); naam verschijnt bij scrollen |
| V4 Bijdragen | Eén knop **Gegevens corrigeren of aanvullen** + blok **Eigenaar van deze plek?**; teller weg; Foto toevoegen als kleine link; oproep **Vertrektijd doorgeven** blijft bij een onbekende vertrektijd |
| V5 Mogelijk verouderd | `ink-2` halfvet met icoon, geen rood en geen avondzon |
| V5b Desktopfoto | Lager, ongeveer 320 px |
| V6 Check voor vertrek | Weg; Ervaringen houdt Google-cijfer en reviews |
| K1–K10 | Gekozen door Claude op verzoek van Patrick (27 november), zie §2d; elk punt is los terug te draaien |

## 6. Fasen en taken

Werkwijze per fase: bouwen → `npm run check` → e2e die het raakt → screenshots → specs en stijlgids in dezelfde
commit. Per fase hoogstens één review met `code-reviewer`. Geen migraties of edge functions: alles is presentatie.

### Fase A: audit ✅
- ✅ Docs, routes, componenten en smells gelezen; offline build en screenshots; matrix (§3) en routetabel (§4).
- ✅ Plan B vergeleken (§2).

### Fase D: plekpagina (P0) ✅ (27 november, commit 1880a8d)

Afwijking van de tabel: Bewaren staat op de telefoon in de kop (V3), niet ook als hartje op de foto, en Delen in het
menu ⋯; zo staat elke actie één keer in beeld. De oproep Vertrektijd doorgeven staat alleen in het beslisblok, niet
nog eens onderaan. D15 (cookiebalk) bleek al goed: hij staat boven de vaste balk.

Doelvolgorde op de telefoon:

```text
Kop: terug · (naam bij scrollen) · Bewaren · ⋯
Foto (hartje op de foto, "Foto: domein" eronder)
Naam · Soort in plaats, provincie · [score als er reviews zijn] · afstand
Laatste update: datum[, mogelijk verouderd]
BESLISBLOK   Vertrek (groot, met steunzin; bij onbekend: Vertrektijd doorgeven)
             Prijs (bedrag, per nacht / + toeslagen)
             Aankomst · Open · Reserveren
Goed om te weten: tijden en voorwaarden → reserveren uitgelegd + Naar de website → prijs in detail
Voorzieningen + Past je camper? (lengte, hoogte, gewicht, ondergrond, betalen)
Ligging en route (kaart, adres, Route openen)
Over deze plek
Ervaringen (Google-cijfer, reviews)
Contact (telefoon, website, e-mail)
In de buurt
Klopt er iets niet? → Gegevens corrigeren of aanvullen · Foto toevoegen
Eigenaar van deze plek? → Gegevens aanpassen
Vaste balk: [prijs zodra het beslisblok uit beeld is] · Route openen
```

| # | Taak | Moeite |
|---|---|---|
| D1 | **`DecisionSummary`** (vervangt `DecisionGrid`): vertrek over de volle breedte en groter, met steunzin ("Je kunt vertrekken wanneer het jou uitkomt" / "Je verblijf loopt per 24 uur" / "We weten nog niet hoe laat je hier moet vertrekken"); prijs; daarna drie `DataRow`'s Aankomst, Open, Reserveren. Onbekend = "Onbekend", gedempt, geen fout | M |
| D2 | Onbekende vertrektijd: link **Vertrektijd doorgeven** opent het formulier meteen op Vertrektijd | S |
| D3 | Acties: `ActionRow` weg; hartje op de foto; Delen-icoon naast de naam; Website/Bellen als regels bij Reserveren en Contact | M |
| D4 | Vaste balk: altijd **Route openen**; de prijs schuift er pas in als het beslisblok uit beeld is (IntersectionObserver, geen layout shift) | S |
| D5 | Desktop: zijkolom begint met **Route openen** (primair), dan "Naar de website" (secundair, met domein), telefoon, e-mail | S |
| D6 | Desktopfoto ±320 px; "1 van 300" als dunne tekstregel | M |
| D7 | Kop op de plekpagina: terug, naam bij scrollen, Bewaren, ⋯ met Delen, Plek aanmelden, Hulp, Donker, Inloggen | M |
| D8 | Volgorde zoals hierboven; "Past je camper?" bij Voorzieningen; Praktisch wordt Contact (alleen adres en contact) | S |
| D9 | Springlinks weg tot `lg` (B T10); vanaf `lg` niet nodig door de zijkolom | S |
| D10 | "Nog geen reviews" weg uit de kop; score klein en alleen als er reviews zijn | S |
| D11 | Check voor vertrek weg (V6) | S |
| D12 | Help-blok → **Klopt er iets niet?** (één zin + **Gegevens corrigeren of aanvullen** + kleine link Foto toevoegen) en **Eigenaar van deze plek?** (**Gegevens aanpassen**). Teller en lijst weg. Drukte doorgeven via het formulier | M |
| D13 | Formulier: eerste stap **Wat wil je aanpassen?** als radiolijst (Vertrektijd, Prijs, Aankomst, Reserveren, Voorzieningen, Contactgegevens, Locatie, Foto, De plek bestaat niet meer, Anders), daarna alleen die velden; fout bij het veld; invoer blijft staan. Zelfde RPC `submit_place` | M |
| D14 | Mogelijk verouderd in `ink-2` halfvet met icoon (V5) | S |
| D15 | Cookiebalk op taakpagina's niet over de vaste balk: erboven aansluiten | S |
| D16 | Tests: onbekende vertrektijd, oude data, prijs onbekend, reserveren onbekend, centrale correctieflow, vaste Route, prijs in de balk pas na scrollen, desktop: vertrektijd in de eerste viewport | M |

### Fase E: Zoeken, kaart, Dichtbij (P0, klein) ✅ (27 november, commit c1e4f58)
- ⬜ E1 Dichtbij nul resultaten: hoogstens twee uitwegen in beeld (A §17).
- ⬜ E2 Dichtbij locatie geweigerd: één zin + zoekveld "Zoek op een plaats of streek" (A §47).
- ⬜ E3 Kaartpaneel en popup: foto, naam, vertrek, prijs, rijtijd, **Route openen**, **Bekijk plek** (+ hartje); C5 afronden.
- ⬜ E4 e2e: lijst ↔ kaartselectie en terugkeer met filters en scroll (A §45, B T19).
- ⬜ E5 Rijtijd nooit tonen als het hemelsbreed is (B §12): test op de bestaande labels.

### Fase F: Mijn reis (P0, alleen QA) ✅ (27 november, commit c1e4f58)

F2: Delen en Meer reisopties blijven direct onder Volgende stop (brief, rij Mijn reis); het is een gesloten menu,
geen instellingen vóór de stops.
- ⬜ F1 Onbekende vertrektijd of rijtijd: gewone status, uitleg alleen als de berekening er last van heeft (A §21).
- ⬜ F2 e2e: volgende stop bovenaan, reisopties niet boven de stops, volgorde wijzigen zonder slepen (B T25).

### Fase G: globaal (P1)
- ✅ G1 **Woordenboek en statuscopy** (stijlgids §11a, doorgevoerd; FAQ via migratie `20261127100000` na de merge) (A §32, B T55–T56) in de stijlgids, daarna overal doorvoeren:
  Bewaren · Route openen · Naar de website · Bellen · Delen · Gegevens corrigeren of aanvullen · Vertrektijd
  doorgeven · Vertrektijd onbekend · Onbekend · Laatste update · Mogelijk verouderd · Bekijk plek. Verwijzingen naar
  "Klopt er iets niet?" in voorwaarden, melden, disclaimer en FAQ; "Bedankt!" zonder uitroepteken.
- ✅ G2 Doe mee: twee doelen (plek verbeteren, plek aanmelden), eigenaren onderaan.
- ✅ G3 Plek aanmelden in stappen (welke plek, waar, wat weet je, contact); server-side validatie blijft.
- ✅ G4 Formulierfouten en successen gelijk: fout bij het veld, invoer blijft, succes zegt wat er nu gebeurt (B T34–T35).
- ✅ G5 Empty, loading, error en offline per datacomponent: skeleton zoals de echte lijst; offline "Geen verbinding.
  Je ziet de gegevens die eerder zijn bewaard."
- ✅ G6 (stond er al; nagekeken op screenshots) Provincie- en plaatspagina's als reisgids: titel, korte feiten, kaart, vertrekgroepen, plekken, plaatsen.
- ⬜ G7 Technische opruimlijst (A §55, B T43–T47): 13× `shadow-`, 9× `text-[…]`, 2× `rounded-2xl`, 32 inline
  styles, 77 hexwaarden (meeste in kaart, iconen en OG-beelden: terecht). Alleen in schermen die we toch aanraken.

### Fase H: toegankelijkheid en schermformaten (P0 vóór 19 december)
- ⬜ H1 axe-e2e op alle gewijzigde schermen; toetsenbord, focus in sheets en terug naar de knop, Escape, 44 px,
  reduced motion, geen betekenis alleen via kleur (A §42, B T49–T54).
- ⬜ H2 Screenshots 320, 390 (licht en donker), 430, 820 en 1440 (licht; plekpagina ook donker). Randgevallen:
  lange naam, lang adres, geen foto, geen prijs, onbekende vertrektijd, oude data, lange beschrijving, 0 en veel
  reviews. Per screenshot de negen vragen uit B §51.

### Fase I: oplevering
- ⬜ I1 In `docs/review/`: `UX-AUDIT-REPORT.md`, `DESIGN-DECISIONS.md`, `SCREENSHOT-QA.md` (met scorecard B §52; geen
  release onder 4 op Hiërarchie, Scanbaarheid, Rust en Actie).
- ⬜ I2 Specs bijwerken: `04-ui-ux-brief.md` (Plek, Laatste update, Navigatie), `03-app-flow.md`, stijlgids
  (informatiedichtheid A §39, woordenboek), implementatieplan, README 145.

### Spoor P: alleen Patrick 👤
- 👤 P1 Zes begeleide tests (2× 40–49, 2× 50–64, 2× 65+) in de testweek, met de scenario's van B §53 en de vijf taken
  van A §64. Noteer misklikken, terug, vragen en "waar moet ik klikken?".
- 👤 P2 Na de livegang: besluit over eigen meting van de events uit B §54 (met toestemming).

### Na de livegang (bewust niet nu)
- Button-, Card- en Section-API voor de hele site (B T38, T41, T42).
- Snelle chips en startvolgorde opnieuw bekijken met echte gebruiksdata (K5, K6).
- Visuele snapshottests in CI (bestaand besluit: de data wisselt dagelijks).
- Tabnamen blijven Start, Zoeken, Dichtbij, Mijn reis (beide plannen: niet veranderen zonder bewijs).

## 7. Botsingen met eerdere besluiten (CLAUDE.md: melden vóór bouwen)

| Nieuw | Eerder besluit | Status |
|---|---|---|
| V1 beslisblok nieuwe opbouw | 2×2 (30 oktober, README 144) | Besloten 27 november |
| V2 geen actierij | Actierij vier tegels (18 november) | Besloten 27 november |
| V3 kop plekpagina | T39 (26 november) | Besloten 27 november |
| V4 één correctieknop, geen teller | README 144 | Besloten 27 november |
| V5 verouderd in `ink-2` | T27 via README 142 (`alert`) | Besloten 27 november |
| V6 Check voor vertrek weg | README 141 | Besloten 27 november |
| D9 springlinks weg op mobiel | Plekpagina-ronde 18 november ("springlinks die blijven plakken") | Gekozen door Claude (K, op verzoek Patrick) |
| K1 "Route openen" | Brief: knop **Route** | Gekozen door Claude |

## 8. Planning (vóór de bevriezing van 19 december)

| Week | Claude | Patrick |
|---|---|---|
| 27 nov – 3 dec | Fase D (plekpagina) bouwen en testen | A1–A4 uit het vorige stappenplan |
| 4 – 10 dec | Fase E, F, G1 | Plekpagina beoordelen op je telefoon |
| 11 – 18 dec | H1, H2, G2–G6 voor zover tijd, I1, I2, samenvoegen | P1 gebruikerstests plannen |
| 19 – 31 dec | Alleen fixes | P1 tests, afvinken |

Gaat de tijd op, dan valt eerst G6, daarna G3 en G2 weg. Fase D, E, F, G1 en H gaan voor.
