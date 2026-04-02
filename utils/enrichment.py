"""
utils/enrichment.py — AI-onderzoeker met Waterval Methode (Scraper + Kennisbase + Logica).
"""
import json
import requests
from bs4 import BeautifulSoup
import streamlit as st
import pandas as pd
from utils.ai_helper import get_gemini_response

def scrape_website(url: str) -> str:
    """Haalt de ruwe tekst van een website op zonder afhankelijk te zijn van Google Search tools."""
    if not url or pd.isna(url) or str(url).strip().lower() in ['nan', 'onbekend', 'none', '']:
        return "Geen website opgegeven."
    
    # Zorg voor een correcte URL
    url = str(url).strip()
    if not url.startswith(('http://', 'https://')):
        url = 'https://' + url

    try:
        # We gebruiken een standaard User-Agent zodat websites ons niet direct blokkeren
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
            'Accept-Language': 'nl-NL,nl;q=0.9,en-US;q=0.8,en;q=0.7',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1'
        }
        response = requests.get(url, headers=headers, timeout=12)
        response.raise_for_status()
        
        # Parse de HTML en haal de tekst eruit
        soup = BeautifulSoup(response.text, 'html.parser')
        
        # Verwijder onnodige elementen zoals scripts en styling
        for element in soup(["script", "style", "nav", "footer", "header", "aside", "noscript"]):
            element.extract()
            
        ruwe_tekst = soup.get_text(separator=' ', strip=True)
        schone_tekst = ' '.join(ruwe_tekst.split())
        
        # We geven maximaal de eerste 15.000 karakters aan de AI om context-limieten te respecteren
        if len(schone_tekst) > 15000:
            schone_tekst = schone_tekst[:15000] + "... [Tekst afgekapt wegens lengte]"
            
        return schone_tekst
    except requests.exceptions.Timeout:
        return "Fout: De website reageerde niet binnen de tijd."
    except requests.exceptions.RequestException as e:
        return f"Fout: Kan website niet bereiken ({str(e)})."
    except Exception as e:
        return f"Scrapen mislukt: {e}"

def research_location(row):
    naam = row.get('naam', 'Onbekende locatie')
    stad = row.get('provincie', 'Nederland')
    website = row.get('website', '')

    st.write(f"🌐 Website ophalen: {website}")
    website_content = scrape_website(website)

    if website_content.startswith("Fout:") or website_content.startswith("Geen website"):
        st.warning(website_content)

    # ── DE WATERVAL PROMPT ──
    prompt = f"""
Je bent een Senior Data Analist voor een Nederlandse camper-app.
Onderwerp: Camperplaats '{naam}' in provincie '{stad}'.

We gebruiken een 'Waterval Methode' om 19 velden in te vullen. Combineer de volgende 3 methodes in deze exacte volgorde van prioriteit:

BRON 1 (Hoofdprioriteit - Live Website Tekst):
Haal alle feiten uit deze actuele websitetekst van de locatie zelf:
--------------------------------------------------
{website_content}
--------------------------------------------------

BRON 2 (Secundair - AI Kennisbase):
Als een detail (bijv. hondenbeleid of stroom) NIET in de websitetekst staat, raadpleeg dan jouw uitgebreide interne kennis over deze specifieke locatie. Gebruik je kennis van platformen zoals Campercontact, Park4Night, NKC of Google Reviews om het gat te vullen.

BRON 3 (Logische Deductie):
Gebruik logica. Is het een simpele (gratis) parkeerplaats zonder voorzieningen? Dan is de kans op wifi, sanitair of stroom nagenoeg nul. Vul dan 'Nee' in. 

Jouw taak: Vul de 18 velden in door deze 3 bronnen te combineren.
Als je na het toepassen van alle 3 de methodes een veld écht niet met zekerheid kunt invullen, gebruik dan EXACT "Onbekend".

Retourneer UITSLUITEND een geldig JSON-object:
{{
    "prijs": "Huidige prijs per nacht of Gratis",
    "honden_toegestaan": "Ja/Nee/Onbekend",
    "stroom": "Ja/Nee/Onbekend",
    "stroom_prijs": "Kosten per nacht/kWh of 'Inbegrepen' of Onbekend",
    "afvalwater": "Ja/Nee/Onbekend",
    "chemisch_toilet": "Ja/Nee/Onbekend",
    "water_tanken": "Ja/Nee/Onbekend",
    "aantal_plekken": "Totaal aantal plekken (getal) of Onbekend",
    "check_in_out": "Tijden of Onbekend",
    "website": "{website}",
    "beschrijving": "Max 20 woorden sfeeromschrijving op basis van de info",
    "ondergrond": "Gras/Asfalt/Grind/Verhard of Onbekend",
    "toegankelijkheid": "Ja/Nee of Onbekend",
    "rust": "Rustig/Druk of Onbekend",
    "sanitair": "Ja/Nee/Onbekend",
    "wifi": "Ja/Nee/Onbekend",
    "beoordeling": "Score op basis van reviews (bijv 4.2) of Onbekend",
    "samenvatting_reviews": "Max 15 woorden over de algemene mening of Onbekend",
    "telefoonummer",
    "extra": []
}}
"""
    
    response_text = get_gemini_response(prompt)

    with st.expander(f"⚙️ Bekijk ruwe AI output voor {naam}"):
        st.text(response_text)

    try:
        start = response_text.find('{')
        end = response_text.rfind('}') + 1
        if start != -1 and end != -1:
            json_data = json.loads(response_text[start:end])
            return json_data
        else:
            st.error(f"Geen JSON structuur gevonden voor {naam}.")
            return None
    except json.JSONDecodeError as e:
        st.error(f"JSON Parse Fout bij {naam}: {e}")
        return None
    except Exception as e:
        st.error(f"Onverwachte fout bij data-extractie voor {naam}: {e}")
        return None
