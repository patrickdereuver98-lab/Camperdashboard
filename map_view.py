"""
ui/map_view.py — Kaartweergave met Airbnb-stijl prijs-markers voor VrijStaan v5.
Markers: witte labels met prijs/Gratis. Clustering voor performance.
"""
from __future__ import annotations

import folium
import pandas as pd
import streamlit as st
import streamlit.components.v1 as components

from ui.theme import P_BLUE, P_DARK, P_GREEN, BORDER
from utils.helpers import clean_val, safe_html, is_ja


def _marker_icon(prijs: str, is_selected: bool = False) -> folium.DivIcon:
    """
    Airbnb-stijl prijs-label marker.
    Wit label met prijs tekst, geselecteerd = donkerblauw.
    """
    p = clean_val(prijs, "")
    is_gratis = "gratis" in p.lower()

    if is_gratis:
        bg, color, text = P_GREEN, "white", "Gratis"
        border = P_GREEN
    elif p and p != "Onbekend":
        bg, color, border = "white", "#1A1A2E", "#1A1A2E"
        # Verkort prijs voor label
        text = p[:8] if len(p) > 8 else p
    else:
        bg, color, border = "#F5F5F5", "#8492A6", "#E4E7EB"
        text = "?"

    if is_selected:
        bg, color, border = "#1A1A2E", "white", "#1A1A2E"

    html = f"""
<div style="
    background:{bg};
    color:{color};
    border:2px solid {border};
    border-radius:20px;
    padding:5px 11px;
    font-size:0.78rem;
    font-weight:800;
    font-family:'Plus Jakarta Sans',sans-serif;
    white-space:nowrap;
    box-shadow:0 2px 8px rgba(0,0,0,0.18);
    cursor:pointer;
    transition:all 0.15s;
">{safe_html(text)}</div>"""

    return folium.DivIcon(
        html=html,
        icon_size=(80, 36),
        icon_anchor=(40, 18),
    )


def build_folium_map(
    map_df: pd.DataFrame,
    selected_naam: str | None = None,
) -> folium.Map:
    """
    Bouwt Folium-kaart met Airbnb-stijl prijs-markers.
    Clustering uitgeschakeld: individuele prijslabels, zoals Airbnb.

    Args:
      map_df:        Gefilterde dataset
      selected_naam: Geselecteerde locatie-naam (donkerblauw marker)

    Returns:
      Folium Map object
    """
    if map_df.empty:
        center, zoom = [52.3, 5.3], 7
    else:
        try:
            center = [
                float(map_df["latitude"].dropna().mean()),
                float(map_df["longitude"].dropna().mean()),
            ]
            zoom = 8 if len(map_df) > 20 else 11
        except Exception:
            center, zoom = [52.3, 5.3], 7

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

    # Limit markers voor performance (max 150 zichtbaar)
    render_df = map_df.head(150)

    for _, row in render_df.iterrows():
        try:
            lat = float(str(row["latitude"]).replace(",", "."))
            lon = float(str(row["longitude"]).replace(",", "."))
        except (ValueError, TypeError):
            continue

        naam_s  = safe_html(clean_val(row.get("naam"), "Onbekend"))
        prov_s  = safe_html(clean_val(row.get("provincie"), ""))
        prijs_s = clean_val(row.get("prijs"), "")
        honden  = "✅" if is_ja(row.get("honden_toegestaan")) else "❌"
        stroom  = "✅" if is_ja(row.get("stroom")) else "❌"
        is_sel  = (naam_s == selected_naam)

        popup_html = f"""
<div style="font-family:'Plus Jakarta Sans',sans-serif;min-width:200px;max-width:250px;">
  <div style="font-weight:800;font-size:0.95rem;color:{P_DARK};margin-bottom:4px;">{naam_s}</div>
  <div style="font-size:0.75rem;color:#8492A6;margin-bottom:8px;">📍 {prov_s}</div>
  <div style="font-size:0.78rem;display:flex;gap:10px;margin-bottom:6px;">
    <span>🐾 {honden}</span>
    <span>⚡ {stroom}</span>
  </div>
  <div style="font-weight:800;color:{'#008009' if 'gratis' in prijs_s.lower() else P_BLUE};
font-size:0.92rem;">{'Gratis' if 'gratis' in prijs_s.lower() else safe_html(prijs_s) or 'Prijs onbekend'}</div>
</div>"""

        folium.Marker(
            location=[lat, lon],
            popup=folium.Popup(popup_html, max_width=270),
            tooltip=naam_s,
            icon=_marker_icon(prijs_s, is_selected=is_sel),
        ).add_to(m)

    return m


def render_map_section(
    display_df: pd.DataFrame,
    height: int = 520,
    selected_naam: str | None = None,
) -> None:
    """
    Rendert de kaart als uitklapbare sectie boven de lijst.
    Airbnb-stijl: prijs-labels direct op de kaart.
    """
    st.markdown(
        f'<div style="border-radius:14px;overflow:hidden;border:1px solid {BORDER};'
        f'margin-bottom:1rem;box-shadow:0 2px 14px rgba(0,0,0,0.08);">',
        unsafe_allow_html=True,
    )
    if display_df.empty:
        st.info("📍 Geen locaties om op de kaart te tonen.")
    else:
        map_data = display_df.dropna(subset=["latitude", "longitude"]).head(150)
        try:
            f_map = build_folium_map(map_data, selected_naam=selected_naam)
            components.html(f_map._repr_html_(), height=height)
        except Exception as e:
            st.error(f"Kaart kon niet worden geladen: {e}")
    st.markdown("</div>", unsafe_allow_html=True)

    n_kaart = min(len(display_df), 150)
    st.caption(
        f"📍 {n_kaart} van {len(display_df)} locaties getoond · "
        "Vergroot de kaart door te scrollen."
    )
