"""
main.py — VrijStaan Startpagina.
Premium landing: hero, AI-zoekbalk, stats, features, provincie-shortcuts.
Design: Dutch Coastal v2 — DM Serif + DM Sans, oceaanblauw + zandgeel.
"""
import streamlit as st
from ui.theme import apply_theme, render_sidebar_header, BRAND_PRIMARY, BRAND_DARK, BRAND_ACCENT, BORDER, TEXT_MUTED

# ── CONFIGURATIE — altijd als allereerste ─────────────────────────────────────
st.set_page_config(
    page_title="VrijStaan | Camperplaatsen",
    page_icon="🚐",
    layout="wide",
    initial_sidebar_state="expanded",
)

# ── THEME — altijd vóór data-laden zodat errors ook gestyled zijn ─────────────
apply_theme()
render_sidebar_header()

# ── SESSIE STATE ──────────────────────────────────────────────────────────────
if "ai_query_cp" not in st.session_state:
    st.session_state["ai_query_cp"] = ""
for key in ("qf_gratis", "qf_honden", "qf_stroom", "qf_wifi"):
    if key not in st.session_state:
        st.session_state[key] = False

# ── DATA (optioneel — voor stats op de landing) ───────────────────────────────
@st.cache_data(ttl=3600, show_spinner=False)
def _get_landing_stats():
    """Haal minimale stats op voor de landing. Geeft fallback bij fout."""
    try:
        from utils.data_handler import load_data
        df = load_data()
        if df.empty:
            return {"total": 0, "gratis": 0, "provincies": 0}
        gratis = int((df["prijs"].astype(str).str.lower() == "gratis").sum())
        provs  = df["provincie"].nunique()
        return {"total": len(df), "gratis": gratis, "provincies": provs}
    except Exception:
        return {"total": 750, "gratis": 120, "provincies": 12}

stats = _get_landing_stats()

# ── HERO SECTIE ───────────────────────────────────────────────────────────────
st.markdown(f"""
<div class="vs-hero">
  <div style="position:relative;z-index:2;">
    <div style="display:flex;align-items:center;gap:12px;margin-bottom:0.8rem;">
      <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="white"
           stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10
                 s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9
                 A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/>
        <circle cx="7" cy="17" r="2"/>
        <path d="M9 17h6"/>
        <circle cx="17" cy="17" r="2"/>
      </svg>
      <span style="font-family:'DM Serif Display',serif;font-size:1.5rem;
                   color:rgba(255,255,255,0.85);letter-spacing:0.01em;">VrijStaan</span>
    </div>
    <h1 class="vs-hero-title">Vind jouw perfecte<br>camperplek in Nederland</h1>
    <p class="vs-hero-sub">
      Zoek in <strong style="color:rgba(255,255,255,0.95);">{stats['total']:,}</strong> camperplaatsen
      · AI-aangedreven · Altijd actueel
    </p>
  </div>
</div>
""", unsafe_allow_html=True)

# ── AI ZOEKBALK ───────────────────────────────────────────────────────────────
col_inp, col_btn = st.columns([5, 1])
with col_inp:
    search_val = st.text_input(
        "ai_zoekveld",
        value=st.session_state["ai_query_cp"],
        placeholder="✨  Bijv: 'Gratis plek in Drenthe met stroom en honden welkom'",
        label_visibility="collapsed",
    )
with col_btn:
    zoek_btn = st.button("🔍 Zoeken", type="primary", use_container_width=True)

if zoek_btn and search_val.strip():
    st.session_state["ai_query_cp"] = search_val.strip()
    st.switch_page("pages/3_🚐_Camperplaatsen.py")

# ── SNELFILTER CHIPS ──────────────────────────────────────────────────────────
st.markdown(
    "<p style='font-family:DM Sans,sans-serif;font-size:0.82rem;"
    f"color:{TEXT_MUTED};margin:0.4rem 0 0.5rem;'>Of kies een snelfilter:</p>",
    unsafe_allow_html=True
)
c1, c2, c3, c4, c_rest = st.columns([1, 1, 1, 1, 3])

def _chip(col, label, key, icon):
    with col:
        active = st.session_state[key]
        if st.button(
            f"{icon} {label}",
            key=f"landing_{key}",
            type="primary" if active else "secondary",
            use_container_width=True
        ):
            st.session_state[key] = not active
            st.switch_page("pages/3_🚐_Camperplaatsen.py")

_chip(c1, "Gratis",  "qf_gratis", "💰")
_chip(c2, "Honden",  "qf_honden", "🐾")
_chip(c3, "Stroom",  "qf_stroom", "⚡")
_chip(c4, "Wifi",    "qf_wifi",   "📶")

st.write("")

# ── STATS BALK ────────────────────────────────────────────────────────────────
s1, s2, s3, s4 = st.columns(4)
for col, num, label, icon in [
    (s1, f"{stats['total']:,}",    "Camperplaatsen",  "🗺️"),
    (s2, f"{stats['gratis']:,}",   "Gratis plekken",  "💰"),
    (s3, f"{stats['provincies']}", "Provincies",       "📍"),
    (s4, "24/7",                   "Beschikbaar",      "🕐"),
]:
    col.markdown(f"""
<div class="vs-stat-card">
  <div style="font-size:1.6rem;margin-bottom:4px;">{icon}</div>
  <div class="vs-stat-num">{num}</div>
  <div class="vs-stat-label">{label}</div>
</div>
""", unsafe_allow_html=True)

st.write("")
st.markdown(f"<hr style='border-color:{BORDER};'>", unsafe_allow_html=True)

# ── FEATURE HIGHLIGHTS ────────────────────────────────────────────────────────
st.markdown(f"""
<h2 style="font-family:'DM Serif Display',serif;font-size:1.7rem;
           color:{BRAND_DARK};margin-bottom:0.3rem;">
  Waarom VrijStaan?
</h2>
<p style="font-family:'DM Sans',sans-serif;color:{TEXT_MUTED};
          font-size:0.95rem;margin-bottom:1.4rem;">
  Alles wat je nodig hebt voor de perfecte campertrip, op één plek.
</p>
""", unsafe_allow_html=True)

f1, f2, f3, f4 = st.columns(4)
features = [
    ("✨", "AI-zoekopdracht",    "Typ gewoon wat je zoekt. Onze AI begrijpt 'gratis, honden, Drenthe' en filtert direct.", f1),
    ("🗺️", "Interactieve kaart", "Bekijk alle locaties op een live kaart. Klik een pin voor direct details en navigatie.", f2),
    ("🔄", "Live databronnen",   "Data wordt continu bijgewerkt via OpenStreetMap en AI-verrijking via Google Gemini.", f3),
    ("💰", "Gratis plekken",     "Honderden gratis camperplaatsen zonder vertrektijden. Echt vrij staan.", f4),
]
for icon, title, desc, col in features:
    col.markdown(f"""
<div class="vs-feature-card">
  <span class="vs-feature-icon">{icon}</span>
  <div class="vs-feature-title">{title}</div>
  <p class="vs-feature-desc">{desc}</p>
</div>
""", unsafe_allow_html=True)

st.write("")

# ── PROVINCIE SHORTCUTS ───────────────────────────────────────────────────────
st.markdown(f"""
<h2 style="font-family:'DM Serif Display',serif;font-size:1.4rem;
           color:{BRAND_DARK};margin-bottom:0.3rem;">
  Populaire provincies
</h2>
<p style="font-family:'DM Sans',sans-serif;color:{TEXT_MUTED};
          font-size:0.85rem;margin-bottom:1rem;">
  Snel zoeken per regio
</p>
""", unsafe_allow_html=True)

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
            # Sla provincie-filter op en navigeer naar zoekpagina
            st.session_state["_landing_province"] = prov
            st.switch_page("pages/3_🚐_Camperplaatsen.py")

st.write("")

# ── CTA ───────────────────────────────────────────────────────────────────────
st.markdown(f"""
<div style="background:linear-gradient(135deg,{BRAND_DARK},{BRAND_PRIMARY});
            border-radius:18px; padding:2.2rem 2rem; text-align:center;
            margin:0.5rem 0 2rem;">
  <div style="font-family:'DM Serif Display',serif;font-size:1.6rem;
              color:white;margin-bottom:0.5rem;">
    Klaar om te vertrekken?
  </div>
  <p style="font-family:'DM Sans',sans-serif;color:rgba(255,255,255,0.75);
            font-size:0.95rem;margin-bottom:1.4rem;">
    Bekijk alle {stats['total']:,} camperplaatsen op de kaart.
  </p>
</div>
""", unsafe_allow_html=True)

cta_l, cta_c, cta_r = st.columns([1, 2, 1])
with cta_c:
    if st.button(
        "🚐  Zoek alle camperplaatsen  →",
        type="primary",
        use_container_width=True,
    ):
        st.switch_page("pages/3_🚐_Camperplaatsen.py")

# ── FOOTER ────────────────────────────────────────────────────────────────────
st.markdown(f"""
<hr style="border-color:{BORDER}; margin-top:1.5rem;">
<p style="text-align:center;font-family:'DM Sans',sans-serif;
          font-size:0.75rem;color:#B0BEC5;padding-bottom:1rem;">
  © 2025 VrijStaan · Data: OpenStreetMap &amp; Google Gemini AI ·
  <span style="color:{BRAND_PRIMARY};">v2.0</span>
</p>
""", unsafe_allow_html=True)
