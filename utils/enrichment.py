"""
utils/enrichment.py — Geoptimaliseerde AI-onderzoeker voor camper-specifieke data.
"""
import json
import streamlit as st
from utils.ai_helper import get_gemini_response

def research_location(row):
    naam = row.get('naam', 'Onbekende locatie')
    stad = row.get('provincie', 'Nederland')
    website = row.get('website', '')

prompt = f"""
Je bent een expert in Nederlandse camperplaatsen en voert diepgaand online onderzoek uit.

Onderzoek de locatie: {naam} in {stad}.
Website (indien bekend): {website}

BELANGRIJK:
- Gebruik meerdere bronnen (officiële website, camperplatforms, Google Maps, reviews).
- Geef prioriteit aan de officiële website voor feiten zoals prijs en regels.
- Vul ontbrekende info aan met betrouwbare secundaire bronnen.
- Als informatie onzeker of niet vindbaar is: gebruik "Onbekend".
- Hallucineer NOOIT gegevens.

Geef uitsluitend een JSON-object terug met deze velden:

{{
    "prijs": "Prijs per nacht (bijv. 'Gratis' of '€15,00')",
    "honden_toegestaan": "Ja of Nee of Onbekend",
    
    "stroom": "Ja of Nee of Onbekend",
    "stroom_prijs": "Kosten per kWh of per nacht indien bekend, anders 'Onbekend'",
    
    "afvalwater": "Kan men hier grijs water lozen? (Ja/Nee/Onbekend)",
    "chemisch_toilet": "Kan een chemisch toilet geleegd worden? (Ja/Nee/Onbekend)",
    "water_tanken": "Kan men hier vers drinkwater tanken? (Ja/Nee/Onbekend)",

    "aantal_plekken": "Totaal aantal camperplaatsen (cijfer of 'Onbekend')",
    
    "check_in_out": "Tijden voor aankomst en vertrek (bijv. '14:00 / 11:00' of 'Vrij')",
    
    "website": "De officiële website URL indien gevonden",
    
    "beschrijving": "Korte omschrijving van max. 20 woorden over sfeer en type locatie",

    "ondergrond": "Type ondergrond (gras, grind, asfalt, etc. of 'Onbekend')",
    "toegankelijkheid": "Geschikt voor grote campers? (Ja/Nee/Onbekend)",
    "rust": "Rustig of druk (indicatie op basis van reviews of locatie)",
    
    "sanitair": "Zijn er toiletten/douches? (Ja/Nee/Onbekend)",
    "wifi": "Is er wifi beschikbaar? (Ja/Nee/Onbekend)",

    "beoordeling": "Gemiddelde score indien bekend (bijv. 4.2/5 of 'Onbekend')",
    "samenvatting_reviews": "Korte samenvatting (max. 15 woorden) van ervaringen van bezoekers",

    "extra": [
        "Eventuele extra relevante camperinformatie die niet in bovenstaande velden past"
    ]
}}

EXTRA INSTRUCTIES:
- Denk als een ervaren camperaar: wat wil iemand minimaal weten?
- Voeg relevante info toe in 'extra' als iets belangrijk is maar geen veld heeft.
- Houd beschrijvingen kort en feitelijk.
- Gebruik exact 'Ja', 'Nee' of 'Onbekend' waar gevraagd.
- Zorg dat de JSON geldig is (geen tekst buiten JSON).
"""
    
    response_text = get_gemini_response(prompt)
    
    try:
        # Robuuste extractie: zoek de JSON haken
        start = response_text.find('{')
        end = response_text.rfind('}') + 1
        if start != -1 and end != -1:
            return json.loads(response_text[start:end])
    except Exception as e:
        return None
    return None
