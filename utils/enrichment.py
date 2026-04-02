"""
utils/enrichment.py — AI-onderzoeker met Waterval Methode.
Fixes:
  - Kritieke JSON-bug: "telefoonummer" (geen waarde) → "telefoonnummer": "..."
  - SSRF: URL-validatie toegevoegd aan scrape_website()
  - UI ontkoppeld: st.* aanroepen zijn nu optioneel (verbose-flag)
  - Robuuste foutafhandeling zonder onverwachte crashes
"""
import json
import re
from urllib.parse import urlparse

import requests
from bs4 import BeautifulSoup
import pandas as pd

from utils.ai_helper import get_gemini_response


# ── WEBSITE SCRAPER ───────────────────────────────────────────────────────────

def scrape_website(url: str) -> str:
    """
    Haalt de ruwe tekst van een website op.
    Fix: SSRF-bescherming via scheme-validatie.
    """
    if not url or pd.isna(url) or str(url).strip().lower() in ("nan", "onbekend", "none", ""):
        return "Geen website opgegeven."

    url = str(url).strip()
    if not url.startswith(("http://", "https://")):
        url = "https://" + url

    # SSRF-guard: alleen http/https toegestaan
    parsed = urlparse(url)
    if parsed.scheme not in ("http", "https") or not parsed.netloc:
        return "Fout: Ongeldige URL — alleen http(s) toegestaan."

    headers = {
        "User-Agent": (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/120.0.0.0 Safari/537.36"
        ),
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "nl-NL,nl;q=0.9,en-US;q=0.8",
    }

    try:
        response = requests.get(url, headers=headers, timeout=12)
        response.raise_for_status()

        soup = BeautifulSoup(response.text, "html.parser")
        for tag in soup(["script", "style", "nav", "footer", "header", "aside", "noscript"]):
            tag.extract()

        tekst = " ".join(soup.get_text(separator=" ", strip=True).split())
        return tekst[:15_000] + " ... [afgekapt]" if len(tekst) > 15_000 else tekst

    except requests.exceptions.Timeout:
        return "Fout: Website reageerde niet binnen 12 seconden."
    except requests.exceptions.RequestException as e:
        return f"Fout: Kan website niet bereiken ({e})."
    except Exception as e:
        return f"Scrapen mislukt: {e}"


# ── LOCATIE ONDERZOEK ─────────────────────────────────────────────────────────

def research_location(row, verbose: bool = True) -> dict | None:
    """
    Onderzoekt één locatierij via Waterval Methode:
      Bron 1: Live website-tekst
      Bron 2: AI-kennisbase
      Bron 3: Logische deductie

    Args:
        row:     Pandas Series met locatiedata.
        verbose: Als True, worden Streamlit UI-elementen getoond (alleen in Beheer).

    Returns:
        Dict met ingevulde velden, of None bij een fatale fout.

    Fix: st.* aanroepen zijn nu optioneel achter verbose-flag.
    Fix: JSON-template bevat nu correcte sleutel 'telefoonnummer' met waarde.
    """
    naam    = str(row.get("naam",     "Onbekende locatie"))
    provincie = str(row.get("provincie", "Nederland"))
    website = str(row.get("website",  ""))

    # ── Bron 1: Website scrapen ──
    if verbose:
        _ui_write(f"🌐 Website ophalen: {website or '(geen)'}")

    website_content = scrape_website(website)

    if verbose and (website_content.startswith("Fout:") or website_content.startswith("Geen")):
        _ui_warn(website_content)

    # ── Waterval prompt ──
    prompt = f"""
Je bent een Senior Data Analist voor de Nederlandse camper-app VrijStaan.
Onderwerp: Camperplaats '{naam}' in provincie '{provincie}'.

Waterval Methode — combineer in deze volgorde:

BRON 1 (hoogste prioriteit — actuele websitetekst):
---
{website_content}
---

BRON 2 (als BRON 1 onvolledig is — jouw AI-kennisbase):
Raadpleeg interne kennis van Campercontact, Park4Night, NKC, Google Reviews.

BRON 3 (logische deductie):
Gratis parkeerplaats zonder voorzieningen → wifi/sanitair/stroom = 'Nee'.

Vul alle 19 velden in. Gebruik EXACT "Onbekend" als je het écht niet weet.

Retourneer UITSLUITEND geldig JSON (geen uitleg, geen markdown):
{{
    "prijs": "Prijs per nacht, of 'Gratis', of 'Onbekend'",
    "honden_toegestaan": "Ja/Nee/Onbekend",
    "stroom": "Ja/Nee/Onbekend",
    "stroom_prijs": "Kosten of 'Inbegrepen' of 'Onbekend'",
    "afvalwater": "Ja/Nee/Onbekend",
    "chemisch_toilet": "Ja/Nee/Onbekend",
    "water_tanken": "Ja/Nee/Onbekend",
    "aantal_plekken": "Getal of 'Onbekend'",
    "check_in_out": "Tijden of 'Vrij' of 'Onbekend'",
    "website": "{website}",
    "beschrijving": "Max 20 woorden sfeeromschrijving",
    "ondergrond": "Gras/Asfalt/Grind/Verhard/Onbekend",
    "toegankelijkheid": "Ja/Nee/Onbekend",
    "rust": "Rustig/Gemiddeld/Druk/Onbekend",
    "sanitair": "Ja/Nee/Onbekend",
    "wifi": "Ja/Nee/Onbekend",
    "beoordeling": "Score bijv. 4.2 of 'Onbekend'",
    "samenvatting_reviews": "Max 15 woorden of 'Onbekend'",
    "telefoonnummer": "0... of 'Onbekend'",
    "extra": []
}}
"""

    response_text = get_gemini_response(prompt)

    if verbose:
        _ui_expander(f"⚙️ Ruwe AI output — {naam}", response_text)

    # ── JSON parsen ──
    try:
        start = response_text.find("{")
        end   = response_text.rfind("}") + 1
        if start == -1 or end == 0:
            if verbose:
                _ui_error(f"Geen JSON gevonden voor {naam}.")
            return None

        data = json.loads(response_text[start:end])

        # Zorg dat 'extra' altijd een string is (Beheer.py verwacht dat)
        if isinstance(data.get("extra"), list):
            data["extra"] = ", ".join(str(v) for v in data["extra"])

        return data

    except json.JSONDecodeError as e:
        if verbose:
            _ui_error(f"JSON-fout bij {naam}: {e}")
        return None
    except Exception as e:
        if verbose:
            _ui_error(f"Onverwachte fout bij {naam}: {e}")
        return None


# ── UI HELPERS (alleen actief als Streamlit aanwezig is) ─────────────────────
# Fix: business-logic en UI zijn nu gescheiden. st.* wordt alleen aangeroepen
# via deze wrappers, die graceful falen buiten een Streamlit-context.

def _ui_write(msg: str):
    try:
        import streamlit as st
        st.write(msg)
    except Exception:
        pass

def _ui_warn(msg: str):
    try:
        import streamlit as st
        st.warning(msg)
    except Exception:
        pass

def _ui_error(msg: str):
    try:
        import streamlit as st
        st.error(msg)
    except Exception:
        pass

def _ui_expander(title: str, content: str):
    try:
        import streamlit as st
        with st.expander(title):
            st.text(content[:3000])  # Limiet voor leesbaarheid
    except Exception:
        pass
