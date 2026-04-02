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
    Inclusief robuuste headers, een brede camping-query en
    een keiharde 'Double Lock' filter op uitsluitend Nederlands grondgebied.
    """
    
    # 1. API Laag: Vraag om de Nederlandse grens
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
    
    url = "https://overpass-api.de/api/interpreter"
    
    try:
        response = requests.post(url, data={'data': overpass_query}, headers=headers, timeout=90)
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
            # We zetten provincie tijdelijk op Onbekend, de Reverse Geocoder lost dit zometeen op
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
    
    # Data Verrijking & Harde NL-Filter
    if not df.empty:
        df = enforce_nl_and_enrich_provinces(df)
        
        os.makedirs(os.path.dirname(CSV_PATH), exist_ok=True)
        df.to_csv(CSV_PATH, index=False)
        
    return df

def enforce_nl_and_enrich_provinces(df):
    """
    Reverse-geocodes coördinaten. 
    1. Filtert genadeloos alles weg wat geen 'NL' landcode heeft.
    2. Vult de lege provincies in met keiharde data.
    """
    # Zet lat/lon om naar tuples voor de module
    coords = list(zip(df['latitude'], df['longitude']))
    
    # Zoek lokaal en offline de locatiegegevens op (dit kost slechts 1 seconde voor 4000 rijen)
    results = rg.search(coords)
    
    # Maak nieuwe kolommen voor het filteren
    df['landcode'] = [res['cc'] for res in results]
    df['berekende_provincie'] = [res['admin1'] for res in results]
    
    # ── DE HARDE EIS: Alleen Nederland ──
    df_nl = df[df['landcode'] == 'NL'].copy()
    
    # Overschrijf de 'Onbekend' provincies met de werkelijke data
    # (Bijv. 'North Brabant' naar 'Noord-Brabant' vertalen doen we op een later moment in de UI als we willen, 
    # maar rg pakt standaard de correcte admin namen).
    df_nl['provincie'] = df_nl['berekende_provincie']
    
    # Opruimen van tijdelijke kolommen
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
