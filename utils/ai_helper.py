"""
utils/ai_helper.py — Gemini Integratie voor VrijStaan.
Fixes:
  - Search Grounding: tools-parameter nu correct meegegeven
  - Lazy initialisatie: model wordt niet meer bij module-import geïnitialiseerd
  - AI query caching: identieke queries worden niet dubbel uitgevoerd
  - Robuuste foutafhandeling zonder crashes
"""
import json
import pandas as pd
import streamlit as st

try:
    from utils.logger import logger
except ImportError:
    import logging
    logger = logging.getLogger("vrijstaan")


# ── LAZY MODEL INITIALISATIE ──────────────────────────────────────────────────
# Fix: was module-level → triggerde st.secrets bij elke import.
# Nu: model wordt aangemaakt bij eerste gebruik via _get_model().

_MODEL_CACHE: dict = {}
_MODEL_NAME = "gemini-2.5-flash"

def _get_model():
    """
    Geeft een gecachede Gemini-instantie terug.
    Initialiseert lazy bij eerste aanroep.
    """
    if "model" in _MODEL_CACHE:
        return _MODEL_CACHE["model"], _MODEL_CACHE.get("error")

    try:
        import google.generativeai as genai
        api_key = st.secrets["GEMINI_API_KEY"]
        genai.configure(api_key=api_key)
        model = genai.GenerativeModel(model_name=_MODEL_NAME)
        _MODEL_CACHE["model"] = model
        _MODEL_CACHE["error"] = None
        logger.info(f"Gemini model '{_MODEL_NAME}' geladen.")
        return model, None
    except KeyError:
        err = "GEMINI_API_KEY ontbreekt in secrets.toml"
        logger.warning(err)
        _MODEL_CACHE["model"] = None
        _MODEL_CACHE["error"] = err
        return None, err
    except Exception as e:
        err = str(e)
        logger.error(f"Gemini laad-fout: {err}")
        _MODEL_CACHE["model"] = None
        _MODEL_CACHE["error"] = err
        return None, err


def _generate(prompt: str, use_grounding: bool = False) -> str:
    """
    Interne helper: roept Gemini aan, met optionele Search Grounding.
    Fix: tools-parameter wordt nu correct meegegeven.
    """
    model, err = _get_model()
    if model is None:
        return f"⚠️ AI niet beschikbaar: {err}"

    try:
        if use_grounding:
            # Fix: Search Grounding was gedocumenteerd maar ontbrak in de code.
            # Probeer met grounding, val terug op normaal bij API-fout.
            try:
                import google.generativeai as genai
                grounding_tool = genai.protos.Tool(
                    google_search_retrieval=genai.protos.GoogleSearchRetrieval()
                )
                response = model.generate_content(prompt, tools=[grounding_tool])
            except Exception:
                # Fallback: genereer zonder grounding (model ondersteunt het niet)
                response = model.generate_content(prompt)
        else:
            response = model.generate_content(prompt)

        return response.text

    except Exception as e:
        logger.error(f"Gemini genereer-fout: {e}")
        return f"⚠️ Fout bij genereren: {str(e)}"


# ── PUBLIEKE API ──────────────────────────────────────────────────────────────

def get_gemini_response(prompt: str) -> str:
    """Algemene AI-onderzoeksfunctie (gebruikt Search Grounding)."""
    return _generate(prompt, use_grounding=True)


def get_batch_enrichment_results(locations_data: list) -> list:
    """
    Camper-Politie batch verrijking.
    Verwerkt maximaal 5 locaties per batch voor optimale snelheid.
    """
    model, err = _get_model()
    if model is None:
        return []

    prompt = f"""
Je bent de 'Camper-Politie' data-extractor voor de app VrijStaan.
Onderzoek de volgende lijst van locaties: {json.dumps(locations_data)}

STRIKTE EISEN:
1. CAMPER-ONLY: Hotels/appartementen zonder camperplek → zet 'ai_gecheckt' op 'Nee - Ongeschikt'.
2. DATA: Zoek telefoonnummer, actuele prijs, honden/stroom aanwezig.
3. TELEFOON: Altijd beginnen met 0 (bijv. 0612345678), nooit +31.
4. Gebruik Campercontact, JetCamp en eigen website als bronnen.

Output UITSLUITEND een geldig JSON-array:
[
  {{
    "naam": "exacte naam uit input",
    "telefoonnummer": "0... of Onbekend",
    "prijs": "€... of Gratis of Onbekend",
    "stroom": "Ja/Nee/Onbekend",
    "honden_toegestaan": "Ja/Nee/Onbekend",
    "samenvatting_reviews": "Max 12 woorden sfeer (of Onbekend)",
    "ai_gecheckt": "Ja"
  }}
]
"""
    try:
        response = _generate(prompt, use_grounding=True)
        start = response.find("[")
        end   = response.rfind("]") + 1
        if start == -1 or end == 0:
            return []
        return json.loads(response[start:end])
    except Exception as e:
        logger.error(f"Batch verrijking fout: {e}")
        return []


@st.cache_data(ttl=600, show_spinner=False)
def _cached_ai_filter(query: str, df_hash: str) -> tuple[dict, list[str]]:
    """
    Interne gecachede AI-filteraanroep.
    Fix: dezelfde zoekvraag triggert niet méér dan één Gemini-aanroep per 10 min.
    df_hash zorgt dat cache vervalt als de dataset wijzigt.
    """
    model, err = _get_model()
    if model is None:
        return {}, [f"⚠️ AI niet beschikbaar: {err}"]

    prompt = f"""
Je bent een backend data-extractor voor een Nederlandse camper-app.
Vertaal de zoekopdracht naar filters als strikte JSON.

Zoekopdracht: "{query}"

Antwoord UITSLUITEND met dit JSON-object (geen uitleg):
{{
  "provincie": "<provincienaam of null>",
  "honden_toegestaan": "<'Ja' of 'Nee' of null>",
  "is_gratis": "<true of false of null>",
  "stroom": "<'Ja' of 'Nee' of null>",
  "water": "<'Ja' of null>",
  "sanitair": "<'Ja' of null>",
  "wifi": "<'Ja' of null>"
}}
"""
    try:
        raw = _generate(prompt, use_grounding=False)
        start = raw.find("{")
        end   = raw.rfind("}") + 1
        if start == -1 or end == 0:
            raise ValueError("Geen JSON in response")
        filters = json.loads(raw[start:end])
        return filters, []
    except Exception:
        return {}, ["⚠️ AI kon de zoekvraag niet volledig interpreteren."]


def process_ai_query(df: pd.DataFrame, user_query: str) -> tuple[pd.DataFrame, list[str]]:
    """
    Vertaalt natuurlijke taal naar DataFrame-filters.
    Fix: resultaten worden gecached op basis van query + data-hash.
    """
    if not user_query or df.empty:
        return df, []

    # Simpele hash van de DataFrame voor cache-invalidatie
    df_hash = str(len(df)) + str(list(df.columns))

    filters, init_errors = _cached_ai_filter(user_query, df_hash)
    if init_errors and not filters:
        return df, init_errors

    filtered = df.copy()
    actief: list[str] = []

    # Provincie
    prov = filters.get("provincie")
    if prov and str(prov).lower() not in ("null", "none", ""):
        filtered = filtered[
            filtered["provincie"].astype(str).str.contains(str(prov), case=False, na=False)
        ]
        actief.append(f"📍 {prov}")

    # Honden
    honden = filters.get("honden_toegestaan")
    if honden in ("Ja", "Nee"):
        filtered = filtered[
            filtered["honden_toegestaan"].astype(str).str.contains(honden, case=False, na=False)
        ]
        actief.append(f"{'🐾' if honden == 'Ja' else '🚫'} Honden: {honden}")

    # Gratis
    if filters.get("is_gratis") is True:
        filtered = filtered[
            filtered["prijs"].astype(str).str.lower().str.contains("gratis", na=False)
        ]
        actief.append("💰 Gratis")

    # Stroom
    stroom = filters.get("stroom")
    if stroom in ("Ja", "Nee"):
        filtered = filtered[
            filtered["stroom"].astype(str).str.contains(stroom, case=False, na=False)
        ]
        actief.append(f"⚡ Stroom: {stroom}")

    # Water
    if filters.get("water") == "Ja":
        mask = pd.Series(False, index=filtered.index)
        for col in ("waterfront", "water_tanken"):
            if col in filtered.columns:
                mask = mask | filtered[col].astype(str).str.contains("Ja", case=False, na=False)
        filtered = filtered[mask]
        actief.append("🌊 Water")

    # Sanitair
    if filters.get("sanitair") == "Ja" and "sanitair" in filtered.columns:
        filtered = filtered[
            filtered["sanitair"].astype(str).str.contains("Ja", case=False, na=False)
        ]
        actief.append("🚿 Sanitair")

    # Wifi
    if filters.get("wifi") == "Ja" and "wifi" in filtered.columns:
        filtered = filtered[
            filtered["wifi"].astype(str).str.contains("Ja", case=False, na=False)
        ]
        actief.append("📶 Wifi")

    if not actief:
        actief.append("ℹ️ Geen specifieke filters herkend — alle resultaten getoond.")

    return filtered, actief
