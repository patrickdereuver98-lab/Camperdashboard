"""
utils/data_handler.py — Cloud-Powered Data Architectuur voor VrijStaan.
Beheert Google Sheets connectie, OSM Sync en Provincie-verrijking.
"""
import pandas as pd
import streamlit as st
from streamlit_gsheets import GSheetsConnection
import requests
import os
import reverse_geocoder as rg
import logging

# Logger initialisatie om NameError te voorkomen
logger = logging.getLogger(__name__)

CSV_PATH = "data/api_export_campers.csv"
SHEET_NAME = "MasterData"

def get_connection():
    """Initialiseert de beveiligde verbinding met Google Sheets."""
    return st.connection("gsheets", type=GSheetsConnection)

def load_data():
    """
    Laadt de data uit Google Sheets (Cloud). 
    Valt terug op lokale CSV als de cloud onbereikbaar is.
    """
    try:
        conn = get_connection()
        # ttl=0 dwingt een live verversing af van de cloud-data
        df = conn.read(worksheet=SHEET_NAME, ttl=0)
        if df is not None and not df.empty:
            return df.fillna("Onbekend")
    except Exception as e:
        logger.error(f"Cloud-fout bij load_data: {e}")
    
    # Fallback naar lokale CSV voor UI-stabiliteit
    if os.path.exists(CSV_PATH):
        try:
            return pd.read_csv(CSV_PATH).fillna("Onbekend")
        except Exception:
            return pd.DataFrame()
    
    return pd.DataFrame()

# Alias voor compatibiliteit met oudere Kaart-code
def get_master_data():
    return load_data()

def save_data(df):
    """
    Schrijft de dataset naar Google Sheets én de lokale CSV fallback.
    """
    df_clean = df.fillna("Onbekend")
    
    # 1. Cloud Save
    try:
        conn = get_connection()
        conn.update(worksheet=SHEET_NAME, data=df_clean)
        st.cache_data.clear()
    except Exception as e:
        logger.error(f"Cloud Save Fout: {e}")
        st.error(f"⚠️ Kon niet opslaan in Google Sheets: {e}")

    # 2. Lokale Fallback Save
    try:
        os.makedirs(os.path.dirname(CSV_PATH), exist_ok=True)
        df_clean.to_csv(CSV_PATH, index=False)
    except Exception as e:
        logger.error(f"Lokale Save Fout: {e}")

@st.cache_data(ttl=86400)
def load_data_from_osm():
    """Haalt de actuele dataset live op via de Overpass API (OSM)."""
    overpass_query = """
    [out:json][timeout:90][bbox:50.75,3.36,53.56,7.23];
    (
      node["tourism"="caravan_site"];
      way["tourism"="caravan_site"];
      relation["tourism"="caravan_site"];
      node["amenity"="parking"]["motorhome"="yes"];
      way["amenity"="parking"]["motorhome"="yes"];
      node["tourism"="camp_site"];
      way["tourism"="camp_site"];
      relation["tourism"="camp_site"];
    );
    out center;
    """
    
    headers = {
        "User-Agent": "VrijStaanCamperApp/2.0 (Streamlit Cloud)",
        "Accept": "application/json"
    }
    
    mirrors = ["https://overpass-api.de/api/interpreter", "https://lz4.overpass-api.de/api/interpreter"]
    
    data = None
    for url in mirrors:
        try:
            response = requests.post(url, data={'data': overpass_query}, headers=headers, timeout=90)
            response.raise_for_status()
            data = response.json()
            break 
        except Exception:
            continue
            
    if not data:
        return pd.DataFrame()

    elements = data.get('elements', [])
    camper_data = []
    
    for el in elements:
        tags = el.get('tags', {})
        lat = el.get('lat') or el.get('center', {}).get('lat')
        lon = el.get('lon') or el.get('center', {}).get('lon')
        
        if not lat or not lon: continue
            
        naam = tags.get('name') or f"Camperplaats {tags.get('addr:city', '')}".strip() or "Naamloze Locatie"
        
        camper_data.append({
            "naam": naam,
            "latitude": lat,
            "longitude": lon,
            "provincie": "Onbekend",
            "honden_toegestaan": "Ja" if tags.get('dog') == 'yes' else "Onbekend",
            "stroom": "Ja" if tags.get('power_supply') == 'yes' else "Nee",
            "waterfront": "Ja" if tags.get('water_point') == 'yes' else "Nee",
            "aantal_plekken": tags.get('capacity', 'Onbekend'),
            "prijs": tags.get('charge') or ('Gratis' if tags.get('fee') == 'no' else 'Onbekend'),
            "website": tags.get('website') or tags.get('contact:website', ''),
            "ai_gecheckt": "Nee",
            "afbeelding": "https://images.unsplash.com/photo-1523987355523-c7b5b0dd90a7?w=300"
        })

    df = pd.DataFrame(camper_data)
    if not df.empty:
        df = enforce_nl_and_enrich_provinces(df)
    return df

def enforce_nl_and_enrich_provinces(df):
    coords = list(zip(df['latitude'], df['longitude']))
    results = rg.search(coords)
    df['landcode'] = [res['cc'] for res in results]
    df['berekende_provincie'] = [res['admin1'] for res in results]
    df_nl = df[df['landcode'] == 'NL'].copy()
    df_nl['provincie'] = df_nl['berekende_provincie']
    return df_nl.drop(columns=['landcode', 'berekende_provincie'])
