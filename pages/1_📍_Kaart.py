"""
1_📍_Kaart.py — Hoofd-dashboard met kaart, filters, detail-dialog en favorieten.

Fase 2/3 fixes:
- Lege dataset afhandeling (#7)
- Detail-dialog per locatie (#9)
- Favorieten-knop (#10)
- MarkerCluster via map_view (#11)
- Stroom/waterfront filters in sidebar
"""

import pandas as pd
import streamlit as st

from ui.map_view import render_map
from ui.theme import apply_theme, render_sidebar_header, price_badge
from utils.ai_helper import process_ai_query
from utils.data_handler import load_data
from utils.favorites import get_favorites, is_favorite, toggle_favorite, init_favorites
from utils.geo_logic import filter_by_distance

st.set_page_config(page_title="VrijStaan | Dashboard", page_icon="🚐", layout="wide")
apply_theme()
render_sidebar_header()
init_favorites()


@st.dialog("📍 Locatiedetails", width="large")
def show_detail(row):
    c_img, c_info = st.columns([1, 1.6])
    with c_img:
        img = str(row.get("afbeelding", ""))
        if img and img != "nan":
            st.image(img, use_container_width=True)
        else:
            st.markdown("🏕️ *Geen foto beschikbaar*")
    with c_info:
        st.markdown(f"## {row['naam']}")
        fav = is_favorite(row["naam"])
        fav_label = "❤️ Verwijder uit favorieten" if fav else "🤍 Sla op als favoriet"
        if st.button(fav_label, key=f"fav_dialog_{row['naam']}"):
            toggle_favorite(row["naam"])
            st.rerun()
        st.markdown("---")
        st.markdown(f"📍 **Provincie:** {row.get('provincie','–')}")
        st.markdown(f"💰 **Prijs:** {row.get('prijs','–')}")
        st.markdown(f"🐾 **Honden toegestaan:** {row.get('honden_toegestaan','–')}")
        st.markdown(f"⚡ **Stroom:** {row.get('stroom','–')}")
        st.markdown(f"🌊 **Aan het water:** {row.get('waterfront','–')}")
        st.markdown(f"🏕️ **Aantal plekken:** {row.get('aantal_plekken','–')}")
        st.markdown(f"🕐 **Openingstijden:** {row.get('openingstijden','–')}")

    st.markdown("---")
    col_tel, col_web = st.columns(2)
    tel = str(row.get("telefoon", "")).strip()
    web = str(row.get("website", "")).strip()
    with col_tel:
        if tel and tel != "nan":
            st.markdown(f"📞 [{tel}](tel:{tel})")
    with col_web:
        if web and web != "nan":
            url = web if web.startswith("http") else f"https://{web}"
            st.markdown(f"🌐 [Website openen]({url})")

    beschr = str(row.get("beschrijving", "")).strip()
    if beschr and beschr not in ("nan", "Demo locatie", ""):
        st.markdown(f"**Over deze locatie:** {beschr}")

    lat, lon = row.get("latitude"), row.get("longitude")
    if lat and lon:
        gmaps = f"https://www.google.com/maps/search/?api=1&query={lat},{lon}"
        st.markdown(f"[📍 Open in Google Maps]({gmaps})")


# ── DATA LADEN ─────────────────────────────────────────────────────────────
with st.spinner("Camperplaatsen laden..."):
    df = load_data()

if df.empty:
    st.warning("⚠️ Geen database gevonden. Ga naar **Beheer** om de data te initialiseren.")
    st.stop()

# ── SIDEBAR FILTERS ─────────────────────────────────────────────────────────
with st.sidebar:
    st.subheader("🔍 Filters")

# Haal de eventuele zoekopdracht op van de landingspagina
    default_query = st.session_state.get('ai_search_query', "")

    ai_query = st.text_input(
        "Slim zoeken (AI)",
        value=default_query, # Hier injecteren we de tekst!
        placeholder="Bijv: 'Gratis in Limburg met stroom'",
        help="Gebruik natuurlijke taal — de AI vertaalt dit naar filters.",
    )
    
    # Update de sessie als de gebruiker de zoekopdracht op de kaart-pagina aanpast
    if ai_query != default_query:
        st.session_state['ai_search_query'] = ai_query

    st.divider()

    provincies_lijst = sorted([p for p in df["provincie"].unique() if p and p != "Onbekend"])
    selected_prov = st.selectbox("Provincie", ["Alle provincies"] + provincies_lijst)

    prijs_filter = st.selectbox("Prijs", ["Alle", "Gratis", "Betaald"])
    honden_filter = st.selectbox("Honden toegestaan", ["Alle", "Ja", "Nee"])
    stroom_filter = st.selectbox("Stroom aanwezig", ["Alle", "Ja", "Nee"])
    water_filter = st.selectbox("Aan het water", ["Alle", "Ja"])

    st.divider()

    user_loc = st.text_input("Mijn locatie", placeholder="Postcode of plaatsnaam")
    radius = st.slider("Zoekstraal (km)", 5, 200, 50)

    toon_favorieten = st.checkbox("❤️ Alleen favorieten")

    st.divider()
    st.caption("v2.0 | Coast & Horizon Editie")

# Zorg dat deze import bovenaan je bestand staat als hij er nog niet staat:
# import streamlit as st

# ── DATA VERWERKING ──────────────────────────────────────────────────────────
processed = df.copy()
ai_labels = []

if ai_query:
    processed, ai_labels = process_ai_query(processed, ai_query)

if selected_prov != "Alle provincies":
    processed = processed[processed["provincie"] == selected_prov]

# Checken voor snelfilters uit de KPI tegels (Sessie geheugen)
if st.session_state.get('quick_filter_gratis'):
    processed = processed[processed["prijs"].astype(str).str.lower() == "gratis"]
if st.session_state.get('quick_filter_honden'):
    processed = processed[processed["honden_toegestaan"] == "Ja"]

# ... (Je bestaande radius en stroom/water filters hier) ...

# ── HET KPI DASHBOARD (Interactieve Tegels) ──────────────────────────────────
st.markdown("### 📊 In één oogopslag")

# Bereken de statistieken van de HUIDIGE selectie
totaal_aantal = len(processed)
gratis_aantal = len(processed[processed["prijs"].astype(str).str.lower() == "gratis"])
honden_aantal = len(processed[processed["honden_toegestaan"] == "Ja"])
stroom_aantal = len(processed[processed["stroom"] == "Ja"])

kpi1, kpi2, kpi3, kpi4 = st.columns(4)

with kpi1:
    with st.container(border=True):
        st.metric(label="🏕️ Totaal Gevonden", value=totaal_aantal)
        if st.button("Reset Filters", use_container_width=True):
            st.session_state['quick_filter_gratis'] = False
            st.session_state['quick_filter_honden'] = False
            st.rerun()

with kpi2:
    with st.container(border=True):
        st.metric(label="💰 Gratis Plekken", value=gratis_aantal)
        if st.button("Toon Gratis", key="btn_gratis", use_container_width=True):
            st.session_state['quick_filter_gratis'] = True
            st.rerun()

with kpi3:
    with st.container(border=True):
        st.metric(label="🐾 Honden Welkom", value=honden_aantal)
        if st.button("Toon Honden", key="btn_honden", use_container_width=True):
            st.session_state['quick_filter_honden'] = True
            st.rerun()

with kpi4:
    with st.container(border=True):
        st.metric(label="⚡ Met Stroom", value=stroom_aantal)
        # Optioneel: stroom knop toevoegen volgens dezelfde logica

st.markdown("---")

# ── HOOFDLAYOUT: LIJST | KAART ────────────────────────────────────────────────
col_list, col_map = st.columns([3.5, 6.5])

with col_list:
    with st.container(height=650, border=False):
        # ... (Je bestaande lijst-weergave code hier) ...
        for idx, row in processed.head(80).iterrows():
            pass # (Laat je bestaande cards hier staan)

with col_map:
    # 🚀 PRESTATIE-HACK: Bescherm de browser tegen overbelasting
    MAX_MARKERS = 250
    kaart_df = processed.head(MAX_MARKERS)
    
    if totaal_aantal > MAX_MARKERS:
        st.warning(f"⚠️ Om de kaart snel te houden, tonen we de top {MAX_MARKERS} van de {totaal_aantal} locaties. Gebruik de filters of KPI-tegels om verder in te zoomen.")
        
    render_map(kaart_df)

# ── HEADER ───────────────────────────────────────────────────────────────────
st.markdown(f"### 🚐 {len(processed)} camperplaatsen gevonden")

if ai_labels:
    tags_html = " ".join(f'<span class="filter-tag">{t}</span>' for t in ai_labels)
    st.markdown(f"**AI filters actief:** {tags_html}", unsafe_allow_html=True)

if processed.empty:
    st.info("😕 Geen camperplaatsen gevonden met deze filters. Pas je zoekopdracht aan.")
    st.stop()

# ── HOOFDLAYOUT: LIJST | KAART ────────────────────────────────────────────────
col_list, col_map = st.columns([3.5, 6.5])

with col_list:
    # Native Streamlit scroll-container in plaats van HTML hacks
    with st.container(height=650, border=False):
        for idx, row in processed.head(80).iterrows():
            fav_icon = "❤️" if is_favorite(row["naam"]) else "🤍"
            prijs_str = str(row.get("prijs", "Onbekend"))
            afstand = f' · {row["afstand_label"]}' if "afstand_label" in row else ""

            # Schone opmaak van de locatiekaart
            st.markdown(f"""
            <div class="locatie-card">
                <div style="font-size: 1.1rem; font-weight: 700; color: #2B2D42;">{row['naam']}</div>
                <div style="color: #6c757d; font-size: 0.85rem; margin-bottom: 8px;">📍 {row['provincie']}{afstand}</div>
                <div>
                    {price_badge(prijs_str)}
                    {'<span class="badge badge-facility">🐾 Honden</span>' if str(row.get('honden_toegestaan')) == 'Ja' else ''}
                    {'<span class="badge badge-facility">⚡ Stroom</span>' if str(row.get('stroom')) == 'Ja' else ''}
                    {'<span class="badge badge-facility">🌊 Water</span>' if str(row.get('waterfront')) == 'Ja' else ''}
                </div>
            </div>
            """, unsafe_allow_html=True)

            btn_c1, btn_c2 = st.columns([3, 1])
            with btn_c1:
                if st.button("🔍 Details", key=f"detail_{idx}", use_container_width=True):
                    show_detail(row)
            with btn_c2:
                if st.button(fav_icon, key=f"fav_{idx}", help="Favoriet aan/uit"):
                    toggle_favorite(row["naam"])
                    st.rerun()
                    
        if len(processed) > 80:
            st.caption(f"Top 80 van {len(processed)} getoond. Gebruik filters om te verfijnen.")

with col_map:
    # Zorg dat de kaart de volledige hoogte pakt
    render_map(processed)
