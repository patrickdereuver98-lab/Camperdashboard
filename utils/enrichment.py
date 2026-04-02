"""
utils/enrichment.py — AI-Extractie Motor.
Functie: Voert ruwe websitetekst aan de AI en vraagt een strikt JSON object terug.
"""
import json
import streamlit as st
from utils.ai_helper import get_gemini_response
from utils.scraper import fetch_clean_text

def research_location(row):
    naam = row.get('naam', 'Onbekende locatie')
    stad = row.get('provincie', 'Nederland')
    website = row.get('website', '')

    # 1. Start het scrape proces
    st.write(f"🌐 Website ophalen: {website}")
    website_content = fetch_clean_text(website)

    # Als de scraper echt faalt, proberen we het zonder tekst (als fallback)
    if website_content.startswith("Fout:"):
        st.warning(website_content)

    # 2. Bouw de AI-instructie op
    prompt = f"""
Je bent een Senior Data Analist voor een camper-app.
Hieronder vind je de ruwe tekst van de website van camperplaats '{naam}' in '{stad}'.

BRONTEKST VAN WEBSITE:
--------------------------------------------------
{website_content}
--------------------------------------------------

Jouw taak: Lees de bovenstaande tekst en haal de volgende 18 velden eruit.
Als een specifiek detail niet in de tekst te vinden is, vul dan EXACT "Onbekend" in.
Tijden mogen als format "14:00/11:00" of tekst.
Beoordeling moet een cijfer op 5 zijn als dat vermeld is, anders "Onbekend".

Retourneer UITSLUITEND een geldig JSON-object:
{{
    "prijs": "Huidige prijs per nacht of Gratis",
    "honden_toegestaan": "Ja/Nee/Onbekend",
    "stroom": "Ja/Nee/Onbekend",
    "stroom_prijs": "Kosten per nacht/kWh of 'Inbegrepen' of Onbekend",
    "afvalwater": "Ja/Nee/Onbekend",
    "chemisch_toilet": "Ja/Nee/Onbekend",
    "water_tanken": "Ja/Nee/Onbekend",
    "aantal_plekken": "Totaal aantal plekken of Onbekend",
    "check_in_out": "Tijden of Onbekend",
    "website": "{website}",
    "beschrijving": "Max 20 woorden sfeeromschrijving op basis van de tekst",
    "ondergrond": "Gras/Asfalt/Grind/Verhard of Onbekend",
    "toegankelijkheid": "Ja/Nee of Onbekend",
    "rust": "Rustig/Druk of Onbekend",
    "sanitair": "Ja/Nee/Onbekend",
    "wifi": "Ja/Nee/Onbekend",
    "beoordeling": "Score of Onbekend",
    "samenvatting_reviews": "Max 15 woorden over de algemene mening of Onbekend",
    "extra": []
}}
"""
    
    # 3. Roep Gemini aan (puur tekst-gebaseerd nu, geen Google Search Tool nodig)
    response_text = get_gemini_response(prompt)

    # X-RAY DEBUG: Toon wat de AI teruggeeft
    with st.expander(f"⚙️ Bekijk ruwe AI output voor {naam}"):
        st.text(response_text)

    # 4. JSON Extractie
    try:
        start = response_text.find('{')
        end = response_text.rfind('}') + 1
        if start != -1 and end != -1:
            json_data = json.loads(response_text[start:end])
            return json_data
        else:
            st.error(f"Geen JSON structuur gevonden voor {naam}.")
            return None
    except json.JSONDecodeError as e:
        st.error(f"JSON Parse Fout bij {naam}: {e}")
        return None
    except Exception as e:
        st.error(f"Onverwachte fout bij data-extractie voor {naam}: {e}")
        return None
