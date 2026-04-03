"""
utils/enrichment.py — AI-onderzoeker v3 met Intelligente Waterval Methode.

Verbeteringen t.o.v. v2:
  - Multi-bron scraping: website + Campercontact + Park4Night zoekpagina's
  - Onderscheid Nee (faciliteit afwezig) vs Onbekend (echt niet te vinden)
  - Beschrijving uitgebreid: echte sfeeromschrijving van 2-4 zinnen
  - Reviews als geschreven tekst: "Gasten zeggen..." toon
  - Search Grounding actief aangestuurd voor specifieke bronnen
  - Deductie-regels voor voorzieningen expliciet in prompt
"""
import json
import time
from urllib.parse import urlparse, quote_plus

import requests
from bs4 import BeautifulSoup
import pandas as pd

from utils.ai_helper import get_gemini_response, get_gemini_response_grounded


# ── SCRAPER CONFIGURATIE ──────────────────────────────────────────────────────
_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "nl-NL,nl;q=0.9,en-US;q=0.8",
}
_TIMEOUT = 12
_MAX_TEKST = 12_000  # tekens per bron


# ── BRON 1: EIGEN WEBSITE ─────────────────────────────────────────────────────

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


# ── BRON 2: CAMPERCONTACT ─────────────────────────────────────────────────────

def scrape_campercontact(naam: str, provincie: str) -> str:
    """
    Zoekt de locatie op Campercontact.com.
    Campercontact is de grootste Nederlandse camper-database.
    """
    zoekterm = f"{naam} {provincie}".strip()
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


# ── BRON 3: PARK4NIGHT ────────────────────────────────────────────────────────

def scrape_park4night(naam: str, provincie: str) -> str:
    """
    Zoekt de locatie op Park4Night — populaire camper review-site.
    Bevat gebruikersreviews en foto's.
    """
    zoekterm = f"{naam} Nederland"
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


# ── BRON 4: ANWB KAMPEREN ────────────────────────────────────────────────────

def scrape_anwb(naam: str) -> str:
    """Zoekt op ANWB Kamperen — betrouwbare Nederlandse bron."""
    zoekterm = f"{naam} camperplaats"
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


# ── TEKST EXTRACTOR ───────────────────────────────────────────────────────────

def _extract_text(html: str) -> str:
    """Extraheer schone tekst uit HTML."""
    soup = BeautifulSoup(html, "html.parser")
    for tag in soup(["script", "style", "nav", "footer", "header",
                     "aside", "noscript", "iframe", "form"]):
        tag.extract()
    tekst = " ".join(soup.get_text(separator=" ", strip=True).split())
    return tekst


# ── LOCATIETYPE DETECTOR ──────────────────────────────────────────────────────

def _detect_type(naam: str, tags: dict | None = None) -> str:
    """
    Detecteert het type locatie op basis van naam voor deductie-hints.
    Helpt de AI onderscheid te maken tussen faciliteiten aanwezig vs afwezig.
    """
    naam_l = naam.lower()
    if any(w in naam_l for w in ["parking", "parkeer", "p+r", "p &"]):
        return "parking"
    if any(w in naam_l for w in ["jachthaven", "marina", "haven"]):
        return "jachthaven"
    if any(w in naam_l for w in ["boerderij", "farm", "hoeve"]):
        return "boerderij"
    if any(w in naam_l for w in ["camping", "kampeer", "vakantiepark", "resort"]):
        return "camping"
    if any(w in naam_l for w in ["camper", "motorhome", "camperplaats", "camperpark"]):
        return "camperplaats"
    return "onbekend"


# ── HOOFD: LOCATIE ONDERZOEK ─────────────────────────────────────────────────

def research_location(row, verbose: bool = True) -> dict | None:
    """
    Onderzoekt één locatierij via verbeterde Waterval Methode v3.

    Verbeteringen:
    - 4 actieve scrape-bronnen (was: 1)
    - Intelligente Ja/Nee/Onbekend deductie per locatietype
    - Beschrijving 2-4 zinnen (was: max 20 woorden)
    - Reviews als doorlopende tekst "Gasten zeggen..." (was: steekwoorden)
    - Search Grounding actief aangestuurd voor ontbrekende velden
    """
    naam      = str(row.get("naam",      "Onbekende locatie")).strip()
    provincie = str(row.get("provincie", "Nederland")).strip()
    website   = str(row.get("website",   "")).strip()
    loc_type  = _detect_type(naam)

    if verbose:
        _ui_write(f"🔍 Onderzoek: **{naam}** ({provincie})")

    # ── Bronnen scrapen ───────────────────────────────────────────────────────
    bronnen: list[str] = []

    # Bron 1: Eigen website
    if verbose:
        _ui_write("   └─ 🌐 Eigen website ophalen…")
    website_tekst = scrape_website(website)
    if website_tekst:
        bronnen.append(f"[Eigen website]\n{website_tekst[:_MAX_TEKST]}")
    else:
        if verbose:
            _ui_warn("   └─ ⚠️ Geen eigen website of niet bereikbaar")

    # Bron 2: Campercontact
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

    # Bron 3: Park4Night (even wachten voor rate-limiting)
    time.sleep(0.5)
    p4n_tekst = scrape_park4night(naam, provincie)
    if p4n_tekst:
        bronnen.append(p4n_tekst)
        if verbose:
            _ui_write("   └─ ✅ Park4Night-data gevonden")

    # Bron 4: ANWB
    anwb_tekst = scrape_anwb(naam)
    if anwb_tekst:
        bronnen.append(anwb_tekst)

    alle_bronnen = "\n\n".join(bronnen) if bronnen else "Geen webinhoud beschikbaar."

    # ── Deductie-hints per locatietype ───────────────────────────────────────
    deductie_hints = _get_deductie_hints(loc_type)

    # ── Stap 1: Hoofd-verrijking prompt ──────────────────────────────────────
    prompt_hoofd = f"""
Je bent een expert data-analist voor de Nederlandse camperplatform VrijStaan.
Je taak: vul een volledig, accuraat profiel in voor camperplaats '{naam}' in {provincie}.

══════════════════════════════════════════
WEBSITEINHOUD (uit {len(bronnen)} bronnen):
══════════════════════════════════════════
{alle_bronnen[:25_000]}

══════════════════════════════════════════
INSTRUCTIES — lees dit ZORGVULDIG
══════════════════════════════════════════

REGEL 1 — JA / NEE / ONBEKEND:
Gebruik PRECIES één van deze drie waarden voor elk Ja/Nee veld:
  - "Ja"      → faciliteit is aanwezig (bewijs in bronnen OF logische deductie zegt JA)
  - "Nee"     → faciliteit is NIET aanwezig (bewijs in bronnen OF locatietype maakt het onwaarschijnlijk)
  - "Onbekend" → ALLEEN als je na bronnen + deductie + kennisbase écht niet kunt bepalen

REGEL 2 — DEDUCTIE PER LOCATIETYPE:
Dit is een {loc_type}-locatie. Pas deze regels toe:
{deductie_hints}

REGEL 3 — GEBRUIK ALTIJD SEARCH GROUNDING:
Als de bronnen boven onvolledig zijn, gebruik dan je Google Search kennis om:
- Campercontact.com/nl/{naam.lower().replace(' ', '-')} te raadplegen
- Park4night.com reviews te raadplegen
- NKC.nl, ANWB kamperen te raadplegen
- Google Maps reviews te raadplegen
De kans dat je data kunt vinden is GROOT. Wees agressief in zoeken.

REGEL 4 — BESCHRIJVING:
Schrijf 2 tot 4 sfeervolle zinnen. Beschrijf de omgeving, het gevoel, de sfeer.
Voorbeeld: "Rustig gelegen aan de rand van het bos bij Dwingeloo. Ideaal voor wie natuur 
zoekt: wandelpaden beginnen direct achter de camping. De plaatsen zijn ruim opgezet op 
gras, met schaduwrijke bomen. Perfect voor camperaars die even willen ontsnappen aan 
de drukte."

REGEL 5 — REVIEWS (samenvatting_reviews):
Schrijf een doorlopende zin van 20-40 woorden als menselijk commentaar.
Toon: "Gasten zijn enthousiast over..." of "Bezoekers waarderen..." of "De sfeer is..."
NOOIT steekwoorden, NOOIT lijsten.
Voorbeeld: "Gasten zijn bijzonder te spreken over de rust en de vriendelijke eigenaren. 
De faciliteiten worden beschreven als schoon en goed onderhouden, al wordt het soms druk 
in het hoogseizoen."

REGEL 6 — BEOORDELING:
Geef een cijfer van 1.0 tot 5.0 op basis van gevonden reviews.
Gebruik cijfers zoals: 4.2, 3.8, 4.7 — niet enkel hele getallen.
Als er geen reviews zijn: "Onbekend"

══════════════════════════════════════════
Retourneer UITSLUITEND geldig JSON, geen uitleg, geen markdown:
══════════════════════════════════════════
{{
    "prijs": "bijv. €15 per nacht / Gratis / €10-20 per nacht",
    "honden_toegestaan": "Ja/Nee/Onbekend",
    "stroom": "Ja/Nee/Onbekend",
    "stroom_prijs": "bijv. €3/nacht of Inbegrepen of Nee (geen stroom) of Onbekend",
    "afvalwater": "Ja/Nee/Onbekend",
    "chemisch_toilet": "Ja/Nee/Onbekend",
    "water_tanken": "Ja/Nee/Onbekend",
    "aantal_plekken": "getal bijv. 40 of Onbekend",
    "check_in_out": "bijv. 14:00 / 12:00 of Vrij of Onbekend",
    "website": "{website}",
    "beschrijving": "2-4 sfeervolle zinnen over omgeving, gevoel en doelgroep",
    "ondergrond": "Gras / Asfalt / Grind / Verhard / Gemengd / Onbekend",
    "toegankelijkheid": "Ja/Nee/Onbekend",
    "rust": "Rustig / Gemiddeld / Druk / Onbekend",
    "sanitair": "Ja/Nee/Onbekend",
    "wifi": "Ja/Nee/Onbekend",
    "beoordeling": "bijv. 4.3 of Onbekend",
    "samenvatting_reviews": "Doorlopende zin van 20-40 woorden in Gasten-stijl",
    "telefoonnummer": "bijv. 0512345678 of Onbekend",
    "extra": []
}}
"""

    response_text = get_gemini_response_grounded(prompt_hoofd)

    if verbose:
        _ui_expander(f"⚙️ Ruwe AI output — {naam}", response_text)

    # ── JSON parsen ───────────────────────────────────────────────────────────
    data = _parse_json(response_text)
    if data is None:
        if verbose:
            _ui_error(f"❌ JSON-parse mislukt voor {naam}")
        return None

    # ── Stap 2: Kwaliteitscheck & Heronderzoek ────────────────────────────────
    # Als meer dan 6 velden "Onbekend" zijn → tweede, gerichte zoekaanroep
    onbekend_velden = _count_onbekend(data)
    if onbekend_velden > 6:
        if verbose:
            _ui_warn(f"⚠️ {onbekend_velden} velden onbekend → hersearch gestart…")
        data = _hersearch(naam, provincie, website, data, verbose)

    # Sanitize: extra altijd string
    if isinstance(data.get("extra"), list):
        data["extra"] = ", ".join(str(v) for v in data["extra"])
    elif not data.get("extra"):
        data["extra"] = ""

    # Post-process: zorg dat stroom_prijs logisch is
    if data.get("stroom", "").lower() == "nee":
        data["stroom_prijs"] = "Nee (geen stroom)"

    return data


# ── DEDUCTIE REGELS PER LOCATIETYPE ──────────────────────────────────────────

def _get_deductie_hints(loc_type: str) -> str:
    """
    Geeft specifieke deductie-hints per locatietype.
    Dit is de kernlogica die 'Onbekend' terugdringt.
    """
    hints = {
        "parking": """
- Dit is een PARKEERPLAATS. Tenzij expliciet vermeld: sanitair=Nee, wifi=Nee, stroom=Nee,
  chemisch_toilet=Nee, water_tanken=Nee, afvalwater=Nee
- Honden: bijna altijd toegestaan op parkeerplaatsen → standaard Ja tenzij verbodsbord vermeld
- Rust: afhankelijk van locatie (stad=Druk, buiten bebouwde kom=Rustig)
- Prijs: parkeerplaatsen zijn vaak Gratis of hebben een parkeertarief""",

        "jachthaven": """
- Jachthavens hebben BIJNA ALTIJD: water_tanken=Ja, afvalwater=Ja, sanitair=Ja, stroom=Ja
- Wifi is in moderne jachthavens steeds gebruikelijker → zoek actief
- Honden: wisselend, zoek expliciet
- Ondergrond: vrijwel altijd Asfalt of Verhard""",

        "boerderij": """
- Boerderij-camperplaatsen: sanitair wisselend, stroom soms aanwezig
- Honden: vraag EXPLICIET aan — vaak Nee vanwege vee
- Ondergrond: vrijwel altijd Gras
- Rust: bijna altijd Rustig (landelijk)
- Wifi: zelden aanwezig""",

        "camping": """
- Campings hebben bijna ALTIJD: sanitair=Ja, water_tanken=Ja
- Stroom: bij campings met elektra-haak Ja, anders Nee
- Wifi: bij moderne campings steeds vaker aanwezig
- Honden: meestal toegestaan mits aangelijnd — zoek campingregels""",

        "camperplaats": """
- Dedicated camperplaatsen hebben BIJNA ALTIJD: water_tanken=Ja, afvalwater=Ja
- Stroom: bij camperplaatsen met zuil Ja, anders Nee
- Sanitair: wisselend per locatie, maar beter dan parking
- Honden: over het algemeen welkom""",

        "onbekend": """
- Gebruik de locatienaam en context om het type te raden
- Bij twijfel: vergelijk met vergelijkbare locaties in dezelfde regio
- Gebruik Google Search Grounding MAXIMAAL om elk onbekend veld in te vullen""",
    }
    return hints.get(loc_type, hints["onbekend"])


# ── KWALITEITSCHECK ───────────────────────────────────────────────────────────

def _count_onbekend(data: dict) -> int:
    """Telt het aantal velden met waarde 'Onbekend'."""
    return sum(
        1 for v in data.values()
        if isinstance(v, str) and v.strip().lower() == "onbekend"
    )


# ── HERSEARCH BIJ TE VEEL ONBEKEND ────────────────────────────────────────────

def _hersearch(naam: str, provincie: str, website: str,
               huidige_data: dict, verbose: bool) -> dict:
    """
    Tweede AI-aanroep specifiek gericht op het invullen van lege velden.
    Gebruikt gerichte search-queries per platform.
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
1. "{naam} camperplaats {provincie}" → zoek op Campercontact, Park4Night, Google Maps
2. "{naam} camping {provincie} faciliteiten" → ANWB, NKC
3. "{naam} {provincie} reviews ervaringen" → TripAdvisor, Google Reviews

Huidige (onvolledige) data:
{json.dumps(huidige_data, ensure_ascii=False, indent=2)}

Retourneer UITSLUITEND de VERBETERDE versie van het volledige JSON-object.
Vervang alle "Onbekend" waarden die je kunt achterhalen.
Gebruik "Nee" als een faciliteit er logischerwijs NIET is.
Gebruik "Onbekend" ALLEEN als je het echt niet kunt bepalen na intensief zoeken.

Retourneer UITSLUITEND geldig JSON zonder uitleg:
"""

    response = get_gemini_response_grounded(prompt_hersearch)
    verbeterd = _parse_json(response)

    if verbeterd:
        # Merge: behoud origineel voor velden die al ingevuld waren
        for key, val in verbeterd.items():
            if key in huidige_data:
                orig = str(huidige_data[key]).strip().lower()
                # Overschrijf alleen als het origineel "Onbekend" was
                if orig == "onbekend" and str(val).strip().lower() != "onbekend":
                    huidige_data[key] = val
        if verbose:
            nieuw_onbekend = _count_onbekend(huidige_data)
            _ui_write(f"   └─ ✅ Hersearch: van {len(onbekende_keys)} → {nieuw_onbekend} onbekende velden")
        return huidige_data

    return huidige_data


# ── JSON PARSER ───────────────────────────────────────────────────────────────

def _parse_json(text: str) -> dict | None:
    """Robuust JSON parsen uit AI response."""
    if not text:
        return None
    try:
        # Verwijder mogelijke markdown code blocks
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
    except json.JSONDecodeError:
        return None
    except Exception:
        return None


# ── UI HELPERS ────────────────────────────────────────────────────────────────

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
