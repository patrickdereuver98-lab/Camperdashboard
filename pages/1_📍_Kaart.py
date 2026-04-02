import streamlit as st
from utils.data_handler import load_data, filter_data
from ui.map_view import render_map
from ui.theme import apply_theme

st.set_page_config(page_title="VrijStaan | Kaart", page_icon="📍", layout="wide")

def app():
    # Pas het thema toe op de dashboard pagina
    apply_theme()
    
    df = load_data()
    
    if df.empty:
        st.error("Systeemfout: Data kon niet worden geladen. Controleer of data/dummy_campers.csv bestaat.")
        return

    # --- DEFENSIVE PROGRAMMING ---
    # Voorkomt KeyError als de CSV nog niet de juiste kolommen bevat
    if 'provincie' not in df.columns:
        df['provincie'] = "Onbekende Provincie"
    if 'afbeelding' not in df.columns:
        df['afbeelding'] = "https://images.unsplash.com/photo-1523987355523-c7b5b0dd90a7?auto=format&fit=crop&w=300&q=80"
    if 'honden_toegestaan' not in df.columns:
        df['honden_toegestaan'] = "Onbekend"
    if 'aantal_plekken' not in df.columns:
        df['aantal_plekken'] = "?"
    if 'prijs' not in df.columns:
        df['prijs'] = "0.00"

    # Gebruik de primaire kleur in de header
    st.markdown("<h2 style='color: #2A5A4A;'>📍 Zoek jouw volgende plek</h2>", unsafe_allow_html=True)
    
    # --- FILTERS ---
    filter_col1, filter_col2, filter_col3 = st.columns(3)
    
    with filter_col1:
        provincies = ["Alle provincies"] + sorted(df['provincie'].unique().tolist())
        selected_provincie = st.selectbox("Provincie", provincies)
        
    with filter_col2:
        user_loc = st.text_input("Huidige locatie (Postcode/Stad)", placeholder="Bijv. Amsterdam")
        
    with filter_col3:
        radius = st.slider("Straal (km)", min_value=5, max_value=100, value=25, step=5)

    filtered_df = filter_data(df, selected_provincie, radius)
    st.markdown("---")

    # --- SPLIT-SCREEN LAYOUT ---
    col_lijst, col_kaart = st.columns([4, 6])

    with col_lijst:
        st.subheader(f"{len(filtered_df)} locaties gevonden")
        
        for _, row in filtered_df.iterrows():
            with st.container(border=True):
                img_col, txt_col = st.columns([1, 2])
                with img_col:
                    st.image(row['afbeelding'], use_column_width=True)
                with txt_col:
                    # Gebruik .get() voor extra veiligheid als de 'naam' kolom onverwacht leeg is
                    st.markdown(f"**{row.get('naam', 'Onbekende locatie')}**")
                    st.caption(f"{row['provincie']} | {row['aantal_plekken']} plekken")
                    st.write(f"Prijs: €{row['prijs']}")
                    
                    if row['honden_toegestaan'] == "Ja":
                        st.write("🐾 Honden toegestaan")

    with col_kaart:
        # Hier wordt de interactieve kaart aangeroepen en gerenderd
        render_map(filtered_df)

if __name__ == "__main__":
    app()
