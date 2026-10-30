# Dataverzamelaars

Partnerdata en open data samenvoegen tot één masterlijst (`geo_master` in Supabase). Drie losse stappen:

| Stap | Bestand | Wat |
|---|---|---|
| 1 | `api_client.py` | JSON ophalen van partner-API's, met exponential backoff bij 429, 5xx en netwerkfouten |
| 2 | `parse_statics.py` | Aangeleverde KML/KMZ, GPX en CSV omzetten naar de standaardvorm |
| 3 | `web/supabase/functions/pipeline/merge_master.ts` | Lijsten ontdubbelen en in stukken van 500 upserten (pipeline-actie `merge_master`) |

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

```bash
python tools/data-collectors/api_client.py https://api.partner.nl/v1/plekken --header "Authorization: Bearer …" --out uit/partner.json
```

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
