"""
pages/1_🔍_Zoeken.py — VrijStaan v5 Zoekpagina.
Pijler 3: Booking.com-stijl layout. Pijler 4: Hybride zoekfunctie.
Pijler 0: Extreme whitespace, zero clutter.
"""
from __future__ import annotations

import pandas as pd
import streamlit as st

from ui.theme import apply_theme, render_sidebar_header, TEXT_MUTED, BORDER
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
    "ai_query_cp": "", "ai_active_filters": [], "qf_gratis": False,
    "qf_honden": False, "qf_stroom": False, "qf_wifi": False,
    "show_map": False, "_landing_province": None,
}
for k, v in _DEFAULTS.items():
    if k not in st.session_state:
        st.session_state[k] = v


# ── DATA ───────────────────────────────────────────────────────────────────────
@st.cache_data(ttl=300, show_spinner=False)
def _load() -> pd.DataFrame:
    return load_data()

with st.spinner("📡 Locaties laden…"):
    df = _load()

if df.empty:
    st.warning("⚠️ Geen data. Ga naar **Beheer** om de database te vullen.", icon="🗄️")
    st.stop()


# ── FILTER SIDEBAR ─────────────────────────────────────────────────────────────
filters = render_filter_sidebar(df)


# ── BOOKING.COM ZOEKBALK ───────────────────────────────────────────────────────
# Pijler 0: Zoekbalk bovenaan, groot, clean. Geen datums, geen rommel.
st.markdown(f"""
<div style="background:{__import__('ui.theme', fromlist=['BRAND_DARK']).BRAND_DARK};
padding:1.2rem 1.5rem 1.6rem;border-radius:0 0 14px 14px;margin:-1rem -1rem 1.5rem;">
  <div style="font-family:'DM Serif Display',serif;font-size:1.6rem;color:white;
margin-bottom:0.3rem;">🔍 Vind je camperplaats</div>
  <div style="font-size:0.88rem;color:rgba(255,255,255,0.7);">
    Zoek in {len(df):,} locaties — typ een naam, provincie of omschrijving
  </div>
</div>
""", unsafe_allow_html=True)

srch_col, btn_col = st.columns([5, 1])
with srch_col:
    search_input = st.text_input(
        "zoek_input",
        value=st.session_state.get("ai_query_cp", ""),
        placeholder="🔍  Bijv. 'Zeeland gratis honden' of 'rustige plek Drenthe stroom'",
        label_visibility="collapsed",
    )
with btn_col:
    zoek_klik = st.button("Zoeken", type="primary", use_container_width=True)

if zoek_klik:
    st.session_state["ai_query_cp"] = search_input.strip()
    st.rerun()

if st.session_state["ai_query_cp"]:
    if st.button("✕ Wis zoekopdracht", type="secondary"):
        st.session_state["ai_query_cp"] = ""
        st.session_state["ai_active_filters"] = []
        st.rerun()


# ── FILTERING PIPELINE ─────────────────────────────────────────────────────────
processed   = df.copy()
ai_labels:  list[str] = []
active_query = st.session_state.get("ai_query_cp", "")

# Pijler 4: Hybride zoekfunctie
if active_query:
    direct, use_ai = hybrid_search_df(processed, active_query)
    if not use_ai:
        processed  = direct
        ai_labels  = [f"📍 Direct match: {active_query}"]
    else:
        with st.spinner("✨ AI interpreteert je zoekopdracht…"):
            processed, ai_labels = process_ai_query(processed, active_query)
    st.session_state["ai_active_filters"] = ai_labels

# Naam zoeken (sidebar)
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
    processed = processed[processed["honden_toegestaan"].astype(str).str.lower() == "ja"]
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

# Pijler 3: Voertuig filters
processed = apply_vehicle_filters(processed, filters.f_lange_camper, filters.f_zwaar_voertuig)

# Minimale beoordeling
if filters.min_score > 0 and "beoordeling" in processed.columns:
    def _score_ok(v: object) -> bool:
        try:
            f = float(str(v).replace(",", ".").split("/")[0])
            score_10 = f * 2 if f <= 5 else f
            return score_10 >= filters.min_score
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


# ── KAARTWEERGAVE (Pijler 3: verborgen by default) ─────────────────────────────
if filters.toon_kaart:
    render_map_section(processed, height=460)


# ── RESULTATEN HEADER ──────────────────────────────────────────────────────────
st.markdown(f"""
<div class="vs-results-header">
  <div class="vs-results-count">{len(processed):,} camperplaatsen gevonden</div>
  <div class="vs-results-sub">in Nederland · {len(df):,} locaties totaal</div>
</div>
""", unsafe_allow_html=True)

# AI filter tags
active_labels = st.session_state.get("ai_active_filters", [])
if active_labels and active_query:
    tags = "".join(
        f'<span class="vs-ai-tag">✨ {safe_html(lbl)}</span>'
        for lbl in active_labels
    )
    st.markdown(
        f'<div style="margin-bottom:0.8rem;">'
        f'<span style="font-size:0.74rem;color:{TEXT_MUTED};margin-right:6px;">Filters:</span>'
        f'{tags}</div>',
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
            f"<p style='text-align:center;color:{TEXT_MUTED};font-size:0.78rem;"
            f"margin-top:0.5rem;'>Top 200 van {len(processed):,} · "
            f"Gebruik filters om te verfijnen.</p>",
            unsafe_allow_html=True,
        )


# ── FOOTER ─────────────────────────────────────────────────────────────────────
st.markdown(
    f"<hr style='border-color:{BORDER};margin-top:2rem;'>"
    f"<p style='text-align:center;color:#B0BEC5;font-size:0.72rem;"
    f"padding-bottom:0.5rem;'>VrijStaan · Camperplaatsen zonder vertrektijden 🚐</p>",
    unsafe_allow_html=True,
)
