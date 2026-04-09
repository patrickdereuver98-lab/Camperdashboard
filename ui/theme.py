"""
ui/theme.py — VrijStaan Design System v5.2

Wijzigingen t.o.v. v5.1:
  - Sidebar-nachtmerrie opgelost met 4 agressieve CSS-selectors:
      [data-testid="collapsedControl"]   → weg (bron van keyboard_double_arrow_right)
      [data-testid="stSidebarNav"]       → weg (dubbele auto-navigatie)
      header[data-testid="stHeader"]     → weg (native topbar flash)
      [data-testid="stMainMenuButton"]   → weg (hamburger-menu)
  - render_sidebar_header() is nu de ENIGE navigatiebron.
  - Verbeterde donkere-modus-tokens ook voor native Streamlit-widgets.
  - Block-container max-width verhoogd naar 1340px voor ademruimte.
  - Hero-sectie CSS (vs-hero-*) volledig aanwezig voor zoekpagina en main.
"""
from __future__ import annotations
import streamlit as st

# ── DESIGN TOKENS ──────────────────────────────────────────────────────────────
BRAND_PRIMARY = "#006CE4"
BRAND_DARK    = "#003580"
BRAND_ACCENT  = "#FFB700"
BRAND_GREEN   = "#008009"
BRAND_RED     = "#C0392B"
BG_PAGE       = "#F5F7FA"
BG_CARD       = "#FFFFFF"
TEXT_DARK     = "#1A1A2E"
TEXT_MUTED    = "#6B7897"
BORDER        = "#E2E8F0"
SCORE_BG      = "#003580"

_FONTS = (
    "https://fonts.googleapis.com/css2?"
    "family=Inter:wght@300;400;500;600;700"
    "&family=DM+Serif+Display:ital@0;1"
    "&display=swap"
)


def apply_theme() -> None:
    """
    Injecteer het volledige VrijStaan v5.2 design systeem.
    Bevat agressieve sidebar-fixes en dark-mode tokens.
    """
    try:
        from ui.css_fix import inject_global_css
        inject_global_css()
    except ImportError:
        pass

    st.html(f"""
    <style>
    @import url('{_FONTS}');

    /* ══════════════════════════════════════════════════════
       CSS CUSTOM PROPERTIES — licht en donker
    ══════════════════════════════════════════════════════ */
    :root {{
      --vs-primary:   {BRAND_PRIMARY};
      --vs-dark:      {BRAND_DARK};
      --vs-accent:    {BRAND_ACCENT};
      --vs-green:     {BRAND_GREEN};
      --vs-red:       {BRAND_RED};
      --vs-bg:        {BG_PAGE};
      --vs-card:      {BG_CARD};
      --vs-text:      {TEXT_DARK};
      --vs-muted:     {TEXT_MUTED};
      --vs-border:    {BORDER};
      --vs-score-bg:  {SCORE_BG};
      --vs-shadow:    0 2px 12px rgba(0,0,0,0.07);
      --vs-shadow-lg: 0 8px 32px rgba(0,0,0,0.13);
      --vs-input-bg:  #FFFFFF;
      --vs-sidebar:   #FFFFFF;
    }}

    @media (prefers-color-scheme: dark) {{
      :root {{
        --vs-bg:       #0F1117;
        --vs-card:     #1E2130;
        --vs-text:     #E8ECF4;
        --vs-muted:    #8A93AA;
        --vs-border:   #2D3348;
        --vs-input-bg: #262B3D;
        --vs-sidebar:  #161925;
        --vs-shadow:    0 2px 12px rgba(0,0,0,0.45);
        --vs-shadow-lg: 0 8px 32px rgba(0,0,0,0.60);
      }}
    }}
    [data-theme="dark"] {{
      --vs-bg:       #0F1117;
      --vs-card:     #1E2130;
      --vs-text:     #E8ECF4;
      --vs-muted:    #8A93AA;
      --vs-border:   #2D3348;
      --vs-input-bg: #262B3D;
      --vs-sidebar:  #161925;
      --vs-shadow:    0 2px 12px rgba(0,0,0,0.45);
      --vs-shadow-lg: 0 8px 32px rgba(0,0,0,0.60);
    }}

    /* ══════════════════════════════════════════════════════
       SIDEBAR NACHTMERRIE FIX — agressief verbergen
       Oplossing voor keyboard_double_arrow_right, dubbele nav,
       native topbar-flash en hamburger-menu.
    ══════════════════════════════════════════════════════ */

    /* 1. Collapse-pijl (bron van "keyboard_double_arrow_right" tekst) */
    [data-testid="collapsedControl"] {{
        display: none !important;
        visibility: hidden !important;
        width: 0 !important;
        height: 0 !important;
        overflow: hidden !important;
        pointer-events: none !important;
    }}

    /* 2. Auto-gegenereerde Streamlit paginanavigatie in sidebar */
    [data-testid="stSidebarNav"],
    [data-testid="stSidebarNavSeparator"],
    [data-testid="stSidebarNavItems"] {{
        display: none !important;
    }}

    /* 3. Native Streamlit topbar (voorkomt flash bovenaan) */
    header[data-testid="stHeader"],
    [data-testid="stHeader"] {{
        display: none !important;
        height: 0 !important;
        min-height: 0 !important;
        visibility: hidden !important;
    }}

    /* 4. Hamburger-menu knop */
    [data-testid="stMainMenuButton"],
    button[data-testid="stMainMenuButton"] {{
        display: none !important;
    }}

    /* 5. Decoratie-balk bovenaan pagina */
    [data-testid="stDecoration"] {{
        display: none !important;
    }}

    /* 6. Sidebar zelf — schone baseline */
    [data-testid="stSidebar"] {{
        background: var(--vs-sidebar) !important;
        border-right: 1px solid var(--vs-border) !important;
    }}
    [data-testid="stSidebar"] > div:first-child,
    [data-testid="stSidebarContent"] {{
        padding: 0 !important;
        overflow-x: hidden !important;
    }}
    /* Verberg evt. resterende Streamlit expand/collapse knoppen in sidebar */
    [data-testid="stSidebar"] [data-testid="baseButton-headerNoPadding"],
    [data-testid="stSidebar"] .st-emotion-cache-xujc5b {{
        display: none !important;
    }}

    /* ══════════════════════════════════════════════════════
       BASIS & PAGINA
    ══════════════════════════════════════════════════════ */
    html, body,
    [data-testid="stAppViewContainer"],
    [data-testid="stMain"],
    section.main, .main {{
        background-color: var(--vs-bg) !important;
        font-family: 'Inter', system-ui, sans-serif !important;
        color: var(--vs-text) !important;
    }}
    .block-container {{
        padding-top: 0 !important;
        padding-bottom: 3rem !important;
        padding-left: 1.5rem !important;
        padding-right: 1.5rem !important;
        max-width: 1340px !important;
    }}

    /* ══════════════════════════════════════════════════════
       TYPOGRAFIE
    ══════════════════════════════════════════════════════ */
    h1, h2, h3, h4 {{
        font-family: 'DM Serif Display', Georgia, serif !important;
        color: var(--vs-text) !important;
        font-weight: 400 !important;
    }}
    p, span, div, label, li, .stMarkdown p {{
        font-family: 'Inter', system-ui, sans-serif !important;
        color: var(--vs-text) !important;
    }}

    /* ══════════════════════════════════════════════════════
       KNOPPEN
    ══════════════════════════════════════════════════════ */
    .stButton > button {{
        font-family: 'Inter', sans-serif !important;
        font-weight: 600 !important;
        border-radius: 8px !important;
        transition: all 0.15s ease !important;
        font-size: 0.88rem !important;
        letter-spacing: 0.01em !important;
    }}
    .stButton > button[kind="primary"] {{
        background: var(--vs-primary) !important;
        border: none !important;
        color: white !important;
        box-shadow: 0 2px 8px rgba(0,108,228,0.28) !important;
    }}
    .stButton > button[kind="primary"]:hover {{
        background: var(--vs-dark) !important;
        transform: translateY(-1px) !important;
        box-shadow: 0 5px 16px rgba(0,53,128,0.35) !important;
    }}
    .stButton > button[kind="secondary"] {{
        background: var(--vs-card) !important;
        border: 1.5px solid var(--vs-border) !important;
        color: var(--vs-text) !important;
    }}
    .stButton > button[kind="secondary"]:hover {{
        border-color: var(--vs-primary) !important;
        color: var(--vs-primary) !important;
        background: rgba(0,108,228,0.05) !important;
    }}

    /* ══════════════════════════════════════════════════════
       INPUTS & FORMULIEREN
    ══════════════════════════════════════════════════════ */
    .stTextInput > div > div > input,
    .stTextArea textarea {{
        background: var(--vs-input-bg) !important;
        color: var(--vs-text) !important;
        border: 2px solid var(--vs-border) !important;
        border-radius: 8px !important;
        font-family: 'Inter', sans-serif !important;
        font-size: 0.93rem !important;
        transition: border-color 0.2s !important;
        padding: 0.65rem 1rem !important;
    }}
    .stTextInput > div > div > input:focus {{
        border-color: var(--vs-primary) !important;
        box-shadow: 0 0 0 3px rgba(0,108,228,0.12) !important;
        outline: none !important;
    }}
    .stTextInput > div > div > input::placeholder,
    .stTextArea textarea::placeholder {{
        color: var(--vs-muted) !important;
        opacity: 0.85 !important;
    }}
    .stSelectbox > div > div,
    .stMultiSelect > div > div {{
        background: var(--vs-input-bg) !important;
        border: 1.5px solid var(--vs-border) !important;
        border-radius: 8px !important;
        color: var(--vs-text) !important;
    }}
    .stCheckbox label,
    .stRadio label,
    .stSelectbox label,
    .stMultiSelect label,
    .stSlider label,
    [data-testid="stSidebar"] label {{
        font-family: 'Inter', sans-serif !important;
        font-size: 0.85rem !important;
        color: var(--vs-text) !important;
    }}
    [data-testid="stToggle"] label {{
        color: var(--vs-text) !important;
        font-size: 0.85rem !important;
    }}

    /* ══════════════════════════════════════════════════════
       TABS
    ══════════════════════════════════════════════════════ */
    .stTabs [data-baseweb="tab-list"] {{
        gap: 2px !important;
        border-bottom: 2px solid var(--vs-border) !important;
        background: transparent !important;
        padding: 0 !important;
    }}
    .stTabs [data-baseweb="tab"] {{
        font-family: 'Inter', sans-serif !important;
        font-weight: 500 !important;
        font-size: 0.85rem !important;
        color: var(--vs-muted) !important;
        padding: 0.55rem 1rem !important;
        border-radius: 6px 6px 0 0 !important;
        background: transparent !important;
    }}
    .stTabs [aria-selected="true"] {{
        color: var(--vs-primary) !important;
        border-bottom: 3px solid var(--vs-primary) !important;
        font-weight: 700 !important;
    }}
    .stTabs [data-baseweb="tab-panel"] {{
        background: transparent !important;
        padding-top: 1.2rem !important;
    }}

    /* ══════════════════════════════════════════════════════
       METRICS, ALERTS & EXPANDERS
    ══════════════════════════════════════════════════════ */
    [data-testid="stMetric"] {{
        background: var(--vs-card) !important;
        border: 1px solid var(--vs-border) !important;
        border-radius: 12px !important;
        padding: 1rem 1.2rem !important;
        box-shadow: var(--vs-shadow) !important;
    }}
    [data-testid="stMetricValue"] div,
    [data-testid="stMetricLabel"] span {{
        color: var(--vs-text) !important;
        font-family: 'Inter', sans-serif !important;
    }}
    [data-testid="stMetricValue"] div {{ font-weight: 700 !important; }}

    [data-testid="stAlert"] {{
        background: var(--vs-card) !important;
        border-radius: 10px !important;
        border: 1px solid var(--vs-border) !important;
        color: var(--vs-text) !important;
    }}
    [data-testid="stAlert"][kind="info"] {{
        border-left: 4px solid var(--vs-primary) !important;
    }}

    [data-testid="stExpander"] {{
        background: var(--vs-card) !important;
        border: 1px solid var(--vs-border) !important;
        border-radius: 10px !important;
        margin-bottom: 4px !important;
        overflow: hidden !important;
    }}
    [data-testid="stExpander"] summary {{
        font-family: 'Inter', sans-serif !important;
        font-weight: 600 !important;
        font-size: 0.85rem !important;
        color: var(--vs-text) !important;
        background: var(--vs-card) !important;
        padding: 0.6rem 0.9rem !important;
    }}

    /* ══════════════════════════════════════════════════════
       PROGRESS & SPINNER
    ══════════════════════════════════════════════════════ */
    [data-testid="stProgressBar"] > div {{
        background: var(--vs-border) !important;
        border-radius: 4px !important;
    }}
    [data-testid="stProgressBar"] > div > div {{
        background: var(--vs-primary) !important;
        border-radius: 4px !important;
    }}
    [data-testid="stSpinner"] p {{
        color: var(--vs-muted) !important;
        font-family: 'Inter', sans-serif !important;
    }}

    /* ══════════════════════════════════════════════════════
       DATAFRAME
    ══════════════════════════════════════════════════════ */
    [data-testid="stDataFrame"] {{
        border-radius: 10px !important;
        overflow: hidden !important;
        border: 1px solid var(--vs-border) !important;
    }}

    /* ══════════════════════════════════════════════════════
       NAVIGATIE LINKS IN SIDEBAR
    ══════════════════════════════════════════════════════ */
    [data-testid="stSidebar"] [data-testid="stPageLink"],
    [data-testid="stSidebar"] [data-testid="stPageLink"] a {{
        font-family: 'Inter', sans-serif !important;
        font-size: 0.875rem !important;
        font-weight: 500 !important;
        color: var(--vs-text) !important;
        border-radius: 8px !important;
        text-decoration: none !important;
        transition: background 0.15s, color 0.15s !important;
    }}
    [data-testid="stSidebar"] [data-testid="stPageLink"]:hover a {{
        color: var(--vs-primary) !important;
        background: rgba(0,108,228,0.08) !important;
    }}

    /* ══════════════════════════════════════════════════════
       DIVIDER & HR
    ══════════════════════════════════════════════════════ */
    hr, [data-testid="stDivider"] {{
        border: none !important;
        border-top: 1px solid var(--vs-border) !important;
        margin: 1.2rem 0 !important;
    }}

    /* ══════════════════════════════════════════════════════
       SIDEBAR LOGO & FILTER COMPONENTEN
    ══════════════════════════════════════════════════════ */
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
        font-size: 0.67rem;
        color: rgba(255,255,255,0.58);
        font-style: italic;
    }}
    .vs-filter-section {{
        padding: 0.65rem 0.9rem 0.35rem;
    }}
    .vs-filter-title {{
        font-size: 0.72rem;
        font-weight: 700;
        color: var(--vs-text) !important;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        margin-bottom: 0.4rem;
        display: block;
    }}

    /* ══════════════════════════════════════════════════════
       HERO SECTIE (zoekpagina + main)
    ══════════════════════════════════════════════════════ */
    .vs-search-hero {{
        background: linear-gradient(135deg, {BRAND_DARK} 0%, {BRAND_PRIMARY} 65%, #0098F8 100%);
        padding: 2.8rem 2rem 3.2rem;
        text-align: center;
        position: relative;
        overflow: hidden;
        margin: 0 -1.5rem 2rem;
    }}
    .vs-search-hero::before {{
        content: '';
        position: absolute;
        top: -60px; right: -60px;
        width: 280px; height: 280px;
        border-radius: 50%;
        background: rgba(255,183,0,0.09);
        pointer-events: none;
    }}
    .vs-search-hero-title {{
        font-family: 'DM Serif Display', serif !important;
        font-size: 2.4rem;
        color: white !important;
        margin: 0 0 0.45rem;
        line-height: 1.15;
    }}
    .vs-search-hero-sub {{
        color: rgba(255,255,255,0.76);
        font-size: 0.97rem;
        margin: 0 0 1.8rem;
        font-family: 'Inter', sans-serif;
    }}
    /* Pill-badges in hero */
    .vs-hero-pill {{
        display: inline-flex;
        align-items: center;
        gap: 5px;
        background: rgba(255,255,255,0.13);
        border: 1px solid rgba(255,255,255,0.22);
        border-radius: 20px;
        padding: 4px 12px;
        font-size: 0.76rem;
        color: white;
        margin: 3px;
        font-family: 'Inter', sans-serif;
    }}

    /* Landing page hero (main.py) */
    .vs-hero {{
        background: linear-gradient(135deg, {BRAND_DARK} 0%, {BRAND_PRIMARY} 65%, #0098F8 100%);
        border-radius: 0;
        padding: 3.5rem 2rem 4rem;
        position: relative;
        overflow: hidden;
        margin: 0 -1.5rem 2rem;
    }}
    .vs-hero::before {{
        content: '';
        position: absolute; top: -60px; right: -60px;
        width: 280px; height: 280px; border-radius: 50%;
        background: rgba(255,183,0,0.09); pointer-events: none;
    }}
    .vs-hero-eyebrow {{
        font-size: 0.78rem; font-weight: 600;
        letter-spacing: 0.12em; text-transform: uppercase;
        color: rgba(255,255,255,0.62); margin-bottom: 0.5rem;
    }}
    .vs-hero-title {{
        font-family: 'DM Serif Display', serif !important;
        font-size: 2.7rem; color: white !important;
        margin: 0 0 0.5rem; line-height: 1.15;
    }}
    .vs-hero-sub {{
        color: rgba(255,255,255,0.76); font-size: 1rem;
        margin: 0 0 1.8rem;
    }}
    .vs-proof-badge {{
        display: inline-flex; align-items: center; gap: 5px;
        background: rgba(255,255,255,0.12); border: 1px solid rgba(255,255,255,0.22);
        border-radius: 20px; padding: 4px 12px; font-size: 0.76rem;
        color: white; margin: 3px;
    }}

    /* ══════════════════════════════════════════════════════
       STAT CARDS (landing)
    ══════════════════════════════════════════════════════ */
    .vs-stat-card {{
        background: var(--vs-card);
        border-radius: 14px;
        border: 1px solid var(--vs-border);
        padding: 1.3rem 1.1rem;
        text-align: center;
        box-shadow: var(--vs-shadow);
        transition: transform 0.18s, box-shadow 0.18s;
    }}
    .vs-stat-card:hover {{
        transform: translateY(-2px);
        box-shadow: var(--vs-shadow-lg);
    }}
    .vs-stat-num {{
        font-family: 'DM Serif Display', serif;
        font-size: 2rem; color: var(--vs-primary);
        margin-bottom: 4px; line-height: 1;
    }}
    .vs-stat-label {{
        font-size: 0.77rem; color: var(--vs-muted);
        font-weight: 500; letter-spacing: 0.02em;
    }}

    /* ══════════════════════════════════════════════════════
       RESULTAAT CARDS (Booking.com stijl)
    ══════════════════════════════════════════════════════ */
    [data-testid="stVerticalBlock"],
    [data-testid="stHorizontalBlock"],
    [data-testid="stColumn"],
    [data-testid="element-container"],
    [data-testid="stMarkdownContainer"],
    .stMarkdown {{
        background: transparent !important;
    }}

    .vs-result-card {{
        display: flex; flex-direction: row;
        background: var(--vs-card);
        border-radius: 12px;
        border: 1px solid var(--vs-border);
        box-shadow: var(--vs-shadow);
        overflow: hidden;
        margin-bottom: 0.85rem;
        min-height: 200px;
        transition: box-shadow 0.2s ease, border-color 0.2s ease;
    }}
    .vs-result-card:hover {{
        box-shadow: var(--vs-shadow-lg);
        border-color: var(--vs-primary);
    }}
    .vs-card-img-col {{
        width: 240px; min-width: 240px;
        flex-shrink: 0; overflow: hidden;
        background: #D6E4F0;
    }}
    .vs-card-img {{
        width: 100%; height: 100%; min-height: 200px;
        object-fit: cover; display: block;
        transition: transform 0.35s ease;
    }}
    .vs-result-card:hover .vs-card-img {{ transform: scale(1.04); }}

    .vs-card-info-col {{
        flex: 1 1 0%; min-width: 0;
        padding: 1rem 1.2rem;
        display: flex; flex-direction: column;
        justify-content: space-between;
        background: var(--vs-card);
    }}
    .vs-card-name {{
        font-family: 'DM Serif Display', serif;
        font-size: 1.08rem; color: var(--vs-primary) !important;
        margin: 0 0 2px; white-space: nowrap;
        overflow: hidden; text-overflow: ellipsis; cursor: pointer;
    }}
    .vs-card-location {{
        font-size: 0.77rem; color: var(--vs-muted) !important;
        margin: 0 0 5px; white-space: nowrap;
        overflow: hidden; text-overflow: ellipsis;
    }}
    .vs-card-desc {{
        font-size: 0.8rem; color: var(--vs-muted) !important;
        line-height: 1.5; margin: 0 0 7px;
        display: -webkit-box; -webkit-line-clamp: 2;
        -webkit-box-orient: vertical; overflow: hidden;
    }}
    .vs-facilities-row {{
        display: flex; flex-wrap: wrap; gap: 4px; margin-bottom: 4px;
    }}
    .vs-facility-chip {{
        display: inline-flex; align-items: center; gap: 3px;
        font-size: 0.71rem; font-weight: 600;
        padding: 2px 7px; border-radius: 5px;
        background: var(--vs-bg); border: 1px solid var(--vs-border);
        color: var(--vs-text) !important; white-space: nowrap;
    }}
    .vs-facility-chip.highlight {{
        background: rgba(0,128,9,0.09); border-color: #A5D6A7;
        color: #1B5E20 !important;
    }}

    .vs-drukte-pill {{
        display: inline-flex; align-items: center; gap: 4px;
        font-size: 0.70rem; font-weight: 600;
        padding: 2px 8px; border-radius: 12px; white-space: nowrap;
    }}
    .vs-drukte-vol  {{ background:#FFEBEE;color:#C62828;border:1px solid #FFCDD2; }}
    .vs-drukte-druk {{ background:#FFF3E0;color:#E65100;border:1px solid #FFE0B2; }}
    .vs-drukte-plek {{ background:#E8F5E9;color:#2E7D32;border:1px solid #C8E6C9; }}

    /* Prijs-kolom */
    .vs-card-price-col {{
        width: 185px; min-width: 165px; flex-shrink: 0;
        padding: 1rem; display: flex; flex-direction: column;
        justify-content: space-between; align-items: flex-end;
        border-left: 1px solid var(--vs-border);
        background: var(--vs-card);
    }}
    .vs-score-block {{ display:flex;align-items:center;gap:8px;justify-content:flex-end; }}
    .vs-score-label {{ font-size:0.7rem;color:var(--vs-muted)!important;text-align:right;line-height:1.3;max-width:70px; }}
    .vs-score-badge {{
        background: var(--vs-score-bg); color: white;
        border-radius: 8px 8px 8px 0; padding: 6px 10px;
        font-size: 1rem; font-weight: 700; min-width: 42px; text-align: center;
    }}
    .vs-price-block {{ text-align:right;margin-top:auto; }}
    .vs-price-from  {{ font-size:0.68rem;color:var(--vs-muted)!important;margin-bottom:1px; }}
    .vs-price-main  {{ font-family:'Inter',sans-serif;font-size:1.3rem;font-weight:700;color:var(--vs-text)!important;white-space:nowrap; }}
    .vs-price-main.gratis  {{ color:var(--vs-green)!important; }}
    .vs-price-main.onbekend {{ font-size:0.85rem;color:var(--vs-muted)!important;font-weight:400; }}
    .vs-price-sub {{ font-size:0.66rem;color:var(--vs-muted)!important;margin-top:2px; }}

    /* Airbnb prijs-marker op kaart */
    .vs-map-price-marker {{
        background:white;border:2px solid #333;border-radius:20px;
        padding:3px 8px;font-size:0.77rem;font-weight:700;color:#1A1A1A;
        box-shadow:0 2px 6px rgba(0,0,0,0.18);white-space:nowrap;
    }}
    .vs-map-price-marker.gratis {{ background:#E8F5E9;border-color:#2E7D32;color:#1B5E20; }}

    /* ══════════════════════════════════════════════════════
       RESULTATEN HEADER & AI TAGS
    ══════════════════════════════════════════════════════ */
    .vs-results-header {{
        display:flex;align-items:baseline;gap:8px;
        margin-bottom:1rem;padding-bottom:0.6rem;
        border-bottom:1px solid var(--vs-border);
    }}
    .vs-results-count {{
        font-family:'DM Serif Display',serif;
        font-size:1.3rem;color:var(--vs-text)!important;
    }}
    .vs-results-sub {{ font-size:0.78rem;color:var(--vs-muted)!important; }}
    .vs-ai-tag {{
        display:inline-flex;align-items:center;gap:4px;
        background:linear-gradient(90deg,{BRAND_DARK},{BRAND_PRIMARY});
        color:white;border-radius:20px;padding:3px 10px;
        font-size:0.71rem;font-family:'Inter',sans-serif;
        margin:2px 3px 2px 0;white-space:nowrap;
    }}

    /* ══════════════════════════════════════════════════════
       DETAIL PAGINA
    ══════════════════════════════════════════════════════ */
    .vs-detail-hero {{
        background:linear-gradient(135deg,{BRAND_DARK},{BRAND_PRIMARY});
        border-radius:12px;padding:1.3rem 1.5rem;margin-bottom:1rem;
    }}
    .vs-detail-name {{ font-family:'DM Serif Display',serif;font-size:1.6rem;color:white;margin:0 0 4px; }}
    .vs-detail-loc  {{ font-size:0.83rem;color:rgba(255,255,255,0.72); }}
    .vs-facility-grid {{
        display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));
        gap:8px;margin:0.8rem 0;
    }}
    .vs-facility-item {{
        display:flex;align-items:center;gap:8px;padding:8px 12px;
        border-radius:8px;background:var(--vs-bg);border:1px solid var(--vs-border);
        font-size:0.8rem;color:var(--vs-text)!important;
    }}
    .vs-facility-item.ja  {{ background:#E8F5E9;border-color:#C8E6C9;color:#1B5E20!important; }}
    .vs-facility-item.nee {{ background:var(--vs-bg);color:var(--vs-muted)!important;text-decoration:line-through; }}

    /* ══════════════════════════════════════════════════════
       BEHEER DASHBOARD
    ══════════════════════════════════════════════════════ */
    .vs-status-dot {{
        display:inline-block;width:10px;height:10px;
        border-radius:50%;margin-right:6px;flex-shrink:0;
    }}
    .vs-status-dot.green {{ background:#27AE60;box-shadow:0 0 6px rgba(39,174,96,0.5); }}
    .vs-status-dot.red   {{ background:#E74C3C;box-shadow:0 0 6px rgba(231,76,60,0.5); }}
    .vs-status-dot.gray  {{ background:#95A5A6; }}
    .vs-status-row {{
        display:flex;align-items:center;padding:0.6rem 0.9rem;
        border-radius:8px;background:var(--vs-bg);border:1px solid var(--vs-border);
        font-size:0.82rem;margin-bottom:0.45rem;color:var(--vs-text)!important;
    }}
    .vs-kpi-card {{
        background:var(--vs-card);border:1px solid var(--vs-border);
        border-radius:12px;padding:1rem 1.2rem;box-shadow:var(--vs-shadow);
    }}
    .vs-kpi-num  {{ font-family:'DM Serif Display',serif;font-size:1.8rem;color:var(--vs-primary);line-height:1; }}
    .vs-kpi-label {{ font-size:0.74rem;color:var(--vs-muted);margin-top:3px;font-weight:500; }}

    /* ══════════════════════════════════════════════════════
       GPS / REISPLANNER / OVERIGE
    ══════════════════════════════════════════════════════ */
    .vs-gps-hero {{
        background:linear-gradient(135deg,#1B4F72,#2E86C1);
        border-radius:14px;padding:2rem;text-align:center;margin-bottom:1.5rem;
    }}
    .vs-trip-card {{
        background:var(--vs-card);border-radius:12px;
        border:1px solid var(--vs-border);padding:1rem;
        margin-bottom:0.6rem;box-shadow:var(--vs-shadow);
    }}
    .vs-report-box {{
        background:var(--vs-bg);border:1px dashed var(--vs-border);
        border-radius:10px;padding:1rem 1.2rem;margin-top:1rem;
    }}
    .vs-no-results {{
        text-align:center;padding:5rem 2rem;color:var(--vs-muted)!important;
    }}
    .vs-no-results-icon {{ font-size:3.5rem;margin-bottom:1rem; }}

    /* ══════════════════════════════════════════════════════
       RESPONSIEF
    ══════════════════════════════════════════════════════ */
    @media (max-width: 900px) {{
        .vs-card-img-col {{ width:120px;min-width:120px; }}
        .vs-card-price-col {{ width:130px;min-width:115px; }}
        .vs-search-hero-title, .vs-hero-title {{ font-size:1.75rem!important; }}
        .block-container {{ padding-left:0.8rem!important;padding-right:0.8rem!important; }}
    }}
    @media (max-width: 600px) {{
        .vs-result-card {{ flex-direction:column; }}
        .vs-card-img-col {{ width:100%;min-width:100%;height:165px; }}
        .vs-card-price-col {{
            width:100%;min-width:100%;
            border-left:none;border-top:1px solid var(--vs-border);
        }}
        .vs-search-hero, .vs-hero {{ padding:2rem 1rem 2.5rem;margin:0 -0.8rem 1.5rem; }}
    }}
    </style>
    """)


def render_sidebar_header() -> None:
    """
    Rendert de volledige custom sidebar: logo + navigatielinks.
    Dit is de ENIGE navigatiebron — native Streamlit-nav is volledig verborgen.
    """
    with st.sidebar:
        st.markdown(f"""
<div class="vs-sidebar-logo">
  <svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="white"
       stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
    <path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10
             s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9
             A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/>
    <circle cx="7" cy="17" r="2"/>
    <path d="M9 17h6"/>
    <circle cx="17" cy="17" r="2"/>
  </svg>
  <div class="vs-sidebar-logo-title">VrijStaan</div>
  <div class="vs-sidebar-logo-sub">Camperplaatsen · Nederland</div>
</div>
""", unsafe_allow_html=True)

        st.markdown(
            """<div style="padding:0.9rem 0.9rem 0.25rem;font-size:0.65rem;
font-weight:700;color:#8A9DB5;text-transform:uppercase;letter-spacing:0.1em;">
Navigatie</div>""",
            unsafe_allow_html=True,
        )

        st.page_link("main.py",                       label="Home",           icon="🏠")
        st.page_link("pages/1_🔍_Zoeken.py",          label="Zoeken",         icon="🔍")
        st.page_link("pages/2_📍_Dichtbij.py",        label="Dichtbij mij",   icon="📍")
        st.page_link("pages/3_🗺️_Reisplanner.py",     label="Reisplanner",    icon="🗺️")
        st.page_link("pages/4_⚙️_Beheer.py",          label="Beheer (Admin)", icon="⚙️")

        st.markdown(
            f"""<div style="margin:0 0.8rem;">
<hr style="border-color:{BORDER};margin:0.5rem 0 0;">
</div>
<div style="padding:0.5rem 0.9rem 0.9rem;font-size:0.67rem;
color:#B0BEC5;text-align:center;">
  © 2026 VrijStaan &nbsp;·&nbsp;
  <span style="color:{BRAND_PRIMARY};font-weight:600;">v5.2</span>
</div>""",
            unsafe_allow_html=True,
        )
