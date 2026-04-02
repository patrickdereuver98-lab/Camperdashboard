import pandas as pd
import streamlit as st
import requests
import os
import reverse_geocoder as rg

CSV_PATH = "data/api_export_campers.csv"

@st.cache_data(ttl=86400)
def load_data():
    """
    Haalt de actuele dataset live op via de Overpass API.
    Gebruikt een razendsnelle Bounding Box (BBOX) in plaats van trage Area-berekeningen.
    """
    
    # 1. Bounding Box voor Nederland (Zuid, West, Noord, Oost)
    # Dit is extreem veel sneller voor de OSM servers om te verwerken.
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
        "User-Agent": "VrijStaanCamperApp/2.0 (Streamlit Cloud; info@vrijstaan.nl)",
        "Accept": "application/json"
    }
    
    mirrors = [
        "https://overpass-api.de/api/interpreter",
        "https://lz4.overpass-api.de/api/interpreter",
        "https://z.overpass-api.de/api/interpreter",
        "https://overpass.kumi.systems/api/interpreter"
    ]
    
    data = None
    
    for url in mirrors:
        try:
            response = requests.post(url, data={'data': overpass_query}, headers=headers, timeout=90)
            response.raise_for_status()
            data = response.json()
            break 
        except requests.exceptions.RequestException:
            continue
            
    if not data:
        st.warning("⚠️ Alle OSM-servers zijn momenteel overbelast. We zijn succesvol teruggevallen op de lokale CSV.")
        return fallback_data()

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
            
        naam = tags.get('name', '')
        if not naam:
            stad = tags.get('addr:city', tags.get('is_in:city', ''))
            naam = f"Camperplaats {stad}".strip() if stad else "Naamloze Locatie"
            
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
            "provincie": "Onbekend",
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
    
    if not df.empty:
        df = enforce_nl_and_enrich_provinces(df)
        
        os.makedirs(os.path.dirname(CSV_PATH), exist_ok=True)
        df.to_csv(CSV_PATH, index=False)
        
    return df

def enforce_nl_and_enrich_provinces(df):
    """
    Reverse-geocodes coördinaten. 
    Omdat we een rechthoek (BBOX) gebruikten over NL heen, zitten er nu Belgische
    en Duitse campings in de lijst. Deze landcode filter haalt ze er genadeloos uit.
    """
    coords = list(zip(df['latitude'], df['longitude']))
    results = rg.search(coords)
    
    df['landcode'] = [res['cc'] for res in results]
    df['berekende_provincie'] = [res['admin1'] for res in results]
    
    # ── DE HARDE EIS: Alleen Nederland ──
    df_nl = df[df['landcode'] == 'NL'].copy()
    
    # Provincies overschrijven
    df_nl['provincie'] = df_nl['berekende_provincie']
    df_nl = df_nl.drop(columns=['landcode', 'berekende_provincie'])
    
    return df_nl

def fallback_data():
    if os.path.exists(CSV_PATH):
        return pd.read_csv(CSV_PATH)
    return pd.DataFrame()

def validate_and_merge(master_df, import_df):
    if master_df.empty:
        return import_df, ["Master was leeg, import direct geaccepteerd."]
        
    combined = pd.concat([master_df, import_df], ignore_index=True)
    initial_len = len(combined)
    combined.drop_duplicates(subset=['naam'], keep='last', inplace=True)
    dropped = initial_len - len(combined)
    
    warnings = [f"{dropped} duplicaten verwijderd tijdens samenvoegen."] if dropped > 0 else []
    return combined, warnings
