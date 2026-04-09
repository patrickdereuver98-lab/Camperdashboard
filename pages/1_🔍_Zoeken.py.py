"""
pages/1_🔍_Zoeken.py — VrijStaan v5.2 Zoekpagina.

Wijzigingen t.o.v. v5.1:
  - Hero-sectie volledig GECENTREERD (text-align: center, columns [1,4,1]).
  - __import__ hack verwijderd — BRAND_DARK direct geïmporteerd uit ui.theme.
  - Zoekbalk gebruikt st.columns([1,4,1]) voor centrering.
  - Hero gebruikt nieuwe .vs-search-hero CSS klasse uit theme.py.
  - Alle filtering, sessie-state en hybride-zoek volledig intact.
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
from utils.helpers import clean_val, safe_html, hybrid_search_df, apply_vehicle_filters

# ── PAGINA CONFIGURATIE ────────────────────────────────────────────────────────
st.set_page_config(
    page_title="VrijStaan | Zoeken",
    page_icon="🔍",
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
    st.warning("⚠️ Geen data gevonden. Ga naar **Beheer** om de database te vullen.", icon="🗄️")
    st.stop()


# ── FILTER SIDEBAR ─────────────────────────────────────────────────────────────
filters = render_filter_sidebar(df)


# ══════════════════════════════════════════════════════════════════════════════
# HERO SECTIE — volledig gecentreerd (Carte Blanche fix)
# Gebruikt .vs-search-hero CSS uit theme.py voor gradient + padding.
# Zoekbalk in st.columns([1,4,1]) voor horizontale centrering.
# ══════════════════════════════════════════════════════════════════════════════
st.markdown(f"""
<div class="vs-search-hero">
  <div class="vs-search-hero-title">🔍 Vind jouw camperplaats</div>
  <div class="vs-search-hero-sub">
    Zoek in <strong style="color:white;">{len(df):,}</strong> locaties door heel Nederland
  </div>
  <div>
    <span class="vs-hero-pill">🗺️ {df['provincie'].nunique() if not df.empty else 0} provincies</span>
    <span class="vs-hero-pill">💰 Gratis plekken beschikbaar</span>
    <span class="vs-hero-pill">✨ AI-aangedreven zoeken</span>
  </div>
</div>
""", unsafe_allow_html=True)

# Gecentreerde zoekbalk via kolommen
_pad_l, _srch_col, _btn_col, _pad_r = st.columns([1, 5, 1.2, 1])
with _srch_col:
    search_input = st.text_input(
        "zoek_input",
        value=st.session_state.get("ai_query_cp", ""),
        placeholder="Zoek op plaatsnaam, provincie of omschrijving…",
        label_visibility="collapsed",
    )
with _btn_col:
    zoek_klik = st.button("🔍 Zoeken", type="primary", use_container_width=True)

if zoek_klik:
    st.session_state["ai_query_cp"] = search_input.strip()
    st.rerun()

# Wis-knop (gecentreerd)
if st.session_state["ai_query_cp"]:
    _, _wis_col, _ = st.columns([3, 2, 3])
    with _wis_col:
        if st.button("✕ Wis zoekopdracht", type="secondary", use_container_width=True):
            st.session_state["ai_query_cp"] = ""
            st.session_state["ai_active_filters"] = []
            st.rerun()

st.write("")  # Ademruimte onder hero


# ══════════════════════════════════════════════════════════════════════════════
# FILTERING PIPELINE — volledig intact, geen wijzigingen aan logica
# ══════════════════════════════════════════════════════════════════════════════
processed    = df.copy()
ai_labels:   list[str] = []
active_query = st.session_state.get("ai_query_cp", "")

# Pijler 4: Hybride zoekfunctie (exact → AI fallback)
if active_query:
    direct, use_ai = hybrid_search_df(processed, active_query)
    if not use_ai:
        processed = direct
        ai_labels = [f"📍 Direct match: {active_query}"]
    else:
        with st.spinner("✨ AI interpreteert je zoekopdracht…"):
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
gratis_actief = (
    filters.prijs_cat == "Gratis"
    or st.session_state.get("qf_gratis", False)
)
if gratis_actief:
    processed = processed[
        processed["prijs"].astype(str).str.lower().str.contains("gratis", na=False)
    ]
elif filters.prijs_cat == "Betaald":
    processed = processed[
        ~processed["prijs"].astype(str).str.lower().str.contains("gratis", na=False)
    ]

# Faciliteiten
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

# Voertuig restricties
processed = apply_vehicle_filters(
    processed, filters.f_lange_camper, filters.f_zwaar_voertuig
)

# Minimale beoordeling
if filters.min_score > 0 and "beoordeling" in processed.columns:
    def _score_ok(v: object) -> bool:
        try:
            f = float(str(v).replace(",", ".").split("/")[0])
            return (f * 2 if f <= 5 else f) >= filters.min_score
        except (ValueError, TypeError):
            return filters.min_score == 0.0
    processed = processed[processed["beoordeling"].apply(_score_ok)]

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
        errors="coerce",
    )
    processed = tmp.sort_values("_s", ascending=False).drop(columns=["_s"])
elif filters.sort_keuze == "Afstand ↑" and "afstand_km" in processed.columns:
    processed = processed.sort_values("afstand_km")


# ── KAARTWEERGAVE (standaard verborgen, via sidebar toggle) ────────────────────
if filters.toon_kaart:
    render_map_section(processed, height=460)


# ── RESULTATEN HEADER ──────────────────────────────────────────────────────────
st.markdown(
    f"""<div class="vs-results-header">
  <div class="vs-results-count">{len(processed):,} camperplaatsen gevonden</div>
  <div class="vs-results-sub">· {len(df):,} locaties in database</div>
</div>""",
    unsafe_allow_html=True,
)

# AI filter-tags
active_labels = st.session_state.get("ai_active_filters", [])
if active_labels and active_query:
    tags_html = "".join(
        f'<span class="vs-ai-tag">✨ {safe_html(lbl)}</span>'
        for lbl in active_labels
    )
    st.markdown(
        f'<div style="margin-bottom:0.9rem;">'
        f'<span style="font-size:0.73rem;color:{TEXT_MUTED};margin-right:6px;">Filters:</span>'
        f'{tags_html}</div>',
        unsafe_allow_html=True,
    )


# ── RESULTATENLIJST ────────────────────────────────────────────────────────────
display_df = processed.head(200)

if display_df.empty:
    render_no_results(active_query)
else:
    for idx, row in display_df.iterrows():
        render_result_card(row, idx)

    if len(processed) > 200:
        st.markdown(
            f"<p style='text-align:center;color:{TEXT_MUTED};font-size:0.77rem;"
            f"margin-top:0.5rem;'>"
            f"Top 200 van {len(processed):,} resultaten · gebruik filters om te verfijnen.</p>",
            unsafe_allow_html=True,
        )


# ── FOOTER ─────────────────────────────────────────────────────────────────────
st.markdown(
    f"<hr style='border-color:{BORDER};margin-top:2rem;'>"
    f"<p style='text-align:center;color:#B0BEC5;font-size:0.72rem;"
    f"padding-bottom:0.5rem;'>VrijStaan · Camperplaatsen zonder vertrektijden 🚐</p>",
    unsafe_allow_html=True,
)
