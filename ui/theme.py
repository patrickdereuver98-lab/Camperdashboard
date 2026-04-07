"""
ui/theme.py — VrijStaan Design System v3 (Pijler 1: Premium UI/UX Refactor).
Dutch Coastal Premium: DM Serif Display + DM Sans, oceaanblauw + zandgeel.

Wijzigingen t.o.v. v2:
  - Booking.com-stijl kaarten: grotere afbeelding (200px), vetgedrukte prijs,
    visuele ster-iconen, capaciteitsbadge
  - Crash-proof: alle CSS via st.html(), geen external calls in Python
  - white-space:nowrap + text-overflow:ellipsis overal — nooit meer afgebroken tekst
  - min-width:0 op flex-children — voorkomt overflow op mobiel
  - Grotere kaarthoogte (176px) voor meer ademruimte
  - Prijs-weergave: dikgedrukt, accentkleur, direct zichtbaar
  - Grid-view vernieuwd: 2-koloms, kaarten even hoog
  - BUGFIX: Streamlit Material Icons (keyboard_double_arrow) hersteld
"""
import streamlit as st

# ── DESIGN TOKENS ─────────────────────────────────────────────────────────────
BRAND_PRIMARY = "#0077B6"
BRAND_DARK    = "#0A2540"
BRAND_ACCENT  = "#FFB703"
BRAND_LIGHT   = "#00B4D8"
BG_PAGE       = "#F4F7FB"
BG_CARD       = "#FFFFFF"
TEXT_MUTED    = "#6B7F94"
BORDER        = "#E8EEF5"

_FONTS = (
    "https://fonts.googleapis.com/css2?"
    "family=DM+Serif+Display:ital@0;1"
    "&family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,600;9..40,700"
    "&display=swap"
)


def apply_theme():
    """
    Injecteer het volledige VrijStaan design systeem v3.
    Altijd als EERSTE aanroepen, vóór enige data-laad operatie.
    """
    st.html(f"""
    <style>
    @import url('{_FONTS}');

    /* ── BASIS & ACHTERGROND ───────────────────────────────────────────── */
    html, body,
    [data-testid="stAppViewContainer"],
    [data-testid="stMain"],
    section.main, .main {{
        background-color: {BG_PAGE} !important;
        font-family: 'DM Sans', system-ui, sans-serif !important;
    }}
    
    /* ── FIX VOOR DE KEYBOARD DOUBLE ARROW BUG ─────────────────────────── */
    .material-symbols-rounded, 
    .material-icons, 
    [data-testid="collapsedControl"] *, 
    [data-testid="stSidebarCollapseButton"] * {{
        font-family: "Material Symbols Rounded", "Material Icons", sans-serif !important;
    }}

    [data-testid="stSidebarNav"] {{ display: none !important; }}
    [data-testid="stDecoration"]  {{ display: none !important; }}

    /* ── BLOCK CONTAINER ───────────────────────────────────────────────── */
    .block-container {{
        padding-top: 1.5rem !important;
        max-width: 1260px !important;
    }}

    /* ── TYPOGRAFIE ────────────────────────────────────────────────────── */
    h1, h2, h3, h4, h5, h6 {{
        font-family: 'DM Serif Display', Georgia, serif !important;
        color: {BRAND_DARK} !important;
        letter-spacing: -0.01em;
    }}
    p, span, div, label, li,
    .stMarkdown p, .stMarkdown span {{
        font-family: 'DM Sans', system-ui, sans-serif !important;
    }}

    /* ── SIDEBAR ───────────────────────────────────────────────────────── */
    [data-testid="stSidebar"] {{
        background: {BG_CARD} !important;
        border-right: 1px solid {BORDER} !important;
    }}
    [data-testid="stSidebar"] > div:first-child,
    [data-testid="stSidebarContent"] {{
        padding: 0 !important;
    }}

    /* ── SIDEBAR NAV LINKS ─────────────────────────────────────────────── */
    [data-testid="stSidebar"] a,
    [data-testid="stSidebar"] [data-testid="stPageLink"] a {{
        font-family: 'DM Sans', sans-serif !important;
        font-size: 0.9rem !important;
        font-weight: 500 !important;
        color: {BRAND_DARK} !important;
        text-decoration: none !important;
        border-radius: 8px !important;
        transition: background 0.15s, color 0.15s !important;
    }}
    [data-testid="stSidebar"] [data-testid="stPageLink"]:hover a {{
        color: {BRAND_PRIMARY} !important;
        background: rgba(0,119,182,0.07) !important;
    }}

    /* ── KNOPPEN ───────────────────────────────────────────────────────── */
    .stButton > button {{
        font-family: 'DM Sans', sans-serif !important;
        font-weight: 600 !important;
        border-radius: 10px !important;
        transition: all 0.18s ease !important;
        letter-spacing: 0.01em !important;
        padding: 0.5rem 1.2rem !important;
    }}
    .stButton > button[kind="primary"] {{
        background: {BRAND_PRIMARY} !important;
        border: none !important;
        color: white !important;
        box-shadow: 0 2px 8px rgba(0,119,182,0.25) !important;
    }}
    .stButton > button[kind="primary"]:hover {{
        background: {BRAND_DARK} !important;
        transform: translateY(-1px) !important;
        box-shadow: 0 6px 16px rgba(0,119,182,0.35) !important;
    }}
    .stButton > button[kind="secondary"] {{
        background: {BG_CARD} !important;
        border: 1.5px solid {BORDER} !important;
        color: {BRAND_DARK} !important;
    }}
    .stButton > button[kind="secondary"]:hover {{
        border-color: {BRAND_PRIMARY} !important;
        color: {BRAND_PRIMARY} !important;
        background: rgba(0,119,182,0.04) !important;
    }}

    /* ── INPUTS & FORMULIEREN ──────────────────────────────────────────── */
    .stTextInput > div > div > input {{
        font-family: 'DM Sans', sans-serif !important;
        border-radius: 12px !important;
        border: 2px solid {BORDER} !important;
        padding: 0.72rem 1rem !important;
        font-size: 1rem !important;
        background: {BG_CARD} !important;
        color: {BRAND_DARK} !important;
        box-shadow: 0 2px 8px rgba(10,37,64,0.04) !important;
        transition: border-color 0.2s, box-shadow 0.2s !important;
    }}
    .stTextInput > div > div > input:focus {{
        border-color: {BRAND_PRIMARY} !important;
        box-shadow: 0 0 0 3px rgba(0,119,182,0.14) !important;
        outline: none !important;
    }}
    .stTextInput > div > div > input::placeholder {{
        color: {TEXT_MUTED} !important;
        font-style: italic;
    }}
    .stSelectbox > div > div > div,
    .stMultiSelect > div > div > div {{
        border-radius: 10px !important;
        border: 1.5px solid {BORDER} !important;
        font-family: 'DM Sans', sans-serif !important;
        background: {BG_CARD} !important;
    }}
    [data-testid="stSidebar"] .stTextInput > div > div > input {{
        border-radius: 8px !important;
        font-size: 0.88rem !important;
    }}
    .stCheckbox label,
    .stSelectbox label,
    .stMultiSelect label,
    .stSlider label,
    [data-testid="stSidebar"] label {{
        font-family: 'DM Sans', sans-serif !important;
        font-size: 0.88rem !important;
        color: #3A4A5C !important;
    }}

    /* ── TABS ──────────────────────────────────────────────────────────── */
    .stTabs [data-baseweb="tab-list"] {{
        gap: 4px !important;
        border-bottom: 2px solid {BORDER} !important;
        background: transparent !important;
    }}
    .stTabs [data-baseweb="tab"] {{
        font-family: 'DM Sans', sans-serif !important;
        font-weight: 500 !important;
        font-size: 0.9rem !important;
        border-radius: 8px 8px 0 0 !important;
        padding: 0.5rem 1.2rem !important;
        color: {TEXT_MUTED} !important;
    }}
    .stTabs [aria-selected="true"] {{
        color: {BRAND_PRIMARY} !important;
        border-bottom: 2px solid {BRAND_PRIMARY} !important;
    }}

    /* ── METRICS ───────────────────────────────────────────────────────── */
    [data-testid="stMetric"] {{
        background: {BG_CARD} !important;
        border: 1px solid {BORDER} !important;
        border-radius: 14px !important;
        padding: 1.1rem !important;
    }}
    [data-testid="stMetricLabel"] span {{
        font-family: 'DM Sans', sans-serif !important;
        font-size: 0.8rem !important;
        font-weight: 600 !important;
        text-transform: uppercase !important;
        letter-spacing: 0.06em !important;
        color: {TEXT_MUTED} !important;
    }}
    [data-testid="stMetricValue"] {{
        font-family: 'DM Serif Display', serif !important;
        color: {BRAND_DARK} !important;
    }}

    /* ── EXPANDER ──────────────────────────────────────────────────────── */
    [data-testid="stExpander"] {{
        border: 1px solid {BORDER} !important;
        border-radius: 12px !important;
        background: {BG_CARD} !important;
    }}
    [data-testid="stExpander"] summary {{
        font-family: 'DM Sans', sans-serif !important;
        font-weight: 600 !important;
        color: {BRAND_DARK} !important;
    }}

    /* ── ALERTS ────────────────────────────────────────────────────────── */
    [data-testid="stAlert"], .stAlert {{
        border-radius: 12px !important;
        font-family: 'DM Sans', sans-serif !important;
        font-size: 0.9rem !important;
    }}

    /* ── DATAFRAME ─────────────────────────────────────────────────────── */
    [data-testid="stDataFrame"] {{
        border-radius: 12px !important;
        overflow: hidden !important;
        border: 1px solid {BORDER} !important;
    }}

    /* ── SPINNER ───────────────────────────────────────────────────────── */
    [data-testid="stSpinner"] p {{
        font-family: 'DM Sans', sans-serif !important;
        color: {TEXT_MUTED} !important;
    }}

    /* ── DIVIDER ───────────────────────────────────────────────────────── */
    hr {{
        border-color: {BORDER} !important;
        margin: 1.2rem 0 !important;
    }}

    /* ══════════════════════════════════════════════════════════════════ */
    /* PIJLER 1: PREMIUM LOCATIE CARD — Booking.com standaard           */
    /* ══════════════════════════════════════════════════════════════════ */

    /* Container */
    .vs-loc-card {{
        display: flex;
        flex-direction: row;
        background: {BG_CARD};
        border-radius: 16px;
        border: 1px solid {BORDER};
        box-shadow: 0 2px 10px rgba(10,37,64,0.06);
        overflow: hidden;
        margin-bottom: 0.9rem;
        height: 176px;
        transition: transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease;
        position: relative;
    }}
    .vs-loc-card:hover {{
        transform: translateY(-3px);
        box-shadow: 0 10px 28px rgba(10,37,64,0.13);
        border-color: {BRAND_PRIMARY};
    }}

    /* Afbeelding: groter, fixed breedte, nooit vervormd */
    .vs-loc-card-img {{
        width: 200px;
        min-width: 200px;
        max-width: 200px;
        height: 176px;
        object-fit: cover;
        background: #D0E4F0;
        flex-shrink: 0;
        display: block;
    }}

    /* Body: flex-column met min-width:0 voor correct overflow gedrag */
    .vs-loc-card-body {{
        padding: 0.85rem 1rem 0.75rem;
        flex: 1 1 0%;
        min-width: 0;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        overflow: hidden;
    }}

    /* Naam: bold serif, nooit afgebroken */
    .vs-loc-card-name {{
        font-family: 'DM Serif Display', serif;
        font-size: 1.02rem;
        font-weight: 400;
        color: {BRAND_DARK};
        margin: 0 0 2px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        line-height: 1.3;
    }}

    /* Locatie-rij: provincie + capaciteit */
    .vs-loc-card-location {{
        font-family: 'DM Sans', sans-serif;
        font-size: 0.74rem;
        color: #8A9DB5;
        margin: 0 0 5px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }}

    /* Sterren: goud + leeg in grijs */
    .vs-loc-card-stars {{
        font-size: 0.82rem;
        letter-spacing: -1px;
        margin-bottom: 5px;
        white-space: nowrap;
        line-height: 1;
    }}
    .vs-star-full  {{ color: {BRAND_ACCENT}; }}
    .vs-star-empty {{ color: #CBD5E0; }}
    .vs-star-score {{
        font-size: 0.7rem;
        color: {TEXT_MUTED};
        font-family: 'DM Sans', sans-serif;
        letter-spacing: 0;
        margin-left: 3px;
    }}

    /* Badges-rij: horizontaal, geen wrap, overflow hidden */
    .vs-badges-row {{
        display: flex;
        flex-direction: row;
        flex-wrap: nowrap;
        gap: 4px;
        overflow: hidden;
        margin-bottom: 6px;
    }}

    /* Bottom: prijs prominent, dikgedrukt */
    .vs-loc-card-bottom {{
        display: flex;
        align-items: center;
        gap: 8px;
        flex-wrap: nowrap;
        overflow: hidden;
    }}
    .vs-price-main {{
        font-family: 'DM Sans', sans-serif;
        font-size: 1.08rem;
        font-weight: 700;
        color: {BRAND_DARK};
        white-space: nowrap;
    }}
    .vs-price-main.gratis {{
        color: #1B5E20;
    }}
    .vs-price-main.onbekend {{
        color: {TEXT_MUTED};
        font-size: 0.82rem;
        font-weight: 500;
    }}

    /* ── GEDEELDE BADGE COMPONENTEN ────────────────────────────────────── */
    .vs-badge {{
        display: inline-flex;
        align-items: center;
        gap: 3px;
        padding: 2px 8px;
        border-radius: 6px;
        font-family: 'DM Sans', sans-serif;
        font-size: 0.69rem;
        font-weight: 600;
        white-space: nowrap;
        flex-shrink: 0;
    }}
    .vs-badge-gratis   {{ background:#E8F5E9; color:#1B5E20; border:1px solid #C8E6C9; }}
    .vs-badge-betaald  {{ background:#FFF3E0; color:#E65100; border:1px solid #FFE0B2; }}
    .vs-badge-onbekend {{ background:#F5F5F5; color:#546E7A; border:1px solid #E0E0E0; }}
    .vs-badge-stroom   {{ background:#EDF4FF; color:#0056A8; border:1px solid #BBDEFB; }}
    .vs-badge-honden   {{ background:#FFF4E5; color:#B76300; border:1px solid #FFD9A0; }}
    .vs-badge-wifi     {{ background:#EDFAF3; color:#1A7F5A; border:1px solid #B2DFDB; }}
    .vs-badge-water    {{ background:#E8F5FF; color:#005A8C; border:1px solid #B3D9F0; }}
    .vs-badge-groen    {{ background:#F1F8E9; color:#33691E; border:1px solid #DCEDC8; }}

    /* Score-pill (list view) */
    .vs-score-pill {{
        display: inline-flex;
        align-items: center;
        background: {BRAND_PRIMARY};
        color: white;
        border-radius: 6px;
        padding: 2px 7px;
        font-size: 0.7rem;
        font-weight: 700;
        font-family: 'DM Sans', sans-serif;
        white-space: nowrap;
        flex-shrink: 0;
    }}

    /* ── HERO SECTIE ───────────────────────────────────────────────────── */
    .vs-hero {{
        background: linear-gradient(135deg, {BRAND_DARK} 0%, {BRAND_PRIMARY} 60%, {BRAND_LIGHT} 100%);
        border-radius: 20px;
        padding: 3rem 2.5rem 2.5rem;
        position: relative;
        overflow: hidden;
        margin-bottom: 1.5rem;
    }}
    .vs-hero::before {{
        content: '';
        position: absolute;
        top: -60px; right: -60px;
        width: 280px; height: 280px;
        border-radius: 50%;
        background: rgba(255,183,3,0.10);
        pointer-events: none;
    }}
    .vs-hero::after {{
        content: '';
        position: absolute;
        bottom: -80px; left: 20px;
        width: 220px; height: 220px;
        border-radius: 50%;
        background: rgba(0,180,216,0.15);
        pointer-events: none;
    }}
    .vs-hero-title {{
        font-family: 'DM Serif Display', serif !important;
        font-size: 2.4rem;
        color: #FFFFFF !important;
        margin: 0 0 0.4rem;
        position: relative;
        z-index: 1;
        line-height: 1.15;
    }}
    .vs-hero-sub {{
        font-family: 'DM Sans', sans-serif;
        color: rgba(255,255,255,0.78);
        font-size: 1.05rem;
        margin: 0;
        position: relative;
        z-index: 1;
    }}

    /* ── AI FILTER TAG ─────────────────────────────────────────────────── */
    .vs-ai-tag {{
        display: inline-flex;
        align-items: center;
        gap: 5px;
        background: linear-gradient(90deg, {BRAND_DARK}, {BRAND_PRIMARY});
        color: white;
        border-radius: 20px;
        padding: 4px 12px;
        font-size: 0.77rem;
        font-family: 'DM Sans', sans-serif;
        margin: 3px 3px 3px 0;
        white-space: nowrap;
    }}

    /* ── KAART WRAPPER ─────────────────────────────────────────────────── */
    .vs-map-wrap {{
        border-radius: 16px;
        overflow: hidden;
        box-shadow: 0 4px 20px rgba(10,37,64,0.10);
        border: 1px solid {BORDER};
    }}

    /* ── FILTER HEADER IN SIDEBAR ──────────────────────────────────────── */
    .vs-filter-header {{
        font-family: 'DM Serif Display', serif;
        font-size: 0.95rem;
        color: {BRAND_DARK};
        margin: 0.8rem 0 0.4rem;
        padding-bottom: 4px;
        border-bottom: 2px solid {BRAND_ACCENT};
        display: inline-block;
    }}

    /* ── GEEN RESULTATEN ───────────────────────────────────────────────── */
    .vs-no-results {{
        text-align: center;
        padding: 3rem 1rem;
        color: #8A9DB5;
        font-family: 'DM Sans', sans-serif;
    }}

    /* ── LANDING STAT CARD ─────────────────────────────────────────────── */
    .vs-stat-card {{
        background: {BG_CARD};
        border-radius: 16px;
        border: 1px solid {BORDER};
        box-shadow: 0 2px 10px rgba(10,37,64,0.05);
        padding: 1.4rem 1.2rem;
        text-align: center;
    }}
    .vs-stat-num {{
        font-family: 'DM Serif Display', serif;
        font-size: 2.2rem;
        color: {BRAND_PRIMARY};
        line-height: 1.1;
        margin-bottom: 4px;
    }}
    .vs-stat-label {{
        font-family: 'DM Sans', sans-serif;
        font-size: 0.82rem;
        color: {TEXT_MUTED};
        font-weight: 500;
    }}

    /* ── FEATURE CARD ──────────────────────────────────────────────────── */
    .vs-feature-card {{
        background: {BG_CARD};
        border-radius: 16px;
        border: 1px solid {BORDER};
        padding: 1.5rem 1.3rem;
        transition: transform 0.18s, box-shadow 0.18s;
        height: 100%;
    }}
    .vs-feature-card:hover {{
        transform: translateY(-3px);
        box-shadow: 0 10px 28px rgba(10,37,64,0.09);
    }}
    .vs-feature-icon {{
        font-size: 1.8rem;
        margin-bottom: 0.7rem;
        display: block;
    }}
    .vs-feature-title {{
        font-family: 'DM Serif Display', serif;
        font-size: 1.05rem;
        color: {BRAND_DARK};
        margin: 0 0 0.4rem;
    }}
    .vs-feature-desc {{
        font-family: 'DM Sans', sans-serif;
        font-size: 0.83rem;
        color: {TEXT_MUTED};
        line-height: 1.55;
        margin: 0;
    }}

    /* ── MOBIEL / KLEINE SCHERMEN ──────────────────────────────────────── */
    @media (max-width: 768px) {{
        .vs-loc-card-img {{
            width: 120px;
            min-width: 120px;
        }}
        .vs-loc-card-name {{
            font-size: 0.9rem;
        }}
        .vs-hero-title {{
            font-size: 1.7rem !important;
        }}
        .vs-badges-row {{
            gap: 3px;
        }}
        .vs-badge {{
            font-size: 0.62rem;
            padding: 2px 6px;
        }}
    }}
    </style>
    """)


def render_sidebar_header():
    """
    Rendert de volledige premium sidebar.
    Bevat: gradient logo, navigatie, feature-highlights en footer.
    """
    with st.sidebar:
        # ── LOGO SECTIE ──────────────────────────────────────────────
        st.markdown(f"""
<div style="background:linear-gradient(155deg,{BRAND_DARK} 0%,{BRAND_PRIMARY} 100%);
            padding:1.8rem 1.2rem 1.5rem; text-align:center;
            position:relative; overflow:hidden;">
  <div style="position:absolute;top:-30px;right:-30px;width:120px;height:120px;
              border-radius:50%;background:rgba(255,183,3,0.10);"></div>
  <div style="position:absolute;bottom:-40px;left:-20px;width:100px;height:100px;
              border-radius:50%;background:rgba(0,180,216,0.15);"></div>
  <svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="white"
       stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"
       style="position:relative;z-index:1;">
    <path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10
             s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9
             A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/>
    <circle cx="7" cy="17" r="2"/>
    <path d="M9 17h6"/>
    <circle cx="17" cy="17" r="2"/>
  </svg>
  <div style="font-family:'DM Serif Display',serif;font-size:1.6rem;color:white;
              margin:8px 0 3px;position:relative;z-index:1;letter-spacing:-0.01em;">
    VrijStaan
  </div>
  <div style="font-family:'DM Sans',sans-serif;font-size:0.71rem;
              color:rgba(255,255,255,0.62);font-style:italic;
              position:relative;z-index:1;letter-spacing:0.02em;">
    Camperplaatsen zonder vertrektijden
  </div>
</div>
""", unsafe_allow_html=True)

        # ── NAVIGATIE ─────────────────────────────────────────────────
        st.markdown("""
<div style="padding:1rem 1rem 0.4rem;font-family:'DM Sans',sans-serif;">
  <div style="font-size:0.66rem;font-weight:600;color:#8A9DB5;
              text-transform:uppercase;letter-spacing:0.1em;
              margin-bottom:0.4rem;padding-left:4px;">Menu</div>
</div>""", unsafe_allow_html=True)

        st.page_link("main.py",                           label="Startpagina",          icon="🏠")
        st.page_link("pages/3_🚐_Camperplaatsen.py",      label="Camperplaatsen zoeken", icon="🔍")
        st.page_link("pages/2_⚙️_Beheer.py",              label="Data Beheer (Admin)",   icon="⚙️")

        # ── USP's ─────────────────────────────────────────────────────
        st.markdown(f"""
<div style="margin:0 0.8rem;"><hr style="border-color:{BORDER};margin:0.6rem 0;"></div>
<div style="padding:0.6rem 1rem 0.8rem;font-family:'DM Sans',sans-serif;">
  <div style="font-size:0.66rem;font-weight:600;color:#8A9DB5;
              text-transform:uppercase;letter-spacing:0.1em;
              margin-bottom:0.8rem;padding-left:4px;">Over de app</div>
  <div style="display:flex;flex-direction:column;gap:10px;">
    <div style="display:flex;align-items:flex-start;gap:10px;">
      <span style="font-size:15px;margin-top:1px;">🗺️</span>
      <div>
        <div style="font-size:0.83rem;font-weight:600;color:{BRAND_DARK};">750+ locaties</div>
        <div style="font-size:0.73rem;color:#8A9DB5;line-height:1.4;">Heel Nederland gedekt</div>
      </div>
    </div>
    <div style="display:flex;align-items:flex-start;gap:10px;">
      <span style="font-size:15px;margin-top:1px;">✨</span>
      <div>
        <div style="font-size:0.83rem;font-weight:600;color:{BRAND_DARK};">AI-zoekopdracht</div>
        <div style="font-size:0.73rem;color:#8A9DB5;line-height:1.4;">Zoek in gewone taal</div>
      </div>
    </div>
    <div style="display:flex;align-items:flex-start;gap:10px;">
      <span style="font-size:15px;margin-top:1px;">💰</span>
      <div>
        <div style="font-size:0.83rem;font-weight:600;color:{BRAND_DARK};">Gratis plekken</div>
        <div style="font-size:0.73rem;color:#8A9DB5;line-height:1.4;">Geen vertrektijden</div>
      </div>
    </div>
    <div style="display:flex;align-items:flex-start;gap:10px;">
      <span style="font-size:15px;margin-top:1px;">🔄</span>
      <div>
        <div style="font-size:0.83rem;font-weight:600;color:{BRAND_DARK};">Live-data</div>
        <div style="font-size:0.73rem;color:#8A9DB5;line-height:1.4;">OSM + Gemini AI</div>
      </div>
    </div>
  </div>
</div>
<div style="margin:0 0.8rem;"><hr style="border-color:{BORDER};margin:0.2rem 0 0;"></div>
<div style="padding:0.8rem 1.2rem;font-family:'DM Sans',sans-serif;
            font-size:0.71rem;color:#B0BEC5;text-align:center;line-height:1.7;">
  © 2026 VrijStaan &nbsp;·&nbsp;
  <span style="color:{BRAND_PRIMARY};font-weight:600;">v3.0</span><br>
  OpenStreetMap + Google Gemini 2.5 Flash
</div>
""", unsafe_allow_html=True)


def price_badge(prijs: str) -> str:
    """HTML prijs-badge. Backward-compatible wrapper."""
    from utils.helpers import price_badge_html
    return price_badge_html(prijs)
