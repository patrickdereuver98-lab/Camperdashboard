"""
utils/scraper.py — Robuuste Web Scraper voor VrijStaan.
Functie: Haalt de ruwe, schone tekst van een webpagina op.
"""
import requests
from bs4 import BeautifulSoup
import streamlit as st
from utils.logger import logger

def fetch_clean_text(url: str, max_chars: int = 15000) -> str:
    """
    Bezoekt een URL, omzeilt simpele blokkades, en retourneert alleen de leesbare tekst.
    """
    if not url or str(url).strip().lower() in ['nan', 'onbekend', 'none', '']:
        return "Geen URL beschikbaar om te scrapen."

    # Zorg voor een werkende URL structuur
    url = str(url).strip()
    if not url.startswith(('http://', 'https://')):
        url = 'https://' + url

    # Stealth Headers: Doe alsof we een moderne Chrome browser op Windows zijn
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'nl-NL,nl;q=0.9,en-US;q=0.8,en;q=0.7',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1'
    }

    try:
        # Haal de pagina op met een harde timeout om vastlopers te voorkomen
        response = requests.get(url, headers=headers, timeout=12)
        response.raise_for_status()

        # Parse de HTML structuur
        soup = BeautifulSoup(response.text, 'html.parser')

        # Verwijder alle "ruis" die we niet aan de AI willen voeden
        for element in soup(["script", "style", "nav", "footer", "header", "aside", "noscript"]):
            element.extract()

        # Extraheer alleen de daadwerkelijke tekst, gescheiden door spaties
        ruwe_tekst = soup.get_text(separator=' ', strip=True)
        
        # Soms plakken woorden aan elkaar vast, we fixen dubbele spaties
        schone_tekst = ' '.join(ruwe_tekst.split())

        # Beperk de lengte zodat we de AI niet overbelasten (context window)
        if len(schone_tekst) > max_chars:
            schone_tekst = schone_tekst[:max_chars] + "... [Tekst afgekapt wegens lengte]"

        return schone_tekst

    except requests.exceptions.Timeout:
        logger.warning(f"Timeout bij scrapen van {url}")
        return "Fout: De website reageerde niet binnen de tijd."
    except requests.exceptions.RequestException as e:
        logger.warning(f"Toegang geweigerd of netwerkfout bij {url}: {e}")
        return f"Fout: Kan website niet bereiken ({str(e)})."
    except Exception as e:
        logger.error(f"Onverwachte scrape-fout bij {url}: {e}")
        return f"Fout: Onverwacht probleem bij het lezen van de website."
