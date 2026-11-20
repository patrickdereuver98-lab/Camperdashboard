"""Overture Maps Places (tier 3, verzamelbron: aanwijzing, geen bewijs) voor de tweede-bronnenpipeline.

Twee stappen:

1. `python tools/data-collectors/overture.py` haalt met DuckDB uit de Overture-release Nederland op (bbox en
   country = NL, categorieën campground, rv_park en marina, confidence >= 0,7) en schrijft
   `aanlevering/overture_nl.csv`. Dat bestand staat niet in git (.gitignore). Zonder het pip-pakket `duckdb`:
   `pip install duckdb`, of voer de query uit `QUERY` met de DuckDB-CLI en `COPY (...) TO 'overture_nl.csv'`.
2. `parse_overture_csv` zet die CSV om naar de standaardvorm (bron `overture`, type `file_overture` in bronnen.json).

Licentie: CDLA-Permissive-2.0 (records van Foursquare: Apache-2.0). Overture is een verzamelbron: een kandidaat telt
pas na bevestiging door de eigen site of een tweede toegestane bron. Overture alleen promoveert nooit
(geo_promotie_bezwaar: "één bron uit tier 3–5: een tweede toegestane bron is nodig").

Alleen feiten uit de export: naam, coördinaten, website, categorie. Geen beschrijvingen. Onbekend blijft leeg.
"""

from __future__ import annotations

import argparse
import csv
import io
import re
import sys
from pathlib import Path
from typing import Any

from parse_statics import ParseResult, parse_float, read_text
from pdok import clean_website

RELEASE = "2026-11-18.0"
S3 = f"s3://overturemaps-us-west-2/release/{RELEASE}/theme=places/type=place/*"
CATEGORIEEN = ("campground", "rv_park", "marina")
MIN_CONFIDENCE = 0.7
# Nederland (met de Waddeneilanden en Zeeland): ruim, de landcode filtert het echte werk
BBOX = {"xmin": 3.2, "xmax": 7.3, "ymin": 50.7, "ymax": 53.7}
HERE = Path(__file__).resolve().parent
DEFAULT_OUT = HERE / "aanlevering" / "overture_nl.csv"

QUERY = f"""
SELECT id,
       names.primary                       AS name,
       confidence,
       categories.primary                  AS cat,
       basic_category,
       addresses[1].country                AS cc,
       sources[1].dataset                  AS src,
       sources[1].license                  AS lic,
       ST_X(geometry)                      AS x,
       ST_Y(geometry)                      AS y,
       websites[1]                         AS website
FROM read_parquet('{S3}', hive_partitioning=1)
WHERE bbox.xmin BETWEEN {BBOX['xmin']} AND {BBOX['xmax']}
  AND bbox.ymin BETWEEN {BBOX['ymin']} AND {BBOX['ymax']}
  AND addresses[1].country = 'NL'
  AND categories.primary IN ({", ".join(repr(c) for c in CATEGORIEEN)})
  AND confidence >= {MIN_CONFIDENCE}
"""


def export(out: Path = DEFAULT_OUT) -> int:
    """Query uitvoeren en als CSV wegschrijven; geeft het aantal rijen."""
    try:
        import duckdb
    except ImportError as e:  # pragma: no cover
        raise SystemExit("duckdb ontbreekt: pip install duckdb (of draai QUERY met de DuckDB-CLI)") from e
    con = duckdb.connect()
    con.execute("INSTALL httpfs; LOAD httpfs; INSTALL spatial; LOAD spatial; SET s3_region='us-west-2';")
    out.parent.mkdir(parents=True, exist_ok=True)
    con.execute(f"COPY ({QUERY}) TO '{out.as_posix()}' (FORMAT CSV, HEADER)")
    return con.execute(f"SELECT count(*) FROM read_csv('{out.as_posix()}')").fetchone()[0]


# ── Inlezen ──────────────────────────────────────────────────────────────────

def parse_overture_csv(data: bytes, bron: str = "overture") -> ParseResult:
    """Export (kolommen id, name, confidence, cat, x, y, website, …) → standaardvorm.
    Rijen onder de confidence-drempel, zonder id of buiten de categorieën slaan we over, ook al zit de filter al in de
    export; een export van een andere hand krijgt zo dezelfde regels."""
    result = ParseResult()
    for row in csv.DictReader(io.StringIO(read_text(data))):
        cat = (row.get("cat") or row.get("basic_category") or "").strip().lower()
        if cat not in CATEGORIEEN:
            result.skip("categorie geen campground, rv_park of marina")
            continue
        conf = parse_float(row.get("confidence"))
        if conf is None or conf < MIN_CONFIDENCE:
            result.skip(f"confidence onder {MIN_CONFIDENCE}")
            continue
        cc = (row.get("cc") or "").strip().upper()
        if cc and cc != "NL":
            result.skip("buiten Nederland (landcode)")
            continue
        ref = (row.get("id") or "").strip()
        if not re.fullmatch(r"[0-9a-fA-F-]{8,40}", ref):
            result.skip("geen bruikbaar Overture-id")
            continue
        fac: dict[str, Any] = {"soort": cat}
        site = clean_website(row.get("website"))
        # Jachthavens niet via de proefroute (plan.md A3/A4): "vertrek vóór 12:00" op een havensite gaat vaak over boten.
        # Zonder website koppelt een haven alleen aan een bestaande plek; nieuwe havens komen via A4 (citaat over campers).
        if site and cat != "marina":
            fac["website"] = site
        result.add(name=row.get("name"), lat=parse_float(row.get("y")), lon=parse_float(row.get("x")), ref=ref,
                   bron=bron, facilities=fac)
    return result


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description="Overture Places Nederland → aanlevering/overture_nl.csv")
    ap.add_argument("--out", default=str(DEFAULT_OUT))
    args = ap.parse_args(argv)
    n = export(Path(args.out))
    print(f"{n} rijen naar {args.out}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
