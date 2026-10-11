# 4. UI en UX Design Brief

> Doel: één consistente, bruikbare visuele richting. Het thema **"natuur & vrijheid"** staat vast (keuze van de
> eigenaar) en wordt niet vervangen. Details en tokens: `docs/design.md` en `web/src/app/globals.css`.
> Bijgewerkt: 11 oktober 2026.

## Doelgroep en toon

- Nederlandse camperaars, vooral 55+, op een telefoon, vaak onderweg en bij wisselend licht.
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
| `forest` (bosgroen) | `#2D5A43` | `#8DBF9F` | Hoofdkleur: knoppen, links, pictogrammen, "open", **geen vaste vertrektijd** |
| `ember` (avondzon) | `#B9592A` | `#E8915C` | Accent: hoofdactie op de startpagina, geselecteerde plek op de kaart |
| `lake` (meerblauw) | `#2F6F7E` | `#82BCC8` | Water en routes op de kaart |
| `alert` | `#A8321D` | `#F08A72` | Fouten, "niet aanwezig" |

Donkere modus "avond in het bos": volgt de systeeminstelling.

## Typografie

- **Fraunces** (variabel, `SOFT` 60, optische grootte) voor koppen en prijzen, gewicht 600.
- **Inter** voor lopende tekst, knoppen en formulieren.
- Basis 17 px; kleine tekst minimaal 14 px (`text-sm`); koppen 24–36 px op mobiel.
- Lettertypes zelf gehost via `next/font` (geen verzoeken naar Google).

## Componenten

| Component | Regels |
|---|---|
| Knoppen | Minstens 44 px hoog (meestal 48–56 px); primair bosgroen, hoofdactie startpagina avondzon; secundair met rand |
| Formulieren | Velden 48 px, label boven het veld, verplichte velden met `*`, foutmelding onder het veld, numeriek toetsenbord bij getallen |
| Plekkaart | Foto of tekening links (rij) of boven (stapel), soort, naam, plaats, vertrekbadge, open/dicht, score, voorzieningen, prijs rechtsonder ("per nacht + extra's") |
| Vertrekbadge | Bosgroen vlak met klok-pictogram: "Geen vaste vertrektijd" of "Per 24 uur, geen vaste tijd"; neutraal: "Vertrek vóór 11:00"; niets bij onbekend |
| Voorzieningenpictogrammen | Afgeronde bosgroene vierkanten (aanwezig), zandkleur (onbekend), doorgestreept (niet aanwezig) |
| Bottom sheet | Filters, reviews, meldingen; sluiten met ×, omlaag vegen of tik ernaast |
| Navigatie | Tabbalk onderaan (Start, Zoeken, Dichtbij, Mijn reis); vaste actiebalk op de plekpagina |
| Meldingen | Korte toast na bewaren; inline statusregels (`role="status"`/`role="alert"`) |
| Bronvermelding | Kleine grijze regel of citaat: "Volgens de website (gelezen 11 oktober 2026): …" |

## Layoutregels

- Mobiel eerst, één kolom; zijmarge 12–16 px; geen horizontale scroll.
- Breekpunten (Tailwind): `sm` 640, `md` 768, `lg` 1024 px. Vanaf `lg`: lijst en kaart naast elkaar, plekpagina met
  zijkolom.
- Ruimte in stappen van 4 px; kaarten met afgeronde hoeken (16–28 px) en dunne rand.

## Schermnotities

| Scherm | Belangrijkste inhoud, in volgorde |
|---|---|
| Start | Kop "Waar sta je vannacht?" met zoekveld → snelle ingangen (eerst "Geen vaste vertrektijd") → "Vertrekken wanneer je wilt" → provincies |
| Zoeken | Zoekveld → Filters + sortering → actieve filterchips → "n plekken in …" → kaarten → zwevende kaart/lijst-knop |
| Plek | Foto/tekening → soort, naam, adres, open/dicht → kerngegevens (prijs, vertrekken, open, max. lengte) → **Aankomen en vertrekken** (met bron) → **Prijs en extra kosten** → contact → voorzieningen → route en kaart → praktisch → reviews → in de buurt → bronnen |
| Dichtbij | Locatievraag → chips (geen vaste vertrektijd, nu open, voorzieningen) in één scrollrij → kaart → lijst op rijtijd |
| Mijn reis | Stops met nachten → startpunt → route en kosten → delen en navigatie |

## Toegankelijkheid

- Doel: WCAG 2.1 AA (de European Accessibility Act geldt waarschijnlijk niet voor een gratis microbedrijf, maar we
  houden ons eraan).
- Contrast minstens 4,5:1 voor tekst in beide thema's.
- Tikdoelen minstens 44 × 44 px (bekende uitzonderingen: kaartmarkers, scoreknoppen in reviews; staan in fase B).
- Alles met toetsenbord bereikbaar, zichtbare focusring, labels op alle velden en pictogramknoppen
  (`aria-label` met de naam van de plek).
- `prefers-reduced-motion` zet animaties uit (`MotionConfig reducedMotion="user"`).

## Interactietoestanden

| Toestand | Weergave |
|---|---|
| Hover (desktop) | Iets donkerder of schaduw `shadow-lift` |
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
| Logo en app-icoon | Aanwezig (`web/src/app/icon.svg`, manifest) |
| Pictogrammen (voorzieningen, klok, soorten plek) | Aanwezig (`web/src/components/sign.tsx`, `icons.tsx`) |
| Getekende landschappen | Aanwezig (`landscape.tsx`); meer varianten per type plek gewenst (fase C) |
| Foto's van plekken | Nog nodig: van bezoekers, eigenaren en Wikimedia Commons (websitefoto's staan uit) |
| Screenshots voor app-stores | Later (fase C) |
