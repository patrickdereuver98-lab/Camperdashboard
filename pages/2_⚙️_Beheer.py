"""
2_⚙️_Beheer.py — Beveiligd beheer-dashboard.
"""
import os
import pandas as pd
import streamlit as st

from utils.auth import require_admin_auth
from utils.data_handler import load_data, validate_and_merge, CSV_PATH
from ui.theme import apply_theme, render_sidebar_header
# CHIRURGISCHE TOEVOEGING 1: Import van de verrijkingsfunctie
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

# ── TAB 1: API SYNC ────────────────────────────────────────────────────────────
with tab_sync:
    st.subheader("OpenStreetMap Synchronisatie")
    st.info(
        "Haalt de nieuwste camperplaatsdata op via de Overpass API. "
        "Probeert automatisch meerdere mirrors bij een timeout. Duurt ±30–90 seconden."
    )

    col_btn, col_status = st.columns([1, 2])
    with col_btn:
        if st.button("🚀 Start API Sync", use_container_width=True):
            with st.spinner("Verbinding maken met OSM Overpass API..."):
                load_data.clear()
                df_new = load_data()

            if not df_new.empty:
                st.success(f"✅ Sync voltooid! **{len(df_new)}** locaties opgehaald en opgeslagen.")
                st.session_state["master_df"] = df_new

                prov_counts = df_new["provincie"].value_counts().head(5)
                st.markdown("**Top 5 provincies:**")
                for prov, cnt in prov_counts.items():
                    st.markdown(f"- {prov}: {cnt} locaties")
            else:
                st.error("❌ Sync mislukt of geen data ontvangen. Controleer de logs.")

# ── TAB 2: CSV IMPORT ─────────────────────────────────────────────────────────
with tab_import:
    st.subheader("Handmatige CSV Import")
    st.info(
        "Upload een CSV-bestand (bijv. uit de Facebook-groep). "
        "Ontbrekende kolommen worden automatisch aangevuld. "
        "Duplicaten op naam+coördinaten worden verwijderd."
    )

    st.markdown("**Verwachte kolommen (minimaal):**")
    st.code("naam, latitude, longitude, provincie, prijs, honden_toegestaan", language="text")

    uploaded = st.file_uploader("Kies een CSV bestand", type="csv")

    if uploaded:
        try:
            import_df = pd.read_csv(uploaded)
            st.success(f"Bestand geladen: **{len(import_df)}** rijen, **{len(import_df.columns)}** kolommen.")

            with st.expander("Preview (eerste 5 rijen)"):
                st.dataframe(import_df.head(5), use_container_width=True)

            if os.path.exists(CSV_PATH):
                master_df = pd.read_csv(CSV_PATH)
            else:
                master_df = pd.DataFrame()

            if st.button("✅ Importeer en merge met master dataset", key="btn_merge_manual", use_container_width=True):
                merged, warnings = validate_and_merge(master_df, import_df)
                merged.to_csv(CSV_PATH, index=False)
                load_data.clear()

                st.success(f"✅ Import geslaagd! Master dataset bevat nu **{len(merged)}** locaties.")
                for w in warnings:
                    st.warning(f"⚠️ {w}")

        except Exception as e:
            st.error(f"Fout bij laden van CSV: {e}")

# ── TAB 3: DATASET OVERZICHT ──────────────────────────────────────────────────
with tab_data:
    st.subheader("Master Dataset")

    if os.path.exists(CSV_PATH):
        master_df = pd.read_csv(CSV_PATH)
        
        m1, m2, m3 = st.columns(3)
        m1.metric("Totaal locaties", len(master_df))
        m2.metric("Gratis", len(master_df[master_df["prijs"].astype(str).str.lower() == "gratis"]))
        m3.metric("Provincies", master_df["provincie"].nunique() if "provincie" in master_df.columns else "–")

        st.dataframe(master_df, use_container_width=True, height=400)

        csv_bytes = master_df.to_csv(index=False).encode("utf-8")
        
        st.download_button(
            "📥 Download actuele API Export",
            data=csv_bytes,
            file_name="api_export_campers.csv",
            mime="text/csv",
        )

        st.divider()

        # CHIRURGISCHE TOEVOEGING 2: AI Verrijkingsblok
        with st.expander("✨ AI Data Verrijking (Beta)"):
            st.write("Verrijk 'Onbekend' velden met Gemini AI onderzoek.")
            
            # Alleen rijen pakken die nog verrijkt moeten worden
            unkn_mask = (master_df['prijs'] == 'Onbekend') | (master_df['honden_toegestaan'] == 'Onbekend')
            to_process_count = len(master_df[unkn_mask])
            
            st.info(f"Er zijn momenteel **{to_process_count}** locaties met onvolledige data.")
            
            num_to_enrich = st.number_input("Aantal locaties om nu te verrijken", min_value=1, max_value=100, value=5)
            
            if st.button(f"🚀 Start AI onderzoek voor {num_to_enrich} locaties", use_container_width=True):
                to_process = master_df[unkn_mask].head(num_to_enrich)
                
                if to_process.empty:
                    st.success("Alle data is al volledig verrijkt!")
                else:
                    progress_bar = st.progress(0)
                    status_text = st.empty()
                    
                    for i, (idx, row) in enumerate(to_process.iterrows()):
                        status_text.text(f"Onderzoek bezig voor: {row['naam']}...")
                        result = research_location(row)
                        
                        if isinstance(result, dict):
                            # Update waarden in de originele dataframe
                            master_df.at[idx, 'prijs'] = result.get('prijs', master_df.at[idx, 'prijs'])
                            master_df.at[idx, 'honden_toegestaan'] = result.get('honden_toegestaan', master_df.at[idx, 'honden_toegestaan'])
                            master_df.at[idx, 'stroom'] = result.get('stroom', master_df.at[idx, 'stroom'])
                            # Beschrijving kolom toevoegen indien niet aanwezig
                            if 'beschrijving' not in master_df.columns:
                                master_df['beschrijving'] = ""
                            master_df.at[idx, 'beschrijving'] = result.get('beschrijving', "")
                        
                        progress_bar.progress((i + 1) / len(to_process))
                    
                    # Opslaan naar CSV
                    master_df.to_csv(CSV_PATH, index=False)
                    load_data.clear()
                    st.success(f"✅ Klaar! {len(to_process)} locaties zijn bijgewerkt.")
                    st.rerun()

        st.divider()

        if st.button("🗑️ Reset master dataset", type="secondary"):
            os.remove(CSV_PATH)
            load_data.clear()
            st.warning("Master dataset verwijderd. Draai een API Sync om opnieuw te beginnen.")
            st.rerun()
    else:
        st.warning("Nog geen master dataset. Draai eerst een API Sync of importeer een CSV.")
