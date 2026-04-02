import os
import pandas as pd
import streamlit as st
from utils.auth import require_admin_auth
from utils.data_handler import load_data, validate_and_merge, CSV_PATH
from ui.theme import apply_theme, render_sidebar_header
from utils.enrichment import research_location

st.set_page_config(page_title="VrijStaan | Beheer", page_icon="⚙️", layout="wide")
apply_theme()
render_sidebar_header()

if not require_admin_auth():
    st.stop()

st.title("⚙️ Data & Beheer Dashboard")
tab_sync, tab_import, tab_data = st.tabs(["🚀 API Sync", "📂 CSV Import", "📊 Dataset"])

with tab_data:
    if os.path.exists(CSV_PATH):
        master_df = pd.read_csv(CSV_PATH)
        st.metric("Totaal locaties", len(master_df))
        st.dataframe(master_df.head(50), use_container_width=True)

        with st.expander("✨ AI Data Verrijking (Full Specs)", expanded=True):
            unkn_mask = (master_df['prijs'] == 'Onbekend') | (master_df.get('wifi', 'Onbekend') == 'Onbekend')
            to_process_count = len(master_df[unkn_mask])
            st.info(f"Er zijn nog **{to_process_count}** locaties te verrijken.")
            
            num_to_enrich = st.number_input("Aantal locaties", 1, 100, 5)
            
            if st.button("🚀 Start Volledig Onderzoek"):
                to_process = master_df[unkn_mask].head(num_to_enrich)
                progress_bar = st.progress(0)
                results_log = []
                
                for i, (idx, row) in enumerate(to_process.iterrows()):
                    st.write(f"🔍 AI bezoekt website voor: **{row['naam']}**")
                    result = research_location(row)
                    
                    if isinstance(result, dict):
                        for key, value in result.items():
                            if key not in master_df.columns: master_df[key] = "Onbekend"
                            master_df.at[idx, key] = value
                        results_log.append(result)
                    
                    progress_bar.progress((i + 1) / len(to_process))
                
                master_df.to_csv(CSV_PATH, index=False)
                st.success("✅ Verrijking voltooid!")
                st.markdown("### 📊 AI Resultaten (Direct uit de bron)")
                st.dataframe(pd.DataFrame(results_log), use_container_width=True)
                if st.button("🔄 Ververs Pagina"): st.rerun()

        st.divider()

        if st.button("🗑️ Reset master dataset", type="secondary"):
            os.remove(CSV_PATH)
            load_data.clear()
            st.warning("Master dataset verwijderd. Draai een API Sync om opnieuw te beginnen.")
            st.rerun()
    else:
        st.warning("Nog geen master dataset. Draai eerst een API Sync of importeer een CSV.")
