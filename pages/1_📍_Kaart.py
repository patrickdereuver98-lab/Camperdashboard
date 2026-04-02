"""
1_📍_Kaart.py — Geoptimaliseerd Hoofd-dashboard (Booking.com Look).
Fixes: 
  • Koppeling met Google Sheets (load_data)
  • Behoud van alle UI-elementen, snelfilters en dialoog-structuur.
"""
import pandas as pd
import streamlit as st
import folium
import streamlit.components.v1 as components

from ui.theme import apply_theme, render_sidebar_header, price_badge
from utils.ai_helper import process_ai_query
# CHIRURGISCHE FIX: We gebruiken load_data voor de Google Sheets connectie
from utils.data_handler import load_data
from utils.favorites import get_favorites, toggle_favorite, init_favorites

st.set_page_config(page_title="VrijStaan | Zoeken", page_icon="🚐", layout="wide")
apply_theme()
render_sidebar_header()
init_favorites()

# ── 0. INITIALISATIE ──────────────────────────────────────────────────────────
if 'ai_search_query' not in st.session_state:
    st.session_state['ai_search_query'] = ""

ai_query = st.session_state['ai_search_query']


# ── HULPFUNCTIE: Slimme score-weergave ───────────────────────────────────────
def format_beoordeling(raw) -> str:
    """
    Bug 2 fix: toont cijfer + '/5' ALLEEN als het echt een getal is.
    Tekstwaarden zoals 'Goed', 'Uitstekend', 'Onbekend' krijgen geen suffix.
    """
    val = str(raw).strip()
    if val in ("", "nan", "None", "Onbekend", "–"):
        return "–"
    try:
        # Vervang komma door punt voor Europese notatie (bijv. "4,2")
        float(val.replace(",", "."))
        return f"{val}/5"
    except ValueError:
        # Het is een tekst-oordeel ("Goed", "Uitstekend", etc.)
        return val


# ── 1. DETAIL DIALOG ──────────────────────────────────────────────────────────
@st.dialog("📍 Locatiedetails", width="large")
def show_detail(row):
    st.markdown(f"## {row['naam']}")

    tab_info, tab_voorzieningen, tab_reviews, tab_kaart = st.tabs([
        "📋 Info", "🔌 Voorzieningen", "⭐ Reviews", "🗺️ Kaart"
    ])

    with tab_info:
        c1, c2 = st.columns([1, 1.5])
        with c1:
            img = str(row.get("afbeelding", ""))
            if not img or img == "nan":
                img = "https://images.unsplash.com/photo-1523987355523-c7b5b0dd90a7?w=300"
            st.image(img, use_container_width=True)
            st.markdown(f"**💰 Prijs:** {row.get('prijs', 'Onbekend')}")
            st.markdown(f"**🕐 Tijden:** {row.get('check_in_out', 'Vrij')}")
        with c2:
            st.markdown(f"**📝 Beschrijving:**\n*{row.get('beschrijving', 'Geen beschrijving.')}*")
            st.markdown("---")
            st.markdown(f"⛰️ **Ondergrond:** {row.get('ondergrond', 'Onbekend')}")
            st.markdown(f"🤫 **Rust:** {row.get('rust', 'Onbekend')}")
            st.markdown(f"♿ **Toegankelijk:** {row.get('toegankelijkheid', 'Onbekend')}")

    with tab_voorzieningen:
        v1, v2 = st.columns(2)
        with v1:
            st.write(f"🐾 **Honden:** {row.get('honden_toegestaan', '?')}")
            st.write(f"⚡ **Stroom:** {row.get('stroom', '?')} ({row.get('stroom_prijs', '?')})")
            st.write(f"📶 **Wifi:** {row.get('wifi', '?')}")
        with v2:
            st.write(f"🚰 **Water tanken:** {row.get('water_tanken', '?')}")
            st.write(f"🚛 **Afvalwater:** {row.get('afvalwater', '?')}")
            st.write(f"🚽 **Chemisch toilet:** {row.get('chemisch_toilet', '?')}")
            st.write(f"🚿 **Sanitair:** {row.get('sanitair', '?')}")

    with tab_reviews:
        # Bug 2 fix: gebruik format_beoordeling() zodat "Goed/5" niet meer optreedt
        score_str = format_beoordeling(row.get("beoordeling", "–"))
        st.markdown(f"### Score: {score_str}")
        st.info(f"🗨️ **Samenvatting:** {row.get('samenvatting_reviews', 'Nog geen reviews verwerkt.')}")

    with tab_kaart:
        lat, lon = row.get("latitude"), row.get("longitude")
        if pd.notna(lat) and pd.notna(lon):
            m = folium.Map(location=[float(lat), float(lon)], zoom_start=14, tiles="OpenStreetMap")
            folium.Marker(
                [float(lat), float(lon)],
                popup=row['naam'],
                icon=folium.Icon(color="green", icon="home")
            ).add_to(m)
            components.html(m._repr_html_(), height=400)
            gmaps = f"https://www.google.com/maps?q={lat},{lon}"
            st.markdown(f"[📍 Navigeer via Google Maps]({gmaps})")


# ── 2. DATA LADEN ──────────────────────────────────────────────────────────────
# CHIRURGISCHE FIX: Gebruik de cloud-functie load_data()
df = load_data()

if df.empty:
    st.warning("⚠️ Geen database gevonden of Google Sheet is leeg. Ga naar **Beheer** om de data te initialiseren.")
    st.stop()


# ── 3. ZIJBALK ────────────────────────────────────────────────────────────────
with st.sidebar:
    st.subheader("Geavanceerd Filteren")

    provincies_lijst = sorted([p for p in df["provincie"].unique() if p and p != "Onbekend"])
    selected_prov = st.selectbox("Provincie", ["Alle provincies"] + provincies_lijst)

    prijs_filter = st.selectbox("Prijs", ["Alle", "Gratis", "Betaald"])

    st.divider()
    toon_favorieten = st.checkbox("❤️ Mijn Favorieten tonen")


# ── 4. ZOEKBALK ──────────────────────────────────────────────────────────────
st.markdown(
    "<h1 style='text-align:center;color:#0077B6;margin-bottom:0;'>Vind jouw perfecte camperplek</h1>",
    unsafe_allow_html=True,
)
st.markdown(
    "<p style='text-align:center;color:#6c757d;font-size:1.1rem;margin-bottom:2rem;'>Zoek slim. Wat is je volgende bestemming?</p>",
    unsafe_allow_html=True,
)

col_spacer1, col_search_box, col_spacer2 = st.columns([1, 4, 1])
with col_search_box:
    with st.form("search_form", clear_on_submit=False):
        col_input, col_btn = st.columns([4, 1])
        with col_input:
            user_input = st.text_input(
                "Waar wil je heen?",
                value=ai_query,
                placeholder="Bijv: 'Gratis plek in Drenthe met stroom'",
                label_visibility="collapsed",
            )
        with col_btn:
            submit_search = st.form_submit_button("🔍 Zoek", use_container_width=True)

    if submit_search:
        st.session_state['ai_search_query'] = user_input
        ai_query = user_input
        st.rerun()


# ── 5. SNELFILTERS ────────────────────────────────────────────────────────────
st.write("")
sf_col1, sf_col2, sf_col3, sf_col4, sf_col5 = st.columns(5)

for key in ("qf_gratis", "qf_honden", "qf_stroom"):
    if key not in st.session_state:
        st.session_state[key] = False

with sf_col2:
    if st.button("💰 Gratis", use_container_width=True,
                 type="primary" if st.session_state.qf_gratis else "secondary"):
        st.session_state.qf_gratis = not st.session_state.qf_gratis
        st.rerun()
with sf_col3:
    if st.button("🐾 Honden Welkom", use_container_width=True,
                 type="primary" if st.session_state.qf_honden else "secondary"):
        st.session_state.qf_honden = not st.session_state.qf_honden
        st.rerun()
with sf_col4:
    if st.button("⚡ Met Stroom", use_container_width=True,
                 type="primary" if st.session_state.qf_stroom else "secondary"):
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
    processed = processed[processed["prijs"].astype(str).str.lower().str.contains("gratis", na=False)]
elif prijs_filter == "Betaald":
    processed = processed[~processed["prijs"].astype(str).str.lower().str.contains("gratis", na=False)]

if st.session_state.qf_honden:
    processed = processed[processed["honden_toegestaan"] == "Ja"]

if st.session_state.qf_stroom:
    processed = processed[processed["stroom"] == "Ja"]

if toon_favorieten:
    favs = get_favorites()
    processed = processed[processed["naam"].isin(favs)]


# ── 7. RESULTATENLIJST ────────────────────────────────────────────────────────
st.markdown(f"### {len(processed)} accommodaties gevonden")

if ai_labels:
    st.markdown(f"**Geïnterpreteerd door AI:** {', '.join(ai_labels)}")

if processed.empty:
    st.info("Geen resultaten gevonden. Probeer je zoekopdracht aan te passen.")
    st.stop()

for idx, row in processed.head(100).iterrows():
    with st.container(border=True):
        c_img, c_text, c_btn = st.columns([1.5, 4, 1.5])

        with c_img:
            img = str(row.get("afbeelding", ""))
            if not img or img == "nan":
                img = "https://images.unsplash.com/photo-1523987355523-c7b5b0dd90a7?w=300"
            st.image(img, use_container_width=True)

        with c_text:
            st.markdown(f"#### {row['naam']}")
            st.markdown(
                f"<p style='color:#666;font-size:0.9rem;margin-top:-10px;'>📍 {row.get('provincie','Onbekend')}</p>",
                unsafe_allow_html=True,
            )

            faciliteiten = []
            if str(row.get("honden_toegestaan")) == "Ja":
                faciliteiten.append("🐾 Honden")
            if str(row.get("stroom")) == "Ja":
                faciliteiten.append("⚡ Stroom")
            if str(row.get("waterfront")) == "Ja":
                faciliteiten.append("🌊 Waterfront")
            if str(row.get("water_tanken")) == "Ja":
                faciliteiten.append("🚰 Water tanken")
            if str(row.get("wifi")) == "Ja":
                faciliteiten.append("📶 WiFi")

            if faciliteiten:
                st.markdown(
                    f"<p style='font-size:0.85rem;color:#2A5A4A;'>{' | '.join(faciliteiten)}</p>",
                    unsafe_allow_html=True,
                )

        with c_btn:
            prijs_str = str(row.get("prijs", "Onbekend"))
            st.markdown(
                f"<div style='text-align:center;margin-bottom:10px;'>{price_badge(prijs_str)}</div>",
                unsafe_allow_html=True,
            )
            if st.button("🔍 Bekijk details", key=f"btn_{idx}", use_container_width=True):
                show_detail(row)

if len(processed) > 100:
    st.caption("Gebruik filters om de resultaten te verfijnen.")
