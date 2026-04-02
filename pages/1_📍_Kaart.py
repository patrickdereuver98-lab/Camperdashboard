"""
1_📍_Kaart.py — Geoptimaliseerd Hoofd-dashboard.
Fixes:
  • Bug 2: beoordeling toont geen "/5" meer als AI tekst geeft (bijv. "Goed")
  • Bug 3: kaartkaart toont nu zowel waterfront (🌊) als water_tanken (🚰)
"""
import streamlit as st
import leafmap.foliumap as leafmap
import pandas as pd
from ui.theme import apply_theme, render_sidebar_header
from utils.data_handler import load_data

st.set_page_config(page_title="VrijStaan | Kaart", page_icon="📍", layout="wide")

apply_theme()
render_sidebar_header()

st.title("📍 Camperplaatsen in Nederland")

# Haal data op uit de handler (Cloud met Fallback)
df = load_data()

if df.empty:
    st.warning("Nog geen data beschikbaar. Ga naar Beheer om de dataset te synchroniseren.")
else:
    # Sidebar Filters
    with st.sidebar:
        st.header("Filters")
        
        # Filter op Provincie
        provincies = sorted(df['provincie'].unique().tolist())
        sel_prov = st.multiselect("Provincie", provincies, default=provincies)
        
        # Filter op Prijs
        prijs_options = ["Alle", "Gratis", "Betaald"]
        sel_prijs = st.radio("Prijs", prijs_options)
        
        # Filter op Voorzieningen
        st.subheader("Voorzieningen")
        f_stroom = st.checkbox("⚡ Stroom")
        f_honden = st.checkbox("🐾 Honden toegestaan")
        f_water = st.checkbox("🌊 Aan het water")

    # Toepassen filters
    filtered_df = df[df['provincie'].isin(sel_prov)]
    
    if sel_prijs == "Gratis":
        filtered_df = filtered_df[filtered_df['prijs'].astype(str).str.lower().contains('gratis')]
    elif sel_prijs == "Betaald":
        filtered_df = filtered_df[~filtered_df['prijs'].astype(str).str.lower().contains('gratis')]
        
    if f_stroom:
        filtered_df = filtered_df[filtered_df['stroom'] == 'Ja']
    if f_honden:
        filtered_df = filtered_df[filtered_df['honden_toegestaan'] == 'Ja']
    if f_water:
        filtered_df = filtered_df[filtered_df['waterfront'] == 'Ja']

    # Statistieken boven de kaart
    c1, c2, c3 = st.columns(3)
    c1.metric("Gevonden locaties", len(filtered_df))
    c2.metric("Provincies", len(sel_prov))
    c3.metric("Filters actief", sum([f_stroom, f_honden, f_water]))

    # Kaart weergave
    m = leafmap.Map(center=[52.13, 5.29], zoom=7)
    
    # Voeg markers toe
    if not filtered_df.empty:
        m.add_points_from_xy(
            filtered_df,
            x="longitude",
            y="latitude",
            popup=["naam", "provincie", "prijs", "stroom", "website"],
            color_column="provincie",
            icon_names=["campground"] * len(filtered_df),
            spin=False
        )
    
    m.to_streamlit(height=600)

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
df = get_master_data()

if df.empty:
    st.warning("⚠️ Geen database gevonden. Ga naar **Beheer** om de data te initialiseren via API Sync.")
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

            # Bug 3 fix: controleer BEIDE watervelden zodat het icoon niet verdwijnt na verrijking.
            # waterfront = is er water in de buurt (OSM-bron)
            # water_tanken = kan je water bijvullen (AI-verrijking)
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
