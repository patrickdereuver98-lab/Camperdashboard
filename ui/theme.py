"""
ui/theme.py — VrijStaan Design System v4 (Booking.com Edition).
Volledig herschreven CSS-systeem dat de Booking.com card-layout nabootst.
Fonts: DM Serif Display + DM Sans. Kleurpalet: oceaanblauw + wit + accent-geel.
"""
import streamlit as st

# ── DESIGN TOKENS ─────────────────────────────────────────────────────────────
BRAND_PRIMARY = "#006CE4"     # Booking.com blauw
BRAND_DARK    = "#003580"     # Donker blauw
BRAND_ACCENT  = "#FFB700"     # Geel accent
BRAND_GREEN   = "#008009"     # Groene prijs
BRAND_LIGHT   = "#EBF3FF"    # Lichtblauw achtergrond badge
BG_PAGE       = "#F2F6FE"    # Licht grijs-blauw pagina
BG_CARD       = "#FFFFFF"
TEXT_DARK     = "#1A1A2E"
TEXT_MUTED    = "#6B7897"
BORDER        = "#DADFEA"
SCORE_BG      = "#003580"     # Donkerblauw score badge

_FONTS = (
    "https://fonts.googleapis.com/css2?"
    "family=DM+Serif+Display:ital@0;1"
    "&family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,600;9..40,700"
    "&display=swap"
)


def apply_theme() -> None:
    """Injecteer het volledige VrijStaan/Booking.com design systeem."""
    st.html(f"""
    <style>
    @import url('{_FONTS}');

    /* ── RESET & BASIS ─────────────────────────────────────────────────── */
    html, body,
    [data-testid="stAppViewContainer"],
    [data-testid="stMain"],
    section.main, .main {{
        background-color: {BG_PAGE} !important;
        font-family: 'DM Sans', system-ui, sans-serif !important;
    }}
    [data-testid="stSidebarNav"] {{ display: none !important; }}
    [data-testid="stDecoration"]  {{ display: none !important; }}

    .block-container {{
        padding-top: 1rem !important;
        padding-bottom: 2rem !important;
        max-width: 1280px !important;
    }}

    /* ── TYPOGRAFIE ────────────────────────────────────────────────────── */
    h1, h2, h3, h4 {{
        font-family: 'DM Serif Display', Georgia, serif !important;
        color: {TEXT_DARK} !important;
    }}
    p, span, div, label, li {{
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
    [data-testid="stSidebar"] a,
    [data-testid="stSidebar"] [data-testid="stPageLink"] a {{
        font-family: 'DM Sans', sans-serif !important;
        font-size: 0.88rem !important;
        font-weight: 500 !important;
        color: {TEXT_DARK} !important;
    }}

    /* ── KNOPPEN ───────────────────────────────────────────────────────── */
    .stButton > button {{
        font-family: 'DM Sans', sans-serif !important;
        font-weight: 600 !important;
        border-radius: 8px !important;
        transition: all 0.15s ease !important;
        letter-spacing: 0.01em !important;
    }}
    .stButton > button[kind="primary"] {{
        background: {BRAND_PRIMARY} !important;
        border: none !important;
        color: white !important;
        box-shadow: 0 2px 6px rgba(0,108,228,0.30) !important;
    }}
    .stButton > button[kind="primary"]:hover {{
        background: {BRAND_DARK} !important;
        transform: translateY(-1px) !important;
        box-shadow: 0 4px 14px rgba(0,53,128,0.35) !important;
    }}
    .stButton > button[kind="secondary"] {{
        background: {BG_CARD} !important;
        border: 1.5px solid {BORDER} !important;
        color: {TEXT_DARK} !important;
    }}
    .stButton > button[kind="secondary"]:hover {{
        border-color: {BRAND_PRIMARY} !important;
        color: {BRAND_PRIMARY} !important;
        background: {BRAND_LIGHT} !important;
    }}

    /* ── INPUTS ────────────────────────────────────────────────────────── */
    .stTextInput > div > div > input {{
        font-family: 'DM Sans', sans-serif !important;
        border-radius: 8px !important;
        border: 2px solid {BORDER} !important;
        padding: 0.75rem 1rem !important;
        font-size: 1rem !important;
        background: {BG_CARD} !important;
        color: {TEXT_DARK} !important;
        transition: border-color 0.2s !important;
    }}
    .stTextInput > div > div > input:focus {{
        border-color: {BRAND_PRIMARY} !important;
        box-shadow: 0 0 0 3px rgba(0,108,228,0.12) !important;
        outline: none !important;
    }}
    .stTextInput > div > div > input::placeholder {{
        color: {TEXT_MUTED} !important;
    }}
    .stSelectbox > div > div,
    .stMultiSelect > div > div {{
        border-radius: 8px !important;
        border: 1.5px solid {BORDER} !important;
    }}
    .stCheckbox label {{
        font-family: 'DM Sans', sans-serif !important;
        font-size: 0.875rem !important;
        color: {TEXT_DARK} !important;
    }}
    .stCheckbox label:hover {{ color: {BRAND_PRIMARY} !important; }}

    /* ── TABS ──────────────────────────────────────────────────────────── */
    .stTabs [data-baseweb="tab-list"] {{
        gap: 2px !important;
        border-bottom: 2px solid {BORDER} !important;
        background: transparent !important;
    }}
    .stTabs [data-baseweb="tab"] {{
        font-family: 'DM Sans', sans-serif !important;
        font-weight: 500 !important;
        font-size: 0.9rem !important;
        color: {TEXT_MUTED} !important;
        padding: 0.6rem 1.2rem !important;
        border-radius: 6px 6px 0 0 !important;
    }}
    .stTabs [aria-selected="true"] {{
        color: {BRAND_PRIMARY} !important;
        border-bottom: 3px solid {BRAND_PRIMARY} !important;
        font-weight: 700 !important;
    }}

    /* ── ALERTS / INFO ─────────────────────────────────────────────────── */
    [data-testid="stAlert"] {{
        border-radius: 10px !important;
        font-family: 'DM Sans', sans-serif !important;
    }}

    /* ── EXPANDER ──────────────────────────────────────────────────────── */
    [data-testid="stExpander"] {{
        border: 1px solid {BORDER} !important;
        border-radius: 10px !important;
        background: {BG_CARD} !important;
    }}
    [data-testid="stExpander"] summary {{
        font-family: 'DM Sans', sans-serif !important;
        font-weight: 600 !important;
        color: {TEXT_DARK} !important;
    }}

    /* ── SPINNER ───────────────────────────────────────────────────────── */
    [data-testid="stSpinner"] p {{
        font-family: 'DM Sans', sans-serif !important;
        color: {TEXT_MUTED} !important;
    }}

    /* ── METRICS ───────────────────────────────────────────────────────── */
    [data-testid="stMetric"] {{
        background: {BG_CARD} !important;
        border: 1px solid {BORDER} !important;
        border-radius: 12px !important;
        padding: 1rem !important;
    }}

    /* ══════════════════════════════════════════════════════════════════ */
    /*  BOOKING.COM SEARCH BAR                                          */
    /* ══════════════════════════════════════════════════════════════════ */
    .vs-searchbar-wrap {{
        background: {BRAND_DARK};
        padding: 1.6rem 2rem 2rem;
        border-radius: 0 0 16px 16px;
        margin-bottom: 1.4rem;
    }}
    .vs-searchbar-title {{
        font-family: 'DM Serif Display', serif;
        font-size: 1.85rem;
        color: white;
        margin: 0 0 0.2rem;
        line-height: 1.2;
    }}
    .vs-searchbar-sub {{
        font-family: 'DM Sans', sans-serif;
        color: rgba(255,255,255,0.75);
        font-size: 0.92rem;
        margin: 0 0 1.2rem;
    }}

    /* ══════════════════════════════════════════════════════════════════ */
    /*  BOOKING.COM RESULTAAT-KAART                                     */
    /* ══════════════════════════════════════════════════════════════════ */
    .vs-result-card {{
        display: flex;
        flex-direction: row;
        background: {BG_CARD};
        border-radius: 12px;
        border: 1px solid {BORDER};
        box-shadow: 0 2px 8px rgba(0,0,0,0.06);
        overflow: hidden;
        margin-bottom: 1rem;
        min-height: 200px;
        transition: box-shadow 0.2s ease, border-color 0.2s ease;
        position: relative;
    }}
    .vs-result-card:hover {{
        box-shadow: 0 6px 22px rgba(0,0,0,0.12);
        border-color: {BRAND_PRIMARY};
    }}

    /* Foto kolom */
    .vs-card-img-col {{
        width: 260px;
        min-width: 260px;
        flex-shrink: 0;
        position: relative;
        overflow: hidden;
        background: #D6E4F0;
    }}
    .vs-card-img {{
        width: 100%;
        height: 100%;
        min-height: 200px;
        object-fit: cover;
        display: block;
        transition: transform 0.3s ease;
    }}
    .vs-result-card:hover .vs-card-img {{ transform: scale(1.03); }}

    /* Favoriet badge op foto */
    .vs-fav-overlay {{
        position: absolute;
        top: 10px;
        right: 10px;
        background: rgba(255,255,255,0.9);
        border-radius: 50%;
        width: 32px;
        height: 32px;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        backdrop-filter: blur(4px);
        font-size: 1rem;
        z-index: 2;
    }}

    /* Midden info kolom */
    .vs-card-info-col {{
        flex: 1 1 0%;
        min-width: 0;
        padding: 1rem 1.2rem;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
    }}
    .vs-card-name {{
        font-family: 'DM Serif Display', serif;
        font-size: 1.15rem;
        color: {BRAND_PRIMARY};
        margin: 0 0 3px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        cursor: pointer;
        text-decoration: underline;
        text-decoration-color: transparent;
        transition: text-decoration-color 0.15s;
    }}
    .vs-card-name:hover {{ text-decoration-color: {BRAND_PRIMARY}; }}
    .vs-card-location {{
        font-size: 0.8rem;
        color: {TEXT_MUTED};
        margin: 0 0 8px;
        display: flex;
        align-items: center;
        gap: 4px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }}
    .vs-card-type-badge {{
        display: inline-flex;
        align-items: center;
        background: {BRAND_LIGHT};
        color: {BRAND_PRIMARY};
        border-radius: 4px;
        padding: 2px 8px;
        font-size: 0.72rem;
        font-weight: 600;
        margin-bottom: 8px;
        white-space: nowrap;
    }}
    .vs-card-desc {{
        font-size: 0.82rem;
        color: {TEXT_MUTED};
        line-height: 1.5;
        margin: 0 0 10px;
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
    }}

    /* Faciliteiten icoon-rij */
    .vs-facilities-row {{
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        margin-bottom: 6px;
    }}
    .vs-facility-chip {{
        display: inline-flex;
        align-items: center;
        gap: 4px;
        font-size: 0.75rem;
        color: #2D3748;
        padding: 3px 8px;
        border-radius: 4px;
        background: #F7F9FC;
        border: 1px solid {BORDER};
        white-space: nowrap;
    }}
    .vs-facility-chip.highlight {{
        background: #E8F5E9;
        border-color: #A5D6A7;
        color: #1B5E20;
    }}

    /* Rechter prijs kolom */
    .vs-card-price-col {{
        width: 200px;
        min-width: 180px;
        flex-shrink: 0;
        padding: 1rem;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        align-items: flex-end;
        border-left: 1px solid {BORDER};
    }}

    /* Score badge — Booking.com blauw blokje */
    .vs-score-block {{
        display: flex;
        align-items: center;
        gap: 8px;
        justify-content: flex-end;
        margin-bottom: auto;
    }}
    .vs-score-label {{
        font-size: 0.75rem;
        color: {TEXT_MUTED};
        text-align: right;
        line-height: 1.3;
        max-width: 80px;
    }}
    .vs-score-badge {{
        background: {SCORE_BG};
        color: white;
        border-radius: 8px 8px 8px 0;
        padding: 6px 10px;
        font-family: 'DM Sans', sans-serif;
        font-size: 1.1rem;
        font-weight: 700;
        white-space: nowrap;
        min-width: 44px;
        text-align: center;
    }}
    .vs-score-badge.good {{ background: #006CE4; }}
    .vs-score-badge.great {{ background: #003B95; }}

    /* Prijs blok */
    .vs-price-block {{
        text-align: right;
        margin-top: auto;
    }}
    .vs-price-from {{
        font-size: 0.72rem;
        color: {TEXT_MUTED};
        margin-bottom: 2px;
    }}
    .vs-price-main {{
        font-family: 'DM Sans', sans-serif;
        font-size: 1.4rem;
        font-weight: 700;
        color: {TEXT_DARK};
        line-height: 1.1;
        white-space: nowrap;
    }}
    .vs-price-main.gratis {{
        color: {BRAND_GREEN};
    }}
    .vs-price-sub {{
        font-size: 0.72rem;
        color: {TEXT_MUTED};
        margin-top: 2px;
    }}

    /* ══════════════════════════════════════════════════════════════════ */
    /*  SIDEBAR FILTER COMPONENTEN                                      */
    /* ══════════════════════════════════════════════════════════════════ */
    .vs-sidebar-logo {{
        background: linear-gradient(150deg, {BRAND_DARK} 0%, {BRAND_PRIMARY} 100%);
        padding: 1.4rem 1rem 1.2rem;
        text-align: center;
    }}
    .vs-sidebar-logo-title {{
        font-family: 'DM Serif Display', serif;
        font-size: 1.5rem;
        color: white;
        margin: 6px 0 2px;
    }}
    .vs-sidebar-logo-sub {{
        font-size: 0.68rem;
        color: rgba(255,255,255,0.6);
        font-style: italic;
    }}
    .vs-filter-section-title {{
        font-family: 'DM Sans', sans-serif;
        font-size: 0.78rem;
        font-weight: 700;
        color: {TEXT_DARK};
        text-transform: uppercase;
        letter-spacing: 0.08em;
        padding: 0.8rem 0 0.4rem;
        border-bottom: 2px solid {BRAND_ACCENT};
        margin-bottom: 0.5rem;
        display: block;
    }}
    .vs-map-button {{
        display: flex;
        align-items: center;
        gap: 10px;
        background: {BRAND_LIGHT};
        border: 1.5px solid {BRAND_PRIMARY};
        border-radius: 10px;
        padding: 0.7rem 1rem;
        cursor: pointer;
        margin-bottom: 0.8rem;
        transition: background 0.15s;
    }}
    .vs-map-button:hover {{ background: #d0e4ff; }}
    .vs-map-button-text {{
        font-family: 'DM Sans', sans-serif;
        font-size: 0.85rem;
        font-weight: 600;
        color: {BRAND_PRIMARY};
    }}

    /* ══════════════════════════════════════════════════════════════════ */
    /*  DETAIL MODAL / DIALOG                                           */
    /* ══════════════════════════════════════════════════════════════════ */
    .vs-detail-header {{
        background: linear-gradient(135deg, {BRAND_DARK}, {BRAND_PRIMARY});
        border-radius: 12px;
        padding: 1.4rem 1.6rem;
        margin-bottom: 1.2rem;
    }}
    .vs-detail-name {{
        font-family: 'DM Serif Display', serif;
        font-size: 1.6rem;
        color: white;
        margin: 0 0 4px;
    }}
    .vs-detail-location {{
        font-size: 0.85rem;
        color: rgba(255,255,255,0.75);
    }}

    /* Faciliteiten grid in detail view */
    .vs-facility-grid {{
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
        gap: 8px;
        margin: 0.8rem 0;
    }}
    .vs-facility-item {{
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 8px 12px;
        border-radius: 8px;
        background: #F7F9FC;
        border: 1px solid {BORDER};
        font-size: 0.82rem;
        color: {TEXT_DARK};
    }}
    .vs-facility-item.ja {{
        background: #E8F5E9;
        border-color: #C8E6C9;
        color: #1B5E20;
    }}
    .vs-facility-item.nee {{
        background: #FAFAFA;
        border-color: #E0E0E0;
        color: #9E9E9E;
        text-decoration: line-through;
    }}

    /* ══════════════════════════════════════════════════════════════════ */
    /*  RESULTATEN HEADER                                               */
    /* ══════════════════════════════════════════════════════════════════ */
    .vs-results-header {{
        display: flex;
        align-items: baseline;
        gap: 8px;
        margin-bottom: 0.8rem;
    }}
    .vs-results-count {{
        font-family: 'DM Serif Display', serif;
        font-size: 1.4rem;
        color: {TEXT_DARK};
    }}
    .vs-results-sub {{
        font-size: 0.82rem;
        color: {TEXT_MUTED};
    }}

    /* AI filter tags */
    .vs-ai-tag {{
        display: inline-flex;
        align-items: center;
        gap: 4px;
        background: linear-gradient(90deg, {BRAND_DARK}, {BRAND_PRIMARY});
        color: white;
        border-radius: 20px;
        padding: 3px 10px;
        font-size: 0.74rem;
        font-family: 'DM Sans', sans-serif;
        margin: 2px 3px 2px 0;
        white-space: nowrap;
    }}

    /* ── GEEN RESULTATEN ───────────────────────────────────────────────── */
    .vs-no-results {{
        text-align: center;
        padding: 4rem 2rem;
        color: {TEXT_MUTED};
    }}
    .vs-no-results-icon {{
        font-size: 3rem;
        margin-bottom: 1rem;
    }}

    /* ── LANDING PAGE HERO ─────────────────────────────────────────────── */
    .vs-hero {{
        background: linear-gradient(135deg, {BRAND_DARK} 0%, {BRAND_PRIMARY} 65%, #0099FF 100%);
        border-radius: 0 0 20px 20px;
        padding: 2.5rem 2rem 3rem;
        position: relative;
        overflow: hidden;
        margin-bottom: 1.5rem;
    }}
    .vs-hero::before {{
        content: '';
        position: absolute;
        top: -50px; right: -50px;
        width: 250px; height: 250px;
        border-radius: 50%;
        background: rgba(255,183,0,0.10);
        pointer-events: none;
    }}
    .vs-hero-title {{
        font-family: 'DM Serif Display', serif !important;
        font-size: 2.2rem;
        color: white !important;
        margin: 0 0 0.5rem;
        position: relative; z-index: 1;
        line-height: 1.2;
    }}
    .vs-hero-sub {{
        color: rgba(255,255,255,0.8);
        font-size: 1rem;
        margin: 0;
        position: relative; z-index: 1;
    }}

    /* ── STAT CARDS ────────────────────────────────────────────────────── */
    .vs-stat-card {{
        background: {BG_CARD};
        border-radius: 12px;
        border: 1px solid {BORDER};
        padding: 1.2rem;
        text-align: center;
        box-shadow: 0 2px 8px rgba(0,0,0,0.04);
    }}
    .vs-stat-num {{
        font-family: 'DM Serif Display', serif;
        font-size: 2rem;
        color: {BRAND_PRIMARY};
        margin-bottom: 4px;
    }}
    .vs-stat-label {{
        font-size: 0.8rem;
        color: {TEXT_MUTED};
        font-weight: 500;
    }}

    /* ── MOBIEL ────────────────────────────────────────────────────────── */
    @media (max-width: 900px) {{
        .vs-card-img-col {{
            width: 140px;
            min-width: 140px;
        }}
        .vs-card-price-col {{
            width: 130px;
            min-width: 130px;
        }}
        .vs-card-name {{ font-size: 0.95rem; }}
        .vs-price-main {{ font-size: 1.1rem; }}
    }}
    @media (max-width: 600px) {{
        .vs-result-card {{ flex-direction: column; min-height: auto; }}
        .vs-card-img-col {{ width: 100%; min-width: 100%; height: 180px; }}
        .vs-card-price-col {{ width: 100%; min-width: 100%; border-left: none; border-top: 1px solid {BORDER}; }}
    }}
    </style>
    """)


def render_sidebar_header() -> None:
    """Rendert het logo + navigatie in de sidebar."""
    with st.sidebar:
        st.markdown(f"""
<div class="vs-sidebar-logo">
  <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="white"
       stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
    <path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10
             s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9
             A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/>
    <circle cx="7" cy="17" r="2"/>
    <path d="M9 17h6"/>
    <circle cx="17" cy="17" r="2"/>
  </svg>
  <div class="vs-sidebar-logo-title">VrijStaan</div>
  <div class="vs-sidebar-logo-sub">Camperplaatsen zonder vertrektijden</div>
</div>
""", unsafe_allow_html=True)

        st.markdown("""<div style="padding:0.8rem 0.8rem 0.2rem;font-size:0.68rem;
font-weight:700;color:#8A9DB5;text-transform:uppercase;letter-spacing:0.1em;">
Menu</div>""", unsafe_allow_html=True)

        st.page_link("main.py",                          label="Startpagina",           icon="🏠")
        st.page_link("pages/3_🚐_Camperplaatsen.py",     label="Camperplaatsen zoeken", icon="🔍")
        st.page_link("pages/2_⚙️_Beheer.py",             label="Beheer (Admin)",        icon="⚙️")

        st.markdown(f"""
<div style="margin:0.5rem 0.8rem;">
  <hr style="border-color:{BORDER};margin:0.4rem 0;">
</div>
<div style="padding:0.4rem 1rem 0.8rem;font-size:0.68rem;color:#B0BEC5;text-align:center;">
  © 2026 VrijStaan &nbsp;·&nbsp;
  <span style="color:{BRAND_PRIMARY};font-weight:600;">v4.0</span>
</div>""", unsafe_allow_html=True)


# Backward-compatible export
BRAND_PRIMARY = BRAND_PRIMARY
BRAND_DARK    = BRAND_DARK
BRAND_ACCENT  = BRAND_ACCENT
TEXT_MUTED    = TEXT_MUTED
BORDER        = BORDER
BG_CARD       = BG_CARD
BG_PAGE       = BG_PAGE
