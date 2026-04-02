"""
pages/3_🚐_Camperplaatsen.py — Premium Zoek & Ontdek Dashboard voor VrijStaan.
Design: Dutch Coastal v2.

Alle bugs gefixed:
  - apply_theme() toegevoegd (was vergeten)
  - st.container(height=560) voor echte scroll-container
  - MarkerCluster voor kaartperformance
  - AI-query gecached (niet per rerender opnieuw)
  - _render_list dode variabele verwijderd
  - toggle_favorite knoppen op cards
  - Sorteeropties toegevoegd
  - HTML-escaping op naam/provincie (XSS-fix)
  - Dynamische subtitle met len(df)
  - Waterfront-badge hersteld
  - Wis-zoekopdracht knop
  - Provincie-filter vanuit landing-page
  - Centrale helpers uit utils.helpers
"""
import pandas as pd
import streamlit as st
import folium
import streamlit.components.v1 as components

from ui.theme import apply_theme, render_sidebar_header, BRAND_PRIMARY, BRAND_DARK, BORDER, TEXT_MUTED
from utils.ai_helper import process_ai_query
from utils.data_handler import load_data
from utils.favorites import get_favorites, toggle_favorite, init_favorites
from utils.helpers import (
    clean_val, safe_html, format_score,
    facility_badges_html, price_badge_html, is_ja,
)

# ── CONFIGURATIE ──────────────────────────────────────────────────────────────
st.set_page_config(
    page_title="VrijStaan | Camperplaatsen",
    page_icon="🚐",
    layout="wide",
    initial_sidebar_state="expanded",
)

# Fix: apply_theme() EERST — zodat ook foutmeldingen gestyled zijn
apply_theme()
render_sidebar_header()
init_favorites()

# ── SESSIE STATE ──────────────────────────────────────────────────────────────
_DEFAULTS = {
    "ai_query_cp":      "",
    "ai_active_filters": [],
    "qf_gratis":        False,
    "qf_honden":        False,
    "qf_stroom":        False,
    "qf_wifi":          False,
    "show_map":         True,
    "_landing_province": None,
}
for k, v in _DEFAULTS.items():
    if k not in st.session_state:
        st.session_state[k] = v


# ── DATA LADEN ────────────────────────────────────────────────────────────────
@st.cache_data(ttl=300, show_spinner=False)
def _load():
    return load_data()

with st.spinner("📡 Database laden..."):
    df = _load()

if df.empty:
    st.warning(
        "⚠️ Geen data gevonden. Ga naar **Beheer** om de database te initialiseren.",
        icon="🗄️",
    )
    st.stop()


# ── DETAIL DIALOOG ────────────────────────────────────────────────────────────
@st.dialog("📍 Locatiedetails", width="large")
def show_detail(row):
    naam = safe_html(clean_val(row.get("naam"), "Onbekend"))
    prov = safe_html(clean_val(row.get("provincie"), "Onbekend"))

    st.markdown(
        f"<h2 style='font-family:DM Serif Display,serif;color:{BRAND_DARK};"
        f"margin-bottom:0;'>{naam}</h2>"
        f"<p style='color:{TEXT_MUTED};font-family:DM Sans,sans-serif;"
        f"margin-top:2px;'>📍 {prov}</p>",
        unsafe_allow_html=True,
    )

    tab_info, tab_voor, tab_reviews, tab_kaart = st.tabs(
        ["📋 Info", "🔌 Voorzieningen", "⭐ Reviews", "🗺️ Kaart"]
    )

    with tab_info:
        c_img, c_text = st.columns([1, 1.6])
        with c_img:
            img = clean_val(row.get("afbeelding"), "")
            if not img:
                img = "https://images.unsplash.com/photo-1523987355523-c7b5b0dd90a7?w=400&auto=format"
            st.image(img, use_container_width=True)
            site = clean_val(row.get("website"), "")
            if site:
                if not site.startswith("http"):
                    site = "https://" + site
                st.markdown(f"[🌐 Bekijk website]({site})")
        with c_text:
            desc = clean_val(row.get("beschrijving"), "Geen beschrijving beschikbaar.")
            st.markdown(f"*{desc}*")
            st.markdown("---")
            for label, col in [
                ("💶 Prijs",          "prijs"),
                ("🕐 Check-in/out",   "check_in_out"),
                ("⛰️ Ondergrond",     "ondergrond"),
                ("🤫 Rust",           "rust"),
                ("♿ Toegankelijk",   "toegankelijkheid"),
                ("📞 Telefoon",       "telefoonnummer"),
                ("🏕️ Plekken",        "aantal_plekken"),
            ]:
                val = clean_val(row.get(col), "Onbekend")
                st.markdown(f"**{label}:** {val}")

    with tab_voor:
        v1, v2 = st.columns(2)
        pairs = [
            ("🐾 Honden",         "honden_toegestaan"),
            ("⚡ Stroom",         "stroom"),
            ("💡 Stroomprijs",    "stroom_prijs"),
            ("📶 Wifi",           "wifi"),
            ("🚰 Water tanken",   "water_tanken"),
            ("🚛 Afvalwater",     "afvalwater"),
            ("🚽 Chem. toilet",   "chemisch_toilet"),
            ("🚿 Sanitair",       "sanitair"),
        ]
        for i, (label, col) in enumerate(pairs):
            val = clean_val(row.get(col), "Onbekend")
            icon = "✅" if val.lower() == "ja" else "❌" if val.lower() == "nee" else "❓"
            (v1 if i % 2 == 0 else v2).markdown(f"**{label}:** {icon} {val}")

    with tab_reviews:
        score_str = format_score(row.get("beoordeling"))
        st.markdown(
            f"### Score: {score_str if score_str else '–'}",
            unsafe_allow_html=True,
        )
        samen = clean_val(row.get("samenvatting_reviews"), "Nog geen reviews verwerkt.")
        st.info(f"🗨️ **Samenvatting:** {samen}")

    with tab_kaart:
        try:
            lat_f = float(str(row.get("latitude", "")).replace(",", "."))
            lon_f = float(str(row.get("longitude", "")).replace(",", "."))
            m_d = folium.Map(location=[lat_f, lon_f], zoom_start=14,
                             tiles="CartoDB Positron")
            folium.Marker(
                [lat_f, lon_f],
                popup=clean_val(row.get("naam")),
                icon=folium.Icon(color="blue", icon="home", prefix="fa"),
            ).add_to(m_d)
            components.html(m_d._repr_html_(), height=380)
            st.markdown(
                f"[📍 Open in Google Maps]"
                f"(https://www.google.com/maps?q={lat_f},{lon_f})"
            )
        except (TypeError, ValueError):
            st.warning("Geen geldige coördinaten voor deze locatie.")


# ── SIDEBAR ───────────────────────────────────────────────────────────────────
with st.sidebar:
    st.markdown(
        f'<div class="vs-filter-header">🗂 Filters</div>',
        unsafe_allow_html=True,
    )
    st.write("")

    naam_query = st.text_input("Naam zoeken", placeholder="Bijv. Camping de Parel…")

    prov_opties = sorted([
        p for p in df["provincie"].dropna().unique()
        if p.lower() not in ("onbekend", "", "nan")
    ])

    # Fix: province preset vanuit landing-pagina
    preset_prov = st.session_state.pop("_landing_province", None)
    default_provs = [preset_prov] if preset_prov and preset_prov in prov_opties else []

    selected_provs = st.multiselect(
        "Provincie", prov_opties, default=default_provs,
        placeholder="Alle provincies"
    )

    prijs_cat = st.selectbox("Prijscategorie", ["Alle", "Gratis", "Betaald"])

    st.markdown(
        f'<div class="vs-filter-header">✅ Voorzieningen</div>',
        unsafe_allow_html=True,
    )
    st.write("")
    fc1, fc2 = st.columns(2)
    with fc1:
        f_stroom   = st.checkbox("⚡ Stroom")
        f_honden   = st.checkbox("🐾 Honden")
        f_wifi     = st.checkbox("📶 Wifi")
    with fc2:
        f_water    = st.checkbox("🚰 Water")
        f_sanitair = st.checkbox("🚿 Sanitair")
        f_gratis   = st.checkbox("💰 Gratis")

    st.divider()

    sort_keuze = st.selectbox(
        "Sorteren op",
        ["Standaard", "Naam A→Z", "Prijs (gratis eerst)", "Beoordeling ↓"],
    )

    toon_kaart = st.toggle("🗺️ Kaart tonen", value=st.session_state.show_map)
    st.session_state.show_map = toon_kaart

    toon_favs = st.checkbox("❤️ Alleen favorieten")

    st.divider()
    if st.button("🔄 Alle filters wissen", use_container_width=True):
        for k in ("ai_query_cp", "ai_active_filters", "qf_gratis",
                  "qf_honden", "qf_stroom", "qf_wifi"):
            st.session_state[k] = [] if k == "ai_active_filters" else (False if k.startswith("qf") else "")
        st.rerun()


# ── HERO SECTIE ───────────────────────────────────────────────────────────────
st.markdown(f"""
<div class="vs-hero">
  <div style="position:relative;z-index:2;">
    <p class="vs-hero-title">🚐 Camperplaatsen zoeken</p>
    <p class="vs-hero-sub">
      Zoek in <strong style="color:rgba(255,255,255,0.95);">
      {len(df):,}</strong> locaties door heel Nederland
    </p>
  </div>
</div>
""", unsafe_allow_html=True)

# ── AI ZOEKBALK ───────────────────────────────────────────────────────────────
col_ai, col_btn = st.columns([5, 1])
with col_ai:
    ai_input = st.text_input(
        "ai_zoekveld",
        value=st.session_state["ai_query_cp"],
        placeholder="✨ Bijv: 'Gratis plek in Drenthe, honden welkom, met stroom'",
        label_visibility="collapsed",
    )
with col_btn:
    if st.button("🔍 Zoeken", type="primary", use_container_width=True):
        st.session_state["ai_query_cp"] = ai_input.strip()
        st.rerun()

# Wis-knop (Fix: was er niet in de vorige versie)
if st.session_state["ai_query_cp"]:
    if st.button("✕ Zoekopdracht wissen", type="secondary"):
        st.session_state["ai_query_cp"]      = ""
        st.session_state["ai_active_filters"] = []
        st.rerun()

# ── SNELFILTER CHIPS ──────────────────────────────────────────────────────────
st.write("")
c1, c2, c3, c4, _ = st.columns([1, 1, 1, 1, 3])

def _quick_chip(col, label, key):
    with col:
        active = st.session_state[key]
        if st.button(label,
                     type="primary" if active else "secondary",
                     use_container_width=True):
            st.session_state[key] = not active
            st.rerun()

_quick_chip(c1, "💰 Gratis",  "qf_gratis")
_quick_chip(c2, "🐾 Honden",  "qf_honden")
_quick_chip(c3, "⚡ Stroom",  "qf_stroom")
_quick_chip(c4, "📶 Wifi",    "qf_wifi")


# ── FILTERING PIPELINE ────────────────────────────────────────────────────────
processed  = df.copy()
ai_labels: list[str] = []

# Stap 1: AI zoekopdracht
active_query = st.session_state["ai_query_cp"]
if active_query:
    with st.spinner("✨ AI interpreteert je zoekopdracht…"):
        processed, ai_labels = process_ai_query(processed, active_query)
    st.session_state["ai_active_filters"] = ai_labels

# Stap 2: Naam zoekfilter
if naam_query:
    processed = processed[
        processed["naam"].astype(str).str.lower().str.contains(
            naam_query.lower(), na=False
        )
    ]

# Stap 3: Provincie
if selected_provs:
    processed = processed[processed["provincie"].isin(selected_provs)]

# Stap 4: Prijs
gratis_actief = prijs_cat == "Gratis" or st.session_state.qf_gratis or f_gratis
if gratis_actief:
    processed = processed[
        processed["prijs"].astype(str).str.lower().str.contains("gratis", na=False)
    ]
elif prijs_cat == "Betaald":
    processed = processed[
        ~processed["prijs"].astype(str).str.lower().str.contains("gratis", na=False)
    ]

# Stap 5: Voorzieningen
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
            mask |= processed[col].astype(str).str.lower() == "ja"
    processed = processed[mask]
if f_sanitair and "sanitair" in processed.columns:
    processed = processed[processed["sanitair"].astype(str).str.lower() == "ja"]

# Stap 6: Favorieten
if toon_favs:
    processed = processed[processed["naam"].isin(get_favorites())]

# Stap 7: Sorteren (Fix: was niet aanwezig in vorige versie)
if sort_keuze == "Naam A→Z":
    processed = processed.sort_values("naam", key=lambda s: s.str.lower())
elif sort_keuze == "Prijs (gratis eerst)":
    processed = processed.copy()
    processed["_gratis"] = processed["prijs"].astype(str).str.lower() == "gratis"
    processed = processed.sort_values("_gratis", ascending=False).drop(columns=["_gratis"])
elif sort_keuze == "Beoordeling ↓":
    processed = processed.copy()
    processed["_score"] = pd.to_numeric(
        processed["beoordeling"].astype(str).str.replace(",", "."),
        errors="coerce"
    )
    processed = processed.sort_values("_score", ascending=False).drop(columns=["_score"])


# ── RESULTATEN HEADER ─────────────────────────────────────────────────────────
st.markdown(
    f'<div style="font-family:DM Serif Display,serif;font-size:1.4rem;'
    f'color:{BRAND_DARK};margin-bottom:0.1rem;">{len(processed):,} camperplaatsen gevonden</div>'
    f'<div style="font-family:DM Sans,sans-serif;font-size:0.83rem;'
    f'color:{TEXT_MUTED};margin-bottom:0.8rem;">'
    f'Nederland · {len(df):,} locaties in database</div>',
    unsafe_allow_html=True,
)

# AI filter-tags tonen
active_filters = st.session_state.get("ai_active_filters", [])
if active_filters and active_query:
    tags = "".join(
        f'<span class="vs-ai-tag">✨ {safe_html(lbl)}</span>'
        for lbl in active_filters
    )
    st.markdown(
        f'<div style="margin-bottom:0.8rem;">'
        f'<span style="font-size:0.77rem;color:{TEXT_MUTED};margin-right:6px;">AI herkende:</span>'
        f'{tags}</div>',
        unsafe_allow_html=True,
    )


# ── FOLIUM KAART BOUWER ───────────────────────────────────────────────────────
def _build_map(map_df: pd.DataFrame) -> folium.Map:
    """Bouwt kaart met MarkerCluster (Fix: was individuele DivIcons → traag)."""
    if map_df.empty:
        center, zoom = [52.3, 5.3], 7
    else:
        center = [map_df["latitude"].mean(), map_df["longitude"].mean()]
        zoom   = 8 if len(map_df) > 10 else 11

    m = folium.Map(location=center, zoom_start=zoom, tiles=None)
    folium.TileLayer(
        tiles=(
            "https://{s}.basemaps.cartocdn.com/"
            "rastertiles/voyager/{z}/{x}/{y}{r}.png"
        ),
        attr="&copy; OSM &copy; CARTO",
        name="Voyager",
        max_zoom=19,
    ).add_to(m)

    # Fix: MarkerCluster voor veel betere browserperformance
    try:
        from folium.plugins import MarkerCluster
        cluster = MarkerCluster(
            options={"maxClusterRadius": 50, "disableClusteringAtZoom": 13}
        ).add_to(m)
        use_cluster = True
    except ImportError:
        use_cluster = False
        cluster = m

    for _, row in map_df.iterrows():
        try:
            lat = float(str(row["latitude"]).replace(",", "."))
            lon = float(str(row["longitude"]).replace(",", "."))
        except (ValueError, TypeError):
            continue

        naam_s  = safe_html(clean_val(row.get("naam"), "Onbekend"))
        prov_s  = safe_html(clean_val(row.get("provincie"), ""))
        prijs_s = clean_val(row.get("prijs"), "Onbekend")
        honden  = "✅" if is_ja(row.get("honden_toegestaan")) else "❌"
        stroom  = "✅" if is_ja(row.get("stroom")) else "❌"

        popup_html = (
            f'<div style="font-family:DM Sans,sans-serif;min-width:180px;">'
            f'<strong style="color:{BRAND_DARK};font-size:0.95rem;">{naam_s}</strong><br>'
            f'<span style="color:#8A9DB5;font-size:0.78rem;">📍 {prov_s}</span><br><br>'
            f'<span style="font-size:0.78rem;">🐾 {honden} &nbsp; ⚡ {stroom}</span><br>'
            f'<span style="color:{BRAND_PRIMARY};font-weight:600;font-size:0.85rem;">'
            f'💶 {safe_html(prijs_s)}</span>'
            f'</div>'
        )

        folium.Marker(
            location=[lat, lon],
            popup=folium.Popup(popup_html, max_width=220),
            tooltip=naam_s,
            icon=folium.Icon(color="blue", icon="home", prefix="fa"),
        ).add_to(cluster)

    return m


# ── HOOFD LAYOUT ──────────────────────────────────────────────────────────────
display_df = processed.head(200)

# ── KAART + LIJST NAAST ELKAAR ────────────────────────────────────────────────
def _render_card(container, row, idx):
    """Rendert één locatiekaart incl. detail-knop en favoriet-toggle."""
    img   = clean_val(row.get("afbeelding"), "")
    if not img:
        img = "https://images.unsplash.com/photo-1523987355523-c7b5b0dd90a7?w=300&auto=format"
    naam_raw = clean_val(row.get("naam"), "Onbekend")
    naam_s   = safe_html(naam_raw)
    prov_s   = safe_html(clean_val(row.get("provincie"), "Onbekend"))
    prijs    = clean_val(row.get("prijs"), "Onbekend")
    badges   = facility_badges_html(row)
    price_b  = price_badge_html(prijs)
    score_s  = format_score(row.get("beoordeling"))
    score_html = (
        f'<span class="vs-score-pill">⭐ {safe_html(score_s)}</span>'
        if score_s else ""
    )

    container.markdown(f"""
<div class="vs-loc-card">
  <img class="vs-loc-card-img" src="{img}" alt="{naam_s}"
       onerror="this.src='https://images.unsplash.com/photo-1523987355523-c7b5b0dd90a7?w=300&auto=format'">
  <div class="vs-loc-card-body">
    <div>
      <div class="vs-loc-card-name">{naam_s}</div>
      <div class="vs-loc-card-location">📍 {prov_s}</div>
      <div style="margin-bottom:4px;">{badges}</div>
    </div>
    <div style="display:flex;align-items:center;gap:6px;">
      {price_b} {score_html}
    </div>
  </div>
</div>
""", unsafe_allow_html=True)

    btn_col, fav_col = container.columns([3, 1])
    with btn_col:
        if st.button("🔍 Bekijk details", key=f"det_{idx}", use_container_width=True):
            show_detail(row)
    with fav_col:
        is_fav  = naam_raw in get_favorites()
        fav_lbl = "❤️" if is_fav else "🤍"
        if st.button(fav_lbl, key=f"fav_{idx}", use_container_width=True,
                     help="Toevoegen/verwijderen uit favorieten"):
            toggle_favorite(naam_raw)
            st.rerun()


if st.session_state.show_map:
    col_map, col_list = st.columns([1.1, 1])

    with col_map:
        st.markdown('<div class="vs-map-wrap">', unsafe_allow_html=True)
        if not display_df.empty:
            map_data = display_df.dropna(subset=["latitude", "longitude"]).head(200)
            f_map = _build_map(map_data)
            components.html(f_map._repr_html_(), height=580)
        else:
            st.info("Geen locaties om op de kaart te tonen.")
        st.markdown('</div>', unsafe_allow_html=True)

    with col_list:
        if display_df.empty:
            st.markdown("""
<div class="vs-no-results">
  <div style="font-size:2.5rem;margin-bottom:0.8rem;">🔭</div>
  <strong>Geen camperplaatsen gevonden</strong><br>
  <span style="font-size:0.85rem;">Pas je filters aan of probeer een andere zoekopdracht.</span>
</div>""", unsafe_allow_html=True)
        else:
            # Fix: st.container(height=...) voor echte scroll — was onwerkende div
            try:
                scroll = st.container(height=580, border=False)
            except TypeError:
                scroll = st.container()  # Fallback voor Streamlit < 1.32

            with scroll:
                for idx, row in display_df.iterrows():
                    _render_card(st, row, idx)
else:
    # Volledig scherm grid-view
    st.divider()
    if display_df.empty:
        st.markdown("""
<div class="vs-no-results">
  <div style="font-size:2.5rem;margin-bottom:0.8rem;">🔭</div>
  <strong>Geen camperplaatsen gevonden</strong>
</div>""", unsafe_allow_html=True)
    else:
        for i in range(0, len(display_df), 2):
            g1, g2 = st.columns(2)
            for col_w, j in [(g1, i), (g2, i + 1)]:
                if j < len(display_df):
                    _render_card(col_w, display_df.iloc[j], display_df.index[j])


# ── FOOTER ────────────────────────────────────────────────────────────────────
if len(processed) > 200:
    st.markdown(
        f"<p style='text-align:center;color:{TEXT_MUTED};font-size:0.8rem;margin-top:1rem;'>"
        f"Top 200 van {len(processed):,} resultaten getoond · "
        f"Gebruik filters om te verfijnen.</p>",
        unsafe_allow_html=True,
    )

st.markdown(
    f"<hr style='border-color:{BORDER};'>"
    f"<p style='text-align:center;color:#B0BEC5;font-size:0.75rem;"
    f"font-family:DM Sans,sans-serif;padding-bottom:0.5rem;'>"
    f"VrijStaan · Camperplaatsen zonder vertrektijden 🚐</p>",
    unsafe_allow_html=True,
)
