import pandas as pd
import streamlit as st
import requests
import time
import os

@st.cache_data(ttl=86400)
def load_data():
    """Haalt data live op via OSM API met failover-logica en auto-export."""
    
    empty_df = pd.DataFrame(columns=[
        "naam", "latitude", "longitude", "provincie", 
        "honden_toegestaan", "aantal_plekken", "prijs", "website", "afbeelding"
    ])

    # Failover servers: Als de één een 504 geeft, pakt hij direct de volgende
    endpoints = [
        "https://overpass-api.de/api/interpreter",
        "https://lz4.overpass-api.de/api/interpreter",
        "https://overpass.kumi.systems/api/interpreter"
    ]
    
    overpass_query = """
    [out:json][timeout:25];
    area["ISO3166-1"="NL"][admin_level=2]->.searchArea;
    (
      node["tourism"="caravan_site"](area.searchArea);
      way["tourism"="caravan_site"](area.searchArea);
      relation["tourism"="caravan_site"](area.searchArea);
    );
    out center;
    """
    
    # Strikte HTTP Headers - Verplicht door OSM beleid voor cloud-apps
    headers = {
        "User-Agent": "VrijStaanCamperApp/1.0 (Streamlit Cloud Integration)"
    }
    
    data = None
    
    # --- FAILOVER LOOP ---
    for url in endpoints:
        try:
            response = requests.post(url, data={'data': overpass_query}, headers=headers, timeout=15)
            response.raise_for_status()
            data = response.json()
            break  # Succes! Breek uit de loop
        except Exception:
            time.sleep(1)  # Wacht 1 seconde en probeer de volgende mirror
            
    if not data:
        st.error("Systeemfout: Alle OSM API servers weigeren momenteel de verbinding (504 Timeout).")
        return empty_df

    elements = data.get('elements', [])
    camper_data = []
    
    for el in elements:
        tags = el.get('tags', {})
        if el['type'] == 'node':
            lat, lon = el.get('lat'), el.get('lon')
        else:
            lat, lon = el.get('center', {}).get('lat'), el.get('center', {}).get('lon')
            
        if not lat or not lon:
            continue
            
        naam = tags.get('name')
        if not naam:
            continue  # We negeren plekken zonder naam voor een schone UI
            
        dog_tag = tags.get('dog', '').lower()
        fee, charge = tags.get('fee', ''), tags.get('charge', '')
        
        prijs = charge if charge else ('Betaald' if fee == 'yes' else ('Gratis' if fee == 'no' else 'Onbekend'))
        honden = "Ja" if dog_tag == 'yes' else ("Nee" if dog_tag == 'no' else "Onbekend")
        
        camper_data.append({
            "naam": naam,
            "latitude": lat,
            "longitude": lon,
            "provincie": tags.get('is_in:province', tags.get('addr:province', 'Onbekend')),
            "honden_toegestaan": honden,
            "aantal_plekken": tags.get('capacity', '?'),
            "prijs": prijs,
            "website": tags.get('website', tags.get('contact:website', '')),
            "afbeelding": "https://images.unsplash.com/photo-1523987355523-c7b5b0dd90a7?auto=format&fit=crop&w=300&q=80"
        })

    df = pd.DataFrame(camper_data)
    
    # --- AUTO-EXPORT FUNCTIE ---
    # Zodra de API succesvol is, schrijven we dit direct weg als backup CSV
    try:
        os.makedirs("data", exist_ok=True)
        df.to_csv("data/api_export_campers.csv", index=False)
    except Exception:
        pass
        
    return df if not df.empty else empty_df

def filter_data(df, provincie):
    """Basis filter voor provincies."""
    if df.empty:
        return df
    
    filtered_df = df.copy()
    if provincie != "Alle provincies":
        filtered_df = filtered_df[filtered_df['provincie'] == provincie]
        
    return filtered_df
