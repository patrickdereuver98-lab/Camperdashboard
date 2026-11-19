# Ontwerpsysteem VrijStaan: "natuur & vrijheid"

> **Bijgewerkt 8 november 2026 (README 113):** dit document volgt de [stijlgids](stijlgids.md) en besluit 75
> (randen in plaats van schaduw, hoeken maximaal `rounded-lg`). Bij een verschil gaat de stijlgids voor. Wat er op welk
> scherm staat, staat in de [UI/UX Brief](specs/04-ui-ux-brief.md).

## Uitgangspunt

VrijStaan gaat over het gevoel van vrij staan: een avond aan de bosrand, een plek aan het water, de camper onder
de ondergaande zon. Het ontwerp is warm en rustig: zandpapier als ondergrond, bosgroen als hoofdkleur, avondzon als
enkel accent en meerblauw voor water, routes en uitslapers. Eén lettertype, Geist, voor koppen, tekst en cijfers.

Het hoofdapparaat is een smartphone, vaak onderweg, bediend door camperaars van 40+ (ook flink ouder). Daarom: goed
leesbare tekst (16 px basis op de telefoon, 17 px vanaf tablet), tikvlakken van minimaal 44 px, contrast van minstens
4,5:1 en één duidelijke actie per scherm.

## Tokens

Alle kleuren staan als CSS-variabelen in `web/src/app/globals.css`, met een donkere variant ("avond in het bos").

| Naam | Licht | Donker | Gebruik |
|---|---|---|---|
| `paper` (zandpapier) | `#F5F0E6` | `#111713` | Pagina-achtergrond |
| `surface` | `#FFFCF6` | `#18201B` | Kaarten, panelen, header |
| `sunken` | `#EDE6D8` | `#222C26` | Verzonken vlakken, onbekende voorzieningen |
| `ink` / `ink-2` / `muted` | `#1F2B24` / `#46524A` / `#5C665E` | `#ECE7DB` / `#C7C2B6` / `#9AA39B` | Tekst |
| `forest` (bosgroen) | `#1F4E37` | `#8DBF9F` | Hoofdkleur: knoppen, links, pictogrammen, "open", geen vaste vertrektijd, bewaard hartje |
| `ember` (avondzon) | `#B9592A` | `#E8915C` | Alleen de hoofdactie op de startpagina en de gekozen plek op de kaart. Gratis plekken hebben geen eigen kleur (besluit 64) |
| `lake` (meerblauw) | `#2F6F7E` | `#82BCC8` | Water en routes op de kaart, uitslapers |
| `alert` | `#A8321D` | `#F08A72` | Fouten, "dicht" en "niet aanwezig" |

Typografie: **Geist** voor alles (koppen 600, tekst 400, cijfers `tabular-nums`), zelf gehost. Koppen alleen met
`text-h1` (24/36 px), `text-h2` (18/22 px) en `text-h3` (16/18 px). Fraunces en Inter zijn sinds 12 oktober 2026 weg.

## Vorm en diepte

- Hoeken: blokken en kaarten 8 px (`rounded-lg`), knoppen, velden en chips 6 tot 8 px, sheets 16 px aan de bovenkant
  (stijlgids §6).
- Randen van 1 px (`border-line`) in plaats van schaduw. Schaduw (`shadow-float`) alleen voor wat zweeft: sheets,
  toast, kaartpop-up, en een knop op een foto (stijlgids §7).
- Eén `Chip` voor elke aan/uit-keuze: uit = rand, aan = vol bosgroen met vinkje (stijlgids §10).
- Geen getekende landschappen of gevulde icoonblokjes. Een plek zonder foto krijgt een zandkleurig vlak met een klein
  lijnicoon van het soort plek.

## Layout (mobiel eerst)

```
┌──────────────────────────┐
│ ▣ VrijStaan     ?  ◐  ⎆  │  ← kop: logo, hulp, thema, inloggen
├──────────────────────────┤
│ Waar sta je vannacht?    │  ← h1
│ [Plekken bij mij       ] │  ← hoofdactie (avondzon)
│ [plaats of regio][Zoek ] │
│ Hoe wil je staan?        │  ← drie regels naar de vertrekpagina's
│ Populaire bestemmingen   │
├──────────────────────────┤
│ Start Zoeken Dichtbij ♡  │  ← tabbalk tot lg
└──────────────────────────┘
```

Resultaten: één lijst met een lijn onder elke rij (foto links, rechts vertrekbadge, naam, "Soort in plaats", score,
afstand, prijs met "+ toeslagen" of het totaal). Boven de lijst de snelle chips en één rij met Filters, Sorteren en
Kaart. Filters in een bottom sheet met een live teller ("Toon 128 plekken").

## Beweging

- Alleen beweging als reactie op een handeling: de bottom sheet schuift omhoog, het hartje springt en er verschijnt
  een korte bevestiging, uitklapblokken openen vloeiend en de foto morpht van resultaat naar plekpagina
  (React `<ViewTransition>`). Inhoud komt rustig binnen bij het laden van de start.
- Alleen `transform` en `opacity`, 150 tot 300 ms; `prefers-reduced-motion` zet alles uit.
