"""
map_view.py — Folium kaart met MarkerCluster voor VrijStaan.
Fix #11: MarkerCluster voorkomt chaos bij 500+ markers.
"""
import folium
from folium.plugins import MarkerCluster
from streamlit_folium import st_folium


def render_map(df):
    nl_coords = [52.1326, 5.2913]
    m = folium.Map(location=nl_coords, zoom_start=7, tiles="OpenStreetMap")

    if df.empty:
        st_folium(m, use_container_width=True, height=600, returned_objects=[])
        return

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
        website_html = f'<a href="https://{website}" target="_blank">🌐 Website</a>' if website and website != "nan" else ""

        popup_html = f"""
        <div style="width:220px;font-family:sans-serif;font-size:13px;">
            <b style="font-size:14px;">{row['naam']}</b><br>
            <span style="color:#666;">📍 {row['provincie']}</span><br>
            <hr style="margin:6px 0;">
            💰 {prijs_str}<br>
            🐾 Honden: {row.get('honden_toegestaan','?')}<br>
            ⚡ Stroom: {row.get('stroom','?')}<br>
            🌊 Water: {row.get('waterfront','?')}<br>
            🕐 {row.get('openingstijden','Altijd open')}<br>
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

    st_folium(m, use_container_width=True, height=600, returned_objects=[])
