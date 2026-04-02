"""
geo_logic.py — Geocoding en afstandsberekening voor VrijStaan.
"""
from math import radians, cos, sin, asin, sqrt

import pandas as pd
import streamlit as st

from utils.logger import logger


def _haversine(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    R = 6371.0
    lat1, lon1, lat2, lon2 = map(radians, [lat1, lon1, lat2, lon2])
    a = sin((lat2 - lat1) / 2) ** 2 + cos(lat1) * cos(lat2) * sin((lon2 - lon1) / 2) ** 2
    return R * 2 * asin(sqrt(a))


@st.cache_data(ttl=3600, show_spinner=False)
def geocode_location(location_str: str) -> tuple[float, float] | None:
    try:
        from geopy.geocoders import Nominatim
        geolocator = Nominatim(user_agent="VrijStaan/2.0")
        query = location_str.strip()
        query_nl = query if "nederland" in query.lower() else f"{query}, Nederland"
        location = geolocator.geocode(query_nl, timeout=8, language="nl")
        if not location:
            location = geolocator.geocode(query, timeout=8)
        if location:
            logger.info(f"Geocoded '{location_str}' → ({location.latitude:.4f}, {location.longitude:.4f})")
            return (location.latitude, location.longitude)
    except ImportError:
        logger.error("geopy niet geïnstalleerd")
    except Exception as e:
        logger.warning(f"Geocode fout '{location_str}': {e}")
    return None


def filter_by_distance(df: pd.DataFrame, location_str: str, radius_km: float) -> pd.DataFrame:
    if not location_str or df.empty:
        return df
    coords = geocode_location(location_str)
    if coords is None:
        st.sidebar.warning(f"📍 '{location_str}' niet gevonden — afstandsfilter niet actief.")
        return df
    user_lat, user_lon = coords
    df = df.copy()
    df["afstand_km"] = df.apply(
        lambda row: _haversine(user_lat, user_lon, float(row["latitude"]), float(row["longitude"])),
        axis=1,
    )
    df["afstand_label"] = df["afstand_km"].apply(lambda x: f"{x:.1f} km")
    filtered = df[df["afstand_km"] <= radius_km].sort_values("afstand_km")
    if filtered.empty:
        st.sidebar.info(f"Geen plaatsen binnen {radius_km} km van '{location_str}'.")
    return filtered
