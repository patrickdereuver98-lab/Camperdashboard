"""
utils/enrichment.py — Debug versie om de "Silent Crash" te ontmaskeren.
"""
import json
import streamlit as st
from utils.ai_helper import get_gemini_response

def research_location(row):
    naam = row.get('naam', 'Onbekende locatie')
    stad = row.get('provincie', 'Nederland')
    website = row.get('website', '')

    prompt = f"""
    ONDERZOEKSTAAK: Verzamel alle details over camperplaats '{naam}' in '{stad}'.
    Primaire bron: {website}
    
    Gebruik Google Search om de volgende 18 velden te verifiëren. 
    Zoek op de officiële prijslijst en faciliteitenpagina.

    Retourneer uitsluitend JSON:
    {{
        "prijs": "Huidige prijs per nacht",
        "honden_toegestaan": "Ja/Nee/Onbekend",
        "stroom": "Ja/Nee/Onbekend",
        "stroom_prijs": "Kosten per nacht/kWh of 'Inbegrepen'",
        "afvalwater": "Ja/Nee/Onbekend",
        "chemisch_toilet": "Ja/Nee/Onbekend",
        "water_tanken": "Ja/Nee/Onbekend",
        "aantal_plekken": "Totaal aantal plekken",
        "check_in_out": "Tijden (bijv. 14:00/11:00)",
        "website": "Directe URL naar de camping",
        "beschrijving": "Max 20 woorden sfeeromschrijving",
        "ondergrond": "Gras/Asfalt/Grind",
        "toegankelijkheid": "Ja/Nee (geschikt voor >8m?)",
        "rust": "Rustig/Druk",
        "sanitair": "Ja/Nee",
        "wifi": "Ja/Nee",
        "beoordeling": "Score (1-5) op basis van reviews",
        "samenvatting_reviews": "Max 15 woorden over de algemene mening",
        "extra": []
    }}
    """
    
    response_text = get_gemini_response(prompt)

    # ── DEBUGGING: Toon de exacte output van Gemini op het scherm ──
    st.warning(f"🔍 Ruwe AI Output voor {naam}:")
    st.text(response_text)

    try:
        start = response_text.find('{')
        end = response_text.rfind('}') + 1
        if start != -1 and end != -1:
            return json.loads(response_text[start:end])
        else:
            st.error("Geen JSON haken gevonden in het antwoord.")
            return None
    except Exception as e:
        # Nu zien we waarom hij crasht
        st.error(f"JSON Parse Fout: {e}")
        return None
