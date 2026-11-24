# Design: VrijStaan

> Samenvatting voor Impeccable. Bron en voorrang: `docs/stijlgids.md`, `docs/specs/04-ui-ux-brief.md`, tokens in
> `web/src/app/globals.css`. De kleuren en het lettertype staan vast (besluit eigenaar 12 oktober 2026).

## Kleuren (licht / donker)
- paper (zandpapier) `#F5F0E6` / `#111713`: achtergrond
- surface `#FFFCF6` / `#18201B`: kaarten, header
- sunken `#EDE6D8` / `#222C26`: verzonken vlakken, onbekend
- ink `#1F2B24` / `#ECE7DB`, ink-2 `#46524A` / `#C7C2B6`, muted `#5C665E` / `#9AA39B`: tekst
- forest (bosgroen) `#1F4E37` / `#8DBF9F`: hoofdkleur, acties, "geen vaste vertrektijd"
- ember (avondzon) `#B9592A` / `#E8915C`: alleen hoofdactie op de start en de gekozen plek op de kaart
- lake (meerblauw) `#2F6F7E` / `#82BCC8`: water, routes, uitslapers (vertrek 12:00 of later)
- alert `#A8321D` / `#F08A72`: fouten en "dicht"
Kleur betekent iets; één accent per scherm.

## Typografie
Geist voor alles, geen serif, geen sierletters. Koppen `text-h1` 24/36, `text-h2` 18/22, `text-h3` 16/18 px.
Basis 16 px, kleine tekst minstens 14 px, cijfers met `tabular-nums`.

## Vorm
Randen van 1 px in plaats van schaduw (schaduw alleen voor wat zweeft: sheets, toast, kaartpop-up). Hoeken maximaal
8 px voor blokken, 6 px voor chips, 16 px voor sheets. Tikdoelen minstens 44 px, contrast minstens 4,5:1.

## Componenten
`Chip` voor elke aan/uit-keuze (uit = rand, aan = vol bosgroen met vinkje). Plekkaart als rij (compact) of stapel.
Vertrekbadge: bosgroen, meerblauw of neutraal, met tekst en niet alleen kleur.

## Beweging
Kort en vloeiend (150 tot 300 ms, `--ease-out`), alleen `transform` en `opacity`, respecteer `prefers-reduced-motion`.
