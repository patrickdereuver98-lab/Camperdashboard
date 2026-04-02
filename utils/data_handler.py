import pandas as pd
import streamlit as st
import requests

@st.cache_data(ttl=86400)
def load_data():
    """Haalt data op met een robuuste fallback architectuur."""
    
    # Standaard lege structuur om KeyErrors in de UI te voorkomen
    empty_df = pd.DataFrame(columns=[
        "naam", "latitude", "longitude", "provincie", 
        "honden_toegestaan", "aantal_plekken", "prijs", "website", "afbeelding"
    ])

    overpass_url = "http://overpass-api.de/api/interpreter"
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
    
    try:
        # Timeout van 10 seconden om de 504 Gateway Timeout ellende voor te zijn
        response = requests.post(overpass_url, data={'data': overpass_query}, timeout=10)
        response.raise_for_status()
        data = response.json()
    except Exception as e:
        st.sidebar.warning("Live data (OSM) tijdelijk niet beschikbaar. We gebruiken opgeslagen data.")
        try:
            return pd.read_csv("data/osm_campers.csv")
        except FileNotFoundError:
            try:
                return pd.read_csv("data/dummy_campers.csv")
            except FileNotFoundError:
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
            
        dog_tag = tags.get('dog', '').lower()
        fee, charge = tags.get('fee', ''), tags.get('charge', '')
        
        prijs = charge if charge else ('Betaald' if fee == 'yes' else ('Gratis' if fee == 'no' else 'Onbekend'))
        honden = "Ja" if dog_tag == 'yes' else ("Nee" if dog_tag == 'no' else "Onbekend")
        
        camper_data.append({
            "naam": tags.get('name', 'Onbekende Camperplaats'),
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
    df = df[df['naam'] != 'Onbekende Camperplaats']
    
    # Save a local copy silently for future fallback
    import os
    os.makedirs("data", exist_ok=True)
    try:
        df.to_csv("data/osm_campers.csv", index=False)
    except:
        pass
        
    return df if not df.empty else empty_df

def filter_data(df, provincie):
    """Basis filter (Afstand wordt nu via geo_logic afgehandeld)."""
    if df.empty:
        return df
    filtered_df = df.copy()
    if provincie != "Alle provincies":
        filtered_df = filtered_df[filtered_df['provincie'] == provincie]
    return filtered_df
