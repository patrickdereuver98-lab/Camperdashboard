import pandas as pd
import streamlit as st

@st.cache_data(ttl=86400) # Cache voorkomt dat de server de file bij elke klik opnieuw leest
def load_data():
    """Haalt data lokaal op. Extreem snel en 100% betrouwbaar."""
    
    empty_df = pd.DataFrame(columns=[
        "naam", "latitude", "longitude", "provincie", 
        "honden_toegestaan", "aantal_plekken", "prijs", "website", "afbeelding"
    ])
    
    try:
        # We lezen nu puur jouw eigen, robuuste dataset in
        df = pd.read_csv("data/campers.csv")
        return df
    except FileNotFoundError:
        st.error("Architectuur-fout: Het bestand 'data/campers.csv' ontbreekt. Maak deze aan in GitHub.")
        return empty_df
    except Exception as e:
        st.error(f"Fout bij het lezen van de data: {e}")
        return empty_df

def filter_data(df, provincie):
    """Basis filter voor provincies."""
    if df.empty:
        return df
    
    filtered_df = df.copy()
    if provincie != "Alle provincies":
        filtered_df = filtered_df[filtered_df['provincie'] == provincie]
        
    return filtered_df
