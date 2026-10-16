# VrijStaan stijlgids

> De ontwerpregels voor elke pagina en elk component. Bij twijfel gaat deze gids voor; de UI/UX Design Brief
> (`docs/specs/04-ui-ux-brief.md`) beschrijft wat er op welk scherm staat, deze gids hoe het eruitziet en beweegt.
> Opgesteld 12 oktober 2026 na feedback van de eigenaar ("te groot, te AI, te kinderlijk; de kleuren zijn goed"),
> met als bronnen de skills design-taste-frontend, minimalist-ui, high-end-visual-design en redesign (taste-skill),
> ui-ux-pro-max, Vercel react-best-practices en de Vercel Web Interface Guidelines. Alles daaruit is vertaald naar
> VrijStaan: een rustige, betrouwbare gids voor camperaars van 55+, op een telefoon, onderweg.

## 1. Richting in één zin

Een professionele, rustige reisgids: veel informatie in één oogopslag, niets dat schreeuwt, alles klopt tot op de
pixel. Denk aan een goed gemaakte kaart of reisgids, niet aan een speelse app.

**Ontwerpknoppen** (uit design-taste-frontend, 1–10):

| Knop | Stand | Betekenis voor ons |
|---|---|---|
| Variatie in layout | 4 | Rustig en voorspelbaar; links uitgelijnd, geen schuine of overlappende blokken |
| Beweging | 4 | Vloeiend en kort, alleen als reactie of bij het verschijnen van content |
| Dichtheid | 6 | Een gids, geen folder: compact, maar met lucht tussen groepen |

## 2. Wat we nooit doen (AI-kenmerken)

- Geen Fraunces of andere "zachte" sierletters; geen serif-koppen. Eén lettertype voor alles.
- Geen grote gekleurde vlakken als achtergrond van secties, geen verlopen (gradients) als decoratie.
- Geen dikke randen (2 px) om knoppen en velden; altijd 1 px of alleen een schaduw.
- Geen bubbelige hoeken (24–28 px) op kaarten; zie de hoekschaal hieronder.
- Geen gevulde gekleurde icoonblokjes naast elk gegeven; iconen zijn lijnen, kleur alleen als het iets betekent.
- Geen kopjes in hoofdletters, geen labels boven elke kop, geen "→" in knoppen, geen middenpunten.
- Geen getekende landschappen als vervanging van een foto op kaarten; een rustige lege staat is professioneler.
- Geen `transition: all`, geen `linear` of standaard `ease-in-out`; geen bewegingen die niet uit zichzelf stoppen.
- Geen tekst onder 14 px, geen tikdoel onder 44 px (onze doelgroep gaat voor).

## 3. Kleur (blijft zoals hij is)

De kleuren staan vast en zijn goedgekeurd: zandpapier, bosgroen, avondzon, meerblauw (zie `globals.css`).
Spelregels:

- **Eén accent per scherm.** Bosgroen is de hoofdkleur (knoppen, links, "aanwezig"). Avondzon alleen voor de
  hoofdactie op de startpagina en de geselecteerde plek op de kaart. Meerblauw alleen voor water en uitslapers.
- **Kleur is betekenis.** Een groene badge betekent "geen vaste vertrektijd", niet "mooi". Grote vlakken zijn
  zandpapier of wit (`surface`); getinte vlakken (`forest-tint`) alleen klein (badge, chip).
- **Tekst**: `ink` voor koppen en waarden, `ink-2` voor lopende tekst, `muted` voor bijzaken. Nooit zuiver zwart.
- Contrast minstens 4,5:1 in licht en donker; elke combinatie die nieuw is, eerst meten.

## 4. Typografie

**Lettertype: Geist** (variabel, zelf gehost via `next/font`), voor koppen, tekst, knoppen en cijfers. Strak,
neutraal en goed leesbaar op kleine schermen; vervangt Fraunces + Inter.

| Rol | Telefoon | Vanaf `sm` | Gewicht | Overig |
|---|---|---|---|---|
| Paginakop (h1) | 24 px | 30–36 px | 600 | `tracking-tight`, `text-balance` |
| Sectiekop (h2) | 18 px | 22 px | 600 | `tracking-tight` |
| Kaarttitel (h3) | 16 px | 18 px | 600 | `leading-snug` |
| Tekst | 16 px | 17 px | 400 | regelafstand 1,55, max. ±65 tekens breed |
| Klein | 14 px | 14 px | 400/500 | minimum voor alle tekst |
| Prijzen en aantallen | | | 600 | `tabular-nums` |

- Hiërarchie maak je met gewicht en kleur, niet met steeds grotere letters.
- Koppen in zinsvorm ("Over deze plek"), nooit in hoofdletters.
- `…` in plaats van `...`; laadteksten eindigen op `…` ("Bezig…").

## 5. Ruimte en maat

- Raster van 4 px. Binnen een kaart 12–16 px, tussen kaarten 10–12 px, tussen secties 32 px (telefoon) en 48 px
  (groter scherm). Geen enorme witruimte: dit is een gids.
- Zijmarge telefoon 12–16 px. Tekstblokken maximaal `max-w-prose`.
- Header 56 px op de telefoon. Tikdoelen minstens 44 px; visueel mag een knop kleiner ogen zolang het tikvlak klopt.

## 6. Hoeken (één schaal, overal)

| Element | Hoek |
|---|---|
| Knoppen, invoervelden, kleine panelen | 8 px (`rounded-lg`) |
| Kaarten, blokken, kaartweergave | 12 px (`rounded-xl`) |
| Sheets, grote vlakken | 16 px (`rounded-2xl`), alleen aan de bovenkant bij een sheet |
| Chips en badges | rond (`rounded-full`) of 6 px (`rounded-md`) voor vertrekbadges |

## 7. Diepte en schaduw

Drie lagen, warm getint (geen grijze schaduw op zandpapier), altijd met een haarlijn in plaats van een rand:

| Token | Gebruik |
|---|---|
| `shadow-low` | Kaarten en blokken in rust: haarlijn + nauwelijks zichtbare schaduw |
| `shadow-raised` | Hover op kaarten, dropdowns, kaartpop-up |
| `shadow-float` | Sheets, zoekkaart, toast |

Een kaart bestaat alleen als hij iets groepeert; losse informatie staat op de achtergrond met witruimte of een
scheidingslijn (`divide-y`). Geen kaart in een kaart in een kaart.

## 8. Iconen

- Lijniconen van 1,75 px, in `ink-2` of `forest`. Eén set, één lijndikte.
- Voorzieningen: icoon zonder gevuld blok. Aanwezig = bosgroen icoon op een heel lichte groene ondergrond;
  niet aanwezig = grijs icoon met een rode streep; onbekend = lichtgrijs icoon.
- Geen emoji. Icoon-knoppen hebben altijd een `aria-label`.

## 9. Beweging

| Soort | Duur | Curve |
|---|---|---|
| Hover, druk, kleur | 150–200 ms | `--ease-out` = `cubic-bezier(0.16, 1, 0.3, 1)` |
| Openen (sheet, uitklappen) | 220–280 ms | `--ease-out`; sluiten iets sneller |
| Content verschijnt (lijsten, secties) | 280–360 ms, 40 ms vertraging per item, max. 8 items | `--ease-out` |
| Pagina-overgang (foto morpht) | ±380 ms | `cubic-bezier(0.2, 0, 0, 1)` |

- Alleen `transform` en `opacity` animeren. Nooit `top`, `width`, `height` of `transition: all`.
- Kaarten: bij hover 1 px omhoog + `shadow-raised`; bij indrukken `scale(0.985)`.
- Knoppen: bij indrukken `scale(0.98)`.
- `prefers-reduced-motion`: alles direct in eindstand.

## 10. Componenten

- **Knop primair**: bosgroen vlak, witte tekst, 44 px hoog, 8 px hoek, geen rand, geen schaduw.
- **Knop secundair**: `surface`, 1 px haarlijn (`border-line`), tekst `ink`.
- **Tekstlink**: bosgroen, onderstreept met `underline-offset-2`.
- **Invoerveld**: 44 px, 8 px hoek, 1 px haarlijn, focus = bosgroene ring.
- **Plekkaart (rij)**: foto ±⅓ links, rechts: naam, "Soort in plaats", afstand, vertrekbadge + aankomst,
  voorzieningen + prijs onderaan. 12 px hoek, `shadow-low`.
- **Vertrekbadge**: 6 px hoek, klein klokje, getint vlak (groen/blauw/grijs). Het enige gekleurde element op een kaart.
- **Lege foto**: zandkleurig vlak met een klein lijnicoon van het soort plek; geen tekening.
- **Lege staat, fout, laden**: zie Design Brief; laden altijd met skeletvormen van de echte layout.

## 11. Snelheid

- Lettertypes zelf gehost (`next/font`), geen externe fontverzoeken.
- Foto's verkleind via wsrv.nl (WebP, juiste breedte), `loading="lazy"` buiten beeld, vaste verhouding (geen CLS).
- Lange lijsten: `content-visibility: auto` met een geschatte hoogte.
- Zware onderdelen (kaart) pas laden als ze nodig zijn; geen nieuwe bibliotheken zonder reden.
- Doelen: LCP < 2,5 s, CLS < 0,1, INP < 200 ms op een gemiddelde telefoon.

## 12. Controle vóór elke push

1. `npm run check` en `VRIJSTAAN_OFFLINE=1 npm run build` zijn schoon.
2. Screenshot op iPhone-formaat (390 × 844), licht en donker, van elk gewijzigd scherm.
3. Geen van de punten uit §2 komt voor (zoek in de diff op `border-2`, `rounded-[`, `transition-all`, `font-display`
   met andere fonts, emoji).
4. Tekst nagelezen volgens `.claude/skills/vrijstaan-stijl` (geen gedachtestreepjes, geen verkooppraat).
