import streamlit as st
from ui.theme import apply_theme, render_sidebar_header

# Config moet altijd als allereerste
st.set_page_config(page_title="VrijStaan | Zoeken", page_icon="🚐", layout="centered")

def main():
    apply_theme()
    render_sidebar_header()
    
    # Zorg dat de sessie-variabele bestaat
    if 'ai_search_query' not in st.session_state:
        st.session_state['ai_search_query'] = ""
    
    st.write("")
    st.write("")
    
    # ── HET CENTRALE ZOEKSCHERM ──────────────────────────────────────────────────
    st.markdown("<h1 style='text-align: center; color: #0077B6; font-size: 4rem; margin-bottom: 0;'>VrijStaan</h1>", unsafe_allow_html=True)
    st.markdown("<p style='text-align: center; font-size: 1.2rem; color: #6c757d; margin-bottom: 2rem;'>Vind direct jouw ideale camperplaats. Waar wil je heen?</p>", unsafe_allow_html=True)
    
    # De grote zoekbalk
    search_input = st.text_input(
        "Zoekopdracht", 
        placeholder="Bijv: 'Een gratis plek in Drenthe voor 2 personen met stroom en een hond'",
        label_visibility="collapsed"
    )
    
    # Knoppen layout (gecentreerd)
    col1, col2, col3 = st.columns([1, 2, 1])
    with col2:
        if st.button("🔍 Zoeken met AI", use_container_width=True):
            # Sla de zoekopdracht op in het geheugen
            st.session_state['ai_search_query'] = search_input
            # Stuur de gebruiker direct naar de kaart-pagina
            st.switch_page("pages/1_📍_Kaart.py")
            
    st.markdown("<p style='text-align: center; font-size: 0.9rem; color: #adb5bd; margin-top: 1rem;'>Onze AI analyseert je vraag en filtert direct de juiste resultaten op de kaart.</p>", unsafe_allow_html=True)

if __name__ == "__main__":
    main()
