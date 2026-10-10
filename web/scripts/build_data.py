"""
Zet data/api_export_campers.csv om naar een schone dataset voor de web-app.

    python3 web/scripts/build_data.py

- Provincies naar het Nederlands
- "Ja"/"Nee"/"Onbekend" naar true/null (OSM-standaardwaarde "Nee" betekent: niet vermeld)
- Dichtstbijzijnde woonplaats via cities_nl.csv (GeoNames, >1000 inwoners)
- Naamloze plekken krijgen een leesbare naam
- Unieke slug per plek, dubbele plekken (zelfde naam, <75 m) worden samengevoegd
"""
from __future__ import annotations

import csv
import hashlib
import json
import math
import re
import unicodedata
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / "data" / "api_export_campers.csv"
CITIES = Path(__file__).with_name("cities_nl.csv")
OUT = ROOT / "web" / "src" / "data" / "places.json"

PROVINCES = {
    "North Brabant": "Noord-Brabant",
    "North Holland": "Noord-Holland",
    "South Holland": "Zuid-Holland",
}
VALID_PROVINCES = {
    "Drenthe", "Flevoland", "Friesland", "Gelderland", "Groningen", "Limburg",
    "Noord-Brabant", "Noord-Holland", "Overijssel", "Utrecht", "Zeeland", "Zuid-Holland",
}
MONTHS = {
    "jan": "jan", "feb": "feb", "mar": "mrt", "apr": "apr", "may": "mei", "jun": "jun",
    "jul": "jul", "aug": "aug", "sep": "sep", "oct": "okt", "nov": "nov", "dec": "dec",
}
DAYS = {"Mo": "ma", "Tu": "di", "We": "wo", "Th": "do", "Fr": "vr", "Sa": "za", "Su": "zo"}
UNKNOWN = {"", "onbekend", "nan", "none", "unknown"}


def clean(v: str | None) -> str | None:
    v = (v or "").strip()
    return None if v.lower() in UNKNOWN else v


def yes(v: str | None) -> bool | None:
    return True if (v or "").strip().lower() in {"ja", "yes", "true"} else None


def slugify(text: str) -> str:
    text = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")[:60]


def hours_nl(v: str | None) -> str | None:
    v = clean(v)
    if not v:
        return None
    if v.replace(" ", "") == "24/7":
        return "Altijd open"

    def month(m: re.Match) -> str:
        return f"{m.group(2)} {MONTHS.get(m.group(1).lower()[:3], m.group(1))}"

    if v.replace(" ", "").lower() in {"jan-dec", "mo-su", "mo-su00:00-24:00"}:
        return "Hele jaar open"
    if "event" in v.lower():
        return None
    if v.replace(" ", "").lower() == "week01-53":
        return "Hele jaar open"
    m = re.fullmatch(r"([A-Z][a-z]{2})\s*-\s*([A-Z][a-z]{2})", v)
    if m:
        return f"{MONTHS[m.group(1).lower()].capitalize()} – {MONTHS[m.group(2).lower()]}"
    v = re.sub(r"\b([A-Z][a-z]{2})[a-z]* (\d{1,2})\b", month, v)
    v = re.sub(r"\b0(\d) ", r"\1 ", v)
    v = re.sub(r"\b20\d\d ", "", v)
    v = re.sub(r"\s*-\s*(?=\d{1,2} [a-z]{3})", " – ", v)
    for en, nl in DAYS.items():
        v = re.sub(rf"\b{en}\b", nl, v)
    v = v.replace("PH off", "gesloten op feestdagen").replace("; ", " · ")
    return v[0].upper() + v[1:]


def load_cities() -> list[tuple[float, float, str]]:
    with CITIES.open(encoding="utf-8") as f:
        return [(float(r["lat"]), float(r["lon"]), r["name"]) for r in csv.DictReader(f)]


def nearest_town(lat: float, lng: float, cities) -> str:
    k = math.cos(math.radians(lat))
    return min(cities, key=lambda c: (c[0] - lat) ** 2 + ((c[1] - lng) * k) ** 2)[2]


def km(a: dict, b: dict) -> float:
    k = math.cos(math.radians(a["lat"]))
    return 111.2 * math.hypot(a["lat"] - b["lat"], (a["lng"] - b["lng"]) * k)


def main() -> None:
    cities = load_cities()
    places: list[dict] = []
    seen_slugs: set[str] = set()

    with SRC.open(encoding="utf-8") as f:
        for row in csv.DictReader(f):
            try:
                lat, lng = float(row["latitude"]), float(row["longitude"])
            except (TypeError, ValueError):
                continue
            if not (50.6 < lat < 53.7 and 3.2 < lng < 7.3):
                continue

            province = PROVINCES.get(row["provincie"].strip(), row["provincie"].strip())
            if province not in VALID_PROVINCES:
                continue

            town = nearest_town(lat, lng, cities)
            raw_name = clean(row["naam"])
            unnamed = not raw_name or raw_name.lower().startswith("naamloze")
            name = f"Camperplaats {town}" if unnamed else raw_name

            price_raw = clean(row["prijs"])
            price = {"gratis": "gratis", "betaald": "betaald"}.get((price_raw or "").lower())
            price_eur = None
            m = re.fullmatch(r"(?:€\s*)?(\d+(?:[.,]\d+)?)\s*(?:eur|euro|€)?", (price_raw or "").lower())
            if m:
                price_eur = float(m.group(1).replace(",", "."))
                price = "gratis" if price_eur == 0 else "betaald"

            spots = clean(row["aantal_plekken"])
            spots_n = int(spots) if spots and spots.isdigit() and 0 < int(spots) < 2000 else None

            website = clean(row["website"])
            if website and not website.startswith(("http://", "https://")):
                website = "https://" + website

            place = {
                "name": name,
                "unnamed": unnamed,
                "town": town,
                "province": province,
                "lat": round(lat, 6),
                "lng": round(lng, 6),
                "price": price,
                "priceEur": price_eur or None,
                "priceText": price_raw if price_raw and not price else None,
                "power": yes(row["stroom"]),
                "dogs": {"ja": True, "nee": False}.get((row["honden_toegestaan"] or "").strip().lower()),
                "water": yes(row["waterfront"]),
                "spots": spots_n,
                "hours": hours_nl(row["openingstijden"]),
                "website": website,
                "phone": clean(row["telefoon"]),
            }

            dup = next(
                (p for p in places[-400:] if p["name"].lower() == name.lower() and km(p, place) < 0.15),
                None,
            )
            if dup:
                for key, val in place.items():
                    if dup.get(key) is None and val is not None:
                        dup[key] = val
                continue

            base = slugify(f"{name}-{town}" if not unnamed else name) or "camperplaats"
            slug = base
            if slug in seen_slugs:
                slug = f"{base}-{hashlib.md5(f'{lat}{lng}'.encode()).hexdigest()[:5]}"
            seen_slugs.add(slug)
            places.append({"slug": slug, **place})

    places.sort(key=lambda p: (p["province"], p["name"]))
    OUT.parent.mkdir(parents=True, exist_ok=True)
    # Lege velden weglaten houdt de bundle klein
    compact = [{k: v for k, v in p.items() if v is not None and (k, v) != ("unnamed", False)} for p in places]
    OUT.write_text(json.dumps(compact, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"{len(places)} plekken → {OUT.relative_to(ROOT)} ({OUT.stat().st_size // 1024} kB)")


if __name__ == "__main__":
    main()
