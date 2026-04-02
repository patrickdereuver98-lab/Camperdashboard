import pandas as pd
import requests
import streamlit as st
import os
import json
from datetime import datetime

# --- CONFIGURATIE ---
DATA_DIR = "data"
CSV_PATH = os.path.join(DATA_DIR, "api_export_campers.csv")

# Overpass API mirrors met failover
OVERPASS_MIRRORS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
    "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
    "https://overpass.openstreetmap.fr/api/interpreter",
]

# Overpass QL query voor camperplaatsen in Nederland
OVERPASS_QUERY = """
[out:json][timeout:60];
(
  node["tourism"="camp_site"]["country"="NL"](50.75, 3.35, 53.55, 7.22);
  node["amenity"="camping"]["country"="NL"](50.75, 3.35, 53.55, 7.22);
  node["tourism"="caravan_site"](50.75, 3.35, 53.55, 7.22);
  way["tourism"="camp_site"](50.75, 3.35, 53.55, 7.22);
  relation["tourism"="camp_site"](50.75, 3.35, 53.55, 7.22);
);
out center tags;
"""

# Mapping van OSM provincie-tags naar standaard namen
PROVINCIE_MAPPING = {
    "Groningen": "Groningen",
    "Friesland": "Friesland",
    "Drenthe": "Drenthe",
    "Overijssel": "Overijssel",
    "Gelderland": "Gelderland",
    "Utrecht": "Utrecht",
    "Noord-Holland": "Noord-Holland",
    "Zuid-Holland": "Zuid-Holland",
    "Zeeland": "Zeeland",
    "Noord-Brabant": "Noord-Brabant",
    "Limburg": "Limburg",
    "Flevoland": "Flevoland",
}


def _fetch_from_osm() -> dict | None:
    """Probeert de Overpass API via meerdere mirrors te bereiken."""
    for mirror in OVERPASS_MIRRORS:
        try:
            response = requests.post(
                mirror,
                data={"data": OVERPASS_QUERY},
                timeout=45,
                headers={"User-Agent": "VrijStaan/1.0 (camper dashboard NL)"}
            )
            if response.status_code == 200:
                return response.json()
        except requests.exceptions.RequestException:
            continue  # Probeer volgende mirror
    return None


def _parse_osm_to_df(osm_data: dict) -> pd.DataFrame:
    """Converteert ruwe OSM JSON naar een gestructureerd Pandas DataFrame."""
    records = []
    for element in osm_data.get("elements", []):
        tags = element.get("tags", {})

        # Coördinaten ophalen (nodes hebben direct lat/lon, ways/relations via 'center')
        lat = element.get("lat") or element.get("center", {}).get("lat")
        lon = element.get("lon") or element.get("center", {}).get("lon")

        if not lat or not lon:
            continue

        # Prijs bepalen
        fee = tags.get("fee", "").lower()
        charge = tags.get("charge", tags.get("price", ""))
        if fee == "no" or charge.lower() in ("0", "gratis", "free"):
            prijs = "Gratis"
        elif charge:
            prijs = charge
        elif fee == "yes":
            prijs = "Betaald"
        else:
            prijs = "Onbekend"

        # Honden bepalen
        hond_tag = tags.get("dog", tags.get("animals", "")).lower()
        honden = "Ja" if hond_tag in ("yes", "leashed", "allowed") else (
            "Nee" if hond_tag in ("no", "forbidden") else "Onbekend"
        )

        # Provincie (OSM heeft dit niet altijd, we vullen later aan via geocoder)
        provincie = tags.get("addr:state", tags.get("is_in:province", "Onbekend"))
        provincie = PROVINCIE_MAPPING.get(provincie, provincie)

        record = {
            "naam": tags.get("name", f"Camperplaats ({lat:.3f}, {lon:.3f})"),
            "latitude": lat,
            "longitude": lon,
            "provincie": provincie,
            "prijs": prijs,
            "aantal_plekken": tags.get("capacity", tags.get("caravans", "Onbekend")),
            "honden_toegestaan": honden,
            "website": tags.get("website", tags.get("url", "#")),
            "telefoon": tags.get("phone", tags.get("contact:phone", "")),
            "openingstijden": tags.get("opening_hours", "Altijd open"),
            "afbeelding": tags.get("image", "https://via.placeholder.com/150x100?text=VrijStaan"),
            "osm_id": element.get("id", ""),
            "beschrijving": tags.get("description", ""),
            "bijgewerkt_op": datetime.now().strftime("%Y-%m-%d"),
        }
        records.append(record)

    df = pd.DataFrame(records)
    return df


def _enrich_provinces(df: pd.DataFrame) -> pd.DataFrame:
    """
    Verrijkt rijen met 'Onbekend' provincie via Nominatim geocoder.
    Gelimiteerd tot 50 rijen per run om rate-limits te respecteren.
    """
    try:
        from geopy.geocoders import Nominatim
        from geopy.exc import GeocoderTimedOut

        geolocator = Nominatim(user_agent="VrijStaan/1.0")
        mask = df["provincie"] == "Onbekend"
        unknowns = df[mask].head(50)

        for idx, row in unknowns.iterrows():
            try:
                location = geolocator.reverse(
                    f"{row['latitude']}, {row['longitude']}",
                    language="nl",
                    timeout=5
                )
                if location and location.raw.get("address"):
                    addr = location.raw["address"]
                    prov = addr.get("state", "Onbekend")
                    df.at[idx, "provincie"] = PROVINCIE_MAPPING.get(prov, prov)
            except (GeocoderTimedOut, Exception):
                continue
    except ImportError:
        pass  # geopy niet beschikbaar, sla over

    return df


@st.cache_data(ttl=86400)  # 24-uurs cache
def load_data() -> pd.DataFrame:
    """
    Hoofd data-loader. Probeert OSM API, valt terug op lokale CSV.
    Retourneert altijd een DataFrame.
    """
    # Stap 1: Probeer live data van OSM
    osm_data = _fetch_from_osm()

    if osm_data:
        df = _parse_osm_to_df(osm_data)
        if not df.empty:
            df = _enrich_provinces(df)

            # Sla op als lokale backup
            os.makedirs(DATA_DIR, exist_ok=True)
            df.to_csv(CSV_PATH, index=False)
            return df

    # Stap 2: Fallback naar lokale CSV
    if os.path.exists(CSV_PATH):
        return pd.read_csv(CSV_PATH)

    # Stap 3: Retourneer demo-data als alles faalt
    return _get_demo_data()


def _get_demo_data() -> pd.DataFrame:
    """Minimale demo-dataset zodat de app altijd draaiend is."""
    return pd.DataFrame([
        {
            "naam": "Camperplaats De Biesbosch",
            "latitude": 51.7380, "longitude": 4.8330,
            "provincie": "Noord-Brabant", "prijs": "Gratis",
            "aantal_plekken": 20, "honden_toegestaan": "Ja",
            "website": "example.com", "telefoon": "",
            "openingstijden": "Altijd open",
            "afbeelding": "https://via.placeholder.com/150x100?text=VrijStaan",
            "beschrijving": "Demo locatie", "bijgewerkt_op": "2025-01-01",
        },
        {
            "naam": "Camperplaats Keukenhof",
            "latitude": 52.2695, "longitude": 4.5460,
            "provincie": "Zuid-Holland", "prijs": "€12",
            "aantal_plekken": 50, "honden_toegestaan": "Nee",
            "website": "example.com", "telefoon": "",
            "openingstijden": "Apr–Mei",
            "afbeelding": "https://via.placeholder.com/150x100?text=VrijStaan",
            "beschrijving": "Demo locatie", "bijgewerkt_op": "2025-01-01",
        },
        {
            "naam": "Camperplaats Groningen Centrum",
            "latitude": 53.2194, "longitude": 6.5665,
            "provincie": "Groningen", "prijs": "Gratis",
            "aantal_plekken": 10, "honden_toegestaan": "Ja",
            "website": "example.com", "telefoon": "",
            "openingstijden": "Altijd open",
            "afbeelding": "https://via.placeholder.com/150x100?text=VrijStaan",
            "beschrijving": "Demo locatie", "bijgewerkt_op": "2025-01-01",
        },
    ])
