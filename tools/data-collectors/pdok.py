"""PDOK en gemeentelijke open data (data.overheid.nl) ophalen en omzetten naar de standaardvorm voor merge_master.

Bron `pdok` in bronnen.json (type `api_wfs`, tier 2, besluit eigenaar 31 oktober 2026). Een bron heeft een lijst
`lagen`; elke laag is één dataset:

    {"id": "zwolle", "url": "https://service.pdok.nl/.../wfs/v1_0", "typename": "ns:camperplaatsen",
     "gemeente": "Zwolle", "velden": {"naam": "OBJECTNAAM", "id": "OBJECTID", "capaciteit": "AANTAL_PLAATSEN"}}

- Met `typename`: WFS 2.0 GetFeature als GeoJSON (outputFormat=application/json, srsName=EPSG:4326), per
  `pagina` features (standaard 1000) met startIndex.
- Zonder `typename`: een GeoJSON-adres, zoals een download van data.overheid.nl of OGC API Features van PDOK
  (`.../collections/<naam>/items?f=json`). Een `next`-link op dezelfde host volgen we.
- Meer dan `max_paginas` pagina's (standaard 50) is een fout, geen stil afgekapte lijst.

Omzetten (onbekend blijft leeg, nooit verzinnen):
- Coördinaten in RD (EPSG:28992, de standaard van PDOK) worden WGS84 via pyproj. Een server die bij EPSG:4326
  lat en lon omdraait, herkennen we aan Nederland: breedte 50,7–53,6 en lengte 3,3–7,3 overlappen niet.
- Punt: zoals het is. Vlak (een terrein): het zwaartepunt van de buitenrand van het grootste vlak, zoals OSM `center`
  geeft. Lijnen en losse punten in een MultiPoint met meer dan één punt slaan we over (met reden).
- `velden` koppelt de standaardnamen aan de kolommen van de dataset: naam, id, gemeente, capaciteit en elke
  faciliteit (stroom, water, lozing, …). Zonder koppeling gelden dezelfde synoniemen als bij de andere bronnen.
- `gemeente` (uit de kolom, of vast per laag) komt in faciliteiten onder `gemeente`: geo_master heeft geen eigen
  kolom, en promote_geo_master leest die sleutel niet (de plaats komt uit nearest_town).
- bron_id is `pdok:<laag>/<id>`, zodat twee gemeenten met hetzelfde objectnummer elkaar niet overschrijven.
"""

from __future__ import annotations

import logging
import re
from typing import Any, Callable
from urllib.parse import urlparse

from parse_statics import (
    FACILITY_ALIASES, ID_KEYS, NAME_KEYS, ParseResult, _pick, clean_name, facilities_from, norm_key, parse_value,
)

log = logging.getLogger("pdok")

DEFAULT_PAGE = 1000
DEFAULT_MAX_PAGES = 50
LAAG_ID = re.compile(r"[a-z0-9_]{2,40}")
# Standaardnamen die `velden` mag koppelen
VELD_NAMEN = {"naam", "id", "gemeente", "capaciteit", *set(FACILITY_ALIASES.values())}

# Nederland in WGS84 (zelfde rechthoek als promote_geo_master) en in RD
NL_LAT = (50.70, 53.60)
NL_LON = (3.30, 7.30)
RD_X = (0.0, 300_000.0)
RD_Y = (289_000.0, 629_000.0)


class PdokError(Exception):
    pass


# ── Configuratie ─────────────────────────────────────────────────────────────

def check_lagen(b: dict[str, Any], clean_url: Callable[[Any, str], str]) -> list[dict[str, Any]]:
    """Lagen van een api_wfs-bron, gecontroleerd. Zonder lagen (nog geen endpoints) slaat run_pipeline de bron over en
    meldt dat; de andere bronnen draaien door."""
    lagen = b.get("lagen", [])
    if not isinstance(lagen, list):
        raise PdokError(f"bron {b['bron']}: lagen moet een lijst zijn")
    out, seen = [], set()
    for laag in lagen:
        if not isinstance(laag, dict):
            raise PdokError(f"bron {b['bron']}: elke laag is een object")
        lid = laag.get("id")
        if not isinstance(lid, str) or not LAAG_ID.fullmatch(lid):
            raise PdokError(f"bron {b['bron']}: laag-id {lid!r}: alleen a-z, 0-9 en _ (2–40 tekens)")
        if lid in seen:
            raise PdokError(f"bron {b['bron']}: laag {lid} staat er twee keer in")
        seen.add(lid)
        velden = laag.get("velden", {})
        if not isinstance(velden, dict) or not all(isinstance(v, str) and v for v in velden.values()):
            raise PdokError(f"bron {b['bron']}, laag {lid}: velden is een object van standaardnaam naar kolomnaam")
        onbekend = sorted(set(velden) - VELD_NAMEN)
        if onbekend:
            raise PdokError(f"bron {b['bron']}, laag {lid}: onbekende standaardnamen {onbekend}")
        for key in ("pagina", "max_paginas"):
            if key in laag and (not isinstance(laag[key], int) or isinstance(laag[key], bool) or laag[key] < 1):
                raise PdokError(f"bron {b['bron']}, laag {lid}: {key} moet een positief geheel getal zijn")
        out.append({**laag, "url": clean_url(laag.get("url"), f"{b['bron']}/{lid}")})
    return out


# ── Ophalen ──────────────────────────────────────────────────────────────────

def _features(page: Any, where: str) -> list[Any]:
    if not isinstance(page, dict) or page.get("type") != "FeatureCollection" or not isinstance(page.get("features"), list):
        raise PdokError(f"{where}: geen GeoJSON FeatureCollection")
    return page["features"]


def _next_link(page: dict[str, Any], url: str) -> str | None:
    """OGC API Features: links[rel=next], alleen op dezelfde host en via https."""
    for link in page.get("links") or []:
        if isinstance(link, dict) and link.get("rel") == "next" and isinstance(link.get("href"), str):
            nxt = urlparse(link["href"])
            if nxt.scheme == "https" and nxt.netloc == urlparse(url).netloc:
                return link["href"]
    return None


def fetch_laag(client: Any, laag: dict[str, Any]) -> dict[str, Any]:
    """Alle features van één laag als één FeatureCollection (met de crs van de eerste pagina)."""
    page_size = laag.get("pagina", DEFAULT_PAGE)
    max_pages = laag.get("max_paginas", DEFAULT_MAX_PAGES)
    where = f"laag {laag['id']}"
    feats: list[Any] = []
    crs = None
    if laag.get("typename"):
        for n in range(max_pages):
            page = client.get_json(laag["url"], params={
                "service": "WFS", "version": "2.0.0", "request": "GetFeature", "typeNames": laag["typename"],
                "outputFormat": "application/json", "srsName": "EPSG:4326", "count": page_size,
                "startIndex": n * page_size})
            got = _features(page, where)
            crs = crs or page.get("crs")
            feats.extend(got)
            if len(got) < page_size:
                return {"type": "FeatureCollection", "crs": crs, "features": feats}
        raise PdokError(f"{where}: meer dan {max_pages} pagina's van {page_size}; verhoog max_paginas")
    url: str | None = laag["url"]
    for _ in range(max_pages):
        assert url is not None
        page = client.get_json(url)
        feats.extend(_features(page, where))
        crs = crs or page.get("crs")
        url = _next_link(page, url)
        if url is None:
            return {"type": "FeatureCollection", "crs": crs, "features": feats}
    raise PdokError(f"{where}: meer dan {max_pages} pagina's; verhoog max_paginas")


# ── Coördinaten ──────────────────────────────────────────────────────────────

_rd_transformer = None


def rd_to_wgs84(x: float, y: float) -> tuple[float, float]:
    """RD (EPSG:28992) → (lat, lon) in WGS84."""
    global _rd_transformer
    if _rd_transformer is None:
        from pyproj import Transformer  # pas hier: alleen nodig bij RD

        _rd_transformer = Transformer.from_crs("EPSG:28992", "EPSG:4326", always_xy=True)
    lon, lat = _rd_transformer.transform(x, y)
    return lat, lon


def _crs_is_rd(crs: Any) -> bool:
    name = ((crs or {}).get("properties") or {}).get("name", "") if isinstance(crs, dict) else ""
    return "28992" in str(name)


def _in(v: float, lo_hi: tuple[float, float]) -> bool:
    return lo_hi[0] <= v <= lo_hi[1]


def to_lat_lon(a: float, b: float, rd: bool) -> tuple[float | None, float | None, str | None]:
    """Eerste en tweede getal van een GeoJSON-positie → (lat, lon, reden om over te slaan)."""
    if rd or (_in(a, RD_X) and _in(b, RD_Y) and a > 1000):
        if not (_in(a, RD_X) and _in(b, RD_Y)):
            return None, None, "RD-coördinaten buiten Nederland"
        lat, lon = rd_to_wgs84(a, b)
        return lat, lon, None
    if _in(b, NL_LAT) and _in(a, NL_LON):
        return b, a, None          # GeoJSON: [lon, lat]
    if _in(a, NL_LAT) and _in(b, NL_LON):
        return a, b, None          # server draaide de assen om (EPSG:4326 als lat, lon)
    return None, None, "buiten Nederland of onbekend coördinatenstelsel"


def _ring_centroid(ring: list[Any]) -> tuple[float, float, float] | None:
    """(x, y, oppervlakte) van een gesloten ring (shoelace); None bij een ontaarde ring."""
    pts = [(float(p[0]), float(p[1])) for p in ring if isinstance(p, (list, tuple)) and len(p) >= 2]
    if len(pts) < 3:
        return None
    a = cx = cy = 0.0
    for (x0, y0), (x1, y1) in zip(pts, pts[1:] + pts[:1]):
        cross = x0 * y1 - x1 * y0
        a += cross
        cx += (x0 + x1) * cross
        cy += (y0 + y1) * cross
    if abs(a) < 1e-12:
        return None
    return cx / (3 * a), cy / (3 * a), abs(a) / 2


def position(geom: Any) -> tuple[tuple[float, float] | None, str | None]:
    """Eén positie (in het stelsel van de bron) uit een geometrie, of een reden om over te slaan."""
    if not isinstance(geom, dict):
        return None, "geen geometrie"
    kind, coords = geom.get("type"), geom.get("coordinates")
    try:
        if kind == "Point":
            return (float(coords[0]), float(coords[1])), None
        if kind == "MultiPoint":
            if len(coords) != 1:
                return None, "MultiPoint met meer dan één punt"
            return (float(coords[0][0]), float(coords[0][1])), None
        if kind in ("Polygon", "MultiPolygon"):
            polys = [coords] if kind == "Polygon" else coords
            best = max((c for c in (_ring_centroid(p[0]) for p in polys if p) if c), key=lambda c: c[2], default=None)
            if best is None:
                return None, "vlak zonder oppervlakte"
            return (best[0], best[1]), None
    except (TypeError, ValueError, IndexError):
        return None, "onleesbare coördinaten"
    return None, "geen punt of vlak (lijn of iets anders)"


# ── Omzetten ─────────────────────────────────────────────────────────────────

def map_features(collection: dict[str, Any], bron: str, laag: dict[str, Any], keep_unknown: bool = False) -> ParseResult:
    result = ParseResult()
    rd = _crs_is_rd(collection.get("crs"))
    velden: dict[str, str] = laag.get("velden", {})
    vaste_gemeente = clean_name(laag.get("gemeente"))
    for f in collection.get("features") or []:
        if not isinstance(f, dict):
            result.skip("geen object")
            continue
        pos, why = position(f.get("geometry"))
        if pos is None:
            result.skip(why or "geen positie")
            continue
        lat, lon, why = to_lat_lon(pos[0], pos[1], rd)
        if lat is None:
            result.skip(why or "geen positie")
            continue
        props = f.get("properties") or {}
        if not isinstance(props, dict):
            props = {}
        # Gekoppelde kolommen eerst; daarna de gewone synoniemen
        used = {norm_key(c) for c in velden.values()}
        name = props.get(velden["naam"]) if "naam" in velden else _pick(props, NAME_KEYS)[1]
        ref = props.get(velden["id"]) if "id" in velden else None
        if ref is None:
            ref = f.get("id") if f.get("id") is not None else _pick(props, ID_KEYS)[1]
        if "naam" not in velden:
            used.add(_pick(props, NAME_KEYS)[0] or "")
        if "id" not in velden:
            used.add(_pick(props, ID_KEYS)[0] or "")
        fac = facilities_from(props, keep_unknown, skip=used)
        for std, col in velden.items():
            if std in ("naam", "id", "gemeente"):
                continue
            value = parse_value(props.get(col))
            if value is not None:
                fac[std] = value
        gemeente = clean_name(props.get(velden["gemeente"])) if "gemeente" in velden else None
        gemeente = gemeente or vaste_gemeente
        if gemeente:
            fac["gemeente"] = gemeente
        result.add(name=name, lat=lat, lon=lon, ref=f"{laag['id']}/{clean_name(ref)}" if clean_name(ref) else None,
                   bron=bron, facilities=fac)
    return result


def collect(b: dict[str, Any], lagen: list[dict[str, Any]], client: Any, write_raw: Callable[[Any, str], Any] | None = None) -> ParseResult:
    """Alle lagen van één bron. Een laag die niet lukt, stopt de bron (geen halve lijst naar merge_master)."""
    total = ParseResult()
    for laag in lagen:
        coll = fetch_laag(client, laag)
        if write_raw:
            write_raw(coll, f"raw_{b['bron']}_{laag['id']}.json")
        res = map_features(coll, b["bron"], laag, b.get("alle_velden", False))
        log.info("%s/%s: %d plekken, overgeslagen %s", b["bron"], laag["id"], len(res.records), res.skipped or "geen")
        total.extend(res)
    return total
