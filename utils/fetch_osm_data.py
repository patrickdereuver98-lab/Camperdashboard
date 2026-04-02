import requests
import pandas as pd
import os

def fetch_camper_places():
    print("🚀 Start ophalen van data via OpenStreetMap (Overpass API)...")
    
    # Overpass QL query: Zoek alle 'caravan_site' locaties in Nederland
    # We gebruiken de ISO code voor Nederland om de zoekopdracht af te bakenen
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
        print(f"❌ Fout bij ophalen van data: {e}")
        return

    elements = data.get('elements', [])
    print(f"✅ {len(elements)} ruwe locaties gevonden. Bezig met structureren...")

    camper_data = []
    
    for el in elements:
        tags = el.get('tags', {})
        
        # Extract coördinaten (nodes hebben direct lat/lon, ways/relations hebben een berekend 'center')
        if el['type'] == 'node':
            lat = el.get('lat')
            lon = el.get('lon')
        else:
            lat = el.get('center', {}).get('lat')
            lon = el.get('center', {}).get('lon')
            
        if not lat or not lon:
            continue
            
        # Mapping van ruwe OSM tags naar onze gestructureerde CSV kolommen
        naam = tags.get('name', 'Onbekende Camperplaats')
        
        # Honden beleid vertalen (OSM gebruikt 'yes' of 'no')
        dog_tag = tags.get('dog', '').lower()
        honden = "Ja" if dog_tag == 'yes' else "Nee" if dog_tag == 'no' else "Onbekend"
        
        capaciteit = tags.get('capacity', '?')
        
        # Prijs logica (fee kan 'yes'/'no' zijn, charge bevat vaak het bedrag)
        fee = tags.get('fee', '')
        charge = tags.get('charge', '')
        if charge:
            prijs = charge
        elif fee == 'yes':
            prijs = 'Betaald'
        elif fee == 'no':
            prijs = 'Gratis'
        else:
            prijs = 'Onbekend'
            
        website = tags.get('website', tags.get('contact:website', ''))
        
        # Provincie is in OSM vaak niet direct ingevuld op lokaal niveau, we gebruiken een fallback
        provincie = tags.get('is_in:province', tags.get('addr:province', 'Onbekend'))
        
        # Standaard placeholder afbeelding voor de UI
        afbeelding = "https://images.unsplash.com/photo-1523987355523-c7b5b0dd90a7?auto=format&fit=crop&w=300&q=80"
        
        camper_data.append({
            "naam": naam,
            "latitude": lat,
            "longitude": lon,
            "provincie": provincie,
            "honden_toegestaan": honden,
            "aantal_plekken": capaciteit,
            "prijs": prijs,
            "website": website,
            "afbeelding": afbeelding
        })

    df = pd.DataFrame(camper_data)
    
    # Zorg dat de data map bestaat en verwijder eventuele lege resultaten
    os.makedirs("data", exist_ok=True)
    df = df[df['naam'] != 'Onbekende Camperplaats'] # Filter plekken zonder naam eruit voor een schonere UI
    
    # Opslaan als onze nieuwe dataset
    output_path = "data/osm_campers.csv"
    df.to_csv(output_path, index=False)
    print(f"💾 Succes! {len(df)} camperplaatsen opgeslagen in {output_path}")

if __name__ == "__main__":
    fetch_camper_places()
