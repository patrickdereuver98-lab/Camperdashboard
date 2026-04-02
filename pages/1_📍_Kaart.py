import streamlit as st
from utils.data_handler import load_data, filter_data
from ui.map_view import render_map
from ui.theme import apply_theme
from utils.ai_helper import process_ai_query

st.set_page_config(page_title="VrijStaan | Kaart", page_icon="📍", layout="wide")

def app():
    apply_theme()
    
    df = load_data()
    
    if df.empty:
        st.error("Systeemfout: Data kon niet worden geladen. Controleer of de externe verbinding werkt.")
        return

    # --- DEFENSIVE PROGRAMMING ---
    if 'provincie' not in df.columns: df['provincie'] = "Onbekende Provincie"
    if 'afbeelding' not in df.columns: df['afbeelding'] = "https://images.unsplash.com/photo-1523987355523-c7b5b0dd90a7?auto=format&fit=crop&w=300&q=80"
    if 'honden_toegestaan' not in df.columns: df['honden_toegestaan'] = "Onbekend"
    if 'aantal_plekken' not in df.columns: df['aantal_plekken'] = "?"
    if 'prijs' not in df.columns: df['prijs'] = "0.00"

    st.markdown("<h2 style='color: #2A5A4A;'>📍 Zoek jouw volgende plek</h2>", unsafe_allow_html=True)
    
    # --- 🤖 AI ZOEKBALK ---
    st.markdown("### 🤖 Slim Zoeken")
    ai_query = st.text_input(
        "Vraag het de assistent", 
        placeholder="Bijv: 'Ik zoek een gratis plek in Drenthe waar mijn hond mee mag'",
        label_visibility="collapsed"
    )

    # Verwerk de data via de AI-Helper vóór we naar de reguliere filters gaan
    df, herkende_filters = process_ai_query(df, ai_query)
    
    if herkende_filters:
        st.caption(f"**Geïnterpreteerde zoekopdracht:** {', '.join(herkende_filters)}")

    st.markdown("---")

    # --- REGULIERE FILTERS ---
    filter_col1, filter_col2, filter_col3 = st.columns(3)
    
    with filter_col1:
        # Zorg dat de dropdown kijkt naar de originele provincies, niet de reeds gefilterde lijst
        alle_provincies = ["Alle provincies"] + sorted(load_data()['provincie'].unique().tolist())
        selected_provincie = st.selectbox("Provincie (Handmatig)", alle_provincies)
        
    with filter_col2:
        user_loc = st.text_input("Huidige locatie (Postcode/Stad)", placeholder="Bijv. Amsterdam")
        
    with filter_col3:
        radius = st.slider("Straal (km)", min_value=5, max_value=100, value=25, step=5)

    # Combinatie van AI filter + Handmatige filters
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
                    st.markdown(f"**{row.get('naam', 'Onbekende locatie')}**")
                    st.caption(f"{row['provincie']} | {row['aantal_plekken']} plekken")
                    st.write(f"Prijs: €{row['prijs']}")
                    
                    if row['honden_toegestaan'] == "Ja":
                        st.write("🐾 Honden toegestaan")

    with col_kaart:
        render_map(filtered_df)

if __name__ == "__main__":
    app()
