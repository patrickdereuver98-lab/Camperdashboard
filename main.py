"""
main.py — VrijStaan v5 Landing Page.
Pijler 2: PWA-geoptimaliseerd, high-converting, extreme whitespace (Pijler 0).
Hero-zoekbalk is de absolute held. Social Proof badges.
"""
from __future__ import annotations
import streamlit as st
from ui.theme import (
    apply_theme, render_sidebar_header,
    BRAND_PRIMARY, BRAND_DARK, BRAND_ACCENT, TEXT_MUTED, BORDER,
)

# ── CONFIGURATIE ───────────────────────────────────────────────────────────────
st.set_page_config(
    page_title="VrijStaan — Camperplaatsen Nederland",
    page_icon="🚐",
    layout="wide",
    initial_sidebar_state="collapsed",   # Landing: sidebar dicht voor rust
)

# PWA manifest link injecteren (Pijler 2)
st.html("""
<link rel="manifest" href="/manifest.json">
<meta name="theme-color" content="#003580">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="default">
<meta name="apple-mobile-web-app-title" content="VrijStaan">
""")

apply_theme()
render_sidebar_header()

# ── SESSIE STATE ───────────────────────────────────────────────────────────────
_DEFAULTS = {
    "ai_query_cp": "", "ai_active_filters": [], "qf_gratis": False,
    "qf_honden": False, "qf_stroom": False, "qf_wifi": False,
    "show_map": False, "_landing_province": None,
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
        return {"total": len(df), "gratis": gratis, "provincies": df["provincie"].nunique()}
    except Exception:
        return {"total": 750, "gratis": 120, "provincies": 12}

stats = _get_stats()


# ── HERO SECTIE ────────────────────────────────────────────────────────────────
st.markdown(f"""
<div class="vs-hero">
  <div style="position:relative;z-index:2;max-width:700px;">
    <div class="vs-hero-eyebrow">🚐 Camperplaatsen Nederland</div>
    <div class="vs-hero-title">
      Vind je perfecte<br>vrijstaanplek
    </div>
    <div class="vs-hero-sub">
      Zoek in <strong style="color:white;">{stats['total']:,}</strong> camperplaatsen
      — AI-aangedreven, altijd actueel, volledig gratis.
    </div>
    <div>
      <span class="vs-proof-badge">✅ {stats['gratis']:,} gratis plekken</span>
      <span class="vs-proof-badge">⭐ AI-beoordeeld</span>
      <span class="vs-proof-badge">📍 {stats['provincies']} provincies</span>
      <span class="vs-proof-badge">📱 Installeerbaar als app</span>
    </div>
  </div>
</div>
""", unsafe_allow_html=True)


# ── DE HELD: ZOEKBALK ─────────────────────────────────────────────────────────
# Pijler 0: De zoekbalk is alles. Minimale omgeving, maximale focus.

st.markdown("<div style='max-width:660px;margin:0 auto;'>", unsafe_allow_html=True)

srch_col, btn_col = st.columns([5, 1])
with srch_col:
    search_val = st.text_input(
        "hero_search",
        value=st.session_state["ai_query_cp"],
        placeholder="🔍  Waar ga je naartoe? — bijv. 'Drenthe gratis honden'",
        label_visibility="collapsed",
    )
with btn_col:
    if st.button("Zoek", type="primary", use_container_width=True):
        st.session_state["ai_query_cp"] = search_val.strip()
        st.switch_page("pages/1_🔍_Zoeken.py")

if search_val and st.session_state.get("ai_query_cp") == "":
    # Enter gedrukt zonder knop
    if search_val.strip():
        st.session_state["ai_query_cp"] = search_val.strip()
        st.switch_page("pages/1_🔍_Zoeken.py")

st.markdown("</div>", unsafe_allow_html=True)

# Ruimte
st.write("")
st.write("")

# ── THEMATISCHE KNOPPEN (rustig, minimaal) ────────────────────────────────────
# Pijler 0: Geen rommel. Drie duidelijke ingangen.

st.markdown(f"""<div style="text-align:center;margin-bottom:0.4rem;">
<span style="font-size:0.78rem;color:{TEXT_MUTED};font-weight:500;letter-spacing:0.05em;
text-transform:uppercase;">Of ontdek direct</span></div>""", unsafe_allow_html=True)

btn1, btn2, btn3 = st.columns(3)
with btn1:
    if st.button("📍 Dichtbij mij", use_container_width=True, type="secondary"):
        st.switch_page("pages/2_📍_Dichtbij.py")
with btn2:
    if st.button("🗺️ Reisplanner", use_container_width=True, type="secondary"):
        st.switch_page("pages/3_🗺️_Reisplanner.py")
with btn3:
    if st.button("💰 Gratis plekken", use_container_width=True, type="secondary"):
        st.session_state["qf_gratis"] = True
        st.switch_page("pages/1_🔍_Zoeken.py")

st.write("")
st.markdown(f"<hr style='border-color:{BORDER};'>", unsafe_allow_html=True)

# ── STATS ROW ─────────────────────────────────────────────────────────────────
s1, s2, s3, s4 = st.columns(4)
for col, num, label, icon in [
    (s1, f"{stats['total']:,}",    "Camperplaatsen",  "🗺️"),
    (s2, f"{stats['gratis']:,}",   "Gratis plekken",  "💰"),
    (s3, f"{stats['provincies']}", "Provincies",       "📍"),
    (s4, "24/7",                   "Beschikbaar",      "🕐"),
]:
    col.markdown(f"""<div class="vs-stat-card">
<div style="font-size:1.5rem;margin-bottom:5px;">{icon}</div>
<div class="vs-stat-num">{num}</div>
<div class="vs-stat-label">{label}</div>
</div>""", unsafe_allow_html=True)

st.write("")
st.markdown(f"<hr style='border-color:{BORDER};'>", unsafe_allow_html=True)

# ── PROVINCIE SHORTCUTS ────────────────────────────────────────────────────────
st.markdown(f"""<h2 style="font-family:'DM Serif Display',serif;font-size:1.4rem;
color:var(--vs-text);margin-bottom:0.3rem;">Populaire bestemmingen</h2>
<p style="color:{TEXT_MUTED};font-size:0.85rem;margin-bottom:1rem;">
Snel filteren op provincie</p>""", unsafe_allow_html=True)

PROVINCIES = [
    ("Drenthe", "🌲"), ("Zeeland", "🌊"), ("Friesland", "⛵"),
    ("Noord-Holland", "🌷"), ("Gelderland", "🏕️"), ("Overijssel", "🐄"),
]
pc = st.columns(len(PROVINCIES))
for col, (prov, icon) in zip(pc, PROVINCIES):
    with col:
        if st.button(f"{icon}\n{prov}", use_container_width=True, type="secondary"):
            st.session_state["_landing_province"] = prov
            st.switch_page("pages/1_🔍_Zoeken.py")

st.write("")
st.write("")

# ── CTA ────────────────────────────────────────────────────────────────────────
cta_l, cta_c, cta_r = st.columns([1, 2, 1])
with cta_c:
    if st.button("🚐 Bekijk alle camperplaatsen →", type="primary", use_container_width=True):
        st.switch_page("pages/1_🔍_Zoeken.py")

# ── PWA INFO BADGE (Pijler 2) ─────────────────────────────────────────────────
st.markdown(f"""
<div style="text-align:center;margin-top:2rem;padding:1rem;
background:var(--vs-card);border-radius:12px;border:1px solid {BORDER};
max-width:480px;margin-left:auto;margin-right:auto;">
  <div style="font-size:0.78rem;color:{TEXT_MUTED};margin-bottom:4px;">
    📱 <strong>Installeer als app</strong> — Geen App Store nodig
  </div>
  <div style="font-size:0.72rem;color:{TEXT_MUTED};">
    Klik op "Toevoegen aan beginscherm" in je browser voor offline toegang.
  </div>
</div>
""", unsafe_allow_html=True)

# ── FOOTER ─────────────────────────────────────────────────────────────────────
st.markdown(f"""
<div style="text-align:center;margin-top:3rem;padding-bottom:2rem;">
  <p style="color:#B0BEC5;font-size:0.72rem;">
    © 2026 VrijStaan · OpenStreetMap + Google Gemini AI ·
    <span style="color:{BRAND_PRIMARY};">v5.0</span>
  </p>
</div>""", unsafe_allow_html=True)
