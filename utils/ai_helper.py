"""
utils/ai_helper.py — Search-First AI Motor voor VrijStaan.
Architectuur: Gemini 1.5 Flash + Google Search Grounding + Fuzzy Province Matching.
"""
import json
import re
import pandas as pd
import streamlit as st

try:
    import google.generativeai as genai
except ImportError:
    genai = None

# ── PROVINCIE FUZZY MAP ───────────────────────────────────────────────────────
# Vangt spelfouten, afkortingen en dialectvarianten op zodat we NOOIT 0 resultaten geven.
PROVINCIE_ALIASES = {
    # Drenthe
    "drente": "Drenthe", "drenthe": "Drenthe",
    # Friesland
    "friesland": "Friesland", "fryslan": "Friesland", "fryslân": "Friesland", "frisia": "Friesland",
    # Gelderland
    "gelderland": "Gelderland", "gelre": "Gelderland",
    # Groningen
    "groningen": "Groningen", "stad": "Groningen",
    # Limburg
    "limburg": "Limburg",
    # Noord-brabant
    "noord-brabant": "Noord-Brabant", "brabant": "Noord-Brabant", "n-brabant": "Noord-Brabant",
    # Noord-holland
    "noord-holland": "Noord-Holland", "n-holland": "Noord-Holland", "noord holland": "Noord-Holland",
    # Overijssel
    "overijssel": "Overijssel",
    # Utrecht
    "utrecht": "Utrecht",
    # Zeeland
    "zeeland": "Zeeland",
    # Zuid-holland
    "zuid-holland": "Zuid-Holland", "z-holland": "Zuid-Holland", "zuid holland": "Zuid-Holland",
    # Flevoland
    "flevoland": "Flevoland",
}

# ── MODEL INIT ────────────────────────────────────────────────────────────────
model = None
model_no_tools = None  # Backup model zonder tools voor filterlogica

def _init_model():
    """Lazy-init: bouw het model pas als het echt nodig is."""
    global model, model_no_tools
    if model is not None:
        return

    if genai is None:
        st.warning("google-generativeai package niet geïnstalleerd.")
        return

    try:
        api_key = st.secrets.get("GEMINI_API_KEY", "")
        if not api_key:
            raise KeyError("GEMINI_API_KEY leeg of afwezig in st.secrets")

        genai.configure(api_key=api_key)

        # Model MET Google Search grounding — voor live data ophalen
        model = genai.GenerativeModel(
            model_name="gemini-1.5-flash",
            tools=[{"google_search_retrieval": {}}],
        )

        # Model ZONDER tools — voor filter-parsing (grounding geeft hier errors)
        model_no_tools = genai.GenerativeModel(
            model_name="gemini-1.5-flash",
        )

    except KeyError as e:
        st.warning(f"⚠️ Gemini API-key ontbreekt: {e}")
    except Exception as e:
        st.error(f"❌ Gemini init-fout: {e}")


# ── HULPFUNCTIES ──────────────────────────────────────────────────────────────

def _extract_json(text: str) -> dict | None:
    """
    Robuuste JSON-extractor: pakt het eerste geldige JSON-object uit een tekst,
    ook als Gemini er markdown-fences of extra uitleg omheen gooit.
    """
    # Stap 1: Verwijder markdown code-blokken
    text = re.sub(r"```(?:json)?", "", text).strip()

    # Stap 2: Zoek het eerste { ... } blok
    start = text.find("{")
    if start == -1:
        return None

    depth = 0
    for i, ch in enumerate(text[start:], start=start):
        if ch == "{":
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0:
                json_str = text[start : i + 1]
                try:
                    return json.loads(json_str)
                except json.JSONDecodeError:
                    # Probeer kleine reparaties: trailing comma's
                    cleaned = re.sub(r",\s*([}\]])", r"\1", json_str)
                    try:
                        return json.loads(cleaned)
                    except Exception:
                        return None
    return None


def _fuzzy_provincie(raw: str) -> str | None:
    """Vertaalt een ruwe invoer naar een geldige provincienaam, of None."""
    if not raw or raw.lower() in ("null", "none", ""):
        return None
    key = raw.lower().strip().replace("  ", " ")
    # Directe hit
    if key in PROVINCIE_ALIASES:
        return PROVINCIE_ALIASES[key]
    # Gedeeltelijke hit (bijv. "drenth")
    for alias, official in PROVINCIE_ALIASES.items():
        if alias.startswith(key[:4]) or key in alias:
            return official
    return raw.title()  # Fallback: probeer het als eigennaam


# ── PUBLIEKE API ──────────────────────────────────────────────────────────────

def get_gemini_response(prompt: str) -> str:
    """
    Stuurt een prompt naar Gemini MET Google Search grounding.
    Gebruikt voor live data-ophaling in enrichment.py.
    """
    _init_model()
    if model is None:
        return "FOUT: AI-model niet geconfigureerd. Controleer GEMINI_API_KEY."

    try:
        response = model.generate_content(prompt)
        # Concateneer alle tekst-blokken (grounding kan meerdere blokken geven)
        parts = [p.text for p in response.candidates[0].content.parts if hasattr(p, "text")]
        return "\n".join(parts).strip()
    except Exception as e:
        return f"FOUT bij Gemini aanroep: {e}"


def process_ai_query(df: pd.DataFrame, user_query: str) -> tuple[pd.DataFrame, list[str]]:
    """
    Vertaalt een vrije zoekvraag naar DataFrame-filters via Gemini.
    
    Strategie:
    1. Gemini (ZONDER search-tools) parseert de intentie naar JSON-filters.
    2. Fuzzy matching zorgt dat typefouten de gebruiker nooit stranden.
    3. Elke actieve filter wordt bijgehouden voor UI-feedback.
    """
    if not user_query or df.empty:
        return df, []

    _init_model()
    if model_no_tools is None:
        # Graceful degradation: geef alle data terug
        return df, ["⚠️ AI niet beschikbaar — resultaten ongefilterd."]

    # Beschikbare kolommen meegeven zodat AI weet wat er is
    available_cols = df.columns.tolist()

    parse_prompt = f"""
Je bent een filter-parser voor een Nederlandse camperplaatsen-app.
De gebruiker zoekt: "{user_query}"

Beschikbare databasevelden: {available_cols}

Extraheer de zoekintentie als een geldig JSON-object.
Gebruik null voor velden die NIET gevraagd worden.
Gebruik uitsluitend de exacte waarden "Ja", "Nee" of null — nooit andere strings.

Geef ALLEEN het JSON-object terug, zonder uitleg of extra tekst:

{{
  "provincie": "officiële Nederlandse provincienaam of null",
  "gratis": true,
  "honden": "Ja/Nee/null",
  "stroom": "Ja/Nee/null",
  "water": "Ja/Nee/null",
  "sanitair": "Ja/Nee/null",
  "wifi": "Ja/Nee/null",
  "waterfront": "Ja/Nee/null",
  "rust": "Rustig/Druk/null",
  "toegankelijkheid": "Ja/Nee/null"
}}
"""

    try:
        raw_response = model_no_tools.generate_content(parse_prompt)
        raw_text = raw_response.text
    except Exception as e:
        return df, [f"⚠️ AI-fout bij filteren: {e}"]

    filters = _extract_json(raw_text)
    if not filters:
        return df, ["⚠️ AI kon de zoekvraag niet vertalen. Toon alle resultaten."]

    filtered = df.copy()
    actief: list[str] = []

    # ── PROVINCIE (Fuzzy) ──────────────────────────────────────────────────────
    raw_prov = filters.get("provincie")
    if raw_prov and str(raw_prov).lower() not in ("null", "none"):
        prov_clean = _fuzzy_provincie(str(raw_prov))
        if prov_clean:
            mask = filtered["provincie"].str.contains(prov_clean, case=False, na=False)
            if mask.sum() > 0:
                filtered = filtered[mask]
                actief.append(f"📍 {prov_clean}")
            # Als geen resultaten: filter NIET toepassen (betere UX dan lege lijst)

    # ── GRATIS ────────────────────────────────────────────────────────────────
    if filters.get("gratis") is True:
        mask = filtered["prijs"].astype(str).str.lower().str.contains("gratis", na=False)
        filtered = filtered[mask]
        actief.append("💰 Gratis")

    # ── JA/NEE VELD HELPERS ───────────────────────────────────────────────────
    bool_map = {
        "honden":         ("honden_toegestaan", "🐾 Honden welkom"),
        "stroom":         ("stroom",             "⚡ Stroom"),
        "water":          ("water_tanken",       "🚰 Water tanken"),
        "sanitair":       ("sanitair",           "🚿 Sanitair"),
        "wifi":           ("wifi",               "📶 WiFi"),
        "waterfront":     ("waterfront",         "🌊 Waterfront"),
        "toegankelijkheid":("toegankelijkheid",  "♿ Toegankelijk"),
    }

    for filter_key, (col, label) in bool_map.items():
        val = filters.get(filter_key)
        if val in ("Ja", "Nee") and col in filtered.columns:
            mask = filtered[col].str.contains(val, case=False, na=False)
            filtered = filtered[mask]
            actief.append(label if val == "Ja" else f"{label}: Nee")

    # ── RUST ──────────────────────────────────────────────────────────────────
    rust_val = filters.get("rust")
    if rust_val and rust_val not in (None, "null") and "rust" in filtered.columns:
        mask = filtered["rust"].str.contains(rust_val, case=False, na=False)
        filtered = filtered[mask]
        actief.append(f"🤫 {rust_val}")

    if not actief:
        actief.append("ℹ️ Geen specifieke filters herkend — alle resultaten.")

    return filtered, actief
