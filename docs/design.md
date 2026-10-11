# Ontwerpplan VrijStaan: "Wegwijzer"

## Uitgangspunt

Camperaars herkennen een camperplaats aan één ding: het blauwe bord met de witte camper erop. De Nederlandse
bewegwijzering (verkeersblauw, wit, ANWB-geel, heldere pictogrammen) is de visuele taal van de doelgroep. Ze is
functioneel, leesbaar van afstand en vertrouwd. Daar bouwen we op, in plaats van op een generieke "reissite"-stijl.

Het hoofdapparaat is een smartphone, vaak onderweg en vaak bediend door 50-plussers. Daarom: grote tekst (17px basis),
grote tikvlakken (minimaal 44px), hoog contrast en één duidelijke actie per scherm.

## Tokens

| Naam | Licht | Donker | Gebruik |
|---|---|---|---|
| `road` (verkeersblauw) | `#0F4C8A` | `#7DB3F2` | Merk, primaire knoppen, pictogrambordjes |
| `ink` | `#122033` | `#E8EEF6` | Tekst |
| `polder` (groen) | `#2E7A4B` | `#79C99A` | "Aanwezig", bevestigingen |
| `signal` (geel) | `#FFC629` | `#FFC629` | Prijs- en scorebadges, focus van de zoekbalk |
| `mist` | `#F3F5F4` | `#0D1726` | Pagina-achtergrond (koel, geen crème) |
| `surface` | `#FFFFFF` | `#152238` | Kaarten en panelen |

Typografie:
- **Overpass** (afgeleid van Highway Gothic, het lettertype van verkeersborden) voor koppen, scores en prijzen, in gewicht 700–800.
- **Atkinson Hyperlegible Next** (Braille Institute, ontworpen voor slechtzienden) voor alle lopende tekst.

Typeschaal 1.25 (16, 17, 20, 25, 31, 39, 49).

## Het opvallende element

**Pictogrambordjes.** Voorzieningen, plekttype en kaartmarkers zijn vierkante blauwe bordjes met afgeronde hoeken,
een witte binnenrand en een wit pictogram, zoals echte Nederlandse campingborden. Alles eromheen blijft rustig: witte
vlakken, dunne lijnen en geen decoratie.

De hero is zelf een bord: een groot verkeersblauw paneel met witte binnenrand, de zoekvraag in Overpass en daarin het
zoekveld.

## Layout (mobiel eerst)

```
┌──────────────────────────┐
│ ▣ VrijStaan         ♡ 3 │  ← compacte balk
├──────────────────────────┤
│ ╔══════════════════════╗ │
│ ║ Waar wil je staan?   ║ │  ← hero = bord
│ ║ [ plaats of regio  ] ║ │
│ ║ [Zoek camperplaats ] ║ │
│ ╚══════════════════════╝ │
│ [Gratis] [Stroom] [Dicht]│  ← snelle ingangen, horizontaal scrollen
│ Foto-rij uitgelicht ›    │
│ Provincies (lijst)       │
├──────────────────────────┤
│ ⌕   ◎   ♡   ☰           │  ← tabbalk
└──────────────────────────┘
```

Resultaten op mobiel: foto bovenaan (swipe), daaronder naam, plaats en afstand, een rij pictogrambordjes, en de prijs
rechtsonder. Filters in een bottom sheet met een live teller ("Toon 128 plekken"). Kaart via een zwevende knop.

Uitlijning: alles links uitgelijnd, behalve het getal in score- en prijsbadges.

## Vermeden standaardpatronen

Getoetst tegen de herkenbare kenmerken van gegenereerde sites (frontend-design-skill):

- Geen crème achtergrond met serif en terracotta. De eerste versie had precies dat en is vervangen.
- Geen enkel accentwoord in een kop, geen labels in hoofdletters, geen "A · B · C"-metaregels, geen "→" in knoppen.
- Geen identieke kaarten met dezelfde schaduw overal. Resultaten zijn rijen met een scheidingslijn; alleen zwevende
  elementen (sheet, kaart-preview) krijgen schaduw.
- Geen gradiënten als decoratie, geen emoji.
- Geen gegenereerde illustraties als fotovervanging. Zonder foto tonen we een bord met pictogram en de plaatsnaam.

## Beweging

- Eén georkestreerd moment: bij het laden van de homepage "klapt" het bord in beeld (schaal 0.98 naar 1, 300 ms).
- Verder alleen beweging als reactie op een handeling: de bottom sheet schuift omhoog, het hartje springt, en de foto
  morpht van resultaat naar detailpagina (React `<ViewTransition>`).
- `prefers-reduced-motion` zet alles uit.
