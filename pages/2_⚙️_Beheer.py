"""
2_⚙️_Beheer.py — Cloud-Powered Beheer Dashboard voor VrijStaan met Turbo-Batching.
"""
import streamlit as st
import pandas as pd
from utils.auth import require_admin_auth
from utils.data_handler import load_data, save_data
from ui.theme import apply_theme, render_sidebar_header
from utils.ai_helper import get_batch_enrichment_results

# ── CONFIGURATIE ──────────────────────────────────────────────────────────────
st.set_page_config(page_title="VrijStaan | Beheer", page_icon="⚙️", layout="wide")
apply_theme()
render_sidebar_header()

# ── AUTH GUARD ────────────────────────────────────────────────────────────────
if not require_admin_auth():
    st.stop()

# ── ZIJBALK ───────────────────────────────────────────────────────────────────
with st.sidebar:
    st.markdown("### ⚙️ Systeembeheer")
    if st.button("🔓 Uitloggen", use_container_width=True):
        st.session_state["admin_authenticated"] = False
        st.rerun()

st.title("⚙️ Data & Beheer Dashboard")

# ── DATA LADEN (CLOUD) ────────────────────────────────────────────────────────
master_df = load_data()

tab_data, tab_sync, tab_import = st.tabs([
    "📊 Dataset & AI Verrijking", 
    "🚀 API Sync", 
    "📂 CSV Import"
])

# ── TAB 1: DATASET & AI VERRIJKING ────────────────────────────────────────────
with tab_data:
    if master_df.empty:
        st.warning("⚠️ De Google Sheet is momenteel leeg of niet bereikbaar.")
    else:
        # Statistieken
        col_m1, col_m2, col_m3 = st.columns(3)
        col_m1.metric("Locaties in Cloud", len(master_df))
        
        gratis_count = len(master_df[master_df["prijs"].astype(str).str.lower() == "gratis"])
        col_m2.metric("Gratis plekken", gratis_count)
        
        if "ai_gecheckt" in master_df.columns:
            gecheckt_count = len(master_df[master_df["ai_gecheckt"] == "Ja"])
            col_m3.metric("AI Verrijkt", f"{gecheckt_count} / {len(master_df)}")
        else:
            col_m3.metric("AI Status", "Geen stempelkolom")

        st.subheader("Actuele Cloud Dataset")
        st.dataframe(master_df.head(100), use_container_width=True, height=400)

        st.divider()

        # ── TURBO AI BATCH VERRIJKING ──
        with st.expander("🚀 Turbo AI Data Verrijking (Batch Mode)", expanded=True):
            st.markdown("Verwerkt 5 locaties per AI-aanroep voor maximale snelheid.")

            if "ai_gecheckt" not in master_df.columns:
                master_df["ai_gecheckt"] = "Nee"

            mask = master_df["ai_gecheckt"] != "Ja"
            to_process_count = int(mask.sum())

            if to_process_count == 0:
                st.success("🎉 Alle locaties zijn gecontroleerd!")
            else:
                st.info(f"Er staan **{to_process_count}** locaties klaar.")
                num_total = st.number_input("Totaal aantal te verwerken voor deze sessie", 5, 500, 50)
                
                if st.button(f"⚡ Start Turbo-Onderzoek", use_container_width=True):
                    # Selecteer de subset voor deze sessie
                    session_subset = master_df[mask].head(num_total)
                    batch_size = 5
                    
                    progress_bar = st.progress(0)
                    status_text = st.empty()
                    
                    # Loop door de subset in stappen van 5
                    for i in range(0, len(session_subset), batch_size):
                        current_batch_df = session_subset.iloc[i : i + batch_size]
                        batch_list = current_batch_df[["naam", "website", "provincie"]].to_dict('records')
                        
                        status_text.markdown(f"🔍 Verwerken batch {i//5 + 1}...")
                        
                        # De Turbo AI-aanroep
                        results = get_batch_enrichment_results(batch_list)
                        
                        if results:
                            for result_item, (idx, _) in zip(results, current_batch_df.iterrows()):
                                for key, value in result_item.items():
                                    if key in master_df.columns:
                                        master_df.at[idx, key] = value
                                master_df.at[idx, "ai_gecheckt"] = "Ja"
                            
                            # Opslaan na elke batch van 5
                            save_data(master_df)
                        
                        progress_bar.progress(min((i + batch_size) / len(session_subset), 1.0))

                    status_text.empty()
                    st.success("✅ Batch succesvol voltooid!")
                    st.button("🔄 Dashboard Verversen")

# ── TAB 2: API SYNC ────────────────────────────────────────────────────────────
with tab_sync:
    st.subheader("OpenStreetMap Synchronisatie")
    if st.button("🚀 Start OSM Sync & Update Cloud", use_container_width=True):
        with st.spinner("Data ophalen..."):
            from utils.data_handler import load_data_from_osm
            df_new = load_data_from_osm()
            if not df_new.empty:
                save_data(df_new)
                st.success(f"✅ Cloud bijgewerkt met {len(df_new)} locaties.")
                st.rerun()

# ── TAB 3: CSV IMPORT ─────────────────────────────────────────────────────────
with tab_import:
    st.subheader("Handmatige CSV Import")
    uploaded = st.file_uploader("Upload CSV", type="csv")
    if uploaded:
        import_df = pd.read_csv(uploaded)
        if st.button("✅ Voeg toe"):
            combined_df = pd.concat([master_df, import_df], ignore_index=True).drop_duplicates(subset=['naam', 'latitude', 'longitude'])
            save_data(combined_df)
            st.rerun()
