"""
ui/css_fix.py — VrijStaan v5 Global CSS Overhaul.
Drop-in fix voor alle layout/dark-mode bugs zichtbaar in de screenshots.

Gebruik: voeg `from ui.css_fix import inject_global_css` toe aan apply_theme()
en roep inject_global_css() aan DIRECT na st.set_page_config().
"""
import streamlit as st


def inject_global_css() -> None:
    """
    Injecteert de volledige CSS-overhaul.
    Repareert:
      1. Sidebar raw-tekst leak (keyboard_doub, arrow_right, arrow_up)
      2. Witte container-bloat in dark mode (result cards)
      3. Expander-label rendering
      4. Block-container padding/witte balken
      5. Button-balk die los staat van cards
      6. Dark/light mode token-cascade
    """
    st.markdown("""
<style>
/* ══════════════════════════════════════════════════════════════════════════
   0. CSS CUSTOM PROPERTIES — cascade naar alle Streamlit-elementen
   ══════════════════════════════════════════════════════════════════════════ */
:root {
  --vs-primary:    #006CE4;
  --vs-dark:       #003580;
  --vs-accent:     #FFB700;
  --vs-green:      #008009;
  --vs-red:        #C0392B;

  /* Light mode */
  --vs-bg:         #F5F7FA;
  --vs-card:       #FFFFFF;
  --vs-text:       #1A1A2E;
  --vs-muted:      #6B7897;
  --vs-border:     #E2E8F0;
  --vs-input-bg:   #FFFFFF;
  --vs-shadow:     0 2px 12px rgba(0,0,0,0.07);
  --vs-shadow-lg:  0 8px 32px rgba(0,0,0,0.13);
  --vs-sidebar-bg: #FFFFFF;
}

/* Dark mode — Streamlit injecteert data-theme="dark" op <body> */
[data-theme="dark"] {
  --vs-bg:         #0F1117;
  --vs-card:       #1E2130;
  --vs-text:       #E8ECF4;
  --vs-muted:      #8A93AA;
  --vs-border:     #2D3348;
  --vs-input-bg:   #262B3D;
  --vs-shadow:     0 2px 12px rgba(0,0,0,0.45);
  --vs-shadow-lg:  0 8px 32px rgba(0,0,0,0.6);
  --vs-sidebar-bg: #161925;
}

/* ══════════════════════════════════════════════════════════════════════════
   1. BASIS & PAGINA-ACHTERGROND
   ══════════════════════════════════════════════════════════════════════════ */
html, body,
[data-testid="stAppViewContainer"],
[data-testid="stMain"],
section.main, .main {
  background-color: var(--vs-bg) !important;
  color: var(--vs-text) !important;
  font-family: 'Inter', system-ui, -apple-system, sans-serif !important;
}

/* FIX: Verwijder de witte balk/ruimte boven de content */
.block-container {
  padding-top: 0.5rem !important;
  padding-bottom: 2rem !important;
  padding-left: 1.5rem !important;
  padding-right: 1.5rem !important;
  max-width: 1300px !important;
}

/* FIX: Verberg Streamlit top-toolbar decoraties die overlappen */
[data-testid="stDecoration"],
[data-testid="stHeader"] {
  display: none !important;
  height: 0 !important;
}

/* ══════════════════════════════════════════════════════════════════════════
   2. SIDEBAR — FIX voor raw-tekst leak en icon rendering
   ══════════════════════════════════════════════════════════════════════════ */
[data-testid="stSidebar"] {
  background: var(--vs-sidebar-bg) !important;
  border-right: 1px solid var(--vs-border) !important;
}
[data-testid="stSidebar"] > div:first-child,
[data-testid="stSidebarContent"] {
  padding: 0 !important;
  overflow-x: hidden !important;
}

/* FIX: Verberg het "keyboard_doub" debug-element bovenaan sidebar */
[data-testid="stSidebar"] > div:first-child > div:first-child > div > div:first-child {
  display: none !important;
}
/* Alternatieve selector voor de toolbar bovenin sidebar */
[data-testid="stSidebarHeader"],
[data-testid="stSidebarCollapsedControl"] {
  background: transparent !important;
  border-bottom: none !important;
}

/* FIX: Expander arrow-icon wordt als tekst getoond ("arrow_right", "arrow_up")
   — dit is het Google Material Icons font dat niet laadt.
   We vervangen met CSS-only chevrons. */
[data-testid="stExpander"] summary > span:first-child,
[data-testid="stExpander"] [data-testid="stExpanderToggleIcon"] {
  font-family: 'Inter', sans-serif !important;
  font-size: 0 !important;  /* verberg raw icon-naam tekst */
}
[data-testid="stExpander"] summary::after {
  content: '›';
  font-size: 1.1rem;
  font-family: system-ui, sans-serif !important;
  color: var(--vs-muted);
  transition: transform 0.2s;
  margin-left: auto;
}
[data-testid="stExpander"][open] summary::after {
  transform: rotate(90deg);
}

/* Expander base styling */
[data-testid="stExpander"] {
  background: var(--vs-card) !important;
  border: 1px solid var(--vs-border) !important;
  border-radius: 10px !important;
  margin-bottom: 6px !important;
  overflow: hidden !important;
}
[data-testid="stExpander"] summary {
  background: var(--vs-card) !important;
  color: var(--vs-text) !important;
  font-weight: 600 !important;
  font-size: 0.82rem !important;
  padding: 0.6rem 0.8rem !important;
  border-radius: 10px !important;
  display: flex !important;
  align-items: center !important;
  cursor: pointer !important;
  user-select: none !important;
  list-style: none !important;
}
[data-testid="stExpander"] summary::-webkit-details-marker { display: none; }

/* ══════════════════════════════════════════════════════════════════════════
   3. NAVIGATIE LINKS
   ══════════════════════════════════════════════════════════════════════════ */
[data-testid="stSidebar"] [data-testid="stPageLink"],
[data-testid="stSidebar"] [data-testid="stPageLink"] a {
  color: var(--vs-text) !important;
  font-size: 0.88rem !important;
  font-weight: 500 !important;
  text-decoration: none !important;
  border-radius: 8px !important;
  padding: 0.4rem 0.6rem !important;
  transition: background 0.15s, color 0.15s !important;
}
[data-testid="stSidebar"] [data-testid="stPageLink"]:hover a {
  color: var(--vs-primary) !important;
  background: rgba(0,108,228,0.08) !important;
}

/* ══════════════════════════════════════════════════════════════════════════
   4. RESULT CARDS — FIX voor witte bloat in dark mode
   ══════════════════════════════════════════════════════════════════════════ */

/* FIX: Alle st.markdown containers erven dark-mode achtergrond */
[data-testid="stVerticalBlock"],
[data-testid="stHorizontalBlock"],
[data-testid="stColumn"],
[data-testid="element-container"],
[data-testid="stMarkdownContainer"],
.stMarkdown {
  background: transparent !important;
}

/* FIX: De grote witte box in kaarten — dit zijn st.container/column wrappers
   die een witte achtergrond hebben in dark mode */
[data-testid="stVerticalBlock"] > div,
[data-testid="stColumn"] > div {
  background: transparent !important;
}

/* vs-result-card — zorg dat de HTML card correct kleurt */
.vs-result-card {
  display: flex !important;
  flex-direction: row !important;
  background: var(--vs-card) !important;
  border-radius: 12px !important;
  border: 1px solid var(--vs-border) !important;
  box-shadow: var(--vs-shadow) !important;
  overflow: hidden !important;
  margin-bottom: 0.75rem !important;
  min-height: 200px !important;
  transition: box-shadow 0.2s ease, border-color 0.2s ease !important;
  position: relative !important;
}
.vs-result-card:hover {
  box-shadow: var(--vs-shadow-lg) !important;
  border-color: var(--vs-primary) !important;
}
.vs-card-img-col {
  width: 240px !important;
  min-width: 240px !important;
  flex-shrink: 0 !important;
  background: #2D3348 !important;
  overflow: hidden !important;
  position: relative !important;
}
.vs-card-img {
  width: 100% !important;
  height: 100% !important;
  min-height: 200px !important;
  object-fit: cover !important;
  display: block !important;
  transition: transform 0.35s ease !important;
}
.vs-result-card:hover .vs-card-img { transform: scale(1.04) !important; }

.vs-card-info-col {
  flex: 1 1 0% !important;
  min-width: 0 !important;
  padding: 1rem 1.2rem !important;
  display: flex !important;
  flex-direction: column !important;
  justify-content: space-between !important;
  background: var(--vs-card) !important;
}
.vs-card-name {
  font-size: 1.05rem !important;
  font-weight: 700 !important;
  color: var(--vs-primary) !important;
  margin: 0 0 3px !important;
  white-space: nowrap !important;
  overflow: hidden !important;
  text-overflow: ellipsis !important;
}
.vs-card-location {
  font-size: 0.78rem !important;
  color: var(--vs-muted) !important;
  margin: 0 0 6px !important;
}
.vs-card-desc {
  font-size: 0.81rem !important;
  color: var(--vs-muted) !important;
  line-height: 1.5 !important;
  margin: 0 0 8px !important;
  display: -webkit-box !important;
  -webkit-line-clamp: 2 !important;
  -webkit-box-orient: vertical !important;
  overflow: hidden !important;
}
.vs-facilities-row {
  display: flex !important;
  flex-wrap: wrap !important;
  gap: 4px !important;
}
.vs-facility-chip {
  display: inline-flex !important;
  align-items: center !important;
  gap: 3px !important;
  font-size: 0.71rem !important;
  font-weight: 600 !important;
  padding: 2px 7px !important;
  border-radius: 5px !important;
  background: rgba(0,108,228,0.10) !important;
  color: var(--vs-primary) !important;
  border: 1px solid rgba(0,108,228,0.2) !important;
  white-space: nowrap !important;
}
.vs-facility-chip.highlight {
  background: rgba(0,128,9,0.10) !important;
  color: var(--vs-green) !important;
  border-color: rgba(0,128,9,0.2) !important;
}

/* Prijs kolom */
.vs-card-price-col {
  width: 185px !important;
  min-width: 165px !important;
  flex-shrink: 0 !important;
  padding: 1rem !important;
  display: flex !important;
  flex-direction: column !important;
  justify-content: space-between !important;
  align-items: flex-end !important;
  border-left: 1px solid var(--vs-border) !important;
  background: var(--vs-card) !important;
}
.vs-score-block {
  display: flex !important;
  align-items: center !important;
  gap: 8px !important;
  justify-content: flex-end !important;
}
.vs-score-label {
  font-size: 0.7rem !important;
  color: var(--vs-muted) !important;
  text-align: right !important;
  line-height: 1.3 !important;
  max-width: 72px !important;
}
.vs-score-badge {
  background: var(--vs-dark) !important;
  color: white !important;
  border-radius: 8px 8px 8px 0 !important;
  padding: 6px 10px !important;
  font-size: 1.05rem !important;
  font-weight: 700 !important;
  min-width: 42px !important;
  text-align: center !important;
}
.vs-price-block { text-align: right !important; margin-top: auto !important; }
.vs-price-from { font-size: 0.7rem !important; color: var(--vs-muted) !important; margin-bottom: 1px !important; }
.vs-price-main {
  font-size: 1.2rem !important;
  font-weight: 700 !important;
  color: var(--vs-text) !important;
  white-space: nowrap !important;
}
.vs-price-main.gratis { color: var(--vs-green) !important; }
.vs-price-main.onbekend { font-size: 0.85rem !important; color: var(--vs-muted) !important; font-weight: 400 !important; }
.vs-price-sub { font-size: 0.68rem !important; color: var(--vs-muted) !important; }

/* ══════════════════════════════════════════════════════════════════════════
   5. KNOPPEN — FIX voor de losstaande balk
   ══════════════════════════════════════════════════════════════════════════ */
.stButton > button {
  font-family: 'Inter', system-ui, sans-serif !important;
  font-weight: 600 !important;
  border-radius: 8px !important;
  transition: all 0.15s ease !important;
  font-size: 0.875rem !important;
  letter-spacing: 0.01em !important;
}
.stButton > button[kind="primary"] {
  background: var(--vs-primary) !important;
  border: none !important;
  color: white !important;
  box-shadow: 0 2px 8px rgba(0,108,228,0.28) !important;
}
.stButton > button[kind="primary"]:hover {
  background: var(--vs-dark) !important;
  transform: translateY(-1px) !important;
  box-shadow: 0 5px 16px rgba(0,53,128,0.38) !important;
}
.stButton > button[kind="secondary"] {
  background: var(--vs-card) !important;
  border: 1.5px solid var(--vs-border) !important;
  color: var(--vs-text) !important;
}
.stButton > button[kind="secondary"]:hover {
  border-color: var(--vs-primary) !important;
  color: var(--vs-primary) !important;
  background: rgba(0,108,228,0.05) !important;
}

/* FIX: De "Bekijk details" balk staat los van de kaart
   — dit komt doordat st.columns een eigen wrapper maakt.
   We trekken het visueel dichterbij de kaart. */
[data-testid="stHorizontalBlock"] {
  gap: 0.5rem !important;
  background: transparent !important;
  padding: 0 !important;
  margin-top: -0.25rem !important;
  margin-bottom: 0.5rem !important;
}

/* ══════════════════════════════════════════════════════════════════════════
   6. INPUTS & FORMULIEREN
   ══════════════════════════════════════════════════════════════════════════ */
.stTextInput > div > div > input,
.stTextArea textarea {
  background: var(--vs-input-bg) !important;
  color: var(--vs-text) !important;
  border: 2px solid var(--vs-border) !important;
  border-radius: 8px !important;
  font-family: 'Inter', sans-serif !important;
  font-size: 0.92rem !important;
  transition: border-color 0.2s !important;
}
.stTextInput > div > div > input:focus {
  border-color: var(--vs-primary) !important;
  box-shadow: 0 0 0 3px rgba(0,108,228,0.12) !important;
  outline: none !important;
}
.stTextInput > div > div > input::placeholder,
.stTextArea textarea::placeholder {
  color: var(--vs-muted) !important;
  opacity: 0.8 !important;
}

.stSelectbox > div > div,
.stMultiSelect > div > div {
  background: var(--vs-input-bg) !important;
  border: 1.5px solid var(--vs-border) !important;
  border-radius: 8px !important;
  color: var(--vs-text) !important;
}

/* Checkbox */
.stCheckbox label {
  color: var(--vs-text) !important;
  font-size: 0.84rem !important;
  font-family: 'Inter', sans-serif !important;
}

/* Toggle */
[data-testid="stToggle"] label {
  color: var(--vs-text) !important;
  font-size: 0.84rem !important;
}

/* Slider */
.stSlider [data-baseweb="slider"] [role="slider"] {
  background: var(--vs-primary) !important;
}

/* Radio */
.stRadio label {
  color: var(--vs-text) !important;
  font-size: 0.84rem !important;
}

/* ══════════════════════════════════════════════════════════════════════════
   7. METRICS & ALERT BOXES
   ══════════════════════════════════════════════════════════════════════════ */
[data-testid="stMetric"] {
  background: var(--vs-card) !important;
  border: 1px solid var(--vs-border) !important;
  border-radius: 12px !important;
  padding: 1rem 1.2rem !important;
  box-shadow: var(--vs-shadow) !important;
}
[data-testid="stMetricValue"] div,
[data-testid="stMetricLabel"] span {
  color: var(--vs-text) !important;
  font-family: 'Inter', sans-serif !important;
}
[data-testid="stMetricValue"] div { font-weight: 700 !important; }

[data-testid="stAlert"] {
  background: var(--vs-card) !important;
  border-radius: 10px !important;
  border: 1px solid var(--vs-border) !important;
  color: var(--vs-text) !important;
}

/* Info box */
[data-testid="stAlert"][kind="info"] {
  border-left: 4px solid var(--vs-primary) !important;
}

/* ══════════════════════════════════════════════════════════════════════════
   8. TABS
   ══════════════════════════════════════════════════════════════════════════ */
.stTabs [data-baseweb="tab-list"] {
  gap: 2px !important;
  border-bottom: 2px solid var(--vs-border) !important;
  background: transparent !important;
}
.stTabs [data-baseweb="tab"] {
  font-family: 'Inter', sans-serif !important;
  font-weight: 500 !important;
  font-size: 0.87rem !important;
  color: var(--vs-muted) !important;
  padding: 0.55rem 1.1rem !important;
  border-radius: 6px 6px 0 0 !important;
  background: transparent !important;
}
.stTabs [aria-selected="true"] {
  color: var(--vs-primary) !important;
  border-bottom: 3px solid var(--vs-primary) !important;
  font-weight: 700 !important;
  background: transparent !important;
}
.stTabs [data-baseweb="tab-panel"] {
  background: transparent !important;
  padding-top: 1rem !important;
}

/* ══════════════════════════════════════════════════════════════════════════
   9. DATAFRAME / TABELLEN
   ══════════════════════════════════════════════════════════════════════════ */
[data-testid="stDataFrame"] {
  border-radius: 10px !important;
  overflow: hidden !important;
  border: 1px solid var(--vs-border) !important;
}
.dvn-scroller {
  background: var(--vs-card) !important;
}

/* ══════════════════════════════════════════════════════════════════════════
   10. PROGRESS BAR & SPINNER
   ══════════════════════════════════════════════════════════════════════════ */
[data-testid="stProgressBar"] > div > div {
  background: var(--vs-primary) !important;
  border-radius: 4px !important;
}
[data-testid="stProgressBar"] > div {
  background: var(--vs-border) !important;
  border-radius: 4px !important;
}
[data-testid="stSpinner"] p {
  color: var(--vs-muted) !important;
  font-family: 'Inter', sans-serif !important;
}

/* ══════════════════════════════════════════════════════════════════════════
   11. HERO & CUSTOM COMPONENTS (uit theme.py, dark-mode safe)
   ══════════════════════════════════════════════════════════════════════════ */
.vs-hero {
  background: linear-gradient(135deg, #003580 0%, #006CE4 70%, #0099EE 100%) !important;
  border-radius: 0 !important;
  padding: 3rem 2.5rem 3.5rem !important;
  position: relative !important;
  overflow: hidden !important;
  margin: -0.5rem -1.5rem 2rem !important;
}
.vs-hero-title {
  font-size: 2.6rem !important;
  color: white !important;
  font-family: 'DM Serif Display', Georgia, serif !important;
  line-height: 1.15 !important;
  margin: 0 0 0.5rem !important;
}
.vs-hero-sub { color: rgba(255,255,255,0.78) !important; font-size: 1rem !important; }
.vs-proof-badge {
  display: inline-flex !important;
  align-items: center !important;
  gap: 5px !important;
  background: rgba(255,255,255,0.12) !important;
  border: 1px solid rgba(255,255,255,0.22) !important;
  border-radius: 20px !important;
  padding: 4px 11px !important;
  font-size: 0.76rem !important;
  color: white !important;
  margin: 3px !important;
}

/* Stat cards */
.vs-stat-card {
  background: var(--vs-card) !important;
  border-radius: 14px !important;
  border: 1px solid var(--vs-border) !important;
  padding: 1.3rem 1.1rem !important;
  text-align: center !important;
  box-shadow: var(--vs-shadow) !important;
  transition: transform 0.18s, box-shadow 0.18s !important;
}
.vs-stat-card:hover {
  transform: translateY(-2px) !important;
  box-shadow: var(--vs-shadow-lg) !important;
}
.vs-stat-num {
  font-family: 'DM Serif Display', Georgia, serif !important;
  font-size: 2rem !important;
  color: var(--vs-primary) !important;
  margin-bottom: 4px !important;
  line-height: 1 !important;
}
.vs-stat-label {
  font-size: 0.77rem !important;
  color: var(--vs-muted) !important;
  font-weight: 500 !important;
}

/* GPS hero */
.vs-gps-hero {
  background: linear-gradient(135deg, #1B4F72, #2E86C1) !important;
  border-radius: 14px !important;
  padding: 2rem !important;
  text-align: center !important;
  margin-bottom: 1.5rem !important;
}

/* Result header */
.vs-results-header {
  display: flex !important;
  align-items: baseline !important;
  gap: 8px !important;
  margin-bottom: 0.8rem !important;
  padding-bottom: 0.6rem !important;
  border-bottom: 1px solid var(--vs-border) !important;
}
.vs-results-count {
  font-family: 'DM Serif Display', Georgia, serif !important;
  font-size: 1.3rem !important;
  color: var(--vs-text) !important;
}
.vs-results-sub { font-size: 0.8rem !important; color: var(--vs-muted) !important; }

/* AI tags */
.vs-ai-tag {
  display: inline-flex !important;
  align-items: center !important;
  gap: 4px !important;
  background: linear-gradient(90deg, #003580, #006CE4) !important;
  color: white !important;
  border-radius: 20px !important;
  padding: 3px 10px !important;
  font-size: 0.72rem !important;
  margin: 2px 3px 2px 0 !important;
  white-space: nowrap !important;
}

/* Detail hero */
.vs-detail-hero {
  background: linear-gradient(135deg, #003580, #006CE4) !important;
  border-radius: 12px !important;
  padding: 1.3rem 1.5rem !important;
  margin-bottom: 1rem !important;
}
.vs-detail-name {
  font-family: 'DM Serif Display', Georgia, serif !important;
  font-size: 1.6rem !important;
  color: white !important;
  margin: 0 0 4px !important;
}
.vs-detail-loc { font-size: 0.84rem !important; color: rgba(255,255,255,0.72) !important; }

/* Status dots (Beheer) */
.vs-status-dot {
  display: inline-block !important;
  width: 10px !important;
  height: 10px !important;
  border-radius: 50% !important;
  margin-right: 6px !important;
  flex-shrink: 0 !important;
}
.vs-status-dot.green { background: #27AE60 !important; box-shadow: 0 0 6px rgba(39,174,96,0.5) !important; }
.vs-status-dot.red   { background: #E74C3C !important; box-shadow: 0 0 6px rgba(231,76,60,0.5) !important; }
.vs-status-dot.gray  { background: #95A5A6 !important; }
.vs-status-row {
  display: flex !important;
  align-items: center !important;
  padding: 0.6rem 0.8rem !important;
  border-radius: 8px !important;
  background: var(--vs-bg) !important;
  border: 1px solid var(--vs-border) !important;
  font-size: 0.83rem !important;
  margin-bottom: 0.5rem !important;
  color: var(--vs-text) !important;
}

/* Drukte pills */
.vs-drukte-pill {
  display: inline-flex !important;
  align-items: center !important;
  gap: 4px !important;
  font-size: 0.71rem !important;
  font-weight: 600 !important;
  padding: 2px 8px !important;
  border-radius: 12px !important;
  white-space: nowrap !important;
}
.vs-drukte-vol  { background: #FFEBEE !important; color: #C62828 !important; border: 1px solid #FFCDD2 !important; }
.vs-drukte-druk { background: #FFF3E0 !important; color: #E65100 !important; border: 1px solid #FFE0B2 !important; }
.vs-drukte-plek { background: #E8F5E9 !important; color: #2E7D32 !important; border: 1px solid #C8E6C9 !important; }

/* Facility grid (detail dialog) */
.vs-facility-grid {
  display: grid !important;
  grid-template-columns: repeat(auto-fill, minmax(185px, 1fr)) !important;
  gap: 8px !important;
  margin: 0.8rem 0 !important;
}
.vs-facility-item {
  display: flex !important;
  align-items: center !important;
  gap: 8px !important;
  padding: 8px 12px !important;
  border-radius: 8px !important;
  background: var(--vs-bg) !important;
  border: 1px solid var(--vs-border) !important;
  font-size: 0.81rem !important;
  color: var(--vs-text) !important;
}
.vs-facility-item.ja  { background: #E8F5E9 !important; border-color: #C8E6C9 !important; color: #1B5E20 !important; }
.vs-facility-item.nee { background: var(--vs-bg) !important; color: var(--vs-muted) !important; text-decoration: line-through !important; }

/* Sidebar filter section titles */
.vs-filter-section { padding: 0.6rem 0.9rem 0.3rem !important; }
.vs-filter-title {
  font-size: 0.72rem !important;
  font-weight: 700 !important;
  color: var(--vs-muted) !important;
  text-transform: uppercase !important;
  letter-spacing: 0.08em !important;
  margin-bottom: 0.4rem !important;
  display: block !important;
}

/* Sidebar logo block */
.vs-sidebar-logo {
  background: linear-gradient(150deg, #003580 0%, #006CE4 100%) !important;
  padding: 1.3rem 1rem 1.1rem !important;
  text-align: center !important;
}
.vs-sidebar-logo-title {
  font-family: 'DM Serif Display', Georgia, serif !important;
  font-size: 1.45rem !important;
  color: white !important;
  margin: 6px 0 2px !important;
}
.vs-sidebar-logo-sub {
  font-size: 0.67rem !important;
  color: rgba(255,255,255,0.58) !important;
  font-style: italic !important;
}

/* Trip cards (reisplanner) */
.vs-trip-card {
  background: var(--vs-card) !important;
  border-radius: 10px !important;
  border: 1px solid var(--vs-border) !important;
  padding: 0.9rem !important;
  margin-bottom: 0.6rem !important;
  box-shadow: var(--vs-shadow) !important;
}

/* Airbnb price marker */
.vs-map-price-marker {
  background: white !important;
  border: 2px solid #333 !important;
  border-radius: 20px !important;
  padding: 3px 8px !important;
  font-size: 0.77rem !important;
  font-weight: 700 !important;
  color: #1A1A1A !important;
  box-shadow: 0 2px 6px rgba(0,0,0,0.18) !important;
  white-space: nowrap !important;
}
.vs-map-price-marker.gratis {
  background: #E8F5E9 !important;
  border-color: #2E7D32 !important;
  color: #1B5E20 !important;
}

/* No results */
.vs-no-results {
  text-align: center !important;
  padding: 5rem 2rem !important;
  color: var(--vs-muted) !important;
}
.vs-no-results-icon { font-size: 3.5rem !important; margin-bottom: 1rem !important; }

/* Searchbar wrap (zoekpagina) */
.vs-searchbar-wrap {
  background: #003580 !important;
  padding: 1.2rem 1.5rem 1.6rem !important;
  border-radius: 0 0 14px 14px !important;
  margin: -0.5rem -1.5rem 1.5rem !important;
}

/* Report box (crowdsource) */
.vs-report-box {
  background: var(--vs-bg) !important;
  border: 1px dashed var(--vs-border) !important;
  border-radius: 10px !important;
  padding: 1rem 1.2rem !important;
  margin-top: 1rem !important;
}
.vs-report-title {
  font-size: 0.8rem !important;
  font-weight: 600 !important;
  color: var(--vs-muted) !important;
  margin-bottom: 0.5rem !important;
}

/* ══════════════════════════════════════════════════════════════════════════
   12. RESPONSIVE (mobiel)
   ══════════════════════════════════════════════════════════════════════════ */
@media (max-width: 900px) {
  .vs-card-img-col { width: 130px !important; min-width: 130px !important; }
  .vs-card-price-col { width: 130px !important; min-width: 120px !important; }
  .vs-hero-title { font-size: 1.8rem !important; }
  .block-container { padding-left: 0.8rem !important; padding-right: 0.8rem !important; }
}
@media (max-width: 600px) {
  .vs-result-card { flex-direction: column !important; }
  .vs-card-img-col { width: 100% !important; min-width: 100% !important; height: 170px !important; }
  .vs-card-price-col {
    width: 100% !important;
    min-width: 100% !important;
    border-left: none !important;
    border-top: 1px solid var(--vs-border) !important;
  }
  .vs-hero { padding: 2rem 1rem 2.5rem !important; margin: -0.5rem -0.8rem 1.5rem !important; }
}

/* ══════════════════════════════════════════════════════════════════════════
   13. DIVIDER & HR
   ══════════════════════════════════════════════════════════════════════════ */
hr {
  border: none !important;
  border-top: 1px solid var(--vs-border) !important;
  margin: 1.2rem 0 !important;
}
[data-testid="stDivider"] {
  border-top: 1px solid var(--vs-border) !important;
}
</style>
""", unsafe_allow_html=True)
