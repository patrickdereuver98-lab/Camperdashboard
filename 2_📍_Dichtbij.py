"""
pages/2_📍_Dichtbij.py — "Near Me" GPS pagina voor VrijStaan v5.
Pijler 4: HTML/JS GPS-hack voor coördinaten, Haversine-afstand, radius-lijst.

Architectuur:
  - HTML/JS component haalt navigator.geolocation op
  - JavaScript stuurt coördinaten terug via query_params
  - Python berekent Haversine-afstand en sorteert
  - Resultaten tonen via render_result_card()
"""
from __future__ import annotations

import pandas as pd
import streamlit as st
import streamlit.components.v1 as components

from ui.theme import (
    apply_theme, render_sidebar_header,
    P_BLUE, P_DARK, TEXT_MUTE, BORDER, BG_CARD,
)
from ui.components import render_result_card, render_no_results
from ui.map_view import render_map_section
from utils.data_handler import load_data
from utils.favorites import init_favorites
from utils.helpers import add_distances, safe_float

# ── PAGINA CONFIG ──────────────────────────────────────────────────────────────
st.set_page_config(
    page_title="VrijStaan | Dichtbij mij",
    page_icon="📍",
    layout="wide",
    initial_sidebar_state="expanded",
)
apply_theme()
render_sidebar_header()
init_favorites()

# ── SESSION STATE ──────────────────────────────────────────────────────────────
for k, v in {
    "gps_lat": None, "gps_lon": None, "gps_error": None,
    "show_map": False,
}.items():
    if k not in st.session_state:
        st.session_state[k] = v

# ── DATA LADEN ─────────────────────────────────────────────────────────────────
@st.cache_data(ttl=300, show_spinner=False)
def _load() -> pd.DataFrame:
    return load_data()

with st.spinner("📡 Locaties laden…"):
    df = _load()

if df.empty:
    st.warning("⚠️ Geen data gevonden. Ga naar Beheer.")
    st.stop()

# ── PAGINA HEADER ──────────────────────────────────────────────────────────────
st.markdown(f"""
<div style="background:linear-gradient(145deg,{P_DARK} 0%,{P_BLUE} 100%);
padding:1.8rem 2rem 2.2rem;margin-bottom:1.2rem;">
  <div style="font-family:'Syne',sans-serif;font-size:1.55rem;font-weight:800;
color:white;margin-bottom:0.2rem;">📍 Camperplaatsen dichtbij</div>
  <div style="color:rgba(255,255,255,0.7);font-size:0.9rem;">
    Vind de dichtstbijzijnde plekken op basis van jouw huidige locatie.
  </div>
</div>
""", unsafe_allow_html=True)

# ── GPS JAVASCRIPT HACK (Pijler 4) ─────────────────────────────────────────────
# Streamlit heeft geen native GPS-support. We gebruiken een HTML/JS component
# dat navigator.geolocation aanroept en de coördinaten via query_params teruggeeft.

GPS_JS = """
<div id="gps-container" style="text-align:center;padding:1.5rem;">
  <div id="gps-status" style="font-family:'Plus Jakarta Sans',sans-serif;
    font-size:0.9rem;color:#6B7897;margin-bottom:1rem;">
    📍 Klik op de knop om jouw locatie te delen...
  </div>
  <button onclick="getLocation()" style="
    background:#006CE4;color:white;border:none;
    border-radius:10px;padding:0.75rem 2rem;
    font-size:1rem;font-weight:700;cursor:pointer;
    font-family:'Plus Jakarta Sans',sans-serif;
    box-shadow:0 3px 10px rgba(0,108,228,0.28);
  ">📍 Deel mijn locatie</button>
  <div id="gps-result" style="margin-top:1rem;font-size:0.85rem;color:#6B7897;"></div>
</div>

<script>
function getLocation() {
  var status = document.getElementById('gps-status');
  var result = document.getElementById('gps-result');
  status.innerHTML = '⏳ Locatie ophalen...';

  if (!navigator.geolocation) {
    status.innerHTML = '❌ Jouw browser ondersteunt geen GPS.';
    return;
  }

  navigator.geolocation.getCurrentPosition(
    function(pos) {
      var lat = pos.coords.latitude.toFixed(6);
      var lon = pos.coords.longitude.toFixed(6);
      status.innerHTML = '✅ Locatie gevonden! Kaart wordt geladen...';
      result.innerHTML = '📍 Lat: ' + lat + ' · Lon: ' + lon;
      // Stuur naar Streamlit via URL query params
      var url = new URL(window.parent.location.href);
      url.searchParams.set('gps_lat', lat);
      url.searchParams.set('gps_lon', lon);
      window.parent.location.href = url.toString();
    },
    function(err) {
      var msg = {
        1: 'Locatiepermissie geweigerd. Sta GPS toe in de browserinstellingen.',
        2: 'Locatie kon niet worden bepaald.',
        3: 'Tijdslimiet overschreden. Probeer opnieuw.',
      }[err.code] || 'Onbekende GPS-fout.';
      status.innerHTML = '❌ ' + msg;
    },
    { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
  );
}
</script>
"""

# ── GPS COÖRDINATEN LEZEN ─────────────────────────────────────────────────────
# Controleer of GPS via query_params is binnengekomen
params = st.query_params
gps_lat_param = params.get("gps_lat", "")
gps_lon_param = params.get("gps_lon", "")

if gps_lat_param and gps_lon_param:
    try:
        st.session_state["gps_lat"] = float(gps_lat_param)
        st.session_state["gps_lon"] = float(gps_lon_param)
        # Verwijder params zodat reload clean is
        st.query_params.clear()
    except (ValueError, TypeError):
        st.session_state["gps_error"] = "Ongeldige GPS-coördinaten ontvangen."

# ── RADIUS INSTELLING ─────────────────────────────────────────────────────────
col_rad, col_sort, _ = st.columns([1.5, 1.5, 4])
with col_rad:
    radius_km = st.select_slider(
        "Zoekradius",
        options=[5, 10, 15, 20, 30, 50, 75, 100],
        value=25,
        format_func=lambda x: f"{x} km",
    )
with col_sort:
    sort_near = st.selectbox(
        "Sorteren op",
        ["Dichtstbij", "Beoordeling ↓", "Prijs (gratis eerst)"],
        label_visibility="visible",
    )

# ── LOCATIE WEERGAVE ──────────────────────────────────────────────────────────
if st.session_state["gps_lat"] is None:
    # Nog geen GPS → toon de JS component
    st.markdown(f"""
<div style="background:{BG_CARD};border:1px solid {BORDER};border-radius:14px;
padding:1rem;margin-bottom:1rem;">
""", unsafe_allow_html=True)
    components.html(GPS_JS, height=200)
    st.markdown("</div>", unsafe_allow_html=True)

    st.info(
        "💡 **Privacytip:** Jouw GPS-locatie wordt uitsluitend in jouw browser gebruikt "
        "en nooit opgeslagen op onze servers."
    )

    # Handmatig invoeren als alternatief
    with st.expander("📍 Of typ handmatig een locatie", expanded=False):
        manual = st.text_input(
            "Stad of postcode",
            placeholder="Bijv. Amsterdam, Zeeland, 4501 AB…",
        )
        if st.button("🔍 Zoek op locatie") and manual.strip():
            from utils.geo_logic import geocode_location
            coords = geocode_location(manual.strip())
            if coords:
                st.session_state["gps_lat"] = coords[0]
                st.session_state["gps_lon"] = coords[1]
                st.rerun()
            else:
                st.error(f"'{manual}' niet gevonden. Probeer een andere naam.")

elif st.session_state.get("gps_error"):
    st.error(f"GPS-fout: {st.session_state['gps_error']}")
    if st.button("🔄 Opnieuw proberen"):
        st.session_state["gps_lat"] = None
        st.session_state["gps_error"] = None
        st.rerun()

else:
    # ── GPS beschikbaar: bereken afstanden ──────────────────────────
    user_lat = st.session_state["gps_lat"]
    user_lon = st.session_state["gps_lon"]

    st.success(
        f"📍 Jouw locatie: {user_lat:.4f}°N, {user_lon:.4f}°O — "
        f"zoekradius {radius_km} km"
    )
    if st.button("🔄 Locatie vergeten", type="secondary"):
        st.session_state["gps_lat"] = None
        st.session_state["gps_lon"] = None
        st.rerun()

    # Voeg afstanden toe en filter op radius
    df_dist = add_distances(df, user_lat, user_lon)
    df_near = df_dist[df_dist["afstand_km"] <= radius_km].copy()

    # Sorteren
    if sort_near == "Beoordeling ↓":
        df_near["_s"] = pd.to_numeric(
            df_near["beoordeling"].astype(str).str.replace(",", ".").str.split("/").str[0],
            errors="coerce"
        )
        df_near = df_near.sort_values("_s", ascending=False).drop(columns=["_s"])
    elif sort_near == "Prijs (gratis eerst)":
        df_near["_g"] = df_near["prijs"].astype(str).str.lower().str.contains("gratis", na=False)
        df_near = df_near.sort_values(["_g", "afstand_km"], ascending=[False, True]).drop(columns=["_g"])
    # else: al gesorteerd op afstand_km

    st.markdown(f"""
<div class="vs-results-header">
  <div class="vs-results-count">{len(df_near)} camperplaatsen binnen {radius_km} km</div>
  <div class="vs-results-sub">gesorteerd op {sort_near.lower()}</div>
</div>
""", unsafe_allow_html=True)

    # Kaart toggle
    toon_kaart = st.toggle("🗺️ Toon op kaart", value=False)
    if toon_kaart and not df_near.empty:
        render_map_section(df_near, height=420)

    # Lijst
    if df_near.empty:
        render_no_results()
        st.info(
            f"Geen camperplaatsen binnen {radius_km} km gevonden. "
            f"Vergroot de zoekradius of kies een andere locatie."
        )
    else:
        for idx, row in df_near.head(100).iterrows():
            render_result_card(row, f"near_{idx}")

    if len(df_near) > 100:
        st.markdown(
            f"<p style='text-align:center;color:{TEXT_MUTE};font-size:0.8rem;'>"
            f"Top 100 van {len(df_near)} getoond.</p>",
            unsafe_allow_html=True,
        )
