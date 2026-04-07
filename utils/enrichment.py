"""
utils/enrichment.py — AI-onderzoeker v4 met Multi-Photo Scraping en Rijke JSON.
Pijler 3: Meerdere foto's, uitgebreide faciliteiten-data, huisregels.

Nieuw in v4:
  - scrape_photos(): actief zoeken naar <img> tags / galerijen op bronwebsites
  - Rijkere AI JSON output: faciliteiten_extra, huisregels, reviews_tekst,
    roken, feesten, stilteplicht, loc_type
  - Deductie-regels per locatietype (uitgebreid)
  - Provincie + telefoon normalisatie in alle prompts
  - Hersearch drempel: 4 onbekende velden
"""
from __future__ import annotations

import json
import re
import time
from urllib.parse import urlparse, quote_plus, urljoin

import requests
from bs4 import BeautifulSoup
import pandas as pd

from utils.ai_helper import get_gemini_response_grounded


# ── SCRAPER CONFIGURATIE ───────────────────────────────────────────────────────
_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept":          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "nl-NL,nl;q=0.9,en-US;q=0.8",
}
_TIMEOUT   = 12
_MAX_TEKST = 12_000

# Extensies die zeker foto zijn
_IMG_EXTS = {".jpg", ".jpeg", ".png", ".webp", ".gif"}
# Sleutelwoorden in src die op een foto wijzen
_IMG_KEYWORDS = {"photo", "foto", "image", "img", "gallery", "gallerij", "camp", "camper"}
# Minimale afbeeldingsbreedte om als "echt" te tellen (in pixels)
_MIN_IMG_WIDTH = 200


# ── BRON 1: EIGEN WEBSITE + FOTO SCRAPING ─────────────────────────────────────

def scrape_website(url: str) -> str:
    """Haalt tekst van de eigen website op. SSRF-beveiligd."""
    if not url or pd.isna(url):
        return ""
    url = str(url).strip()
    if url.lower() in ("nan", "onbekend", "none", ""):
        return ""
    if not url.startswith(("http://", "https://")):
        url = "https://" + url
    parsed = urlparse(url)
    if parsed.scheme not in ("http", "https") or not parsed.netloc:
        return ""
    try:
        resp = requests.get(url, headers=_HEADERS, timeout=_TIMEOUT)
        resp.raise_for_status()
        return _extract_text(resp.text)
    except Exception:
        return ""


def scrape_photos(url: str, max_photos: int = 6) -> list[str]:
    """
    Pijler 3: Scrapet actief foto-URLs van een website.
    Zoekt naar:
      1. <img> tags met grote afmetingen (width/height attribuut ≥ 200px)
      2. <meta property="og:image"> tags (OpenGraph)
      3. JSON-LD afbeeldingen
      4. Src's die foto-keywords of -extensies bevatten

    Args:
      url:        Website URL om te scrapen
      max_photos: Maximum aantal foto URLs te retourneren

    Returns:
      Lijst van absolute foto-URLs (gedupliceert gefilterd)
    """
    if not url or str(url).lower() in ("nan", "onbekend", "none", ""):
        return []
    url = str(url).strip()
    if not url.startswith(("http://", "https://")):
        url = "https://" + url
    parsed = urlparse(url)
    if parsed.scheme not in ("http", "https") or not parsed.netloc:
        return []

    try:
        resp = requests.get(url, headers=_HEADERS, timeout=_TIMEOUT)
        resp.raise_for_status()
    except Exception:
        return []

    soup = BeautifulSoup(resp.text, "html.parser")
    photos: list[str] = []
    seen: set[str] = set()
    base = f"{parsed.scheme}://{parsed.netloc}"

    def _add(src: str) -> None:
        """Voeg foto toe als het een geldige URL is en nog niet gezien."""
        if not src:
            return
        # Maak absoluut
        if src.startswith("//"):
            src = "https:" + src
        elif src.startswith("/"):
            src = base + src
        elif not src.startswith("http"):
            src = urljoin(url, src)
        # Filter kleine/data-uri/svg
        if any(bad in src.lower() for bad in ("data:", ".svg", "logo", "icon", "sprite")):
            return
        if src not in seen:
            seen.add(src)
            photos.append(src)

    # 1. OpenGraph image (meest betrouwbaar)
    for og in soup.find_all("meta", property="og:image"):
        _add(og.get("content", ""))

    # 2. JSON-LD afbeeldingen
    for script in soup.find_all("script", type="application/ld+json"):
        try:
            data = json.loads(script.string or "")
            imgs = data.get("image", [])
            if isinstance(imgs, str):
                _add(imgs)
            elif isinstance(imgs, list):
                for i in imgs:
                    _add(i if isinstance(i, str) else i.get("url", ""))
        except Exception:
            pass

    # 3. <img> tags met breedte-indicatie
    for img in soup.find_all("img"):
        src = img.get("src", "") or img.get("data-src", "") or img.get("data-lazy-src", "")
        if not src:
            continue

        # Check width/height attributen
        try:
            w = int(img.get("width", 0) or 0)
            h = int(img.get("height", 0) or 0)
            if w >= _MIN_IMG_WIDTH or h >= _MIN_IMG_WIDTH:
                _add(src)
                continue
        except (ValueError, TypeError):
            pass

        # Check op foto-keywords in src of class
        src_lower = src.lower()
        classes   = " ".join(img.get("class", [])).lower()
        if (
            any(ext in src_lower for ext in _IMG_EXTS)
            and any(kw in src_lower or kw in classes for kw in _IMG_KEYWORDS)
        ):
            _add(src)

    # 4. Srcset (responsieve afbeeldingen)
    for elem in soup.find_all(["img", "source"]):
        srcset = elem.get("srcset", "")
        if srcset:
            # Pak de laatste URL uit srcset (hoogste resolutie)
            parts = [p.strip().split(" ")[0] for p in srcset.split(",") if p.strip()]
            if parts:
                _add(parts[-1])

    return photos[:max_photos]


# ── BRON 2: CAMPERCONTACT ──────────────────────────────────────────────────────

def scrape_campercontact(naam: str, provincie: str) -> str:
    """Zoekt op Campercontact.com."""
    zoekterm   = f"{naam} {provincie}".strip()
    search_url = f"https://www.campercontact.com/nl/zoeken?q={quote_plus(zoekterm)}"
    try:
        resp = requests.get(search_url, headers=_HEADERS, timeout=_TIMEOUT)
        resp.raise_for_status()
        tekst = _extract_text(resp.text)
        if naam.lower()[:8] in tekst.lower():
            return f"[Campercontact] {tekst[:_MAX_TEKST]}"
        return ""
    except Exception:
        return ""


# ── BRON 3: PARK4NIGHT ─────────────────────────────────────────────────────────

def scrape_park4night(naam: str, provincie: str) -> str:
    """Zoekt op Park4Night."""
    zoekterm   = f"{naam} Nederland"
    search_url = f"https://park4night.com/fr/search?q={quote_plus(zoekterm)}"
    try:
        resp = requests.get(search_url, headers=_HEADERS, timeout=_TIMEOUT)
        resp.raise_for_status()
        tekst = _extract_text(resp.text)
        if len(tekst) > 100:
            return f"[Park4Night] {tekst[:_MAX_TEKST]}"
        return ""
    except Exception:
        return ""


# ── BRON 4: ANWB ──────────────────────────────────────────────────────────────

def scrape_anwb(naam: str) -> str:
    """Zoekt op ANWB Kamperen."""
    zoekterm   = f"{naam} camperplaats"
    search_url = f"https://www.anwb.nl/kamperen/search?q={quote_plus(zoekterm)}"
    try:
        resp = requests.get(search_url, headers=_HEADERS, timeout=8)
        resp.raise_for_status()
        tekst = _extract_text(resp.text)
        if len(tekst) > 200:
            return f"[ANWB] {tekst[:6_000]}"
        return ""
    except Exception:
        return ""


# ── TEKST EXTRACTOR ────────────────────────────────────────────────────────────

def _extract_text(html: str) -> str:
    """Extraheer schone tekst uit HTML."""
    soup = BeautifulSoup(html, "html.parser")
    for tag in soup(["script", "style", "nav", "footer", "header",
                     "aside", "noscript", "iframe", "form"]):
        tag.extract()
    return " ".join(soup.get_text(separator=" ", strip=True).split())


# ── LOCATIETYPE DETECTOR ───────────────────────────────────────────────────────

def _detect_type(naam: str) -> str:
    """Detecteert locatietype voor deductie-hints in de AI-prompt."""
    naam_l = naam.lower()
    if any(w in naam_l for w in ["parking", "parkeer", "p+r", "p-r"]):
        return "parking"
    if any(w in naam_l for w in ["jachthaven", "marina", "haven"]):
        return "jachthaven"
    if any(w in naam_l for w in ["boerderij", "farm", "hoeve"]):
        return "boerderij"
    if any(w in naam_l for w in ["camping", "kampeer", "vakantiepark"]):
        return "camping"
    if any(w in naam_l for w in ["camper", "motorhome", "camperplaats"]):
        return "camperplaats"
    return "camperplaats"  # standaard


# ── DEDUCTIE REGELS ────────────────────────────────────────────────────────────

_DEDUCTIE: dict[str, str] = {
    "parking": (
        "PARKEERPLAATS: tenzij bewijs anders: stroom=Nee, sanitair=Nee, wifi=Nee, "
        "chemisch_toilet=Nee, water_tanken=Nee. Honden meestal Ja."
    ),
    "jachthaven": (
        "JACHTHAVEN: bijna altijd: water_tanken=Ja, afvalwater=Ja, sanitair=Ja, stroom=Ja."
    ),
    "boerderij": (
        "BOERDERIJ: Ondergrond=Gras, Rust=Rustig. Honden: check bronnen (vaak Nee i.v.m. vee)."
    ),
    "camping": (
        "CAMPING: bijna altijd: sanitair=Ja, water_tanken=Ja. Stroom: check bronnen."
    ),
    "camperplaats": (
        "CAMPERPLAATS: bijna altijd: water_tanken=Ja, afvalwater=Ja. Stroom: check bronnen."
    ),
}

_PROVINCIE_INSTRUCTIE = """
PROVINCIE (VERPLICHT officieel Nederlands):
  Fryslân/Frisian → "Friesland" | North Holland → "Noord-Holland"
  South Holland → "Zuid-Holland" | North Brabant → "Noord-Brabant"
  Guelders → "Gelderland" | Zealand → "Zeeland"
Geldige waarden: Groningen, Friesland, Drenthe, Overijssel, Flevoland,
  Gelderland, Utrecht, Noord-Holland, Zuid-Holland, Zeeland, Noord-Brabant, Limburg
"""

_TELEFOON_INSTRUCTIE = """
TELEFOONNUMMER (+31 formaat):
  0612345678 → "+31 6 1234 5678" | 0201234567 → "+31 20 123 4567"
  Onbekend → exact "Onbekend"
"""


# ── RIJKE AI PROMPT BUILDER ────────────────────────────────────────────────────

def _build_rich_prompt(
    naam: str,
    provincie: str,
    website: str,
    alle_bronnen: str,
    loc_type: str,
) -> str:
    """
    Bouwt de rijke AI-prompt voor één locatie.
    Output bevat uitgebreide faciliteiten, huisregels, meerdere velden voor de
    Booking.com-stijl detailpagina.
    """
    deductie = _DEDUCTIE.get(loc_type, _DEDUCTIE["camperplaats"])
    return f"""
Je bent een expert data-analist voor het Nederlandse camperplatform VrijStaan.
Vul een VOLLEDIG, RIJKPROFIEL in voor '{naam}' in {provincie}.
Locatietype: {loc_type}

BRONINHOUD:
{alle_bronnen[:22_000]}

INSTRUCTIES:
• Ja/Nee/Onbekend: gebruik deductie — "Onbekend" alleen als echt niet te bepalen
• Deductie voor {loc_type}: {deductie}
• Gebruik Google Search Grounding voor ontbrekende velden
{_PROVINCIE_INSTRUCTIE}
{_TELEFOON_INSTRUCTIE}
• beschrijving: 2-4 sfeervolle zinnen
• samenvatting_reviews: doorlopende zin 20-40 woorden, "Gasten-stijl"
• faciliteiten_extra: opsomming van overige faciliteiten als CSV-string
• huisregels: korte beschrijving van regels/beleid als tekst
• loc_type: het locatietype in het Nederlands (bijv. "Camping", "Camperplaats", "Parking")

Retourneer UITSLUITEND geldig JSON:
{{
  "prijs": "€X per nacht of Gratis of Onbekend",
  "provincie": "officiële NL-provincie",
  "honden_toegestaan": "Ja/Nee/Onbekend",
  "stroom": "Ja/Nee/Onbekend",
  "stroom_prijs": "€X/nacht of Inbegrepen of Nee (geen stroom) of Onbekend",
  "afvalwater": "Ja/Nee/Onbekend",
  "chemisch_toilet": "Ja/Nee/Onbekend",
  "water_tanken": "Ja/Nee/Onbekend",
  "aantal_plekken": "getal of Onbekend",
  "check_in_out": "tijden of Vrij of Onbekend",
  "beschrijving": "2-4 sfeervolle zinnen",
  "ondergrond": "Gras/Asfalt/Grind/Verhard/Gemengd/Onbekend",
  "toegankelijkheid": "Ja/Nee/Onbekend",
  "rust": "Rustig/Gemiddeld/Druk/Onbekend",
  "sanitair": "Ja/Nee/Onbekend",
  "wifi": "Ja/Nee/Onbekend",
  "waterfront": "Ja/Nee/Onbekend",
  "beoordeling": "bijv. 4.3 of Onbekend",
  "samenvatting_reviews": "Gasten-stijl zin 20-40 woorden of Onbekend",
  "reviews_tekst": "uitgebreidere review-tekst of Onbekend",
  "telefoonnummer": "+31 X XXXX XXXX of Onbekend",
  "roken": "Ja/Nee/Onbekend",
  "feesten": "Ja/Nee/Onbekend",
  "stilteplicht": "Ja/Nee/Onbekend",
  "faciliteiten_extra": "CSV van extra faciliteiten of Onbekend",
  "huisregels": "korte omschrijving regels of Onbekend",
  "loc_type": "Camping/Camperplaats/Parking/Jachthaven/Boerderij",
  "ai_gecheckt": "Ja"
}}
"""


# ── JSON PARSER ────────────────────────────────────────────────────────────────

def _parse_json(text: str) -> dict | None:
    """Robuust JSON parsen, tolereert markdown fences."""
    if not text:
        return None
    try:
        clean = text.strip()
        if clean.startswith("```"):
            clean = "\n".join(clean.split("\n")[1:])
        if clean.endswith("```"):
            clean = "\n".join(clean.split("\n")[:-1])
        start = clean.find("{")
        end   = clean.rfind("}") + 1
        if start == -1 or end == 0:
            return None
        return json.loads(clean[start:end])
    except Exception:
        return None


def _count_onbekend(data: dict) -> int:
    return sum(
        1 for v in data.values()
        if isinstance(v, str) and v.strip().lower() == "onbekend"
    )


# ── DATAHYGIËNE POST-PROCESSOR ─────────────────────────────────────────────────

def _apply_hygiene(data: dict) -> dict:
    """Past provincie en telefoon normalisatie toe als Python-vangnet."""
    try:
        from utils.batch_engine import normalize_province, normalize_phone
        if "provincie" in data:
            data["provincie"] = normalize_province(str(data.get("provincie", "")))
        if "telefoonnummer" in data:
            data["telefoonnummer"] = normalize_phone(str(data.get("telefoonnummer", "")))
    except ImportError:
        pass
    if data.get("stroom", "").lower() == "nee":
        data["stroom_prijs"] = "Nee (geen stroom)"
    if isinstance(data.get("extra"), list):
        data["extra"] = ", ".join(str(v) for v in data["extra"])
    return data


# ── HOOFD: LOCATIE ONDERZOEK ───────────────────────────────────────────────────

def research_location(row: object, verbose: bool = True) -> dict | None:
    """
    Onderzoekt één locatierij via Waterval Methode v4.
    Nieuw: scrape_photos() voor meerdere foto's per locatie.

    Returns:
      dict met verrijkte data, of None bij parse-fout.
    """
    naam      = str(row.get("naam",      "Onbekende locatie")).strip()  # type: ignore[union-attr]
    provincie = str(row.get("provincie", "Nederland")).strip()           # type: ignore[union-attr]
    website   = str(row.get("website",   "")).strip()                   # type: ignore[union-attr]
    loc_type  = _detect_type(naam)

    if verbose:
        _ui_write(f"🔍 Onderzoek: **{naam}** ({provincie})")

    # ── Foto's scrapen (Pijler 3) ───────────────────────────────────────
    photos: list[str] = []
    if website:
        if verbose:
            _ui_write("   └─ 📸 Foto's scrapen van website…")
        photos = scrape_photos(website, max_photos=6)
        if verbose:
            _ui_write(f"   └─ ✅ {len(photos)} foto's gevonden")

    # ── Tekst-bronnen scrapen ───────────────────────────────────────────
    bronnen: list[str] = []
    ws_tekst = scrape_website(website)
    if ws_tekst:
        bronnen.append(f"[Eigen website]\n{ws_tekst[:_MAX_TEKST]}")

    cc_tekst = scrape_campercontact(naam, provincie)
    if cc_tekst:
        bronnen.append(cc_tekst)

    time.sleep(0.4)
    p4n_tekst = scrape_park4night(naam, provincie)
    if p4n_tekst:
        bronnen.append(p4n_tekst)

    anwb_tekst = scrape_anwb(naam)
    if anwb_tekst:
        bronnen.append(anwb_tekst)

    alle_bronnen = "\n\n".join(bronnen) if bronnen else "Geen webinhoud beschikbaar."

    # ── AI-verrijking ───────────────────────────────────────────────────
    prompt = _build_rich_prompt(naam, provincie, website, alle_bronnen, loc_type)
    response_text = get_gemini_response_grounded(prompt)

    if verbose:
        _ui_expander(f"⚙️ Ruwe AI output — {naam}", response_text)

    data = _parse_json(response_text)
    if data is None:
        if verbose:
            _ui_error(f"❌ JSON-parse mislukt voor {naam}")
        return None

    # ── Python-level datahygiëne ────────────────────────────────────────
    data = _apply_hygiene(data)

    # ── Hersearch bij te veel onbekende velden ──────────────────────────
    if _count_onbekend(data) > 4:
        if verbose:
            _ui_warn(f"⚠️ Veel onbekende velden → hersearch gestart…")
        data = _hersearch(naam, provincie, data, verbose)
        data = _apply_hygiene(data)

    # ── Foto's toevoegen als JSON-string ────────────────────────────────
    if photos:
        data["photos"] = json.dumps(photos, ensure_ascii=False)
    elif not data.get("photos"):
        data["photos"] = "[]"

    return data


def _hersearch(
    naam: str, provincie: str, huidige_data: dict, verbose: bool
) -> dict:
    """Tweede AI-aanroep gericht op lege velden."""
    onbekende_keys = [
        k for k, v in huidige_data.items()
        if isinstance(v, str) and v.strip().lower() == "onbekend"
    ]
    prompt = f"""
Zoek SPECIFIEK naar ontbrekende data voor '{naam}' in {provincie}.
Onbekende velden: {', '.join(onbekende_keys)}

Gebruik Google Search Grounding voor:
1. "{naam} camperplaats {provincie}" op Campercontact, Park4Night, Google Maps
2. "{naam} {provincie} faciliteiten" op ANWB, NKC

Huidige data:
{json.dumps(huidige_data, ensure_ascii=False, indent=2)}

{_PROVINCIE_INSTRUCTIE}
{_TELEFOON_INSTRUCTIE}

Retourneer UITSLUITEND het volledige, verbeterde JSON-object.
Gebruik "Nee" voor logisch afwezige faciliteiten, "Onbekend" alleen als echt niet te vinden.
"""
    response  = get_gemini_response_grounded(prompt)
    verbeterd = _parse_json(response)
    if verbeterd:
        for key, val in verbeterd.items():
            if key in huidige_data:
                orig = str(huidige_data[key]).strip().lower()
                if orig == "onbekend" and str(val).strip().lower() != "onbekend":
                    huidige_data[key] = val
        if verbose:
            _ui_write(
                f"   └─ ✅ Hersearch klaar: {_count_onbekend(huidige_data)} velden onbekend"
            )
    return huidige_data


# ── UI HELPERS ─────────────────────────────────────────────────────────────────

def _ui_write(msg: str) -> None:
    try:
        import streamlit as st
        st.write(msg)
    except Exception:
        pass


def _ui_warn(msg: str) -> None:
    try:
        import streamlit as st
        st.warning(msg)
    except Exception:
        pass


def _ui_error(msg: str) -> None:
    try:
        import streamlit as st
        st.error(msg)
    except Exception:
        pass


def _ui_expander(title: str, content: str) -> None:
    try:
        import streamlit as st
        with st.expander(title):
            st.text(str(content)[:4000])
    except Exception:
        pass
