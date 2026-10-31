"""Aangeleverde KML-, KMZ-, GPX- en CSV-bestanden omzetten naar de standaardvorm van de dataverzamelaars.

Elke plek wordt:

    {"naam": str | None, "lat": float, "lon": float, "bron_id": str, "faciliteiten": dict}

Spelregels (docs/specs/README.md):
  - Nooit data verzinnen. Een veld dat de bron niet noemt, ontbreekt; een lege naam wordt None, niet "Onbekend".
  - Alleen punten. Een KML-vlak of -lijn, of een GPX-track, heeft geen eenduidige plek en slaan we over (met reden).
  - Coördinaten buiten de wereld of precies (0, 0) slaan we over: dat is bijna altijd een lege cel.

Faciliteiten: kolommen of velden met een bekende naam (stroom, water, toilet, …, ook Engels en OSM-tags) krijgen een
vaste sleutel. "ja/nee/yes/no/true/false/1/0" wordt een boolean; een andere tekst blijft tekst ("betaald",
"16A"). Velden met een onbekende naam laten we weg, tenzij `--alle-velden` (dan onder hun eigen, opgeschoonde naam).

`bron_id` is `<bron>:<id>`. Het id komt uit de bron (kolom id/ref/code, KML-`id`, GPX-naam met coördinaten); is er
geen, dan een vaste hash van naam en coördinaten (6 decimalen), zodat een volgende levering hetzelfde id geeft.

Gebruik:

    python parse_statics.py plekken.csv route.gpx kaart.kml --bron partner_x --out uit/partner_x.json
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import io
import json
import logging
import math
import re
import sys
import unicodedata
import xml.etree.ElementTree as ET
import zipfile
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Iterable, Iterator

log = logging.getLogger("parse_statics")

# ── Vaste namen ──────────────────────────────────────────────────────────────

NAME_KEYS = ("naam", "name", "titel", "title", "plaatsnaam", "omschrijving_kort")
LAT_KEYS = ("lat", "latitude", "breedtegraad", "breedte", "y", "wgs84_lat")
LON_KEYS = ("lon", "lng", "long", "longitude", "lengtegraad", "lengte", "x", "wgs84_lon", "wgs84_lng")
ID_KEYS = ("id", "bron_id", "ref", "code", "nummer", "external_id", "osm_id", "uid")

# Synoniemen → vaste faciliteitsleutel (zelfde woorden als de site: stroom, water, lozing, …)
FACILITY_ALIASES: dict[str, str] = {
    **dict.fromkeys(("stroom", "elektriciteit", "electricity", "power", "power_supply", "stroomaansluiting"), "stroom"),
    **dict.fromkeys(("water", "drinkwater", "drinking_water", "water_point", "watertappunt"), "water"),
    **dict.fromkeys(("lozing", "lozingspunt", "afvalwater", "grijswater", "chemisch_toilet", "dump", "dump_station",
                     "sanitary_dump_station", "chemical_toilet"), "lozing"),
    **dict.fromkeys(("toilet", "toiletten", "toilets", "wc"), "toilet"),
    **dict.fromkeys(("douche", "douches", "shower", "showers"), "douche"),
    **dict.fromkeys(("wifi", "wi_fi", "internet", "internet_access"), "wifi"),
    **dict.fromkeys(("honden", "hond", "dogs", "dog", "huisdieren", "pets"), "honden"),
    **dict.fromkeys(("afval", "vuilnis", "waste_disposal", "waste"), "afval"),
    **dict.fromkeys(("jaarrond", "hele_jaar_open", "open_all_year", "jaarrond_open"), "jaarrond_open"),
    **dict.fromkeys(("reserveren", "reservering", "reservation"), "reserveren"),
    **dict.fromkeys(("max_lengte", "max_lengte_m", "maxlength", "max_length", "lengte_max"), "max_lengte_m"),
    **dict.fromkeys(("capaciteit", "plaatsen", "aantal_plaatsen", "capacity"), "capaciteit"),
}

TRUE_WORDS = {"ja", "j", "yes", "y", "true", "waar", "1", "aanwezig", "x"}
FALSE_WORDS = {"nee", "n", "no", "false", "onwaar", "0", "afwezig", "geen"}
EMPTY_WORDS = {"", "-", "?", "onbekend", "unknown", "n/a", "na", "null", "none"}

KML_NS = re.compile(r"^\{[^}]*\}")


# ── Hulpfuncties ─────────────────────────────────────────────────────────────

def norm_key(key: str) -> str:
    """'Stroom (230V)' → 'stroom_230v'; accenten weg, alles klein, alleen a-z, 0-9 en _."""
    key = unicodedata.normalize("NFKD", key).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", "_", key.lower()).strip("_")


def parse_float(value: Any) -> float | None:
    """'52,1234' en '52.1234' worden 52.1234; leeg of onleesbaar → None."""
    if value is None:
        return None
    if isinstance(value, (int, float)):
        return float(value) if math.isfinite(value) else None
    text = str(value).strip().replace(" ", "")
    if not text:
        return None
    if text.count(",") == 1 and "." not in text:
        text = text.replace(",", ".")
    try:
        number = float(text)
    except ValueError:
        return None
    return number if math.isfinite(number) else None


def parse_value(value: Any) -> Any:
    """Waarde van een faciliteit: boolean bij ja/nee, getal bij een getal, anders opgeschoonde tekst; leeg → None."""
    if value is None or isinstance(value, bool):
        return value
    text = re.sub(r"\s+", " ", str(value)).strip()
    low = text.lower()
    if low in EMPTY_WORDS:
        return None
    if low in TRUE_WORDS:
        return True
    if low in FALSE_WORDS:
        return False
    number = parse_float(text)
    if number is not None and re.fullmatch(r"-?\d+([.,]\d+)?", text):
        return int(number) if number.is_integer() else number
    return text


def valid_coords(lat: float | None, lon: float | None) -> bool:
    if lat is None or lon is None:
        return False
    if not (-90 <= lat <= 90 and -180 <= lon <= 180):
        return False
    return not (lat == 0 and lon == 0)


def stable_id(name: str | None, lat: float, lon: float) -> str:
    raw = f"{(name or '').strip().lower()}|{lat:.6f}|{lon:.6f}"
    return hashlib.sha1(raw.encode()).hexdigest()[:12]


def clean_name(value: Any) -> str | None:
    if value is None:
        return None
    text = re.sub(r"\s+", " ", str(value)).strip()
    return text or None


def facilities_from(fields: dict[str, Any], keep_unknown: bool, skip: Iterable[str] = ()) -> dict[str, Any]:
    """Velden → faciliteiten. Lege waarden vallen weg (onbekend blijft leeg)."""
    skip_set = set(skip)
    out: dict[str, Any] = {}
    for raw_key, raw_value in fields.items():
        key = norm_key(raw_key)
        if not key or key in skip_set:
            continue
        target = FACILITY_ALIASES.get(key)
        if target is None:
            if not keep_unknown:
                continue
            target = key
        value = parse_value(raw_value)
        if value is None:
            continue
        # Twee kolommen voor dezelfde faciliteit die elkaar tegenspreken: dan weten we het niet
        if target in out and out[target] != value:
            log.warning("tegenstrijdige waarden voor %s (%r en %r): weggelaten", target, out[target], value)
            out[target] = _CONFLICT
            continue
        out[target] = value
    return {k: v for k, v in out.items() if v is not _CONFLICT}


_CONFLICT = object()


@dataclass
class ParseResult:
    records: list[dict[str, Any]] = field(default_factory=list)
    skipped: dict[str, int] = field(default_factory=dict)

    def skip(self, reason: str) -> None:
        self.skipped[reason] = self.skipped.get(reason, 0) + 1

    def add(self, *, name: Any, lat: float | None, lon: float | None, ref: Any, bron: str,
            facilities: dict[str, Any]) -> None:
        naam = clean_name(name)
        if not valid_coords(lat, lon):
            self.skip("geen geldige coördinaten")
            return
        assert lat is not None and lon is not None
        ref_text = clean_name(ref)
        self.records.append({
            "naam": naam,
            "lat": round(lat, 7),
            "lon": round(lon, 7),
            "bron_id": f"{bron}:{ref_text or stable_id(naam, lat, lon)}",
            "faciliteiten": facilities,
        })

    def extend(self, other: "ParseResult") -> None:
        self.records.extend(other.records)
        for reason, n in other.skipped.items():
            self.skipped[reason] = self.skipped.get(reason, 0) + n


def _pick(row: dict[str, Any], keys: Iterable[str]) -> tuple[str | None, Any]:
    """Eerste kolom uit `keys` met een waarde; geeft (genormaliseerde kolomnaam, waarde)."""
    by_norm = {norm_key(k): v for k, v in row.items() if k is not None}
    for key in keys:
        if key in by_norm and str(by_norm[key] or "").strip():
            return key, by_norm[key]
    return None, None


# ── CSV ──────────────────────────────────────────────────────────────────────

def read_text(data: bytes) -> str:
    """UTF-8 (met of zonder BOM); anders Windows-1252, zoals Excel in Nederland vaak opslaat."""
    try:
        return data.decode("utf-8-sig")
    except UnicodeDecodeError:
        return data.decode("cp1252", errors="replace")


def parse_csv(data: bytes, bron: str, keep_unknown: bool = False) -> ParseResult:
    text = read_text(data)
    sample = text[:8192]
    try:
        dialect = csv.Sniffer().sniff(sample, delimiters=",;\t|")
    except csv.Error:
        class dialect(csv.excel):  # type: ignore[no-redef]
            delimiter = ";" if sample.count(";") > sample.count(",") else ","
    result = ParseResult()
    reader = csv.DictReader(io.StringIO(text), dialect=dialect)
    for row in reader:
        if not any((v or "").strip() for v in row.values() if isinstance(v, str)):
            continue
        name_key, name = _pick(row, NAME_KEYS)
        lat_key, lat = _pick(row, LAT_KEYS)
        lon_key, lon = _pick(row, LON_KEYS)
        id_key, ref = _pick(row, ID_KEYS)
        used = {k for k in (name_key, lat_key, lon_key, id_key) if k}
        fields = {k: v for k, v in row.items() if k is not None and not isinstance(v, list)}
        result.add(name=name, lat=parse_float(lat), lon=parse_float(lon), ref=ref, bron=bron,
                   facilities=facilities_from(fields, keep_unknown, skip=used))
    return result


# ── KML / KMZ ────────────────────────────────────────────────────────────────

def _local(tag: str) -> str:
    return KML_NS.sub("", tag)


def _children(el: ET.Element, name: str) -> Iterator[ET.Element]:
    return (c for c in el if _local(c.tag) == name)


def _child_text(el: ET.Element, name: str) -> str | None:
    for c in _children(el, name):
        return c.text
    return None


def _descendants(el: ET.Element, name: str) -> Iterator[ET.Element]:
    return (d for d in el.iter() if _local(d.tag) == name)


def parse_kml(data: bytes, bron: str, keep_unknown: bool = False) -> ParseResult:
    if data[:2] == b"PK":  # KMZ: zip met doc.kml (of de eerste .kml)
        with zipfile.ZipFile(io.BytesIO(data)) as z:
            names = [n for n in z.namelist() if n.lower().endswith(".kml")]
            if not names:
                raise ValueError("KMZ zonder .kml-bestand")
            data = z.read("doc.kml" if "doc.kml" in names else names[0])
    if b"<!ENTITY" in data[:4096]:
        raise ValueError("KML met eigen entiteiten weigeren we (XML-bom)")
    root = ET.fromstring(data)
    result = ParseResult()
    for pm in _descendants(root, "Placemark"):
        points = list(_descendants(pm, "Point"))
        if len(points) != 1:
            result.skip("geen enkel punt (vlak, lijn of meerdere punten)")
            continue
        coords = (_child_text(points[0], "coordinates") or "").strip().split()
        parts = coords[0].split(",") if len(coords) == 1 else []
        lon = parse_float(parts[0]) if len(parts) >= 2 else None
        lat = parse_float(parts[1]) if len(parts) >= 2 else None

        fields: dict[str, Any] = {}
        for ext in _children(pm, "ExtendedData"):
            for d in _descendants(ext, "Data"):
                if d.get("name"):
                    fields[d.get("name", "")] = _child_text(d, "value")
            for sd in _descendants(ext, "SimpleData"):
                if sd.get("name"):
                    fields[sd.get("name", "")] = sd.text
        id_key, ref = _pick(fields, ID_KEYS)
        result.add(name=_child_text(pm, "name"), lat=lat, lon=lon, ref=pm.get("id") or ref, bron=bron,
                   facilities=facilities_from(fields, keep_unknown, skip=[id_key] if id_key else []))
    return result


# ── GPX ──────────────────────────────────────────────────────────────────────

def parse_gpx(data: bytes, bron: str, keep_unknown: bool = False) -> ParseResult:
    import gpxpy  # pas hier: CSV en KML werken ook zonder gpxpy

    gpx = gpxpy.parse(read_text(data))
    result = ParseResult()
    for wpt in gpx.waypoints:
        fields: dict[str, Any] = {}
        # Eenvoudige extensies (<extensions><stroom>ja</stroom></extensions>) als velden
        for ext in wpt.extensions or []:
            for el in [ext, *list(ext)]:
                if el.text and el.text.strip() and len(el) == 0:
                    fields[_local(el.tag)] = el.text
        # <type> is in GPX vaak de soort plek of een faciliteit; alleen meenemen als het een bekende faciliteit is
        if wpt.type and norm_key(wpt.type) in FACILITY_ALIASES:
            fields[wpt.type] = "ja"
        result.add(name=wpt.name, lat=wpt.latitude, lon=wpt.longitude, ref=None, bron=bron,
                   facilities=facilities_from(fields, keep_unknown))
    skipped_tracks = sum(1 for _ in gpx.tracks) + sum(1 for _ in gpx.routes)
    if skipped_tracks:
        result.skipped["track of route (geen plek)"] = skipped_tracks
    return result


# ── Bestanden ────────────────────────────────────────────────────────────────

def parse_geojson(data: bytes, bron: str, keep_unknown: bool) -> ParseResult:
    """GeoJSON (zoals gemeentelijke open data van data.overheid.nl): zelfde omzetting als de API-respons."""
    from map_api_data import map_raw  # hier pas: map_api_data gebruikt zelf parse_statics
    return map_raw(json.loads(data.decode("utf-8-sig")), bron, keep_unknown)


PARSERS = {".csv": parse_csv, ".tsv": parse_csv, ".txt": parse_csv, ".kml": parse_kml, ".kmz": parse_kml,
           ".gpx": parse_gpx, ".geojson": parse_geojson, ".json": parse_geojson}


def parse_file(path: str | Path, bron: str | None = None, keep_unknown: bool = False) -> ParseResult:
    p = Path(path)
    parser = PARSERS.get(p.suffix.lower())
    if parser is None:
        raise ValueError(f"Onbekend bestandstype {p.suffix!r} ({p.name}); kan: {', '.join(sorted(PARSERS))}")
    return parser(p.read_bytes(), bron or norm_key(p.stem), keep_unknown)


def dedupe_ids(records: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Twee rijen met hetzelfde bron_id (bv. een id-kolom met dubbelen): de tweede krijgt een volgnummer."""
    seen: dict[str, int] = {}
    for r in records:
        n = seen.get(r["bron_id"], 0)
        seen[r["bron_id"]] = n + 1
        if n:
            log.warning("dubbel bron_id %s: wordt %s#%d", r["bron_id"], r["bron_id"], n + 1)
            r["bron_id"] = f"{r['bron_id']}#{n + 1}"
    return records


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description="KML/KMZ/GPX/CSV → standaard-JSON voor merge_master.")
    ap.add_argument("files", nargs="+")
    ap.add_argument("--bron", help="bronnaam voor bron_id (standaard: bestandsnaam zonder extensie)")
    ap.add_argument("--out", help="pad voor de JSON (anders naar stdout)")
    ap.add_argument("--alle-velden", action="store_true", help="ook velden met een onbekende naam bewaren")
    args = ap.parse_args(argv)
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")

    total = ParseResult()
    for f in args.files:
        try:
            res = parse_file(f, args.bron, args.alle_velden)
        except (OSError, ValueError, ET.ParseError) as e:
            log.error("%s: %s", f, e)
            return 1
        log.info("%s: %d plekken, overgeslagen %s", f, len(res.records), res.skipped or "geen")
        total.extend(res)
    records = dedupe_ids(total.records)

    if args.out:
        from api_client import write_json  # zelfde atomaire schrijver

        log.info("geschreven: %s (%d plekken)", write_json(records, args.out), len(records))
    else:
        json.dump(records, sys.stdout, ensure_ascii=False, indent=2)
        sys.stdout.write("\n")
    return 0


if __name__ == "__main__":
    sys.exit(main())
