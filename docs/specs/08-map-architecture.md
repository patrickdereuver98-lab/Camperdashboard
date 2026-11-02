# Kaartarchitectuur: licht/donker en de vraag "migreren naar MapLibre?"

Datum: 2 november 2026. Status: **besloten**, zie het besluit onderaan.

## Aanleiding

De kaart wisselde niet mee als het systeem bij zonsondergang naar donker ging; pas na herladen. In de opdracht stond
het voorstel om daarom van "raster/Leaflet" te migreren naar MapLibre GL JS (`react-map-gl`) met vectortegels.

## Huidige stack (gecontroleerd in de code)

De aanname "raster/Leaflet" klopt niet. De kaart is al wat het voorstel beschrijft, alleen zonder React-wrapper:

| Onderdeel | Nu | Waar |
|---|---|---|
| Kaartbibliotheek | MapLibre GL JS 6 (`maplibre-gl`), dynamisch geladen, worker in `public/` | `web/src/components/place-map.tsx`, `scripts/copy-maplibre-worker.mjs` |
| Tegels | Vectortegels van OpenFreeMap, stijlen `positron` (licht) en `dark`; geen key nodig, staat in de CSP | `STYLE_LIGHT`, `STYLE_DARK`, `next.config.ts` |
| Clustering | Native: GeoJSON-bron met `cluster: true`, `clusterRadius` 46, `clusterMaxZoom` 10; groepskleuren uit `clusterColors` | `place-map.tsx`, `lib/map-data.ts` |
| Stippen | Cirkellagen op kleur van de vertrekregel, holle stip bij onbekend, prijs als tekstlaag, onzichtbaar tikvlak van 44 px | `place-map.tsx` |
| Pop-up | React via een portal in het vak van MapLibre (hartje werkt zoals overal) | `PopupCard` |
| Kaartknoppen | Eigen CSS, nu op `data-theme` in plaats van de media query | `place-map.css` |

Er is geen Leaflet en er zijn geen rastertegels in het project (`package.json`).

## Wat een migratie naar `react-map-gl` zou opleveren

| Beoogd voordeel | Hebben we al? |
|---|---|
| Vectortegels, minder data op mobiel | Ja (OpenFreeMap) |
| Native clustering via GeoJSON | Ja |
| Snel bij ±2.200 plekken | Ja: één GeoJSON-bron, clustering in de worker |
| Thema wisselen zonder herladen | Nu ja, zie hieronder; `react-map-gl` doet bij een andere `mapStyle` intern ook `setStyle` en moet onze eigen lagen dan opnieuw toevoegen |
| Declaratieve `<Source>`/`<Layer>` | Nee. Dit is het enige echte verschil: leesbaarder, maar geen winst voor de gebruiker |

Kosten van migreren: nieuwe afhankelijkheid, alle lagen, klikgedrag, tikvlakken, pop-up-portal en foutafhandeling
herschrijven, en de e2e- en a11y-tests (licht en donker, 44 px-regel) opnieuw groen krijgen. Schatting: 1 tot 2 dagen
plus testen, vlak voor een soft-launch met 100 bètagebruikers, voor geen zichtbaar verschil.

## Besluit

**Geen migratie, nu niet en niet als gepland V1.1-werk.** De kaart is al MapLibre met vectortegels en native clustering.
Het echte probleem, de kaart die niet meewisselt, is opgelost met de kleine fix:

- Het thema staat als `data-theme` op `<html>` (`lib/theme.ts`), volgt het systeem live en kan met de zon/maan-knop
  worden vastgezet.
- `useDarkTheme()` in `lib/use-media.ts` levert het actieve thema; `place-map.tsx` bouwt de kaart bij een wissel
  opnieuw op met de andere stijl en dezelfde stippen- en clusterkleuren als bij het laden. Middelpunt en zoom blijven
  staan en de kaart zoomt niet opnieuw naar de plekken. Een open pop-up sluit.
- Getest in `web/e2e/theme.spec.ts`: de kaart vraagt na een wissel de donkere stijl op zonder herladen.

Eventuele verbetering later (geen planning nodig, alleen als het in de bèta opvalt): in plaats van opnieuw opbouwen
`map.setStyle(url, { transformStyle })` gebruiken en onze bronnen en lagen in de nieuwe stijl meenemen. Dan blijft de
canvas staan en is er geen korte "Kaart laden…". `react-map-gl` heroverwegen we alleen als de kaartcode flink groeit en
de declaratieve vorm onderhoud echt scheelt.
