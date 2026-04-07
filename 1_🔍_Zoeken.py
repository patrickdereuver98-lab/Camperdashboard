"""
pages/1_🔍_Zoeken.py — Premium Zoekpagina VrijStaan v5.
Pijler 0+3: Anti-clutter, Booking.com stijl, hybride zoeken, Airbnb kaartmarkers.

Architectuur (Pijler 1):
  - Routing & state hier
  - UI via ui/components.py + ui/sidebar.py + ui/map_view.py
  - Hybride zoekfunctie (Pijler 4): exact naam/provincie → AI fallback
"""
from __future__ import annotations

import pandas as pd
import streamlit as st

from ui.theme import (
    apply_theme, render_sidebar_header,
    P_BLUE, P_DARK, P_YELLOW, TEXT_MUTE, BORDER,
)
from ui.components import render_result_card, render_no_results
from ui.sidebar import render_filter_sidebar
from ui.map_view import render_map_section

from utils.ai_helper import process_ai_query
from utils.data_handler import load_data
from utils.favorites import get_favorites, init_favorites
from utils.helpers import clean_val, safe_html, hybrid_search_df

# ── PAGINA CONFIG ──────────────────────────────────────────────────────────────
st.set_page_config(
    page_title="VrijStaan | Camperplaatsen zoeken",
    page_icon="🔍",
    layout="wide",
    initial_sidebar_state="expanded",
)
apply_theme()
render_sidebar_header()
init_favorites()

# ── SESSION STATE ──────────────────────────────────────────────────────────────
_DEFAULTS: dict = {
    "ai_query_cp":       "",
    "ai_active_filters": [],
    "qf_gratis":         False,
    "qf_honden":         False,
    "qf_stroom":         False,
    "qf_wifi":           False,
    "show_map":          False,
    "_landing_province": None,
}
for k, v in _DEFAULTS.items():
    if k not in st.session_state:
        st.session_state[k] = v

# ── DATA LADEN ─────────────────────────────────────────────────────────────────
@st.cache_data(ttl=300, show_spinner=False)
def _load() -> pd.DataFrame:
    return load_data()

with st.spinner("📡 Locaties laden…"):
    df = _load()

if df.empty:
    st.warning("⚠️ Geen data gevonden. Ga naar **Beheer** om de database te initialiseren.")
    st.stop()

# ── SIDEBAR FILTERS ────────────────────────────────────────────────────────────
filters = render_filter_sidebar(df)

# ── BOOKING.COM ZOEKBALK ───────────────────────────────────────────────────────
# Pijler 0: Zoekbalk is de absolute held. Strak, geen rommel.
st.markdown(f"""
<div style="background:linear-gradient(145deg,{P_DARK} 0%,{P_BLUE} 70%,#0099FF 100%);
padding:1.8rem 2rem 2.4rem;margin-bottom:1.2rem;">
  <div style="font-family:'Syne',sans-serif;font-size:1.55rem;font-weight:800;
color:white;margin-bottom:0.2rem;letter-spacing:-0.02em;">
    🚐 Vind jouw camperplaats
  </div>
  <div style="color:rgba(255,255,255,0.7);font-size:0.9rem;margin-bottom:1rem;">
    Zoek in <strong style="color:white;">{len(df):,}</strong> locaties door Nederland
  </div>
</div>
""", unsafe_allow_html=True)

# Zoekbalk onder de hero
srch_col, btn_col = st.columns([5, 1])
with srch_col:
    search_input = st.text_input(
        "zoekveld",
        value=st.session_state.get("ai_query_cp", ""),
        placeholder=(
            "🔍  Zoek op plaatsnaam, provincie of omschrijving "
            "— bijv. 'Zeeland gratis honden' of 'met stroom en wifi'"
        ),
        label_visibility="collapsed",
    )
with btn_col:
    zoek = st.button("Zoeken", type="primary", use_container_width=True)

if zoek:
    st.session_state["ai_query_cp"] = search_input.strip()
    st.rerun()

if st.session_state["ai_query_cp"]:
    if st.button("✕ Wis zoekopdracht", type="secondary"):
        st.session_state["ai_query_cp"] = ""
        st.session_state["ai_active_filters"] = []
        st.rerun()

# ── FILTERING PIPELINE ─────────────────────────────────────────────────────────
processed   = df.copy()
ai_labels: list[str] = []
active_query = st.session_state.get("ai_query_cp", "")

# Pijler 4: Hybride zoekfunctie
if active_query:
    direct_result, use_ai = hybrid_search_df(processed, active_query)
    if not use_ai:
        processed = direct_result
        ai_labels = [f"📍 Directe match: {active_query}"]
    else:
        with st.spinner("✨ AI interpreteert…"):
            processed, ai_labels = process_ai_query(processed, active_query)
    st.session_state["ai_active_filters"] = ai_labels

# Naam filter (sidebar)
if filters.naam_query:
    processed = processed[
        processed["naam"].astype(str).str.lower().str.contains(
            filters.naam_query.lower(), na=False
        )
    ]

# Provincie
if filters.selected_provs:
    processed = processed[processed["provincie"].isin(filters.selected_provs)]

# Prijs
gratis_actief = filters.prijs_cat == "Gratis" or filters.f_gratis
if gratis_actief:
    processed = processed[
        processed["prijs"].astype(str).str.lower().str.contains("gratis", na=False)
    ]
elif filters.prijs_cat == "Betaald":
    processed = processed[
        ~processed["prijs"].astype(str).str.lower().str.contains("gratis", na=False)
    ]

# Faciliteiten
if filters.f_stroom:
    processed = processed[processed["stroom"].astype(str).str.lower() == "ja"]
if filters.f_honden:
    processed = processed[processed["honden_toegestaan"].astype(str).str.lower() == "ja"]
if filters.f_wifi and "wifi" in processed.columns:
    processed = processed[processed["wifi"].astype(str).str.lower() == "ja"]
if filters.f_water:
    mask = pd.Series(False, index=processed.index)
    for col in ("waterfront", "water_tanken"):
        if col in processed.columns:
            mask |= processed[col].astype(str).str.lower() == "ja"
    processed = processed[mask]
if filters.f_sanitair and "sanitair" in processed.columns:
    processed = processed[processed["sanitair"].astype(str).str.lower() == "ja"]
if filters.f_afvalwater and "afvalwater" in processed.columns:
    processed = processed[processed["afvalwater"].astype(str).str.lower() == "ja"]
if filters.f_waterfront and "waterfront" in processed.columns:
    processed = processed[processed["waterfront"].astype(str).str.lower() == "ja"]

# Voertuig-restricties (Pijler 6)
if filters.f_lang_voertuig and "max_lengte" in processed.columns:
    # Toon locaties die GEEN lengte-beperking hebben OF expliciet >8m toestaan
    processed = processed[
        ~processed["max_lengte"].astype(str).str.contains(
            r"\b[1-8]\b", regex=True, na=False
        )
    ]
if filters.f_zwaar_voertuig and "max_gewicht" in processed.columns:
    processed = processed[
        ~processed["max_gewicht"].astype(str).str.contains(
            r"3\.5|3,5", regex=True, na=False
        )
    ]

# Favorieten
if filters.toon_favs:
    processed = processed[processed["naam"].isin(get_favorites())]

# Sorteren
if filters.sort_keuze == "Naam A→Z":
    processed = processed.sort_values("naam", key=lambda s: s.str.lower())
elif filters.sort_keuze == "Prijs (gratis eerst)":
    tmp = processed.copy()
    tmp["_g"] = tmp["prijs"].astype(str).str.lower().str.contains("gratis", na=False)
    processed = tmp.sort_values("_g", ascending=False).drop(columns=["_g"])
elif filters.sort_keuze == "Beoordeling ↓":
    tmp = processed.copy()
    tmp["_s"] = pd.to_numeric(
        tmp["beoordeling"].astype(str).str.replace(",", ".").str.split("/").str[0],
        errors="coerce"
    )
    processed = tmp.sort_values("_s", ascending=False).drop(columns=["_s"])
elif filters.sort_keuze == "Dichtstbij" and "afstand_km" in processed.columns:
    processed = processed.sort_values("afstand_km")

# ── KAART (verborgen by default — Pijler 3) ────────────────────────────────────
if filters.toon_kaart:
    render_map_section(processed, height=480)

# ── RESULTATEN HEADER ──────────────────────────────────────────────────────────
active_filters_list = st.session_state.get("ai_active_filters", [])
tags_html = ""
if active_filters_list and active_query:
    tags_html = "".join(
        f'<span class="vs-ai-tag">✨ {safe_html(lbl)}</span>'
        for lbl in active_filters_list
    )

st.markdown(f"""
<div class="vs-results-header">
  <div>
    <div class="vs-results-count">{len(processed):,} camperplaatsen</div>
    <div class="vs-results-sub">Nederland · {len(df):,} in database</div>
  </div>
  <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
    {tags_html}
  </div>
</div>
""", unsafe_allow_html=True)

# ── RESULTATENLIJST ────────────────────────────────────────────────────────────
display_df = processed.head(200)

if display_df.empty:
    render_no_results(active_query)
else:
    for idx, row in display_df.iterrows():
        render_result_card(row, idx)

    if len(processed) > 200:
        st.markdown(
            f"<p style='text-align:center;color:{TEXT_MUTE};font-size:0.8rem;"
            f"margin-top:0.5rem;'>Top 200 van {len(processed):,} · "
            f"Gebruik filters om te verfijnen.</p>",
            unsafe_allow_html=True,
        )

st.markdown(
    f"<hr style='border-color:{BORDER};margin-top:2rem;'>"
    f"<p style='text-align:center;color:#B0BEC5;font-size:0.72rem;"
    f"padding-bottom:0.5rem;'>VrijStaan · Camperplaatsen zonder vertrektijden 🚐</p>",
    unsafe_allow_html=True,
)
