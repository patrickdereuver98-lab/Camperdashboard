"""
ui/map_view.py — Kaartweergave component voor VrijStaan v4.
De kaart is verborgen by default en klapt open via de sidebar toggle.
Booking.com: kaart is een overlay/sectie, niet altijd zichtbaar.
"""
from __future__ import annotations

import folium
import pandas as pd
import streamlit as st
import streamlit.components.v1 as components

from ui.theme import BRAND_PRIMARY, BRAND_DARK, BORDER
from utils.helpers import clean_val, safe_html, is_ja


def build_folium_map(map_df: pd.DataFrame) -> folium.Map:
    """
    Bouwt een Folium-kaart met MarkerCluster voor alle locaties.

    Args:
      map_df: DataFrame met latitude/longitude kolommen

    Returns:
      Folium Map object
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
        tiles=(
            "https://{s}.basemaps.cartocdn.com/"
            "rastertiles/voyager/{z}/{x}/{y}{r}.png"
        ),
        attr="&copy; OpenStreetMap &copy; CARTO",
        name="Voyager",
        max_zoom=19,
    ).add_to(m)

    try:
        from folium.plugins import MarkerCluster
        cluster = MarkerCluster(
            options={"maxClusterRadius": 60, "disableClusteringAtZoom": 13}
        ).add_to(m)
    except ImportError:
        cluster = m

    for _, row in map_df.iterrows():
        try:
            lat = float(str(row["latitude"]).replace(",", "."))
            lon = float(str(row["longitude"]).replace(",", "."))
        except (ValueError, TypeError):
            continue

        naam_s   = safe_html(clean_val(row.get("naam"), "Onbekend"))
        prov_s   = safe_html(clean_val(row.get("provincie"), ""))
        prijs_s  = clean_val(row.get("prijs"), "Onbekend")
        honden   = "✅" if is_ja(row.get("honden_toegestaan")) else "❌"
        stroom   = "✅" if is_ja(row.get("stroom")) else "❌"
        wifi     = "✅" if is_ja(row.get("wifi")) else "❌"

        is_gratis = "gratis" in str(prijs_s).lower()
        prijs_color = "#008009" if is_gratis else BRAND_PRIMARY

        popup_html = f"""
<div style="font-family:'DM Sans',sans-serif;min-width:200px;max-width:240px;">
  <div style="font-weight:700;font-size:0.95rem;color:{BRAND_DARK};margin-bottom:4px;">
    {naam_s}
  </div>
  <div style="font-size:0.75rem;color:#6B7897;margin-bottom:8px;">📍 {prov_s}</div>
  <div style="font-size:0.78rem;display:flex;gap:8px;margin-bottom:6px;">
    <span>🐾 {honden}</span>
    <span>⚡ {stroom}</span>
    <span>📶 {wifi}</span>
  </div>
  <div style="font-weight:700;color:{prijs_color};font-size:0.9rem;">
    💶 {safe_html(prijs_s)}
  </div>
</div>"""

        folium.Marker(
            location=[lat, lon],
            popup=folium.Popup(popup_html, max_width=260),
            tooltip=naam_s,
            icon=folium.Icon(
                color="green" if is_gratis else "blue",
                icon="home",
                prefix="fa",
            ),
        ).add_to(cluster)

    return m


def render_map_section(display_df: pd.DataFrame, height: int = 500) -> None:
    """
    Rendert de kaart als uitklapbare sectie (bij toon_kaart=True).
    Getoond als een volledige balk boven de resultatenlijst.

    Args:
      display_df: Gefilterde dataset om op de kaart te tonen
      height:     Kaarth hoogte in pixels
    """
    st.markdown(
        f"""<div style="border-radius:12px;overflow:hidden;
border:1px solid {BORDER};margin-bottom:1rem;
box-shadow:0 2px 12px rgba(0,0,0,0.08);">""",
        unsafe_allow_html=True,
    )

    if display_df.empty:
        st.info("📍 Geen locaties om op de kaart te tonen met de huidige filters.")
    else:
        map_data = (
            display_df
            .dropna(subset=["latitude", "longitude"])
            .head(300)
        )
        try:
            f_map = build_folium_map(map_data)
            components.html(f_map._repr_html_(), height=height)
        except Exception as e:
            st.error(f"Kaart kon niet worden geladen: {e}")

    st.markdown("</div>", unsafe_allow_html=True)
    st.caption(
        f"📍 {min(len(display_df), 300)} van {len(display_df)} locaties getoond op de kaart."
    )
