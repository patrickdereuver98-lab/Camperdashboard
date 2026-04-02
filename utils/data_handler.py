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

# ── 0. LOGGER INITIALISATIE ──────────────────────────────────────────────────
logger = logging.getLogger(__name__)

# ── 1. CONFIGURATIE ──────────────────────────────────────────────────────────
CSV_PATH = "data/api_export_campers.csv"
SHEET_NAME = "MasterData"

def get_connection():
    """Initialiseert de beveiligde verbinding met Google Sheets via Secrets."""
    return st.connection("gsheets", type=GSheetsConnection)

# ── 2. DATA LADEN ─────────────────────────────────────────────────────────────
def load_data():
    """
    Laadt de data uit Google Sheets (Cloud). 
    Zorgt er nu ook voor dat de stempelkolom altijd bestaat.
    """
    try:
        conn = get_connection()
        # ttl=0 dwingt een live verversing af (cruciaal voor beheer-updates)
        df = conn.read(worksheet=SHEET_NAME, ttl=0)
        
        if df is not None and not df.empty:
            # CHIRURGISCHE FIX: Garandeer dat de stempelkolom bestaat voor de metrics
            if "ai_gecheckt" not in df.columns:
                df["ai_gecheckt"] = "Nee"
            return df.fillna("Onbekend")
        elif df is not None:
             # Sheet is leeg, maar object bestaat: geef lege DF terug met stempelkolom
             return pd.DataFrame(columns=['naam', 'ai_gecheckt'])
            
    except Exception as e:
        logger.error(f"Cloud-fout bij load_data: {e}")
    
    # Fallback naar lokale CSV
    if os.path.exists(CSV_PATH):
        try:
            df_local = pd.read_csv(CSV_PATH)
            if not df_local.empty and "ai_gecheckt" not in df_local.columns:
                df_local["ai_gecheckt"] = "Nee"
            return df_local.fillna("Onbekend")
        except Exception:
            return pd.DataFrame()
    
    return pd.DataFrame()

def get_master_data():
    """Alias voor compatibiliteit met de Kaart-pagina."""
    return load_data()

# ── 3. DATA OPSLAAN ───────────────────────────────────────────────────────────
def save_data(df):
    """
    Schrijft de dataset naar Google Sheets én de lokale CSV fallback.
    """
    df_clean = df.fillna("Onbekend")
    
    # Cloud Save
    try:
        conn = get_connection()
        conn.update(worksheet=SHEET_NAME, data=df_clean)
        st.cache_data.clear()
    except Exception as e:
        logger.error(f"Cloud Save Fout: {e}")
        st.error(f"⚠️ Kon niet opslaan in Google Sheets: {e}")

    # Lokale Fallback Save
    try:
        os.makedirs(os.path.dirname(CSV_PATH), exist_ok=True)
        df_clean.to_csv(CSV_PATH, index=False)
    except Exception as e:
        logger.error(f"Lokale Save Fout: {e}")

# ── 4. API SYNCHRONISATIE ─────────────────────────────────────────────────────
@st.cache_data(ttl=86400)
def load_data_from_osm():
    """Haalt de actuele basis-dataset op via de Overpass API (OSM)."""
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
    
    mirrors = [
        "https://overpass-api.de/api/interpreter",
        "https://lz4.overpass-api.de/api/interpreter"
    ]
    
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
    """Filtert op landcode NL en wijst provincies toe via reverse geocoding."""
    coords = list(zip(df['latitude'], df['longitude']))
    results = rg.search(coords)
    
    df['landcode'] = [res['cc'] for res in results]
    df['provincie'] = [res['admin1'] for res in results]
    
    df_nl = df[df['landcode'] == 'NL'].copy()
    return df_nl.drop(columns=['landcode'])
