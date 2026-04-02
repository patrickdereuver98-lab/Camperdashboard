"""
main.py — VrijStaan landingspagina.
"""
import os
import pandas as pd
import streamlit as st
from ui.theme import apply_theme, render_logo

st.set_page_config(
    page_title="VrijStaan | Camperplaatsen Nederland",
    page_icon="🚐",
    layout="wide",
    initial_sidebar_state="expanded",
)
apply_theme()
render_logo()

st.markdown("""
<div style="text-align:center;max-width:680px;margin:0 auto 2.5rem auto;">
    <p style="font-size:1.12rem;color:#2C3E50;line-height:1.75;">
        Vind de perfecte camperplaats in Nederland — gratis, betaald of afgelegen.
        Filter op provincie, afstand of gebruik de <strong>AI-zoekbalk</strong>
        om in gewone taal te zoeken.
    </p>
</div>
""", unsafe_allow_html=True)

c1, c2, c3 = st.columns(3)
cards = [
    (c1, "#E8F4F1", "#2A5A4A", "🗺️ Interactieve Kaart",
     "Alle camperplaatsen op een klikbare kaart met pop-ups vol details."),
    (c2, "#FFF8EC", "#B37D00", "🤖 AI Smart Search",
     'Zoek op natuurlijke taal: <em>"Gratis in Drenthe met hond"</em>.'),
    (c3, "#EEF2F7", "#2C3E50", "📍 Radius Zoeken",
     "Vul je postcode of stad in en vind plekken binnen jouw gekozen straal."),
]
for col, bg, hcol, title, desc in cards:
    with col:
        st.markdown(f"""
        <div style="background:{bg};border-left:4px solid {hcol};
                    border-radius:8px;padding:1.2rem;min-height:130px;">
            <h3 style="margin-top:0;color:{hcol};">{title}</h3>
            <p style="color:#2C3E50;margin:0;font-size:0.93rem;">{desc}</p>
        </div>""", unsafe_allow_html=True)

st.markdown("<br>", unsafe_allow_html=True)

_, mid, _ = st.columns([2, 1, 2])
with mid:
    if st.button("🚐 Bekijk alle camperplaatsen", use_container_width=True):
        st.switch_page("pages/1_📍_Kaart.py")

st.markdown("<br>", unsafe_allow_html=True)
st.divider()

# Live statistieken
CSV = "data/api_export_campers.csv"
try:
    mdf = pd.read_csv(CSV)
    total = len(mdf)
    gratis = len(mdf[mdf["prijs"].astype(str).str.lower() == "gratis"]) if "prijs" in mdf.columns else "–"
    honden = len(mdf[mdf["honden_toegestaan"].astype(str) == "Ja"]) if "honden_toegestaan" in mdf.columns else "–"
    provincies = mdf["provincie"].nunique() if "provincie" in mdf.columns else "–"
    bijgewerkt = mdf["bijgewerkt_op"].max() if "bijgewerkt_op" in mdf.columns else "–"
except Exception:
    total, gratis, honden, provincies, bijgewerkt = "–", "–", "–", "–", "–"

s1, s2, s3, s4 = st.columns(4)
s1.metric("🏕️ Locaties", total)
s2.metric("💰 Gratis", gratis)
s3.metric("🐾 Honden welkom", honden)
s4.metric("🗺️ Provincies", provincies)

if bijgewerkt != "–":
    st.caption(f"Laatste datasync: {bijgewerkt}")
