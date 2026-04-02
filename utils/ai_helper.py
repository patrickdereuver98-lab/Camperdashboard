"""
ai_helper.py — Geoptimaliseerde Gemini Flash integratie voor VrijStaan.
Inclusief: Google Search Grounding en Fuzzy Matching voor 18+ velden.
"""
import json
import pandas as pd
import streamlit as st
from utils.logger import logger

try:
    import google.generativeai as genai
    API_KEY = st.secrets["GEMINI_API_KEY"]
    genai.configure(api_key=API_KEY)
    
    # CRUCIALE FIX: Activeer Google Search Grounding
    model = genai.GenerativeModel(
        model_name="gemini-2.5-flash",
        tools=[{"google_search_retrieval": {}}] 
    )
    logger.info("Gemini model met Search Grounding geladen")
except KeyError:
    model = None
    logger.warning("GEMINI_API_KEY niet gevonden in st.secrets")
except Exception as e:
    model = None
    logger.error(f"Gemini laad-fout: {e}")


def get_gemini_response(prompt: str) -> str:
    """
    Algemene functie voor AI-onderzoek. Maakt gebruik van live web-data.
    """
    if model is None:
        return "Fout: AI model niet geconfigureerd."
    
    try:
        # Forceer het gebruik van de zoekmachine voor actuele feiten
        full_prompt = f"{prompt}\n\nBelangrijk: Gebruik de Google Search tool om actuele feiten te verifiëren."
        response = model.generate_content(full_prompt)
        return response.text
    except Exception as e:
        logger.error(f"Fout in get_gemini_response: {e}")
        return f"Fout: {str(e)}"


def process_ai_query(df: pd.DataFrame, user_query: str) -> tuple[pd.DataFrame, list[str]]:
    """
    Vertaalt zoekvragen naar filters via Fuzzy Matching om 0-resultaten te voorkomen.
    """
    if not user_query or df.empty:
        return df, []
    if model is None:
        return df, ["⚠️ AI niet beschikbaar — controleer API-key."]

    prompt = f"""
Je bent een backend data-extractor voor een Nederlandse camperdashboard-app.
Analyseer de zoekopdracht en extraheer filters als strikte JSON.

Zoekopdracht: "{user_query}"

Retourneer UITSLUITEND geldige JSON zonder markdown.
Gebruik null als een filter niet expliciet gevraagd wordt.

{{
  "provincie": "<provincienaam | null>",
  "honden_toegestaan": "<'Ja' of 'Nee' | null>",
  "is_gratis": "<true of false | null>",
  "stroom": "<'Ja' of 'Nee' | null>",
  "water": "<'Ja' | null>",
  "sanitair": "<'Ja' | null>",
  "wifi": "<'Ja' | null>"
}}
"""

    try:
        logger.info(f"AI query: '{user_query}'")
        response = model.generate_content(prompt)
        
        # Robuuste JSON extractie (voorkomt markdown crashes)
        raw_text = response.text
        start = raw_text.find('{')
        end = raw_text.rfind('}') + 1
        
        if start == -1 or end == 0:
            raise ValueError("Geen JSON gevonden in AI response.")
            
        filters = json.loads(raw_text[start:end])
        logger.info(f"AI filters ontvangen: {filters}")
    except Exception as e:
        logger.error(f"AI Verwerkingsfout: {e}")
        return df, ["⚠️ De AI begreep de zoekvraag niet volledig. Probeer het anders te formuleren."]

    filtered = df.copy()
    actief = []

    # ── FUZZY FILTERING (Ongevoelig voor hoofdletters/streepjes) ──

    prov = filters.get("provincie")
    if prov and prov != "null":
        filtered = filtered[filtered["provincie"].str.contains(prov, case=False, na=False)]
        actief.append(f"📍 {prov}")

    honden = filters.get("honden_toegestaan")
    if honden in ("Ja", "Nee"):
        filtered = filtered[filtered["honden_toegestaan"].astype(str).str.contains(honden, case=False, na=False)]
        actief.append(f"{'🐾' if honden == 'Ja' else '🚫'} Honden: {honden}")

    if filters.get("is_gratis") is True:
        filtered = filtered[filtered["prijs"].astype(str).str.lower().str.contains("gratis", na=False)]
        actief.append("💰 Gratis")

    stroom = filters.get("stroom")
    if stroom in ("Ja", "Nee"):
        filtered = filtered[filtered["stroom"].astype(str).str.contains(stroom, case=False, na=False)]
        actief.append(f"⚡ Stroom: {stroom}")

    if filters.get("water") == "Ja":
        mask = pd.Series(False, index=filtered.index)
        if "waterfront" in filtered.columns:
            mask = mask | filtered["waterfront"].astype(str).str.contains("Ja", case=False, na=False)
        if "water_tanken" in filtered.columns:
            mask = mask | filtered["water_tanken"].astype(str).str.contains("Ja", case=False, na=False)
        filtered = filtered[mask]
        actief.append("🌊 Water")

    if filters.get("sanitair") == "Ja" and "sanitair" in filtered.columns:
        filtered = filtered[filtered["sanitair"].astype(str).str.contains("Ja", case=False, na=False)]
        actief.append("🚿 Sanitair")

    if filters.get("wifi") == "Ja" and "wifi" in filtered.columns:
        filtered = filtered[filtered["wifi"].astype(str).str.contains("Ja", case=False, na=False)]
        actief.append("📶 Wifi")

    if not actief:
        actief.append("ℹ️ Geen specifieke filters herkend in de zoekvraag.")

    return filtered, actief
