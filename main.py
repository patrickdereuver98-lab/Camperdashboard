import streamlit as st
import pandas as pd

# Pagina configuratie instellen (dit moet altijd het eerste Streamlit commando zijn!)
st.set_page_config(
    page_title="Camperdashboard",
    page_icon="🚐",
    layout="wide"
)

def main():
    st.title("🚐 Camperdashboard Nederland")
    st.write("De architectuur staat klaar. Vanaf hier bouwen we de modules (kaart, filters, API) één voor één in.")

    st.divider()

    # Validatie: Kijken of de datalaag correct is aangesloten
    st.subheader("Data Validatie Check")
    try:
        # Later verplaatsen we deze logica naar utils/data_handler.py
        df = pd.read_csv("data/dummy_campers.csv")
        st.success("Dummy-data succesvol geladen!")
        st.dataframe(df, use_container_width=True)
    except FileNotFoundError:
        st.error("Architectuur-fout: Het bestand 'data/dummy_campers.csv' is niet gevonden. Controleer de mapstructuur.")

if __name__ == "__main__":
    main()
