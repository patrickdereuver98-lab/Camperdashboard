import streamlit as st
import folium
import leafmap.foliumap as leafmap
import pandas as pd
from ui.theme import apply_theme, render_sidebar_header
# CHIRURGISCHE FIX: Import aangepast naar load_data voor Google Sheets sync
from utils.data_handler import load_data

st.set_page_config(page_title="VrijStaan | Kaart", page_icon="📍", layout="wide")

apply_theme()
render_sidebar_header()

st.title("📍 Camperplaatsen in Nederland")

# CSS voor de legenda
st.markdown("""
    <style>
    .legend {
        background-color: white;
        padding: 10px;
        border-radius: 5px;
        border: 1px solid #ccc;
        line-height: 1.5;
        box-shadow: 2px 2px 5px rgba(0,0,0,0.1);
    }
    .legend-item {
        display: flex;
        align-items: center;
        margin-bottom: 5px;
        font-size: 14px;
    }
    .legend-color {
        width: 18px;
        height: 18px;
        margin-right: 12px;
        border-radius: 4px;
        border: 1px solid rgba(0,0,0,0.2);
    }
    /* Hover effect voor kaart markers */
    .leaflet-interactive:hover {
        stroke-opacity: 1;
        stroke-width: 3;
    }
    </style>
""", unsafe_allow_html=True)

# Uitgebreid kleurenschema voor alle Nederlandse provincies
color_map = {
    'Groningen': '#1f77b4',
    'Friesland': '#ff7f0e',
    'Drenthe': '#2ca02c',
    'Overijssel': '#d62728',
    'Flevoland': '#9467bd',
    'Gelderland': '#8c564b',
    'Utrecht': '#e377c2',
    'Noord-Holland': '#7f7f7f',
    'Zuid-Holland': '#bcbd22',
    'Zeeland': '#17becf',
    'Noord-Brabant': '#aec7e8',
    'Limburg': '#ffbb78'
}

# CHIRURGISCHE FIX: Functie-aanroep naar load_data (Cloud-ready)
df = load_data()

if df.empty:
    st.warning("⚠️ Er is momenteel geen data beschikbaar in de cloud of lokaal. Ga naar de Beheer-pagina om een synchronisatie uit te voeren.")
else:
    # --- SIDEBAR FILTERS ---
    with st.sidebar:
        st.header("🔍 Verfijn je zoekopdracht")
        
        # 1. Vrij zoeken
        search_query = st.text_input("Zoek op naam of plaats", "", help="Typ de naam van een camping of een stad.")
        
        st.divider()
        
        # 2. Provincie Selectie
        all_provincies = sorted(df['provincie'].unique().tolist())
        sel_prov = st.multiselect(
            "Selecteer Provincies", 
            all_provincies, 
            default=all_provincies,
            help="Kies één of meerdere provincies om weer te geven op de kaart."
        )
        
        st.divider()
        
        # 3. Prijs Filter
        st.subheader("Budget")
        prijs_options = ["Alle locaties", "Alleen Gratis", "Alleen Betaald"]
        sel_prijs = st.radio("Prijsklasse", prijs_options, index=0)
        
        st.divider()
        
        # 4. Voorzieningen Quick-Filters
        st.subheader("Voorzieningen")
        f_stroom = st.checkbox("⚡ Stroomaansluiting", value=False)
        f_honden = st.checkbox("🐾 Honden toegestaan", value=False)
        f_water = st.checkbox("🌊 Water/Afvoer punt", value=False)
        f_wifi = st.checkbox("📶 Wifi beschikbaar", value=False)
        
        st.divider()
        
        if st.button("Reset alle filters", use_container_width=True):
            st.rerun()

    # --- FILTER LOGICA ---
    # We maken een kopie om de originele dataset niet te vervuilen
    filtered_df = df[df['provincie'].isin(sel_prov)].copy()
    
    # Filter op zoekterm (Naam of Provincie/Plaats als fallback)
    if search_query:
        filtered_df = filtered_df[
            filtered_df['naam'].str.contains(search_query, case=False, na=False) |
            filtered_df['provincie'].str.contains(search_query, case=False, na=False)
        ]
    
    # Prijs filteren
    if sel_prijs == "Alleen Gratis":
        filtered_df = filtered_df[filtered_df['prijs'].astype(str).str.lower().str.contains('gratis', na=False)]
    elif sel_prijs == "Alleen Betaald":
        filtered_df = filtered_df[~filtered_df['prijs'].astype(str).str.lower().str.contains('gratis', na=False)]
        
    # Voorzieningen filteren
    if f_stroom:
        filtered_df = filtered_df[filtered_df['stroom'].astype(str).str.contains('Ja', case=False, na=False)]
    if f_honden:
        filtered_df = filtered_df[filtered_df['honden_toegestaan'].astype(str).str.contains('Ja', case=False, na=False)]
    if f_water:
        # Checkt op meerdere kolommen voor water
        water_mask = (filtered_df['waterfront'].astype(str).str.contains('Ja', case=False, na=False)) | \
                     (filtered_df.get('water_tanken', pd.Series(False)).astype(str).str.contains('Ja', case=False, na=False))
        filtered_df = filtered_df[water_mask]
    if f_wifi and 'wifi' in filtered_df.columns:
        filtered_df = filtered_df[filtered_df['wifi'].astype(str).str.contains('Ja', case=False, na=False)]

    # --- DASHBOARD METRICS ---
    m1, m2, m3, m4 = st.columns(4)
    m1.metric("Totaal gevonden", len(filtered_df))
    m2.metric("Provincies", len(sel_prov))
    
    gratis_in_filter = len(filtered_df[filtered_df['prijs'].astype(str).str.lower().str.contains('gratis', na=False)])
    m3.metric("Gratis opties", gratis_in_filter)
    
    betaald_in_filter = len(filtered_df) - gratis_in_filter
    m4.metric("Betaalde opties", betaald_in_filter)

    # --- KAART RENDERING ---
    # Initialisatie van de kaart (Centrum Nederland)
    m = leafmap.Map(center=[52.13, 5.29], zoom=7, draw_control=False, measure_control=False)
    
    if not filtered_df.empty:
        # Helper functie voor kleurtoewijzing
        def get_provincie_color(provincie_naam):
            return color_map.get(provincie_naam, '#3388ff') # Fallback naar standaard blauw

        # Individuele markers toevoegen via Folium voor maximale controle over popups
        for _, row in filtered_df.iterrows():
            # Dynamische popup content bouwen
            popup_content = f"""
                <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; width: 240px; line-height: 1.4;">
                    <h4 style="margin: 0 0 10px 0; color: #2c3e50; border-bottom: 2px solid {get_provincie_color(row['provincie'])}; padding-bottom: 5px;">
                        {row['naam']}
                    </h4>
                    <table style="width: 100%; font-size: 13px; border-collapse: collapse;">
                        <tr><td style="padding: 2px 0;"><b>📍 Provincie:</b></td><td>{row['provincie']}</td></tr>
                        <tr><td style="padding: 2px 0;"><b>💰 Prijs:</b></td><td>{row['prijs']}</td></tr>
                        <tr><td style="padding: 2px 0;"><b>⚡ Stroom:</b></td><td>{row['stroom']}</td></tr>
                        <tr><td style="padding: 2px 0;"><b>🐾 Honden:</b></td><td>{row['honden_toegestaan']}</td></tr>
                    </table>
                    <div style="margin-top: 12px; text-align: center;">
                        <a href="{row['website']}" target="_blank" 
                           style="background-color: #007bff; color: white; padding: 6px 12px; border-radius: 4px; text-decoration: none; font-weight: bold; display: inline-block; font-size: 12px;">
                           Bekijk Website
                        </a>
                    </div>
                </div>
            """
            
            folium.CircleMarker(
                location=[row['latitude'], row['longitude']],
                radius=9,
                popup=folium.Popup(popup_content, max_width=300),
                color=get_provincie_color(row['provincie']),
                weight=2,
                fill=True,
                fill_color=get_provincie_color(row['provincie']),
                fill_opacity=0.6,
                tooltip=f"{row['naam']} ({row['provincie']})"
            ).add_to(m)
    
    # Render de kaart in Streamlit
    m.to_streamlit(height=750)

    # --- LEGENDA ---
    st.divider()
    st.markdown("### 🗺️ Kleurlegenda per Provincie")
    
    # Legenda weergeven in 4 kolommen
    leg_cols = st.columns(4)
    for index, (prov, color) in enumerate(color_map.items()):
        with leg_cols[index % 4]:
            st.markdown(f"""
                <div class="legend-item">
                    <div class="legend-color" style="background-color: {color};"></div>
                    <span>{prov}</span>
                </div>
            """, unsafe_allow_html=True)

    # --- DATA EXPORT OPTIE ---
    st.sidebar.divider()
    if not filtered_df.empty:
        csv = filtered_df.to_csv(index=False).encode('utf-8')
        st.sidebar.download_button(
            label="📥 Download selectie (CSV)",
            data=csv,
            file_name='vrijstaan_selectie.csv',
            mime='text/csv',
            use_container_width=True
        )
