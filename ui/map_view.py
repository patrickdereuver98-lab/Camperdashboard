import folium
from streamlit_folium import st_folium

def render_map(df):
    """Genereert de Folium kaart op basis van een dataframe."""
    # Startpunt: Midden van Nederland
    nl_coords = [52.1326, 5.2913]
    m = folium.Map(location=nl_coords, zoom_start=7, tiles="OpenStreetMap")

    if not df.empty:
        for _, row in df.iterrows():
            # HTML opmaak voor de pop-up als je op een marker klikt
            popup_html = f"""
            <div style="width: 200px;">
                <b>{row['naam']}</b><br>
                Provincie: {row['provincie']}<br>
                Plekken: {row['aantal_plekken']}<br>
                Prijs: €{row['prijs']}<br>
                <a href="http://{row['website']}" target="_blank">Website</a>
            </div>
            """
            
            folium.Marker(
                location=[row['latitude'], row['longitude']],
                popup=folium.Popup(popup_html, max_width=250),
                icon=folium.Icon(color="green", icon="info-sign"),
                tooltip=row['naam']
            ).add_to(m)

    # Render de kaart in Streamlit
    st_folium(m, use_container_width=True, height=600, returned_objects=[])
