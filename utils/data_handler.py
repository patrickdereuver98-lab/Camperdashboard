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
    Gebruikt een "Failover" systeem: als server A faalt (bijv. 504 Timeout), 
    probeert hij direct server B. Faalt alles? Dan valt hij terug op de CSV.
    """
    
    # 1. De brede query voor maximale dekking
    overpass_query = """
    [out:json][timeout:90];
    area["ISO3166-1"="NL"][admin_level=2]->.searchArea;
    (
      node["tourism"="caravan_site"](area.searchArea);
      way["tourism"="caravan_site"](area.searchArea);
      relation["tourism"="caravan_site"](area.searchArea);
      
      node["amenity"="parking"]["motorhome"="yes"](area.searchArea);
      way["amenity"="parking"]["motorhome"="yes"](area.searchArea);
      
      node["tourism"="camp_site"](area.searchArea);
      way["tourism"="camp_site"](area.searchArea);
      relation["tourism"="camp_site"](area.searchArea);
    );
    out center;
    """
    
    headers = {
        "User-Agent": "VrijStaanCamperApp/2.0 (Streamlit Cloud; info@vrijstaan.nl)",
        "Accept": "application/json"
    }
    
    # 2. De Failover Mirrors (onze reddingsboeien)
    mirrors = [
        "https://overpass-api.de/api/interpreter",        # Hoofdserver
        "https://lz4.overpass-api.de/api/interpreter",    # Mirror 1 (Duitsland)
        "https://z.overpass-api.de/api/interpreter",      # Mirror 2 (Duitsland)
        "https://overpass.kumi.systems/api/interpreter"   # Mirror 3 (Alternatief netwerk)
    ]
    
    data = None
    
    # Loop door de servers heen tot er eentje antwoord geeft
    for url in mirrors:
        try:
            response = requests.post(url, data={'data': overpass_query}, headers=headers, timeout=90)
            response.raise_for_status() # Gooit een error bij 504, 502, 429 etc.
            data = response.json()
            break # Succes! Breek uit de loop en ga door.
        except requests.exceptions.RequestException:
            # Server gefaald, ga stil door naar de volgende in de lijst
            continue
            
    # 3. Faalt alles? Fallback naar CSV met duidelijke melding
    if not data:
        st.warning("⚠️ Alle OSM-servers zijn momenteel overbelast (Timeout). We zijn succesvol teruggevallen op de laatste lokale export (CSV).")
        return fallback_data()

    # 4. Data Verwerking
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
            "provincie": "Onbekend", # Wordt verrijkt door reverse_geocoder
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
    
    # 5. Data Verrijking (Reverse Geocoder) & Harde NL-Filter
    if not df.empty:
        df = enforce_nl_and_enrich_provinces(df)
        
        # Sla op als nieuwe fallback Master CSV
        os.makedirs(os.path.dirname(CSV_PATH), exist_ok=True)
        df.to_csv(CSV_PATH, index=False)
        
    return df

def enforce_nl_and_enrich_provinces(df):
    """
    Reverse-geocodes coördinaten om lege provincies in te vullen
    en trekt een keiharde grens: alleen landcode 'NL' blijft over.
    """
    coords = list(zip(df['latitude'], df['longitude']))
    results = rg.search(coords)
    
    df['landcode'] = [res['cc'] for res in results]
    df['berekende_provincie'] = [res['admin1'] for res in results]
    
    # Strikte filter
    df_nl = df[df['landcode'] == 'NL'].copy()
    
    # Provincies overschrijven
    df_nl['provincie'] = df_nl['berekende_provincie']
    df_nl = df_nl.drop(columns=['landcode', 'berekende_provincie'])
    
    return df_nl

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
    initial_len = len(combined)
    combined.drop_duplicates(subset=['naam'], keep='last', inplace=True)
    dropped = initial_len - len(combined)
    
    warnings = [f"{dropped} duplicaten verwijderd tijdens samenvoegen."] if dropped > 0 else []
    return combined, warnings
