"""
ai_helper.py — Geoptimaliseerde Gemini Flash integratie voor VrijStaan.
Fix: Fuzzy string matching voor filters en robuuste JSON extractie.
"""
import json
import pandas as pd
import streamlit as st
from utils.logger import logger

try:
    import google.generativeai as genai
    API_KEY = st.secrets["GEMINI_API_KEY"]
    genai.configure(api_key=API_KEY)
    # Gemini 1.5 of 2.0 Flash zijn de 'sweet spot' voor snelheid en JSON-extractie.
    model = genai.GenerativeModel(
    model_name="gemini-1.5-flash",
    tools=[{"google_search_retrieval": {}}] # Dit zet de Google-motor aan!
)
    logger.info("Gemini model geladen")
except KeyError:
    model = None
    logger.warning("GEMINI_API_KEY niet gevonden in st.secrets")
except Exception as e:
    model = None
    logger.error(f"Gemini laad-fout: {e}")


def get_gemini_response(prompt: str) -> str:
    """
    Algemene functie voor AI-tekstrespons. Gebruikt door de verrijkings-module.
    """
    if model is None:
        return "Fout: AI model niet geconfigureerd."
    
    try:
        response = model.generate_content(prompt)
        return response.text
    except Exception as e:
        logger.error(f"Fout in get_gemini_response: {e}")
        return f"Fout: {str(e)}"


def process_ai_query(df: pd.DataFrame, user_query: str) -> tuple[pd.DataFrame, list[str]]:
    """
    Vertaalt natuurlijke taal naar DataFrame filters via Gemini Flash.
    Gebruikt fuzzy matching om 0-resultaat fouten te voorkomen.
    """
    if not user_query or df.empty:
        return df, []
    if model is None:
        return df, ["⚠️ AI niet beschikbaar — controleer API-key."]

    prompt = f"""
Je bent een data-extractor voor een Nederlandse camper-app. 
Vertaal de zoekopdracht naar een strikt JSON-object.

Zoekopdracht: "{user_query}"

{{
  "provincie": "<provincienaam | null>",
  "honden_toegestaan": "<'Ja' of 'Nee' | null>",
  "is_gratis": "<true of false | null>",
  "stroom": "<'Ja' of 'Nee' | null>",
  "water": "<'Ja' | null>"
}}

Retourneer UITSLUITEND de JSON. Gebruik null als een filter niet expliciet gevraagd wordt.
"""

    try:
        logger.info(f"AI query: '{user_query}'")
        response = model.generate_content(prompt)
        
        # Robuuste JSON extractie: zoek naar de accolades om markdown-tekst te negeren.
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

    # ── FUZZY FILTER LOGICA ──
    # We gebruiken .str.contains(..., case=False) om matches te vinden ongeacht hoofdletters.

    # 1. Provincie
    prov = filters.get("provincie")
    if prov and prov != "null":
        filtered = filtered[filtered["provincie"].str.contains(prov, case=False, na=False)]
        actief.append(f"📍 Provincie: {prov}")

    # 2. Honden
    honden = filters.get("honden_toegestaan")
    if honden in ("Ja", "Nee"):
        filtered = filtered[filtered["honden_toegestaan"].str.contains(honden, case=False, na=False)]
        actief.append(f"{'🐾' if honden == 'Ja' else '🚫'} Honden: {honden}")

    # 3. Gratis
    if filters.get("is_gratis") is True:
        # Zoekt naar 'gratis' in de prijskolom.
        filtered = filtered[filtered["prijs"].astype(str).str.lower().str.contains("gratis", na=False)]
        actief.append("💰 Prijs: Gratis")

    # 4. Stroom
    stroom = filters.get("stroom")
    if stroom in ("Ja", "Nee"):
        filtered = filtered[filtered["stroom"].str.contains(stroom, case=False, na=False)]
        actief.append(f"⚡ Stroom: {stroom}")

    # 5. Water
    if filters.get("water") == "Ja":
        # Checkt zowel waterfront als de nieuwe water_tanken kolom indien aanwezig.
        mask = filtered["waterfront"].str.contains("Ja", case=False, na=False)
        if "water_tanken" in filtered.columns:
            mask = mask | filtered["water_tanken"].str.contains("Ja", case=False, na=False)
        filtered = filtered[mask]
        actief.append("🌊 Water")

    if not actief:
        actief.append("ℹ️ Geen specifieke filters herkend.")

    return filtered, actief
