import pandas as pd
import streamlit as st
import google.generativeai as genai
import json

# --- CONFIGURATIE ---
# We laden de API key veilig in vanuit Streamlit Secrets.
try:
    API_KEY = st.secrets["GEMINI_API_KEY"]
    genai.configure(api_key=API_KEY)
    # We configureren direct het door jou gewenste model
    model = genai.GenerativeModel('gemini-2.5-flash')
except KeyError:
    model = None
    st.sidebar.error("Architectuur-waarschuwing: 'GEMINI_API_KEY' niet gevonden in st.secrets.")
except Exception as e:
    model = None
    st.sidebar.error(f"Fout bij laden van de Gemini API: {e}")

def process_ai_query(df, user_query):
    """
    De AI Controller. Stuurt de natuurlijke taalvraag naar Gemini,
    ontvangt een gestructureerde JSON terug en past de Pandas filters toe.
    """
    if not user_query:
        return df, []
        
    if model is None:
        return df, ["⚠️ AI is momenteel niet beschikbaar (API configuratie fout)."]

    # --- FASE 1: PROMPT ENGINEERING ---
    prompt = f"""
    Je bent een backend data-extractor voor een applicatie met camperplaatsen in Nederland.
    Analyseer de volgende zoekopdracht van een gebruiker en haal de gewenste filters eruit.
    
    Zoekopdracht: "{user_query}"
    
    Geef EXACT een geldige, rauwe JSON terug met deze sleutels. Gebruik null als het niet expliciet in de tekst staat.
    - "provincie": (string, exact de naam van een Nederlandse provincie, met een hoofdletter. Bijv: "Drenthe")
    - "honden_toegestaan": (string, "Ja" of "Nee")
    - "is_gratis": (boolean, true of false)
    
    Geef uitsluitend de JSON terug, zonder markdown-blokken (geen ```json), en zonder extra uitleg.
    """
    
    # --- FASE 2: API AANROEP ---
    try:
        response = model.generate_content(prompt)
        
        # Schoon de output op (defensive programming, voor het geval Gemini toch markdown meestuurt)
        clean_response = response.text.replace('```json', '').replace('```', '').strip()
        filters = json.loads(clean_response)
    except json.JSONDecodeError:
        return df, ["⚠️ Gemini gaf een onverwacht antwoord terug. Probeer de vraag anders te stellen."]
    except Exception as e:
        return df, [f"⚠️ Communicatiefout met Gemini: {e}"]

    # --- FASE 3: DATAFRAME FILTEREN ---
    filtered_df = df.copy()
    actieve_filters = []

    # 1. Provincie Filter
    provincie = filters.get("provincie")
    if provincie:
        # We gebruiken str.contains om hoofdlettergevoeligheid en kleine spelfouten op te vangen
        filtered_df = filtered_df[filtered_df['provincie'].str.contains(provincie, case=False, na=False)]
        actieve_filters.append(f"📍 Provincie: {provincie}")

    # 2. Honden Filter
    honden = filters.get("honden_toegestaan")
    if honden in ["Ja", "Nee"]:
        filtered_df = filtered_df[filtered_df['honden_toegestaan'] == honden]
        actieve_filters.append(f"{'🐾' if honden == 'Ja' else '🚫'} Honden: {honden}")

    # 3. Prijs Filter (Gratis)
    is_gratis = filters.get("is_gratis")
    if is_gratis is True:
        filtered_df = filtered_df[filtered_df['prijs'].astype(str).str.lower() == 'gratis']
        actieve_filters.append("💰 Prijs: Gratis")

    # Fallback als AI de intentie wel begreep, maar er geen harde datapunten aan kon koppelen
    if not actieve_filters:
        actieve_filters.append("Zoekopdracht begrepen, maar geen specifieke data-filters (provincie/prijs/hond) herkend.")

    return filtered_df, actieve_filters
