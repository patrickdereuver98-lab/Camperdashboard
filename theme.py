"""
ui/theme.py — VrijStaan Design System v5 (Premium SaaS Edition).
Booking.com + Airbnb aesthetics. Dark Mode aware. Anti-Clutter filosofie.

Tokens afgestemd op de referentie-screenshots:
  • Booking.com donkerblauw hero (#003580 / #006CE4)
  • Strakke witte kaarten met subtiele schaduwen
  • Gele accent voor CTAs (#FFB700)
  • Dark mode: zachte donkere achtergronden, nooit pure zwart
"""
from __future__ import annotations

import streamlit as st

# ── LIGHT MODE TOKENS ──────────────────────────────────────────────────────────
P_BLUE    = "#006CE4"   # Booking.com blauw
P_DARK    = "#003580"   # Donker Booking.com blauw
P_YELLOW  = "#FFB700"   # Accent geel
P_GREEN   = "#008009"   # Gratis-groen
P_RED     = "#CC0000"   # Waarschuwing
BG_PAGE   = "#F5F5F5"   # Lichtgrijs pagina-achtergrond
BG_CARD   = "#FFFFFF"
TEXT_H    = "#1A1A2E"   # Koppen
TEXT_BODY = "#4A4A68"   # Bodytekst
TEXT_MUTE = "#8492A6"   # Muted / secundair
BORDER    = "#E4E7EB"   # Subtiele rand

_FONTS = (
    "https://fonts.googleapis.com/css2?"
    "family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800"
    "&family=Syne:wght@700;800"
    "&display=swap"
)

# ── CSS ────────────────────────────────────────────────────────────────────────
_CSS = """
@import url('{fonts}');

/* ═══════════════════════════════════════════════════════════════════════
   RESET & BASE
═══════════════════════════════════════════════════════════════════════ */
*, *::before, *::after {{ box-sizing: border-box; }}

html, body,
[data-testid="stAppViewContainer"],
[data-testid="stMain"],
section.main, .main {{
    background: {bg_page} !important;
    font-family: 'Plus Jakarta Sans', system-ui, sans-serif !important;
    color: {text_body} !important;
}}
[data-testid="stSidebarNav"],
[data-testid="stDecoration"] {{ display: none !important; }}

.block-container {{
    padding: 0 !important;
    max-width: 100% !important;
}}

/* ═══════════════════════════════════════════════════════════════════════
   DARK MODE OVERRIDES
   Streamlit injects data-theme="dark" on <html> in dark mode
═══════════════════════════════════════════════════════════════════════ */
[data-theme="dark"] html,
[data-theme="dark"] body,
[data-theme="dark"] [data-testid="stAppViewContainer"],
[data-theme="dark"] [data-testid="stMain"],
[data-theme="dark"] section.main {{
    background: #0F1117 !important;
    color: #E8E8F0 !important;
}}
[data-theme="dark"] .vs-card,
[data-theme="dark"] .vs-result-card {{
    background: #1C1E2E !important;
    border-color: #2D3150 !important;
}}
[data-theme="dark"] .vs-card-name {{ color: #93B4FF !important; }}
[data-theme="dark"] .vs-price-main {{ color: #E8E8F0 !important; }}
[data-theme="dark"] .vs-sidebar-section {{ background: #1C1E2E !important; }}
[data-theme="dark"] .stTextInput > div > div > input {{
    background: #1C1E2E !important;
    border-color: #2D3150 !important;
    color: #E8E8F0 !important;
}}

/* ═══════════════════════════════════════════════════════════════════════
   TOPOGRAFIE
═══════════════════════════════════════════════════════════════════════ */
h1, h2, h3 {{
    font-family: 'Syne', 'Plus Jakarta Sans', sans-serif !important;
    color: {text_h} !important;
    letter-spacing: -0.03em;
    line-height: 1.15;
}}
h4, h5, h6 {{
    font-family: 'Plus Jakarta Sans', sans-serif !important;
    color: {text_h} !important;
}}

/* ═══════════════════════════════════════════════════════════════════════
   SIDEBAR
═══════════════════════════════════════════════════════════════════════ */
[data-testid="stSidebar"] {{
    background: {bg_card} !important;
    border-right: 1px solid {border} !important;
}}
[data-testid="stSidebar"] > div:first-child,
[data-testid="stSidebarContent"] {{ padding: 0 !important; }}

.vs-sidebar-logo {{
    background: linear-gradient(155deg, {p_dark} 0%, {p_blue} 100%);
    padding: 1.4rem 1.2rem;
    text-align: center;
}}
.vs-sidebar-logo-title {{
    font-family: 'Syne', sans-serif;
    font-size: 1.55rem;
    font-weight: 800;
    color: white;
    margin: 8px 0 2px;
    letter-spacing: -0.02em;
}}
.vs-sidebar-logo-sub {{
    font-size: 0.68rem;
    color: rgba(255,255,255,0.55);
    font-style: italic;
    letter-spacing: 0.02em;
}}
.vs-sidebar-section {{
    margin: 0.5rem 0.75rem;
    background: {bg_page};
    border-radius: 10px;
    padding: 0.6rem 0.8rem;
}}
.vs-sidebar-label {{
    font-size: 0.68rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: {text_mute};
    margin-bottom: 0.4rem;
    display: block;
}}

/* ═══════════════════════════════════════════════════════════════════════
   INPUTS
═══════════════════════════════════════════════════════════════════════ */
.stTextInput > div > div > input {{
    font-family: 'Plus Jakarta Sans', sans-serif !important;
    border-radius: 10px !important;
    border: 2px solid {border} !important;
    padding: 0.8rem 1.1rem !important;
    font-size: 1rem !important;
    background: {bg_card} !important;
    color: {text_h} !important;
    transition: border-color 0.18s, box-shadow 0.18s !important;
}}
.stTextInput > div > div > input:focus {{
    border-color: {p_blue} !important;
    box-shadow: 0 0 0 3px rgba(0,108,228,0.12) !important;
    outline: none !important;
}}
.stTextInput > div > div > input::placeholder {{
    color: {text_mute} !important;
}}
.stSelectbox > div > div,
.stMultiSelect > div > div {{
    border-radius: 10px !important;
    border: 1.5px solid {border} !important;
    font-family: 'Plus Jakarta Sans', sans-serif !important;
}}
.stCheckbox label {{
    font-family: 'Plus Jakarta Sans', sans-serif !important;
    font-size: 0.875rem !important;
    color: {text_body} !important;
    font-weight: 500 !important;
}}
.stCheckbox label:hover {{ color: {p_blue} !important; }}
.stRadio label {{
    font-family: 'Plus Jakarta Sans', sans-serif !important;
    font-size: 0.875rem !important;
}}

/* ═══════════════════════════════════════════════════════════════════════
   KNOPPEN
═══════════════════════════════════════════════════════════════════════ */
.stButton > button {{
    font-family: 'Plus Jakarta Sans', sans-serif !important;
    font-weight: 700 !important;
    border-radius: 10px !important;
    transition: all 0.16s ease !important;
    letter-spacing: 0.01em !important;
}}
.stButton > button[kind="primary"] {{
    background: {p_blue} !important;
    border: none !important;
    color: white !important;
    box-shadow: 0 3px 10px rgba(0,108,228,0.28) !important;
}}
.stButton > button[kind="primary"]:hover {{
    background: {p_dark} !important;
    transform: translateY(-1px) !important;
    box-shadow: 0 6px 18px rgba(0,53,128,0.32) !important;
}}
.stButton > button[kind="secondary"] {{
    background: {bg_card} !important;
    border: 1.5px solid {border} !important;
    color: {text_h} !important;
}}
.stButton > button[kind="secondary"]:hover {{
    border-color: {p_blue} !important;
    color: {p_blue} !important;
    background: #EBF3FF !important;
}}

/* ═══════════════════════════════════════════════════════════════════════
   TABS
═══════════════════════════════════════════════════════════════════════ */
.stTabs [data-baseweb="tab-list"] {{
    gap: 2px !important;
    border-bottom: 2px solid {border} !important;
    background: transparent !important;
    padding: 0 !important;
}}
.stTabs [data-baseweb="tab"] {{
    font-family: 'Plus Jakarta Sans', sans-serif !important;
    font-weight: 600 !important;
    font-size: 0.875rem !important;
    color: {text_mute} !important;
    padding: 0.65rem 1.3rem !important;
    border-radius: 8px 8px 0 0 !important;
    border: none !important;
}}
.stTabs [aria-selected="true"] {{
    color: {p_blue} !important;
    border-bottom: 3px solid {p_blue} !important;
    font-weight: 700 !important;
    background: rgba(0,108,228,0.04) !important;
}}

/* ═══════════════════════════════════════════════════════════════════════
   BOOKING.COM ZOEKBALK HERO
═══════════════════════════════════════════════════════════════════════ */
.vs-hero {{
    background: linear-gradient(145deg, {p_dark} 0%, {p_blue} 70%, #0099FF 100%);
    padding: 2.8rem 2.4rem 3.4rem;
    position: relative;
    overflow: hidden;
    margin-bottom: 0;
}}
.vs-hero::before {{
    content: '';
    position: absolute;
    top: -80px; right: -80px;
    width: 320px; height: 320px;
    border-radius: 50%;
    background: rgba(255,183,0,0.08);
    pointer-events: none;
}}
.vs-hero::after {{
    content: '';
    position: absolute;
    bottom: -100px; left: -40px;
    width: 260px; height: 260px;
    border-radius: 50%;
    background: rgba(0,180,216,0.12);
    pointer-events: none;
}}
.vs-hero-eyebrow {{
    font-size: 0.78rem;
    font-weight: 600;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: {p_yellow};
    margin-bottom: 0.5rem;
    position: relative; z-index: 2;
}}
.vs-hero-title {{
    font-family: 'Syne', sans-serif !important;
    font-size: clamp(1.8rem, 4vw, 2.8rem) !important;
    font-weight: 800 !important;
    color: white !important;
    margin: 0 0 0.4rem !important;
    position: relative; z-index: 2;
    line-height: 1.15 !important;
    letter-spacing: -0.03em !important;
}}
.vs-hero-sub {{
    color: rgba(255,255,255,0.72);
    font-size: 1rem;
    margin: 0 0 1.6rem;
    position: relative; z-index: 2;
    font-weight: 400;
}}

/* Booking.com gele searchbar rand */
.vs-searchbar-container {{
    background: {p_yellow};
    border-radius: 14px;
    padding: 5px;
    display: flex;
    align-items: center;
    gap: 4px;
    position: relative; z-index: 2;
    box-shadow: 0 8px 32px rgba(0,0,0,0.20);
}}

/* Social Proof badges */
.vs-proof-badge {{
    display: inline-flex;
    align-items: center;
    gap: 6px;
    background: rgba(255,255,255,0.12);
    border: 1px solid rgba(255,255,255,0.22);
    border-radius: 20px;
    padding: 5px 12px;
    font-size: 0.75rem;
    color: rgba(255,255,255,0.9);
    font-weight: 600;
    margin-right: 8px;
    margin-top: 1rem;
    backdrop-filter: blur(4px);
    position: relative; z-index: 2;
    display: inline-flex;
}}

/* ═══════════════════════════════════════════════════════════════════════
   RESULTAAT KAARTEN — Booking.com stijl
═══════════════════════════════════════════════════════════════════════ */
.vs-result-card {{
    display: flex;
    flex-direction: row;
    background: {bg_card};
    border-radius: 14px;
    border: 1px solid {border};
    box-shadow: 0 2px 10px rgba(0,0,0,0.06);
    overflow: hidden;
    margin-bottom: 1rem;
    min-height: 196px;
    transition: box-shadow 0.2s ease, border-color 0.2s ease, transform 0.2s ease;
    position: relative;
}}
.vs-result-card:hover {{
    box-shadow: 0 8px 28px rgba(0,0,0,0.13);
    border-color: {p_blue};
    transform: translateY(-2px);
}}

/* Foto kolom */
.vs-card-img-wrap {{
    width: 240px;
    min-width: 240px;
    flex-shrink: 0;
    position: relative;
    overflow: hidden;
    background: #D5E8F5;
}}
.vs-card-img {{
    width: 100%;
    height: 100%;
    min-height: 196px;
    object-fit: cover;
    display: block;
    transition: transform 0.35s ease;
}}
.vs-result-card:hover .vs-card-img {{ transform: scale(1.04); }}

/* Fav overlay */
.vs-fav-btn {{
    position: absolute;
    top: 10px; right: 10px;
    background: rgba(255,255,255,0.92);
    border-radius: 50%;
    width: 34px; height: 34px;
    display: flex; align-items: center; justify-content: center;
    backdrop-filter: blur(6px);
    font-size: 1.1rem;
    z-index: 3;
    cursor: pointer;
    border: none;
    transition: transform 0.15s;
}}
.vs-fav-btn:hover {{ transform: scale(1.15); }}

/* Drukte badge op foto */
.vs-drukte-badge {{
    position: absolute;
    bottom: 8px; left: 8px;
    border-radius: 6px;
    padding: 3px 8px;
    font-size: 0.68rem;
    font-weight: 700;
    z-index: 3;
    white-space: nowrap;
}}
.vs-drukte-snel {{ background: #FFE5E5; color: #CC0000; }}
.vs-drukte-medium {{ background: #FFF3E0; color: #E65100; }}
.vs-drukte-plek {{ background: #E8F5E9; color: #1B5E20; }}

/* Midden info kolom */
.vs-card-info {{
    flex: 1 1 0%;
    min-width: 0;
    padding: 1rem 1.2rem;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
}}
.vs-card-name {{
    font-family: 'Plus Jakarta Sans', sans-serif;
    font-size: 1.05rem;
    font-weight: 700;
    color: {p_blue};
    margin: 0 0 2px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    cursor: pointer;
    text-decoration: underline;
    text-decoration-color: transparent;
    transition: text-decoration-color 0.15s;
}}
.vs-card-name:hover {{ text-decoration-color: {p_blue}; }}
.vs-card-meta {{
    font-size: 0.75rem;
    color: {text_mute};
    display: flex;
    align-items: center;
    gap: 6px;
    margin-bottom: 6px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}}
.vs-card-meta a {{
    color: {p_blue};
    text-decoration: underline;
    font-weight: 500;
}}
.vs-type-pill {{
    display: inline-flex;
    align-items: center;
    background: #EBF3FF;
    color: {p_blue};
    border-radius: 5px;
    padding: 2px 7px;
    font-size: 0.7rem;
    font-weight: 700;
    margin-bottom: 6px;
    white-space: nowrap;
    flex-shrink: 0;
}}
.vs-card-desc {{
    font-size: 0.81rem;
    color: {text_mute};
    line-height: 1.5;
    margin-bottom: 8px;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
}}
.vs-chip-row {{
    display: flex;
    flex-wrap: nowrap;
    gap: 5px;
    overflow: hidden;
}}
.vs-chip {{
    display: inline-flex;
    align-items: center;
    gap: 3px;
    font-size: 0.72rem;
    color: #374151;
    padding: 3px 8px;
    border-radius: 5px;
    background: #F7F9FC;
    border: 1px solid {border};
    white-space: nowrap;
    flex-shrink: 0;
    font-weight: 500;
}}
.vs-chip.ok {{ background: #E8F5E9; border-color: #C8E6C9; color: #1B5E20; }}
.vs-chip.warn {{ background: #FFF3E0; border-color: #FFCC80; color: #E65100; }}
.vs-card-restrictions {{
    display: flex;
    gap: 8px;
    margin-top: 6px;
    flex-wrap: wrap;
}}
.vs-restriction {{
    font-size: 0.68rem;
    color: {text_mute};
    background: #F7F9FC;
    border: 1px solid {border};
    border-radius: 4px;
    padding: 2px 6px;
}}

/* Rechter prijs kolom */
.vs-card-price-col {{
    width: 185px;
    min-width: 165px;
    flex-shrink: 0;
    padding: 1rem;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    align-items: flex-end;
    border-left: 1px solid {border};
}}
.vs-score-wrap {{
    display: flex;
    align-items: center;
    gap: 8px;
    justify-content: flex-end;
    margin-bottom: auto;
}}
.vs-score-label-stack {{
    text-align: right;
}}
.vs-score-label-word {{
    font-size: 0.78rem;
    font-weight: 700;
    color: {text_h};
    display: block;
    white-space: nowrap;
}}
.vs-score-label-count {{
    font-size: 0.65rem;
    color: {text_mute};
    white-space: nowrap;
}}
.vs-score-box {{
    background: {p_dark};
    color: white;
    border-radius: 8px 8px 8px 0;
    padding: 7px 10px;
    font-size: 1.15rem;
    font-weight: 800;
    min-width: 46px;
    text-align: center;
    font-family: 'Plus Jakarta Sans', sans-serif;
    flex-shrink: 0;
}}
.vs-score-box.high {{ background: {p_blue}; }}
.vs-price-wrap {{ text-align: right; margin-top: auto; padding-top: 0.5rem; }}
.vs-price-label {{ font-size: 0.68rem; color: {text_mute}; margin-bottom: 2px; }}
.vs-price-value {{
    font-size: 1.35rem;
    font-weight: 800;
    color: {text_h};
    line-height: 1.1;
    white-space: nowrap;
    font-family: 'Plus Jakarta Sans', sans-serif;
}}
.vs-price-value.gratis {{ color: {p_green}; }}
.vs-price-value.onbekend {{ font-size: 0.88rem; font-weight: 500; color: {text_mute}; }}
.vs-price-note {{ font-size: 0.65rem; color: {text_mute}; margin-top: 2px; }}

/* Airbnb-stijl kaart marker */
.vs-map-marker {{
    background: white;
    border: 2px solid {text_h};
    border-radius: 20px;
    padding: 4px 10px;
    font-size: 0.78rem;
    font-weight: 800;
    color: {text_h};
    box-shadow: 0 2px 8px rgba(0,0,0,0.18);
    white-space: nowrap;
    cursor: pointer;
    transition: all 0.15s;
}}
.vs-map-marker:hover, .vs-map-marker.selected {{
    background: {text_h};
    color: white;
    transform: scale(1.05);
}}
.vs-map-marker.gratis {{ background: {p_green}; color: white; border-color: {p_green}; }}

/* ═══════════════════════════════════════════════════════════════════════
   DETAIL PAGINA (Booking.com stijl)
═══════════════════════════════════════════════════════════════════════ */
.vs-detail-photo-grid {{
    display: grid;
    grid-template-columns: 2fr 1fr 1fr;
    grid-template-rows: 200px 200px;
    gap: 6px;
    border-radius: 14px;
    overflow: hidden;
    margin-bottom: 1.2rem;
}}
.vs-detail-photo-main {{
    grid-row: 1 / 3;
    object-fit: cover;
    width: 100%; height: 100%;
}}
.vs-detail-photo-thumb {{
    object-fit: cover;
    width: 100%; height: 100%;
}}
.vs-detail-highlight-box {{
    background: {bg_page};
    border: 1px solid {border};
    border-radius: 10px;
    padding: 1rem 1.2rem;
}}
.vs-facility-grid {{
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(190px, 1fr));
    gap: 8px;
    margin: 0.8rem 0;
}}
.vs-facility-item {{
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    border-radius: 9px;
    background: {bg_page};
    border: 1px solid {border};
    font-size: 0.82rem;
    color: {text_body};
    font-weight: 500;
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
    opacity: 0.7;
}}

/* Crowdsourcing "Foutje?" formulier */
.vs-crowdsource-box {{
    background: #FFFBEB;
    border: 1px solid #FDE68A;
    border-radius: 10px;
    padding: 0.9rem 1.1rem;
    margin-top: 1rem;
}}

/* ═══════════════════════════════════════════════════════════════════════
   REISPLANNER
═══════════════════════════════════════════════════════════════════════ */
.vs-planner-stop {{
    display: flex;
    align-items: flex-start;
    gap: 12px;
    padding: 0.8rem;
    background: {bg_card};
    border-radius: 10px;
    border: 1px solid {border};
    margin-bottom: 0.5rem;
}}
.vs-planner-num {{
    background: {p_blue};
    color: white;
    border-radius: 50%;
    width: 28px; height: 28px;
    display: flex; align-items: center; justify-content: center;
    font-size: 0.78rem;
    font-weight: 800;
    flex-shrink: 0;
}}
.vs-budget-bar-bg {{
    background: {border};
    border-radius: 8px;
    height: 10px;
    overflow: hidden;
    margin: 4px 0;
}}
.vs-budget-bar {{
    height: 10px;
    border-radius: 8px;
    background: linear-gradient(90deg, {p_blue}, {p_yellow});
    transition: width 0.4s ease;
}}

/* ═══════════════════════════════════════════════════════════════════════
   NEAR ME PAGINA
═══════════════════════════════════════════════════════════════════════ */
.vs-distance-badge {{
    display: inline-flex;
    align-items: center;
    gap: 4px;
    background: {p_blue};
    color: white;
    border-radius: 6px;
    padding: 3px 8px;
    font-size: 0.72rem;
    font-weight: 700;
    white-space: nowrap;
}}
.vs-gps-waiting {{
    text-align: center;
    padding: 3rem 1rem;
    color: {text_mute};
}}
.vs-gps-icon {{
    font-size: 3rem;
    margin-bottom: 1rem;
    animation: pulse 2s infinite;
}}
@keyframes pulse {{
    0%, 100% {{ opacity: 1; }}
    50% {{ opacity: 0.4; }}
}}

/* ═══════════════════════════════════════════════════════════════════════
   STATS & LANDING ELEMENTEN
═══════════════════════════════════════════════════════════════════════ */
.vs-stat-card {{
    background: {bg_card};
    border-radius: 14px;
    border: 1px solid {border};
    padding: 1.3rem 1rem;
    text-align: center;
    box-shadow: 0 2px 8px rgba(0,0,0,0.04);
}}
.vs-stat-num {{
    font-family: 'Syne', sans-serif;
    font-size: 2.1rem;
    font-weight: 800;
    color: {p_blue};
    margin-bottom: 4px;
    line-height: 1;
}}
.vs-stat-label {{
    font-size: 0.78rem;
    color: {text_mute};
    font-weight: 500;
}}
.vs-feature-card {{
    background: {bg_card};
    border-radius: 14px;
    border: 1px solid {border};
    padding: 1.5rem 1.2rem;
    transition: transform 0.18s, box-shadow 0.18s;
    height: 100%;
}}
.vs-feature-card:hover {{
    transform: translateY(-4px);
    box-shadow: 0 12px 32px rgba(0,0,0,0.10);
}}

/* ═══════════════════════════════════════════════════════════════════════
   BEHEER — STATUS MONITOR
═══════════════════════════════════════════════════════════════════════ */
.vs-api-status {{
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 0.75rem 1rem;
    border-radius: 10px;
    background: {bg_card};
    border: 1px solid {border};
    margin-bottom: 0.5rem;
}}
.vs-status-dot {{
    width: 10px; height: 10px;
    border-radius: 50%;
    flex-shrink: 0;
}}
.vs-status-dot.ok {{ background: #22C55E; box-shadow: 0 0 6px rgba(34,197,94,0.5); }}
.vs-status-dot.warn {{ background: {p_yellow}; box-shadow: 0 0 6px rgba(255,183,0,0.5); }}
.vs-status-dot.err {{ background: #EF4444; box-shadow: 0 0 6px rgba(239,68,68,0.5); }}
.vs-log-entry {{
    font-family: 'JetBrains Mono', 'Courier New', monospace;
    font-size: 0.72rem;
    padding: 3px 0;
    border-bottom: 1px solid {border};
    color: {text_mute};
}}
.vs-log-entry.err {{ color: #EF4444; }}
.vs-log-entry.warn {{ color: #F59E0B; }}
.vs-log-entry.info {{ color: {text_body}; }}

/* ═══════════════════════════════════════════════════════════════════════
   AI TAG
═══════════════════════════════════════════════════════════════════════ */
.vs-ai-tag {{
    display: inline-flex;
    align-items: center;
    gap: 4px;
    background: linear-gradient(90deg, {p_dark}, {p_blue});
    color: white;
    border-radius: 20px;
    padding: 3px 10px;
    font-size: 0.73rem;
    font-weight: 600;
    margin: 2px 3px 2px 0;
    white-space: nowrap;
}}

/* ═══════════════════════════════════════════════════════════════════════
   KAART TOGGLE
═══════════════════════════════════════════════════════════════════════ */
.vs-map-toggle-bar {{
    display: flex;
    align-items: center;
    justify-content: space-between;
    background: {bg_card};
    border: 1px solid {border};
    border-radius: 10px;
    padding: 0.65rem 1rem;
    margin-bottom: 0.8rem;
    cursor: pointer;
    transition: border-color 0.15s;
}}
.vs-map-toggle-bar:hover {{ border-color: {p_blue}; }}

/* ═══════════════════════════════════════════════════════════════════════
   GEEN RESULTATEN
═══════════════════════════════════════════════════════════════════════ */
.vs-empty-state {{
    text-align: center;
    padding: 5rem 2rem;
    color: {text_mute};
}}

/* ═══════════════════════════════════════════════════════════════════════
   RESULTATEN TELLER
═══════════════════════════════════════════════════════════════════════ */
.vs-results-header {{
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    margin-bottom: 0.9rem;
    padding: 0;
}}
.vs-results-count {{
    font-family: 'Syne', sans-serif;
    font-size: 1.3rem;
    font-weight: 800;
    color: {text_h};
}}
.vs-results-sub {{
    font-size: 0.8rem;
    color: {text_mute};
}}

/* ═══════════════════════════════════════════════════════════════════════
   UTILITY BADGES (backward-compat)
═══════════════════════════════════════════════════════════════════════ */
.vs-badge {{
    display: inline-flex; align-items: center; gap: 3px;
    padding: 2px 8px; border-radius: 5px;
    font-size: 0.69rem; font-weight: 600; white-space: nowrap;
}}
.vs-badge-gratis   {{ background:#E8F5E9; color:#1B5E20; border:1px solid #C8E6C9; }}
.vs-badge-betaald  {{ background:#FFF3E0; color:#E65100; border:1px solid #FFE0B2; }}
.vs-badge-onbekend {{ background:#F5F5F5; color:#546E7A; border:1px solid #E0E0E0; }}
.vs-badge-stroom   {{ background:#EBF3FF; color:#0056A8; border:1px solid #BBDEFB; }}
.vs-badge-honden   {{ background:#FFF8E1; color:#B76300; border:1px solid #FFD9A0; }}
.vs-badge-wifi     {{ background:#EDFAF3; color:#1A7F5A; border:1px solid #B2DFDB; }}
.vs-badge-water    {{ background:#E8F5FF; color:#005A8C; border:1px solid #B3D9F0; }}
.vs-badge-groen    {{ background:#F1F8E9; color:#33691E; border:1px solid #DCEDC8; }}

/* ═══════════════════════════════════════════════════════════════════════
   RESPONSIVE
═══════════════════════════════════════════════════════════════════════ */
@media (max-width: 900px) {{
    .vs-card-img-wrap {{ width: 140px; min-width: 140px; }}
    .vs-card-price-col {{ width: 130px; min-width: 130px; }}
    .vs-hero-title {{ font-size: 1.7rem !important; }}
    .vs-card-name {{ font-size: 0.95rem; }}
}}
@media (max-width: 640px) {{
    .vs-result-card {{ flex-direction: column; min-height: auto; }}
    .vs-card-img-wrap {{ width: 100%; min-width: 100%; height: 180px; }}
    .vs-card-price-col {{ width: 100%; min-width: 100%; border-left: none; border-top: 1px solid {border}; flex-direction: row; align-items: center; justify-content: space-between; }}
    .vs-hero {{ padding: 1.8rem 1.2rem 2.4rem; }}
}}
"""


def apply_theme() -> None:
    """Injecteer het volledige VrijStaan v5 design systeem."""
    css = _CSS.format(
        fonts=_FONTS,
        p_blue=P_BLUE, p_dark=P_DARK, p_yellow=P_YELLOW,
        p_green=P_GREEN,
        bg_page=BG_PAGE, bg_card=BG_CARD,
        text_h=TEXT_H, text_body=TEXT_BODY, text_mute=TEXT_MUTE,
        border=BORDER,
    )
    st.html(f"<style>{css}</style>")


def render_sidebar_header() -> None:
    """Sidebar logo + navigatie."""
    with st.sidebar:
        st.markdown(f"""
<div class="vs-sidebar-logo">
  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="white"
       stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
    <path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10
             s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9
             A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/>
    <circle cx="7" cy="17" r="2"/>
    <path d="M9 17h6"/>
    <circle cx="17" cy="17" r="2"/>
  </svg>
  <div class="vs-sidebar-logo-title">VrijStaan</div>
  <div class="vs-sidebar-logo-sub">Nederland's #1 camperplatform</div>
</div>
""", unsafe_allow_html=True)

        st.markdown(
            "<div style='padding:0.7rem 0.8rem 0.2rem;font-size:0.66rem;"
            f"font-weight:700;color:{TEXT_MUTE};text-transform:uppercase;"
            "letter-spacing:0.1em;'>Navigatie</div>",
            unsafe_allow_html=True,
        )
        st.page_link("main.py",                      label="Home",          icon="🏠")
        st.page_link("pages/1_🔍_Zoeken.py",         label="Zoeken",        icon="🔍")
        st.page_link("pages/2_📍_Dichtbij.py",       label="Dichtbij mij",  icon="📍")
        st.page_link("pages/3_🗺️_Reisplanner.py",    label="Reisplanner",   icon="🗺️")
        st.page_link("pages/4_⚙️_Beheer.py",         label="Beheer",        icon="⚙️")

        st.markdown(
            f"<div style='margin:0.5rem 0.8rem;'>"
            f"<hr style='border-color:{BORDER};margin:0.4rem 0;'></div>"
            f"<div style='padding:0.4rem 1rem;font-size:0.68rem;color:#B0BEC5;"
            f"text-align:center;'>© 2026 VrijStaan · "
            f"<span style='color:{P_BLUE};font-weight:700;'>v5.0</span></div>",
            unsafe_allow_html=True,
        )
