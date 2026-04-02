import streamlit as st
from ui.theme import apply_theme, render_logo

# Configuratie MOET als eerste
st.set_page_config(page_title="VrijStaan | Welkom", page_icon="🚐", layout="centered")

def main():
    # Stijl en logo inladen
    apply_theme()
    render_logo()
    
    st.markdown("---")
    
    # Hero Sectie
    st.markdown("""
    ### Welkom bij het onafhankelijke platform voor camperaars.
    Vind de beste verborgen plekken, rustpunten en officiële camperplaatsen in Nederland. 
    Geen stress over uitchecktijden, gewoon genieten van de vrijheid.
    """)
    
    st.write("")
    
    # Knoppen voor navigatie
    col1, col2, col3 = st.columns([1, 2, 1])
    with col2:
        if st.button("🗺️ Open de Camperkaart", use_container_width=True):
            st.switch_page("pages/1_📍_Kaart.py")

    st.write("")
    st.write("")
    
    # Informatie sectie met 3 kolommen
    info1, info2, info3 = st.columns(3)
    
    with info1:
        st.info("**Locatiegericht**\n\nVind direct plekken binnen een specifieke straal rondom jouw huidige locatie of bestemming.")
    with info2:
        st.success("**Geverifieerde Data**\n\nGebouwd op basis van actuele inzichten en gedeelde ervaringen vanuit de community.")
    with info3:
        st.warning("**Filters**\n\nZoek gericht op faciliteiten zoals huisdiervriendelijkheid, prijs en beschikbare capaciteit.")

if __name__ == "__main__":
    main()
