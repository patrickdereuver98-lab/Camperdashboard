"""
utils/ai_helper.py — Gemini Integratie v3 voor VrijStaan.

Verbeteringen t.o.v. v2:
  - get_gemini_response_grounded() als aparte publieke functie
    (enrichment.py roept dit nu direct aan)
  - Betere Search Grounding: dynamic_retrieval_config met lage drempel
    zodat de AI agressiever zoekt
  - Fallback-keten: grounding → zonder grounding → foutmelding
  - AI-query caching en lazy model-init blijven behouden
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
_MODEL_CACHE: dict = {}
_MODEL_NAME = "gemini-2.5-flash"


def _get_model():
    """Geeft gecachede Gemini-instantie. Lazy init bij eerste aanroep."""
    if "model" in _MODEL_CACHE:
        return _MODEL_CACHE["model"], _MODEL_CACHE.get("error")

    try:
        import google.generativeai as genai
        api_key = st.secrets["GEMINI_API_KEY"]
        genai.configure(api_key=api_key)
        model = genai.GenerativeModel(model_name=_MODEL_NAME)
        _MODEL_CACHE["model"] = model
        _MODEL_CACHE["error"] = None
        logger.info(f"Gemini '{_MODEL_NAME}' geladen.")
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


# ── INTERNE GENEREER-FUNCTIES ─────────────────────────────────────────────────

def _generate(prompt: str, use_grounding: bool = False) -> str:
    """
    Roept Gemini aan. Grounding via dynamic_retrieval_config met lage drempel
    zodat de AI actief zoekt ook bij gedeeltelijk bekende info.
    """
    model, err = _get_model()
    if model is None:
        return f"⚠️ AI niet beschikbaar: {err}"

    try:
        if use_grounding:
            try:
                import google.generativeai as genai

                # dynamic_retrieval_config: threshold laag (0.1) zodat AI
                # ALTIJD zoekt, ook als het denkt het al te weten.
                # Zonder dit zoekt Gemini alleen bij hoge onzekerheid.
                grounding_tool = genai.protos.Tool(
                    google_search_retrieval=genai.protos.GoogleSearchRetrieval(
                        dynamic_retrieval_config=genai.protos.DynamicRetrievalConfig(
                            mode=genai.protos.DynamicRetrievalConfig.Mode.MODE_DYNAMIC,
                            dynamic_threshold=0.1,  # Lage drempel = agressief zoeken
                        )
                    )
                )
                response = model.generate_content(
                    prompt,
                    tools=[grounding_tool],
                    generation_config={"temperature": 0.1},  # Laag = feitelijker
                )
                return response.text

            except AttributeError:
                # Oudere versie google-generativeai zonder DynamicRetrievalConfig
                try:
                    import google.generativeai as genai
                    grounding_tool = genai.protos.Tool(
                        google_search_retrieval=genai.protos.GoogleSearchRetrieval()
                    )
                    response = model.generate_content(prompt, tools=[grounding_tool])
                    return response.text
                except Exception:
                    # Fallback: zonder grounding
                    response = model.generate_content(
                        prompt,
                        generation_config={"temperature": 0.1},
                    )
                    return response.text

            except Exception:
                # Generieke fallback
                response = model.generate_content(
                    prompt,
                    generation_config={"temperature": 0.1},
                )
                return response.text

        else:
            response = model.generate_content(
                prompt,
                generation_config={"temperature": 0.1},
            )
            return response.text

    except Exception as e:
        logger.error(f"Gemini genereer-fout: {e}")
        return f"⚠️ Fout bij genereren: {str(e)}"


# ── PUBLIEKE API ──────────────────────────────────────────────────────────────

def get_gemini_response(prompt: str) -> str:
    """
    Algemene AI-aanroep met Search Grounding.
    Gebruikt door enrichment.py voor waterval-onderzoek.
    """
    return _generate(prompt, use_grounding=True)


def get_gemini_response_grounded(prompt: str) -> str:
    """
    Expliciete grounded variant — alias voor enrichment.py v3.
    Identiek aan get_gemini_response maar semantisch duidelijker.
    """
    return _generate(prompt, use_grounding=True)


def get_batch_enrichment_results(locations_data: list) -> list:
    """
    Camper-Politie batch verrijking.
    Max 5 locaties per batch.
    """
    if not locations_data:
        return []
    model, err = _get_model()
    if model is None:
        return []

    prompt = f"""
Je bent de 'Camper-Politie' data-extractor voor VrijStaan.
Onderzoek via Google Search de volgende locaties: {json.dumps(locations_data, ensure_ascii=False)}

EISEN:
1. Alleen camperplaatsen — hotels/appartementen zonder camperplek → ai_gecheckt: "Nee - Ongeschikt"
2. Zoek actief op Campercontact, Park4Night, eigen website, Google Maps
3. Telefoonnummer: altijd beginnen met 0, nooit +31
4. Prijs: actueel tarief per nacht
5. Gebruik "Nee" als faciliteit afwezig is, "Onbekend" ALLEEN als je het echt niet weet

Output UITSLUITEND geldig JSON-array (geen uitleg):
[
  {{
    "naam": "exacte naam",
    "telefoonnummer": "0... of Onbekend",
    "prijs": "€... of Gratis of Onbekend",
    "stroom": "Ja/Nee/Onbekend",
    "honden_toegestaan": "Ja/Nee/Onbekend",
    "sanitair": "Ja/Nee/Onbekend",
    "wifi": "Ja/Nee/Onbekend",
    "samenvatting_reviews": "Doorlopende zin 20-40 woorden Gasten-stijl of Onbekend",
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
    Gecachede AI-filteraanroep voor de zoekpagina.
    Geen grounding nodig voor filter-extractie (structurele taak).
    """
    model, err = _get_model()
    if model is None:
        return {}, [f"⚠️ AI niet beschikbaar: {err}"]

    prompt = f"""
Je bent een backend data-extractor voor een Nederlandse camper-app.
Vertaal de zoekopdracht naar filters als strikte JSON.

Zoekopdracht: "{query}"

Antwoord UITSLUITEND met dit JSON-object (geen uitleg, geen markdown):
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
    Gecached per query + data-hash.
    """
    if not user_query or df.empty:
        return df, []

    df_hash = str(len(df)) + str(sorted(df.columns.tolist()))
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
