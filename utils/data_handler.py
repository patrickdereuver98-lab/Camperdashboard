import pandas as pd
import streamlit as st
import requests
import os

CSV_PATH = "data/api_export_campers.csv"

@st.cache_data(ttl=86400)
def load_data():
    """
    Haalt de actuele dataset live op via de Overpass API.
    Inclusief robuuste headers om cloud-blokkades (429/504) te voorkomen
    en de uitgebreide query voor de juiste camperplaatsen.
    """
    
    # 1. De verbeterde query (Fase 1 fix)
    overpass_query = """
    [out:json][timeout:60];
    area["ISO3166-1"="NL"][admin_level=2]->.searchArea;
    (
      node["tourism"="caravan_site"](area.searchArea);
      way["tourism"="caravan_site"](area.searchArea);
      relation["tourism"="caravan_site"](area.searchArea);
      
      node["amenity"="parking"]["motorcar"="yes"](area.searchArea);
      node["tourism"="camp_site"]["motorhome"="yes"](area.searchArea);
    );
    out center;
    """
    
    # 2. Authenticatie-headers (Verplicht voor Streamlit Cloud)
    headers = {
        "User-Agent": "VrijStaanCamperApp/2.0 (Streamlit Cloud; info@vrijstaan.nl)",
        "Accept": "application/json"
    }
    
    # We gebruiken de primaire, meest stabiele endpoint
    url = "https://overpass-api.de/api/interpreter"
    
    try:
        # Timeout verhoogd naar 60 seconden om zware queries de ruimte te geven
        response = requests.post(url, data={'data': overpass_query}, headers=headers, timeout=60)
        response.raise_for_status()
        data = response.json()
        
    except requests.exceptions.Timeout:
        st.error("API Timeout: De server doet er te lang over. Probeer het over een minuut opnieuw.")
        return fallback_data()
    except requests.exceptions.HTTPError as err:
        st.error(f"API HTTP Fout: De verbinding is geweigerd. Details: {err}")
        return fallback_data()
    except Exception as e:
        st.error(f"Systeemfout bij ophalen API: {e}")
        return fallback_data()

    elements = data.get('elements', [])
    camper_data = []
    
    for el in elements:
        tags = el.get('tags', {})
        
        # Locatie bepalen afhankelijk van OSM element type
        if el['type'] == 'node':
            lat, lon = el.get('lat'), el.get('lon')
        else:
            lat, lon = el.get('center', {}).get('lat'), el.get('center', {}).get('lon')
            
        if not lat or not lon:
            continue
            
        naam = tags.get('name', '')
        if not naam:
            continue # Alleen plekken met een bekende naam tonen voor een strakke UI
            
        # Data vertalen naar onze UI velden
        fee = tags.get('fee', '')
        charge = tags.get('charge', '')
        prijs = charge if charge else ('Betaald' if fee == 'yes' else ('Gratis' if fee == 'no' else 'Onbekend'))
        
        dog = tags.get('dog', '').lower()
        honden = "Ja" if dog == 'yes' else ("Nee" if dog == 'no' else "Onbekend")
        
        power = tags.get('power_supply', '').lower()
        stroom = "Ja" if power == 'yes' else "Nee"
        
        water_pt = tags.get('water_point', '').lower()
        waterfront = "Ja" if water_pt == 'yes' else "Nee"
        
        camper_data.append({
            "naam": naam,
            "latitude": lat,
            "longitude": lon,
            "provincie": tags.get('is_in:province', tags.get('addr:province', 'Onbekend')),
            "honden_toegestaan": honden,
            "stroom": stroom,
            "waterfront": waterfront,
            "aantal_plekken": tags.get('capacity', 'Onbekend'),
            "prijs": prijs,
            "website": tags.get('website', tags.get('contact:website', '')),
            "telefoon": tags.get('phone', tags.get('contact:phone', '')),
            "openingstijden": tags.get('opening_hours', 'Onbekend'),
            "afbeelding": "https://images.unsplash.com/photo-1523987355523-c7b5b0dd90a7?auto=format&fit=crop&w=300&q=80"
        })

    df = pd.DataFrame(camper_data)
    
    # Sla succesvolle API data direct op als nieuwe Master CSV
    if not df.empty:
        os.makedirs(os.path.dirname(CSV_PATH), exist_ok=True)
        df.to_csv(CSV_PATH, index=False)
        
    return df

def fallback_data():
    """Valt terug op de eerder opgeslagen CSV als de live API weigert."""
    if os.path.exists(CSV_PATH):
        return pd.read_csv(CSV_PATH)
    return pd.DataFrame()

def validate_and_merge(master_df, import_df):
    """Samenvoegen van CSV met master data inclusief duplicaten controle."""
    if master_df.empty:
        return import_df, ["Master was leeg, import direct geaccepteerd."]
        
    combined = pd.concat([master_df, import_df], ignore_index=True)
    # Verwijder duplicaten op basis van de locatienaam
    initial_len = len(combined)
    combined.drop_duplicates(subset=['naam'], keep='last', inplace=True)
    dropped = initial_len - len(combined)
    
    warnings = [f"{dropped} duplicaten verwijderd tijdens samenvoegen."] if dropped > 0 else []
    return combined, warnings
