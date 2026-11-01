# Dataverzamelaars

Partnerdata en open data samenvoegen tot één masterlijst (`geo_master` in Supabase). Drie losse stappen:

| Stap | Bestand | Wat |
|---|---|---|
| 1 | `api_client.py` | JSON ophalen van partner-API's, met exponential backoff bij 429, 5xx en netwerkfouten |
| 2 | `parse_statics.py` | Aangeleverde KML/KMZ, GPX en CSV omzetten naar de standaardvorm |
| 2b | `map_api_data.py` | Ruwe API-respons (GeoJSON, Overpass of een lijst objecten) omzetten naar de standaardvorm |
| 2c | `pdok.py` | PDOK en gemeentelijke open data (WFS 2.0, OGC API Features of GeoJSON) ophalen per laag en omzetten |
| 3 | `web/supabase/functions/pipeline/merge_master.ts` | Lijsten ontdubbelen en in stukken van 500 upserten (pipeline-actie `merge_master`) |
| 4 | `promote_geo_master` (migratie `20261031090000`) | `geo_master` → `places` volgens de bronregels (pipeline-actie `promote`) |
| alles | `run_pipeline.py` + `bronnen.json` | De hele keten in één run; wekelijks via de workflow `data_pipeline.yml` |

## Standaardvorm

```json
{ "naam": "De Hoeve", "lat": 52.1, "lon": 5.2, "bron_id": "partner_x:77", "faciliteiten": { "stroom": true } }
```

- `naam` is `null` als de bron geen naam noemt. Niets wordt verzonnen: een leeg veld blijft leeg.
- `bron_id` is `<bron>:<id uit de bron>`; zonder id een vaste hash van naam en coördinaten.
- `faciliteiten` gebruikt vaste sleutels (`stroom`, `water`, `lozing`, `toilet`, `douche`, `wifi`, `honden`, `afval`,
  `jaarrond_open`, `reserveren`, `max_lengte_m`, `capaciteit`). Ja/nee wordt een boolean.

## Gebruik

```bash
pip install -r tools/data-collectors/requirements.txt
```

Van een API: ophalen (ruwe respons in `data/raw_api_data.json`), omzetten (`data/mapped_api_data.json`) en
lokaal proefdraaien met de merge-engine. `data/` staat niet in git.

```bash
python tools/data-collectors/api_client.py https://api.partner.nl/v1/plekken --header "Authorization: Bearer …"
```

```bash
python tools/data-collectors/map_api_data.py --bron partner_x
```

```bash
deno run --allow-read tools/data-collectors/test_merge.ts tools/data-collectors/data/mapped_api_data.json
```

`test_merge.ts` voegt samen zonder database, controleert elk record tegen de regels van `geo_master` en laat zien
wat er per stuk van 500 geüpsert zou worden. Meer lijsten mag, in volgorde van voorrang.

```bash
python tools/data-collectors/parse_statics.py aanlevering/*.csv aanlevering/*.kml --bron partner_x --out uit/partner_x.json
```

Samenvoegen: stuur alle lijsten in één keer naar de pipeline, in volgorde van voorrang (de eerste lijst wint bij
naam en coördinaten). Eerst met `"dry_run": true` om te zien wat er gebeurt:

```bash
jq -s '{action: "merge_master", dry_run: true, lists: .}' uit/partner_x.json uit/osm.json \
  | curl -sS -X POST "$PIPELINE_URL" -H "x-pipeline-key: $PIPELINE_KEY" -H "Content-Type: application/json" -d @-
```

## PDOK en gemeentelijke open data

Bron `pdok` (type `api_wfs`, tier 2) in `bronnen.json` heeft een lijst `lagen`, één per dataset:

```json
{ "id": "zwolle", "url": "https://service.pdok.nl/…/wfs/v1_0", "typename": "ns:camperplaatsen", "gemeente": "Zwolle",
  "velden": { "naam": "OBJECTNAAM", "id": "OBJECTID", "capaciteit": "AANTAL_PLAATSEN", "stroom": "ELEKTRA" } }
```

- Met `typename`: WFS 2.0 GetFeature als GeoJSON in EPSG:4326, per `pagina` (1000) met startIndex. Zonder: een
  GeoJSON- of OGC API Features-adres; `next`-links op dezelfde host worden gevolgd. Meer dan `max_paginas` (50) is
  een fout.
- RD (EPSG:28992) wordt WGS84 (pyproj). Omgedraaide assen herkent de parser aan Nederland. Een vlak wordt het
  zwaartepunt van de buitenrand; lijnen worden overgeslagen.
- `velden` koppelt standaardnamen (naam, id, gemeente, capaciteit, stroom, water, lozing, …) aan kolommen. `gemeente`
  (kolom of vast per laag) staat in `faciliteiten.gemeente`; geo_master heeft er geen eigen kolom voor.
- `srs`: `EPSG:4326` (standaard) of `EPSG:28992` (de server levert RD, wij rekenen om; nauwkeuriger dan sommige
  servers). `params`: extra parameters zoals `cql_filter` (GeoServer). `filter`: per kolom de toegestane waarden.
- bron_id: `pdok:<laag>/<id>`.
- Datasets zoeken: `python tools/data-collectors/zoek_ckan.py camperplaatsen camping verblijfsrecreatie`.
- `pdok` staat al op `actief` en in `geo_bronnen` op `toegestaan` (31 oktober 2026). Zonder lagen slaat de run de bron
  over met een waarschuwing; een laag toevoegen is genoeg.

## Partnerexports

`partner_1` (CSV) en `partner_2` (GPX) staan op `wacht_op_bestand`. Aanleveren alleen versleuteld:

```bash
openssl enc -aes-256-cbc -pbkdf2 -iter 200000 -in partner_1.csv -out tools/data-collectors/aanlevering/partner_1.csv.enc -pass env:AANLEVERING_SLEUTEL
```

De workflow ontsleutelt elk `aanlevering/*.enc` met het secret `AANLEVERING_SLEUTEL` naar dezelfde naam zonder `.enc`.
Kolommen met een eigen naam koppel je bij CSV met `velden` (`{"naam": "Plaatsnaam", "lat": "GPS N", "lon": "GPS E"}`).
Aanzetten: `status` op `actief` en in `geo_bronnen` op `toegestaan`, pas als de licentie rond is.

## Hoe het samenvoegen werkt

1. Kandidaten liggen binnen 100 m van elkaar (haversine), opgezocht via een raster, dus geen n² vergelijkingen.
2. Een nieuw record wordt alleen met het eerste record van een groep (het anker) vergeleken, zodat er geen ketting
   ontstaat van punten die steeds 90 m verder liggen.
3. Score = 0,8 × naamgelijkenis + 0,2 × nabijheid. Naamgelijkenis is Levenshtein na normaliseren (kleine letters,
   zonder accenten en zonder soortwoorden als "camperplaats" of "camping"), ook op gesorteerde woorden en gedeelde
   woorden. Drempel 0,75. Zonder naam aan één kant telt alleen de nabijheid: dat is samenvoegen binnen 25 m.
4. De master krijgt naam en coördinaten van het anker (geen gemiddelde), alle namen en bron_ids, en per faciliteit
   alleen een waarde als alle bronnen het eens zijn. Anders staat het onder `conflicten`.
5. `master_id` is het bron_id van het anker. Bevatte een eerdere master al een van de bron_ids, dan blijft het oude id
   staan; oude masters die in een andere groep zijn opgegaan, worden na een geslaagde run verwijderd.

Geef daarom bij elke run álle lijsten mee: een bron_id dat ontbreekt, blijft in zijn oude master staan.

## Tests

```bash
python -m pytest -q tools/data-collectors
```

```bash
cd web && node --no-warnings --import ./tests/register.mjs --test tests/merge-master.test.ts
```

## Automatisch: bronnen.json en de workflow

`bronnen.json` is een lijst van bronnen in volgorde van voorrang. `bron_id` is ook het voorvoegsel van elk record-id
en de sleutel in de tabel `geo_bronnen`. Alleen `"status": "actief"` draait; elke andere status wordt overgeslagen.

| type | velden |
|---|---|
| `api_overpass` | `url` (https) en `query`; POST naar Overpass, OSM-toelating zoals `osm.ts` (geen `motorhome=no`, geen `tents=only`) |
| `api` | `url`, optioneel `headers`, `params`, `pagineren` |
| `file_csv`, `file_gpx`, `file_kml` | `pad` binnen `tools/data-collectors` (moet in de repository staan; `data/` staat niet in git) |
| `bestanden` | `map` met KML/GPX/CSV-bestanden |

Actief: `osm` (tier 4; camp_site, caravan_site en parkeerplaatsen met motorhome=yes/designated, geen camp_pitch) en
`archies` (tier 3, README 74). Promotie naar `places` gebeurt pas als een plek in twee toegestane bronnen staat (tier
3–5): een plek die zowel in OSM als bij Archies staat. Een bestandsbron zonder bestand wordt overgeslagen met "wacht op
bestand"; de andere bronnen draaien door.

**Bestanden van derden** staan alleen versleuteld in de repository (die is openbaar): `aanlevering/<naam>.enc`. De
workflow ontsleutelt ze met het secret `AANLEVERING_SLEUTEL`. Een nieuwe aanlevering versleutelen:

```bash
openssl enc -aes-256-cbc -pbkdf2 -iter 200000 -salt -in aanlevering/x.gpx -out aanlevering/x.gpx.enc -pass env:AANLEVERING_SLEUTEL
```

Archie's Campings komt als GPX van heel Europa; `filter_archies.py` houdt alleen Nederland over (rechthoek én een
Nederlands nummer of geen nummer) en haalt naam, plaats en "hele jaar open" uit de naam.

- `${NAAM}` komt uit een GitHub-secret met die naam. Ontbreekt die, dan stopt de run (nooit met een lege sleutel).
- Lukt één bron niet, dan stopt de run vóór het samenvoegen; `merge_master` krijgt altijd alle lijsten tegelijk.
- Lokaal proberen (schrijft niets; aanmelden met `PIPELINE_KEY`):

```bash
PIPELINE_KEY=… python tools/data-collectors/run_pipeline.py --dry-run
```

Promotie naar `places` (`promote_geo_master`) gebeurt alleen bij:

1. een bron die een mens in `geo_bronnen` op `toegestaan` zette: tier 1–2 is genoeg, tier 3–5 vraagt twee
   verschillende toegestane bronnen. Geblokkeerd telt nooit;
2. een plek binnen Nederland (rechthoek én hoogstens 16 km van een plaats in `nl_towns`);
3. een echte naam (niet alleen "Camperplaats", geen URL of nummer);
4. geen wild- of paalkamperen in de namen of faciliteiten.

Ligt er al een plek binnen 60 m (of 150 m met een lijkende naam), dan wordt de master alleen gekoppeld: de bestaande
plek verandert niet. Anders komt er een nieuwe plek met alleen de waarden die de bron noemt; die blijft concept tot hij
contact en kernfeiten heeft. Afgewezen masters worden bij de volgende run opnieuw bekeken. De SQL-tests staan in
`web/supabase/tests/` (`run.sh`).
