import pandas as pd
import streamlit as st
import requests

@st.cache_data(ttl=86400) # Cache de data voor 24 uur (86400 seconden) voor optimale prestaties
def load_data():
    """Haalt actuele camper data live op van OpenStreetMap en structureert dit."""
    
    overpass_url = "http://overpass-api.de/api/interpreter"
    overpass_query = """
    [out:json][timeout:90];
    area["ISO3166-1"="NL"][admin_level=2]->.searchArea;
    (
      node["tourism"="caravan_site"](area.searchArea);
      way["tourism"="caravan_site"](area.searchArea);
      relation["tourism"="caravan_site"](area.searchArea);
    );
    out center;
    """
    
    try:
        response = requests.post(overpass_url, data={'data': overpass_query})
        response.raise_for_status()
        data = response.json()
    except Exception as e:
        st.error(f"Fout bij ophalen van live API data: {e}")
        # Val terug op de dummy data als OSM plat ligt
        try:
            return pd.read_csv("data/dummy_campers.csv")
        except:
            return pd.DataFrame()

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
            
        naam = tags.get('name', 'Onbekende Camperplaats')
        
        dog_tag = tags.get('dog', '').lower()
        honden = "Ja" if dog_tag == 'yes' else "Nee" if dog_tag == 'no' else "Onbekend"
        
        capaciteit = tags.get('capacity', '?')
        
        fee, charge = tags.get('fee', ''), tags.get('charge', '')
        if charge:
            prijs = charge
        elif fee == 'yes':
            prijs = 'Betaald'
        elif fee == 'no':
            prijs = 'Gratis'
        else:
            prijs = 'Onbekend'
            
        provincie = tags.get('is_in:province', tags.get('addr:province', 'Onbekend'))
        
        camper_data.append({
            "naam": naam,
            "latitude": lat,
            "longitude": lon,
            "provincie": provincie,
            "honden_toegestaan": honden,
            "aantal_plekken": capaciteit,
            "prijs": prijs,
            "website": tags.get('website', tags.get('contact:website', '')),
            "afbeelding": "https://images.unsplash.com/photo-1523987355523-c7b5b0dd90a7?auto=format&fit=crop&w=300&q=80"
        })

    df = pd.DataFrame(camper_data)
    df = df[df['naam'] != 'Onbekende Camperplaats']
    
    return df

def filter_data(df, provincie, max_afstand):
    """Filtert de dataset op basis van gebruikersinput."""
    if df.empty:
        return df
        
    filtered_df = df.copy()
    
    if provincie != "Alle provincies":
        filtered_df = filtered_df[filtered_df['provincie'] == provincie]
        
    return filtered_df
