import pandas as pd
import streamlit as st
from math import radians, cos, sin, asin, sqrt


def _haversine(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """
    Berekent de afstand in kilometers tussen twee coördinaten
    met de Haversine-formule. Geen externe dependency nodig.
    """
    R = 6371  # Aardstraal in km
    lat1, lon1, lat2, lon2 = map(radians, [lat1, lon1, lat2, lon2])
    dlat = lat2 - lat1
    dlon = lon2 - lon1
    a = sin(dlat / 2) ** 2 + cos(lat1) * cos(lat2) * sin(dlon / 2) ** 2
    return R * 2 * asin(sqrt(a))


@st.cache_data(ttl=3600)  # 1 uur cache per locatienaam
def geocode_location(location_str: str) -> tuple[float, float] | None:
    """
    Converteert een plaatsnaam of postcode naar (lat, lon).
    Gebruikt Nominatim met een NL-focus voor betere resultaten.
    Retourneert None als de locatie niet gevonden kan worden.
    """
    try:
        from geopy.geocoders import Nominatim
        from geopy.exc import GeocoderTimedOut, GeocoderUnavailable

        geolocator = Nominatim(user_agent="VrijStaan/1.0")

        # Voeg Nederland toe als context hint als het er niet in zit
        query = location_str.strip()
        if "nederland" not in query.lower() and "nl" not in query.lower():
            query = f"{query}, Nederland"

        location = geolocator.geocode(query, timeout=8, language="nl")
        if location:
            return (location.latitude, location.longitude)

        # Tweede poging zonder context
        location = geolocator.geocode(location_str.strip(), timeout=8)
        if location:
            return (location.latitude, location.longitude)

    except ImportError:
        st.warning("⚠️ `geopy` is niet geïnstalleerd. Voeg het toe aan requirements.txt.")
    except Exception:
        pass

    return None


def filter_by_distance(
    df: pd.DataFrame,
    location_str: str,
    radius_km: float
) -> pd.DataFrame:
    """
    Filtert het DataFrame op camperplaatsen binnen `radius_km` kilometer
    van de ingegeven locatie. Voegt een 'afstand_km' kolom toe.

    Parameters
    ----------
    df          : DataFrame met 'latitude' en 'longitude' kolommen
    location_str: Plaatsnaam of postcode (bijv. "Groningen" of "9711AB")
    radius_km   : Maximale afstand in kilometers

    Returns
    -------
    Gefilterd DataFrame, gesorteerd op afstand. Bij fout: origineel DataFrame.
    """
    if not location_str or df.empty:
        return df

    coords = geocode_location(location_str)

    if coords is None:
        st.sidebar.warning(f"📍 Locatie '{location_str}' niet gevonden. Filter niet toegepast.")
        return df

    user_lat, user_lon = coords

    # Bereken afstand voor elke rij
    df = df.copy()
    df["afstand_km"] = df.apply(
        lambda row: _haversine(user_lat, user_lon, row["latitude"], row["longitude"]),
        axis=1
    )

    # Filter en sorteer
    filtered = df[df["afstand_km"] <= radius_km].sort_values("afstand_km")

    if filtered.empty:
        st.sidebar.info(f"Geen plaatsen gevonden binnen {radius_km} km van '{location_str}'.")
        return filtered

    return filtered


def get_distance_label(df: pd.DataFrame) -> pd.DataFrame:
    """
    Voegt een leesbaar afstandslabel toe (bijv. '12.3 km')
    als de 'afstand_km' kolom aanwezig is.
    """
    if "afstand_km" in df.columns:
        df = df.copy()
        df["afstand_label"] = df["afstand_km"].apply(lambda x: f"{x:.1f} km")
    return df
