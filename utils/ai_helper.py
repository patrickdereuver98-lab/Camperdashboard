"""
utils/ai_helper.py — Gemini Integratie met X-Ray foutopsporing en Search Grounding.
"""
import json
import pandas as pd
import streamlit as st
from utils.logger import logger

model = None
init_error = "Onbekende fout"

try:
    import google.generativeai as genai
    API_KEY = st.secrets["GEMINI_API_KEY"]
    genai.configure(api_key=API_KEY)
    
    # ── KIES HIER JE MODEL ──
    gekozen_model = "gemini-2.5-flash"
    
    # CRUCIALE FIX: De API eist nu "google_search"
    model = genai.GenerativeModel(
        model_name=gekozen_model,
        tools="google_search" 

    )
    logger.info(f"{gekozen_model} met Search Grounding geladen")

except KeyError:
    init_error = "GEMINI_API_KEY mist in je secrets.toml"
    logger.warning(init_error)
except Exception as e:
    init_error = str(e)
    logger.error(f"Gemini laad-fout: {init_error}")


def get_gemini_response(prompt: str) -> str:
    """Algemene functie voor AI-onderzoek."""
    if model is None:
        # Dit laat in jouw groene vlak op het scherm direct zien WAAROM hij faalt
        return f"Fout tijdens opstarten: {init_error}"
    
    try:
        full_prompt = f"{prompt}\n\nBelangrijk: Gebruik de Google Search tool om actuele feiten te verifiëren."
        response = model.generate_content(full_prompt)
        return response.text
    except Exception as e:
        return f"Fout tijdens genereren: {str(e)}"


def process_ai_query(df: pd.DataFrame, user_query: str) -> tuple[pd.DataFrame, list[str]]:
    """Vertaalt natuurlijke taal naar database-filters."""
    if not user_query or df.empty:
        return df, []
    if model is None:
        return df, [f"⚠️ AI niet beschikbaar: {init_error}"]

    prompt = f"""
Je bent een backend data-extractor voor een camper-app.
Vertaal de zoekopdracht naar filters als strikte JSON.

Zoekopdracht: "{user_query}"

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
        response = model.generate_content(prompt)
        raw_text = response.text
        start = raw_text.find('{')
        end = raw_text.rfind('}') + 1
        
        if start == -1 or end == 0:
            raise ValueError("Geen JSON gevonden in AI response.")
            
        filters = json.loads(raw_text[start:end])
    except Exception as e:
        return df, ["⚠️ De AI begreep de zoekvraag niet volledig."]

    filtered = df.copy()
    actief = []

    # Filters toepassen
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
