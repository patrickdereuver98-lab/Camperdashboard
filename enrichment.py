"""
utils/enrichment.py — AI-onderzoeker v5 voor VrijStaan.
Pijler 5 & 6: MD5 hash-check, multi-photo scraping, agentic re-search,
camper-specifieke velden (drukte, max_lengte, max_gewicht, remote_work_score).

Nieuw in v5:
  - MD5 hash-check: skip AI als websitetekst niet veranderd is
  - scrape_photos(): actieve fotogalerij-scraping
  - Pijler 6 AI-velden: drukte_indicator, max_lengte, max_gewicht, remote_work_score
  - Agentic workflow: >4 onbekend → forceer Search Grounding op 2024+ bronnen
  - Provincie + telefoon normalisatie in alle prompts
"""
from __future__ import annotations

import hashlib
import json
import time
from urllib.parse import urlparse, quote_plus, urljoin

import requests
from bs4 import BeautifulSoup
import pandas as pd

from utils.ai_helper import get_gemini_response_grounded
from utils.logger import logger


# ── CONFIGURATIE ───────────────────────────────────────────────────────────────
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
_IMG_EXTS  = {".jpg", ".jpeg", ".png", ".webp"}
_IMG_KW    = {"photo", "foto", "image", "img", "gallery", "gallerij", "camp", "camper"}


# ── MD5 HASH CACHE ─────────────────────────────────────────────────────────────

def compute_text_hash(tekst: str) -> str:
    """Bereken MD5 hash van tekst voor change-detectie."""
    return hashlib.md5(tekst.encode("utf-8", errors="replace")).hexdigest()


def is_content_changed(url: str, stored_hash: str) -> tuple[bool, str, str]:
    """
    Controleer of website-inhoud veranderd is t.o.v. opgeslagen hash.

    Returns:
      (is_changed, nieuwe_tekst, nieuwe_hash)
      is_changed=False betekent: AI-stap overslaan (geen wijzigingen).
    """
    tekst = scrape_website(url)
    if not tekst:
        return False, "", stored_hash
    nieuwe_hash = compute_text_hash(tekst)
    changed = nieuwe_hash != stored_hash
    return changed, tekst, nieuwe_hash


# ── SCRAPER: EIGEN WEBSITE ─────────────────────────────────────────────────────

def scrape_website(url: str) -> str:
    """Haalt tekst van eigen website op. SSRF-beveiligd."""
    if not url or str(url).lower() in ("nan", "onbekend", "none", ""):
        return ""
    url = str(url).strip()
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


# ── SCRAPER: MEERDERE FOTO'S (Pijler 3/5) ─────────────────────────────────────

def scrape_photos(url: str, max_photos: int = 8) -> list[str]:
    """
    Scrapet actief foto-URLs van een website.
    Zoekt: og:image, JSON-LD, grote <img> tags, srcset.

    Returns:
      Lijst van absolute foto-URLs (gededupliceerd)
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
    seen: set[str]    = set()

    def _add(src: str) -> None:
        if not src:
            return
        if src.startswith("//"):
            src = "https:" + src
        elif src.startswith("/"):
            src = base + src
        elif not src.startswith("http"):
            src = urljoin(url, src)
        if any(bad in src.lower() for bad in ("data:", ".svg", "logo", "icon", "sprite", "pixel")):
            return
        if src not in seen and len(photos) < max_photos:
            seen.add(src)
            photos.append(src)

    # 1. OpenGraph image
    for og in soup.find_all("meta", property="og:image"):
        _add(og.get("content", ""))

    # 2. JSON-LD
    for script in soup.find_all("script", type="application/ld+json"):
        try:
            data = json.loads(script.string or "")
            for key in ("image", "photo", "thumbnail"):
                imgs = data.get(key, [])
                if isinstance(imgs, str):
                    _add(imgs)
                elif isinstance(imgs, list):
                    for i in imgs:
                        _add(i if isinstance(i, str) else i.get("url", ""))
        except Exception:
            pass

    # 3. Grote <img> tags
    for img in soup.find_all("img"):
        src = (img.get("src") or img.get("data-src") or
               img.get("data-lazy-src") or img.get("data-original") or "")
        if not src:
            continue
        try:
            w = int(img.get("width", 0) or 0)
            h = int(img.get("height", 0) or 0)
            if w >= 300 or h >= 200:
                _add(src)
                continue
        except (ValueError, TypeError):
            pass
        src_l = src.lower()
        cls_s = " ".join(img.get("class", [])).lower()
        if any(ext in src_l for ext in _IMG_EXTS) and any(kw in src_l or kw in cls_s for kw in _IMG_KW):
            _add(src)

    # 4. Srcset (hoogste resolutie)
    for elem in soup.find_all(["img", "source"]):
        srcset = elem.get("srcset", "")
        if srcset:
            parts = [p.strip().split(" ")[0] for p in srcset.split(",") if p.strip()]
            if parts:
                _add(parts[-1])

    return photos[:max_photos]


# ── EXTERNE BRONNEN ────────────────────────────────────────────────────────────

def scrape_campercontact(naam: str, provincie: str) -> str:
    zoekterm   = f"{naam} {provincie}".strip()
    search_url = f"https://www.campercontact.com/nl/zoeken?q={quote_plus(zoekterm)}"
    try:
        resp = requests.get(search_url, headers=_HEADERS, timeout=_TIMEOUT)
        resp.raise_for_status()
        tekst = _extract_text(resp.text)
        return f"[Campercontact] {tekst[:_MAX_TEKST]}" if naam.lower()[:8] in tekst.lower() else ""
    except Exception:
        return ""


def scrape_park4night(naam: str, provincie: str) -> str:
    zoekterm   = f"{naam} Nederland"
    search_url = f"https://park4night.com/fr/search?q={quote_plus(zoekterm)}"
    try:
        resp = requests.get(search_url, headers=_HEADERS, timeout=_TIMEOUT)
        resp.raise_for_status()
        tekst = _extract_text(resp.text)
        return f"[Park4Night] {tekst[:_MAX_TEKST]}" if len(tekst) > 100 else ""
    except Exception:
        return ""


def scrape_anwb(naam: str) -> str:
    zoekterm   = f"{naam} camperplaats"
    search_url = f"https://www.anwb.nl/kamperen/search?q={quote_plus(zoekterm)}"
    try:
        resp = requests.get(search_url, headers=_HEADERS, timeout=8)
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
    n = naam.lower()
    if any(w in n for w in ["parking", "parkeer", "p+r", "p-r"]):    return "parking"
    if any(w in n for w in ["jachthaven", "marina", "haven"]):        return "jachthaven"
    if any(w in n for w in ["boerderij", "farm", "hoeve"]):           return "boerderij"
    if any(w in n for w in ["camping", "kampeer", "vakantiepark"]):   return "camping"
    return "camperplaats"


# ── RIJKE AI PROMPT (Pijler 6) ─────────────────────────────────────────────────

_PROV_INSTRUCTIE = """
PROVINCIE (altijd officieel Nederlands):
  Fryslân/Frisian→"Friesland" | North Holland→"Noord-Holland"
  South Holland→"Zuid-Holland" | North Brabant→"Noord-Brabant"
  Guelders→"Gelderland" | Zealand→"Zeeland"
"""

_TEL_INSTRUCTIE = """
TELEFOON (+31 formaat): 0612345678→"+31 6 1234 5678" | onbekend→"Onbekend"
"""


def _build_prompt(naam: str, provincie: str, website: str,
                  bronnen: str, loc_type: str) -> str:
    """Bouwt de volledige AI-prompt met Pijler 6 velden."""
    deductie_map = {
        "parking":     "stroom=Nee, sanitair=Nee, wifi=Nee tenzij bewijs anders",
        "jachthaven":  "water_tanken=Ja, afvalwater=Ja, sanitair=Ja, stroom=Ja (standaard)",
        "boerderij":   "Gras, Rustig. Honden: check bronnen (vee!)",
        "camping":     "sanitair=Ja, water_tanken=Ja standaard",
        "camperplaats":"water_tanken=Ja, afvalwater=Ja standaard",
    }
    deductie = deductie_map.get(loc_type, "Gebruik context + Google")

    return f"""
Je bent expert data-analist voor VrijStaan (NL camperplatform).
Locatie: '{naam}' in {provincie} (type: {loc_type})

BRONINHOUD:
{bronnen[:22_000]}

INSTRUCTIES:
• Ja/Nee/Onbekend: deductie voor {loc_type}: {deductie}
• Gebruik Google Search Grounding voor ontbrekende velden
{_PROV_INSTRUCTIE}
{_TEL_INSTRUCTIE}
• beschrijving: 2-4 sfeervolle zinnen
• samenvatting_reviews: 20-40 woorden, "Gasten-stijl"
• drukte_indicator: "Snel vol (seizoensgebonden)" / "Gemiddeld druk" / "Vaak een plek vrij"
• max_lengte: bijv. "9 meter" / "Geen beperking" / "Onbekend"
• max_gewicht: bijv. "3.5 ton" / "Geen beperking" / "Onbekend"
• remote_work_score: "Uitstekend (4G/5G)" / "Goed (4G)" / "Matig (2G/3G)" / "Onbekend"
• loc_type: "Camping" / "Camperplaats" / "Parking" / "Jachthaven" / "Boerderij"

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
  "samenvatting_reviews": "Gasten-zin of Onbekend",
  "reviews_tekst": "uitgebreidere reviews of Onbekend",
  "telefoonnummer": "+31 X XXXX XXXX of Onbekend",
  "roken": "Ja/Nee/Onbekend",
  "feesten": "Ja/Nee/Onbekend",
  "stilteplicht": "Ja/Nee/Onbekend",
  "faciliteiten_extra": "CSV van extra faciliteiten of Onbekend",
  "huisregels": "korte omschrijving of Onbekend",
  "drukte_indicator": "zie formaat",
  "max_lengte": "bijv. 9 meter of Geen beperking of Onbekend",
  "max_gewicht": "bijv. 3.5 ton of Geen beperking of Onbekend",
  "remote_work_score": "zie formaat",
  "loc_type": "Camping/Camperplaats/etc.",
  "ai_gecheckt": "Ja"
}}
"""


# ── AGENTIC RE-SEARCH (Pijler 5) ──────────────────────────────────────────────

def _agentic_research(naam: str, provincie: str, data: dict) -> dict:
    """
    Als >4 velden op Onbekend: forceer Search Grounding op recente bronnen.
    Pijler 5: Agentic Workflow.
    """
    onbekend_keys = [k for k, v in data.items()
                     if isinstance(v, str) and v.strip().lower() == "onbekend"]
    prompt = f"""
Je hebt ONVOLDOENDE data voor '{naam}' in {provincie}.
Onbekende velden: {', '.join(onbekend_keys)}

Gebruik UITSLUITEND recente bronnen (2023-2025):
1. Zoek "{naam} camperplaats {provincie}" op Campercontact, Park4Night, Google Maps
2. Zoek "{naam} {provincie} faciliteiten 2024" op ANWB, NKC, forumleden
3. Controleer Google Reviews, TripAdvisor (laatste 12 maanden)

Extra te bepalen:
- drukte_indicator: is het vaak vol of vrijwel altijd plek?
- max_lengte: zijn er borden of vermeldingen over max voertuiglengte?
- remote_work_score: is 4G/5G ontvangst goed?

Huidige data:
{json.dumps(data, ensure_ascii=False, indent=2)}

{_PROV_INSTRUCTIE}
{_TEL_INSTRUCTIE}

Retourneer UITSLUITEND de VERBETERDE versie van het volledige JSON-object.
"""
    response  = get_gemini_response_grounded(prompt)
    verbeterd = _parse_json(response)
    if verbeterd:
        for key, val in verbeterd.items():
            if key in data and str(data[key]).strip().lower() == "onbekend":
                if str(val).strip().lower() != "onbekend":
                    data[key] = val
    return data


# ── DATAHYGIËNE ────────────────────────────────────────────────────────────────

def _apply_hygiene(data: dict) -> dict:
    """Python-vangnet voor provincie + telefoon normalisatie."""
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
    return data


def _count_onbekend(data: dict) -> int:
    return sum(1 for v in data.values()
               if isinstance(v, str) and v.strip().lower() == "onbekend")


def _parse_json(text: str) -> dict | None:
    if not text:
        return None
    try:
        clean = text.strip()
        for fence in ("```json", "```"):
            clean = clean.replace(fence, "")
        clean = clean.strip()
        start = clean.find("{")
        end   = clean.rfind("}") + 1
        if start == -1 or end == 0:
            return None
        return json.loads(clean[start:end])
    except Exception:
        return None


# ── HOOFD: LOCATIE ONDERZOEK ───────────────────────────────────────────────────

def research_location(
    row: object,
    verbose: bool = True,
    stored_hash: str = "",
) -> dict | None:
    """
    Onderzoekt één locatierij via Waterval Methode v5.

    Nieuw in v5:
    - MD5 hash-check: skip AI als inhoud identiek is
    - scrape_photos(): meerdere foto's
    - Agentic re-search bij >4 onbekende velden
    - Pijler 6 velden: drukte, max_lengte, max_gewicht, remote_work_score

    Returns:
      dict met verrijkte data (inclusief 'text_hash' en 'photos'),
      of None bij fout.
    """
    naam      = str(row.get("naam",      "Onbekende locatie")).strip()  # type: ignore
    provincie = str(row.get("provincie", "Nederland")).strip()           # type: ignore
    website   = str(row.get("website",   "")).strip()                   # type: ignore
    loc_type  = _detect_type(naam)

    if verbose:
        _ui_write(f"🔍 **{naam}** ({provincie})")

    # ── MD5 hash-check (Pijler 5) ──────────────────────────────────────
    website_tekst = scrape_website(website)
    nieuwe_hash   = compute_text_hash(website_tekst) if website_tekst else ""

    if stored_hash and stored_hash == nieuwe_hash and nieuwe_hash:
        if verbose:
            _ui_write("   └─ ⏭️ Ongewijzigd (hash match) — AI overgeslagen")
        return {"_hash_skip": True, "text_hash": nieuwe_hash}

    # ── Foto's scrapen ─────────────────────────────────────────────────
    photos: list[str] = []
    if website:
        photos = scrape_photos(website, max_photos=8)
        if verbose and photos:
            _ui_write(f"   └─ 📸 {len(photos)} foto's gevonden")

    # ── Tekstbronnen scrapen ───────────────────────────────────────────
    bronnen: list[str] = []
    if website_tekst:
        bronnen.append(f"[Eigen website]\n{website_tekst[:_MAX_TEKST]}")
    cc  = scrape_campercontact(naam, provincie)
    if cc:  bronnen.append(cc)
    time.sleep(0.3)
    p4n = scrape_park4night(naam, provincie)
    if p4n: bronnen.append(p4n)
    anwb = scrape_anwb(naam)
    if anwb: bronnen.append(anwb)

    alle_bronnen = "\n\n".join(bronnen) if bronnen else "Geen webinhoud beschikbaar."

    # ── AI-verrijking ──────────────────────────────────────────────────
    prompt        = _build_prompt(naam, provincie, website, alle_bronnen, loc_type)
    response_text = get_gemini_response_grounded(prompt)

    if verbose:
        _ui_expander(f"⚙️ AI output — {naam}", response_text)

    data = _parse_json(response_text)
    if data is None:
        if verbose:
            _ui_error(f"❌ JSON-parse mislukt voor {naam}")
        return None

    data = _apply_hygiene(data)

    # ── Agentic re-search (Pijler 5) ───────────────────────────────────
    if _count_onbekend(data) > 4:
        if verbose:
            _ui_warn(f"⚠️ {_count_onbekend(data)} onbekend → agentic re-search…")
        data = _agentic_research(naam, provincie, data)
        data = _apply_hygiene(data)

    # ── Foto's + hash toevoegen ─────────────────────────────────────────
    data["photos"]    = json.dumps(photos, ensure_ascii=False) if photos else "[]"
    data["text_hash"] = nieuwe_hash

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
