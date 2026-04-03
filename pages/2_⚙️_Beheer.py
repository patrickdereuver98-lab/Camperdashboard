"""
2_⚙️_Beheer.py — Cloud-Powered Beheer Dashboard voor VrijStaan.
Functies: Google Sheets integratie, API Sync en Slimme AI-verrijking met check-stempel.
"""
import time
import streamlit as st
import pandas as pd
from utils.auth import require_admin_auth
from utils.data_handler import load_data, save_data
from ui.theme import apply_theme, render_sidebar_header
from utils.enrichment import research_location

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
# We laden de data direct uit Google Sheets bij het openen van de pagina.
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

        # ── SLIMME AI VERRIJKING SECTIE (Stabiele Sequentiële Loop) ──
        with st.expander("✨ AI Data Verrijking (Smart Auto Run)", expanded=True):
            st.markdown("Deze stabiele functie doorzoekt websites één voor één en vult ontbrekende data aan in Google Sheets.")

            # 1. Initialiseer de controle-kolom als deze ontbreekt
            if "ai_gecheckt" not in master_df.columns:
                master_df["ai_gecheckt"] = "Nee"

            # 2. Filter: Alleen locaties die nog NOOIT door de AI zijn bezocht
            mask = master_df["ai_gecheckt"] != "Ja"
            to_process_count = int(mask.sum())

            if to_process_count == 0:
                st.success("🎉 Alle locaties in de database zijn al door de AI gecontroleerd!")
            else:
                st.info(f"Er staan **{to_process_count}** locaties klaar voor onderzoek.")
                
                num_to_enrich = st.number_input(
                    "Aantal locaties voor deze run (advies: 50 - 100 per keer)", 
                    min_value=1, 
                    max_value=to_process_count, 
                    value=min(50, to_process_count)
                )
                
                if st.button(f"🚀 Start Onderzoek voor {num_to_enrich} locaties", use_container_width=True, type="primary"):
                    to_process = master_df[mask].head(num_to_enrich)
                    progress_bar = st.progress(0)
                    status_text = st.empty()
                    results_log = []

                    for i, (idx, row) in enumerate(to_process.iterrows()):
                        naam = str(row.get('naam', f'Locatie {i+1}'))
                        status_text.markdown(f"🔍 **{i+1}/{len(to_process)}** — Onderzoek bezig: **{naam}**...")
                        
                        # Roep de originele, stabiele scraper + AI waterval aan
                        try:
                            result = research_location(row)

                            if isinstance(result, dict):
                                for key, value in result.items():
                                    # Voeg kolom toe als deze nog niet bestaat
                                    if key not in master_df.columns:
                                        master_df[key] = "Onbekend"
                                    
                                    # Voorkom crash op lijsten (bijv. 'extra': [])
                                    if isinstance(value, list):
                                        value = ", ".join([str(v) for v in value])
                                    elif isinstance(value, dict):
                                        value = str(value)
                                        
                                    master_df.at[idx, key] = value
                                
                                results_log.append({"naam": naam, "status": "✅ Verrijkt"})
                            else:
                                results_log.append({"naam": naam, "status": "⚠️ Geen data"})

                        except Exception as e:
                            st.error(f"Fout bij locatie {naam}: {e}")
                            results_log.append({"naam": naam, "status": "❌ Fout"})
                        
                        # 3. ZET DE STEMPEL: Deze locatie is nu gecheckt
                        master_df.at[idx, "ai_gecheckt"] = "Ja"
                        
                        # GOOGLE SHEETS QUOTA FIX: Sla op per 10 locaties in plaats van elke locatie
                        if (i + 1) % 10 == 0 or (i + 1) == len(to_process):
                            save_data(master_df)
                            st.toast(f"💾 Tussenopslag bij {i+1} locaties voltooid.")
                        
                        progress_bar.progress((i + 1) / len(to_process))
                        
                        # API RATE LIMIT FIX: Rust inbouwen voor Gemini
                        time.sleep(0.5)

                    status_text.empty()
                    st.success(f"✅ Run van {len(to_process)} locaties succesvol verwerkt en opgeslagen in Google Sheets!")
                    
                    if results_log:
                        with st.expander("📊 Bekijk Resultaten Log", expanded=False):
                            st.dataframe(pd.DataFrame(results_log), use_container_width=True)
                    
                    if st.button("🔄 Dashboard Verversen"):
                        st.rerun()

# ── TAB 2: API SYNC ────────────────────────────────────────────────────────────
with tab_sync:
    st.subheader("OpenStreetMap Synchronisatie")
    st.warning("Let op: Een API Sync kan bestaande handmatige wijzigingen in de cloud overschrijven.")
    
    if st.button("🚀 Start OSM Sync & Update Cloud", use_container_width=True):
        with st.spinner("Nieuwe data ophalen van Overpass API..."):
            from utils.data_handler import load_data_from_osm
            try:
                df_new = load_data_from_osm()
                
                if not df_new.empty:
                    save_data(df_new)
                    st.success(f"✅ Cloud succesvol bijgewerkt met {len(df_new)} locaties.")
                    st.rerun()
                else:
                    st.error("Kon geen data ophalen van OSM.")
            except Exception as e:
                st.error(f"Fout tijdens sync: {e}")

# ── TAB 3: CSV IMPORT ─────────────────────────────────────────────────────────
with tab_import:
    st.subheader("Handmatige CSV naar Cloud Import")
    uploaded = st.file_uploader("Upload een CSV om toe te voegen aan Google Sheets", type="csv")
    
    if uploaded:
        import_df = pd.read_csv(uploaded)
        st.write(f"Bestand bevat {len(import_df)} rijen.")
        
        if st.button("✅ Voeg toe aan huidige Cloud Database"):
            combined_df = pd.concat([master_df, import_df], ignore_index=True).drop_duplicates(subset=['naam', 'latitude', 'longitude'])
            save_data(combined_df)
            st.success("✅ Gegevens samengevoegd en opgeslagen in Google Sheets!")
            st.rerun()
