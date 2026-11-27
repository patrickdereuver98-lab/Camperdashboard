# 4. UI en UX Design Brief

> Doel: één consistente, bruikbare visuele richting. De kleuren van **"natuur & vrijheid"** staan vast (keuze van de
> eigenaar). Hoe alles eruitziet en beweegt (typografie, hoeken, schaduw, iconen, beweging) staat in de
> **stijlgids `docs/stijlgids.md`**, die bij twijfel voorgaat. Tokens: `web/src/app/globals.css`.
> Bijgewerkt: 27 november 2026 (UX-audit "volwassen maken", README 145; zie "Wijzigingen 27 november 2026" onderaan). Eerder: 26 november 2026 (UI/UX-plan van ChatGPT, README 142; zie "Wijzigingen 26 november 2026" onderaan). Eerder: 29 oktober 2026 (redesign: start en plekpagina "Eén vraag", kaart "Kaart eerst", landingspagina's
> "Reisgids"; besluit eigenaar 29 oktober 2026, ontwerpcanvas in README nummer 64). Gelijkgetrokken met de stijlgids
> en besluit 75 op 8 november 2026 (README 113): hoeken, schaduw, chips, velden en koppen volgen de stijlgids.

## Doelgroep en toon

- Nederlandse camperaars van 40+ (PRD, besluit 18 oktober 2026), op een telefoon, vaak onderweg en bij wisselend licht.
- Drie woorden: **rustig**, **eerlijk**, **buiten**.
- Taal: Nederlands, je-vorm, korte gewone zinnen, geen marketingtaal, geen emoji, geen nepurgentie ("nog 2 plekken!").
  Onbekend heet "Onbekend", nooit een gok.

## Referentieproducten

| Product | Overnemen | Vermijden |
|---|---|---|
| [Booking.com](https://www.booking.com) | Resultaatkaart (foto, naam, plaats, score, prijs rechtsonder), filters in een sheet met live teller, huisregels met tijden | Te veel filters, nepurgentie |
| [Campercontact](https://www.campercontact.com) | Camper-specifieke velden, offline | Betaalmuur voor reviews en filters |
| [park4night](https://park4night.com) | Community-foto's en reviews | Rommelige pagina's, plekken zonder bron |
| [Stellplatz.info](https://stellplatz.info) | Deelscores (ligging, rust, voorzieningen) | Druk ontwerp |
| [Hipcamp](https://www.hipcamp.com) | Check-in en check-out als vast veld | Alleen boekbaar aanbod |

## Kleurenpalet

| Token | Licht | Donker | Gebruik |
|---|---|---|---|
| `paper` (zandpapier) | `#F5F0E6` | `#111713` | Achtergrond |
| `surface` | `#FFFCF6` | `#18201B` | Kaarten, panelen, header |
| `sunken` | `#EDE6D8` | `#222C26` | Verzonken vlakken, "onbekend" |
| `ink` / `ink-2` / `muted` | `#1F2B24` / `#46524A` / `#5C665E` | `#ECE7DB` / `#C7C2B6` / `#9AA39B` | Tekst |
| `forest` (bosgroen) | `#1F4E37` | `#8DBF9F` | Hoofdkleur: knoppen, links, pictogrammen, "open", **geen vaste vertrektijd** |
| `ember` (avondzon) | `#B9592A` | `#E8915C` | Accent: hoofdactie op de startpagina ("Plekken bij mij in de buurt"), geselecteerde plek op de kaart |
| `lake` (meerblauw) | `#2F6F7E` | `#82BCC8` | Water en routes op de kaart, **uitslapers** (vertrek 12:00 of later) |
| `alert` | `#A8321D` | `#F08A72` | Fouten, "niet aanwezig" |

Donkere modus "avond in het bos": volgt standaard de systeeminstelling, ook live (zonsondergang). Een zon/maan-knop in de header vanaf `lg` (44 × 44 px), op de telefoon "Donkere modus" in het menu Meer zet het andere thema vast op dit toestel (`vrijstaan:thema`); kies je weer wat het systeem doet, dan volgt de site het systeem weer. Het actieve thema staat als `data-theme` op `<html>`, gezet vóór de eerste weergave (`lib/theme.ts`), zodat er geen lichte flits is. De kaart wisselt mee zonder te herladen. Basiskaart: eigen stijl (`scripts/kaartstijl.mjs`), licht in zand, zacht groen en meerblauw met een eigen tint per terrein; donker bijna neutraal met verschil in lichtheid, zodat groen voor de stippen blijft.

## Typografie

- **Geist** voor alles: koppen (600, strak gespatieerd), tekst (400), knoppen (500/600) en cijfers (`tabular-nums`).
  Vervangt Fraunces + Inter (besluit eigenaar 12 oktober 2026: "te AI, te kinderlijk"; zie `docs/stijlgids.md` §4).
- Basis 16 px op de telefoon en 17 px vanaf tablet (`sm`); kleine tekst minimaal 14 px (`text-sm`); koppen alleen met
  `text-h1` (24/36 px), `text-h2` (18/22 px) en `text-h3` (16/18 px), zie stijlgids §4. Besluit eigenaar 12 oktober 2026: op de telefoon rustiger en meer op één scherm.
- Lettertypes zelf gehost via `next/font` (geen verzoeken naar Google).

## Componenten

| Component | Regels |
|---|---|
| Knoppen | Minstens 44 px hoog (meestal 44–56 px), 8 px hoek, geen schaduw; primair bosgroen, hoofdactie startpagina avondzon; secundair met rand van 1 px |
| Formulieren | Velden 44 px met 8 px hoek en rand `--field-border` (≥ 3:1), label boven het veld, verplichte velden met `*`, foutmelding onder het veld, numeriek toetsenbord bij getallen |
| Plekkaart | Twee vormen. **Rij** (zoeken, Dichtbij; redesign 30 oktober 2026): compact, ±105 px hoog, foto 84 × 63 px links (op `sm` 144 px breed over de hele hoogte). Rechts van boven naar onder: vertrekbadge (één regel), naam (één regel, afgekapt), "Soort in plaats", dan score ("8,4 (12)"), afstand en "Gesloten tot …" als de plek nu dicht is. Uiterst rechts het hartje boven de prijs, met één regel eronder: "+ toeslagen" of "per nacht" (het totaal voor 2 personen staat op de plekpagina). Voorzieningen en aankomst staan op de plekpagina. 8 px hoek en een rand van 1 px, geen schaduw (stijlgids §6 en §7). **Stapel** (start, In de buurt): foto boven, zoals voorheen |
| Vertrekbadge | Bosgroen vlak met klok-pictogram: "Geen vaste vertrektijd" of "Per 24 uur, geen vaste tijd"; meerblauw bij uitslapers (12:00 of later): "Vertrek uiterlijk 12:00"; neutraal bij 11:00 tot 12:00 en eerder: "Vertrek uiterlijk 11:00". Onvolledige plek (geen vertrekregel): grijs label "Vertrektijd onbekend" (`sunken` met `muted`, contrast 4,8:1 licht en 5,6:1 donker); de tekst zegt het, niet alleen de kleur. Bij een afgewezen of onleesbare regel: geen badge |
| Kaartstippen | De kleur van een stip is de vertrekregel: bosgroen zonder vaste vertrektijd, meerblauw voor uitslapers, donkergrijs (`ink-2`) bij een vaste tijd vóór 12:00. Plek zonder vertrekregel: holle stip met een ring van 3 px in `muted` (contrast met de kaartgrond 5,0:1 licht, 6,8:1 donker), onder de gekleurde stippen; vorm en kleur verschillen, niet alleen kleur. Gratis plekken hebben geen eigen kleur meer: "Gratis" staat als prijs bij de stip (vanaf zoom 10) en op de kaart in de lijst. Avondzon alleen voor de gekozen plek |
| Gekozen plek op de kaart | Telefoon (onder `lg`), Zoeken in kaartweergave en Dichtbij: een tik op een stip toont onderaan de kaart een paneel (16 px hoek zoals een sheet, `shadow-float`: het zweeft boven de kaart) met greepje, foto, naam, "Soort in plaats", vertrekbadge, aankomst, voorzieningen, prijs en de knoppen **Route openen** (primair), **Bekijk plek** en het hartje (sinds 27 november 2026, UX-audit E3); sluiten met ×. Vegen (18 november 2026): omhoog (56 px) opent de plekpagina, het paneel rekt met weerstand mee; omlaag (72 px) sluit het. De knoppen blijven de gewone weg. Groot scherm: popup op de kaart en de kaart in de lijst licht op (`MapPick` in `place-ui.tsx`) |
| Snelle chips | Boven de resultaten op Zoeken (sinds 26 november 2026, UI/UX-plan T13): **Zonder vertrektijd**, Vertrek 12:00 of later, Nu open en Voorzieningen (opent de filtersheet). Eén `Chip` voor alles (review R49): 44 px hoog, 6 px hoek, uit = rand van 1 px op `surface`, aan = gevuld bosgroen met vinkje; geen chip met een eigen kleur. Horizontaal scrollbaar op de telefoon. Gratis, 8+, Stroom en Lozen staan in de filtersheet, Dichtbij in de tabbalk |
| Voorzieningenpictogrammen | Lijnicoon op een lichte ondergrond: bosgroen op lichtgroen (aanwezig), lichtgrijs op zand (onbekend), grijs met rode streep (niet aanwezig) |
| Bottom sheet | Filters, reviews, meldingen; sluiten met ×, omlaag vegen of tik ernaast |
| Navigatie | Tabbalk onderaan (Start, Zoeken, Dichtbij, Mijn reis) tot `lg`. Plekpagina op de telefoon (UX-audit 27 november 2026, V3 en K4): geen tabbalk; vaste balk onderaan met altijd **Route openen**, de prijs verschijnt er pas in als de prijs in het beslisblok uit beeld is. Kop op de plekpagina onder `md`: terug, de naam van de plek zodra de titel uit beeld is, Bewaren (hartje) en Meer (Delen, Plek aanmelden, Inloggen of Mijn account, Hulp, Donkere modus). Overige pagina's in de kop op de telefoon: Plek aanmelden, Meer (Hulp en Donkere modus) en Inloggen als icoon (met naam voor schermlezers) |
| Meldingen | Korte toast na bewaren; inline statusregels (`role="status"`/`role="alert"`) |
| Foto's van een plek | Beste foto vooraan: een foto van de plek zelf, het eigen logo pas als er niets anders is. Nooit keurmerken of logo's van anderen (SVR, ANWB, Zoover), vlaggen, stockfoto's of miniaturen. We vragen bij bekende beeldbanken (WordPress, Wix, Jimdo, Duda, `?width=`) de grote versie op en vallen terug op het origineel. Te klein voor het vak (galerij < 640 px, kaart < 320 px breed) = niet tonen. Logo's en foto's met een heel andere verhouding staan passend in het vak (niet half bijgesneden), met een vervaagde rand. Regels in `web/src/lib/photos.ts` |
| Over deze plek | Tekst van de website van de plek, alleen hele Nederlandse zinnen: zonder "Lees meer", "…", links, prijzen, telefoonnummers of SEO-titels. Lukt dat niet, dan geen tekst. Onder de tekst: "Zo beschrijft de plek zichzelf op de eigen website." Regels in `web/src/lib/description.ts` |
| Laatste update | Eén kleine grijze regel bovenaan elke plek- en lijstpagina: "Laatste update: 11 oktober 2026". Geen bronzinnen of "volgens de website" bij losse gegevens (besluit eigenaar). Eén uitzondering: foto's houden "Foto: domein.nl" onder de foto (plekpagina) of in de hoek (overige foto's), zolang de foto laadt. De bronzin van de vertrektijd staat alleen in beheer (besluit eigenaar 23 oktober 2026). Op de plekpagina volgt achter de datum ", mogelijk verouderd" (`ink-2`, halfvet, met klokicoon; sinds 27 november 2026 niet meer in `alert`, besluit V5: het is een signaal, geen fout) als de laatste controle (`verified_at` of `departure_checked_at`, de jongste) meer dan 12 maanden oud is; zonder die datum geen melding |
| Oproep vertrektijd | In het beslisblok, alleen bij een onbekende of onbruikbare vertrektijd (UX-audit 27 november 2026, V4): "Vertrektijd onbekend", de zin "We weten nog niet hoe laat je hier moet vertrekken." en één knop **Vertrektijd doorgeven**. Geen tweede oproep onderaan; eigenaren gebruiken het blok Eigenaar van deze plek? |
| Legenda | Link "Wat betekenen de icoontjes?" bij de resultaten en bij Voorzieningen; opent een sheet met voorzieningen, kleuren (groen, zand, doorgestreept), vertrekbadges (ook "Vertrektijd onbekend" en de grijze kaartstip) en open/dicht |
| Diepte | Randen van 1 px in plaats van schaduw (besluit 75, stijlgids §7): blokken, rasters en lijsten hebben `border-line`, hover is een iets donkerdere rand, zonder sprong. `shadow-float` alleen voor wat zweeft (sheets, toast, kaartpop-up) en een knop op een foto. `shadow-low` en `shadow-raised` worden op de site niet meer gebruikt |
| Hoofdactie en zoeken (start) | Direct onder de kop: knop **Plekken bij mij in de buurt** (avondzon, 56 px, zonder schaduw, naar Dichtbij; de code heeft nog `shadow-float`, fase 2.1 in `docs/LANCERING.md`) en daaronder één zoekveld met knop Zoeken (bosgroen) op één regel; vanaf `lg` naast elkaar. De keuze voor vertrektijd zit niet meer in het zoekveld maar in "Hoe wil je staan?" eronder |
| Vergelijkingstabel (landingspagina's) | Eén blok (rand van 1 px, 8 px hoek, geen schaduw) met een echte tabel: Plek (naam als link, 44 px tikvlak; "Soort in plaats", maximale lengte als die bekend is) / Vertrek (vertrekbadge; op de telefoon onder de naam) / Per nacht (rechts, "+ toeslagen" eronder als die apart bekend zijn). Geen foto's. Onbekend staat er als "Onbekend" |

## Layoutregels

- Mobiel eerst, één kolom; zijmarge 12–16 px; geen horizontale scroll.
- Breekpunten (Tailwind): `sm` 640, `md` 768, `lg` 1024 px. Vanaf `lg`: lijst en kaart naast elkaar, plekpagina met
  zijkolom, en het menu in de kop in plaats van de tabbalk (tot 1024 px, ook op een tablet van 820 px, blijft de
  tabbalk; R27). Een e2e-test controleert op 320, 360, 390 en 820 px dat niets zijwaarts schuift.
- Ruimte in stappen van 4 px; hoeken volgens de stijlgids §6: blokken en kaarten 8 px (`rounded-lg`), knoppen in een
  blok, velden en chips 6 tot 8 px, sheets 16 px (alleen bovenaan).

## Schermnotities

| Scherm | Belangrijkste inhoud, in volgorde |
|---|---|
| Start | "Waar sta je vannacht?" links uitgelijnd op zandpapier (geen tekening) → knop Plekken bij mij in de buurt en het zoekveld → "Hoe wil je staan?" (één lijst met drie grote regels naar de vertrekpagina's, aantal rechts in de kleur van de groep; op een iPhone in beeld zonder scrollen) → drie vertrouwenspunten → Populaire bestemmingen (provincietegels met een echte foto van een plek daar, met bron) → "Vertrekken wanneer je wilt" → zoeken op voorziening → "Zo werkt VrijStaan" in drie stappen → eigenaren |
| Zoeken en vertrekpagina's | Kop en uitleg alleen op een vertrekpagina → zoekveld (44 px) → snelle chips → één rij Filters / Sorteren / Kaart zonder randen (op de telefoon; plakt onder de header) → actieve filterchips → "n plekken in …" (18 px) met laatste update, "Uitleg icoontjes" en "Afstand tonen" (vraagt één keer je locatie; de afstand wordt op het apparaat berekend) → compacte rijen (±105 px). Doel: de eerste plek staat op een iPhone direct in beeld, niet pas na een half scherm bediening |
| Plek | UX-audit 27 november 2026 (README 145, `plan.md`): dunne regel vorige/volgende uit je zoekresultaten ("‹ … 24 van 300 … ›", op groot scherm zonder rand) boven de foto, alleen als je uit zoeken komt → fotostrook (200 px op de telefoon, `sm` 21:9, vanaf `lg` 320 px hoog zodat de vertrektijd op 1440 × 900 zonder scrollen in beeld staat) met "Foto: domein.nl" eronder → naam (h1), "Soort in plaats, provincie", score alleen als er reviews zijn, afstand en laatste update → **beslisblok** (`DecisionSummary`): vertrek over de volle breedte en het grootst, als enige gekleurd, met één zin uitleg ("Je kunt hier vertrekken wanneer het jou uitkomt" / "Je verblijf loopt per 24 uur" / "We weten nog niet hoe laat je hier moet vertrekken"; bij onbekend de knop **Vertrektijd doorgeven**) → prijs (bedrag, "per nacht" of "per nacht + toeslagen", totaal voor 2 personen als alles bekend is) → drie korte regels Aankomst, Open en Reserveren (onbekend gedempt als "Onbekend") → aankomst vandaag en drukte (alleen als gemeld) → tablet: Route openen en contact → **Goed om te weten** (tijden en voorwaarden; Reserveren met uitleg vóór **Naar de website** en **Bellen**; Prijs en voorwaarden met totaal, toeristenbelasting, betalen en extra kosten inklapbaar) → **Voorzieningen** met daaronder **Past je camper?** (lengte, hoogte, gewicht, ondergrond, aantal plekken; zonder maat heet het De plaatsen) → **Ligging en route** (kaart, adres met kopiëren, Rijtijd berekenen) → Over deze plek → Ervaringen (Google-cijfer, reviews) → Contact (telefoon, website, e-mail; vanaf `lg` in de zijkolom) → In de buurt → **Klopt er iets niet?** (één knop **Gegevens corrigeren of aanvullen**, Foto toevoegen, Hoe druk is het nu) → **Eigenaar van deze plek?** (**Gegevens aanpassen**). Groot scherm: zijkolom met **Route openen** (primair), **Naar de website** met domein en **Bellen** (ondergeschikt), daaronder ligging. Geen actierij, geen springlinks, geen Check voor vertrek, geen teller van bekende gegevens |
| Landingspagina's (provincie, plaats of eiland, vertrekgroep per provincie) | Kruimelpad (14 px, gedempt) → h1 "Camperplaatsen op Texel" / "Camperplaatsen zonder vertrektijd in Zeeland" (24 px, vanaf `sm` 36 px) → "Laatste update: datum" → twee of drie korte zinnen, alleen uit de cijfers (geen eigen beschrijving van de plaats: we verzinnen niets) → rij knoppen van 44 px: **Bekijk op de kaart** primair, de rest secundair → vergelijkingstabel (Plek / Vertrek / Per nacht, zie Componenten) → ronde linkchips (44 px, `shadow-low`) naar plaatsen, eilanden en verwante pagina's. Geen nieuwe componenten of kleuren; bouwstenen in `web/src/components/seo-ui.tsx` |
| Dichtbij | Locatievraag → chips (zonder vertrektijd, uitslapers, nu open, voorzieningen) in één scrollrij → kaart eerst: op de telefoon van rand tot rand, ruim de helft van het scherm, met de gekozen plek onderaan → lijst op rijtijd als sheet over de onderrand van de kaart (16 px hoek, greepje); groot scherm: lijst links, kaart rechts |
| Mijn reis | Ontwerpronde 2 (26 november 2026): kop met naam en reizen → één regel "3 stops, 4 nachten, 95 km, vanaf € 87" (afstand en totaal alleen als bekend, ontbrekende prijzen in het bedrag) → blok **Volgende stop** (zonder datum "Eerste stop", tijdens de reis "Vannacht" of de stop na waar je vandaag vertrekt): foto, naam, vertrekbadge, aankomst, datums en nachten, knop **Route** en link Bekijk plek → **Delen** en **Meer reisopties** (Slimste volgorde, Omdraaien, Als tekst delen, Statistieken) → inklapbare regel "Start: …, vertrek: …" met beginpunt en vertrekdatum → stops met nachten, vertrekbadge per stop en datums ("za 30 okt tot ma 1 nov"), rode regel als de plek dan volgens het seizoen dicht is → toevoegen, eigen punt, langs de route → kaart van de route → overzicht en kosten (het totaal zegt in het bedrag zelf hoeveel prijzen ontbreken: "€ 84 + 2 onbekend", met "+ toeslagen, niet meegeteld" eronder) → samen plannen, uitgaven |

## Toegankelijkheid

- Doel: WCAG 2.1 AA, lanceervoorwaarde in de PRD (de European Accessibility Act geldt waarschijnlijk niet voor een
  gratis microbedrijf, maar we houden ons eraan). Afgerond 22 oktober 2026 (P13); `web/e2e/a11y.spec.ts` draait axe
  (WCAG 2.0/2.1 A en AA) op 13 hoofdpagina's en de filtersheet, in licht en donker, en meet de huisregels hieronder.
- Contrast minstens 4,5:1 voor tekst in beide thema's.
- Tekst minstens 14 px (basis 16 px op de telefoon); enige uitzondering de kaartbronvermelding van MapLibre (12 px,
  stijlgids §4).
- Tikdoelen minstens 44 × 44 px op elk scherm, ook chips, scoreknoppen in reviews (twee rijen van vijf), links in
  lijsten en kaartbediening. Kaartpunten: onzichtbaar tikvlak van 44 px rond elk punt en elke groep.
- Alles met toetsenbord bereikbaar, zichtbare focusring (ook op invoervelden), labels op alle velden en
  pictogramknoppen (`aria-label` met de naam van de plek). Sheets: focus blijft binnen, Escape sluit, focus terug naar
  de knop die hem opende. Kaartpunten zijn niet met het toetsenbord te kiezen; de lijst toont dezelfde plekken.
- `prefers-reduced-motion` zet animaties uit (`MotionConfig reducedMotion="user"`, en in CSS ook zonder vertraging).

## Interactietoestanden

| Toestand | Weergave |
|---|---|
| Hover (desktop) | Iets donkerder vlak of een iets donkerdere rand; geen schaduw en geen sprong |
| Focus | Bosgroene focusring |
| Uitgeschakeld | 60–70% dekking, geen hover |
| Laden | Skeletkaarten, knoptekst "Bezig…" of "Versturen…" |
| Fout | Rood vlak `bg-alert-tint` met concrete uitleg en wat je kunt doen |
| Succes | Toast of bosgroen statusvlak |

## Beweging

Eén georkestreerd moment (kop op de startpagina komt omhoog). Verder alleen beweging als reactie op een handeling:
sheet schuift omhoog, hartje springt, chips schuiven in en uit, stops bewegen naar hun nieuwe plek, de foto morpht van
lijst naar detailpagina.

## Benodigde assets

| Asset | Status |
|---|---|
| Logo en app-icoon | Nieuwe set "Camper bij de klokzon" (aangeleverd door de eigenaar, 26 november 2026, README 143): camper op lichte grond voor de avondzon die ook een klok is, met den en heuvel in het liggende logo. Bronnen in `public/merk/` (liggend, gestapeld, donker, los beeldmerk). App-icoon `public/icon.svg` en PNG's (192, 512, maskable 512), Apple-icoon `app/apple-icon.png`, favicon `app/icon.svg` (vereenvoudigd, met bosgroene rand) en `app/favicon.ico`. `Logo` in `components/icons.tsx` volgt dezelfde vormen. Deelafbeelding `public/og.png` opnieuw gemaakt in Geist met het nieuwe logo |
| Pictogrammen (voorzieningen, klok, soorten plek) | Aanwezig (`web/src/components/sign.tsx`, `icons.tsx`) |
| Getekende landschappen | Alleen nog voor lege toestanden (Mijn reis leeg, niet gevonden, Dichtbij-intro); niet op kaarten of de startpagina |
| Foto's van plekken | Websitefoto's staan aan (met bron); aanvullend nodig: van bezoekers, eigenaren en Wikimedia Commons |
| Screenshots voor app-stores | Later (fase C) |

## Wijzigingen 26 november 2026 (UI/UX-plan, README 142)

Besluit eigenaar: het plan van ChatGPT overgenomen, ook waar het eerdere besluiten raakt. Wat hierboven anders staat,
geldt niet meer:

- **Start:** ondertitel "Zoek een camperplaats voor vannacht. Zie meteen wanneer je moet vertrekken." (geen aantallen;
  die staan bij "Hoe wil je staan?"). Vertrouwenspunten met een los vinkje, zonder rond vlak. Secties 32 px uit elkaar
  op de telefoon, 48 px vanaf `sm`.
- **Snelle chips (Zoeken):** hoogstens vier: Zonder vertrektijd, Vertrek 12:00 of later, Nu open en Voorzieningen
  (opent de filtersheet). Dichtbij staat in de tabbalk; Gratis, 8+, Stroom en Lozen in de filtersheet.
- **Plekrij:** foto op de telefoon 84 × 63 px (4:3), bovenaan; vanaf `sm` 144 px over de hele hoogte. Rij minstens
  96 px, 12 px boven en onder. Eén prijsregel: bedrag met "per nacht" of "+ toeslagen" (ook op de stapelkaart); het
  totaal voor 2 personen staat op de plekpagina.
- **Plekpagina:** waarde van Vertrekken één stap groter (`text-h2`). Onbekende of onzekere vertrektijd: "Weet jij
  dit?" in de cel zelf, de oproep eronder is één zin. "Mogelijk verouderd" in `alert` met een waarschuwingsicoon. De
  fotobron staat onder de foto (14 px, `muted`), niet meer op de foto.
- **Kop op de telefoon:** Plek aanmelden, **Meer** (menu met Hulp en Donkere modus) en Inloggen. Vanaf `lg` ongewijzigd.
- **Footer:** op taakpagina's (plek, zoeken, vertrekpagina's, Dichtbij, Mijn reis) een korte footer met hulp, juridisch
  en de kaartvermelding; elders de volledige footer met provincies.
- **Kaart (kaartronde):** plaats- en landnamen in het Nederlands (`name:nl`), locatieknop onder de zoomknoppen,
  bronvermelding begint dichtgeklapt. Dichtbij-chips met een lijnicoon zonder vlak (`Sign bare`).
- **Mijn reis:** zie Schermnotities (volgende stop eerst, vertrekbadge per stop, kaart onder de stops).
- **Dichtbij:** rijtijd is het hoofdgegeven. In de lijst direct onder de naam "12 min rijden" (halfvet) met de afstand
  klein erachter; in het paneel van de gekozen plek ook "er rond 18:40" (nu plus rijtijd, afgerond op 5 minuten, klok
  van de bezoeker). Onder een minuut staat "1 min". Zonder rijtijd de hemelsbrede afstand, zonder schatting.
- **Filtersheet:** volgorde Vertrekken, Open ("Alleen plekken die nu open zijn"), Prijs per nacht, Voorzieningen,
  Soort plek, Lengte van je camper, Overig (score, alleen met reviews). Koppen `text-h3`, iconen zonder vlak. De vaste
  balk onderaan met Wis filters en "Toon n plekken" blijft.
- **Doe mee:** eerst één lijst met Vertrektijd doorgeven en Plek aanmelden, dan "Waar kun je mee helpen?", dan eigenaren.
- **Niet gevonden:** zie App Flow.

## Wijzigingen 27 november 2026 (UX-audit, README 145)

Twee plannen samengevoegd in `plan.md` (opdracht UX-audit en "VrijStaan 2027"). Besluiten van de eigenaar V1 tot en met
V6, keuzes K1 tot en met K10 door de agent op verzoek van de eigenaar.

- **Plekpagina** (rij Plek): beslisblok met vertrek groot boven de prijs en Aankomst, Open en Reserveren als regels
  (V1); geen actierij en geen springlinks (V2, D9); kop met terug, naam, Bewaren en Meer (V3); één correctieknop en
  een eigenaarsblok, geen teller (V4); mogelijk verouderd in `ink-2` (V5); desktopfoto 320 px (V5b); Check voor
  vertrek weg (V6).
- **Vaste termen** (K1 tot en met K3): **Route openen**, **Naar de website**, **Gegevens corrigeren of aanvullen**,
  **Vertrektijd doorgeven**, **Vertrektijd onbekend**, **Onbekend**. Zie de stijlgids, "Woordenboek".
- **Vaste balk** (K4): Route openen altijd; prijs pas als die uit beeld is.
- **Dichtbij**: hoogstens twee uitwegen bij nul resultaten; locatie geweigerd geeft één zin en een zoekveld.
- **Mijn reis**: knop Route openen; bij een onbekende vertrektijd één gewone uitlegregel als de aankomsttijd daardoor
  niet te berekenen is.

