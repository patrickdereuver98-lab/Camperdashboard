"""
ui/theme.py — VrijStaan Design System v5 (SaaS Premium Edition).
Dark-mode aware · Anti-clutter · Booking.com/Airbnb fusion.
Pijler 0: Extreme whitespace. Pijler 7: Dark mode reageert op Streamlit native.
"""
from __future__ import annotations
import streamlit as st

# ── DESIGN TOKENS ─────────────────────────────────────────────────────────────
BRAND_PRIMARY  = "#006CE4"
BRAND_DARK     = "#003580"
BRAND_ACCENT   = "#FFB700"
BRAND_GREEN    = "#008009"
BRAND_RED      = "#C0392B"
BG_PAGE        = "#F5F7FA"
BG_CARD        = "#FFFFFF"
TEXT_DARK      = "#1A1A2E"
TEXT_MUTED     = "#6B7897"
BORDER         = "#E2E8F0"
SCORE_BG       = "#003580"

_FONTS = (
    "https://fonts.googleapis.com/css2?"
    "family=Inter:wght@300;400;500;600;700"
    "&family=DM+Serif+Display:ital@0;1"
    "&display=swap"
)


def apply_theme() -> None:
    """
    Injecteer het volledige VrijStaan v5 design systeem. Dark-mode aware.
    Roept ook inject_global_css() aan voor de volledige CSS-overhaul (bug-fixes).
    """
    # Importeer en injecteer de globale CSS fix (repareert dark-mode, card-bloat, etc.)
    try:
        from ui.css_fix import inject_global_css
        inject_global_css()
    except ImportError:
        pass  # Graceful fallback als css_fix.py ontbreekt

    st.html(f"""
    <style>
    @import url('{_FONTS}');

    /* ── ROOT VARS (light) ─────────────────────────────────────────────── */
    :root {{
      --vs-primary:   {BRAND_PRIMARY};
      --vs-dark:      {BRAND_DARK};
      --vs-accent:    {BRAND_ACCENT};
      --vs-green:     {BRAND_GREEN};
      --vs-bg:        {BG_PAGE};
      --vs-card:      {BG_CARD};
      --vs-text:      {TEXT_DARK};
      --vs-muted:     {TEXT_MUTED};
      --vs-border:    {BORDER};
      --vs-score-bg:  {SCORE_BG};
      --vs-shadow:    0 2px 12px rgba(0,0,0,0.07);
      --vs-shadow-lg: 0 8px 32px rgba(0,0,0,0.13);
    }}

    /* ── DARK MODE VARS ────────────────────────────────────────────────── */
    @media (prefers-color-scheme: dark) {{
      :root {{
        --vs-bg:     #0F1117;
        --vs-card:   #1A1D27;
        --vs-text:   #E8ECF4;
        --vs-muted:  #8A93AA;
        --vs-border: #2D3348;
        --vs-shadow: 0 2px 12px rgba(0,0,0,0.4);
        --vs-shadow-lg: 0 8px 32px rgba(0,0,0,0.5);
      }}
    }}
    [data-theme="dark"] {{
      --vs-bg:     #0F1117;
      --vs-card:   #1A1D27;
      --vs-text:   #E8ECF4;
      --vs-muted:  #8A93AA;
      --vs-border: #2D3348;
      --vs-shadow: 0 2px 12px rgba(0,0,0,0.4);
      --vs-shadow-lg: 0 8px 32px rgba(0,0,0,0.5);
    }}

    /* ── RESET & BASIS ─────────────────────────────────────────────────── */
    html, body,
    [data-testid="stAppViewContainer"],
    [data-testid="stMain"],
    section.main, .main {{
        background-color: var(--vs-bg) !important;
        font-family: 'Inter', system-ui, sans-serif !important;
        color: var(--vs-text) !important;
    }}
    [data-testid="stSidebarNav"] {{ display: none !important; }}
    [data-testid="stDecoration"]  {{ display: none !important; }}
    .block-container {{
        padding-top: 1rem !important;
        padding-bottom: 3rem !important;
        max-width: 1300px !important;
    }}

    /* ── TYPOGRAFIE ────────────────────────────────────────────────────── */
    h1, h2, h3, h4 {{
        font-family: 'DM Serif Display', Georgia, serif !important;
        color: var(--vs-text) !important;
        font-weight: 400 !important;
    }}
    p, span, div, label, li, .stMarkdown p {{
        font-family: 'Inter', system-ui, sans-serif !important;
        color: var(--vs-text) !important;
    }}

    /* ── SIDEBAR ───────────────────────────────────────────────────────── */
    [data-testid="stSidebar"] {{
        background: var(--vs-card) !important;
        border-right: 1px solid var(--vs-border) !important;
    }}
    [data-testid="stSidebar"] > div:first-child,
    [data-testid="stSidebarContent"] {{ padding: 0 !important; }}

    /* ── KNOPPEN ───────────────────────────────────────────────────────── */
    .stButton > button {{
        font-family: 'Inter', sans-serif !important;
        font-weight: 600 !important;
        border-radius: 8px !important;
        transition: all 0.15s ease !important;
        font-size: 0.9rem !important;
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
    }}

    /* ── INPUTS ────────────────────────────────────────────────────────── */
    .stTextInput > div > div > input,
    .stTextArea textarea {{
        font-family: 'Inter', sans-serif !important;
        border-radius: 8px !important;
        border: 2px solid var(--vs-border) !important;
        background: var(--vs-card) !important;
        color: var(--vs-text) !important;
        transition: border-color 0.2s !important;
    }}
    .stTextInput > div > div > input:focus {{
        border-color: var(--vs-primary) !important;
        box-shadow: 0 0 0 3px rgba(0,108,228,0.12) !important;
    }}
    .stTextInput > div > div > input::placeholder,
    .stTextArea textarea::placeholder {{
        color: var(--vs-muted) !important;
    }}
    .stSelectbox > div > div,
    .stMultiSelect > div > div {{
        border-radius: 8px !important;
        border: 1.5px solid var(--vs-border) !important;
        background: var(--vs-card) !important;
    }}
    .stCheckbox label, .stSelectbox label,
    .stMultiSelect label, .stSlider label {{
        font-family: 'Inter', sans-serif !important;
        font-size: 0.85rem !important;
        color: var(--vs-text) !important;
    }}

    /* ── TABS ──────────────────────────────────────────────────────────── */
    .stTabs [data-baseweb="tab-list"] {{
        gap: 2px !important;
        border-bottom: 2px solid var(--vs-border) !important;
        background: transparent !important;
    }}
    .stTabs [data-baseweb="tab"] {{
        font-family: 'Inter', sans-serif !important;
        font-weight: 500 !important;
        font-size: 0.88rem !important;
        color: var(--vs-muted) !important;
        padding: 0.6rem 1.2rem !important;
        border-radius: 6px 6px 0 0 !important;
    }}
    .stTabs [aria-selected="true"] {{
        color: var(--vs-primary) !important;
        border-bottom: 3px solid var(--vs-primary) !important;
        font-weight: 700 !important;
    }}

    /* ── ALERTS ────────────────────────────────────────────────────────── */
    [data-testid="stAlert"] {{
        border-radius: 10px !important;
        font-family: 'Inter', sans-serif !important;
    }}

    /* ── EXPANDER ──────────────────────────────────────────────────────── */
    [data-testid="stExpander"] {{
        border: 1px solid var(--vs-border) !important;
        border-radius: 10px !important;
        background: var(--vs-card) !important;
    }}
    [data-testid="stExpander"] summary {{
        font-family: 'Inter', sans-serif !important;
        font-weight: 600 !important;
        color: var(--vs-text) !important;
    }}

    /* ── METRICS ───────────────────────────────────────────────────────── */
    [data-testid="stMetric"] {{
        background: var(--vs-card) !important;
        border: 1px solid var(--vs-border) !important;
        border-radius: 12px !important;
        padding: 1rem !important;
    }}
    [data-testid="stMetricValue"] div,
    [data-testid="stMetricLabel"] span {{
        font-family: 'Inter', sans-serif !important;
        color: var(--vs-text) !important;
    }}

    /* ══════════════════════════════════════════════════════════════════ */
    /*  LANDING PAGE HERO                                               */
    /* ══════════════════════════════════════════════════════════════════ */
    .vs-hero {{
        background: linear-gradient(135deg, {BRAND_DARK} 0%, {BRAND_PRIMARY} 70%, #0099EE 100%);
        border-radius: 0;
        padding: 3.5rem 2.5rem 4rem;
        position: relative;
        overflow: hidden;
        margin: -1rem -1rem 2rem;
    }}
    .vs-hero::before {{
        content: '';
        position: absolute; top: -80px; right: -80px;
        width: 350px; height: 350px; border-radius: 50%;
        background: rgba(255,183,0,0.08);
        pointer-events: none;
    }}
    .vs-hero::after {{
        content: '';
        position: absolute; bottom: -100px; left: -40px;
        width: 300px; height: 300px; border-radius: 50%;
        background: rgba(255,255,255,0.05);
        pointer-events: none;
    }}
    .vs-hero-eyebrow {{
        font-size: 0.8rem;
        font-weight: 600;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        color: rgba(255,255,255,0.65);
        margin-bottom: 0.6rem;
        position: relative; z-index: 1;
    }}
    .vs-hero-title {{
        font-family: 'DM Serif Display', serif !important;
        font-size: 2.8rem;
        color: white !important;
        margin: 0 0 0.6rem;
        position: relative; z-index: 1;
        line-height: 1.15;
    }}
    .vs-hero-sub {{
        color: rgba(255,255,255,0.78);
        font-size: 1.05rem;
        margin: 0 0 2rem;
        position: relative; z-index: 1;
        max-width: 520px;
    }}

    /* ── BOOKING.COM ZOEKBALK ──────────────────────────────────────────── */
    .vs-search-container {{
        background: white;
        border-radius: 12px;
        border: 3px solid var(--vs-accent);
        box-shadow: 0 4px 24px rgba(0,0,0,0.18);
        overflow: visible;
        position: relative;
        z-index: 10;
        max-width: 740px;
    }}

    /* ── STAT CARD ─────────────────────────────────────────────────────── */
    .vs-stat-card {{
        background: var(--vs-card);
        border-radius: 14px;
        border: 1px solid var(--vs-border);
        padding: 1.4rem 1.2rem;
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
        font-size: 2.1rem;
        color: var(--vs-primary);
        margin-bottom: 4px;
        line-height: 1;
    }}
    .vs-stat-label {{
        font-size: 0.78rem;
        color: var(--vs-muted);
        font-weight: 500;
        letter-spacing: 0.02em;
    }}

    /* ── SOCIAL PROOF BADGE ────────────────────────────────────────────── */
    .vs-proof-badge {{
        display: inline-flex;
        align-items: center;
        gap: 6px;
        background: rgba(255,255,255,0.12);
        border: 1px solid rgba(255,255,255,0.25);
        border-radius: 20px;
        padding: 5px 12px;
        font-size: 0.78rem;
        color: white;
        margin: 4px 4px 4px 0;
        backdrop-filter: blur(4px);
    }}

    /* ═══════════════════════════════════════════════════════════════════ */
    /*  BOOKING.COM RESULTAATKAART                                       */
    /* ═══════════════════════════════════════════════════════════════════ */
    .vs-result-card {{
        display: flex;
        flex-direction: row;
        background: var(--vs-card);
        border-radius: 12px;
        border: 1px solid var(--vs-border);
        box-shadow: var(--vs-shadow);
        overflow: hidden;
        margin-bottom: 1rem;
        min-height: 200px;
        transition: box-shadow 0.2s ease, border-color 0.2s ease;
        position: relative;
    }}
    .vs-result-card:hover {{
        box-shadow: var(--vs-shadow-lg);
        border-color: var(--vs-primary);
    }}

    .vs-card-img-col {{
        width: 240px;
        min-width: 240px;
        flex-shrink: 0;
        position: relative;
        overflow: hidden;
        background: #D6E4F0;
    }}
    .vs-card-img {{
        width: 100%; height: 100%;
        min-height: 200px;
        object-fit: cover;
        display: block;
        transition: transform 0.35s ease;
    }}
    .vs-result-card:hover .vs-card-img {{ transform: scale(1.04); }}

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
        font-size: 1.1rem;
        color: var(--vs-primary) !important;
        margin: 0 0 2px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        cursor: pointer;
        text-decoration: none;
    }}
    .vs-card-name:hover {{ text-decoration: underline; }}
    .vs-card-location {{
        font-size: 0.78rem;
        color: var(--vs-muted) !important;
        margin: 0 0 6px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }}
    .vs-card-distance {{
        font-size: 0.75rem;
        color: var(--vs-muted) !important;
        margin-bottom: 6px;
    }}
    .vs-card-desc {{
        font-size: 0.81rem;
        color: var(--vs-muted) !important;
        line-height: 1.5;
        margin: 0 0 8px;
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
    }}
    .vs-facilities-row {{
        display: flex;
        flex-wrap: wrap;
        gap: 4px;
        margin-bottom: 4px;
    }}
    .vs-facility-chip {{
        display: inline-flex;
        align-items: center;
        gap: 3px;
        font-size: 0.72rem;
        color: var(--vs-text) !important;
        padding: 2px 7px;
        border-radius: 4px;
        background: var(--vs-bg);
        border: 1px solid var(--vs-border);
        white-space: nowrap;
        font-weight: 500;
    }}
    .vs-facility-chip.highlight {{
        background: #E8F5E9;
        border-color: #A5D6A7;
        color: #1B5E20 !important;
    }}

    /* Drukte indicator */
    .vs-drukte-pill {{
        display: inline-flex;
        align-items: center;
        gap: 4px;
        font-size: 0.71rem;
        font-weight: 600;
        padding: 2px 8px;
        border-radius: 12px;
        white-space: nowrap;
    }}
    .vs-drukte-vol    {{ background: #FFEBEE; color: #C62828; border: 1px solid #FFCDD2; }}
    .vs-drukte-druk   {{ background: #FFF3E0; color: #E65100; border: 1px solid #FFE0B2; }}
    .vs-drukte-plek   {{ background: #E8F5E9; color: #2E7D32; border: 1px solid #C8E6C9; }}

    /* RECHTER PRIJS KOLOM */
    .vs-card-price-col {{
        width: 190px;
        min-width: 165px;
        flex-shrink: 0;
        padding: 1rem;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        align-items: flex-end;
        border-left: 1px solid var(--vs-border);
    }}
    .vs-score-block {{
        display: flex;
        align-items: center;
        gap: 8px;
        justify-content: flex-end;
    }}
    .vs-score-label {{
        font-size: 0.72rem;
        color: var(--vs-muted) !important;
        text-align: right;
        line-height: 1.3;
        max-width: 70px;
    }}
    .vs-score-badge {{
        background: var(--vs-score-bg);
        color: white;
        border-radius: 8px 8px 8px 0;
        padding: 6px 10px;
        font-size: 1.05rem;
        font-weight: 700;
        white-space: nowrap;
        min-width: 42px;
        text-align: center;
        font-family: 'Inter', sans-serif;
    }}
    .vs-price-block {{ text-align: right; margin-top: auto; }}
    .vs-price-from {{ font-size: 0.7rem; color: var(--vs-muted) !important; margin-bottom: 1px; }}
    .vs-price-main {{
        font-family: 'Inter', sans-serif;
        font-size: 1.35rem;
        font-weight: 700;
        color: var(--vs-text) !important;
        white-space: nowrap;
        line-height: 1.1;
    }}
    .vs-price-main.gratis {{ color: var(--vs-green) !important; }}
    .vs-price-main.onbekend {{ font-size: 0.88rem; color: var(--vs-muted) !important; font-weight: 400; }}
    .vs-price-sub {{ font-size: 0.68rem; color: var(--vs-muted) !important; margin-top: 2px; }}

    /* ═══════════════════════════════════════════════════════════════════ */
    /*  AIRBNB-STIJL KAART PRIJSMARKER                                   */
    /* ═══════════════════════════════════════════════════════════════════ */
    .vs-map-price-marker {{
        background: white;
        border: 2px solid #333;
        border-radius: 20px;
        padding: 3px 8px;
        font-size: 0.78rem;
        font-weight: 700;
        color: #1A1A1A;
        box-shadow: 0 2px 6px rgba(0,0,0,0.18);
        white-space: nowrap;
        cursor: pointer;
        transition: all 0.15s;
    }}
    .vs-map-price-marker:hover {{
        background: #1A1A1A;
        color: white;
        transform: scale(1.08);
    }}
    .vs-map-price-marker.gratis {{ background: #E8F5E9; border-color: #2E7D32; color: #1B5E20; }}

    /* ═══════════════════════════════════════════════════════════════════ */
    /*  SIDEBAR FILTER COMPONENTEN                                       */
    /* ═══════════════════════════════════════════════════════════════════ */
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
    .vs-filter-section {{
        padding: 0.7rem 0.9rem 0.4rem;
        border-bottom: 1px solid var(--vs-border);
    }}
    .vs-filter-title {{
        font-size: 0.75rem;
        font-weight: 700;
        color: var(--vs-text) !important;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        margin-bottom: 0.5rem;
        display: block;
    }}

    /* ═══════════════════════════════════════════════════════════════════ */
    /*  DETAIL PAGINA                                                    */
    /* ═══════════════════════════════════════════════════════════════════ */
    .vs-detail-hero {{
        background: linear-gradient(135deg, {BRAND_DARK}, {BRAND_PRIMARY});
        border-radius: 14px;
        padding: 1.4rem 1.6rem;
        margin-bottom: 1rem;
    }}
    .vs-detail-name {{
        font-family: 'DM Serif Display', serif;
        font-size: 1.7rem;
        color: white;
        margin: 0 0 4px;
    }}
    .vs-detail-loc {{ font-size: 0.85rem; color: rgba(255,255,255,0.72); }}

    .vs-facility-grid {{
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(195px, 1fr));
        gap: 8px;
        margin: 0.8rem 0;
    }}
    .vs-facility-item {{
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 8px 12px;
        border-radius: 8px;
        background: var(--vs-bg);
        border: 1px solid var(--vs-border);
        font-size: 0.81rem;
        color: var(--vs-text) !important;
    }}
    .vs-facility-item.ja  {{ background: #E8F5E9; border-color: #C8E6C9; color: #1B5E20 !important; }}
    .vs-facility-item.nee {{ background: var(--vs-bg); border-color: var(--vs-border); color: var(--vs-muted) !important; text-decoration: line-through; }}

    /* Crowdsource formulier */
    .vs-report-box {{
        background: var(--vs-bg);
        border: 1px dashed var(--vs-border);
        border-radius: 10px;
        padding: 1rem 1.2rem;
        margin-top: 1rem;
    }}
    .vs-report-title {{
        font-size: 0.82rem;
        font-weight: 600;
        color: var(--vs-muted) !important;
        margin-bottom: 0.5rem;
    }}

    /* Reisplanner */
    .vs-trip-card {{
        background: var(--vs-card);
        border-radius: 12px;
        border: 1px solid var(--vs-border);
        padding: 1rem;
        margin-bottom: 0.7rem;
        box-shadow: var(--vs-shadow);
    }}

    /* GPS Near Me */
    .vs-gps-hero {{
        background: linear-gradient(135deg, #1B4F72, #2E86C1);
        border-radius: 14px;
        padding: 2rem;
        text-align: center;
        margin-bottom: 1.5rem;
    }}

    /* API Status indicator */
    .vs-status-dot {{
        display: inline-block;
        width: 10px; height: 10px;
        border-radius: 50%;
        margin-right: 6px;
        flex-shrink: 0;
    }}
    .vs-status-dot.green {{ background: #27AE60; box-shadow: 0 0 6px rgba(39,174,96,0.5); }}
    .vs-status-dot.red   {{ background: #E74C3C; box-shadow: 0 0 6px rgba(231,76,60,0.5); }}
    .vs-status-dot.gray  {{ background: #95A5A6; }}
    .vs-status-row {{
        display: flex;
        align-items: center;
        padding: 0.6rem 0.8rem;
        border-radius: 8px;
        background: var(--vs-bg);
        border: 1px solid var(--vs-border);
        font-size: 0.83rem;
        margin-bottom: 0.5rem;
        color: var(--vs-text) !important;
    }}

    /* ── GEEN RESULTATEN ───────────────────────────────────────────────── */
    .vs-no-results {{
        text-align: center;
        padding: 5rem 2rem;
        color: var(--vs-muted) !important;
    }}
    .vs-no-results-icon {{ font-size: 3.5rem; margin-bottom: 1rem; }}

    /* ── RESULTS HEADER ────────────────────────────────────────────────── */
    .vs-results-header {{
        display: flex;
        align-items: baseline;
        gap: 8px;
        margin-bottom: 1rem;
        padding-bottom: 0.6rem;
        border-bottom: 1px solid var(--vs-border);
    }}
    .vs-results-count {{
        font-family: 'DM Serif Display', serif;
        font-size: 1.35rem;
        color: var(--vs-text) !important;
    }}
    .vs-results-sub {{ font-size: 0.8rem; color: var(--vs-muted) !important; }}

    /* AI TAGS */
    .vs-ai-tag {{
        display: inline-flex;
        align-items: center;
        gap: 4px;
        background: linear-gradient(90deg, {BRAND_DARK}, {BRAND_PRIMARY});
        color: white;
        border-radius: 20px;
        padding: 3px 10px;
        font-size: 0.72rem;
        font-family: 'Inter', sans-serif;
        margin: 2px 3px 2px 0;
        white-space: nowrap;
    }}

    /* ── MOBIEL ────────────────────────────────────────────────────────── */
    @media (max-width: 900px) {{
        .vs-card-img-col {{ width: 130px; min-width: 130px; }}
        .vs-card-price-col {{ width: 130px; min-width: 120px; }}
        .vs-hero-title {{ font-size: 1.8rem !important; }}
    }}
    @media (max-width: 600px) {{
        .vs-result-card {{ flex-direction: column; }}
        .vs-card-img-col {{ width: 100%; min-width: 100%; height: 170px; }}
        .vs-card-price-col {{ width: 100%; min-width: 100%; border-left: none; border-top: 1px solid var(--vs-border); }}
        .vs-hero {{ padding: 2rem 1.2rem 2.5rem; }}
    }}
    </style>
    """)


def render_sidebar_header() -> None:
    """Logo + navigatie in de sidebar."""
    with st.sidebar:
        st.markdown(f"""
<div class="vs-sidebar-logo">
  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="white"
       stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
    <path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10
             s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9
             A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/>
    <circle cx="7" cy="17" r="2"/>
    <path d="M9 17h6"/>
    <circle cx="17" cy="17" r="2"/>
  </svg>
  <div class="vs-sidebar-logo-title">VrijStaan</div>
  <div class="vs-sidebar-logo-sub">Camperplaatsen · NL</div>
</div>
""", unsafe_allow_html=True)

        st.markdown("""<div style="padding:0.8rem 0.8rem 0.3rem;
font-size:0.66rem;font-weight:700;color:#8A9DB5;
text-transform:uppercase;letter-spacing:0.1em;">Navigatie</div>""",
            unsafe_allow_html=True)

        st.page_link("main.py",                        label="Home",            icon="🏠")
        st.page_link("pages/1_🔍_Zoeken.py",           label="Zoeken",          icon="🔍")
        st.page_link("pages/2_📍_Dichtbij.py",         label="Dichtbij mij",    icon="📍")
        st.page_link("pages/3_🗺️_Reisplanner.py",      label="Reisplanner",     icon="🗺️")
        st.page_link("pages/4_⚙️_Beheer.py",           label="Beheer (Admin)",  icon="⚙️")

        st.markdown(f"""
<div style="margin:0 0.7rem;">
  <hr style="border-color:var(--vs-border);margin:0.5rem 0;">
</div>
<div style="padding:0.4rem 0.9rem 0.8rem;font-size:0.68rem;
color:#B0BEC5;text-align:center;">
  © 2026 VrijStaan &nbsp;·&nbsp;
  <span style="color:{BRAND_PRIMARY};font-weight:600;">v5.0</span>
</div>""", unsafe_allow_html=True)
