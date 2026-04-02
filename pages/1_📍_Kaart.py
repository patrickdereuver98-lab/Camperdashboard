import streamlit as st
import pandas as pd
from utils.geo_logic import filter_by_distance
from ui.map_view import render_map
from ui.theme import apply_theme
from utils.ai_helper import process_ai_query

st.set_page_config(page_title="VrijStaan | Kaart", page_icon="📍", layout="wide")

def app():
    apply_theme()
    
    # --- PURE DATA CONSUMPTIE ---
    # We lezen alleen het statische bestand dat door de Beheer-pagina is gemaakt
    try:
        df = pd.read_csv("data/api_export_campers.csv")
    except FileNotFoundError:
        st.warning("⚠️ Geen data gevonden. Ga naar de Beheer-pagina om de database te vullen.")
        return

    st.markdown("<h2 style='color: #2A5A4A;'>📍 Zoek jouw volgende plek</h2>", unsafe_allow_html=True)
    
    # AI Zoekbalk
    st.markdown("### 🤖 Slim Zoeken")
    ai_query = st.text_input("Vraag het de assistent", placeholder="Bijv: 'Gratis plekken in Limburg'", label_visibility="collapsed")

    if ai_query:
        df, _ = process_ai_query(df, ai_query)

    st.markdown("---")

    # Filters
    f1, f2, f3 = st.columns(3)
    with f1:
        prov = st.selectbox("Provincie", ["Alle provincies"] + sorted(df['provincie'].unique().tolist()))
    with f2:
        loc = st.text_input("Huidige locatie", placeholder="Stad of Postcode")
    with f3:
        rad = st.slider("Straal (km)", 5, 150, 30)

    # Filtering
    if prov != "Alle provincies":
        df = df[df['provincie'] == prov]
    if loc:
        df = filter_by_distance(df, loc, rad)

    # Display
    col_list, col_map = st.columns([4, 6])
    with col_list:
        st.subheader(f"{len(df)} Resultaten")
        for _, row in df.head(20).iterrows(): # We tonen de eerste 20 voor performance
            with st.container(border=True):
                st.markdown(f"**{row['naam']}**")
                st.caption(f"{row['provincie']} | Prijs: {row['prijs']}")
                if st.button(f"Details {row['naam']}", key=row['naam']):
                    st.info(f"Website: {row['website']}")

    with col_map:
        render_map(df)

if __name__ == "__main__":
    app()
