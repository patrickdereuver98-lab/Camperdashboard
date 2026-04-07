"""
pages/3_🚐_Camperplaatsen.py — Premium Camperplaatsen Zoekpagina v4.
Booking.com-stijl layout: horizontale zoekbalk bovenaan, lijst direct,
kaart als optionele toggle, rijke resultaatkaarten.

Architectuur (Pijler 1):
  - Routing & state management hier
  - UI-rendering via ui/components.py, ui/sidebar.py, ui/map_view.py
  - Filtering pipeline ongewijzigd (core logica intact)
  - Hybride zoekfunctie (Pijler 4): exact → AI-fallback
"""
from __future__ import annotations

import pandas as pd
import streamlit as st

from ui.theme import (
    apply_theme, render_sidebar_header,
    BRAND_PRIMARY, BRAND_DARK, TEXT_MUTED, BORDER,
)
from ui.components import render_result_card, render_no_results
from ui.sidebar import render_filter_sidebar
from ui.map_view import render_map_section

from utils.ai_helper import process_ai_query
from utils.data_handler import load_data
from utils.favorites import get_favorites, init_favorites
from utils.helpers import clean_val, safe_html, hybrid_search_df

# ── PAGINA CONFIGURATIE ────────────────────────────────────────────────────────
st.set_page_config(
    page_title="VrijStaan | Camperplaatsen zoeken",
    page_icon="🚐",
    layout="wide",
    initial_sidebar_state="expanded",
)

apply_theme()
render_sidebar_header()
init_favorites()

# ── SESSIE STATE ───────────────────────────────────────────────────────────────
_DEFAULTS: dict = {
    "ai_query_cp":       "",
    "ai_active_filters": [],
    "qf_gratis":         False,
    "qf_honden":         False,
    "qf_stroom":         False,
    "qf_wifi":           False,
    "show_map":          False,   # Kaart standaard verborgen (Booking.com stijl)
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
    st.warning(
        "⚠️ Geen data gevonden. Ga naar **Beheer** om de database te initialiseren.",
        icon="🗄️",
    )
    st.stop()


# ── FILTER SIDEBAR ─────────────────────────────────────────────────────────────
filters = render_filter_sidebar(df)


# ── BOOKING.COM ZOEKBALK (BOVENAAN) ───────────────────────────────────────────
st.markdown(f"""
<div class="vs-searchbar-wrap">
  <div class="vs-searchbar-title">🚐 Vind jouw camperplaats</div>
  <div class="vs-searchbar-sub">
    Zoek in <strong style="color:white;">{len(df):,}</strong> locaties
    door heel Nederland
  </div>
</div>
""", unsafe_allow_html=True)

# Zoekbalk: location input + grote zoekknop
srch_col, btn_col = st.columns([5, 1])
with srch_col:
    search_input = st.text_input(
        "zoekveld",
        value=st.session_state.get("ai_query_cp", ""),
        placeholder=(
            "🔍  Zoek op plaatsnaam, provincie of omschrijving "
            "— bijv. 'Drenthe gratis honden'"
        ),
        label_visibility="collapsed",
    )
with btn_col:
    zoek_geklikt = st.button(
        "Zoeken", type="primary", use_container_width=True
    )

if zoek_geklikt:
    st.session_state["ai_query_cp"] = search_input.strip()
    st.rerun()

# Wis-knop
if st.session_state["ai_query_cp"]:
    if st.button("✕ Zoekopdracht wissen", type="secondary"):
        st.session_state["ai_query_cp"] = ""
        st.session_state["ai_active_filters"] = []
        st.rerun()


# ── FILTERING PIPELINE ─────────────────────────────────────────────────────────
processed   = df.copy()
ai_labels: list[str] = []
active_query = st.session_state.get("ai_query_cp", "")

# ── Pijler 4: Hybride zoekfunctie ─────────────────────────────────────────────
if active_query:
    direct_result, use_ai = hybrid_search_df(processed, active_query)

    if not use_ai:
        # Exacte naam/provincie match gevonden
        processed  = direct_result
        ai_labels  = [f"📍 Exacte match: {active_query}"]
        st.session_state["ai_active_filters"] = ai_labels
    else:
        # Geen directe match → AI-intentie zoeken
        with st.spinner("✨ AI interpreteert je zoekopdracht…"):
            processed, ai_labels = process_ai_query(processed, active_query)
        st.session_state["ai_active_filters"] = ai_labels

# ── Naam filter (sidebar) ──────────────────────────────────────────────────────
if filters.naam_query:
    processed = processed[
        processed["naam"].astype(str).str.lower().str.contains(
            filters.naam_query.lower(), na=False
        )
    ]

# ── Provincie filter ───────────────────────────────────────────────────────────
if filters.selected_provs:
    processed = processed[processed["provincie"].isin(filters.selected_provs)]

# ── Prijs filter ───────────────────────────────────────────────────────────────
gratis_actief = (
    filters.prijs_cat == "Gratis"
    or st.session_state.get("qf_gratis", False)
    or filters.f_gratis
)
if gratis_actief:
    processed = processed[
        processed["prijs"].astype(str).str.lower().str.contains("gratis", na=False)
    ]
elif filters.prijs_cat == "Betaald":
    processed = processed[
        ~processed["prijs"].astype(str).str.lower().str.contains("gratis", na=False)
    ]

# ── Faciliteiten filters ───────────────────────────────────────────────────────
if filters.f_stroom or st.session_state.get("qf_stroom", False):
    processed = processed[processed["stroom"].astype(str).str.lower() == "ja"]

if filters.f_honden or st.session_state.get("qf_honden", False):
    processed = processed[
        processed["honden_toegestaan"].astype(str).str.lower() == "ja"
    ]

if filters.f_wifi or st.session_state.get("qf_wifi", False):
    if "wifi" in processed.columns:
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

# ── Favorieten ─────────────────────────────────────────────────────────────────
if filters.toon_favs:
    favs = get_favorites()
    processed = processed[processed["naam"].isin(favs)]

# ── Sorteren ───────────────────────────────────────────────────────────────────
if filters.sort_keuze == "Naam A→Z":
    processed = processed.sort_values("naam", key=lambda s: s.str.lower())
elif filters.sort_keuze == "Prijs (gratis eerst)":
    tmp = processed.copy()
    tmp["_gratis"] = tmp["prijs"].astype(str).str.lower().str.contains("gratis", na=False)
    processed = tmp.sort_values("_gratis", ascending=False).drop(columns=["_gratis"])
elif filters.sort_keuze == "Beoordeling ↓":
    tmp = processed.copy()
    tmp["_score"] = pd.to_numeric(
        tmp["beoordeling"].astype(str).str.replace(",", ".").str.split("/").str[0],
        errors="coerce",
    )
    processed = tmp.sort_values("_score", ascending=False).drop(columns=["_score"])


# ── KAARTWEERGAVE (Booking.com: optioneel, boven de lijst) ────────────────────
if filters.toon_kaart:
    render_map_section(processed, height=480)


# ── RESULTATEN HEADER ──────────────────────────────────────────────────────────
st.markdown(f"""
<div class="vs-results-header">
  <div class="vs-results-count">{len(processed):,} camperplaatsen gevonden</div>
  <div class="vs-results-sub">in Nederland · {len(df):,} locaties in database</div>
</div>
""", unsafe_allow_html=True)

# AI filter tags
active_filters_list = st.session_state.get("ai_active_filters", [])
if active_filters_list and active_query:
    tags_html = "".join(
        f'<span class="vs-ai-tag">✨ {safe_html(lbl)}</span>'
        for lbl in active_filters_list
    )
    st.markdown(
        f'<div style="margin-bottom:0.8rem;">'
        f'<span style="font-size:0.77rem;color:{TEXT_MUTED};margin-right:6px;">'
        f'AI herkende:</span>{tags_html}</div>',
        unsafe_allow_html=True,
    )


# ── RESULTATENLIJST ────────────────────────────────────────────────────────────
display_df = processed.head(200)

if display_df.empty:
    render_no_results(active_query)
else:
    for idx, row in display_df.iterrows():
        render_result_card(row, idx)

    # Paginering hint
    if len(processed) > 200:
        st.markdown(
            f"<p style='text-align:center;color:{TEXT_MUTED};font-size:0.8rem;"
            f"margin-top:0.5rem;'>Top 200 van {len(processed):,} resultaten · "
            f"Gebruik filters om verder te verfijnen.</p>",
            unsafe_allow_html=True,
        )


# ── FOOTER ─────────────────────────────────────────────────────────────────────
st.markdown(
    f"<hr style='border-color:{BORDER};margin-top:2rem;'>"
    f"<p style='text-align:center;color:#B0BEC5;font-size:0.75rem;"
    f"padding-bottom:0.5rem;'>VrijStaan · Camperplaatsen zonder vertrektijden 🚐</p>",
    unsafe_allow_html=True,
)
