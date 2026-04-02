import pandas as pd
import streamlit as st
from geopy.geocoders import Nominatim
from geopy.distance import geodesic

@st.cache_data(ttl=86400)
def get_coordinates(location_string):
    """Zet een tekstuele locatie om in GPS coördinaten."""
    if not location_string or location_string.strip() == "":
        return None
    try:
        # User agent is verplicht voor de Nominatim API
        geolocator = Nominatim(user_agent="vrijstaan_camper_app_v1")
        # Forceer de zoekopdracht binnen Nederland voor betere resultaten
        location = geolocator.geocode(f"{location_string}, Nederland", timeout=5)
        if location:
            return (location.latitude, location.longitude)
        return None
    except Exception:
        return None

def filter_by_distance(df, user_loc_string, max_radius_km):
    """Filtert de dataframe op basis van een straal rondom een locatie."""
    if df.empty or not user_loc_string:
        return df

    coords = get_coordinates(user_loc_string)
    
    if not coords:
        st.sidebar.warning(f"📍 Kon de locatie '{user_loc_string}' niet exact bepalen.")
        return df

    user_lat, user_lon = coords

    # Bereken de afstand voor elke camperplaats
    df['afstand_km'] = df.apply(
        lambda row: geodesic((user_lat, user_lon), (row['latitude'], row['longitude'])).kilometers 
        if pd.notnull(row['latitude']) and pd.notnull(row['longitude']) else 9999,
        axis=1
    )

    # Filter op straal en sorteer van dichtbij naar ver weg
    filtered_df = df[df['afstand_km'] <= max_radius_km].copy()
    filtered_df = filtered_df.sort_values('afstand_km')
    
    return filtered_df
