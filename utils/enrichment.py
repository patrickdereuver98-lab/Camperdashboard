"""
utils/enrichment.py — AI-onderzoeker v4 met Intelligente Waterval Methode.
Pijler 2: Datakwaliteit & hygiëne voor VrijStaan.

Verbeteringen t.o.v. v3:
  - Expliciete provincie-normalisatie in ALLE prompts (officieel Nederlands)
  - Telefoonnummer-instructies in ALLE prompts (+31 formaat)
  - Python post-processing via batch_engine.normalize_province/normalize_phone
    als vangnet náást de AI-instructies
  - Deductie-regels uitgebreid: meer locatietypes gedekt
  - "Onbekend" reductie: threshold verlaagd naar 4 velden voor hersearch
  - Search Grounding drempel blijft 0.1 (agressief zoeken)
  - _hersearch geeft nu ook provincie + telefoon mee in instructies
  - Alle beschrijvingen: minimaal 2, maximaal 4 zinnen (was niet gehandhaafd)
"""
import json
import time
from urllib.parse import urlparse, quote_plus

import requests
from bs4 import BeautifulSoup
import pandas as pd

from utils.ai_helper import get_gemini_response, get_gemini_response_grounded


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
_TIMEOUT    = 12
_MAX_TEKST  = 12_000  # tekens per bron


# ── BRON 1: EIGEN WEBSITE ──────────────────────────────────────────────────────

def scrape_website(url: str) -> str:
    """Haalt tekst van de eigen website op. SSRF-beveiligd."""
    if not url or pd.isna(url):
        return ""
    url = str(url).strip()
    if str(url).lower() in ("nan", "onbekend", "none", ""):
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


# ── BRON 2: CAMPERCONTACT ──────────────────────────────────────────────────────

def scrape_campercontact(naam: str, provincie: str) -> str:
    """Zoekt de locatie op Campercontact.com — grootste NL camper-database."""
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
    """Zoekt de locatie op Park4Night — populaire camper review-site."""
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


# ── BRON 4: ANWB KAMPEREN ─────────────────────────────────────────────────────

def scrape_anwb(naam: str) -> str:
    """Zoekt op ANWB Kamperen — betrouwbare Nederlandse bron."""
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
    """Extraheer schone tekst uit HTML, zonder navs/footers/scripts."""
    soup = BeautifulSoup(html, "html.parser")
    for tag in soup(["script", "style", "nav", "footer", "header",
                     "aside", "noscript", "iframe", "form"]):
        tag.extract()
    tekst = " ".join(soup.get_text(separator=" ", strip=True).split())
    return tekst


# ── LOCATIETYPE DETECTOR ───────────────────────────────────────────────────────

def _detect_type(naam: str, tags: dict | None = None) -> str:
    """Detecteert het locatietype op basis van naam voor deductie-hints."""
    naam_l = naam.lower()
    if any(w in naam_l for w in ["parking", "parkeer", "p+r", "p &", "p-r"]):
        return "parking"
    if any(w in naam_l for w in ["jachthaven", "marina", "haven", "harbour"]):
        return "jachthaven"
    if any(w in naam_l for w in ["boerderij", "farm", "hoeve", "agrarisch"]):
        return "boerderij"
    if any(w in naam_l for w in ["camping", "kampeer", "vakantiepark", "resort", "bungalowpark"]):
        return "camping"
    if any(w in naam_l for w in ["camper", "motorhome", "camperplaats", "camperpark", "camperterrein"]):
        return "camperplaats"
    if any(w in naam_l for w in ["strand", "beach", "kust", "zee"]):
        return "strandlocatie"
    if any(w in naam_l for w in ["wijnaard", "winery", "wijngaard", "wijngoed"]):
        return "wijnaard"
    return "onbekend"


# ── DATAHYGIËNE HELPERS ────────────────────────────────────────────────────────

def _apply_python_hygiene(data: dict, naam: str) -> dict:
    """
    Python-level vangnet voor datahygiëne, ONGEACHT wat de AI returneerde.
    Roept normalize_province() en normalize_phone() aan uit batch_engine.
    Werkt ook als enrichment standalone wordt gebruikt (buiten batch_engine).
    """
    try:
        from utils.batch_engine import normalize_province, normalize_phone
        if "provincie" in data:
            data["provincie"] = normalize_province(str(data.get("provincie", "")))
        if "telefoonnummer" in data:
            data["telefoonnummer"] = normalize_phone(str(data.get("telefoonnummer", "")))
    except ImportError:
        pass  # batch_engine niet beschikbaar — prompt-instructies zijn het vangnet

    # Logische consistentie
    if data.get("stroom", "").lower() == "nee":
        data["stroom_prijs"] = "Nee (geen stroom)"

    # extra-veld altijd als string
    if isinstance(data.get("extra"), list):
        data["extra"] = ", ".join(str(v) for v in data["extra"])
    elif not data.get("extra"):
        data["extra"] = ""

    return data


# ── PROVINCIE + TELEFOON INSTRUCTIES (gedeeld door alle prompts) ───────────────

_PROVINCIE_INSTRUCTIE = """
PROVINCIE-INSTRUCTIE (VERPLICHT):
Gebruik ALTIJD de officiële Nederlandse spelling:
  Fryslân / Frisian / Fryslan  → "Friesland"
  North Holland / Noord Holland → "Noord-Holland"
  South Holland / Zuid Holland  → "Zuid-Holland"
  North Brabant / Noord Brabant → "Noord-Brabant"
  Guelders / Guelderland        → "Gelderland"
  Zealand                       → "Zeeland"
Geldige provincies: Groningen, Friesland, Drenthe, Overijssel, Flevoland,
  Gelderland, Utrecht, Noord-Holland, Zuid-Holland, Zeeland, Noord-Brabant, Limburg
"""

_TELEFOON_INSTRUCTIE = """
TELEFOONNUMMER-INSTRUCTIE (VERPLICHT):
Formaat: +31 X XXXX XXXX (mobiel) of +31 XX XXX XXXX (vast)
  0612345678   → "+31 6 1234 5678"
  0512345678   → "+31 512 34 5678"
  020-1234567  → "+31 20 123 4567"
  0031512...   → "+31 512 ..."
Als telefoonnummer onbekend is: exact "Onbekend" (geen lege string, geen streepje)
"""


# ── DEDUCTIE REGELS PER LOCATIETYPE ───────────────────────────────────────────

def _get_deductie_hints(loc_type: str) -> str:
    """
    Geeft specifieke deductie-hints per locatietype.
    Dit is de kernlogica die 'Onbekend' terugdringt naar < 4 velden per locatie.
    """
    hints = {
        "parking": """
- PARKEERPLAATS: tenzij expliciet vermeld in bronnen:
  stroom=Nee, sanitair=Nee, wifi=Nee, chemisch_toilet=Nee, water_tanken=Nee, afvalwater=Nee
- Honden: bijna altijd toegestaan op openbare parkeerplaatsen → standaard Ja
- Rust: stad of drukke weg → Druk, buiten bebouwde kom → Rustig
- Prijs: vaak Gratis of parkeertarief (pas dan "Betaald")
- Ondergrond: vrijwel altijd Asfalt of Verhard""",

        "jachthaven": """
- JACHTHAVEN: bijna altijd aanwezig:
  water_tanken=Ja, afvalwater=Ja, sanitair=Ja, stroom=Ja
- Wifi: in moderne jachthavens (post-2015) steeds gebruikelijker → zoek actief
- Honden: wisselend, zoek expliciet in bronnen
- Ondergrond: vrijwel altijd Asfalt of Verhard
- Rust: varieert — actieve jachthaven = Druk, rustig meer = Rustig""",

        "boerderij": """
- BOERDERIJ-CAMPERPLAATS:
  Ondergrond: bijna altijd Gras
  Rust: vrijwel altijd Rustig (landelijk)
  Wifi: zelden aanwezig → Nee tenzij bewijs
- Honden: VRAAG EXPLICIET — vaak Nee vanwege vee (check bronnen!)
- Stroom: wisselend — check bronnen, anders Onbekend
- Sanitair: wisselend — check bronnen""",

        "camping": """
- CAMPING: bijna altijd aanwezig:
  sanitair=Ja, water_tanken=Ja
- Stroom: bij elektra-haak Ja, anders Nee
- Wifi: bij moderne campings (post-2018) steeds vaker → check bronnen
- Honden: meestal toegestaan mits aangelijnd — zoek campingregels
- Ondergrond: Gras, Grind of Gemengd (afhankelijk van camping)""",

        "camperplaats": """
- DEDICATED CAMPERPLAATS: bijna altijd aanwezig:
  water_tanken=Ja, afvalwater=Ja
- Stroom: bij zuil aanwezig Ja, anders check bronnen
- Sanitair: wisselend per locatie
- Honden: over het algemeen welkom → Ja tenzij verbod vermeld
- Wifi: bij moderne camperterreinen (post-2019) steeds vaker aanwezig""",

        "strandlocatie": """
- STRANDLOCATIE:
  Rust: seizoensafhankelijk — zomer Druk, buiten seizoen Rustig
  Ondergrond: Zand of Verhard (parkeerterrein bij strand)
  Stroom: zelden aanwezig → Nee tenzij bewijs
- Honden: op veel stranden seizoensgebonden verbod — check bronnen
- Sanitair: openbare toiletten soms beschikbaar → check bronnen""",

        "wijnaard": """
- WIJNAARD/WIJNGOED:
  Rust: bijna altijd Rustig (landelijk)
  Ondergrond: Gras of Grind
  Honden: wisselend — check bronnen
- Stroom: soms aanwezig als service → check bronnen
- Wifi: zelden → Nee tenzij bewijs""",

        "onbekend": """
- Gebruik de locatienaam en context om het type te raden
- Bij twijfel: vergelijk met vergelijkbare locaties in dezelfde regio
- Gebruik Google Search Grounding MAXIMAAL voor elk onbekend veld
- Liever "Nee" (logische deductie) dan "Onbekend" (niet gezocht)""",
    }
    return hints.get(loc_type, hints["onbekend"])


# ── KWALITEITSCHECK ────────────────────────────────────────────────────────────

def _count_onbekend(data: dict) -> int:
    """Telt het aantal velden met waarde 'Onbekend'."""
    return sum(
        1 for v in data.values()
        if isinstance(v, str) and v.strip().lower() == "onbekend"
    )


# ── HERSEARCH BIJ TE VEEL ONBEKEND ────────────────────────────────────────────

def _hersearch(
    naam: str,
    provincie: str,
    website: str,
    huidige_data: dict,
    verbose: bool,
) -> dict:
    """
    Tweede AI-aanroep specifiek voor het invullen van lege velden.
    Drempel verlaagd naar 4 (was 6) voor betere datakwaliteit.
    Bevat ook provincie + telefoon instructies.
    """
    onbekende_keys = [
        k for k, v in huidige_data.items()
        if isinstance(v, str) and v.strip().lower() == "onbekend"
    ]

    prompt_hersearch = f"""
Je hebt zojuist data verzameld over camperplaats '{naam}' in {provincie}.
De volgende velden zijn nog ONBEKEND en moeten worden ingevuld:
{', '.join(onbekende_keys)}

GEBRUIK GOOGLE SEARCH GROUNDING om SPECIFIEK te zoeken naar:
1. "{naam} camperplaats {provincie}" → Campercontact, Park4Night, Google Maps
2. "{naam} camping {provincie} faciliteiten" → ANWB, NKC
3. "{naam} {provincie} reviews ervaringen" → TripAdvisor, Google Reviews

Huidige (onvolledige) data:
{json.dumps(huidige_data, ensure_ascii=False, indent=2)}

{_PROVINCIE_INSTRUCTIE}

{_TELEFOON_INSTRUCTIE}

INSTRUCTIE:
- Vervang alle "Onbekend" waarden die je kunt achterhalen met echte data
- Gebruik "Nee" als een faciliteit er logischerwijs NIET is
- Gebruik "Onbekend" ALLEEN als je het echt niet kunt bepalen na intensief zoeken
- Retourneer UITSLUITEND het volledige, verbeterde JSON-object zonder uitleg:
"""

    response  = get_gemini_response_grounded(prompt_hersearch)
    verbeterd = _parse_json(response)

    if verbeterd:
        for key, val in verbeterd.items():
            if key in huidige_data:
                orig = str(huidige_data[key]).strip().lower()
                if orig == "onbekend" and str(val).strip().lower() != "onbekend":
                    huidige_data[key] = val
        if verbose:
            nieuw_onbekend = _count_onbekend(huidige_data)
            _ui_write(f"   └─ ✅ Hersearch: van {len(onbekende_keys)} → {nieuw_onbekend} onbekende velden")

    return huidige_data


# ── HOOFD: LOCATIE ONDERZOEK ───────────────────────────────────────────────────

def research_location(row, verbose: bool = True) -> dict | None:
    """
    Onderzoekt één locatierij via Waterval Methode v4.

    Verbeteringen t.o.v. v3:
    - Provincie + telefoon instructies in hoofd-prompt
    - Python-level hygiëne als vangnet na JSON parse
    - Hersearch drempel: 4 velden (was 6)
    - Locatietype strandlocatie + wijnaard toegevoegd
    - Beschrijving: hard 2-4 zinnen afgedwongen in prompt
    """
    naam      = str(row.get("naam",      "Onbekende locatie")).strip()
    provincie = str(row.get("provincie", "Nederland")).strip()
    website   = str(row.get("website",   "")).strip()
    loc_type  = _detect_type(naam)

    if verbose:
        _ui_write(f"🔍 Onderzoek: **{naam}** ({provincie}) · type: {loc_type}")

    # ── Bronnen scrapen ─────────────────────────────────────────────────
    bronnen: list[str] = []

    if verbose:
        _ui_write("   └─ 🌐 Eigen website ophalen…")
    website_tekst = scrape_website(website)
    if website_tekst:
        bronnen.append(f"[Eigen website]\n{website_tekst[:_MAX_TEKST]}")
    else:
        if verbose:
            _ui_warn("   └─ ⚠️ Geen eigen website of niet bereikbaar")

    if verbose:
        _ui_write("   └─ 📡 Campercontact zoeken…")
    cc_tekst = scrape_campercontact(naam, provincie)
    if cc_tekst:
        bronnen.append(cc_tekst)
        if verbose:
            _ui_write("   └─ ✅ Campercontact-data gevonden")
    else:
        if verbose:
            _ui_write("   └─ ⬜ Niet gevonden op Campercontact")

    time.sleep(0.5)  # Rate-limiting Park4Night
    p4n_tekst = scrape_park4night(naam, provincie)
    if p4n_tekst:
        bronnen.append(p4n_tekst)
        if verbose:
            _ui_write("   └─ ✅ Park4Night-data gevonden")

    anwb_tekst = scrape_anwb(naam)
    if anwb_tekst:
        bronnen.append(anwb_tekst)
        if verbose:
            _ui_write("   └─ ✅ ANWB-data gevonden")

    alle_bronnen    = "\n\n".join(bronnen) if bronnen else "Geen webinhoud beschikbaar."
    deductie_hints  = _get_deductie_hints(loc_type)

    # ── Hoofd-verrijking prompt ─────────────────────────────────────────
    prompt_hoofd = f"""
Je bent een expert data-analist voor de Nederlandse camperplatform VrijStaan.
Vul een volledig, accuraat profiel in voor camperplaats '{naam}' in {provincie}.

══════════════════════════════════════════
WEBSITEINHOUD (uit {len(bronnen)} bronnen):
══════════════════════════════════════════
{alle_bronnen[:25_000]}

══════════════════════════════════════════
INSTRUCTIES — lees dit ZORGVULDIG
══════════════════════════════════════════

REGEL 1 — JA / NEE / ONBEKEND:
  - "Ja"      → faciliteit aanwezig (bewijs in bronnen OF logische deductie)
  - "Nee"     → faciliteit NIET aanwezig (bewijs OF locatietype)
  - "Onbekend" → ALLEEN als je na bronnen + deductie + kennisbase echt niets weet

REGEL 2 — DEDUCTIE VOOR TYPE '{loc_type.upper()}':
{deductie_hints}

REGEL 3 — GEBRUIK ALTIJD SEARCH GROUNDING:
Als bronnen onvolledig zijn, gebruik dan je Google Search kennis om:
- Campercontact.com/nl/{naam.lower().replace(' ', '-')} te raadplegen
- Park4night.com reviews te raadplegen
- NKC.nl, ANWB kamperen, Google Maps reviews te raadplegen

{_PROVINCIE_INSTRUCTIE}

{_TELEFOON_INSTRUCTIE}

REGEL 7 — BESCHRIJVING (VERPLICHT 2-4 ZINNEN):
Schrijf minimaal 2 en maximaal 4 sfeervolle zinnen. Beschrijf de omgeving,
het gevoel, de sfeer en de doelgroep. Geen opsomming, lopende tekst.
Voorbeeld: "Rustig gelegen aan de rand van het bos bij Dwingeloo. Ideaal voor wie
natuur zoekt: wandelpaden beginnen direct achter de camping. De plaatsen zijn
ruim opgezet op gras, perfect voor camperaars die even willen ontsnappen."

REGEL 8 — REVIEWS (20-40 WOORDEN):
Doorlopende zin, toon: "Gasten zijn enthousiast over..." of "Bezoekers waarderen..."
NOOIT steekwoorden, NOOIT lijsten.

REGEL 9 — BEOORDELING:
Cijfer 1.0–5.0 op basis van gevonden reviews. Bijv. 4.2, 3.8. Niet heel getal.
Als er echt geen reviews zijn: "Onbekend"

══════════════════════════════════════════
Retourneer UITSLUITEND geldig JSON, geen uitleg, geen markdown:
══════════════════════════════════════════
{{
    "prijs": "€X per nacht of €X-Y per nacht of Gratis of Onbekend",
    "provincie": "officiële NL-provincienaam",
    "honden_toegestaan": "Ja/Nee/Onbekend",
    "stroom": "Ja/Nee/Onbekend",
    "stroom_prijs": "€X/nacht of Inbegrepen of Nee (geen stroom) of Onbekend",
    "afvalwater": "Ja/Nee/Onbekend",
    "chemisch_toilet": "Ja/Nee/Onbekend",
    "water_tanken": "Ja/Nee/Onbekend",
    "aantal_plekken": "getal bijv. 40 of Onbekend",
    "check_in_out": "bijv. 14:00 / 12:00 of Vrij of Onbekend",
    "website": "{website}",
    "beschrijving": "minimaal 2, maximaal 4 sfeervolle zinnen",
    "ondergrond": "Gras / Asfalt / Grind / Verhard / Gemengd / Onbekend",
    "toegankelijkheid": "Ja/Nee/Onbekend",
    "rust": "Rustig / Gemiddeld / Druk / Onbekend",
    "sanitair": "Ja/Nee/Onbekend",
    "wifi": "Ja/Nee/Onbekend",
    "beoordeling": "bijv. 4.3 of Onbekend",
    "samenvatting_reviews": "doorlopende zin 20-40 woorden Gasten-stijl of Onbekend",
    "telefoonnummer": "+31 X XXXX XXXX of Onbekend",
    "extra": []
}}
"""

    response_text = get_gemini_response_grounded(prompt_hoofd)

    if verbose:
        _ui_expander(f"⚙️ Ruwe AI output — {naam}", response_text)

    # ── JSON parsen ─────────────────────────────────────────────────────
    data = _parse_json(response_text)
    if data is None:
        if verbose:
            _ui_error(f"❌ JSON-parse mislukt voor {naam}")
        return None

    # ── Python-level datahygiëne (vangnet) ─────────────────────────────
    data = _apply_python_hygiene(data, naam)

    # ── Kwaliteitscheck & Heronderzoek (drempel: 4 onbekende velden) ───
    onbekend_velden = _count_onbekend(data)
    if onbekend_velden > 4:
        if verbose:
            _ui_warn(f"⚠️ {onbekend_velden} velden onbekend → hersearch gestart…")
        data = _hersearch(naam, provincie, website, data, verbose)
        # Hygiëne nogmaals na hersearch
        data = _apply_python_hygiene(data, naam)

    return data


# ── JSON PARSER ────────────────────────────────────────────────────────────────

def _parse_json(text: str) -> dict | None:
    """Robuust JSON parsen uit AI response — tolereert markdown fences."""
    if not text:
        return None
    try:
        clean = text.strip()
        if clean.startswith("```"):
            clean = "\n".join(clean.split("\n")[1:])
        if clean.endswith("```"):
            clean = "\n".join(clean.split("\n")[:-1])
        clean = clean.strip()

        start = clean.find("{")
        end   = clean.rfind("}") + 1
        if start == -1 or end == 0:
            return None
        return json.loads(clean[start:end])
    except (json.JSONDecodeError, Exception):
        return None


# ── UI HELPERS ─────────────────────────────────────────────────────────────────

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
            st.text(str(content)[:4000])
    except Exception:
        pass
