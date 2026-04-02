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

    ai_query = st.text_input(
        "Slim zoeken (AI)",
        placeholder="Bijv: 'Gratis in Limburg met stroom'",
        help="Gebruik natuurlijke taal — de AI vertaalt dit naar filters.",
    )

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

# ── DATA VERWERKING ──────────────────────────────────────────────────────────
processed = df.copy()
ai_labels = []

if ai_query:
    processed, ai_labels = process_ai_query(processed, ai_query)

if selected_prov != "Alle provincies":
    processed = processed[processed["provincie"] == selected_prov]

if prijs_filter == "Gratis":
    processed = processed[processed["prijs"].astype(str).str.lower() == "gratis"]
elif prijs_filter == "Betaald":
    processed = processed[processed["prijs"].astype(str).str.lower() != "gratis"]

if honden_filter != "Alle":
    processed = processed[processed["honden_toegestaan"] == honden_filter]

if stroom_filter != "Alle":
    processed = processed[processed["stroom"] == stroom_filter]

if water_filter == "Ja":
    processed = processed[processed["waterfront"] == "Ja"]

if user_loc:
    processed = filter_by_distance(processed, user_loc, radius)

if toon_favorieten:
    favs = get_favorites()
    processed = processed[processed["naam"].isin(favs)]

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
    st.markdown(
        '<div style="max-height:600px;overflow-y:auto;padding-right:4px;">',
        unsafe_allow_html=True,
    )
    for idx, row in processed.head(80).iterrows():
        fav_icon = "❤️" if is_favorite(row["naam"]) else "🤍"
        prijs_str = str(row.get("prijs", "Onbekend"))
        afstand = f' · {row["afstand_label"]}' if "afstand_label" in row else ""

        st.markdown(f"""
        <div class="locatie-card">
            <strong>{row['naam']}</strong><br>
            <small style="color:#666;">📍 {row['provincie']}{afstand}</small><br>
            {price_badge(prijs_str)}
            {'<span class="badge" style="background:#E8F4F1;color:#2A5A4A;">🐾 Honden</span>' if str(row.get('honden_toegestaan')) == 'Ja' else ''}
            {'<span class="badge" style="background:#FFF8EC;color:#B37D00;">⚡ Stroom</span>' if str(row.get('stroom')) == 'Ja' else ''}
            {'<span class="badge" style="background:#EEF6FF;color:#0077B6;">🌊 Water</span>' if str(row.get('waterfront')) == 'Ja' else ''}
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

    st.markdown("</div>", unsafe_allow_html=True)
    if len(processed) > 80:
        st.caption(f"Top 80 van {len(processed)} getoond. Gebruik filters om te verfijnen.")

with col_map:
    render_map(processed)
