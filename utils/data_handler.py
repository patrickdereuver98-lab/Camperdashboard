"""
data_handler.py — OSM Overpass API integratie met failover, caching en logging.

Fase 1 fixes:
- Correcte Overpass query (motorhome parking + camp_site)
- Offline province-detectie via reverse_geocoder (geen per-record HTTP calls)
- Robuuste kolomvalidatie bij CSV import
- data/ map wordt aangemaakt indien afwezig
- Volledige loguru logging
"""
import os
import time
from datetime import datetime

import pandas as pd
import requests
import streamlit as st

from utils.logger import logger

# --- PADEN ---
DATA_DIR = "data"
CSV_PATH = os.path.join(DATA_DIR, "api_export_campers.csv")
os.makedirs(DATA_DIR, exist_ok=True)

# --- OVERPASS API MIRRORS ---
OVERPASS_MIRRORS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
    "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
    "https://overpass.openstreetmap.fr/api/interpreter",
]

# Gecorrigeerde query: dekt echte camperplaatsen + campings met motorhome-toegang
OVERPASS_QUERY = """
[out:json][timeout:90];
(
  node["tourism"="camp_site"](50.75,3.35,53.55,7.22);
  way["tourism"="camp_site"](50.75,3.35,53.55,7.22);
  node["tourism"="caravan_site"](50.75,3.35,53.55,7.22);
  way["tourism"="caravan_site"](50.75,3.35,53.55,7.22);
  node["amenity"="parking"]["motorhome"="yes"](50.75,3.35,53.55,7.22);
  node["amenity"="parking"]["campervan"="yes"](50.75,3.35,53.55,7.22);
  node["tourism"="camp_site"]["motorhome"="yes"](50.75,3.35,53.55,7.22);
  node["motorhome"="designated"](50.75,3.35,53.55,7.22);
);
out center tags;
"""

REQUIRED_COLUMNS = [
    "naam", "latitude", "longitude", "provincie", "prijs",
    "aantal_plekken", "honden_toegestaan", "stroom", "waterfront",
    "website", "telefoon", "openingstijden", "afbeelding",
    "beschrijving", "osm_id", "bijgewerkt_op",
]

PROVINCIE_IMAGES = {
    "Drenthe": "https://upload.wikimedia.org/wikipedia/commons/thumb/4/44/Drenthe_collage.jpg/320px-Drenthe_collage.jpg",
    "Friesland": "https://upload.wikimedia.org/wikipedia/commons/thumb/1/17/Friesland_Niederlande_Landschaft.jpg/320px-Friesland_Niederlande_Landschaft.jpg",
    "Groningen": "https://upload.wikimedia.org/wikipedia/commons/thumb/9/95/Groningen-province-flag.jpg/320px-Groningen-province-flag.jpg",
    "Overijssel": "https://upload.wikimedia.org/wikipedia/commons/thumb/5/5e/Giethoorn_02.jpg/320px-Giethoorn_02.jpg",
    "Gelderland": "https://upload.wikimedia.org/wikipedia/commons/thumb/b/b1/Veluwe.jpg/320px-Veluwe.jpg",
    "Utrecht": "https://upload.wikimedia.org/wikipedia/commons/thumb/7/79/Dom_tower_Utrecht.jpg/320px-Dom_tower_Utrecht.jpg",
    "Noord-Holland": "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a7/Zaanse_Schans_2016.jpg/320px-Zaanse_Schans_2016.jpg",
    "Zuid-Holland": "https://upload.wikimedia.org/wikipedia/commons/thumb/2/2a/Keukenhof2009.jpg/320px-Keukenhof2009.jpg",
    "Zeeland": "https://upload.wikimedia.org/wikipedia/commons/thumb/5/5f/Zeelandbrug.jpg/320px-Zeelandbrug.jpg",
    "Noord-Brabant": "https://upload.wikimedia.org/wikipedia/commons/thumb/3/30/Biesbosch.jpg/320px-Biesbosch.jpg",
    "Limburg": "https://upload.wikimedia.org/wikipedia/commons/thumb/0/04/Maastricht_Vrijthof.jpg/320px-Maastricht_Vrijthof.jpg",
    "Flevoland": "https://upload.wikimedia.org/wikipedia/commons/thumb/8/8e/Lelystad_luchtfoto.jpg/320px-Lelystad_luchtfoto.jpg",
}
DEFAULT_IMAGE = "https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?w=320&q=80"

RG_MAPPING = {
    "North Holland": "Noord-Holland",
    "South Holland": "Zuid-Holland",
    "North Brabant": "Noord-Brabant",
    "Friesland": "Friesland",
    "Groningen": "Groningen",
    "Drenthe": "Drenthe",
    "Overijssel": "Overijssel",
    "Gelderland": "Gelderland",
    "Utrecht": "Utrecht",
    "Zeeland": "Zeeland",
    "Limburg": "Limburg",
    "Flevoland": "Flevoland",
}


def _get_province_offline(lat: float, lon: float) -> str:
    try:
        import reverse_geocoder as rg
        results = rg.search((lat, lon), verbose=False)
        if results:
            admin1 = results[0].get("admin1", "")
            return RG_MAPPING.get(admin1, admin1 or "Onbekend")
    except Exception as e:
        logger.debug(f"reverse_geocoder fout ({lat},{lon}): {e}")
    return "Onbekend"


def _fetch_from_osm() -> dict | None:
    for mirror in OVERPASS_MIRRORS:
        try:
            logger.info(f"OSM sync via: {mirror}")
            t0 = time.time()
            r = requests.post(
                mirror,
                data={"data": OVERPASS_QUERY},
                timeout=60,
                headers={"User-Agent": "VrijStaan/2.0"},
            )
            if r.status_code == 200:
                logger.info(f"OSM sync OK via {mirror} in {time.time()-t0:.1f}s")
                return r.json()
            logger.warning(f"Mirror {mirror} → HTTP {r.status_code}")
        except requests.exceptions.Timeout:
            logger.warning(f"Mirror {mirror} timeout")
        except requests.exceptions.RequestException as e:
            logger.warning(f"Mirror {mirror} fout: {e}")
    logger.error("Alle OSM mirrors gefaald")
    return None


def _parse_osm_to_df(osm_data: dict) -> pd.DataFrame:
    records = []
    for el in osm_data.get("elements", []):
        tags = el.get("tags", {})
        lat = el.get("lat") or el.get("center", {}).get("lat")
        lon = el.get("lon") or el.get("center", {}).get("lon")
        if not lat or not lon:
            continue

        fee = tags.get("fee", "").lower()
        charge = tags.get("charge", tags.get("price", ""))
        if fee == "no" or str(charge).lower() in ("0", "gratis", "free"):
            prijs = "Gratis"
        elif charge:
            prijs = str(charge)
        elif fee == "yes":
            prijs = "Betaald"
        else:
            prijs = "Onbekend"

        hond_raw = tags.get("dog", tags.get("animals", "")).lower()
        honden = "Ja" if hond_raw in ("yes", "leashed", "allowed") else "Nee" if hond_raw in ("no", "forbidden") else "Onbekend"

        stroom_raw = tags.get("electric_vehicle", tags.get("motorhome:electricity", tags.get("power_supply", ""))).lower()
        stroom = "Ja" if stroom_raw in ("yes", "available") else "Nee" if stroom_raw == "no" else "Onbekend"

        omgeving = (tags.get("natural", "") + tags.get("water", "") + tags.get("waterway", "")).lower()
        waterfront = "Ja" if any(w in omgeving for w in ("waterfront", "lake", "river", "sea", "beach", "coast")) else "Nee"

        provincie = _get_province_offline(lat, lon)
        afbeelding = tags.get("image", PROVINCIE_IMAGES.get(provincie, DEFAULT_IMAGE))

        records.append({
            "naam": tags.get("name", f"Camperplaats {lat:.4f},{lon:.4f}"),
            "latitude": round(lat, 6),
            "longitude": round(lon, 6),
            "provincie": provincie,
            "prijs": prijs,
            "aantal_plekken": tags.get("capacity", "Onbekend"),
            "honden_toegestaan": honden,
            "stroom": stroom,
            "waterfront": waterfront,
            "website": tags.get("website", tags.get("url", "")),
            "telefoon": tags.get("phone", tags.get("contact:phone", "")),
            "openingstijden": tags.get("opening_hours", "Altijd open"),
            "afbeelding": afbeelding,
            "beschrijving": tags.get("description", ""),
            "osm_id": str(el.get("id", "")),
            "bijgewerkt_op": datetime.now().strftime("%Y-%m-%d"),
        })

    logger.info(f"OSM parse: {len(records)} locaties")
    return pd.DataFrame(records) if records else pd.DataFrame(columns=REQUIRED_COLUMNS)


def validate_and_merge(master_df: pd.DataFrame, import_df: pd.DataFrame) -> tuple[pd.DataFrame, list[str]]:
    warnings_list = []
    missing = [c for c in REQUIRED_COLUMNS if c not in import_df.columns]
    if missing:
        warnings_list.append(f"Ontbrekende kolommen toegevoegd met standaardwaarde: {', '.join(missing)}")
    for col in REQUIRED_COLUMNS:
        if col not in import_df.columns:
            import_df[col] = "Onbekend"
    import_df["bijgewerkt_op"] = datetime.now().strftime("%Y-%m-%d")
    combined = pd.concat([master_df, import_df[REQUIRED_COLUMNS]], ignore_index=True)
    before = len(combined)
    combined = combined.drop_duplicates(subset=["naam", "latitude", "longitude"], keep="last")
    dupes = before - len(combined)
    if dupes:
        warnings_list.append(f"{dupes} duplicaten verwijderd")
    logger.info(f"Merge: {len(import_df)} rijen, {dupes} dupes verwijderd")
    return combined, warnings_list


@st.cache_data(ttl=86400, show_spinner=False)
def load_data() -> pd.DataFrame:
    osm_data = _fetch_from_osm()
    if osm_data:
        df = _parse_osm_to_df(osm_data)
        if not df.empty:
            df.to_csv(CSV_PATH, index=False)
            logger.info(f"CSV opgeslagen: {len(df)} locaties")
            return df
    if os.path.exists(CSV_PATH):
        logger.info("Fallback naar lokale CSV")
        return pd.read_csv(CSV_PATH)
    logger.warning("Demo-dataset geladen")
    return _get_demo_data()


def _get_demo_data() -> pd.DataFrame:
    now = datetime.now().strftime("%Y-%m-%d")
    base = {"stroom": "Onbekend", "waterfront": "Nee", "telefoon": "",
            "openingstijden": "Altijd open", "beschrijving": "Demo locatie",
            "bijgewerkt_op": now, "osm_id": ""}
    rows = [
        {**base, "naam": "Camperplaats De Biesbosch", "latitude": 51.738, "longitude": 4.833,
         "provincie": "Noord-Brabant", "prijs": "Gratis", "aantal_plekken": 20,
         "honden_toegestaan": "Ja", "website": "biesbosch.nl",
         "afbeelding": PROVINCIE_IMAGES.get("Noord-Brabant", DEFAULT_IMAGE)},
        {**base, "naam": "Camperplaats Keukenhof", "latitude": 52.2695, "longitude": 4.546,
         "provincie": "Zuid-Holland", "prijs": "€12", "aantal_plekken": 50,
         "honden_toegestaan": "Nee", "website": "keukenhof.nl",
         "afbeelding": PROVINCIE_IMAGES.get("Zuid-Holland", DEFAULT_IMAGE)},
        {**base, "naam": "Camperplaats Groningen Centrum", "latitude": 53.2194, "longitude": 6.5665,
         "provincie": "Groningen", "prijs": "Gratis", "aantal_plekken": 10,
         "honden_toegestaan": "Ja", "website": "groningen.nl",
         "afbeelding": PROVINCIE_IMAGES.get("Groningen", DEFAULT_IMAGE)},
        {**base, "naam": "Camperplaats Veluwe", "latitude": 52.3, "longitude": 5.85,
         "provincie": "Gelderland", "prijs": "€8", "aantal_plekken": 35,
         "honden_toegestaan": "Ja", "stroom": "Ja", "website": "veluwe.nl",
         "afbeelding": PROVINCIE_IMAGES.get("Gelderland", DEFAULT_IMAGE)},
        {**base, "naam": "Camperplaats Zeeland Strand", "latitude": 51.5, "longitude": 3.6,
         "provincie": "Zeeland", "prijs": "Gratis", "aantal_plekken": 15,
         "honden_toegestaan": "Ja", "waterfront": "Ja", "website": "zeeland.nl",
         "afbeelding": PROVINCIE_IMAGES.get("Zeeland", DEFAULT_IMAGE)},
        {**base, "naam": "Camperplaats Drenthe Bos", "latitude": 52.8, "longitude": 6.5,
         "provincie": "Drenthe", "prijs": "Gratis", "aantal_plekken": 8,
         "honden_toegestaan": "Ja", "website": "drenthe.nl",
         "afbeelding": PROVINCIE_IMAGES.get("Drenthe", DEFAULT_IMAGE)},
    ]
    return pd.DataFrame(rows)[REQUIRED_COLUMNS]
