# 4. UI en UX Design Brief

> Doel: één consistente, bruikbare visuele richting. De kleuren van **"natuur & vrijheid"** staan vast (keuze van de
> eigenaar). Hoe alles eruitziet en beweegt (typografie, hoeken, schaduw, iconen, beweging) staat in de
> **stijlgids `docs/stijlgids.md`**, die bij twijfel voorgaat. Tokens: `web/src/app/globals.css`.
> Bijgewerkt: 29 oktober 2026 (redesign: start en plekpagina "Eén vraag", kaart "Kaart eerst", landingspagina's
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
| `paper` (zandpapier) | `#F7EED9` | `#111713` | Achtergrond |
| `surface` | `#FFFAEF` | `#18201B` | Kaarten, panelen, header |
| `sunken` | `#F1E6CF` | `#222C26` | Verzonken vlakken, "onbekend" |
| `ink` / `ink-2` / `muted` | `#1F2B24` / `#46524A` / `#5C665E` | `#ECE7DB` / `#C7C2B6` / `#9AA39B` | Tekst |
| `forest` (bosgroen) | `#1F4E37` | `#97CFA9` | Hoofdkleur: knoppen, links, pictogrammen, "open", **geen vaste vertrektijd** |
| `ember` (avondzon) | `#B03F12` | `#F39A5C` | Accent: hoofdactie op de startpagina ("Plekken bij mij in de buurt"), geselecteerde plek op de kaart |
| `lake` (meerblauw) | `#2F6F7E` | `#82BCC8` | Water en routes op de kaart, **uitslapers** (vertrek 12:00 of later) |
| `alert` | `#A8321D` | `#F08A72` | Fouten, "niet aanwezig" |

Donkere modus "avond in het bos": volgt standaard de systeeminstelling, ook live (zonsondergang). Een kleine zon/maan-knop in de header (44 × 44 px, rechts naast Hulp) zet het andere thema vast op dit toestel (`vrijstaan:thema`); kies je weer wat het systeem doet, dan volgt de site het systeem weer. Het actieve thema staat als `data-theme` op `<html>`, gezet vóór de eerste weergave (`lib/theme.ts`), zodat er geen lichte flits is. De kaart wisselt mee zonder te herladen.

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
| Plekkaart | Twee vormen. **Rij** (zoeken, Dichtbij; redesign 30 oktober 2026): compact, ±105 px hoog, foto 96 px breed links (op `sm` 144 px). Rechts van boven naar onder: vertrekbadge (één regel), naam (één regel, afgekapt), "Soort in plaats", dan score ("8,4 (12)"), afstand en "Gesloten tot …" als de plek nu dicht is. Uiterst rechts het hartje boven de prijs, met één regel eronder: totaal voor 2 personen, "+ toeslagen" of "per nacht". Voorzieningen en aankomst staan op de plekpagina. 8 px hoek en een rand van 1 px, geen schaduw (stijlgids §6 en §7). **Stapel** (start, In de buurt): foto boven, zoals voorheen |
| Vertrekbadge | Bosgroen vlak met klok-pictogram: "Geen vaste vertrektijd" of "Per 24 uur, geen vaste tijd"; meerblauw bij uitslapers (12:00 of later): "Vertrek uiterlijk 12:00"; neutraal bij 11:00 tot 12:00 en eerder: "Vertrek uiterlijk 11:00". Onvolledige plek (geen vertrekregel): grijs label "Vertrektijd onbekend" (`sunken` met `muted`, contrast 4,8:1 licht en 5,6:1 donker); de tekst zegt het, niet alleen de kleur. Bij een afgewezen of onleesbare regel: geen badge |
| Kaartstippen | De kleur van een stip is de vertrekregel: bosgroen zonder vaste vertrektijd, meerblauw voor uitslapers, donkergrijs (`ink-2`) bij een vaste tijd vóór 12:00. Plek zonder vertrekregel: holle stip met een ring van 3 px in `muted` (contrast met de kaartgrond 5,0:1 licht, 6,8:1 donker), onder de gekleurde stippen; vorm en kleur verschillen, niet alleen kleur. Gratis plekken hebben geen eigen kleur meer: "Gratis" staat als prijs bij de stip (vanaf zoom 10) en op de kaart in de lijst. Avondzon alleen voor de gekozen plek |
| Gekozen plek op de kaart | Telefoon (onder `lg`), Zoeken in kaartweergave en Dichtbij: een tik op een stip toont onderaan de kaart een paneel (16 px hoek zoals een sheet, `shadow-float`: het zweeft boven de kaart) met foto, naam, "Soort in plaats", vertrekbadge, aankomst, voorzieningen, prijs en de knoppen **Route** (primair) en **Bekijk plek**; sluiten met ×. Groot scherm: popup op de kaart en de kaart in de lijst licht op (`MapPick` in `place-ui.tsx`) |
| Snelle chips | Boven de resultaten op Zoeken (redesign 30 oktober 2026, vervangt de vertrektabbladen): Dichtbij, **Zonder vertrektijd**, Gratis, 8+, Stroom, Lozen. Eén `Chip` voor alles (review R49): 44 px hoog, 6 px hoek, uit = rand van 1 px op `surface`, aan = gevuld bosgroen met vinkje; geen chip met een eigen kleur. Horizontaal scrollbaar op de telefoon. Uitslapers en Overige blijven bereikbaar via de filtersheet en de footer; hun pagina's houden hun eigen kop |
| Voorzieningenpictogrammen | Lijnicoon op een lichte ondergrond: bosgroen op lichtgroen (aanwezig), lichtgrijs op zand (onbekend), grijs met rode streep (niet aanwezig) |
| Bottom sheet | Filters, reviews, meldingen; sluiten met ×, omlaag vegen of tik ernaast |
| Navigatie | Tabbalk onderaan (Start, Zoeken, Dichtbij, Mijn reis) tot `lg`; vaste actiebalk op de plekpagina. In de kop op de telefoon: Plek aanmelden, Hulp, licht/donker en Inloggen als icoon (met naam voor schermlezers) |
| Meldingen | Korte toast na bewaren; inline statusregels (`role="status"`/`role="alert"`) |
| Foto's van een plek | Beste foto vooraan: een foto van de plek zelf, het eigen logo pas als er niets anders is. Nooit keurmerken of logo's van anderen (SVR, ANWB, Zoover), vlaggen, stockfoto's of miniaturen. We vragen bij bekende beeldbanken (WordPress, Wix, Jimdo, Duda, `?width=`) de grote versie op en vallen terug op het origineel. Te klein voor het vak (galerij < 640 px, kaart < 320 px breed) = niet tonen. Logo's en foto's met een heel andere verhouding staan passend in het vak (niet half bijgesneden), met een vervaagde rand. Regels in `web/src/lib/photos.ts` |
| Over deze plek | Tekst van de website van de plek, alleen hele Nederlandse zinnen: zonder "Lees meer", "…", links, prijzen, telefoonnummers of SEO-titels. Lukt dat niet, dan geen tekst. Onder de tekst: "Zo beschrijft de plek zichzelf op de eigen website." Regels in `web/src/lib/description.ts` |
| Laatste update | Eén kleine grijze regel bovenaan elke plek- en lijstpagina: "Laatste update: 11 oktober 2026". Geen bronzinnen of "volgens de website" bij losse gegevens (besluit eigenaar). Eén uitzondering: foto's houden "Foto: domein.nl" in de hoek, zolang de foto laadt. De bronzin van de vertrektijd staat alleen in beheer (besluit eigenaar 23 oktober 2026). Op de plekpagina volgt achter de datum ", mogelijk verouderd" (`ink-2`, halfvet) als de laatste controle (`verified_at` of `departure_checked_at`, de jongste) meer dan 12 maanden oud is; zonder die datum geen melding |
| Oproep vertrektijd | Op de plekpagina van een onvolledige plek, in het beslisblok onder Vertrekken: "We weten de vertrektijd van deze plek nog niet. Heb je er gestaan of gebeld, geef het dan door. Zo weten andere camperaars hoe laat ze weg moeten." met een secundaire knop **Vertrektijd doorgeven** (44 px, klok-icoon) die het formulier van Doe mee opent |
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
| Plek | Fotostrook (200 px hoog op de telefoon, bijgesneden; vanaf `sm` 21:9) → naam (h1), "Soort in plaats, provincie" met link naar de kaart, score ("8,4 uit 12 reviews", link naar de reviews; anders "Nog geen reviews") en afstand van je locatie als je die al deelde, laatste update → **beslisblok** (redesign 30 oktober 2026): één blok van 2×2 cellen met haarlijnen (Vertrekken, Prijs, Nu open, Aankomen), label klein en gedempt, waarde groot. Vertrekken is de enige gekleurde cel (bosgroen zonder vaste tijd, meerblauw voor uitslapers). Onbekend staat er als "Onbekend" met "Weet jij dit?", een bekend gegeven heeft een rustige link "Klopt dit niet?" (review R48). Daaronder één blok met rand met wat niet in een tegel past (bij een onbekende vertrektijd eerst de oproep met **Vertrektijd doorgeven** en de eigenaarsroute, dan voorwaarden bij de vertrektijd, andere tijden, prijs in detail met extra kosten, max. lengte en anders de eigenaarsroute onderaan) → foto toevoegen → drukte → **voorzieningenraster** (één blok met haarlijnen, 2 kolommen, op `sm` 3, klein icoon met tekst): aanwezig in donkere tekst, afwezig gedempt, onbekend met een "?"-knop (6 px hoek, rand) die in de cel zelf vraagt "Ja / Nee / Weet ik niet" (inzending voor beheer) → over deze plek → ligging en route → ervaringen → praktisch en contact → in de buurt |
| Landingspagina's (provincie, plaats of eiland, vertrekgroep per provincie) | Kruimelpad (14 px, gedempt) → h1 "Camperplaatsen op Texel" / "Camperplaatsen zonder vertrektijd in Zeeland" (24 px, vanaf `sm` 36 px) → "Laatste update: datum" → twee of drie korte zinnen, alleen uit de cijfers (geen eigen beschrijving van de plaats: we verzinnen niets) → rij knoppen van 44 px: **Bekijk op de kaart** primair, de rest secundair → vergelijkingstabel (Plek / Vertrek / Per nacht, zie Componenten) → ronde linkchips (44 px, `shadow-low`) naar plaatsen, eilanden en verwante pagina's. Geen nieuwe componenten of kleuren; bouwstenen in `web/src/components/seo-ui.tsx` |
| Dichtbij | Locatievraag → chips (zonder vertrektijd, uitslapers, nu open, voorzieningen) in één scrollrij → kaart eerst: op de telefoon van rand tot rand, ruim de helft van het scherm, met de gekozen plek onderaan → lijst op rijtijd als sheet over de onderrand van de kaart (16 px hoek, greepje); groot scherm: lijst links, kaart rechts |
| Mijn reis | Startpunt en vertrekdatum (optioneel) → stops met nachten, met datums ("za 30 okt tot ma 1 nov" in plaats van open/dicht nu) en een rode regel als de plek dan volgens het seizoen dicht is → route en kosten (het totaal zegt in het bedrag zelf hoeveel prijzen ontbreken: "€ 84 + 2 onbekend", met "+ toeslagen, niet meegeteld" eronder) → delen en navigatie |

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
| Logo en app-icoon | "Camper bij de klokzon" (gekozen 2 november 2026): camper op een heuvel voor de zakkende avondzon, die ook een klok is; bosgroen, avondzon, zandpapier. Bron: `Logo` in `components/icons.tsx` en `public/icon.svg` (gelijk aan `app/icon.svg`); maskable en Apple-icoon vlak tot de rand. PNG's (192, 512, maskable 512, Apple 180) en het logo in `public/og.png` zijn uit deze SVG's gerenderd |
| Pictogrammen (voorzieningen, klok, soorten plek) | Aanwezig (`web/src/components/sign.tsx`, `icons.tsx`) |
| Getekende landschappen | Alleen nog voor lege toestanden (Mijn reis leeg, niet gevonden, Dichtbij-intro); niet op kaarten of de startpagina |
| Foto's van plekken | Websitefoto's staan aan (met bron); aanvullend nodig: van bezoekers, eigenaren en Wikimedia Commons |
| Screenshots voor app-stores | Later (fase C) |
