"""Datasets zoeken op data.overheid.nl (CKAN) voor de bron pdok: titel, organisatie en links naar WFS, GeoJSON, CSV.

    python tools/data-collectors/zoek_ckan.py camperplaatsen camping verblijfsrecreatie

Alleen lezen; schrijft niets. Een gevonden dataset wordt een laag in bronnen.json (zie README, PDOK).
Zoektocht 1 november 2026: bruikbaar was alleen Zuid-Holland (VOORZIENINGEN_PUNT); Overijssel heeft een goede
dataset (B5.verblijfsrecreatie_polygon, met namen) maar geen openbare WFS, Noord-Holland Noord geeft het soort alleen
als kleurcode en is verouderd.
"""

from __future__ import annotations

import json
import sys
import urllib.parse
import urllib.request

BASE = "https://data.overheid.nl/data/api/3/action/package_search"
FORMATS = ("wfs", "geojson", "json", "csv", "ogc", "zip", "kml")


def search(q: str, rows: int = 100) -> dict:
    url = BASE + "?" + urllib.parse.urlencode({"q": q, "rows": rows})
    req = urllib.request.Request(url, headers={"User-Agent": "VrijStaan-dataketen/1.0 (+https://vrijstaan.nl)"})
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.load(r)["result"]


def main(argv: list[str]) -> int:
    seen: set[str] = set()
    for q in argv or ["camperplaatsen"]:
        res = search(q)
        print(f"## {q!r}: {res['count']} datasets")
        for p in res["results"]:
            if p["name"] in seen:
                continue
            seen.add(p["name"])
            org = (p.get("organization") or {}).get("title")
            print(f"- {p['title']} | {org} | {p.get('license_title')} | https://data.overheid.nl/dataset/{p['name']}")
            for rsrc in p.get("resources", []):
                text = ((rsrc.get("format") or "") + " " + (rsrc.get("url") or "")).lower()
                if any(k in text for k in FORMATS):
                    print(f"    {rsrc.get('url')}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
