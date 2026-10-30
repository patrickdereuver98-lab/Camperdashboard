# Dataverzamelaars

Partnerdata en open data samenvoegen tot één masterlijst (`geo_master` in Supabase). Drie losse stappen:

| Stap | Bestand | Wat |
|---|---|---|
| 1 | `api_client.py` | JSON ophalen van partner-API's, met exponential backoff bij 429, 5xx en netwerkfouten |
| 2 | `parse_statics.py` | Aangeleverde KML/KMZ, GPX en CSV omzetten naar de standaardvorm |
| 2b | `map_api_data.py` | Ruwe API-respons (GeoJSON, Overpass of een lijst objecten) omzetten naar de standaardvorm |
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

`bronnen.json` noemt de bronnen in volgorde van voorrang. `bron` is ook het voorvoegsel van elk `bron_id` en de sleutel
in de tabel `geo_bronnen`.

```json
{ "bronnen": [
  { "bron": "partner_x", "type": "api", "url": "https://api.partner.example/v1/plekken",
    "headers": { "Authorization": "Bearer ${PARTNER_X_TOKEN}" }, "pagineren": { "param": "page", "items_key": "items" } },
  { "bron": "partner_y", "type": "bestanden", "map": "aanlevering/partner_y" }
] }
```

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
