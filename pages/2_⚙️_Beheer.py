"""
2_⚙️_Beheer.py — Beveiligd beheer-dashboard met herstelde Sync/Import en AI-Rapportage.
"""
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

# ── AUTH GUARD ────────────────────────────────────────────────────────────────
if not require_admin_auth():
    st.stop()

# ── UITLOG-KNOP ───────────────────────────────────────────────────────────────
with st.sidebar:
    st.markdown("### ⚙️ Beheer")
    if st.button("🔓 Uitloggen"):
        st.session_state["admin_authenticated"] = False
        st.rerun()

st.title("⚙️ Data & Beheer Dashboard")

tab_sync, tab_import, tab_data = st.tabs(
    ["🚀 API Sync", "📂 CSV Import", "📊 Dataset"]
)

# ── TAB 1: API SYNC (HERSTELD) ─────────────────────────────────────────────────
with tab_sync:
    st.subheader("OpenStreetMap Synchronisatie")
    st.info(
        "Haalt de nieuwste camperplaatsdata op via de Overpass API. "
        "Probeert automatisch meerdere mirrors bij een timeout."
    )

    col_btn, col_status = st.columns([1, 2])
    with col_btn:
        if st.button("🚀 Start API Sync", use_container_width=True):
            with st.spinner("Verbinding maken met OSM Overpass API..."):
                load_data.clear()
                df_new = load_data()

            if not df_new.empty:
                st.success(f"✅ Sync voltooid! **{len(df_new)}** locaties opgehaald.")
                st.session_state["master_df"] = df_new
                
                prov_counts = df_new["provincie"].value_counts().head(5)
                st.markdown("**Top 5 provincies in deze sync:**")
                for prov, cnt in prov_counts.items():
                    st.markdown(f"- {prov}: {cnt} locaties")
            else:
                st.error("❌ Sync mislukt. Controleer de internetverbinding of API-status.")

# ── TAB 2: CSV IMPORT (HERSTELD) ───────────────────────────────────────────────
with tab_import:
    st.subheader("Handmatige CSV Import")
    st.info("Upload een CSV-bestand om nieuwe locaties aan de master-dataset toe te voegen.")

    uploaded = st.file_uploader("Kies een CSV bestand", type="csv")

    if uploaded:
        try:
            import_df = pd.read_csv(uploaded)
            st.success(f"Bestand geladen: **{len(import_df)}** rijen.")

            if os.path.exists(CSV_PATH):
                master_df = pd.read_csv(CSV_PATH)
            else:
                master_df = pd.DataFrame()

            if st.button("✅ Importeer en merge met master", use_container_width=True):
                merged, warnings = validate_and_merge(master_df, import_df)
                merged.to_csv(CSV_PATH, index=False)
                load_data.clear()
                st.success(f"✅ Import geslaagd! Dataset bevat nu **{len(merged)}** locaties.")
                for w in warnings:
                    st.warning(f"⚠️ {w}")
        except Exception as e:
            st.error(f"Fout bij laden van CSV: {e}")

# ── TAB 3: DATASET & AI (VERBETERD) ───────────────────────────────────────────
with tab_data:
    st.subheader("Master Dataset & AI Verrijking")

    if os.path.exists(CSV_PATH):
        master_df = pd.read_csv(CSV_PATH)
        
        m1, m2, m3 = st.columns(3)
        m1.metric("Totaal locaties", len(master_df))
        m2.metric("Gratis", len(master_df[master_df["prijs"].astype(str).str.lower() == "gratis"]))
        m3.metric("Provincies", master_df["provincie"].nunique() if "provincie" in master_df.columns else "–")

        st.dataframe(master_df.head(100), use_container_width=True)

        st.divider()

        # ── AI VERRIJKING SECTIE ──
        with st.expander("✨ AI Data Verrijking (Full Specs)", expanded=True):
            # Veiligheidsmasker: controleer of kolommen bestaan
            prijs_missing = master_df["prijs"] == "Onbekend"
            wifi_missing = master_df["wifi"] == "Onbekend" if "wifi" in master_df.columns else pd.Series([True] * len(master_df))
            
            unkn_mask = prijs_missing | wifi_missing
            to_process_count = int(unkn_mask.sum())

            st.info(f"Er zijn momenteel **{to_process_count}** locaties met onvolledige data.")
            
            num_to_enrich = st.number_input("Aantal locaties voor dit onderzoek", 1, 100, 5)
            
            if st.button(f"🚀 Start Deep Research voor {num_to_enrich} locaties", use_container_width=True):
                to_process = master_df[unkn_mask].head(num_to_enrich)
                progress_bar = st.progress(0)
                status_text = st.empty()
                results_log = []

                for i, (idx, row) in enumerate(to_process.iterrows()):
                    status_text.text(f"🔍 AI onderzoekt nu: {row['naam']}...")
                    result = research_location(row)
                    
                    if isinstance(result, dict):
                        # Update alle 18+ velden dynamisch
                        for key, value in result.items():
                            if key not in master_df.columns:
                                master_df[key] = "Onbekend"
                            master_df.at[idx, key] = value
                        results_log.append(result)
                    
                    progress_bar.progress((i + 1) / len(to_process))
                
                # Opslaan en cache opschonen
                master_df.to_csv(CSV_PATH, index=False)
                load_data.clear()
                
                st.success("✅ Verrijking voltooid!")
                
                # Toon direct wat er gevonden is
                if results_log:
                    st.markdown("### 📊 AI Rapportage")
                    st.dataframe(pd.DataFrame(results_log), use_container_width=True)
                
                if st.button("🔄 Ververs Pagina"):
                    st.rerun()

        st.divider()

        if st.button("🗑️ Reset master dataset", type="secondary"):
            os.remove(CSV_PATH)
            load_data.clear()
            st.warning("Master dataset verwijderd.")
            st.rerun()
    else:
        st.warning("Nog geen master dataset aanwezig.")
