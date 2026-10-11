# Ontwerpsysteem VrijStaan: "natuur & vrijheid"

## Uitgangspunt

VrijStaan gaat over het gevoel van vrij staan: een avond aan de bosrand, een plek aan het water, de camper onder
de ondergaande zon. Het ontwerp is warm en rustig: zandpapier als ondergrond, bosgroen als hoofdkleur,
avondzon-accenten en meerblauw voor water en routes. Koppen in Fraunces geven karakter, Inter houdt alle
lopende tekst goed leesbaar.

Het hoofdapparaat is een smartphone, vaak onderweg en vaak bediend door 50-plussers. Daarom: grote tekst (17px basis),
grote tikvlakken (minimaal 44px), voldoende contrast en één duidelijke actie per scherm.

## Tokens

Alle kleuren staan als CSS-variabelen in `web/src/app/globals.css`, met een donkere variant ("avond in het bos").

| Naam | Licht | Donker | Gebruik |
|---|---|---|---|
| `paper` (zandpapier) | `#F5F0E6` | `#111713` | Pagina-achtergrond |
| `surface` | `#FFFCF6` | `#18201B` | Kaarten, panelen, header |
| `sunken` | `#EDE6D8` | `#222C26` | Verzonken vlakken, onbekende voorzieningen |
| `ink` / `ink-2` / `muted` | `#1F2B24` / `#46524A` / `#5C665E` | `#ECE7DB` / `#C7C2B6` / `#9AA39B` | Tekst |
| `forest` (bosgroen) | `#2D5A43` | `#8DBF9F` | Hoofdkleur: knoppen, links, pictogrammen, "open" |
| `ember` (avondzon) | `#B9592A` | `#E8915C` | Accent: hoofdactie op de startpagina, gratis plekken, geselecteerde plek op de kaart |
| `lake` (meerblauw) | `#2F6F7E` | `#82BCC8` | Water en routes op de kaart |
| `alert` | `#A8321D` | `#F08A72` | Fouten en "niet aanwezig" |

Typografie:
- **Fraunces** (variabel, `SOFT` 60 en optische grootte) voor koppen en prijzen, in gewicht 600. Een cursief accentwoord
  in de hoofdkop ("Waar sta je *vannacht?*").
- **Inter** voor alle lopende tekst, knoppen en formulieren.

## Kenmerkende elementen

- **Getekende landschappen.** Waar (nog) geen foto is, tekent de site een deterministisch landschap per plek
  (`components/landscape.tsx`): heuvels, bomen, zon en bij een jachthaven water. Het is duidelijk een illustratie
  en draagt het label "Nog geen foto", zodat niemand het voor een echte foto aanziet.
- **Voorzieningen als zachte pictogrammen.** Afgeronde bosgroene vlakken met een licht pictogram; onbekend is
  zandkleurig, "niet aanwezig" is doorgestreept.
- **De kop van de startpagina** is een kaart met een avondlandschap en daaronder de zoekvraag in Fraunces.

## Layout (mobiel eerst)

```
┌──────────────────────────┐
│ ▣ VrijStaan           ?  │  ← effen header
├──────────────────────────┤
│ ╭──────────────────────╮ │
│ │  ~ avondlandschap ~  │ │
│ │ Waar sta je vannacht?│ │  ← kop + zoekveld
│ │ [ plaats of regio  ] │ │
│ │ [Zoek camperplaats ] │ │  ← avondzon-knop
│ │ [Plekken dichtbij  ] │ │
│ ╰──────────────────────╯ │
│ [Nu open] [Stroom] [...] │  ← snelle ingangen
│ Meest complete plekken › │
│ Provincies (lijst)       │
├──────────────────────────┤
│ ⌂   ⌕   ◎   ♡            │  ← tabbalk
└──────────────────────────┘
```

Resultaten op mobiel: compacte rijen met foto (of landschap) links, naam, plaats, seizoensstatus, pictogrammen en
de prijs rechtsonder. Filters in een bottom sheet met een live teller ("Toon 128 plekken"). Lijst en kaart wisselen
via een zwevende knop boven de tabbalk.

## Beweging

- Eén georkestreerd moment: bij het laden van de startpagina komt de kop zacht omhoog in beeld.
- Verder alleen beweging als reactie op een handeling: de bottom sheet schuift omhoog, het hartje springt en er
  verschijnt een korte bevestiging, filterchips schuiven in en uit, stops in Mijn reis bewegen naar hun nieuwe plek,
  uitklapblokken openen vloeiend en de foto morpht van resultaat naar detailpagina (React `<ViewTransition>`).
- `prefers-reduced-motion` zet alles uit.
