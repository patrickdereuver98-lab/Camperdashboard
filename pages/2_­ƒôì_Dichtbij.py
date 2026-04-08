"""
pages/2_📍_Dichtbij.py — VrijStaan v5 "Near Me" GPS Pagina.
Pijler 4: HTML/JS hack voor GPS-coördinaten + Haversine afstandsberekening.
"""
from __future__ import annotations

import json
from math import radians, cos, sin, asin, sqrt

import pandas as pd
import streamlit as st
import streamlit.components.v1 as components

from ui.theme import apply_theme, render_sidebar_header, BRAND_PRIMARY, BRAND_DARK, BORDER, TEXT_MUTED
from ui.components import render_result_card, render_no_results
from ui.map_view import render_map_section
from utils.data_handler import load_data
from utils.favorites import init_favorites
from utils.helpers import clean_val, safe_html

st.set_page_config(
    page_title="VrijStaan | Dichtbij mij",
    page_icon="📍",
    layout="wide",
    initial_sidebar_state="expanded",
)
apply_theme()
render_sidebar_header()
init_favorites()


# ── HAVERSINE AFSTANDSFUNCTIE ──────────────────────────────────────────────────

def haversine(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Berekent afstand in km tussen twee GPS-coördinaten."""
    R = 6371.0
    lat1, lon1, lat2, lon2 = map(radians, [lat1, lon1, lat2, lon2])
    a = sin((lat2 - lat1) / 2) ** 2 + cos(lat1) * cos(lat2) * sin((lon2 - lon1) / 2) ** 2
    return R * 2 * asin(sqrt(a))


# ── DATA LADEN ─────────────────────────────────────────────────────────────────

@st.cache_data(ttl=300, show_spinner=False)
def _load() -> pd.DataFrame:
    return load_data()

with st.spinner("📡 Locaties laden…"):
    df = _load()

if df.empty:
    st.warning("⚠️ Geen data beschikbaar. Ga naar Beheer om de database te vullen.")
    st.stop()


# ── HERO ───────────────────────────────────────────────────────────────────────
st.markdown(f"""
<div class="vs-gps-hero">
  <div style="font-size:2.5rem;margin-bottom:0.5rem;">📍</div>
  <div style="font-family:'DM Serif Display',serif;font-size:1.8rem;color:white;
margin-bottom:0.4rem;">Camperplaatsen dichtbij jou</div>
  <div style="color:rgba(255,255,255,0.72);font-size:0.92rem;">
    We gebruiken je GPS-locatie om de dichtstbijzijnde plekken te vinden.
    Je locatie wordt <strong style="color:white;">niet opgeslagen</strong>.
  </div>
</div>
""", unsafe_allow_html=True)


# ── GPS HACK (Pijler 4) ────────────────────────────────────────────────────────
# HTML/JS geolocation API → schrijft coördinaten naar een verborgen Streamlit text field
# We gebruiken een unieke session key om de coördinaten te communiceren.

GPS_KEY = "vs_gps_coords"

if GPS_KEY not in st.session_state:
    st.session_state[GPS_KEY] = ""

# Injecteer JS die de GPS-locatie opvraagt en injecteert via postMessage
gps_html = """
<div id="gps-status" style="font-family:Inter,sans-serif;font-size:0.85rem;
color:#6B7897;margin-bottom:12px;min-height:24px;"></div>
<button onclick="getGPS()" style="
  background:#006CE4;color:white;border:none;border-radius:8px;
  padding:10px 22px;font-size:0.9rem;font-weight:600;cursor:pointer;
  font-family:Inter,sans-serif;box-shadow:0 2px 8px rgba(0,108,228,0.3);">
  📍 Gebruik mijn locatie
</button>

<script>
function getGPS() {
  var status = document.getElementById('gps-status');
  status.textContent = '⏳ Locatie ophalen...';
  if (!navigator.geolocation) {
    status.textContent = '❌ GPS niet beschikbaar in deze browser.';
    return;
  }
  navigator.geolocation.getCurrentPosition(
    function(pos) {
      var lat = pos.coords.latitude.toFixed(6);
      var lon = pos.coords.longitude.toFixed(6);
      status.textContent = '✅ Locatie gevonden: ' + lat + ', ' + lon;
      // Stuur via postMessage naar Streamlit parent
      window.parent.postMessage({
        type: 'streamlit:setComponentValue',
        value: lat + ',' + lon
      }, '*');
    },
    function(err) {
      var msgs = {
        1: 'Toegang geweigerd. Sta locatietoegang toe in je browser.',
        2: 'Locatie onbeschikbaar (geen GPS-signaal).',
        3: 'Timeout: locatie opvragen duurde te lang.'
      };
      document.getElementById('gps-status').textContent =
        '❌ ' + (msgs[err.code] || 'Onbekende fout: ' + err.message);
    },
    {timeout: 10000, maximumAge: 60000}
  );
}
</script>
"""

# Render GPS component
gps_result = components.html(gps_html, height=100)

# Alternatief: handmatige coördinaten invoer als GPS faalt
st.markdown("---")
st.markdown(f"<span style='font-size:0.82rem;color:{TEXT_MUTED};'>Of voer handmatig je locatie in:</span>",
            unsafe_allow_html=True)

manual_col1, manual_col2 = st.columns(2)
with manual_col1:
    lat_input = st.text_input("Breedtegraad (lat)", placeholder="52.3784", label_visibility="visible")
with manual_col2:
    lon_input = st.text_input("Lengtegraad (lon)", placeholder="4.9009", label_visibility="visible")

# Radius slider
radius_km = st.slider("🔭 Zoekradius", min_value=5, max_value=100, value=25, step=5,
                       format="%d km")

# GPS coördinaten bepalen
user_lat: float | None = None
user_lon: float | None = None

# Probeer handmatige invoer eerst
if lat_input and lon_input:
    try:
        user_lat = float(lat_input.replace(",", "."))
        user_lon = float(lon_input.replace(",", "."))
    except ValueError:
        st.error("❌ Ongeldige coördinaten. Gebruik decimale notatie (bijv. 52.3784).")

# Probeer GPS session state (als postMessage werkt)
if user_lat is None and st.session_state.get(GPS_KEY):
    try:
        parts = st.session_state[GPS_KEY].split(",")
        user_lat = float(parts[0])
        user_lon = float(parts[1])
    except Exception:
        pass

# Populaire startpunten als snelkeuze
st.markdown(f"<span style='font-size:0.82rem;color:{TEXT_MUTED};'>Of kies een startpunt:</span>",
            unsafe_allow_html=True)
sp_cols = st.columns(4)
STARTPUNTEN = [
    ("Amsterdam", 52.3676, 4.9041),
    ("Utrecht",   52.0907, 5.1214),
    ("Rotterdam", 51.9225, 4.4792),
    ("Zwolle",    52.5168, 6.0830),
]
for col, (naam, slat, slon) in zip(sp_cols, STARTPUNTEN):
    with col:
        if st.button(f"📍 {naam}", use_container_width=True, type="secondary"):
            user_lat, user_lon = slat, slon

st.markdown("---")

# ── RESULTATEN ─────────────────────────────────────────────────────────────────

if user_lat is None or user_lon is None:
    st.info("📍 Gebruik de GPS-knop of voer coördinaten in om locaties in de buurt te vinden.")
else:
    st.markdown(f"""
<div style="background:var(--vs-card);border:1px solid {BORDER};border-radius:10px;
padding:0.8rem 1rem;margin-bottom:1rem;display:flex;align-items:center;gap:10px;">
  <span style="font-size:1.3rem;">📍</span>
  <div>
    <div style="font-weight:600;font-size:0.88rem;">Jouw locatie</div>
    <div style="font-size:0.78rem;color:{TEXT_MUTED};">{user_lat:.4f}°N, {user_lon:.4f}°E · Radius: {radius_km} km</div>
  </div>
</div>
""", unsafe_allow_html=True)

    # Afstand berekenen voor alle locaties
    dichtbij_df = df.copy()
    afstanden = []
    for _, row in dichtbij_df.iterrows():
        try:
            rlat = float(str(row.get("latitude", "")).replace(",", "."))
            rlon = float(str(row.get("longitude", "")).replace(",", "."))
            afst = haversine(user_lat, user_lon, rlat, rlon)
            afstanden.append(afst)
        except (ValueError, TypeError):
            afstanden.append(9999.0)

    dichtbij_df["afstand_km"]   = afstanden
    dichtbij_df["afstand_label"] = dichtbij_df["afstand_km"].apply(
        lambda x: f"{x:.1f} km" if x < 9999 else "?"
    )

    # Filter op radius
    dichtbij_df = dichtbij_df[dichtbij_df["afstand_km"] <= radius_km].sort_values("afstand_km")

    st.markdown(f"""
<div class="vs-results-header">
  <div class="vs-results-count">{len(dichtbij_df):,} plekken binnen {radius_km} km</div>
  <div class="vs-results-sub">gesorteerd op afstand</div>
</div>
""", unsafe_allow_html=True)

    if dichtbij_df.empty:
        render_no_results()
        st.info(f"💡 Vergroot de zoekradius (nu {radius_km} km) om meer resultaten te zien.")
    else:
        # Kaart tonen
        toon_kaart = st.toggle("🗺️ Toon op kaart", value=False)
        if toon_kaart:
            render_map_section(dichtbij_df.head(100), height=420)

        for idx, row in dichtbij_df.head(50).iterrows():
            render_result_card(row, idx)

        if len(dichtbij_df) > 50:
            st.markdown(
                f"<p style='text-align:center;color:{TEXT_MUTED};font-size:0.78rem;'>"
                f"Top 50 van {len(dichtbij_df)} plekken getoond.</p>",
                unsafe_allow_html=True,
            )
