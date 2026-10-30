"""Ruwe API-respons (data/raw_api_data.json) omzetten naar de standaardvorm voor merge_master.

    {"naam": str | None, "lat": float, "lon": float, "bron_id": str, "faciliteiten": dict}

Herkende vormen van de respons:
  - GeoJSON: FeatureCollection, één Feature, of een lijst Features. Coördinaten zijn [lon, lat].
  - Overpass (OpenStreetMap): {"elements": [...]} met lat/lon of center, en tags.
  - Gewone lijst objecten, ook ingepakt als {"data" | "items" | "results" | "records" | "plekken": [...]}.
    Coördinaten als lat/lon-velden (ook latitude, lng, …), als {"location" | "position" | "coordinates": {lat, lon}}
    of als "52.1,5.2".

Dezelfde regels als parse_statics.py (zelfde helpers): onbekend blijft leeg, coördinaten als tekst of met een
decimale komma worden getallen, ongeldige coördinaten en vlakken slaan we over (met reden), faciliteiten krijgen vaste
sleutels. Geneste faciliteiten ({"voorzieningen": {"stroom": "ja"}} of een lijst ["stroom", "water"]) worden plat
gemaakt.

Gebruik:

    python map_api_data.py --bron partner_x
    python map_api_data.py data/raw_api_data.json --bron partner_x --out data/mapped_api_data.json
"""

from __future__ import annotations

import argparse
import json
import logging
import sys
from pathlib import Path
from typing import Any

from api_client import DATA_DIR, DEFAULT_RAW_PATH, write_json
from parse_statics import (
    FACILITY_ALIASES, ID_KEYS, LAT_KEYS, LON_KEYS, NAME_KEYS, ParseResult, _pick, dedupe_ids, facilities_from,
    norm_key, parse_float,
)

log = logging.getLogger("map_api_data")

DEFAULT_MAPPED_PATH = DATA_DIR / "mapped_api_data.json"
LIST_KEYS = ("data", "items", "results", "records", "plekken", "places", "features", "elements")
NESTED_POINT_KEYS = ("location", "position", "locatie", "coordinates", "coordinaten", "geo", "point")
NESTED_FACILITY_KEYS = ("faciliteiten", "voorzieningen", "facilities", "amenities", "services", "tags")


def _flatten_facilities(obj: dict[str, Any]) -> dict[str, Any]:
    """Velden plus geneste faciliteiten op één niveau. Een lijst ["stroom", "water"] betekent: aanwezig."""
    fields: dict[str, Any] = {}
    for key, value in obj.items():
        nk = norm_key(str(key))
        if nk in NESTED_FACILITY_KEYS:
            if isinstance(value, dict):
                fields.update({str(k): v for k, v in value.items() if not isinstance(v, (dict, list))})
            elif isinstance(value, list):
                fields.update({str(v): "ja" for v in value if isinstance(v, str) and norm_key(v) in FACILITY_ALIASES})
        elif not isinstance(value, (dict, list)):
            fields[str(key)] = value
    return fields


def _point_from(obj: dict[str, Any]) -> tuple[float | None, float | None, set[str]]:
    """(lat, lon, gebruikte veldnamen) uit platte velden, een genest object of een tekst "lat,lon"."""
    lat_key, lat = _pick(obj, LAT_KEYS)
    lon_key, lon = _pick(obj, LON_KEYS)
    if lat_key and lon_key:
        return parse_float(lat), parse_float(lon), {lat_key, lon_key}
    for key, value in obj.items():
        if norm_key(str(key)) not in NESTED_POINT_KEYS:
            continue
        if isinstance(value, dict):
            _, nlat = _pick(value, LAT_KEYS)
            _, nlon = _pick(value, LON_KEYS)
            return parse_float(nlat), parse_float(nlon), {norm_key(str(key))}
        if isinstance(value, str) and value.count(",") == 1 and "." in value:
            a, b = value.split(",")
            return parse_float(a), parse_float(b), {norm_key(str(key))}
    return None, None, set()


def map_geojson(features: list[Any], bron: str, keep_unknown: bool) -> ParseResult:
    result = ParseResult()
    for f in features:
        if not isinstance(f, dict):
            result.skip("geen object")
            continue
        geom = f.get("geometry") or {}
        if geom.get("type") != "Point":
            result.skip("geen punt (vlak, lijn of geen geometrie)")
            continue
        coords = geom.get("coordinates") or []
        lon = parse_float(coords[0]) if len(coords) >= 2 else None
        lat = parse_float(coords[1]) if len(coords) >= 2 else None
        props = f.get("properties") or {}
        name_key, name = _pick(props, NAME_KEYS)
        id_key, ref = _pick(props, ID_KEYS)
        used = {k for k in (name_key, id_key) if k}
        result.add(name=name, lat=lat, lon=lon, ref=f.get("id") if f.get("id") is not None else ref, bron=bron,
                   facilities=facilities_from(_flatten_facilities(props), keep_unknown, skip=used))
    return result


def map_overpass(elements: list[Any], bron: str, keep_unknown: bool) -> ParseResult:
    result = ParseResult()
    for e in elements:
        if not isinstance(e, dict):
            result.skip("geen object")
            continue
        center = e.get("center") or {}
        lat = parse_float(e.get("lat", center.get("lat")))
        lon = parse_float(e.get("lon", center.get("lon")))
        tags = e.get("tags") or {}
        ref = f"{e.get('type', 'node')}/{e['id']}" if e.get("id") is not None else None
        result.add(name=tags.get("name"), lat=lat, lon=lon, ref=ref, bron=bron,
                   facilities=facilities_from(tags, keep_unknown, skip=["name"]))
    return result


def map_records(items: list[Any], bron: str, keep_unknown: bool) -> ParseResult:
    result = ParseResult()
    for item in items:
        if not isinstance(item, dict):
            result.skip("geen object")
            continue
        lat, lon, used = _point_from(item)
        name_key, name = _pick(item, NAME_KEYS)
        id_key, ref = _pick(item, ID_KEYS)
        used |= {k for k in (name_key, id_key) if k}
        result.add(name=name, lat=lat, lon=lon, ref=ref, bron=bron,
                   facilities=facilities_from(_flatten_facilities(item), keep_unknown, skip=used))
    return result


def map_raw(raw: Any, bron: str, keep_unknown: bool = False) -> ParseResult:
    """Herkent de vorm van de respons en zet hem om."""
    if isinstance(raw, dict):
        if raw.get("type") == "FeatureCollection":
            return map_geojson(raw.get("features") or [], bron, keep_unknown)
        if raw.get("type") == "Feature":
            return map_geojson([raw], bron, keep_unknown)
        if isinstance(raw.get("elements"), list):
            return map_overpass(raw["elements"], bron, keep_unknown)
        for key in LIST_KEYS:
            if isinstance(raw.get(key), list):
                return map_raw(raw[key], bron, keep_unknown)
        raise ValueError(f"Onbekende vorm: object met sleutels {sorted(raw)[:10]}")
    if isinstance(raw, list):
        if raw and all(isinstance(x, dict) and x.get("type") == "Feature" for x in raw):
            return map_geojson(raw, bron, keep_unknown)
        return map_records(raw, bron, keep_unknown)
    raise ValueError(f"Onbekende vorm: {type(raw).__name__}")


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description="Ruwe API-JSON → standaardvorm voor merge_master.")
    ap.add_argument("input", nargs="?", default=str(DEFAULT_RAW_PATH))
    ap.add_argument("--bron", required=True, help="bronnaam voor bron_id, bv. partner_x")
    ap.add_argument("--out", default=str(DEFAULT_MAPPED_PATH))
    ap.add_argument("--alle-velden", action="store_true", help="ook velden met een onbekende naam bewaren")
    args = ap.parse_args(argv)
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")

    try:
        raw = json.loads(Path(args.input).read_text(encoding="utf-8"))
        result = map_raw(raw, norm_key(args.bron), args.alle_velden)
    except (OSError, ValueError) as e:
        log.error("%s: %s", args.input, e)
        return 1
    records = dedupe_ids(result.records)
    log.info("%d plekken, overgeslagen %s", len(records), result.skipped or "geen")
    log.info("geschreven: %s", write_json(records, args.out))
    return 0


if __name__ == "__main__":
    sys.exit(main())
