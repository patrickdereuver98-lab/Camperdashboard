"""
main.py — VrijStaan Startpagina v4.
Booking.com-stijl landing: hero met zoekbalk, stats, provincie-shortcuts.
"""
from __future__ import annotations

import streamlit as st

from ui.theme import (
    apply_theme, render_sidebar_header,
    BRAND_PRIMARY, BRAND_DARK, BRAND_ACCENT, TEXT_MUTED, BORDER,
)

# ── CONFIGURATIE ───────────────────────────────────────────────────────────────
st.set_page_config(
    page_title="VrijStaan | Camperplaatsen Nederland",
    page_icon="🚐",
    layout="wide",
    initial_sidebar_state="expanded",
)

apply_theme()
render_sidebar_header()

# ── SESSIE STATE ───────────────────────────────────────────────────────────────
_DEFAULTS = {
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


# ── STATS LADEN ────────────────────────────────────────────────────────────────
@st.cache_data(ttl=3600, show_spinner=False)
def _get_stats() -> dict:
    try:
        from utils.data_handler import load_data
        df = load_data()
        if df.empty:
            return {"total": 0, "gratis": 0, "provincies": 0}
        gratis = int(df["prijs"].astype(str).str.lower().str.contains("gratis", na=False).sum())
        provs  = df["provincie"].nunique()
        return {"total": len(df), "gratis": gratis, "provincies": provs}
    except Exception:
        return {"total": 750, "gratis": 120, "provincies": 12}

stats = _get_stats()


# ── HERO SECTIE + ZOEKBALK ────────────────────────────────────────────────────
st.markdown(f"""
<div class="vs-hero">
  <div style="position:relative;z-index:2;">
    <div style="display:flex;align-items:center;gap:12px;margin-bottom:0.8rem;">
      <svg width="42" height="42" viewBox="0 0 24 24" fill="none" stroke="white"
           stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10
                 s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9
                 A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/>
        <circle cx="7" cy="17" r="2"/>
        <path d="M9 17h6"/>
        <circle cx="17" cy="17" r="2"/>
      </svg>
      <span style="font-family:'DM Serif Display',serif;font-size:1.4rem;
                   color:rgba(255,255,255,0.85);">VrijStaan</span>
    </div>
    <div class="vs-hero-title">Vind jouw perfecte<br>camperplek in Nederland</div>
    <div class="vs-hero-sub">
      Zoek in <strong style="color:white;">{stats['total']:,}</strong> camperplaatsen
      · AI-aangedreven · Altijd actueel
    </div>
  </div>
</div>
""", unsafe_allow_html=True)

# Centrale zoekbalk
srch_col, btn_col = st.columns([5, 1])
with srch_col:
    search_val = st.text_input(
        "landing_search",
        value=st.session_state["ai_query_cp"],
        placeholder="🔍  Zoek op plaatsnaam, provincie of omschrijving — bijv. 'Drenthe gratis honden'",
        label_visibility="collapsed",
    )
with btn_col:
    if st.button("Zoeken", type="primary", use_container_width=True):
        st.session_state["ai_query_cp"] = search_val.strip()
        st.switch_page("pages/3_🚐_Camperplaatsen.py")

st.write("")

# ── STATS ─────────────────────────────────────────────────────────────────────
s1, s2, s3, s4 = st.columns(4)
for col, num, label, icon in [
    (s1, f"{stats['total']:,}",    "Camperplaatsen", "🗺️"),
    (s2, f"{stats['gratis']:,}",   "Gratis plekken", "💰"),
    (s3, f"{stats['provincies']}", "Provincies",      "📍"),
    (s4, "24/7",                   "Beschikbaar",     "🕐"),
]:
    col.markdown(f"""
<div class="vs-stat-card">
  <div style="font-size:1.5rem;margin-bottom:4px;">{icon}</div>
  <div class="vs-stat-num">{num}</div>
  <div class="vs-stat-label">{label}</div>
</div>""", unsafe_allow_html=True)

st.write("")
st.markdown(f"<hr style='border-color:{BORDER};'>", unsafe_allow_html=True)

# ── PROVINCIE SHORTCUTS ────────────────────────────────────────────────────────
st.markdown(f"""
<h2 style="font-family:'DM Serif Display',serif;font-size:1.4rem;
color:{BRAND_DARK};margin-bottom:0.3rem;">Populaire provincies</h2>
<p style="color:{TEXT_MUTED};font-size:0.85rem;margin-bottom:1rem;">
Snel zoeken per regio</p>""", unsafe_allow_html=True)

PROVINCIES = [
    ("Drenthe",       "🌲"),
    ("Zeeland",       "🌊"),
    ("Friesland",     "⛵"),
    ("Noord-Holland", "🌷"),
    ("Gelderland",    "🏕️"),
    ("Overijssel",    "🐄"),
]
pc = st.columns(len(PROVINCIES))
for col, (prov, icon) in zip(pc, PROVINCIES):
    with col:
        if st.button(f"{icon}\n{prov}", use_container_width=True, type="secondary"):
            st.session_state["_landing_province"] = prov
            st.switch_page("pages/3_🚐_Camperplaatsen.py")

st.write("")

# ── FEATURE HIGHLIGHTS ─────────────────────────────────────────────────────────
st.markdown(f"""
<h2 style="font-family:'DM Serif Display',serif;font-size:1.5rem;
color:{BRAND_DARK};margin-bottom:0.3rem;">Waarom VrijStaan?</h2>""",
unsafe_allow_html=True)

f1, f2, f3, f4 = st.columns(4)
features = [
    ("✨", "AI-zoekopdracht",    "Zoek in gewone taal. 'Gratis, honden, Drenthe' — AI begrijpt het direct.", f1),
    ("🗺️", "Interactieve kaart", "Bekijk locaties op de kaart. Klik een pin voor alle details.", f2),
    ("📸", "Meerdere foto's",    "Per locatie worden meerdere foto's opgehaald van de bronwebsite.", f3),
    ("💰", "Gratis plekken",     "Honderden gratis camperplaatsen zonder vertrektijden. Echt vrij staan.", f4),
]
for icon, title, desc, col in features:
    col.markdown(f"""
<div style="background:white;border-radius:14px;border:1px solid {BORDER};
padding:1.3rem 1.1rem;height:100%;">
  <div style="font-size:1.6rem;margin-bottom:0.6rem;">{icon}</div>
  <div style="font-family:'DM Serif Display',serif;font-size:1rem;
color:{BRAND_DARK};margin-bottom:0.3rem;">{title}</div>
  <div style="font-size:0.82rem;color:{TEXT_MUTED};line-height:1.5;">{desc}</div>
</div>""", unsafe_allow_html=True)

st.write("")

# ── CTA ────────────────────────────────────────────────────────────────────────
cta_l, cta_c, cta_r = st.columns([1, 2, 1])
with cta_c:
    if st.button(
        "🚐  Zoek alle camperplaatsen  →",
        type="primary",
        use_container_width=True,
    ):
        st.switch_page("pages/3_🚐_Camperplaatsen.py")

# ── FOOTER ─────────────────────────────────────────────────────────────────────
st.markdown(f"""
<hr style="border-color:{BORDER};margin-top:2rem;">
<p style="text-align:center;color:#B0BEC5;font-size:0.75rem;padding-bottom:1rem;">
  © 2026 VrijStaan · Data: OpenStreetMap &amp; Google Gemini AI ·
  <span style="color:{BRAND_PRIMARY};">v4.0</span>
</p>""", unsafe_allow_html=True)
