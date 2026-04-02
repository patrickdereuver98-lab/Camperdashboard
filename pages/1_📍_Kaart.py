import streamlit as st
import pandas as pd
from utils.geo_logic import filter_by_distance
from ui.map_view import render_map
from ui.theme import apply_theme, render_sidebar_header
from utils.ai_helper import process_ai_query

st.set_page_config(page_title="VrijStaan | Dashboard", page_icon="🚐", layout="wide")

def app():
    # 1. Stijl en Sidebar Layout
    apply_theme()
    render_sidebar_header()
    
    # 2. Data inladen
    try:
        df = pd.read_csv("data/api_export_campers.csv")
    except FileNotFoundError:
        st.warning("⚠️ Geen database gevonden. Initialiseer de data in de Beheer-sectie.")
        return

    # 3. SIDEBAR FILTERS (De kracht van een Dashboard)
    with st.sidebar:
        st.subheader("🔍 Filters")
        
        # AI Zoekbalk in de sidebar voor snelle toegang
        ai_query = st.text_input("Slim zoeken (AI)", placeholder="Bijv: 'Gratis in Limburg'")
        
        st.divider()
        
        # Handmatige filters
        selected_prov = st.selectbox("Provincie", ["Alle provincies"] + sorted(df['provincie'].unique().tolist()))
        
        user_loc = st.text_input("Mijn Locatie", placeholder="Postcode of Stad")
        radius = st.slider("Zoekstraal (km)", 5, 150, 30)
        
        st.divider()
        st.caption("v1.2 | Coast & Horizon Editie")

    # 4. DATA VERWERKING
    processed_df = df.copy()
    
    # AI Filter
    if ai_query:
        processed_df, _ = process_ai_query(processed_df, ai_query)
        
    # Provincie Filter
    if selected_prov != "Alle provincies":
        processed_df = processed_df[processed_df['provincie'] == selected_prov]
        
    # Afstand Filter
    if user_loc:
        processed_df = filter_by_distance(processed_df, user_loc, radius)

    # 5. HOOFDSCHERM LAYOUT
    st.markdown(f"### 🚐 {len(processed_df)} Camperplaatsen gevonden")
    
    # Split-screen: Lijst (35%) | Kaart (65%)
    col_list, col_map = st.columns([3.5, 6.5])

    with col_list:
        # Scrollbare lijst met locaties
        for _, row in processed_df.iterrows():
            with st.container():
                c1, c2 = st.columns([1, 2])
                with c1:
                    st.image(row['afbeelding'], use_container_width=True)
                with c2:
                    st.markdown(f"**{row['naam']}**")
                    st.caption(f"📍 {row['provincie']} | 💰 {row['prijs']}")
                    
                    # Kleine actieknop per locatie
                    if st.button("Details", key=f"btn_{row['naam']}"):
                        st.toast(f"Website: {row['website']}")
                st.write("---")

    with col_map:
        # De kaart vult de rest van het scherm
        render_map(processed_df)

if __name__ == "__main__":
    app()
