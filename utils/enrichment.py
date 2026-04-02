import streamlit as st
import pandas as pd
from utils.ai_helper import get_gemini_response # We gebruiken je bestaande AI koppeling

def research_location(row):
    """
    Voert een diepte-onderzoek uit voor één specifieke locatie.
    """
    naam = row['naam']
    stad = row.get('provincie', '') # Stad/Provincie voor context
    website = row.get('website', '')

    # Prompt voor Gemini om de data te verifiëren/vinden
    prompt = f"""
    Je bent een expert in de Nederlandse campermarkt. 
    Onderzoek de volgende camperplaats: {naam} in {stad}.
    Website indien bekend: {website}

    Zoek of leid af uit je kennis:
    1. Wat is de geschatte prijs per nacht (of 'Gratis')?
    2. Zijn honden toegestaan (Ja/Nee)?
    3. Is er stroom aanwezig (Ja/Nee)?
    4. Een korte, wervende beschrijving van max 20 woorden.

    Antwoord uitsluitend in dit JSON formaat:
    {{
        "prijs": "waarde",
        "honden": "Ja/Nee",
        "stroom": "Ja/Nee",
        "beschrijving": "tekst"
    }}
    """
    
    try:
        # Hier roepen we je AI aan
        response = get_gemini_response(prompt)
        # (Hier voegen we later logica toe om de JSON te parsen)
        return response 
    except Exception as e:
        return None
