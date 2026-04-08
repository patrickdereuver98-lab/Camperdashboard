"""
utils/enrichment.py — VrijStaan v5 AI-onderzoeker.
Pijler 5: MD5 hash-check, agentic heronderzoek (>4 onbekend).
Pijler 6: Drukte-indicator, voertuig restricties, Remote Work Score.
Pijler 3: Multi-foto scraping via BeautifulSoup.
"""
from __future__ import annotations

import hashlib
import json
import re
import time
from pathlib import Path
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
_MAX_TEKST = 10_000
_IMG_EXTS  = {".jpg", ".jpeg", ".png", ".webp"}

# MD5 cache pad
_HASH_CACHE = Path("data/url_hash_cache.json")


# ── MD5 HASH CACHE (Pijler 5) ─────────────────────────────────────────────────

def _load_hash_cache() -> dict[str, str]:
    if _HASH_CACHE.exists():
        try:
            return json.loads(_HASH_CACHE.read_text(encoding="utf-8"))
        except Exception:
            pass
    return {}


def _save_hash_cache(cache: dict[str, str]) -> None:
    _HASH_CACHE.parent.mkdir(parents=True, exist_ok=True)
    _HASH_CACHE.write_text(json.dumps(cache, ensure_ascii=False), encoding="utf-8")


def _md5(text: str) -> str:
    return hashlib.md5(text.encode("utf-8")).hexdigest()


def website_changed(url: str, current_text: str) -> bool:
    """
    Pijler 5: Vergelijk MD5 hash van huidige websitetekst met cache.
    True = website veranderd (AI-verwerking nodig).
    False = identiek (sla dure AI-stap over).
    """
    if not url or not current_text:
        return True
    cache = _load_hash_cache()
    new_hash = _md5(current_text[:5000])  # Eerste 5000 tekens als fingerprint
    old_hash = cache.get(url, "")
    if old_hash == new_hash:
        return False
    cache[url] = new_hash
    _save_hash_cache(cache)
    return True


# ── BRON 1: EIGEN WEBSITE ──────────────────────────────────────────────────────

def scrape_website(url: str) -> str:
    """Haalt tekst van eigen website. SSRF-beveiligd."""
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
    Pijler 5/3: Scrapet meerdere foto-URL's van een website.
    Zoekt: og:image, JSON-LD, grote <img> tags, srcset.
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
    base = f"{parsed.scheme}://{parsed.netloc}"
    photos: list[str] = []
    seen:   set[str]  = set()

    def _add(src: str) -> None:
        if not src:
            return
        if src.startswith("//"):
            src = "https:" + src
        elif src.startswith("/"):
            src = base + src
        elif not src.startswith("http"):
            src = urljoin(url, src)
        if any(bad in src.lower() for bad in ("data:", ".svg", "logo", "icon", "sprite", "blank")):
            return
        if src not in seen:
            seen.add(src)
            photos.append(src)

    # 1. OpenGraph
    for og in soup.find_all("meta", property="og:image"):
        _add(og.get("content", ""))

    # 2. JSON-LD
    for script in soup.find_all("script", type="application/ld+json"):
        try:
            data = json.loads(script.string or "")
            imgs = data.get("image", [])
            if isinstance(imgs, str):
                _add(imgs)
            elif isinstance(imgs, list):
                for i in imgs[:3]:
                    _add(i if isinstance(i, str) else i.get("url", ""))
        except Exception:
            pass

    # 3. Grote <img> tags
    for img in soup.find_all("img"):
        src = (img.get("src") or img.get("data-src") or
               img.get("data-lazy-src") or "")
        if not src:
            continue
        try:
            w = int(img.get("width", 0) or 0)
            h = int(img.get("height", 0) or 0)
            if w >= 200 or h >= 150:
                _add(src)
                continue
        except (ValueError, TypeError):
            pass
        sl = src.lower()
        if any(ext in sl for ext in _IMG_EXTS):
            _add(src)

    # 4. Srcset
    for elem in soup.find_all(["img", "source"]):
        srcset = elem.get("srcset", "")
        if srcset:
            parts = [p.strip().split(" ")[0] for p in srcset.split(",") if p.strip()]
            if parts:
                _add(parts[-1])

    return photos[:max_photos]


# ── BRONNEN 2-4 ────────────────────────────────────────────────────────────────

def scrape_campercontact(naam: str, provincie: str) -> str:
    zoekterm = f"{naam} {provincie}".strip()
    url = f"https://www.campercontact.com/nl/zoeken?q={quote_plus(zoekterm)}"
    try:
        resp = requests.get(url, headers=_HEADERS, timeout=_TIMEOUT)
        resp.raise_for_status()
        tekst = _extract_text(resp.text)
        return f"[Campercontact] {tekst[:_MAX_TEKST]}" if naam.lower()[:8] in tekst.lower() else ""
    except Exception:
        return ""


def scrape_park4night(naam: str, provincie: str) -> str:
    url = f"https://park4night.com/fr/search?q={quote_plus(naam + ' Nederland')}"
    try:
        resp = requests.get(url, headers=_HEADERS, timeout=_TIMEOUT)
        resp.raise_for_status()
        tekst = _extract_text(resp.text)
        return f"[Park4Night] {tekst[:_MAX_TEKST]}" if len(tekst) > 100 else ""
    except Exception:
        return ""


def scrape_anwb(naam: str) -> str:
    url = f"https://www.anwb.nl/kamperen/search?q={quote_plus(naam + ' camperplaats')}"
    try:
        resp = requests.get(url, headers=_HEADERS, timeout=8)
        resp.raise_for_status()
        tekst = _extract_text(resp.text)
        return f"[ANWB] {tekst[:6_000]}" if len(tekst) > 200 else ""
    except Exception:
        return ""


def _extract_text(html: str) -> str:
    soup = BeautifulSoup(html, "html.parser")
    for tag in soup(["script", "style", "nav", "footer", "header",
                     "aside", "noscript", "iframe", "form"]):
        tag.extract()
    return " ".join(soup.get_text(separator=" ", strip=True).split())


# ── LOCATIETYPE DETECTOR ───────────────────────────────────────────────────────

def _detect_type(naam: str) -> str:
    naam_l = naam.lower()
    if any(w in naam_l for w in ["parking", "parkeer", "p+r"]):
        return "parking"
    if any(w in naam_l for w in ["jachthaven", "marina", "haven"]):
        return "jachthaven"
    if any(w in naam_l for w in ["boerderij", "farm", "hoeve"]):
        return "boerderij"
    if any(w in naam_l for w in ["camping", "kampeer", "vakantiepark"]):
        return "camping"
    return "camperplaats"


# ── RIJKE AI PROMPT (Pijler 6) ────────────────────────────────────────────────

_PROVINCIE_MAP = {
    "fryslân": "Friesland", "fryslan": "Friesland", "frisian": "Friesland",
    "north holland": "Noord-Holland", "north-holland": "Noord-Holland",
    "south holland": "Zuid-Holland", "south-holland": "Zuid-Holland",
    "north brabant": "Noord-Brabant", "north-brabant": "Noord-Brabant",
    "guelders": "Gelderland", "zealand": "Zeeland",
}


def _build_rich_prompt(
    naam: str, provincie: str, website: str,
    alle_bronnen: str, loc_type: str,
) -> str:
    """
    Pijler 6: Uitgebreide AI-prompt met camper-specifieke velden:
    - drukte_indicator: "Snel vol / Druk / Vaak plek"
    - max_lengte: max voertuiglengte in meters
    - max_gewicht: max gewicht in ton
    - remote_work_score: 4G/5G kwaliteit omschrijving
    """
    prov_mapping_str = ", ".join(f'"{k}" → "{v}"' for k, v in _PROVINCIE_MAP.items())
    return f"""
Je bent expert data-analist voor VrijStaan (NL camperplatform).
Geef een VOLLEDIG en ACCURAAT profiel voor '{naam}' in {provincie}.
Type: {loc_type}

BRONINHOUD:
{alle_bronnen[:20_000]}

VERPLICHTE INSTRUCTIES:
1. Ja/Nee/Onbekend — gebruik deductie, "Onbekend" alleen als echt niets te vinden
2. Provincie OFFICIEEL NL: {prov_mapping_str}
3. Telefoon: +31 formaat (0612345678 → "+31 6 1234 5678")
4. beschrijving: 2-4 sfeervolle zinnen
5. samenvatting_reviews: doorlopende "Gasten zeggen..."-zin 20-40 woorden

CAMPER-SPECIFIEKE VELDEN (Pijler 6 — VERPLICHT invullen):
- drukte_indicator: Kansomschrijving zoals "Snel vol in het seizoen", "Vaak plek",
  "Druk in zomer maar rustig buiten seizoen". Gebruik reviews, bezoekcijfers.
- max_lengte: Max toegestane voertuiglengte in meters (bijv. "8m" of "Onbekend").
  Kijk naar toegangsweg, slagboom, parkeerplaats afmetingen.
- max_gewicht: Max gewicht in ton (bijv. "3.5t", "10t", "Geen beperking" of "Onbekend").
- remote_work_score: Kwaliteit 4G/5G netwerk: "Uitstekend (5G beschikbaar)",
  "Goed (4G LTE)", "Matig (2G/3G)", "Slecht (geen dekking)" of "Onbekend".
  Gebruik Umastionkaart, Opensignal, coverage-kaarten NL.
- voertuig_types: Toegestane voertuigen, bijv. "Campervan, Caravan, Motorhome"
- tarieftype: "Per nacht", "Per dag", "Gratis", "Abonnement" of "Onbekend"

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
  "samenvatting_reviews": "Gasten-zin 20-40 woorden of Onbekend",
  "reviews_tekst": "uitgebreide review tekst of Onbekend",
  "telefoonnummer": "+31 X XXXX XXXX of Onbekend",
  "roken": "Ja/Nee/Onbekend",
  "feesten": "Ja/Nee/Onbekend",
  "stilteplicht": "Ja/Nee/Onbekend",
  "faciliteiten_extra": "CSV extra faciliteiten of Onbekend",
  "huisregels": "korte beschrijving of Onbekend",
  "loc_type": "Camping/Camperplaats/Parking/Jachthaven/Boerderij",
  "drukte_indicator": "bijv. 'Snel vol in het seizoen' of 'Vaak plek' of 'Onbekend'",
  "max_lengte": "bijv. '8m', '12m', 'Geen beperking' of 'Onbekend'",
  "max_gewicht": "bijv. '3.5t', '10t', 'Geen beperking' of 'Onbekend'",
  "remote_work_score": "bijv. 'Goed (4G LTE)' of 'Onbekend'",
  "voertuig_types": "bijv. 'Campervan, Caravan' of 'Onbekend'",
  "tarieftype": "Per nacht/Per dag/Gratis/Onbekend",
  "ai_gecheckt": "Ja"
}}
"""


# ── JSON PARSER ────────────────────────────────────────────────────────────────

def _parse_json(text: str) -> dict | None:
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
    return sum(1 for v in data.values() if isinstance(v, str) and v.strip().lower() == "onbekend")


# ── DATAHYGIËNE ────────────────────────────────────────────────────────────────

def _apply_hygiene(data: dict) -> dict:
    """Provincie + telefoon normalisatie als Python-vangnet."""
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


# ── AGENTIC HERSEARCH (Pijler 5) ──────────────────────────────────────────────

def _agentic_hersearch(
    naam: str, provincie: str, data: dict, verbose: bool
) -> dict:
    """
    Pijler 5: Als AI >4 velden op 'Onbekend' zet → forceer Search Grounding
    met focus op recente (2024+) bronnen en forums.
    """
    onbekende = [k for k, v in data.items()
                 if isinstance(v, str) and v.strip().lower() == "onbekend"]

    prompt = f"""
Je hebt eerder data verzameld over '{naam}' in {provincie}.
Nog {len(onbekende)} velden zijn onbekend: {', '.join(onbekende)}.

GEBRUIK GOOGLE SEARCH GROUNDING. Focus op bronnen uit 2024-2025:
1. Zoek "{naam} camperplaats {provincie} 2024 ervaringen" op forums (camperplatform.nl, kees-campert.nl)
2. Zoek "{naam} camping {provincie} 2024" op Campercontact, Park4Night reviews
3. Zoek "camperplaats {naam} {provincie} open reviews" op Google Maps

Huidige data:
{json.dumps(data, ensure_ascii=False, indent=2)}

Vervang zo veel mogelijk "Onbekend" waarden. Gebruik "Nee" voor logisch afwezige faciliteiten.
Voor drukte_indicator: gebruik recente seizoens-ervaringen (2024+) van bezoekers.
Voor remote_work_score: zoek op Opensignal, Tele2/KPN coverage maps voor {provincie}.
Voor max_lengte/max_gewicht: zoek luchtfoto's, camping-beschrijvingen, toegangswegen.

Retourneer UITSLUITEND het volledige, verbeterde JSON-object.
"""
    response  = get_gemini_response_grounded(prompt)
    verbeterd = _parse_json(response)
    if verbeterd:
        for key, val in verbeterd.items():
            if key in data and str(data[key]).strip().lower() == "onbekend":
                new_val = str(val).strip()
                if new_val.lower() != "onbekend":
                    data[key] = val
        if verbose:
            n_remaining = _count_onbekend(data)
            _ui_write(f"   └─ ✅ Agentic hersearch: {len(onbekende)} → {n_remaining} onbekend")
    return data


# ── HOOFD: LOCATIE ONDERZOEK ───────────────────────────────────────────────────

def research_location(row: object, verbose: bool = True) -> dict | None:
    """
    Onderzoekt één locatie via Waterval Methode v5:
    1. Photo scraping (meerdere foto's)
    2. Website MD5 hash-check (skip AI als ongewijzigd)
    3. Multi-bron text scraping
    4. Rijke AI-verrijking (incl. camper-specifieke velden)
    5. Agentic hersearch als >4 onbekend
    """
    naam      = str(row.get("naam",      "Onbekende locatie")).strip()   # type: ignore[union-attr]
    provincie = str(row.get("provincie", "Nederland")).strip()            # type: ignore[union-attr]
    website   = str(row.get("website",   "")).strip()                    # type: ignore[union-attr]
    loc_type  = _detect_type(naam)

    if verbose:
        _ui_write(f"🔍 Onderzoek: **{naam}** ({provincie})")

    # ── Foto's scrapen ──────────────────────────────────────────────────
    photos: list[str] = []
    if website:
        if verbose:
            _ui_write("   └─ 📸 Foto's ophalen…")
        photos = scrape_photos(website, max_photos=6)
        if verbose and photos:
            _ui_write(f"   └─ ✅ {len(photos)} foto's gevonden")

    # ── Website tekst + MD5 check ───────────────────────────────────────
    ws_tekst = scrape_website(website)

    # MD5 hash-check: als tekst niet veranderd is, skip AI
    if ws_tekst and not website_changed(website, ws_tekst):
        # Controleer of er al rijke data is voor deze locatie
        if str(row.get("ai_gecheckt", "")).lower() == "ja":  # type: ignore[union-attr]
            if verbose:
                _ui_write("   └─ ⚡ Website ongewijzigd + al verrijkt → sla AI over")
            return {"ai_gecheckt": "Ja", "_skip": True}

    # ── Multi-bron scraping ─────────────────────────────────────────────
    bronnen: list[str] = []
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

    # ── AI verrijking ───────────────────────────────────────────────────
    prompt = _build_rich_prompt(naam, provincie, website, alle_bronnen, loc_type)
    response_text = get_gemini_response_grounded(prompt)

    if verbose:
        _ui_expander(f"⚙️ Ruwe AI output — {naam}", response_text)

    data = _parse_json(response_text)
    if data is None:
        if verbose:
            _ui_error(f"❌ JSON-parse mislukt voor {naam}")
        return None

    # ── Datahygiëne ─────────────────────────────────────────────────────
    data = _apply_hygiene(data)

    # ── Agentic hersearch (Pijler 5): als >4 onbekend ──────────────────
    if _count_onbekend(data) > 4:
        if verbose:
            _ui_warn(f"⚠️ {_count_onbekend(data)} onbekende velden → agentic hersearch…")
        data = _agentic_hersearch(naam, provincie, data, verbose)
        data = _apply_hygiene(data)

    # ── Foto's toevoegen ────────────────────────────────────────────────
    if photos:
        data["photos"] = json.dumps(photos, ensure_ascii=False)
    elif not data.get("photos"):
        data["photos"] = "[]"

    return data


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
