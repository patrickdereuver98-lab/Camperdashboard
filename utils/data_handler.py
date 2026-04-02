"""
utils/data_handler.py — Hardcoded Cloud Architectuur voor VrijStaan.
Dwingt de verbinding af door directe URL-injectie bij elke actie.
"""
import pandas as pd
import streamlit as st
from streamlit_gsheets import GSheetsConnection
import requests
import os
import reverse_geocoder as rg
import logging

# ── 0. LOGGER & CONFIG ───────────────────────────────────────────────────────
logger = logging.getLogger(__name__)

# De hardcoded bron van waarheid
SHEET_URL = "https://docs.google.com/spreadsheets/d/1lTkEDUzXI_nWqYlDsfS60azIDjiuX1cAV_686Ur6fAU/edit#gid=0"
SHEET_NAME = "MasterData"
CSV_PATH = "data/api_export_campers.csv"

def get_connection():
    """Initialiseert de basisverbinding."""
    return st.connection("gsheets", type=GSheetsConnection)

# ── 1. DATA LADEN (DIRECTE URL) ───────────────────────────────────────────────
def load_data():
    """
    Laadt data door de URL direct in de aanroep te dwingen.
    """
    try:
        conn = get_connection()
        # We injecteren de SHEET_URL direct in de read-call
        df = conn.read(spreadsheet=SHEET_URL, worksheet=SHEET_NAME, ttl=0)
        
        if df is not None and not df.empty:
            if "ai_gecheckt" not in df.columns:
                df["ai_gecheckt"] = "Nee"
            return df.fillna("Onbekend")
            
    except Exception as e:
        logger.error(f"Cloud-leesfout: {e}")
    
    # Fallback naar lokaal
    if os.path.exists(CSV_PATH):
        try:
            df_local = pd.read_csv(CSV_PATH)
            if "ai_gecheckt" not in df_local.columns:
                df_local["ai_gecheckt"] = "Nee"
            return df_local.fillna("Onbekend")
        except Exception:
            return pd.DataFrame()
    
    return pd.DataFrame()

def get_master_data():
    """Alias voor compatibiliteit met de Kaart-pagina."""
    return load_data()

# ── 2. DATA OPSLAAN (DIRECTE URL + LOCAL BACKUP) ──────────────────────────────
def save_data(df):
    """
    Slaat data op door de URL direct in de update-call te dwingen.
    """
    df_clean = df.fillna("Onbekend")
    
    # STAP 1: Altijd lokale backup (veiligheid voorop)
    try:
        os.makedirs(os.path.dirname(CSV_PATH), exist_ok=True)
        df_clean.to_csv(CSV_PATH, index=False)
    except Exception as e:
        logger.error(f"Lokale opslagfout: {e}")

    # STAP 2: Cloud Sync met geforceerde URL
    try:
        conn = get_connection()
        # Hier dwingen we de spreadsheet URL af om de 'None' error te voorkomen
        conn.update(spreadsheet=SHEET_URL, worksheet=SHEET_NAME, data=df_clean)
        st.cache_data.clear()
        st.toast("✅ Cloud gesynchroniseerd", icon="☁️")
    except Exception as e:
        logger.error(f"Cloud-schrijffout: {e}")
        st.toast("⚠️ Lokaal opgeslagen (Cloud tijdelijk offline)", icon="💾")

# ── 3. API SYNC ───────────────────────────────────────────────────────────────
@st.cache_data(ttl=86400)
def load_data_from_osm():
    """Haalt de basis-dataset op via de Overpass API."""
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
    headers = {"User-Agent": "VrijStaanApp/2.0", "Accept": "application/json"}
    
    try:
        response = requests.post("https://overpass-api.de/api/interpreter", 
                                 data={'data': overpass_query}, headers=headers, timeout=90)
        response.raise_for_status()
        data = response.json()
    except Exception:
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
            "naam": naam, "latitude": lat, "longitude": lon, "provincie": "Onbekend",
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
    """Filtert op NL en wijst provincies toe."""
    coords = list(zip(df['latitude'], df['longitude']))
    results = rg.search(coords)
    df['landcode'] = [res['cc'] for res in results]
    df['provincie'] = [res['admin1'] for res in results]
    df_nl = df[df['landcode'] == 'NL'].copy()
    return df_nl.drop(columns=['landcode'])
