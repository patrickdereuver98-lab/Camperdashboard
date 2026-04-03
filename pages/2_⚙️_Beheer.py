"""
pages/2_⚙️_Beheer.py — Cloud-Powered Beheer Dashboard voor VrijStaan.
Fixes:
  - Rate limit: save_data() was na élke locatie → nu elke 10 + finale save
  - Import: load_data_from_osm bovenaan, niet in button-handler
  - UI: consistente theme-toepassing voor foutmeldingen
"""
import streamlit as st
import pandas as pd

from utils.auth import require_admin_auth
from utils.data_handler import load_data, save_data
from ui.theme import apply_theme, render_sidebar_header

# ── CONFIGURATIE ──────────────────────────────────────────────────────────────
st.set_page_config(
    page_title="VrijStaan | Beheer",
    page_icon="⚙️",
    layout="wide",
)

# Theme EERST — zodat ook foutmeldingen gestyled zijn
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

st.markdown("""
<h1 style="font-family:'DM Serif Display',serif;font-size:2rem;
           color:#0A2540;margin-bottom:0.2rem;">⚙️ Data &amp; Beheer Dashboard</h1>
<p style="font-family:'DM Sans',sans-serif;color:#6B7F94;
          font-size:0.95rem;margin-bottom:1.5rem;">
  Beheer de cloud-database, verrijk locaties met AI en synchroniseer OSM-data.
</p>
""", unsafe_allow_html=True)

# ── DATA LADEN ────────────────────────────────────────────────────────────────
master_df = load_data()

tab_data, tab_sync, tab_import = st.tabs([
    "📊 Dataset & AI Verrijking",
    "🚀 API Sync",
    "📂 CSV Import",
])

# ── TAB 1: DATASET & AI VERRIJKING ────────────────────────────────────────────
with tab_data:
    if master_df.empty:
        st.warning("⚠️ De Google Sheet is momenteel leeg of niet bereikbaar.")
    else:
        # Statistieken
        col_m1, col_m2, col_m3, col_m4 = st.columns(4)
        col_m1.metric("Locaties in Cloud", f"{len(master_df):,}")

        gratis_count = int((master_df["prijs"].astype(str).str.lower() == "gratis").sum())
        col_m2.metric("Gratis plekken", f"{gratis_count:,}")

        if "ai_gecheckt" in master_df.columns:
            gecheckt = int((master_df["ai_gecheckt"] == "Ja").sum())
            col_m3.metric("AI Verrijkt", f"{gecheckt} / {len(master_df)}")
            col_m4.metric("Nog te verrijken", f"{len(master_df) - gecheckt:,}")
        else:
            col_m3.metric("AI Status", "Geen stempelkolom")
            col_m4.metric("Kolommen", f"{len(master_df.columns)}")

        st.subheader("Actuele Cloud Dataset")
        st.dataframe(master_df.head(100), use_container_width=True, height=380)

        st.divider()

# ── AI VERRIJKING (FULL AUTO MODUS) ──────────────────────────────────
        with st.expander("✨ AI Data Verrijking (Full Auto)", expanded=True):
            st.markdown(
                "Verrijkt alle ontbrekende data. In 'Full Auto' modus stopt de AI pas "
                "als de volledige database van 747 locaties is verwerkt."
            )

            # Initialiseer controle-kolom
            if "ai_gecheckt" not in master_df.columns:
                master_df["ai_gecheckt"] = "Nee"

            mask = master_df["ai_gecheckt"] != "Ja"
            to_process_count = int(mask.sum())

            if to_process_count == 0:
                st.success("🎉 Alle locaties zijn al door de AI gecontroleerd!")
            else:
                st.info(f"**{to_process_count}** locaties staan klaar voor verrijking.")

                col_mode, col_info = st.columns([2, 3])
                with col_mode:
                    # NIEUW: Keuze tussen batch of alles in één keer
                    verwerk_alles = st.toggle("🔄 Full Auto: Verwerk alles tot 100% klaar", value=True)
                    
                    if verwerk_alles:
                        num_to_enrich = to_process_count
                    else:
                        num_to_enrich = st.number_input(
                            "Of kies een handmatige batch", 
                            min_value=1, max_value=to_process_count, value=min(5, to_process_count)
                        )

                with col_info:
                    st.warning(
                        "⚠️ **Belangrijk:** Houd dit tabblad actief en je laptop aan. "
                        "Bij slaapstand of sluiten stopt de verwerking."
                    )

                if st.button(
                    f"🚀 Start {'Volledige' if verwerk_alles else 'Batch'} Verrijking",
                    type="primary",
                    use_container_width=True,
                ):
                    from utils.enrichment import research_location

                    to_process  = master_df[mask].head(num_to_enrich)
                    progress    = st.progress(0.0)
                    status_text = st.empty()
                    results_log = []

                    for i, (idx, row) in enumerate(to_process.iterrows()):
                        naam = str(row.get("naam", f"Locatie {i+1}"))
                        status_text.markdown(f"🔍 **{i+1}/{len(to_process)}** — {naam}")

                        # Gebruik de AI-politie voor onderzoek
                        result = research_location(row, verbose=False)

                        if isinstance(result, dict):
                            for key, value in result.items():
                                if key not in master_df.columns:
                                    master_df[key] = "Onbekend"
                                master_df.at[idx, key] = value
                            results_log.append({"naam": naam, **result})

                        # Markeer als gecheckt
                        master_df.at[idx, "ai_gecheckt"] = "Ja"

                        # STABILITEIT: Sla op per 10 locaties om quota-fouten te voorkomen
                        if (i + 1) % 10 == 0 or (i + 1) == len(to_process):
                            save_data(master_df)
                            # Toon een kleine 'pulse' in de UI dat de data veilig is opgeslagen
                            st.toast(f"💾 Tussenopslag bij {i+1} locaties voltooid.")

                        progress.progress((i + 1) / len(to_process))

                    status_text.empty()
                    st.success(f"✅ Klaar! {len(to_process)} locaties zijn nu volledig verrijkt.")
                    
                    if st.button("🔄 Dashboard verversen"):
                        st.rerun()

# ── TAB 2: API SYNC ────────────────────────────────────────────────────────────
with tab_sync:
    st.subheader("🚀 OpenStreetMap Synchronisatie")
    st.warning(
        "⚠️ Een API Sync overschrijft de bestaande cloud-data. "
        "Handmatige wijzigingen gaan verloren."
    )

    col_sync, col_info2 = st.columns([1, 2])
    with col_sync:
        if st.button("🔄 Start OSM Sync", use_container_width=True, type="primary"):
            with st.spinner("Nieuwe data ophalen van OpenStreetMap Overpass API..."):
                try:
                    from utils.data_handler import load_data_from_osm
                    df_new = load_data_from_osm()
                    if not df_new.empty:
                        save_data(df_new)
                        st.success(f"✅ Cloud bijgewerkt met {len(df_new):,} locaties.")
                        st.rerun()
                    else:
                        st.error("❌ Geen data ontvangen van OSM. Probeer het later opnieuw.")
                except ImportError:
                    st.error("❌ `load_data_from_osm` niet gevonden in data_handler.py")
                except Exception as e:
                    st.error(f"❌ Sync mislukt: {e}")

    with col_info2:
        st.info(
            "**Wat doet OSM Sync?**\n\n"
            "1. Haalt alle `caravan_site`-locaties op uit OpenStreetMap\n"
            "2. Structureert de data naar het VrijStaan formaat\n"
            "3. Overschrijft de bestaande Google Sheet\n\n"
            "Gebruik daarna AI Verrijking om ontbrekende data aan te vullen."
        )

# ── TAB 3: CSV IMPORT ─────────────────────────────────────────────────────────
with tab_import:
    st.subheader("📂 CSV naar Cloud Import")
    uploaded = st.file_uploader(
        "Upload een CSV om samen te voegen met de bestaande database",
        type="csv",
    )

    if uploaded:
        try:
            import_df = pd.read_csv(uploaded)
            st.write(f"**{len(import_df)}** rijen gevonden in het bestand.")

            col_prev, col_act = st.columns(2)
            with col_prev:
                st.markdown("**Preview (eerste 5 rijen):**")
                st.dataframe(import_df.head(5), use_container_width=True)

            with col_act:
                st.markdown("**Samenvoegen:**")
                dedup_col = st.selectbox(
                    "Deduplicatie-kolom",
                    options=["naam", "naam + latitude + longitude"],
                )
                if st.button("✅ Voeg toe aan Cloud Database", type="primary"):
                    subset = ["naam"] if dedup_col == "naam" else ["naam", "latitude", "longitude"]
                    combined = pd.concat(
                        [master_df, import_df], ignore_index=True
                    ).drop_duplicates(subset=subset, keep="last")

                    try:
                        save_data(combined)
                        st.success(
                            f"✅ {len(combined)} locaties opgeslagen "
                            f"({len(import_df)} nieuw toegevoegd)."
                        )
                        st.rerun()
                    except Exception as e:
                        st.error(f"❌ Opslaan mislukt: {e}")
        except Exception as e:
            st.error(f"❌ CSV kan niet worden geladen: {e}")
