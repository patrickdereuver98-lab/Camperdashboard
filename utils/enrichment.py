"""
utils/enrichment.py — VrijStaan v5.1 Stealth Scraper & Agentic AI Researcher.

Verbeteringen t.o.v. v5.0:
  - cloudscraper vervangt requests: imiteert Windows Chrome desktop om
    Cloudflare / Datadome 503-blokkades te bypassen.
  - MD5 hash-check: als website niet veranderd EN genoeg tekst → sla AI over.
  - Agentic fallback: <250 tekens tekst of >4 onbekend → Google Search Grounding.
  - Uitgebreide foto-scraping: maximaal 5 relevante foto-URL's per locatie.
  - Agressievere Gemini-prompt met expliciete deductie-regels.
  - Veilige SSRF-check op alle URL's.

Vereist: pip install cloudscraper
"""
from __future__ import annotations

import hashlib
import json
import re
import time
from pathlib import Path
from urllib.parse import urlparse, quote_plus, urljoin

import pandas as pd
from bs4 import BeautifulSoup

try:
    import cloudscraper
    _CLOUDSCRAPER_AVAILABLE = True
except ImportError:
    import requests as _requests_fallback  # type: ignore[no-redef]
    _CLOUDSCRAPER_AVAILABLE = False

from utils.ai_helper import (
    get_gemini_response_grounded,
    parse_json_response,
    run_agentic_fallback,
    MIN_SCRAPE_CHARS,
)

try:
    from utils.logger import logger
except ImportError:
    import logging
    logger = logging.getLogger("vrijstaan.enrichment")

# ── CONFIGURATIE ───────────────────────────────────────────────────────────────
_TIMEOUT   = 18        # Seconden per HTTP-verzoek
_MAX_TEKST = 10_000    # Tekens per bron die we meenemen in de AI-prompt
_MAX_PHOTOS = 5        # Maximaal aantal foto-URL's per locatie
_IMG_EXTS   = {".jpg", ".jpeg", ".png", ".webp"}

# MD5 hash-cache voor "website ongewijzigd" check
_HASH_CACHE_PATH = Path("data/url_hash_cache.json")


# ── CLOUDSCRAPER FACTORY ──────────────────────────────────────────────────────

def _make_scraper():
    """
    Maakt een cloudscraper-sessie die een Windows Chrome-browser imiteert.
    Valt terug op een gewone requests.Session als cloudscraper niet is
    geïnstalleerd (met een duidelijke waarschuwing).
    """
    if _CLOUDSCRAPER_AVAILABLE:
        scraper = cloudscraper.create_scraper(
            browser={
                "browser": "chrome",
                "platform": "windows",
                "desktop":  True,
            }
        )
        scraper.headers.update({
            "Accept-Language": "nl-NL,nl;q=0.9,en-US;q=0.8",
            "Accept":          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "DNT":             "1",
        })
        return scraper
    else:
        logger.warning(
            "cloudscraper NIET geïnstalleerd — valt terug op requests. "
            "Voeg 'cloudscraper>=1.2.71' toe aan requirements.txt!"
        )
        import requests
        session = requests.Session()
        session.headers.update({
            "User-Agent": (
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/124.0.0.0 Safari/537.36"
            ),
            "Accept-Language": "nl-NL,nl;q=0.9,en-US;q=0.8",
        })
        return session


# ── SSRF BEVEILIGING ──────────────────────────────────────────────────────────

def _is_safe_url(url: str) -> bool:
    """
    Eenvoudige SSRF-check: weiger interne IP's en ongeldige schema's.
    """
    try:
        p = urlparse(url)
        if p.scheme not in ("http", "https"):
            return False
        if not p.netloc:
            return False
        # Weiger localhost, private ranges
        host = p.hostname or ""
        if host in ("localhost", "127.0.0.1", "0.0.0.0", "::1"):
            return False
        if re.match(r"^(10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.)", host):
            return False
        return True
    except Exception:
        return False


def _normalise_url(raw: str) -> str | None:
    """Normaliseert en valideert een URL-string. Geeft None bij ongeldig."""
    if not raw or not isinstance(raw, str):
        return None
    url = raw.strip()
    if url.lower() in ("nan", "onbekend", "none", ""):
        return None
    if not url.startswith(("http://", "https://")):
        url = "https://" + url
    return url if _is_safe_url(url) else None


# ── MD5 HASH CACHE ────────────────────────────────────────────────────────────

def _load_hash_cache() -> dict[str, str]:
    if _HASH_CACHE_PATH.exists():
        try:
            return json.loads(_HASH_CACHE_PATH.read_text(encoding="utf-8"))
        except Exception:
            pass
    return {}


def _save_hash_cache(cache: dict[str, str]) -> None:
    _HASH_CACHE_PATH.parent.mkdir(parents=True, exist_ok=True)
    _HASH_CACHE_PATH.write_text(
        json.dumps(cache, ensure_ascii=False), encoding="utf-8"
    )


def website_changed(url: str, current_text: str) -> bool:
    """
    MD5 hash-check: vergelijk huidige websitetekst met gecachede hash.
    True  = website veranderd of nieuw → AI-verwerking nodig.
    False = website identiek aan vorige run → sla AI over.
    """
    if not url or not current_text:
        return True
    cache    = _load_hash_cache()
    new_hash = hashlib.md5(current_text[:5000].encode("utf-8")).hexdigest()
    old_hash = cache.get(url, "")
    if old_hash == new_hash:
        return False  # Identiek — skip AI
    cache[url] = new_hash
    _save_hash_cache(cache)
    return True  # Veranderd — verwerk met AI


# ── TEKST EXTRACTOR ────────────────────────────────────────────────────────────

def _extract_text_and_photos(
    html: str, base_url: str = ""
) -> tuple[str, list[str]]:
    """
    Extraheert schone tekst én maximaal _MAX_PHOTOS relevante foto-URL's
    uit HTML. Verwijdert nav, footer, scripts, advertenties.

    Returns:
        (tekst: str, photos: list[str])
    """
    soup = BeautifulSoup(html, "html.parser")

    # Verwijder ruis
    for tag in soup(
        ["script", "style", "nav", "footer", "header",
         "aside", "noscript", "iframe", "form", "advertisement",
         "cookie-banner", "gdpr-notice"]
    ):
        tag.extract()

    # Tekst extraheren
    tekst = " ".join(soup.get_text(separator=" ", strip=True).split())

    # Foto's extraheren
    photos: list[str] = []
    seen:   set[str]  = set()
    parsed_base = urlparse(base_url)
    origin = f"{parsed_base.scheme}://{parsed_base.netloc}" if base_url else ""

    def _add_photo(src: str) -> None:
        if not src or len(photos) >= _MAX_PHOTOS:
            return
        # Absoluut maken
        if src.startswith("//"):
            src = "https:" + src
        elif src.startswith("/") and origin:
            src = origin + src
        elif not src.startswith("http") and base_url:
            src = urljoin(base_url, src)
        # Filter out data-URIs, SVGs, icons
        sl = src.lower()
        if any(bad in sl for bad in ("data:", ".svg", "logo", "icon", "sprite", "blank", "pixel")):
            return
        # Alleen jpg/png/webp/jpeg
        ext_match = re.search(r"\.(jpe?g|png|webp)(\?|$)", sl)
        if not ext_match:
            return
        if src not in seen:
            seen.add(src)
            photos.append(src)

    # 1. OpenGraph image (meest betrouwbaar)
    for og in soup.find_all("meta", property="og:image"):
        _add_photo(og.get("content", ""))

    # 2. JSON-LD afbeeldingen
    for script in soup.find_all("script", type="application/ld+json"):
        try:
            data = json.loads(script.string or "")
            imgs = data.get("image", [])
            if isinstance(imgs, str):
                _add_photo(imgs)
            elif isinstance(imgs, list):
                for item in imgs[:3]:
                    _add_photo(item if isinstance(item, str) else item.get("url", ""))
        except Exception:
            pass

    # 3. Grote <img> tags (breedte ≥ 200px of srcset aanwezig)
    for img in soup.find_all("img"):
        if len(photos) >= _MAX_PHOTOS:
            break
        src = (
            img.get("src") or img.get("data-src") or
            img.get("data-lazy-src") or img.get("data-original") or ""
        )
        if not src:
            continue
        # Check grootte-indicatie
        try:
            w = int(img.get("width", 0) or 0)
            h = int(img.get("height", 0) or 0)
            if w >= 200 or h >= 150:
                _add_photo(src)
                continue
        except (ValueError, TypeError):
            pass
        # Check srcset
        srcset = img.get("srcset", "")
        if srcset:
            parts = [p.strip().split(" ")[0] for p in srcset.split(",") if p.strip()]
            if parts:
                _add_photo(parts[-1])
                continue
        # Fallback: als src de juiste extensie heeft
        _add_photo(src)

    return tekst, photos[:_MAX_PHOTOS]


# ── STEALTH SCRAPER ────────────────────────────────────────────────────────────

def scrape_website(url_raw: str) -> tuple[str, list[str]]:
    """
    Scrapet een website met cloudscraper (Cloudflare/Datadome bypass).
    Retourneert (tekst, foto_urls).
    """
    url = _normalise_url(url_raw)
    if not url:
        return "", []
    try:
        scraper = _make_scraper()
        resp    = scraper.get(url, timeout=_TIMEOUT)
        resp.raise_for_status()
        tekst, photos = _extract_text_and_photos(resp.text, base_url=url)
        return tekst[:_MAX_TEKST], photos
    except Exception as e:
        logger.debug(f"Scrape mislukt [{url[:60]}]: {e}")
        return "", []


def scrape_photos(url_raw: str, max_photos: int = _MAX_PHOTOS) -> list[str]:
    """
    Convenience wrapper: scrapet alleen foto's (gebruikt door batch_engine).
    """
    _, photos = scrape_website(url_raw)
    return photos[:max_photos]


# ── EXTERNE BRONNEN ────────────────────────────────────────────────────────────

def scrape_campercontact(naam: str, provincie: str) -> str:
    """Zoekt op Campercontact.com via cloudscraper."""
    zoekterm = f"{naam} {provincie}".strip()
    url      = f"https://www.campercontact.com/nl/zoeken?q={quote_plus(zoekterm)}"
    try:
        scraper = _make_scraper()
        resp    = scraper.get(url, timeout=_TIMEOUT)
        resp.raise_for_status()
        tekst, _ = _extract_text_and_photos(resp.text)
        if naam.lower()[:8] in tekst.lower() and len(tekst) > 100:
            return f"[Campercontact] {tekst[:_MAX_TEKST]}"
        return ""
    except Exception as e:
        logger.debug(f"Campercontact scrape fout: {e}")
        return ""


def scrape_park4night(naam: str, provincie: str) -> str:
    """Zoekt op Park4Night via cloudscraper."""
    url = f"https://park4night.com/fr/search?q={quote_plus(naam + ' Nederland')}"
    try:
        scraper = _make_scraper()
        resp    = scraper.get(url, timeout=_TIMEOUT)
        resp.raise_for_status()
        tekst, _ = _extract_text_and_photos(resp.text)
        if len(tekst) > 150:
            return f"[Park4Night] {tekst[:_MAX_TEKST]}"
        return ""
    except Exception as e:
        logger.debug(f"Park4Night scrape fout: {e}")
        return ""


def scrape_anwb(naam: str) -> str:
    """Zoekt op ANWB Kamperen via cloudscraper."""
    url = f"https://www.anwb.nl/kamperen/search?q={quote_plus(naam + ' camperplaats')}"
    try:
        scraper = _make_scraper()
        resp    = scraper.get(url, timeout=10)
        resp.raise_for_status()
        tekst, _ = _extract_text_and_photos(resp.text)
        return f"[ANWB] {tekst[:6_000]}" if len(tekst) > 200 else ""
    except Exception as e:
        logger.debug(f"ANWB scrape fout: {e}")
        return ""


# ── LOCATIETYPE DETECTOR ───────────────────────────────────────────────────────

def _detect_type(naam: str) -> str:
    n = naam.lower()
    if any(w in n for w in ["parking", "parkeer", "p+r", "p-r"]):
        return "parking"
    if any(w in n for w in ["jachthaven", "marina", "haven"]):
        return "jachthaven"
    if any(w in n for w in ["boerderij", "farm", "hoeve"]):
        return "boerderij"
    if any(w in n for w in ["camping", "kampeer", "vakantiepark"]):
        return "camping"
    return "camperplaats"


# ── PROVINCIE NORMALISATIE (inline) ───────────────────────────────────────────

_PROV_MAP = {
    "fryslân": "Friesland",        "fryslan":       "Friesland",
    "frisian": "Friesland",        "north holland":  "Noord-Holland",
    "north-holland": "Noord-Holland","south holland": "Zuid-Holland",
    "south-holland": "Zuid-Holland","north brabant":  "Noord-Brabant",
    "north-brabant": "Noord-Brabant","guelders":      "Gelderland",
    "zealand": "Zeeland",          "zeeland":        "Zeeland",
}

def _norm_province(raw: str) -> str:
    s = str(raw).strip()
    if s.lower() in ("onbekend", "nan", "none", "", "-"):
        return "Onbekend"
    return _PROV_MAP.get(s.lower(), s)


# ── AGRESSIEVE AI ENRICHMENT PROMPT ──────────────────────────────────────────

def _build_enrichment_prompt(
    naam: str,
    provincie: str,
    website: str,
    alle_bronnen: str,
    loc_type: str,
) -> str:
    """
    Bouwt de agressieve AI-prompt met expliciete deductie-regels,
    camper-specifieke velden (drukte, voertuig, remote work) en
    strikte output-eisen.
    """
    return f"""
Je bent expert data-analist voor VrijStaan (NL camperplatform).
Geef een VOLLEDIG en ACCURAAT profiel voor '{naam}' in {provincie}.
Locatietype: {loc_type}

BRONINHOUD ({len(alle_bronnen)} tekens):
{alle_bronnen[:20_000]}

══════ VERPLICHTE DEDUCTIE-REGELS (PAS TOE VOORDAT JE "Onbekend" SCHRIJFT) ══════
• "parking" / "parkeer" in naam → stroom=Nee, sanitair=Nee (tenzij bewijs)
• "jachthaven" / "marina" → water_tanken=Ja, afvalwater=Ja, sanitair=Ja
• "camping" / "vakantiepark" → sanitair=Ja, water_tanken=Ja
• "boerderij" / "hoeve" → ondergrond=Gras, rust=Rustig
• Reviews: "muntjes", "douchemunten", "betalen voor douche" → sanitair=Ja
• "24u/7d", "altijd open", "geen slagboom" → check_in_out="Vrij, geen tijden"
• Stroom-aansluitingen/zuilen beschreven → stroom=Ja
• Honden welkom in naam of beschrijving → honden_toegestaan=Ja
• Geen sanitair beschreven + parkeerplaats → sanitair=Nee
• Geen wifi beschreven + camping in bos/buiten → wifi=Nee (tenzij vermeld)
• Gebruik "Nee" als logische deductie aangeeft dat faciliteit afwezig is
• Gebruik "Onbekend" ALLEEN als na alle bronnen + deductie niets te vinden is

══════ PROVINCIE ══════
Gebruik ALTIJD de officiële NL spelling:
Fryslân → Friesland | North Holland → Noord-Holland | South Holland → Zuid-Holland
North Brabant → Noord-Brabant | Guelders → Gelderland | Zealand → Zeeland

══════ TELEFOONNUMMER ══════
Formaat: +31 X XXXX XXXX (mobiel) of +31 XX XXX XXXX (vast)
0612345678 → "+31 6 1234 5678" | Onbekend → exact "Onbekend"

══════ BESCHRIJVING ══════
2-4 sfeervolle zinnen over omgeving, gevoel, doelgroep. Geen opsomming.

══════ REVIEWS SAMENVATTING ══════
Doorlopende zin 20-40 woorden. Toon: "Gasten waarderen..." of "Bezoekers zijn enthousiast..."
NOOIT steekwoorden of lijsten.

══════ CAMPER-SPECIFIEKE VELDEN ══════
drukte_indicator: "Snel vol in het seizoen" / "Vaak plek beschikbaar" /
  "Druk in zomer, rustig buiten seizoen" / "Onbekend"
max_lengte: bijv. "8m" / "12m" / "Geen beperking" / "Onbekend"
max_gewicht: bijv. "3.5t" / "10t" / "Geen beperking" / "Onbekend"
remote_work_score: "Uitstekend (5G beschikbaar)" / "Goed (4G LTE)" /
  "Matig (2G/3G)" / "Slecht" / "Onbekend"

Retourneer UITSLUITEND een geldig JSON-object. Geen uitleg, geen markdown:
{{
  "prijs":               "€X per nacht of Gratis of Onbekend",
  "provincie":           "officiële NL-provincienaam",
  "honden_toegestaan":   "Ja/Nee/Onbekend",
  "stroom":              "Ja/Nee/Onbekend",
  "stroom_prijs":        "€X/nacht of Inbegrepen of Nee (geen stroom) of Onbekend",
  "afvalwater":          "Ja/Nee/Onbekend",
  "chemisch_toilet":     "Ja/Nee/Onbekend",
  "water_tanken":        "Ja/Nee/Onbekend",
  "aantal_plekken":      "getal of Onbekend",
  "check_in_out":        "tijden of Vrij of Onbekend",
  "beschrijving":        "2-4 sfeervolle zinnen",
  "ondergrond":          "Gras/Asfalt/Grind/Verhard/Gemengd/Onbekend",
  "toegankelijkheid":    "Ja/Nee/Onbekend",
  "rust":                "Rustig/Gemiddeld/Druk/Onbekend",
  "sanitair":            "Ja/Nee/Onbekend",
  "wifi":                "Ja/Nee/Onbekend",
  "waterfront":          "Ja/Nee/Onbekend",
  "beoordeling":         "bijv. 4.3 of Onbekend",
  "samenvatting_reviews":"Gasten-zin 20-40 woorden of Onbekend",
  "reviews_tekst":       "uitgebreide review-tekst of Onbekend",
  "telefoonnummer":      "+31 X XXXX XXXX of Onbekend",
  "roken":               "Ja/Nee/Onbekend",
  "feesten":             "Ja/Nee/Onbekend",
  "stilteplicht":        "Ja/Nee/Onbekend",
  "faciliteiten_extra":  "CSV van extra faciliteiten of Onbekend",
  "huisregels":          "korte omschrijving of Onbekend",
  "loc_type":            "Camping/Camperplaats/Parking/Jachthaven/Boerderij",
  "drukte_indicator":    "omschrijving of Onbekend",
  "max_lengte":          "'8m' / '12m' / 'Geen beperking' / 'Onbekend'",
  "max_gewicht":         "'3.5t' / 'Geen beperking' / 'Onbekend'",
  "remote_work_score":   "kwaliteitsomschrijving of Onbekend",
  "voertuig_types":      "bijv. 'Campervan, Caravan' of Onbekend",
  "tarieftype":          "Per nacht/Per dag/Gratis/Onbekend",
  "ai_gecheckt":         "Ja"
}}
"""


# ── HELPERS ───────────────────────────────────────────────────────────────────

def _count_onbekend(data: dict) -> int:
    return sum(
        1 for v in data.values()
        if isinstance(v, str) and v.strip().lower() == "onbekend"
    )


def _apply_hygiene(data: dict) -> dict:
    """Province + telefoon normalisatie als Python-vangnet na AI-output."""
    if "provincie" in data:
        data["provincie"] = _norm_province(str(data.get("provincie", "")))
    if data.get("stroom", "").lower() == "nee":
        data["stroom_prijs"] = "Nee (geen stroom)"
    if isinstance(data.get("extra"), list):
        data["extra"] = ", ".join(str(v) for v in data["extra"])
    return data


# ── HOOFD: LOCATIE ONDERZOEK ───────────────────────────────────────────────────

def research_location(row: object, verbose: bool = True) -> dict | None:
    """
    Onderzoekt één locatierij via Stealth Scraper + Agentic AI v5.1:

    1. Stealth scraping met cloudscraper (Cloudflare/Datadome bypass)
    2. MD5 hash-check: websitetekst identiek? → sla AI over
    3. Multi-bron scraping (eigen site, Campercontact, Park4Night, ANWB)
    4. Agressieve AI-prompt met expliciete deductie-regels
    5. Agentic fallback: <250 tekens OF >4 onbekend → Google Search Grounding

    Returns: dict met verrijkte data, of None bij parse-fout.
    """
    naam      = str(row.get("naam",      "Onbekende locatie")).strip()  # type: ignore[union-attr]
    provincie = str(row.get("provincie", "Nederland")).strip()           # type: ignore[union-attr]
    website   = str(row.get("website",   "")).strip()                   # type: ignore[union-attr]
    loc_type  = _detect_type(naam)

    if verbose:
        _ui_write(f"🔍 Onderzoek: **{naam}** ({provincie}) · type: {loc_type}")

    # ── 1. Stealth scraping van eigen website + foto's ──────────────────────
    ws_tekst = ""
    photos:  list[str] = []
    if website:
        if verbose:
            _ui_write("   └─ 🕵️ Stealth scraping eigen website (cloudscraper)…")
        ws_tekst, photos = scrape_website(website)
        if verbose:
            status = f"✅ {len(ws_tekst)} tekens, {len(photos)} foto's"
            if len(ws_tekst) < MIN_SCRAPE_CHARS:
                status += " ⚠️ (te weinig — agentic fallback beschikbaar)"
            _ui_write(f"   └─ {status}")

    # ── 2. MD5 hash-check ──────────────────────────────────────────────────
    gecheckt = str(row.get("ai_gecheckt", "Nee")).lower()  # type: ignore[union-attr]
    if (
        ws_tekst
        and len(ws_tekst) >= MIN_SCRAPE_CHARS
        and not website_changed(website, ws_tekst)
        and gecheckt == "ja"
    ):
        if verbose:
            _ui_write("   └─ ⚡ Website ongewijzigd + al verrijkt → AI overgeslagen")
        return {"ai_gecheckt": "Ja", "_skip": True}

    # ── 3. Externe bronnen (met rate-limiting delay) ───────────────────────
    bronnen: list[str] = []
    if ws_tekst:
        bronnen.append(f"[Eigen website]\n{ws_tekst}")

    cc = scrape_campercontact(naam, provincie)
    if cc:
        bronnen.append(cc)
        if verbose:
            _ui_write("   └─ ✅ Campercontact gevonden")

    time.sleep(0.3)  # Kleine pauze voor Park4Night rate-limiting
    p4n = scrape_park4night(naam, provincie)
    if p4n:
        bronnen.append(p4n)
        if verbose:
            _ui_write("   └─ ✅ Park4Night gevonden")

    anwb = scrape_anwb(naam)
    if anwb:
        bronnen.append(anwb)

    alle_bronnen     = "\n\n".join(bronnen) if bronnen else "Geen webinhoud beschikbaar."
    total_tekst_len  = len(alle_bronnen)

    # ── 4. AI verrijking ────────────────────────────────────────────────────
    prompt    = _build_enrichment_prompt(naam, provincie, website, alle_bronnen, loc_type)
    raw_resp  = get_gemini_response_grounded(prompt)

    if verbose:
        _ui_expander(f"⚙️ Ruwe AI output — {naam}", raw_resp)

    data = parse_json_response(raw_resp)
    if data is None or not isinstance(data, dict):
        if verbose:
            _ui_error(f"❌ JSON-parse mislukt voor {naam}")
        return None

    # ── 5. Datahygiëne ─────────────────────────────────────────────────────
    data = _apply_hygiene(data)

    # ── 6. Agentic fallback (Pijler 2) ─────────────────────────────────────
    needs_fallback = (
        total_tekst_len < MIN_SCRAPE_CHARS          # Website geblokkeerd
        or _count_onbekend(data) > 4                # Te veel onbekend
    )
    if needs_fallback:
        if verbose:
            reason = (
                f"scrape te kort ({total_tekst_len}c)"
                if total_tekst_len < MIN_SCRAPE_CHARS
                else f"{_count_onbekend(data)} velden onbekend"
            )
            _ui_warn(f"⚠️ Agentic fallback geactiveerd ({reason})…")

        verbeterd = run_agentic_fallback(
            naam, provincie, data, total_tekst_len
        )
        if verbeterd and isinstance(verbeterd, dict):
            # Merge: overschrijf alleen de Onbekend-velden
            for key, val in verbeterd.items():
                if key in data:
                    old = str(data[key]).strip().lower()
                    new = str(val).strip()
                    if old == "onbekend" and new.lower() != "onbekend":
                        data[key] = val
                else:
                    data[key] = val
            data = _apply_hygiene(data)
            if verbose:
                remaining = _count_onbekend(data)
                _ui_write(f"   └─ ✅ Fallback klaar — {remaining} velden nog onbekend")

    # ── 7. Foto's toevoegen ─────────────────────────────────────────────────
    if photos:
        data["photos"] = json.dumps(photos, ensure_ascii=False)
    elif not data.get("photos"):
        data["photos"] = "[]"

    return data


# ── UI HELPERS (graceful no-op buiten Streamlit) ──────────────────────────────

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
