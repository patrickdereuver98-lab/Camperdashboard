"""
ai_helper.py — Gemini Flash integratie voor natuurlijke taalfiltering en data-verrijking.
Uitgebreide filters: provincie, honden, prijs, stroom, waterfront.
"""
import json
import pandas as pd
import streamlit as st
from utils.logger import logger

try:
    import google.generativeai as genai
    API_KEY = st.secrets["GEMINI_API_KEY"]
    genai.configure(api_key=API_KEY)
    # Gebruik de versie die in jouw omgeving geconfigureerd is
    model = genai.GenerativeModel("gemini-1.5-flash") 
    logger.info("Gemini model geladen")
except KeyError:
    model = None
    logger.warning("GEMINI_API_KEY niet gevonden in st.secrets")
except Exception as e:
    model = None
    logger.error(f"Gemini laad-fout: {e}")


def get_gemini_response(prompt: str) -> str:
    """
    Algemene functie om tekstuele antwoorden van Gemini te krijgen.
    Wordt gebruikt door de enrichment-module.
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
    Vertaalt een natuurlijke taalvraag naar pandas-filters via Gemini.
    Retourneert (gefilterd_df, actieve_filter_labels).
    """
    if not user_query:
        return df, []
    if model is None:
        return df, ["⚠️ AI niet beschikbaar — voeg GEMINI_API_KEY toe aan .streamlit/secrets.toml"]

    prompt = f"""
Je bent een backend data-extractor voor een Nederlandse camperdashboard-app.
Analyseer de zoekopdracht en extraheer filters als strikte JSON.

Zoekopdracht: "{user_query}"

Retourneer UITSLUITEND geldige JSON zonder markdown, zonder uitleg.
Gebruik null als een filter niet expliciet gevraagd wordt.

{{
  "provincie": "<exacte Nederlandse provincienaam | null>",
  "honden_toegestaan": "<'Ja' of 'Nee' | null>",
  "is_gratis": "<true of false | null>",
  "stroom": "<'Ja' of 'Nee' | null>",
  "waterfront": "<'Ja' als water/strand/meer/rivier gevraagd | null>"
}}

Geldige provincies: Groningen, Friesland, Drenthe, Overijssel, Gelderland,
Utrecht, Noord-Holland, Zuid-Holland, Zeeland, Noord-Brabant, Limburg, Flevoland.
"""

    try:
        logger.info(f"AI query: '{user_query}'")
        response = model.generate_content(prompt)
        clean = response.text.replace("```json", "").replace("```", "").strip()
        filters = json.loads(clean)
        logger.info(f"AI filters ontvangen: {filters}")
    except json.JSONDecodeError:
        logger.warning(f"AI JSON parse fout. Response: {response.text[:300]}")
        return df, ["⚠️ Gemini gaf een onverwacht antwoord. Probeer de vraag anders te stellen."]
    except Exception as e:
        logger.error(f"Gemini API fout: {e}")
        return df, [f"⚠️ Communicatiefout: {e}"]

    filtered = df.copy()
    actief = []

    provincie = filters.get("provincie")
    if provincie:
        filtered = filtered[filtered["provincie"].str.contains(provincie, case=False, na=False)]
        actief.append(f"📍 Provincie: {provincie}")

    honden = filters.get("honden_toegestaan")
    if honden in ("Ja", "Nee"):
        filtered = filtered[filtered["honden_toegestaan"] == honden]
        actief.append(f"{'🐾' if honden == 'Ja' else '🚫'} Honden: {honden}")

    if filters.get("is_gratis") is True:
        filtered = filtered[filtered["prijs"].astype(str).str.lower() == "gratis"]
        actief.append("💰 Prijs: Gratis")

    stroom = filters.get("stroom")
    if stroom in ("Ja", "Nee"):
        filtered = filtered[filtered["stroom"] == stroom]
        actief.append(f"⚡ Stroom: {stroom}")

    if filters.get("waterfront") == "Ja":
        filtered = filtered[filtered["waterfront"] == "Ja"]
        actief.append("🌊 Aan het water")

    if not actief:
        actief.append("ℹ️ Geen specifieke filters herkend in de zoekvraag.")

    logger.info(f"AI resultaat: {len(filtered)}/{len(df)} locaties, filters: {actief}")
    return filtered, actief
