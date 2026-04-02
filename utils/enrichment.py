"""
utils/enrichment.py — AI-onderzoeker voor camper-specifieke data.
"""
import json
from utils.ai_helper import get_gemini_response


def research_location(row):
    naam = row.get('naam', 'Onbekende locatie')
    stad = row.get('provincie', 'Nederland')
    website = row.get('website', '')

prompt = f"""
Gebruik Google Search om de meest actuele informatie te vinden over: {naam} in {stad}.
Bezoek indien mogelijk de website: {website}.

Zoek specifiek naar:
1. Prijs per nacht voor 2 personen + camper.
2. Of honden welkom zijn op de camperplaatsen.
3. Faciliteiten: afvalwater lozen, vers water tanken, stroom (en prijs daarvan).
4. Check-in en check-out tijden.

Antwoord uitsluitend in JSON formaat:

BELANGRIJK:
- Gebruik meerdere bronnen (officiële website, camperplatforms, Google Maps, reviews).
- Geef prioriteit aan de officiële website voor feiten zoals prijs en regels.
- Vul ontbrekende info aan met betrouwbare secundaire bronnen.
- Als informatie onzeker of niet vindbaar is: gebruik "Onbekend".
- Hallucineer NOOIT gegevens.

Geef uitsluitend een JSON-object terug met deze velden:

{{
    "prijs": "Prijs per nacht",
    "honden_toegestaan": "Ja/Nee/Onbekend",
    "stroom": "Ja/Nee/Onbekend",
    "stroom_prijs": "Kosten of Onbekend",
    "afvalwater": "Ja/Nee/Onbekend",
    "chemisch_toilet": "Ja/Nee/Onbekend",
    "water_tanken": "Ja/Nee/Onbekend",
    "aantal_plekken": "Aantal of Onbekend",
    "check_in_out": "Tijden of Vrij",
    "website": "Officiële URL",
    "beschrijving": "Max 20 woorden",

    "ondergrond": "Type of Onbekend",
    "toegankelijkheid": "Ja/Nee/Onbekend",
    "rust": "Rustig/Druk/Onbekend",
    "sanitair": "Ja/Nee/Onbekend",
    "wifi": "Ja/Nee/Onbekend",

    "beoordeling": "Score of Onbekend",
    "samenvatting_reviews": "Max 15 woorden",

    "extra": []
}}

Zorg dat de JSON geldig is en geen extra tekst bevat.
"""

    response_text = get_gemini_response(prompt)

    try:
        start = response_text.find('{')
        end = response_text.rfind('}') + 1
        if start != -1 and end != -1:
            return json.loads(response_text[start:end])
    except Exception:
        return None

    return None
