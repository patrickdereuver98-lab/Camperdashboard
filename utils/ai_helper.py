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
    
    # Gebruik Gemini 1.5 Flash met actieve Google Search motor.
    model = genai.GenerativeModel(
        model_name="gemini-1.5-flash",
        tools=[{"google_search_retrieval": {}}] 
    )
    logger.info("Gemini model met Google Search geladen")
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
        # We voegen een kleine instructie toe om grounding te forceren.
        full_prompt = f"{prompt}\n\nGebruik je zoek-tool om de meest actuele feiten te verifiëren."
        response = model.generate_content(full_prompt)
        return response.text
    except Exception as e:
        logger.error(f"Fout in get_gemini_response: {e}")
        return f"Fout: {str(e)}"


def process_ai_query(df: pd.DataFrame, user_query: str) -> tuple[pd.DataFrame, list[str]]:
    """
    Vertaalt zoekvragen naar filters. Nu gekoppeld aan de uitgebreide dataset.
    """
    if not user_query or df.empty:
        return df, []
    if model is None:
        return df, ["⚠️ AI niet beschikbaar — controleer API-key."]

    prompt = f"""
Analyseer de zoekopdracht voor een camper-app: "{user_query}"
Extraheer de filters als JSON. Gebruik null indien niet gevraagd.

{{
  "provincie": "naam",
  "honden": "Ja/Nee",
  "gratis": true/false,
  "stroom": "Ja/Nee",
  "water": "Ja/Nee",
  "sanitair": "Ja/Nee",
  "wifi": "Ja/Nee"
}}
"""

    try:
        response = model.generate_content(prompt)
        raw_text = response.text
        start = raw_text.find('{')
        end = raw_text.rfind('}') + 1
        filters = json.loads(raw_text[start:end])
    except Exception as e:
        logger.error(f"AI Filterfout: {e}")
        return df, ["⚠️ AI kon de filters niet bepalen."]

    filtered = df.copy()
    actief = []

    # ── FUZZY FILTERING (Ongevoelig voor hoofdletters/streepjes) ──
    
    # Provincie
    p = filters.get("provincie")
    if p and p != "null":
        filtered = filtered[filtered["provincie"].str.contains(p, case=False, na=False)]
        actief.append(f"📍 {p}")

    # Honden
    if filters.get("honden") in ("Ja", "Nee"):
        h = filters.get("honden")
        filtered = filtered[filtered["honden_toegestaan"].str.contains(h, case=False, na=False)]
        actief.append(f"🐾 Honden: {h}")

    # Gratis
    if filters.get("gratis") is True:
        filtered = filtered[filtered["prijs"].astype(str).str.lower().str.contains("gratis", na=False)]
        actief.append("💰 Gratis")

    # Stroom
    if filters.get("stroom") == "Ja":
        filtered = filtered[filtered["stroom"].str.contains("Ja", case=False, na=False)]
        actief.append("⚡ Stroom")

    # Water
    if filters.get("water") == "Ja":
        mask = filtered["waterfront"].str.contains("Ja", case=False, na=False)
        if "water_tanken" in filtered.columns:
            mask = mask | filtered["water_tanken"].str.contains("Ja", case=False, na=False)
        filtered = filtered[mask]
        actief.append("🌊 Water")

    # Sanitair & Wifi (Nieuwe koppeling met jouw 18 velden)
    for key in ["sanitair", "wifi"]:
        if filters.get(key) == "Ja" and key in filtered.columns:
            filtered = filtered[filtered[key].str.contains("Ja", case=False, na=False)]
            actief.append(f"{'🚿' if key=='sanitair' else '📶'} {key.capitalize()}")

    if not actief:
        actief.append("ℹ️ Geen filters herkend.")

    return filtered, actief
