"""
utils/ai_helper.py — VrijStaan v5.2 AI Engine (Gemini 2.5 Flash Only).

Wijzigingen t.o.v. v5.1:
  - Fallback-model keten VERWIJDERD. Werkt uitsluitend met gemini-2.5-flash.
  - Oude ongebruikte functies gestript voor een chirurgische, betrouwbare aanroep.
  - Nette foutmelding bij uitputting — geen crash, geen misleidende logs.
  - validate_gemini_key() ongewijzigd (pure REST GET, geen SDK).
  - Alle publieke functies (get_gemini_response, process_ai_query, etc.) intact.
"""
from __future__ import annotations

import json
import random
import time

import pandas as pd
import requests
import streamlit as st

try:
    from utils.logger import logger
except ImportError:
    import logging
    logger = logging.getLogger("vrijstaan.ai")

# ── CONSTANTEN ────────────────────────────────────────────────────────────────
_GEMINI_REST_BASE = "https://generativelanguage.googleapis.com/v1beta/models"

# Scrape-tekst drempel waaronder agentic fallback actief wordt
MIN_SCRAPE_CHARS = 250


# ── REST API KEY VALIDATIE (geen SDK init) ─────────────────────────────────────

def validate_gemini_key(api_key: str) -> tuple[bool, str]:
    """
    Valideert Gemini API-sleutel via een lichte REST GET op het models-endpoint.
    Gebruikt GEEN google-generativeai SDK — veilig als health-check.

    Returns:
        (is_valid: bool, status_message: str)
    """
    if not api_key or not api_key.strip():
        return False, "Geen API-key geconfigureerd."
    try:
        url  = f"{_GEMINI_REST_BASE}?key={api_key.strip()}"
        resp = requests.get(url, timeout=8)
        if resp.status_code == 200:
            return True, "Operationeel ✅"
        if resp.status_code == 400:
            return False, "Ongeldige API-key (400 Bad Request)"
        if resp.status_code == 403:
            return False, "Toegang geweigerd (403 Forbidden)"
        if resp.status_code == 429:
            return True, "Bereikbaar maar rate-limited (429) ⚠️"
        return False, f"HTTP {resp.status_code}"
    except requests.exceptions.Timeout:
        return False, "Timeout — API niet bereikbaar (>8s)"
    except requests.exceptions.ConnectionError:
        return False, "Verbinding mislukt — geen netwerk?"
    except Exception as e:
        return False, f"Fout: {str(e)[:80]}"


# ── HOOFD GENEREER FUNCTIE ─────────────────────────────────────────────────────

def _generate(prompt: str, use_grounding: bool = False) -> str:
    """
    Directe REST API call naar gemini-2.5-flash.
    Geen fallbacks, geen SDK-crashes. Snel en veilig.
    """
    api_key = st.secrets.get("GEMINI_API_KEY", "")
    if not api_key:
        return "⚠️ Geen API key gevonden."
        
    # Hardcoded naar jouw gewenste, stabiele model
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={api_key}"
    
    headers = {"Content-Type": "application/json"}
    payload = {
        "contents": [{"parts": [{"text": prompt}]}]
    }
    
    # Grounding toevoegen indien de scraper vastliep (Agentic Loop)
    if use_grounding:
        payload["tools"] = [{"googleSearch": {}}]
        
    resp = requests.post(url, headers=headers, json=payload, timeout=25)
    
    if resp.status_code != 200:
        raise ValueError(f"Gemini API Error {resp.status_code}: {resp.text}")
        
    try:
        data = resp.json()
        return data["candidates"][0]["content"]["parts"][0]["text"]
    except (KeyError, IndexError, json.JSONDecodeError):
        raise ValueError("⚠️ Kon het antwoord van Gemini 2.5 Flash niet verwerken.")


# ── JSON PARSER ────────────────────────────────────────────────────────────────

def parse_json_response(text: str) -> dict | list | None:
    """
    Robuust JSON parsen uit AI response.
    Tolereert markdown-fences (```json ... ```) en omringende tekst.
    """
    if not text or text.startswith("⚠️"):
        return None
    try:
        clean = text.strip()
        # Strip markdown code-fences
        if clean.startswith("```"):
            lines = clean.split("\n")
            clean = "\n".join(lines[1:] if lines[0].startswith("```") else lines)
        if clean.endswith("```"):
            clean = "\n".join(clean.split("\n")[:-1])
        clean = clean.strip()

        # Probeer JSON-object
        start = clean.find("{")
        end   = clean.rfind("}") + 1
        if start != -1 and end > 0:
            return json.loads(clean[start:end])

        # Probeer JSON-array
        start = clean.find("[")
        end   = clean.rfind("]") + 1
        if start != -1 and end > 0:
            return json.loads(clean[start:end])

        return None
    except (json.JSONDecodeError, Exception) as exc:
        logger.debug(f"JSON parse mislukt: {exc} | snippet: {text[:120]}")
        return None


# ── AGENTIC FALLBACK LOOP ──────────────────────────────────────────────────────

def run_agentic_fallback(
    naam: str,
    provincie: str,
    current_data: dict,
    scrape_text_len: int,
) -> dict | None:
    """
    Agentic Fallback: schakelt over naar Google Search Grounding wanneer:
      - De scraper < MIN_SCRAPE_CHARS tekens opleverde (site geblokkeerd), OF
      - De AI meer dan 4 velden op "Onbekend" heeft gezet.

    Returns: verbeterd dict of None bij parse-fout.
    """
    onbekende_velden = [
        k for k, v in current_data.items()
        if isinstance(v, str) and v.strip().lower() == "onbekend"
    ]
    logger.info(
        f"Agentic fallback: '{naam}' | scrape={scrape_text_len}c | "
        f"onbekend={len(onbekende_velden)} velden"
    )

    prompt = f"""
Je bent een expert data-analist voor VrijStaan (NL camperplatform).
De reguliere webscraper heeft onvoldoende data opgehaald voor '{naam}' in {provincie}.
Scrape-tekst: {scrape_text_len} tekens.

GEBRUIK GOOGLE ZOEKEN om ACTUELE informatie te vinden, gefocust op 2024 en 2025:
1. "{naam} camperplaats {provincie} 2024 2025 ervaringen reviews"
2. "{naam} camping {provincie} prijs faciliteiten actueel"
3. "{naam} {provincie} site:campercontact.com OR site:park4night.com"
4. "{naam} {provincie} motorhome parking google maps reviews 2024"
5. "{naam} {provincie} camperplaats telefoon prijs stroom"

Velden die ONTBREKEN of ONBEKEND zijn:
{', '.join(onbekende_velden) if onbekende_velden else '(zie huidige data)'}

Huidige (onvolledige) data:
{json.dumps(
    {k: v for k, v in current_data.items() if not k.startswith('_')},
    ensure_ascii=False, indent=2
)}

VERPLICHTE DEDUCTIE-REGELS — pas toe VOORDAT je "Onbekend" schrijft:
• "parking"/"parkeer" in naam → stroom=Nee, sanitair=Nee (tenzij bewijs)
• "jachthaven"/"marina" → water_tanken=Ja, afvalwater=Ja, sanitair=Ja
• "camping"/"vakantiepark" → sanitair=Ja, water_tanken=Ja
• Reviews: "muntjes douche" → sanitair=Ja
• "24u/7d"/"altijd open" → check_in_out="Vrij, geen vaste tijden"
• Stroom-aansluitingen beschreven → stroom=Ja
• Honden welkom in naam/beschrijving → honden_toegestaan=Ja
• Gebruik "Nee" bij logische afwezigheid; "Onbekend" alleen als echt niets te vinden

DRUKTE: <20 plekken = "Snel vol in het seizoen" | >50 plekken = "Vaak plek beschikbaar"

Retourneer UITSLUITEND een geldig JSON-object. Geen uitleg, geen markdown:
"""
    raw = _generate(prompt, use_grounding=True)
    return parse_json_response(raw)


# ── PUBLIEKE API ──────────────────────────────────────────────────────────────

def get_gemini_response(prompt: str) -> str:
    """Standaard aanroep zonder Search Grounding."""
    return _generate(prompt, use_grounding=False)


def get_gemini_response_grounded(prompt: str) -> str:
    """Aanroep met Google Search Grounding actief."""
    return _generate(prompt, use_grounding=True)


# ── AI FILTER EXTRACTIE VOOR ZOEKPAGINA ───────────────────────────────────────

@st.cache_data(ttl=600, show_spinner=False)
def _cached_ai_filter(
    query: str, df_hash: str
) -> tuple[dict, list[str]]:
    """Gecachede AI-filteraanroep (geen grounding — sneller voor UX)."""
    prompt = f"""
Je bent een backend data-extractor voor een Nederlandse camper-app.
Vertaal de zoekopdracht naar datafilters als strikte JSON.

Zoekopdracht: "{query}"

Antwoord UITSLUITEND met dit JSON-object (geen uitleg, geen markdown):
{{
  "provincie": "<provincienaam of null>",
  "honden_toegestaan": "<'Ja' of 'Nee' of null>",
  "is_gratis": <true of false of null>,
  "stroom": "<'Ja' of 'Nee' of null>",
  "water": "<'Ja' of null>",
  "sanitair": "<'Ja' of null>",
  "wifi": "<'Ja' of null>"
}}
"""
    try:
        raw    = _generate(prompt, use_grounding=False)
        parsed = parse_json_response(raw)
        if isinstance(parsed, dict):
            return parsed, []
        return {}, ["⚠️ AI kon de zoekvraag niet vertalen naar filters."]
    except Exception as exc:
        logger.error(f"AI filter extractie fout: {exc}")
        return {}, [f"⚠️ AI fout: {str(exc)[:80]}"]


def process_ai_query(
    df: pd.DataFrame,
    user_query: str,
) -> tuple[pd.DataFrame, list[str]]:
    """
    Vertaalt een vrije-tekst zoekopdracht naar DataFrame-filters.
    Gecached per query + data-hash voor snelheid.
    Alle originele filterstappen (provincie, honden, gratis, stroom,
    water, sanitair, wifi) volledig behouden.
    """
    if not user_query or df.empty:
        return df, []

    df_hash = f"{len(df)}-{'-'.join(sorted(df.columns.tolist()))}"
    filters, init_errors = _cached_ai_filter(user_query, df_hash)

    if init_errors and not filters:
        return df, init_errors

    filtered = df.copy()
    actief: list[str] = []

    # Provincie
    prov = filters.get("provincie")
    if prov and str(prov).lower() not in ("null", "none", ""):
        filtered = filtered[
            filtered["provincie"].astype(str).str.contains(
                str(prov), case=False, na=False
            )
        ]
        actief.append(f"📍 {prov}")

    # Honden
    honden = filters.get("honden_toegestaan")
    if honden in ("Ja", "Nee"):
        filtered = filtered[
            filtered["honden_toegestaan"].astype(str).str.contains(
                honden, case=False, na=False
            )
        ]
        actief.append(f"{'🐾' if honden == 'Ja' else '🚫'} Honden: {honden}")

    # Gratis
    if filters.get("is_gratis") is True:
        filtered = filtered[
            filtered["prijs"].astype(str).str.lower().str.contains(
                "gratis", na=False
            )
        ]
        actief.append("💰 Gratis")

    # Stroom
    stroom = filters.get("stroom")
    if stroom in ("Ja", "Nee"):
        filtered = filtered[
            filtered["stroom"].astype(str).str.contains(
                stroom, case=False, na=False
            )
        ]
        actief.append(f"⚡ Stroom: {stroom}")

    # Water
    if filters.get("water") == "Ja":
        mask = pd.Series(False, index=filtered.index)
        for col in ("waterfront", "water_tanken"):
            if col in filtered.columns:
                mask |= filtered[col].astype(str).str.contains(
                    "Ja", case=False, na=False
                )
        filtered = filtered[mask]
        actief.append("🌊 Water")

    # Sanitair
    if filters.get("sanitair") == "Ja" and "sanitair" in filtered.columns:
        filtered = filtered[
            filtered["sanitair"].astype(str).str.contains(
                "Ja", case=False, na=False
            )
        ]
        actief.append("🚿 Sanitair")

    # Wifi
    if filters.get("wifi") == "Ja" and "wifi" in filtered.columns:
        filtered = filtered[
            filtered["wifi"].astype(str).str.contains(
                "Ja", case=False, na=False
            )
        ]
        actief.append("📶 Wifi")

    if not actief:
        actief.append("ℹ️ Geen specifieke filters herkend — alle resultaten getoond.")

    return filtered, actief
