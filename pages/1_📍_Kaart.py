"""
1_📍_Kaart.py — Hoofd-dashboard (Booking.com architectuur).
Zoeken staat centraal. Resultaten in een strakke lijst. Details via een pop-up inclusief mini-kaart.
"""
import pandas as pd
import streamlit as st
import folium
import streamlit.components.v1 as components

from ui.theme import apply_theme, render_sidebar_header, price_badge
from utils.ai_helper import process_ai_query
from utils.data_handler import load_data
from utils.favorites import get_favorites, is_favorite, toggle_favorite, init_favorites

st.set_page_config(page_title="VrijStaan | Zoeken", page_icon="🚐", layout="wide")
apply_theme()
render_sidebar_header()
init_favorites()

# ── 1. DETAIL DIALOG (Booking pop-up) ───────────────────────────────────────
@st.dialog("📍 Locatiedetails", width="large")
def show_detail(row):
    st.markdown(f"## {row['naam']}")
    st.markdown(f"<p style='color:#666; margin-top:-10px;'>📍 {row.get('provincie','Onbekend')}</p>", unsafe_allow_html=True)
    
    tab_info, tab_kaart = st.tabs(["📋 Informatie", "🗺️ Bekijk op Kaart"])
    
    with tab_info:
        c_img, c_specs = st.columns([1, 1.5])
        with c_img:
            img = str(row.get("afbeelding", ""))
            if img and img != "nan":
                st.image(img, use_container_width=True)
            
            fav = is_favorite(row["naam"])
            fav_label = "❤️ Verwijder uit favorieten" if fav else "🤍 Sla op als favoriet"
            if st.button(fav_label, key=f"fav_dialog_{row['naam']}", use_container_width=True):
                toggle_favorite(row["naam"])
                st.rerun()

        with c_specs:
            st.markdown(f"### Specificaties")
            st.markdown(f"💰 **Prijs per nacht:** {row.get('prijs','Onbekend')}")
            st.markdown(f"🏕️ **Aantal plekken:** {row.get('aantal_plekken','Onbekend')}")
            st.markdown(f"🕐 **Openingstijden:** {row.get('openingstijden','Onbekend')}")
            st.markdown("---")
            st.markdown(f"🐾 **Honden:** {row.get('honden_toegestaan','Onbekend')}")
            st.markdown(f"⚡ **Stroom:** {row.get('stroom','Onbekend')}")
            st.markdown(f"🌊 **Water(front):** {row.get('waterfront','Onbekend')}")
            
            tel = str(row.get("telefoon", "")).strip()
            web = str(row.get("website", "")).strip()
            
            st.markdown("---")
            if web and web != "nan":
                url = web if web.startswith("http") else f"https://{web}"
                st.markdown(f"🌐 [Website openen]({url})")
            if tel and tel != "nan":
                st.markdown(f"📞 [{tel}](tel:{tel})")

    with tab_kaart:
        # Laad uitsluitend een kaart voor deze ene specifieke locatie (razendsnel)
        lat, lon = row.get("latitude"), row.get("longitude")
        if pd.notna(lat) and pd.notna(lon):
            m = folium.Map(location=[float(lat), float(lon)], zoom_start=14, tiles="OpenStreetMap")
            folium.Marker(
                [float(lat), float(lon)], 
                popup=row['naam'], 
                icon=folium.Icon(color="green", icon="home")
            ).add_to(m)
            components.html(m._repr_html_(), height=400)
            
            gmaps = f"https://www.google.com/maps/search/?api=1&query={lat},{lon}"
            st.markdown(f"[📍 Navigeer via Google Maps]({gmaps})")

# ── 2. DATA LADEN ─────────────────────────────────────────────────────────────
with st.spinner("Camperplaatsen laden..."):
    df = load_data()

if df.empty:
    st.warning("⚠️ Geen database gevonden. Ga naar **Beheer** om de data te initialiseren.")
    st.stop()

# ── 3. ZIJBALK (Standaard Filters) ────────────────────────────────────────────
with st.sidebar:
    st.subheader("Geavanceerd Filteren")
    
    provincies_lijst = sorted([p for p in df["provincie"].unique() if p and p != "Onbekend"])
    selected_prov = st.selectbox("Provincie", ["Alle provincies"] + provincies_lijst)

    prijs_filter = st.selectbox("Prijs", ["Alle", "Gratis", "Betaald"])
    
    st.divider()
    toon_favorieten = st.checkbox("❤️ Mijn Favorieten tonen")

# ── 4. CENTRALE AI ZOEKBALK (Geoptimaliseerd) ──────────────────────────────────
with st.container():
    # Gebruik een form om te voorkomen dat hij bij elke letter herlaadt
    with st.form("search_form", clear_on_submit=False):
        col_search, col_btn = st.columns([4, 1])
        with col_search:
            user_input = st.text_input(
                "Waar wil je heen?", 
                placeholder="Bijv: 'Gratis plek in Drenthe met stroom'",
                label_visibility="collapsed"
            )
        with col_btn:
            submit_search = st.form_submit_button("🔍 Zoek", use_container_width=True)

    # Alleen de AI triggeren als er echt op de knop is gedrukt
    if submit_search and user_input:
        st.session_state['ai_search_query'] = user_input
        # (De rest van je AI-filter logica hieronder)

# ── 5. SNELFILTERS (Gebaseerd op de analyse) ──────────────────────────────────
st.write("")
sf_col1, sf_col2, sf_col3, sf_col4, sf_col5 = st.columns(5)

# Session state voor snelfilters
if 'qf_gratis' not in st.session_state: st.session_state.qf_gratis = False
if 'qf_honden' not in st.session_state: st.session_state.qf_honden = False
if 'qf_stroom' not in st.session_state: st.session_state.qf_stroom = False
if 'qf_water' not in st.session_state: st.session_state.qf_water = False

with sf_col2:
    if st.button("💰 Gratis", use_container_width=True, type="primary" if st.session_state.qf_gratis else "secondary"):
        st.session_state.qf_gratis = not st.session_state.qf_gratis
        st.rerun()
with sf_col3:
    if st.button("🐾 Honden Welkom", use_container_width=True, type="primary" if st.session_state.qf_honden else "secondary"):
        st.session_state.qf_honden = not st.session_state.qf_honden
        st.rerun()
with sf_col4:
    if st.button("⚡ Met Stroom", use_container_width=True, type="primary" if st.session_state.qf_stroom else "secondary"):
        st.session_state.qf_stroom = not st.session_state.qf_stroom
        st.rerun()

st.divider()

# ── 6. DATA FILTEREN ──────────────────────────────────────────────────────────
processed = df.copy()
ai_labels = []

if ai_query:
    processed, ai_labels = process_ai_query(processed, ai_query)

if selected_prov != "Alle provincies":
    processed = processed[processed["provincie"] == selected_prov]

if prijs_filter == "Gratis" or st.session_state.qf_gratis:
    processed = processed[processed["prijs"].astype(str).str.lower() == "gratis"]
elif prijs_filter == "Betaald":
    processed = processed[processed["prijs"].astype(str).str.lower() != "gratis"]

if st.session_state.qf_honden:
    processed = processed[processed["honden_toegestaan"] == "Ja"]

if st.session_state.qf_stroom:
    processed = processed[processed["stroom"] == "Ja"]

if toon_favorieten:
    favs = get_favorites()
    processed = processed[processed["naam"].isin(favs)]

# ── 7. RESULTATENLIJST (Booking.com stijl) ────────────────────────────────────
st.markdown(f"### {len(processed)} accommodaties gevonden")

if ai_labels:
    st.markdown(f"**Geïnterpreteerd door AI:** {', '.join(ai_labels)}")

if processed.empty:
    st.info("Geen resultaten gevonden. Probeer je zoekopdracht aan te passen.")
    st.stop()

# We tonen de resultaten met een schone layout
for idx, row in processed.head(100).iterrows(): # Lazy load eerste 100 voor snelheid
    with st.container(border=True):
        c_img, c_text, c_btn = st.columns([1.5, 4, 1.5])
        
        with c_img:
            # Fallback image als er geen is
            img = str(row.get("afbeelding", ""))
            if not img or img == "nan":
                img = "https://images.unsplash.com/photo-1523987355523-c7b5b0dd90a7?auto=format&fit=crop&w=300&q=80"
            st.image(img, use_container_width=True)
            
        with c_text:
            st.markdown(f"#### {row['naam']}")
            st.markdown(f"<p style='color:#666; font-size:0.9rem; margin-top:-10px;'>📍 {row.get('provincie', 'Onbekend')}</p>", unsafe_allow_html=True)
            
            # Subtiele snelinformatie
            faciliteiten = []
            if str(row.get('honden_toegestaan')) == 'Ja': faciliteiten.append("🐾 Honden")
            if str(row.get('stroom')) == 'Ja': faciliteiten.append("⚡ Stroom")
            if str(row.get('waterfront')) == 'Ja': faciliteiten.append("🌊 Water")
            
            if faciliteiten:
                st.markdown(f"<p style='font-size:0.85rem; color:#2A5A4A;'>{' | '.join(faciliteiten)}</p>", unsafe_allow_html=True)
                
        with c_btn:
            prijs_str = str(row.get("prijs", "Onbekend"))
            st.markdown(f"<div style='text-align:center; margin-bottom:10px;'>{price_badge(prijs_str)}</div>", unsafe_allow_html=True)
            
            if st.button("🔍 Bekijk details", key=f"btn_{idx}", use_container_width=True):
                show_detail(row)

if len(processed) > 100:
    st.caption("Scroll verder of gebruik de filters om meer specifieke resultaten te vinden.")
