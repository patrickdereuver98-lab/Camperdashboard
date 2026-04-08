"""
ui/map_view.py — VrijStaan v5 Kaartcomponent.
Pijler 3: Airbnb-stijl witte prijs-markers op de kaart.
"""
from __future__ import annotations

import folium
import pandas as pd
import streamlit as st
import streamlit.components.v1 as components

from ui.theme import BRAND_PRIMARY, BRAND_DARK, BORDER
from utils.helpers import clean_val, safe_html, is_ja


def _price_marker_html(prijs: str) -> str:
    """Airbnb-stijl witte prijs-label voor op de kaart."""
    p = str(prijs).strip()
    is_gratis = "gratis" in p.lower()
    cls = "gratis" if is_gratis else ""
    label = "Gratis" if is_gratis else (p if p and p.lower() != "onbekend" else "?")
    return f'<div class="vs-map-price-marker {cls}">{label}</div>'


def build_folium_map(map_df: pd.DataFrame) -> folium.Map:
    """
    Bouwt Folium-kaart met Airbnb-stijl prijs-markers en MarkerCluster.
    """
    if map_df.empty:
        center, zoom = [52.3, 5.3], 7
    else:
        center = [
            float(map_df["latitude"].dropna().mean()),
            float(map_df["longitude"].dropna().mean()),
        ]
        zoom = 8 if len(map_df) > 15 else 11

    m = folium.Map(location=center, zoom_start=zoom, tiles=None)
    folium.TileLayer(
        tiles="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
        attr="&copy; OpenStreetMap &copy; CARTO",
        name="Voyager",
        max_zoom=19,
    ).add_to(m)

    try:
        from folium.plugins import MarkerCluster
        cluster = MarkerCluster(
            options={"maxClusterRadius": 50, "disableClusteringAtZoom": 13}
        ).add_to(m)
    except ImportError:
        cluster = m

    for _, row in map_df.iterrows():
        try:
            lat = float(str(row["latitude"]).replace(",", "."))
            lon = float(str(row["longitude"]).replace(",", "."))
        except (ValueError, TypeError):
            continue

        naam_s  = safe_html(clean_val(row.get("naam"), "Onbekend"))
        prov_s  = safe_html(clean_val(row.get("provincie"), ""))
        prijs_s = clean_val(row.get("prijs"), "?")
        honden  = "✅" if is_ja(row.get("honden_toegestaan")) else "❌"
        stroom  = "✅" if is_ja(row.get("stroom")) else "❌"
        is_gratis = "gratis" in prijs_s.lower()
        prijs_color = "#008009" if is_gratis else BRAND_PRIMARY

        popup_html = f"""
<div style="font-family:'Inter',sans-serif;min-width:190px;max-width:230px;">
  <div style="font-weight:700;font-size:0.9rem;color:{BRAND_DARK};margin-bottom:3px;">
    {naam_s}
  </div>
  <div style="font-size:0.73rem;color:#6B7897;margin-bottom:6px;">📍 {prov_s}</div>
  <div style="font-size:0.75rem;display:flex;gap:10px;margin-bottom:5px;">
    <span>🐾 {honden}</span><span>⚡ {stroom}</span>
  </div>
  <div style="font-weight:700;color:{prijs_color};font-size:0.88rem;">
    💶 {safe_html(prijs_s)}
  </div>
</div>"""

        # Airbnb-stijl prijs DivIcon marker
        marker_html = _price_marker_html(prijs_s)
        icon = folium.DivIcon(
            html=marker_html,
            icon_size=(80, 28),
            icon_anchor=(40, 14),
            class_name="",
        )
        folium.Marker(
            location=[lat, lon],
            popup=folium.Popup(popup_html, max_width=250),
            tooltip=naam_s,
            icon=icon,
        ).add_to(cluster)

    return m


def render_map_section(display_df: pd.DataFrame, height: int = 480) -> None:
    """Rendert kaart als uitklapbare sectie boven de resultatenlijst."""
    st.markdown(
        f'<div style="border-radius:12px;overflow:hidden;border:1px solid {BORDER};'
        f'margin-bottom:1rem;box-shadow:0 3px 14px rgba(0,0,0,0.09);">',
        unsafe_allow_html=True,
    )
    if display_df.empty:
        st.info("📍 Geen locaties om op de kaart te tonen met de huidige filters.")
    else:
        try:
            map_data = display_df.dropna(subset=["latitude", "longitude"]).head(300)
            fm = build_folium_map(map_data)
            components.html(fm._repr_html_(), height=height)
        except Exception as e:
            st.error(f"Kaart kon niet laden: {e}")
    st.markdown("</div>", unsafe_allow_html=True)
    st.caption(f"📍 {min(len(display_df), 300)} locaties getoond · groen = gratis · blauw = betaald")
