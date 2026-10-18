# Nulmeting dataplan (18 oktober 2026, 23:45)

> Dataplan Fase 0, taak W0.5. Live database, alleen lezen. Dient als vertrekpunt om de groei van de bronnenlaag te meten.

**Alle 3.605 plekken komen uit OpenStreetMap.** Er is nog geen tweede, onafhankelijke bron voor het bestaan van
plekken. Daardoor weten we niet hoeveel camperplaatsen er in Nederland zijn die OSM mist: de dekking is onbekend.
De eerste werkitems (gemeentelijke camperplaatsen per provincie) leveren die tweede bron; daarmee schatten we het
totaal met de overlap (capture-recapture).

## Totaal

| Meting | Aantal |
|---|---|
| Plekken in de database | 3.605 |
| Gepubliceerd | 1.944 |
| Gepubliceerd met vertrekregel | 1.209 (62%) |
| Gepubliceerd met prijs | 1.127 (58%) |
| Zonder vertrektijd (`vrij` of `per24`), gepubliceerd | 30 |
| Vertrekregel door een mens gecontroleerd | 0 |
| Met website | 3.225 |
| Uit OSM / handmatig toegevoegd | 3.605 / 0 |

## Per soort

| Soort | Totaal | Gepubliceerd | Zonder vertrektijd | Vertrekregel onbekend | Geen website of telefoon |
|---|---|---|---|---|---|
| Camping | 2.759 | 1.440 | 11 | 1.753 | 198 |
| Camperplaats | 434 | 289 | 17 | 309 | 81 |
| Boerderij | 345 | 183 | 3 | 215 | 11 |
| Jachthaven | 52 | 32 | 0 | 40 | 8 |
| Parkeerplaats | 15 | 0 | 0 | 15 | 13 |

## Per provincie

| Provincie | Plekken | Camperplaatsen | Zonder vertrektijd |
|---|---|---|---|
| Gelderland | 626 | 68 | 8 |
| Zeeland | 458 | 24 | 2 |
| Noord-Brabant | 413 | 48 | 3 |
| Overijssel | 398 | 71 | 3 |
| Friesland | 369 | 58 | 0 |
| Noord-Holland | 302 | 28 | 0 |
| Drenthe | 284 | 19 | 0 |
| Limburg | 247 | 28 | 5 |
| Zuid-Holland | 193 | 36 | 1 |
| Groningen | 160 | 30 | 5 |
| Utrecht | 96 | 14 | 2 |
| Flevoland | 59 | 10 | 2 |

## Wat dit betekent voor het plan

- Bij camperplaatsen, het belangrijkste type, is de vertrekregel bij 309 van 434 onbekend (71%). Dat is de grootste
  winst voor de kernbelofte; de pipeline-sessie pakt het via haar stap 3 (`verify`) aan, de bronnenlaag vult aan met
  fora, directories en gemeentes.
- 81 camperplaatsen hebben geen website of telefoon. Vaak zijn dat gemeentelijke plekken; de gemeentesite is daar de
  tier-1-bron.
- Friesland, Noord-Holland en Drenthe hebben samen 105 camperplaatsen en nog geen enkele zonder vertrektijd. Die
  provincies krijgen voorrang bij `ontdek_fora`.

## Herhalen

```sql
select count(*) total,
       count(*) filter (where status = 'published') published,
       count(*) filter (where status = 'published' and departure in ('vrij', 'per24')) zonder_vertrektijd,
       count(*) filter (where osm_id is null) niet_uit_osm
  from places;
select public.bron_overview();  -- na Fase 0: stand van de bronnenlaag
```
