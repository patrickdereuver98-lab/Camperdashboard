import pandas as pd
import streamlit as st

@st.cache_data
def load_data():
    """Laadt de camper data in en bereidt deze voor."""
    try:
        df = pd.read_csv("data/dummy_campers.csv")
        return df
    except FileNotFoundError:
        return pd.DataFrame() # Return lege dataframe als fallback

def filter_data(df, provincie, max_afstand):
    """Filtert de dataset op basis van gebruikersinput."""
    if df.empty:
        return df
        
    filtered_df = df.copy()
    
    if provincie != "Alle provincies":
        filtered_df = filtered_df[filtered_df['provincie'] == provincie]
        
    # De afstandslogica (max_afstand) implementeren we later via geo_logic.py
    # Voor nu geven we puur de (op provincie) gefilterde set terug.
    
    return filtered_df
