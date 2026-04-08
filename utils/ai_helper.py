"""
utils/ai_helper.py — VrijStaan v5.1 Agentic AI Engine.

Verbeteringen t.o.v. v5.0:
  - Agentic Fallback Loop: als normale scrape < 250 tekens geeft of AI
    meer dan 4 velden op "Onbekend" zet, schakelt automatisch over naar
    Google Search Grounding gefocust op 2024/2025 bronnen.
  - Pure REST aanroepen — geen Google SDK, geen gRPC deadlocks.
  - REST-gebaseerde API-key validatie voor Beheer health-monitor.
  - Exponential Backoff + Jitter + model-fallback keten.
  - Gecachede filter-extractie voor de zoekpagina.
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
_FALLBACK_MODELS  = [
    "gemini-2.5-flash",
    "gemini-2.0-flash-exp",
    "gemini-1.5-flash",
]
_MAX_RETRIES_PER_MODEL = 3
# Scrape-tekst drempel waaronder agentic fallback actief wordt
MIN_SCRAPE_CHARS = 250


# ── REST API KEY VALIDATIE (geen SDK init) ────────────────────────────────────

def validate_gemini_key(api_key: str) -> tuple[bool, str]:
    """
    Valideert Gemini API-sleutel via lichte REST GET op het models-endpoint.
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
            # Key werkt, maar rate-limited
            return True, "Bereikbaar maar rate-limited (429) ⚠️"
        return False, f"HTTP {resp.status_code}"
    except requests.exceptions.Timeout:
        return False, "Timeout — API niet bereikbaar (>8s)"
    except requests.exceptions.ConnectionError:
        return False, "Verbinding mislukt — geen netwerk?"
    except Exception as e:
        return False, f"Fout: {str(e)[:80]}"


# ── PURE REST GENERATE AANROEP ────────────────────────────────────────────────

def _rest_generate(
    prompt: str,
    model: str,
    api_key: str,
    use_grounding: bool = False,
    temperature: float = 0.1,
) -> str:
    """
    HTTP POST naar Gemini REST generateContent endpoint.
    Bypast Google SDK volledig. Ondersteunt optioneel Google Search Grounding.
    """
    url  = f"{_GEMINI_REST_BASE}/{model}:generateContent?key={api_key}"
    body: dict = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {"temperature": temperature},
    }
    # Voeg Google Search Grounding toe voor de agentic fallback
    if use_grounding:
        body["tools"] = [{"google_search": {}}]

    resp = requests.post(
        url,
        headers={"Content-Type": "application/json"},
        json=body,
        timeout=45,
    )
    if resp.status_code == 429:
        raise RuntimeError("429 Rate limit geraakt")
    if resp.status_code in (500, 503):
        raise RuntimeError(f"{resp.status_code} Server unavailable")
    if resp.status_code != 200:
        raise RuntimeError(f"HTTP {resp.status_code}: {resp.text[:300]}")

    data = resp.json()
    try:
        return data["candidates"][0]["content"]["parts"][0]["text"]
    except (KeyError, IndexError) as e:
        raise ValueError(f"Onverwachte response structuur: {e} | {str(data)[:200]}")


# ── HOOFD GENEREER FUNCTIE ─────────────────────────────────────────────────────

def _generate(
    prompt: str,
    use_grounding: bool = False,
    temperature: float = 0.1,
) -> str:
    """
    Roept Gemini aan via REST met:
      - Exponential Backoff + Jitter per poging
      - Automatische model-fallback keten bij aanhoudende fouten
    """
    try:
        api_key = st.secrets["GEMINI_API_KEY"]
    except (KeyError, Exception):
        return "⚠️ GEMINI_API_KEY ontbreekt in secrets.toml"

    for model in _FALLBACK_MODELS:
        for attempt in range(_MAX_RETRIES_PER_MODEL):
            try:
                return _rest_generate(
                    prompt, model, api_key,
                    use_grounding=use_grounding,
                    temperature=temperature,
                )
            except RuntimeError as e:
                msg = str(e).lower()
                is_retryable = any(
                    k in msg for k in ("429", "500", "503", "unavailable", "rate limit")
                )
                if is_retryable and attempt < _MAX_RETRIES_PER_MODEL - 1:
                    wait = (2 ** attempt) * 3.0 + random.uniform(0.0, 2.0)
                    logger.warning(
                        f"[{model}] poging {attempt + 1}/{_MAX_RETRIES_PER_MODEL}: "
                        f"{e}. Wacht {wait:.1f}s…"
                    )
                    time.sleep(wait)
                else:
                    # Niet-herhaalbare fout of retries uitgeput → volgend model
                    logger.warning(f"[{model}] geeft op na {attempt + 1} poging(en): {e}")
                    break
            except Exception as e:
                logger.error(f"[{model}] onverwachte fout: {e}")
                break  # Probeer volgend model

    logger.error("Alle Gemini-modellen onbereikbaar.")
    return "⚠️ AI onbereikbaar na meerdere pogingen en model-fallbacks."


# ── JSON PARSER ───────────────────────────────────────────────────────────────

def parse_json_response(text: str) -> dict | list | None:
    """
    Robuust JSON parsen uit AI response.
    Tolereert markdown-fences (```json ... ```) en surrounding tekst.
    """
    if not text:
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
    except (json.JSONDecodeError, Exception) as e:
        logger.debug(f"JSON parse mislukt: {e} | snippet: {text[:120]}")
        return None


# ── AGENTIC FALLBACK LOOP ─────────────────────────────────────────────────────

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

    Stuurt een gerichte zoekopdracht naar Gemini met focus op 2024/2025.

    Returns:
        Verbeterd dict, of None bij parse-fout.
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
Scrape-tekst: {scrape_text_len} tekens (te weinig voor betrouwbare analyse).

GEBRUIK GOOGLE ZOEKEN om ACTUELE informatie te vinden, gefocust op 2024 en 2025:
1. "{naam} camperplaats {provincie} 2024 2025 ervaringen reviews"
2. "{naam} camping {provincie} prijs faciliteiten actueel"
3. "{naam} {provincie} site:campercontact.com OR site:park4night.com"
4. "{naam} {provincie} motorhome parking google maps reviews 2024"
5. "{naam} {provincie} camperplaats telefoon prijs stroom"

Velden die ONTBREKEN of ONBEKEND zijn:
{', '.join(onbekende_velden) if onbekende_velden else '(zie huidige data)'}

Huidige (onvolledige) data ter referentie:
{json.dumps(
    {k: v for k, v in current_data.items() if not k.startswith('_')},
    ensure_ascii=False, indent=2
)}

VERPLICHTE DEDUCTIE-REGELS — pas toe VOORDAT je "Onbekend" schrijft:
• "parking" / "parkeer" in naam → stroom=Nee, sanitair=Nee (tenzij bewijs)
• "jachthaven" / "marina" → water_tanken=Ja, afvalwater=Ja, sanitair=Ja
• "camping" / "vakantiepark" → sanitair=Ja, water_tanken=Ja
• Reviews met "muntjes", "douchemunten", "betalen voor douche" → sanitair=Ja
• "24u/7d", "altijd open" → check_in_out="Vrij, geen vaste tijden"
• Stroom-aansluitingen beschreven → stroom=Ja (ook zonder prijs vermeld)
• Honden expliciet welkom in naam of beschrijving → honden_toegestaan=Ja
• Gebruik "Nee" als logisch afgeleid kan worden dat iets afwezig is
• Gebruik "Onbekend" ALLEEN als intensief zoeken niets oplevert

DRUKTE DEDUCTIE (drukte_indicator):
• <20 plekken + geen reservering → "Snel vol in het seizoen"
• >50 plekken of altijd plek → "Vaak plek beschikbaar"
• Populair + veel reviews → "Druk in zomer, rustig buiten seizoen"

REMOTE WORK SCORE — zoek op Opensignal, KPN/T-Mobile coverage maps:
• Sterk 4G/5G signaal → "Goed (4G LTE)"
• Zwak signaal of platteland → "Matig (beperkte dekking)"

Retourneer UITSLUITEND een geldig JSON-object. Geen uitleg, geen markdown-fences:
"""
    raw = _generate(prompt, use_grounding=True, temperature=0.05)
    return parse_json_response(raw)


# ── PUBLIEKE API ──────────────────────────────────────────────────────────────

def get_gemini_response(prompt: str) -> str:
    """Standaard aanroep zonder grounding."""
    return _generate(prompt, use_grounding=False)


def get_gemini_response_grounded(prompt: str) -> str:
    """Aanroep MET Google Search Grounding."""
    return _generate(prompt, use_grounding=True)


# ── AI FILTER EXTRACTIE VOOR ZOEKPAGINA ──────────────────────────────────────

@st.cache_data(ttl=600, show_spinner=False)
def _cached_ai_filter(
    query: str, df_hash: str
) -> tuple[dict, list[str]]:
    """
    Gecachede AI-filteraanroep voor de zoekpagina (geen grounding nodig).
    """
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
        raw     = _generate(prompt, use_grounding=False)
        parsed  = parse_json_response(raw)
        if isinstance(parsed, dict):
            return parsed, []
        return {}, ["⚠️ AI kon de zoekvraag niet vertalen naar filters."]
    except Exception as e:
        logger.error(f"AI filter extractie fout: {e}")
        return {}, [f"⚠️ AI fout: {str(e)[:80]}"]


def process_ai_query(
    df: pd.DataFrame,
    user_query: str,
) -> tuple[pd.DataFrame, list[str]]:
    """
    Vertaalt een vrije-tekst zoekopdracht naar DataFrame-filters.
    Gecached per query + data-hash voor snelheid.
    """
    if not user_query or df.empty:
        return df, []

    df_hash  = f"{len(df)}-{'-'.join(sorted(df.columns.tolist()))}"
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
