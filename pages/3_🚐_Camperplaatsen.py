"""
3_🚐_Camperplaatsen.py — Premium Zoek & Ontdek Dashboard voor VrijStaan.
Design: Refined Dutch Coastal — strakke structuur, diepe oceaanblauw, zandgeel accenten.
Frontend only: roept uitsluitend utils/data_handler.py en utils/ai_helper.py aan.
"""

import pandas as pd
import streamlit as st
import folium
import streamlit.components.v1 as components

from ui.theme import render_sidebar_header
from utils.ai_helper import process_ai_query
from utils.data_handler import load_data
from utils.favorites import get_favorites, toggle_favorite, init_favorites

# ─────────────────────────────────────────────────────────────────────────────
# PAGINA CONFIGURATIE
# ─────────────────────────────────────────────────────────────────────────────
st.set_page_config(
    page_title="VrijStaan | Camperplaatsen",
    page_icon="🚐",
    layout="wide",
    initial_sidebar_state="expanded",
)

render_sidebar_header()
init_favorites()

# ─────────────────────────────────────────────────────────────────────────────
# PREMIUM CSS — Dutch Coastal Design System
# ─────────────────────────────────────────────────────────────────────────────
st.markdown("""
<style>
    /* ── 0. Google Fonts ── */
    @import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=DM+Sans:wght@300;400;500;600&display=swap');

    /* ── 1. Globale Reset & Achtergrond ── */
    html, body, [data-testid="stAppViewContainer"] {
        background-color: #F4F7FB !important;
    }
    [data-testid="stSidebarNav"] { display: none !important; }

    /* ── 2. Typografie ── */
    h1, h2, h3, h4 {
        font-family: 'DM Serif Display', Georgia, serif !important;
        color: #0A2540 !important;
    }
    p, span, div, label, .stMarkdown {
        font-family: 'DM Sans', sans-serif !important;
    }

    /* ── 3. Hero Zoek-sectie ── */
    .hero-wrap {
        background: linear-gradient(135deg, #0A2540 0%, #0077B6 55%, #00B4D8 100%);
        border-radius: 20px;
        padding: 2.8rem 2.4rem 2.2rem;
        margin-bottom: 1.6rem;
        position: relative;
        overflow: hidden;
    }
    .hero-wrap::before {
        content: '';
        position: absolute;
        top: -60px; right: -60px;
        width: 260px; height: 260px;
        border-radius: 50%;
        background: rgba(255,183,3,0.12);
    }
    .hero-wrap::after {
        content: '';
        position: absolute;
        bottom: -80px; left: 30px;
        width: 200px; height: 200px;
        border-radius: 50%;
        background: rgba(0,180,216,0.18);
    }
    .hero-title {
        font-family: 'DM Serif Display', Georgia, serif !important;
        font-size: 2.1rem;
        color: #FFFFFF !important;
        margin: 0 0 0.3rem 0;
        position: relative; z-index: 1;
    }
    .hero-sub {
        font-family: 'DM Sans', sans-serif;
        color: rgba(255,255,255,0.78);
        font-size: 1rem;
        margin: 0 0 1.4rem 0;
        position: relative; z-index: 1;
    }

    /* ── 4. AI Zoekbalk ── */
    .stTextInput > div > div > input {
        border-radius: 12px !important;
        border: 2px solid #E0E8F0 !important;
        font-family: 'DM Sans', sans-serif !important;
        font-size: 1rem !important;
        padding: 0.75rem 1rem !important;
        background: #fff !important;
        box-shadow: 0 2px 12px rgba(0,0,0,0.05) !important;
        transition: border-color 0.2s, box-shadow 0.2s !important;
    }
    .stTextInput > div > div > input:focus {
        border-color: #0077B6 !important;
        box-shadow: 0 0 0 3px rgba(0,119,182,0.18) !important;
    }

    /* ── 5. Snelfilter Chips ── */
    .chip-row {
        display: flex; flex-wrap: wrap; gap: 8px;
        margin: 0.8rem 0 1.2rem 0;
        position: relative; z-index: 1;
    }
    .chip {
        display: inline-flex; align-items: center; gap: 5px;
        background: rgba(255,255,255,0.15);
        border: 1px solid rgba(255,255,255,0.3);
        color: white; border-radius: 20px;
        padding: 5px 14px; font-size: 0.82rem;
        font-family: 'DM Sans', sans-serif;
        cursor: pointer; transition: all 0.15s;
        user-select: none;
    }
    .chip.active {
        background: #FFB703;
        border-color: #FFB703;
        color: #0A2540;
        font-weight: 600;
    }

    /* ── 6. Filter Panel (Sidebar) ── */
    [data-testid="stSidebar"] {
        background: #FFFFFF !important;
        border-right: 1px solid #E8EEF5 !important;
    }
    .filter-header {
        font-family: 'DM Serif Display', serif;
        font-size: 1rem;
        color: #0A2540;
        margin: 0.5rem 0 0.3rem 0;
        padding-bottom: 4px;
        border-bottom: 2px solid #FFB703;
        display: inline-block;
    }
    [data-testid="stSidebar"] .stCheckbox label {
        font-family: 'DM Sans', sans-serif !important;
        font-size: 0.9rem !important;
        color: #3A4A5C !important;
    }
    [data-testid="stSidebar"] .stSelectbox label,
    [data-testid="stSidebar"] .stMultiSelect label,
    [data-testid="stSidebar"] .stSlider label {
        font-family: 'DM Sans', sans-serif !important;
        font-size: 0.82rem !important;
        font-weight: 600 !important;
        color: #6B7F94 !important;
        text-transform: uppercase;
        letter-spacing: 0.06em;
    }

    /* ── 7. Resultaten teller ── */
    .result-count {
        font-family: 'DM Serif Display', serif;
        font-size: 1.4rem;
        color: #0A2540;
        margin-bottom: 0.2rem;
    }
    .result-sub {
        font-family: 'DM Sans', sans-serif;
        font-size: 0.85rem;
        color: #6B7F94;
        margin-bottom: 1rem;
    }

    /* ── 8. Locatie Card ── */
    .loc-card {
        background: #FFFFFF;
        border-radius: 14px;
        border: 1px solid #E8EEF5;
        overflow: hidden;
        box-shadow: 0 2px 8px rgba(10,37,64,0.05);
        transition: transform 0.18s, box-shadow 0.18s;
        margin-bottom: 1rem;
        display: flex;
        flex-direction: row;
        height: 148px;
    }
    .loc-card:hover {
        transform: translateY(-2px);
        box-shadow: 0 8px 24px rgba(10,37,64,0.10);
    }
    .loc-card-img {
        width: 160px;
        min-width: 160px;
        object-fit: cover;
        background: #D0E4F0;
    }
    .loc-card-body {
        padding: 0.9rem 1rem;
        flex: 1;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        overflow: hidden;
    }
    .loc-card-name {
        font-family: 'DM Serif Display', serif;
        font-size: 1rem;
        color: #0A2540;
        margin: 0 0 2px 0;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }
    .loc-card-location {
        font-family: 'DM Sans', sans-serif;
        font-size: 0.78rem;
        color: #8A9DB5;
        margin: 0 0 6px 0;
    }
    .loc-card-badges {
        display: flex; flex-wrap: wrap; gap: 4px;
        margin-bottom: 6px;
    }
    .lbadge {
        display: inline-flex; align-items: center; gap: 3px;
        font-family: 'DM Sans', sans-serif;
        font-size: 0.7rem; font-weight: 600;
        padding: 2px 7px; border-radius: 5px;
    }
    .lbadge-stroom { background:#EDF4FF; color:#0077B6; }
    .lbadge-honden { background:#FFF4E5; color:#B76300; }
    .lbadge-wifi   { background:#EDFAF3; color:#1A7F5A; }
    .lbadge-water  { background:#E8F5FF; color:#005A8C; }
    .lbadge-gratis { background:#E8F5E9; color:#2E7D32; font-weight:700; }
    .lbadge-betaald { background:#FFF3E0; color:#E65100; }
    .lbadge-onbekend { background:#F5F5F5; color:#757575; }

    /* ── 9. Kaart Container ── */
    .map-wrap {
        border-radius: 16px;
        overflow: hidden;
        box-shadow: 0 4px 20px rgba(10,37,64,0.10);
        border: 1px solid #D8E6F0;
    }

    /* ── 10. AI Badge ── */
    .ai-filter-tag {
        display: inline-flex; align-items: center; gap: 6px;
        background: linear-gradient(90deg, #0A2540, #0077B6);
        color: white; border-radius: 20px;
        padding: 4px 12px; font-size: 0.78rem;
        font-family: 'DM Sans', sans-serif;
        margin: 3px 3px 3px 0;
    }

    /* ── 11. Knop override ── */
    .stButton > button {
        font-family: 'DM Sans', sans-serif !important;
        border-radius: 10px !important;
        font-weight: 600 !important;
        transition: all 0.18s !important;
    }
    .stButton > button[kind="primary"] {
        background: #0077B6 !important;
        border: none !important;
        color: white !important;
    }
    .stButton > button[kind="primary"]:hover {
        background: #005F8E !important;
        transform: translateY(-1px);
    }
    .stButton > button[kind="secondary"] {
        border: 1.5px solid #C8D9E8 !important;
        color: #3A4A5C !important;
        background: white !important;
    }
    .stButton > button[kind="secondary"]:hover {
        border-color: #0077B6 !important;
        color: #0077B6 !important;
    }

    /* ── 12. Divider override ── */
    hr { border-color: #E8EEF5 !important; }

    /* ── 13. Geen resultaten ── */
    .no-results {
        text-align: center; padding: 3rem 1rem;
        color: #8A9DB5;
        font-family: 'DM Sans', sans-serif;
    }
    .no-results-icon { font-size: 3rem; margin-bottom: 1rem; }

    /* ── 14. Score Pill ── */
    .score-pill {
        display: inline-flex; align-items: center;
        background: #0077B6; color: white;
        border-radius: 8px; padding: 2px 8px;
        font-size: 0.75rem; font-weight: 700;
        font-family: 'DM Sans', sans-serif;
    }
</style>
""", unsafe_allow_html=True)


# ─────────────────────────────────────────────────────────────────────────────
# SESSIE STATE INITIALISATIE
# ─────────────────────────────────────────────────────────────────────────────
for key, default in [
    ("ai_query_cp", ""),
    ("ai_active_filters", []),
    ("qf_gratis", False),
    ("qf_honden", False),
    ("qf_stroom", False),
    ("qf_wifi", False),
    ("qf_water", False),
    ("show_map", True),
]:
    if key not in st.session_state:
        st.session_state[key] = default


# ─────────────────────────────────────────────────────────────────────────────
# HULPFUNCTIES
# ─────────────────────────────────────────────────────────────────────────────
def price_badge_html(prijs: str) -> str:
    p = str(prijs).strip().lower()
    if p == "gratis":
        return '<span class="lbadge lbadge-gratis">💰 Gratis</span>'
    elif p in ("onbekend", "nan", "", "none"):
        return '<span class="lbadge lbadge-onbekend">❓ Prijs onbekend</span>'
    else:
        return f'<span class="lbadge lbadge-betaald">💶 {prijs}</span>'


def facility_badges(row) -> str:
    badges = []
    if str(row.get("stroom", "")).lower() == "ja":
        badges.append('<span class="lbadge lbadge-stroom">⚡ Stroom</span>')
    if str(row.get("honden_toegestaan", "")).lower() == "ja":
        badges.append('<span class="lbadge lbadge-honden">🐾 Honden</span>')
    if str(row.get("wifi", "")).lower() == "ja":
        badges.append('<span class="lbadge lbadge-wifi">📶 Wifi</span>')
    if str(row.get("water_tanken", "")).lower() == "ja":
        badges.append('<span class="lbadge lbadge-water">🚰 Water</span>')
    return "".join(badges)


def format_score(raw) -> str:
    val = str(raw).strip()
    if val in ("", "nan", "None", "Onbekend", "–"):
        return ""
    try:
        float(val.replace(",", "."))
        return f'<span class="score-pill">⭐ {val}</span>'
    except ValueError:
        return f'<span class="score-pill">⭐ {val}</span>'


def build_folium_map(df_map: pd.DataFrame) -> folium.Map:
    """Bouw een strakke Folium kaart met marker clusters."""
    # Centreer op Nederland als er geen data is
    if df_map.empty:
        center = [52.3, 5.3]
        zoom = 7
    else:
        center = [df_map["latitude"].mean(), df_map["longitude"].mean()]
        zoom = 8 if len(df_map) > 5 else 10

    m = folium.Map(
        location=center,
        zoom_start=zoom,
        tiles=None,
        prefer_canvas=True,
    )
    # Strakke kaart tile
    folium.TileLayer(
        tiles="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
        attr='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>',
        name="Voyager",
        max_zoom=19,
    ).add_to(m)

    # Custom camper icoon
    camper_icon_html = """
    <div style="
        background: #0077B6; border-radius: 50% 50% 50% 0;
        width: 30px; height: 30px;
        transform: rotate(-45deg);
        border: 3px solid white;
        box-shadow: 0 2px 6px rgba(0,0,0,0.3);
        display:flex; align-items:center; justify-content:center;
    ">
        <span style="transform:rotate(45deg); font-size:13px;">🚐</span>
    </div>
    """

    for _, row in df_map.iterrows():
        try:
            lat, lon = float(row["latitude"]), float(row["longitude"])
        except (ValueError, TypeError):
            continue

        prijs = str(row.get("prijs", "Onbekend"))
        naam = str(row.get("naam", "Onbekend"))
        prov = str(row.get("provincie", ""))
        honden = "✅" if str(row.get("honden_toegestaan", "")).lower() == "ja" else "❌"
        stroom = "✅" if str(row.get("stroom", "")).lower() == "ja" else "❌"

        popup_html = f"""
        <div style="font-family:'DM Sans',sans-serif; min-width:180px;">
            <div style="font-weight:700; font-size:0.95rem; color:#0A2540; margin-bottom:4px;">{naam}</div>
            <div style="color:#8A9DB5; font-size:0.8rem; margin-bottom:6px;">📍 {prov}</div>
            <div style="display:flex; gap:8px; font-size:0.78rem;">
                <span>🐾 {honden}</span>
                <span>⚡ {stroom}</span>
            </div>
            <div style="margin-top:6px; font-weight:600; color:#0077B6; font-size:0.85rem;">💶 {prijs}</div>
        </div>
        """

        folium.Marker(
            location=[lat, lon],
            popup=folium.Popup(popup_html, max_width=220),
            tooltip=naam,
            icon=folium.DivIcon(
                html=camper_icon_html,
                icon_size=(30, 30),
                icon_anchor=(15, 30),
            ),
        ).add_to(m)

    return m


# ─────────────────────────────────────────────────────────────────────────────
# DATA LADEN
# ─────────────────────────────────────────────────────────────────────────────
@st.cache_data(ttl=300, show_spinner=False)
def get_data():
    return load_data()

with st.spinner("📡 Database laden..."):
    df = get_data()

if df.empty:
    st.warning("⚠️ Geen database gevonden of Google Sheet is leeg. Ga naar **Beheer** om data te initialiseren.")
    st.stop()


# ─────────────────────────────────────────────────────────────────────────────
# SIDEBAR — GEAVANCEERDE FILTERS
# ─────────────────────────────────────────────────────────────────────────────
with st.sidebar:
    st.markdown('<div class="filter-header">🗂 Filters</div>', unsafe_allow_html=True)
    st.write("")

    # Tekst zoeken
    naam_query = st.text_input("Zoek op naam", placeholder="Bijv. Camping de Parel...", label_visibility="visible")

    # Provincie multiselect
    prov_opties = sorted([p for p in df["provincie"].dropna().unique() if p not in ("Onbekend", "", "nan")])
    selected_provs = st.multiselect("Provincie", prov_opties, placeholder="Alle provincies")

    # Prijs categorie
    prijs_cat = st.selectbox("Prijscategorie", ["Alle", "Gratis", "Betaald"])

    st.markdown('<div class="filter-header">✅ Voorzieningen</div>', unsafe_allow_html=True)
    st.write("")

    col_f1, col_f2 = st.columns(2)
    with col_f1:
        f_stroom  = st.checkbox("⚡ Stroom")
        f_honden  = st.checkbox("🐾 Honden")
        f_wifi    = st.checkbox("📶 Wifi")
    with col_f2:
        f_water   = st.checkbox("🚰 Water")
        f_sanitair = st.checkbox("🚿 Sanitair")
        f_gratis  = st.checkbox("💰 Gratis")

    st.divider()

    # Kaart aan/uit
    toon_kaart = st.toggle("🗺️ Kaart tonen", value=st.session_state.show_map)
    st.session_state.show_map = toon_kaart

    # Favorieten filter
    toon_favs = st.checkbox("❤️ Alleen favorieten")

    st.divider()
    if st.button("🔄 Filters wissen", use_container_width=True):
        st.session_state["ai_query_cp"] = ""
        st.session_state["ai_active_filters"] = []
        st.rerun()


# ─────────────────────────────────────────────────────────────────────────────
# HERO SECTIE MET AI ZOEKBALK
# ─────────────────────────────────────────────────────────────────────────────
st.markdown("""
<div class="hero-wrap">
    <p class="hero-title">🚐 Vind jouw perfecte camperplek</p>
    <p class="hero-sub">Zoek in meer dan 750 camperplaatsen door heel Nederland</p>
</div>
""", unsafe_allow_html=True)

col_ai_input, col_ai_btn = st.columns([5, 1])
with col_ai_input:
    ai_input_val = st.text_input(
        "ai_search_field",
        value=st.session_state["ai_query_cp"],
        placeholder="✨ Beschrijf wat je zoekt: 'Gratis plek in Drenthe, honden welkom, met stroom'",
        label_visibility="collapsed",
    )
with col_ai_btn:
    ai_search_btn = st.button("🔍 Zoeken", use_container_width=True, type="primary")

if ai_search_btn and ai_input_val.strip():
    st.session_state["ai_query_cp"] = ai_input_val.strip()

# Snelfilter Chips (als HTML knoppen werken niet zo handig als Streamlit knoppen)
st.write("")
c1, c2, c3, c4, c5 = st.columns([1.2, 1.2, 1.2, 1.2, 4])
with c1:
    if st.button(
        "💰 Gratis" ,
        type="primary" if st.session_state.qf_gratis else "secondary",
        use_container_width=True
    ):
        st.session_state.qf_gratis = not st.session_state.qf_gratis
        st.rerun()
with c2:
    if st.button(
        "🐾 Honden",
        type="primary" if st.session_state.qf_honden else "secondary",
        use_container_width=True
    ):
        st.session_state.qf_honden = not st.session_state.qf_honden
        st.rerun()
with c3:
    if st.button(
        "⚡ Stroom",
        type="primary" if st.session_state.qf_stroom else "secondary",
        use_container_width=True
    ):
        st.session_state.qf_stroom = not st.session_state.qf_stroom
        st.rerun()
with c4:
    if st.button(
        "📶 Wifi",
        type="primary" if st.session_state.qf_wifi else "secondary",
        use_container_width=True
    ):
        st.session_state.qf_wifi = not st.session_state.qf_wifi
        st.rerun()


# ─────────────────────────────────────────────────────────────────────────────
# FILTERING PIPELINE
# ─────────────────────────────────────────────────────────────────────────────
processed = df.copy()
ai_labels = []

# Stap 1: AI zoekopdracht (hoogste prioriteit)
active_ai_query = st.session_state["ai_query_cp"]
if active_ai_query:
    with st.spinner("✨ AI interpreteert je zoekopdracht..."):
        processed, ai_labels = process_ai_query(processed, active_ai_query)
    st.session_state["ai_active_filters"] = ai_labels

# Stap 2: Naam zoekveld (aanvullend op AI)
if naam_query:
    processed = processed[
        processed["naam"].astype(str).str.lower().str.contains(naam_query.lower(), na=False)
    ]

# Stap 3: Provincie (sidebar multiselect)
if selected_provs:
    processed = processed[processed["provincie"].isin(selected_provs)]

# Stap 4: Prijscategorie (sidebar)
if prijs_cat == "Gratis" or st.session_state.qf_gratis or f_gratis:
    processed = processed[processed["prijs"].astype(str).str.lower().str.contains("gratis", na=False)]
elif prijs_cat == "Betaald":
    processed = processed[~processed["prijs"].astype(str).str.lower().str.contains("gratis", na=False)]

# Stap 5: Voorzieningen (sidebar checkboxes EN snelfilter chips)
if f_stroom or st.session_state.qf_stroom:
    processed = processed[processed["stroom"].astype(str).str.lower() == "ja"]

if f_honden or st.session_state.qf_honden:
    processed = processed[processed["honden_toegestaan"].astype(str).str.lower() == "ja"]

if f_wifi or st.session_state.qf_wifi:
    if "wifi" in processed.columns:
        processed = processed[processed["wifi"].astype(str).str.lower() == "ja"]

if f_water:
    mask = pd.Series(False, index=processed.index)
    for col in ("waterfront", "water_tanken"):
        if col in processed.columns:
            mask = mask | (processed[col].astype(str).str.lower() == "ja")
    processed = processed[mask]

if f_sanitair and "sanitair" in processed.columns:
    processed = processed[processed["sanitair"].astype(str).str.lower() == "ja"]

# Stap 6: Favorieten
if toon_favs:
    favs = get_favorites()
    processed = processed[processed["naam"].isin(favs)]


# ─────────────────────────────────────────────────────────────────────────────
# RESULTATEN HEADER & AI FILTER TAGS
# ─────────────────────────────────────────────────────────────────────────────
col_res_hdr, col_res_toggle = st.columns([3, 1])
with col_res_hdr:
    st.markdown(
        f'<div class="result-count">{len(processed)} camperplaatsen gevonden</div>'
        f'<div class="result-sub">Nederland · {len(df)} locaties in database</div>',
        unsafe_allow_html=True,
    )

if st.session_state["ai_active_filters"] and active_ai_query:
    tags_html = "".join(
        f'<span class="ai-filter-tag">✨ {label}</span>'
        for label in st.session_state["ai_active_filters"]
    )
    st.markdown(
        f'<div style="margin-bottom:0.8rem;"><span style="font-size:0.78rem;color:#8A9DB5;margin-right:6px;">AI filters:</span>{tags_html}</div>',
        unsafe_allow_html=True,
    )


# ─────────────────────────────────────────────────────────────────────────────
# DETAIL DIALOOG
# ─────────────────────────────────────────────────────────────────────────────
@st.dialog("📍 Locatiedetails", width="large")
def show_detail(row):
    naam = str(row.get("naam", "Onbekend"))
    prov = str(row.get("provincie", "Onbekend"))

    st.markdown(
        f"<h2 style='font-family:DM Serif Display,serif;color:#0A2540;margin-bottom:0;'>{naam}</h2>"
        f"<p style='color:#8A9DB5;font-family:DM Sans,sans-serif;margin-top:2px;'>📍 {prov}</p>",
        unsafe_allow_html=True,
    )

    tab_info, tab_voorzieningen, tab_reviews, tab_kaart = st.tabs([
        "📋 Info", "🔌 Voorzieningen", "⭐ Reviews", "🗺️ Kaart"
    ])

    with tab_info:
        c_img, c_text = st.columns([1, 1.6])
        with c_img:
            img = str(row.get("afbeelding", ""))
            if not img or img in ("nan", "none", ""):
                img = "https://images.unsplash.com/photo-1523987355523-c7b5b0dd90a7?w=400&auto=format&fit=crop"
            st.image(img, use_container_width=True)

            website = str(row.get("website", ""))
            if website and website not in ("nan", "none", ""):
                if not website.startswith("http"):
                    website = "https://" + website
                st.markdown(f"[🌐 Bekijk website]({website})")

        with c_text:
            desc = str(row.get("beschrijving", "Geen beschrijving beschikbaar."))
            if desc in ("nan", "none", ""):
                desc = "Geen beschrijving beschikbaar."
            st.markdown(f"*{desc}*")
            st.markdown("---")

            detail_cols = [
                ("💶 Prijs", "prijs"),
                ("🕐 Check-in/out", "check_in_out"),
                ("⛰️ Ondergrond", "ondergrond"),
                ("🤫 Rust", "rust"),
                ("♿ Toegankelijk", "toegankelijkheid"),
                ("📞 Telefoon", "telefoonnummer"),
                ("🏕️ Plekken", "aantal_plekken"),
            ]
            for label, col in detail_cols:
                val = str(row.get(col, "Onbekend"))
                if val in ("nan", "none", ""):
                    val = "Onbekend"
                st.markdown(f"**{label}:** {val}")

    with tab_voorzieningen:
        v1, v2 = st.columns(2)
        pairs = [
            ("🐾 Honden toegestaan", "honden_toegestaan"),
            ("⚡ Stroom", "stroom"),
            ("💡 Stroomprijs", "stroom_prijs"),
            ("📶 Wifi", "wifi"),
            ("🚰 Water tanken", "water_tanken"),
            ("🚛 Afvalwater", "afvalwater"),
            ("🚽 Chemisch toilet", "chemisch_toilet"),
            ("🚿 Sanitair", "sanitair"),
        ]
        for i, (label, col) in enumerate(pairs):
            val = str(row.get(col, "Onbekend"))
            if val in ("nan", "none", ""):
                val = "Onbekend"
            icon = "✅" if val.lower() == "ja" else "❌" if val.lower() == "nee" else "❓"
            target = v1 if i % 2 == 0 else v2
            target.markdown(f"**{label}:** {icon} {val}")

    with tab_reviews:
        score_raw = row.get("beoordeling", "–")
        score_html = format_score(score_raw)
        st.markdown(f"### Score: {score_html if score_html else '–'}", unsafe_allow_html=True)
        samenvatting = str(row.get("samenvatting_reviews", "Nog geen reviews verwerkt."))
        if samenvatting in ("nan", "none", ""):
            samenvatting = "Nog geen reviews verwerkt."
        st.info(f"🗨️ **Samenvatting:** {samenvatting}")

    with tab_kaart:
        lat, lon = row.get("latitude"), row.get("longitude")
        try:
            lat_f, lon_f = float(lat), float(lon)
            m_detail = folium.Map(location=[lat_f, lon_f], zoom_start=14, tiles="OpenStreetMap")
            folium.Marker(
                [lat_f, lon_f],
                popup=naam,
                icon=folium.Icon(color="blue", icon="home", prefix="fa"),
            ).add_to(m_detail)
            components.html(m_detail._repr_html_(), height=380)
            st.markdown(f"[📍 Open in Google Maps](https://www.google.com/maps?q={lat_f},{lon_f})")
        except (TypeError, ValueError):
            st.warning("Geen geldige coördinaten beschikbaar.")


# ─────────────────────────────────────────────────────────────────────────────
# HOOFD LAYOUT: KAART + RESULTATEN
# ─────────────────────────────────────────────────────────────────────────────
display_df = processed.head(200)

if st.session_state.show_map:
    col_map, col_list = st.columns([1.1, 1])

    # ── KAART ──
    with col_map:
        st.markdown('<div class="map-wrap">', unsafe_allow_html=True)
        if not display_df.empty:
            map_df = display_df.dropna(subset=["latitude", "longitude"]).head(150)
            folium_map = build_folium_map(map_df)
            components.html(folium_map._repr_html_(), height=560)
        else:
            st.info("Geen locaties om op de kaart te tonen.")
        st.markdown('</div>', unsafe_allow_html=True)

    # ── RESULTATENLIJST ──
    with col_list:
        _render_list = True
else:
    col_list = st.container()
    _render_list = True


def render_results(container, df_render: pd.DataFrame):
    """Render de locatiekaartjes in een scrollbare lijst."""
    if df_render.empty:
        container.markdown("""
        <div class="no-results">
            <div class="no-results-icon">🔭</div>
            <strong>Geen camperplaatsen gevonden</strong><br>
            <span style="font-size:0.85rem;">Probeer je filters aan te passen of een andere zoekopdracht.</span>
        </div>
        """, unsafe_allow_html=True)
        return

    for idx, row in df_render.iterrows():
        img = str(row.get("afbeelding", ""))
        if not img or img in ("nan", "none", ""):
            img = "https://images.unsplash.com/photo-1523987355523-c7b5b0dd90a7?w=300&auto=format&fit=crop"

        naam = str(row.get("naam", "Onbekend"))
        prov = str(row.get("provincie", "Onbekend"))
        prijs = str(row.get("prijs", "Onbekend"))
        score_html = format_score(row.get("beoordeling", ""))
        badges = facility_badges(row)
        prijs_badge = price_badge_html(prijs)

        card_html = f"""
        <div class="loc-card">
            <img class="loc-card-img" src="{img}" alt="{naam}" onerror="this.src='https://images.unsplash.com/photo-1523987355523-c7b5b0dd90a7?w=300&auto=format&fit=crop'">
            <div class="loc-card-body">
                <div>
                    <div class="loc-card-name">{naam}</div>
                    <div class="loc-card-location">📍 {prov}</div>
                    <div class="loc-card-badges">{badges}</div>
                </div>
                <div style="display:flex; align-items:center; justify-content:space-between;">
                    <div>{prijs_badge} {score_html}</div>
                </div>
            </div>
        </div>
        """
        container.markdown(card_html, unsafe_allow_html=True)
        if container.button("🔍 Bekijk details", key=f"detail_{idx}", use_container_width=False):
            show_detail(row)


if st.session_state.show_map:
    with col_list:
        st.markdown(
            f"<div style='max-height:560px; overflow-y:auto; padding-right:6px;'>",
            unsafe_allow_html=True,
        )
        render_results(st, display_df)
        st.markdown("</div>", unsafe_allow_html=True)
else:
    # Volledig scherm grid (3 kolommen)
    st.divider()
    if display_df.empty:
        st.markdown("""
        <div class="no-results">
            <div class="no-results-icon">🔭</div>
            <strong>Geen camperplaatsen gevonden</strong><br>
            <span>Probeer je filters aan te passen of een andere zoekopdracht.</span>
        </div>
        """, unsafe_allow_html=True)
    else:
        for i in range(0, len(display_df), 2):
            g1, g2 = st.columns(2)
            for col_widget, j in [(g1, i), (g2, i + 1)]:
                if j < len(display_df):
                    row = display_df.iloc[j]
                    idx = display_df.index[j]
                    img = str(row.get("afbeelding", ""))
                    if not img or img in ("nan", "none", ""):
                        img = "https://images.unsplash.com/photo-1523987355523-c7b5b0dd90a7?w=300&auto=format&fit=crop"
                    naam = str(row.get("naam", "Onbekend"))
                    prov = str(row.get("provincie", "Onbekend"))
                    prijs_badge = price_badge_html(str(row.get("prijs", "Onbekend")))
                    badges = facility_badges(row)
                    score_html = format_score(row.get("beoordeling", ""))

                    col_widget.markdown(f"""
                    <div class="loc-card">
                        <img class="loc-card-img" src="{img}" alt="{naam}"
                             onerror="this.src='https://images.unsplash.com/photo-1523987355523-c7b5b0dd90a7?w=300&auto=format&fit=crop'">
                        <div class="loc-card-body">
                            <div>
                                <div class="loc-card-name">{naam}</div>
                                <div class="loc-card-location">📍 {prov}</div>
                                <div class="loc-card-badges">{badges}</div>
                            </div>
                            <div>{prijs_badge} {score_html}</div>
                        </div>
                    </div>
                    """, unsafe_allow_html=True)
                    if col_widget.button("🔍 Details", key=f"grid_{idx}", use_container_width=True):
                        show_detail(row)


# ─────────────────────────────────────────────────────────────────────────────
# FOOTER
# ─────────────────────────────────────────────────────────────────────────────
if len(processed) > 200:
    st.markdown(
        f"<p style='text-align:center;color:#8A9DB5;font-size:0.82rem;margin-top:1rem;'>"
        f"Top 200 van {len(processed)} resultaten getoond · Gebruik filters om verder te verfijnen.</p>",
        unsafe_allow_html=True,
    )

st.markdown(
    "<hr><p style='text-align:center;color:#C0CDD8;font-size:0.78rem;font-family:DM Sans,sans-serif;'>"
    "VrijStaan · Camperplaatsen zonder vertrektijden 🚐</p>",
    unsafe_allow_html=True,
)
