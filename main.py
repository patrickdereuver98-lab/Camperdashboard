import streamlit as st

# We importeren nu alleen wat echt bestaat in onze vernieuwde theme.py
from ui.theme import apply_theme, render_sidebar_header

# Config moet altijd als allereerste Streamlit commando
st.set_page_config(page_title="VrijStaan | Welkom", page_icon="🚐", layout="centered")

def main():
    # 1. Forceer het lichte thema
    apply_theme()
    
    # 2. Toon de strakke zijbalk met logo en navigatie
    render_sidebar_header()
    
    # 3. De vernieuwde Landingspagina
    st.markdown("<h1 style='text-align: center; color: #0077B6; font-size: 3rem;'>Welkom bij VrijStaan 🚐</h1>", unsafe_allow_html=True)
    st.markdown("<p style='text-align: center; font-size: 1.2rem; color: #6c757d;'>Dé gids voor camperplaatsen zonder vertrektijden.</p>", unsafe_allow_html=True)
    
    st.write("")
    st.write("")
    
    col1, col2 = st.columns(2)
    
    with col1:
        with st.container(border=True):
            st.markdown("### 📍 Zoek & Ontdek")
            st.write("Vind direct camperplaatsen in de buurt met onze interactieve kaart en slimme filters.")
            # Deze knop linkt nu direct door naar je nieuwe kaart
            if st.button("Ga naar de Kaart", use_container_width=True):
                st.switch_page("pages/1_📍_Kaart.py")
                
    with col2:
        with st.container(border=True):
            st.markdown("### 🤖 Smart Search")
            st.write("Typ gewoon wat je zoekt. Bijvoorbeeld: *'Een gratis plek in Drenthe met de hond'*.")
            st.info("Direct beschikbaar in het dashboard.")

if __name__ == "__main__":
    main()
