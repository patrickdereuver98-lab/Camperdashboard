"""
map_view.py — Geoptimaliseerde Folium kaart voor VrijStaan.
Fix: Gebruikt native HTML rendering in plaats van trage st_folium bidirectionele brug.
"""
import folium
from folium.plugins import MarkerCluster
import streamlit.components.v1 as components
import streamlit as st

def render_map(df):
    nl_coords = [52.1326, 5.2913]
    m = folium.Map(location=nl_coords, zoom_start=7, tiles="OpenStreetMap")

    if df.empty:
        components.html(m._repr_html_(), height=600)
        return

    # ── VEILIGHEIDSLIMIET ──
    # Mocht de dataset toch te groot worden doorbroken, beschermen we de browser
    MAX_MARKERS = 800
    if len(df) > MAX_MARKERS:
        st.caption(f"⚠️ Kaart toont top {MAX_MARKERS} locaties om snelheid te garanderen. Gebruik filters voor meer.")
        df = df.head(MAX_MARKERS)

    cluster = MarkerCluster(
        options={
            "maxClusterRadius": 60,
            "disableClusteringAtZoom": 12,
            "spiderfyOnMaxZoom": True,
        }
    ).add_to(m)

    for _, row in df.iterrows():
        prijs_str = str(row.get("prijs", "Onbekend"))
        prijs_kleur = "green" if prijs_str.lower() == "gratis" else "orange" if prijs_str != "Onbekend" else "gray"

        afstand_html = ""
        if "afstand_label" in row and str(row["afstand_label"]) not in ("nan", ""):
            afstand_html = f'<br><small>📏 {row["afstand_label"]} van jouw locatie</small>'

        website = str(row.get("website", "")).strip()
        website_html = f'<a href="{website if website.startswith("http") else "https://"+website}" target="_blank">🌐 Website</a>' if website and website != "nan" else ""

        # Simpele, schone HTML popup
        popup_html = f"""
        <div style="width:220px;font-family:sans-serif;font-size:13px;">
            <b style="font-size:14px;">{row['naam']}</b><br>
            <span style="color:#666;">📍 {row.get('provincie', 'Onbekend')}</span><br>
            <hr style="margin:6px 0;">
            💰 {prijs_str}<br>
            🐾 Honden: {row.get('honden_toegestaan','?')}<br>
            ⚡ Stroom: {row.get('stroom','?')}<br>
            🌊 Water: {row.get('waterfront','?')}<br>
            {afstand_html}
            <hr style="margin:6px 0;">
            {website_html}
        </div>
        """

        folium.Marker(
            location=[float(row["latitude"]), float(row["longitude"])],
            popup=folium.Popup(popup_html, max_width=240),
            icon=folium.Icon(color=prijs_kleur, icon="home", prefix="fa"),
            tooltip=f"{row['naam']} — {prijs_str}",
        ).add_to(cluster)

    # Pas kaartbounds aan op de data
    if len(df) > 0:
        lats = df["latitude"].astype(float)
        lons = df["longitude"].astype(float)
        m.fit_bounds([
            [lats.min() - 0.1, lons.min() - 0.1],
            [lats.max() + 0.1, lons.max() + 0.1],
        ])

    # 🚀 DE SNELHEIDS-HACK: Teken de kaart als statische HTML
    components.html(m._repr_html_(), height=600)
