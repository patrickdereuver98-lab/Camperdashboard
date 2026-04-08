"""
pages/3_🗺️_Reisplanner.py — VrijStaan v5 Reisplanner.
Plan je route langs favoriete camperplaatsen met budgetberekening.
Pijler 1: Nieuwe pagina. Pijler 8: Kaartroute + budget carte blanche.
"""
from __future__ import annotations

import json
from math import radians, cos, sin, asin, sqrt

import folium
import pandas as pd
import streamlit as st
import streamlit.components.v1 as components

from ui.theme import apply_theme, render_sidebar_header, BRAND_PRIMARY, BRAND_DARK, BORDER, TEXT_MUTED
from utils.data_handler import load_data
from utils.favorites import get_favorites, init_favorites, toggle_favorite
from utils.helpers import clean_val, safe_html, safe_float

st.set_page_config(
    page_title="VrijStaan | Reisplanner",
    page_icon="🗺️",
    layout="wide",
    initial_sidebar_state="expanded",
)
apply_theme()
render_sidebar_header()
init_favorites()


# ── DATA ───────────────────────────────────────────────────────────────────────

@st.cache_data(ttl=300, show_spinner=False)
def _load() -> pd.DataFrame:
    return load_data()

df = _load()
favorieten = get_favorites()


# ── HAVERSINE ──────────────────────────────────────────────────────────────────

def _haversine(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    R = 6371.0
    lat1, lon1, lat2, lon2 = map(radians, [lat1, lon1, lat2, lon2])
    a = sin((lat2 - lat1) / 2) ** 2 + cos(lat1) * cos(lat2) * sin((lon2 - lon1) / 2) ** 2
    return R * 2 * asin(sqrt(a))


def _prijs_per_nacht(prijs_raw: object) -> float:
    """Schat prijs per nacht uit tekst. Gratis = 0, onbekend = 15."""
    p = clean_val(prijs_raw, "").lower()
    if p == "gratis":
        return 0.0
    if p in ("onbekend", ""):
        return 15.0  # redelijk gemiddelde voor Nederland
    # Probeer eerste getal te extraheren
    import re
    m = re.search(r"(\d+(?:[.,]\d+)?)", p)
    if m:
        return float(m.group(1).replace(",", "."))
    return 15.0


# ── HEADER ─────────────────────────────────────────────────────────────────────

st.markdown(f"""
<div style="background:linear-gradient(135deg,{BRAND_DARK},{BRAND_PRIMARY});
border-radius:14px;padding:1.8rem 2rem;margin-bottom:1.5rem;">
  <div style="font-family:'DM Serif Display',serif;font-size:1.8rem;color:white;
margin-bottom:4px;">🗺️ Reisplanner</div>
  <div style="color:rgba(255,255,255,0.72);font-size:0.9rem;">
    Plan je route langs je favoriete camperplaatsen en bereken je budget.
  </div>
</div>
""", unsafe_allow_html=True)

if not favorieten:
    st.info("""
**Geen favorieten opgeslagen.**

Zoek camperplaatsen op de **Zoekpagina** en voeg ze toe via het ❤️-icoon.
Je kunt dan hier je route plannen!
    """)
    if st.button("🔍 Ga naar Zoeken", type="primary"):
        st.switch_page("pages/1_🔍_Zoeken.py")
    st.stop()


# ── FAVORIETEN LADEN ───────────────────────────────────────────────────────────

# Haal DataFrame rijen op voor de favorieten
fav_df = df[df["naam"].isin(favorieten)].copy() if not df.empty else pd.DataFrame()

if fav_df.empty:
    st.warning("Je favorieten zijn niet gevonden in de database. Mogelijk is de data bijgewerkt.")
    if st.button("🔄 Database vernieuwen"):
        st.cache_data.clear()
        st.rerun()
    st.stop()


# ── REISPLANNER LAYOUT ─────────────────────────────────────────────────────────

plan_col, info_col = st.columns([1.5, 1])

with plan_col:
    st.markdown(f"""<div style="font-family:'DM Serif Display',serif;font-size:1.2rem;
color:var(--vs-text);margin-bottom:0.8rem;">📋 Jouw reislijst ({len(fav_df)} plekken)</div>""",
        unsafe_allow_html=True)

    # Sorteerbare lijst van favorieten
    ordered_names = []
    for i, (idx, row) in enumerate(fav_df.iterrows()):
        naam     = clean_val(row.get("naam"), "Onbekend")
        prov     = clean_val(row.get("provincie"), "?")
        prijs    = clean_val(row.get("prijs"), "Onbekend")
        nights   = 1  # default

        st.markdown(f"""
<div class="vs-trip-card">
  <div style="display:flex;align-items:center;justify-content:space-between;
margin-bottom:6px;">
    <div>
      <div style="font-weight:600;font-size:0.9rem;">{safe_html(naam)}</div>
      <div style="font-size:0.75rem;color:{TEXT_MUTED};">📍 {safe_html(prov)}</div>
    </div>
    <div style="font-size:0.85rem;font-weight:600;color:{BRAND_PRIMARY};">{safe_html(prijs)}</div>
  </div>
</div>""", unsafe_allow_html=True)

        trip_col1, trip_col2, trip_col3 = st.columns([2, 1, 1])
        with trip_col1:
            nights_key = f"nights_{idx}"
            if nights_key not in st.session_state:
                st.session_state[nights_key] = 1
            nights = st.number_input(
                "Nachten",
                min_value=1, max_value=30,
                value=st.session_state[nights_key],
                key=f"n_{idx}",
                label_visibility="collapsed",
            )
            st.session_state[nights_key] = nights
        with trip_col2:
            st.caption(f"× {nights} nacht")
        with trip_col3:
            if st.button("🗑️", key=f"rm_{idx}", help="Verwijder uit favorieten"):
                toggle_favorite(naam)
                st.rerun()

        ordered_names.append({
            "naam":   naam,
            "prov":   prov,
            "prijs":  prijs,
            "nights": nights,
            "row":    row,
        })


with info_col:
    # ── BUDGET CALCULATOR ──────────────────────────────────────────────
    st.markdown(f"""<div style="font-family:'DM Serif Display',serif;font-size:1.2rem;
color:var(--vs-text);margin-bottom:0.8rem;">💶 Budget overzicht</div>""",
        unsafe_allow_html=True)

    # Brandstof instellingen
    with st.expander("⛽ Brandstofkosten", expanded=True):
        fuel_col1, fuel_col2 = st.columns(2)
        with fuel_col1:
            verbruik = st.number_input("Verbruik (L/100km)", 8.0, 25.0, 12.0, 0.5)
        with fuel_col2:
            prijs_liter = st.number_input("Prijs per liter (€)", 1.50, 3.00, 2.05, 0.05)

    # Totale afstand berekenen (volgorde van favorieten)
    totale_km = 0.0
    route_items = ordered_names
    if len(route_items) >= 2:
        for j in range(len(route_items) - 1):
            r1 = route_items[j]["row"]
            r2 = route_items[j + 1]["row"]
            try:
                lat1 = float(str(r1.get("latitude", 0)).replace(",", "."))
                lon1 = float(str(r1.get("longitude", 0)).replace(",", "."))
                lat2 = float(str(r2.get("latitude", 0)).replace(",", "."))
                lon2 = float(str(r2.get("longitude", 0)).replace(",", "."))
                totale_km += _haversine(lat1, lon1, lat2, lon2)
            except (ValueError, TypeError):
                pass

    # Budget items
    totale_nachten = sum(item["nights"] for item in ordered_names)
    verblijf_kosten = sum(
        _prijs_per_nacht(item["prijs"]) * item["nights"]
        for item in ordered_names
    )
    brandstof_kosten = (totale_km / 100) * verbruik * prijs_liter

    totaal = verblijf_kosten + brandstof_kosten

    st.markdown(f"""
<div style="background:var(--vs-bg);border:1px solid {BORDER};border-radius:10px;
padding:1rem;margin-bottom:0.8rem;">
  <div style="display:flex;justify-content:space-between;margin-bottom:6px;">
    <span style="font-size:0.84rem;">🏕️ Verblijf ({totale_nachten} nachten)</span>
    <span style="font-weight:600;">€{verblijf_kosten:.0f}</span>
  </div>
  <div style="display:flex;justify-content:space-between;margin-bottom:6px;">
    <span style="font-size:0.84rem;">⛽ Brandstof (~{totale_km:.0f} km)</span>
    <span style="font-weight:600;">€{brandstof_kosten:.0f}</span>
  </div>
  <hr style="border-color:{BORDER};margin:8px 0;">
  <div style="display:flex;justify-content:space-between;">
    <span style="font-size:0.95rem;font-weight:700;">Totaal geschat</span>
    <span style="font-size:1.1rem;font-weight:700;color:{BRAND_PRIMARY};">€{totaal:.0f}</span>
  </div>
  <div style="font-size:0.7rem;color:{TEXT_MUTED};margin-top:4px;">
    * Verblijfsprijzen zijn schattingen. Controleer altijd ter plekke.
  </div>
</div>
""", unsafe_allow_html=True)

    # Reisstatistieken
    totale_dagen = totale_nachten
    st.metric("📅 Totaal reisdagen", f"{totale_dagen} nachten")
    st.metric("🛣️ Geschatte afstand", f"{totale_km:.0f} km", help="Hemelsbreed via waypoints")
    st.metric("💰 Budget per dag", f"€{totaal/max(totale_dagen,1):.0f}")


# ── ROUTEKAART ─────────────────────────────────────────────────────────────────

st.markdown("---")
st.markdown(f"""<div style="font-family:'DM Serif Display',serif;font-size:1.2rem;
color:var(--vs-text);margin-bottom:0.8rem;">🗺️ Routekaart</div>""",
    unsafe_allow_html=True)

if len(fav_df) >= 1:
    try:
        valid = []
        for item in ordered_names:
            row = item["row"]
            try:
                lat = float(str(row.get("latitude", "")).replace(",", "."))
                lon = float(str(row.get("longitude", "")).replace(",", "."))
                valid.append((item["naam"], lat, lon, item["prijs"]))
            except (ValueError, TypeError):
                continue

        if valid:
            center = [sum(v[1] for v in valid) / len(valid), sum(v[2] for v in valid) / len(valid)]
            zoom   = 7 if len(valid) > 3 else 9

            m = folium.Map(location=center, zoom_start=zoom, tiles="CartoDB Positron")

            for i, (naam, lat, lon, prijs) in enumerate(valid):
                prijs_label = "Gratis" if "gratis" in str(prijs).lower() else clean_val(prijs, "?")
                folium.Marker(
                    [lat, lon],
                    popup=folium.Popup(
                        f"<b>{safe_html(naam)}</b><br>Stop {i+1} · {safe_html(prijs_label)}",
                        max_width=180,
                    ),
                    tooltip=f"{i+1}. {naam}",
                    icon=folium.DivIcon(
                        html=f"""<div style="background:#003580;color:white;
border-radius:50%;width:24px;height:24px;display:flex;align-items:center;
justify-content:center;font-weight:700;font-size:11px;
box-shadow:0 2px 5px rgba(0,0,0,0.3);">{i+1}</div>""",
                        icon_size=(24, 24),
                        icon_anchor=(12, 12),
                    ),
                ).add_to(m)

            # Teken route als lijnen
            if len(valid) >= 2:
                coords = [[lat, lon] for _, lat, lon, _ in valid]
                folium.PolyLine(
                    coords,
                    color=BRAND_PRIMARY,
                    weight=3,
                    opacity=0.7,
                    dash_array="8,6",
                ).add_to(m)

            components.html(m._repr_html_(), height=420)
        else:
            st.info("Geen locaties met geldige coördinaten in je reislijst.")

    except Exception as e:
        st.error(f"Fout bij kaartrendering: {e}")
else:
    st.info("Voeg minstens één favoriet toe om de routekaart te zien.")


# ── EXPORT ─────────────────────────────────────────────────────────────────────
st.markdown("---")
if ordered_names:
    export_data = [
        {
            "stop": i + 1,
            "naam": item["naam"],
            "provincie": item["prov"],
            "prijs": item["prijs"],
            "nachten": item["nights"],
            "budget": f"€{_prijs_per_nacht(item['prijs']) * item['nights']:.0f}",
        }
        for i, item in enumerate(ordered_names)
    ]
    export_df  = pd.DataFrame(export_data)
    csv_bytes  = export_df.to_csv(index=False).encode("utf-8")
    st.download_button(
        "📥 Download reisplan als CSV",
        data=csv_bytes,
        file_name="vrijstaan_reisplan.csv",
        mime="text/csv",
        type="secondary",
    )
