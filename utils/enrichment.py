"""
utils/enrichment.py — Search-First Data-Verrijker voor VrijStaan.
Architectuur: Gemini + Google Search Grounding → 18 velden per locatie.

Bulletproof ontwerp:
  • Meerdere zoekprompts in sequentie als eerste mislukt
  • JSON-validatie en veld-sanitisatie vóór opslag
  • Nooit een crash, altijd een returnwaarde
"""
import json
import re
import time
from utils.ai_helper import get_gemini_response


# ── CONSTANTEN ────────────────────────────────────────────────────────────────
# De 18 velden die we garanderen te vullen (met "Onbekend" als fallback)
REQUIRED_FIELDS = [
    "prijs",
    "honden_toegestaan",
    "stroom",
    "stroom_prijs",
    "afvalwater",
    "chemisch_toilet",
    "water_tanken",
    "aantal_plekken",
    "check_in_out",
    "website",
    "beschrijving",
    "ondergrond",
    "toegankelijkheid",
    "rust",
    "sanitair",
    "wifi",
    "beoordeling",
    "samenvatting_reviews",
]

# Standaardwaarden (ingevuld als AI het veld mist of "null" teruggeeft)
DEFAULT_VALUES = {
    "prijs": "Onbekend",
    "honden_toegestaan": "Onbekend",
    "stroom": "Onbekend",
    "stroom_prijs": "Onbekend",
    "afvalwater": "Onbekend",
    "chemisch_toilet": "Onbekend",
    "water_tanken": "Onbekend",
    "aantal_plekken": "Onbekend",
    "check_in_out": "Vrij",
    "website": "",
    "beschrijving": "Geen beschrijving beschikbaar.",
    "ondergrond": "Onbekend",
    "toegankelijkheid": "Onbekend",
    "rust": "Onbekend",
    "sanitair": "Onbekend",
    "wifi": "Onbekend",
    "beoordeling": "Onbekend",
    "samenvatting_reviews": "Nog geen reviews verwerkt.",
}


# ── HULPFUNCTIES ──────────────────────────────────────────────────────────────

def _extract_json(text: str) -> dict | None:
    """
    Robuuste JSON-extractor die Gemini's grounding-output aankan.
    Gemini voegt soms citatie-brackets [1] of markdown fences toe — dit filtert dat weg.
    """
    if not text:
        return None

    # Verwijder markdown fences
    text = re.sub(r"```(?:json)?", "", text)
    text = re.sub(r"```", "", text)

    # Verwijder grounding-citaties zoals [1], [2] etc.
    text = re.sub(r"\[\d+\]", "", text)

    # Zoek het eerste geldige { ... } object (ook bij geneste objecten)
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
                json_candidate = text[start : i + 1]

                # Repareer veelvoorkomende fouten
                json_candidate = re.sub(r",\s*([}\]])", r"\1", json_candidate)  # Trailing comma
                json_candidate = re.sub(r"//.*?\n", "\n", json_candidate)       # JS-stijl comments

                try:
                    return json.loads(json_candidate)
                except json.JSONDecodeError:
                    return None
    return None


def _sanitise(data: dict) -> dict:
    """
    Vult ontbrekende velden aan met defaults en verwijdert ongewenste types.
    Garandeert dat alle 18 velden aanwezig zijn als strings.
    """
    result = {}
    for field in REQUIRED_FIELDS:
        raw = data.get(field)

        # Veld mist of is None/null
        if raw is None or str(raw).lower() in ("null", "none", ""):
            result[field] = DEFAULT_VALUES.get(field, "Onbekend")
        # Lijsten of dicts zijn niet bruikbaar als cel-waarde
        elif isinstance(raw, (list, dict)):
            result[field] = DEFAULT_VALUES.get(field, "Onbekend")
        else:
            result[field] = str(raw).strip()

    # Bewaar ook eventuele extra velden die de AI meegaf
    for key, val in data.items():
        if key not in result and key != "extra":
            result[key] = str(val) if val is not None else "Onbekend"

    return result


def _build_main_prompt(naam: str, stad: str, website: str) -> str:
    """Bouwt de primaire Gemini-zoekopdracht op."""
    website_instructie = (
        f"Bezoek de officiële website: {website} voor prijzen en regels."
        if website
        else "Zoek de officiële website zelf op via Google."
    )

    return f"""
Zoek via Google naar actuele informatie over: "{naam}" in {stad}, Nederland.
{website_instructie}

Gebruik MEERDERE bronnen:
1. De officiële camping/camperplaats-website (hoogste prioriteit voor prijs en regels)
2. Google Maps reviews en beoordelingen
3. Camperplatforms zoals campercontact.nl, ACSI, Camperplaats.nl of Jojje

Jouw taak: Extraheer ALLE onderstaande gegevens zo nauwkeurig mogelijk.

STRIKTE REGELS:
- Gebruik "Onbekend" als informatie niet vindbaar is — fabriceer NOOIT data.
- Prijs: geef het bedrag per nacht voor 2 personen + camper (bijv. "€18 per nacht").
- Beoordeling: gebruik het cijfer van Google Maps of Campercontact (bijv. "4.2/5").
  Als geen exact cijfer beschikbaar is, geef dan zelf een oordeel op basis van de reviews:
  één van: "Slecht", "Voldoende", "Goed", "Uitstekend".
- honden_toegestaan / stroom / afvalwater / etc.: gebruik exact "Ja", "Nee" of "Onbekend".
- rust: gebruik exact "Rustig", "Druk" of "Onbekend".
- beschrijving: maximaal 20 woorden, in het Nederlands.
- samenvatting_reviews: maximaal 15 woorden, in het Nederlands.

Geef UITSLUITEND een geldig JSON-object terug. Geen uitleg, geen markdown, geen extra tekst.

{{
    "prijs": "Bedrag per nacht of Gratis of Onbekend",
    "honden_toegestaan": "Ja/Nee/Onbekend",
    "stroom": "Ja/Nee/Onbekend",
    "stroom_prijs": "Kosten per kWh of per dag, of Inbegrepen, of Onbekend",
    "afvalwater": "Ja/Nee/Onbekend",
    "chemisch_toilet": "Ja/Nee/Onbekend",
    "water_tanken": "Ja/Nee/Onbekend",
    "aantal_plekken": "Exact aantal of Onbekend",
    "check_in_out": "Bijv. 14:00 / 11:00 of Vrij",
    "website": "Volledige URL of lege string",
    "beschrijving": "Max 20 woorden in het Nederlands",
    "ondergrond": "Gras/Gravel/Asfalt/Zand/Gemengd/Onbekend",
    "toegankelijkheid": "Ja/Nee/Onbekend",
    "rust": "Rustig/Druk/Onbekend",
    "sanitair": "Ja/Nee/Onbekend",
    "wifi": "Ja/Nee/Onbekend",
    "beoordeling": "Getal zoals 4.2 of tekst zoals Goed",
    "samenvatting_reviews": "Max 15 woorden in het Nederlands"
}}
"""


def _build_fallback_prompt(naam: str, stad: str) -> str:
    """Vereenvoudigde prompt als de eerste poging mislukt."""
    return f"""
Zoek op Google naar: camperplaats "{naam}" {stad} Nederland prijs faciliteiten.

Geef een JSON-object terug met de meest basale informatie die je kunt vinden.
Als je iets niet weet, gebruik dan "Onbekend".

Geef ALLEEN het JSON-object:
{{
    "prijs": "Onbekend",
    "honden_toegestaan": "Onbekend",
    "stroom": "Onbekend",
    "stroom_prijs": "Onbekend",
    "afvalwater": "Onbekend",
    "chemisch_toilet": "Onbekend",
    "water_tanken": "Onbekend",
    "aantal_plekken": "Onbekend",
    "check_in_out": "Vrij",
    "website": "",
    "beschrijving": "Camperplaats in {stad}.",
    "ondergrond": "Onbekend",
    "toegankelijkheid": "Onbekend",
    "rust": "Onbekend",
    "sanitair": "Onbekend",
    "wifi": "Onbekend",
    "beoordeling": "Onbekend",
    "samenvatting_reviews": "Nog geen reviews verwerkt."
}}
"""


# ── PUBLIEKE API ──────────────────────────────────────────────────────────────

def research_location(row) -> dict:
    """
    Verrijkt één locatie-rij met live data via Gemini + Google Search.

    Strategie (3 lagen):
      1. Volledige zoekprompt met website-hint → parse JSON
      2. Bij mislukking: vereenvoudigde fallback-prompt → parse JSON
      3. Bij mislukking: geef defaults terug (nooit crash)

    Returns:
        dict met alle 18 gegarandeerde velden (altijd een geldig object).
    """
    naam = str(row.get("naam", "Onbekende locatie")).strip()
    stad = str(row.get("provincie", "Nederland")).strip()
    website = str(row.get("website", "")).strip()

    # ── Poging 1: Volledige prompt ────────────────────────────────────────────
    prompt = _build_main_prompt(naam, stad, website)
    raw_response = get_gemini_response(prompt)

    parsed = _extract_json(raw_response)

    # ── Poging 2: Fallback-prompt (als JSON-extractie mislukt) ────────────────
    if not parsed:
        time.sleep(1)  # Kleine pauze om rate-limits te respecteren
        fallback_prompt = _build_fallback_prompt(naam, stad)
        raw_fallback = get_gemini_response(fallback_prompt)
        parsed = _extract_json(raw_fallback)

    # ── Poging 3: Volledig defaults (vangnet) ─────────────────────────────────
    if not parsed:
        return {**DEFAULT_VALUES, "beschrijving": f"Camperplaats in {stad}."}

    # Sanitiseer en garandeer alle 18 velden
    return _sanitise(parsed)
