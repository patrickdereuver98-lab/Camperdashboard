"""
utils/data_handler.py — Cloud-Powered Data Architectuur voor VrijStaan.
Geoptimaliseerd voor strikte Camper-focus, NL-regio en technische stabiliteit.
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

# ── 1. CONFIGURATIE (STABILITEIT) ─────────────────────────────────────────────
# Hardcoded URL om "Spreadsheet must not be None" errors te voorkomen.
SHEET_URL = "https://docs.google.com/spreadsheets/d/1lTkEDUzXI_nWqYlDsfS60azIDjiuX1cAV_686Ur6fAU/edit"
SHEET_NAME = "MasterData"
CSV_PATH = "data/api_export_campers.csv"

def get_connection():
    """Initialiseert de beveiligde verbinding met Google Sheets."""
    return st.connection("gsheets", type=GSheetsConnection)

# ── 2. DATA LADEN (ARROW-FIX & URL INJECTIE) ──────────────────────────────────
def load_data():
    """
    Laadt de data uit Google Sheets. Converteert naar object-type om 
    TypeError (Arrow-strings) bij AI-verrijking te voorkomen.
    """
    try:
        conn = get_connection()
        # Gebruik de hardcoded URL voor directe binding
        df = conn.read(spreadsheet=SHEET_URL, worksheet=SHEET_NAME, ttl=0)
        if df is not None and not df.empty:
            # CRUCIALE FIX: Voorkom dat Pandas kolommen als immutable Arrow-strings lockt
            df = df.astype(object)
            if "ai_gecheckt" not in df.columns:
                df["ai_gecheckt"] = "Nee"
            return df.fillna("Onbekend")
    except Exception as e:
        logger.error(f"Cloud-fout bij load_data: {e}")
    
    # Fallback naar lokale CSV voor AI-loop continuïteit
    if os.path.exists(CSV_PATH):
        try:
            df_local = pd.read_csv(CSV_PATH).astype(object)
            if "ai_gecheckt" not in df_local.columns:
                df_local["ai_gecheckt"] = "Nee"
            return df_local.fillna("Onbekend")
        except Exception:
            return pd.DataFrame()
    
    return pd.DataFrame()

def get_master_data():
    """Alias voor compatibiliteit met de Kaart-pagina."""
    return load_data()

# ── 3. DATA OPSLAAN (SILENT CLOUD FAIL) ───────────────────────────────────────
def save_data(df):
    """
    Schrijft data ALTIJD eerst lokaal en probeert daarna de Cloud.
    Gebruikt st.toast om de AI-loop niet te onderbreken bij cloud-instabiliteit.
    """
    df_clean = df.fillna("Onbekend")
    
    # STAP 1: Lokale Backup (Zekerheid voorop)
    try:
        os.makedirs(os.path.dirname(CSV_PATH), exist_ok=True)
        df_clean.to_csv(CSV_PATH, index=False)
    except Exception as e:
        logger.error(f"Lokale Save Fout: {e}")

    # STAP 2: Cloud Sync
    try:
        conn = get_connection()
        conn.update(spreadsheet=SHEET_URL, worksheet=SHEET_NAME, data=df_clean)
        st.cache_data.clear()
    except Exception as e:
        logger.error(f"Cloud Save Fout: {e}")
        # Geen harde error, zodat de AI batch gewoon door kan gaan
        st.toast("⚠️ Cloud sync vertraagd, lokaal opgeslagen.", icon="💾")

# ── 4. STRIKTE CAMPER-ONLY OSM SYNC ───────────────────────────────────────────
@st.cache_data(ttl=86400)
def load_data_from_osm():
    """
    Haalt data op van OSM.
    Harde eis: Alleen designated camperplaatsen en camper-vriendelijke parkeercapaciteit.
    """
    # De query is aangescherpt: tourism=camp_site wordt alleen gepakt als er expliciet motorhome=yes bij staat.
    overpass_query = """
    [out:json][timeout:120][bbox:50.75,3.36,53.56,7.23];
    (
      node["tourism"="caravan_site"];
      way["tourism"="caravan_site"];
      relation["tourism"="caravan_site"];
      node["amenity"="parking"]["motorhome"="yes"];
      way["amenity"="parking"]["motorhome"="yes"];
      node["tourism"="camp_site"]["motorhome"~"yes|designated"];
      way["tourism"="camp_site"]["motorhome"~"yes|designated"];
      relation["tourism"="camp_site"]["motorhome"~"yes|designated"];
    );
    out center;
    """
    
    headers = {"User-Agent": "VrijStaanApp/3.0", "Accept": "application/json"}
    
    try:
        response = requests.post("https://lz4.overpass-api.de/api/interpreter", 
                                 data={'data': overpass_query}, headers=headers, timeout=120)
        response.raise_for_status()
        data = response.json()
    except Exception as e:
        logger.error(f"OSM Sync Fout: {e}")
        return pd.DataFrame()

    elements = data.get('elements', [])
    camper_data = []
    
    # Sloop-filter voor niet-camper locaties
    blacklist = ["hotel", "appartement", "bungalow", "chalet", "vakantiepark", "resort", "villa", "studio"]

    for el in elements:
        tags = el.get('tags', {})
        naam = tags.get('name') or f"Camperplaats {tags.get('addr:city', '')}".strip() or "Onbekende Camperplek"
        
        # Check: Is de naam camper-onvriendelijk?
        if any(word in naam.lower() for word in blacklist):
            continue
            
        lat = el.get('lat') or el.get('center', {}).get('lat')
        lon = el.get('lon') or el.get('center', {}).get('lon')
        if not lat or not lon: continue
        
        # Telefoonnummer-fix: Forceer als tekst om de voorloopnul te behouden
        tel_raw = tags.get('phone') or tags.get('contact:phone') or ""
        telefoon = str(tel_raw).replace(" ", "").replace("-", "")

        camper_data.append({
            "naam": naam,
            "latitude": lat,
            "longitude": lon,
            "telefoonnummer": telefoon,
            "provincie": "Onbekend",
            "honden_toegestaan": "Ja" if tags.get('dog') == 'yes' else "Onbekend",
            "stroom": "Ja" if tags.get('power_supply') == 'yes' else "Onbekend",
            "waterfront": "Ja" if tags.get('water_point') == 'yes' else "Onbekend",
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

# ── 5. REGIO VALIDATIE (NEDERLAND FOCUS) ──────────────────────────────────────
def enforce_nl_and_enrich_provinces(df):
    """Filtert op landcode NL en wijst provincies toe."""
    coords = list(zip(df['latitude'], df['longitude']))
    results = rg.search(coords)
    df['landcode'] = [res['cc'] for res in results]
    df['berekende_provincie'] = [res['admin1'] for res in results]
    
    # Harde eis: Alleen Nederland
    df_nl = df[df['landcode'] == 'NL'].copy()
    df_nl['provincie'] = df_nl['berekende_provincie']
    
    return df_nl.drop(columns=['landcode', 'berekende_provincie'])
