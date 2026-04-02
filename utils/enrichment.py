import json
import streamlit as st
from utils.ai_helper import get_gemini_response

def research_location(row):
    """
    Onderzoekt één locatie en zorgt dat de tekst van de AI 
    wordt omgezet naar een Python dictionary.
    """
    naam = row.get('naam', 'Onbekende locatie')
    stad = row.get('provincie', 'Nederland')
    website = row.get('website', '')

    prompt = f"""
    Onderzoek de camperplaats: {naam} in {stad}. Website: {website}
    Geef uitsluitend JSON terug:
    {{
        "prijs": "waarde",
        "honden_toegestaan": "Ja/Nee",
        "stroom": "Ja/Nee",
        "beschrijving": "1 korte zin"
    }}
    """
    
    try:
        response_text = get_gemini_response(prompt)
        
        # Zoek de JSON-haken { } in de tekst (voor het geval de AI extra tekst typt)
        start = response_text.find('{')
        end = response_text.rfind('}') + 1
        
        if start != -1 and end != -1:
            json_str = response_text[start:end]
            return json.loads(json_str) # Dit maakt er een dictionary van
        return None
    except Exception:
        return None
