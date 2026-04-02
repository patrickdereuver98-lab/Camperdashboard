import streamlit as st
from ui.theme import apply_theme, render_logo

st.set_page_config(
    page_title="VrijStaan | Camperplaatsen",
    page_icon="🚐",
    layout="wide",
    initial_sidebar_state="expanded"
)

apply_theme()

# --- HERO SECTIE ---
render_logo()

st.markdown(
    """
    <div style="text-align: center; max-width: 700px; margin: 0 auto 2.5rem auto;">
        <p style="font-size: 1.15rem; color: #2C3E50; line-height: 1.7;">
            Vind de perfecte camperplaats in Nederland — gratis, betaald of afgelegen.
            Filter op provincie, afstand of gebruik onze <strong>AI-zoekbalk</strong> 
            om in gewone taal te zoeken.
        </p>
    </div>
    """,
    unsafe_allow_html=True
)

# --- FEATURE KAARTEN ---
col1, col2, col3 = st.columns(3)

with col1:
    st.markdown(
        """
        <div style="background:#E8F4F1; border-left: 4px solid #2A5A4A; 
                    border-radius: 8px; padding: 1.2rem; height: 140px;">
            <h3 style="margin-top:0; color:#2A5A4A;">🗺️ Interactieve Kaart</h3>
            <p style="color:#2C3E50; margin:0; font-size:0.95rem;">
                Bekijk alle camperplaatsen op een klikbare kaart met 
                pop-ups vol details.
            </p>
        </div>
        """,
        unsafe_allow_html=True
    )

with col2:
    st.markdown(
        """
        <div style="background:#FFF8EC; border-left: 4px solid #FFB703; 
                    border-radius: 8px; padding: 1.2rem; height: 140px;">
            <h3 style="margin-top:0; color:#B37D00;">🤖 AI Smart Search</h3>
            <p style="color:#2C3E50; margin:0; font-size:0.95rem;">
                Zoek op naturlijke taal: <em>"Gratis in Drenthe met hond"</em> 
                en de AI doet de rest.
            </p>
        </div>
        """,
        unsafe_allow_html=True
    )

with col3:
    st.markdown(
        """
        <div style="background:#EEF2F7; border-left: 4px solid #2C3E50; 
                    border-radius: 8px; padding: 1.2rem; height: 140px;">
            <h3 style="margin-top:0; color:#2C3E50;">📍 Radius Zoeken</h3>
            <p style="color:#2C3E50; margin:0; font-size:0.95rem;">
                Vul je postcode of stad in en vind alle plekken binnen 
                jouw gekozen straal.
            </p>
        </div>
        """,
        unsafe_allow_html=True
    )

st.markdown("<br>", unsafe_allow_html=True)

# --- CTA KNOP ---
col_center = st.columns([2, 1, 2])[1]
with col_center:
    if st.button("🚐 Bekijk alle camperplaatsen", use_container_width=True):
        st.switch_page("pages/1_📍_Kaart.py")

st.markdown("<br><br>", unsafe_allow_html=True)
st.divider()

# --- STATISTIEKEN BALK ---
import os, pandas as pd

stats_col1, stats_col2, stats_col3, stats_col4 = st.columns(4)

try:
    master_df = pd.read_csv("data/api_export_campers.csv")
    total = len(master_df)
    gratis = len(master_df[master_df['prijs'].astype(str).str.lower() == 'gratis']) if 'prijs' in master_df.columns else "–"
    honden = len(master_df[master_df['honden_toegestaan'].astype(str) == 'Ja']) if 'honden_toegestaan' in master_df.columns else "–"
    provincies = master_df['provincie'].nunique() if 'provincie' in master_df.columns else "–"
except Exception:
    total, gratis, honden, provincies = "–", "–", "–", "–"

with stats_col1:
    st.metric("🏕️ Totaal locaties", total)
with stats_col2:
    st.metric("💰 Gratis plekken", gratis)
with stats_col3:
    st.metric("🐾 Honden welkom", honden)
with stats_col4:
    st.metric("🗺️ Provincies", provincies)
