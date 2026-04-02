import streamlit as st
import pandas as pd
from utils.data_handler import load_data # We hergebruiken de API-functie
import os

st.set_page_config(page_title="VrijStaan | Beheer", page_icon="⚙️", layout="wide")

def admin_page():
    st.title("⚙️ Data & Beheer Dashboard")
    st.write("Gebruik deze pagina om de database te verversen en te beheren.")

    col1, col2 = st.columns(2)

    with col1:
        st.subheader("1. API Update")
        st.info("Haal de nieuwste data op van OpenStreetMap. Dit kan even duren.")
        if st.button("🚀 Start API Sync", use_container_width=True):
            with st.spinner("Verbinding maken met OSM mirrors..."):
                df_new = load_data() # De API-functie uit data_handler
                if not df_new.empty:
                    st.success(f"Sync voltooid! {len(df_new)} locaties opgehaald.")
                    st.session_state['master_df'] = df_new
                else:
                    st.error("Sync mislukt. Probeer het later opnieuw.")

    with col2:
        st.subheader("2. Handmatige Import")
        st.info("Upload hier data uit de Facebook-groep (CSV format).")
        uploaded_file = st.file_uploader("Kies een CSV bestand", type="csv")
        if uploaded_file:
            fb_df = pd.read_csv(uploaded_file)
            st.success("Facebook data geladen!")
            st.dataframe(fb_df.head(3))

    st.divider()

    # Master Overzicht
    st.subheader("📊 Master Dataset Overzicht")
    if os.path.exists("data/api_export_campers.csv"):
        master_df = pd.read_csv("data/api_export_campers.csv")
        st.write(f"Huidige actieve dataset bevat **{len(master_df)}** locaties.")
        
        st.dataframe(master_df, use_container_width=True)
        
        csv = master_df.to_csv(index=False).encode('utf-8')
        st.download_button(
            "📥 Exporteer Master CSV voor Backup",
            data=csv,
            file_name="vrijstaan_master_data.csv",
            mime="text/csv"
        )
    else:
        st.warning("Er is nog geen master dataset gegenereerd. Draai eerst de API Sync.")

if __name__ == "__main__":
    admin_page()
