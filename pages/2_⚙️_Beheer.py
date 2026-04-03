"""
pages/2_⚙️_Beheer.py — Cloud-Powered Beheer Dashboard voor VrijStaan.
Fixes:
  - Rate limit: save_data() was na élke locatie → nu elke 10 + finale save
  - Import: load_data_from_osm bovenaan, niet in button-handler
  - UI: consistente theme-toepassing voor foutmeldingen
  - High-Speed Batch: Geïntegreerd via utils.batch_processor
"""
import streamlit as st
import pandas as pd
import threading

from utils.auth import require_admin_auth
from utils.data_handler import load_data, save_data
from ui.theme import apply_theme, render_sidebar_header

# Importeer de nieuwe batch processor functies
try:
    from utils.batch_processor import (
        run_full_batch, get_onbekend_stats, estimate_batch_time
    )
    BATCH_PROCESSOR_AVAILABLE = True
except ImportError:
    BATCH_PROCESSOR_AVAILABLE = False


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
        # ── HOGE-SNELHEID BATCH VERRIJKING ────────────────────────────────────
        with st.expander("✨ AI Data Verrijking — Hoge-Snelheid Batch", expanded=True):
            if not BATCH_PROCESSOR_AVAILABLE:
                st.error("⚠️ Kan `utils/batch_processor.py` niet vinden. Zorg dat het bestand is geüpload.")
            else:
                # ── Status overzicht ──────────────────────────────────────────
                if "ai_gecheckt" not in master_df.columns:
                    master_df["ai_gecheckt"] = "Nee"

                n_klaar    = int((master_df["ai_gecheckt"] == "Ja").sum())
                n_resterend = len(master_df) - n_klaar
                pct_klaar  = round(n_klaar / len(master_df) * 100) if len(master_df) > 0 else 0

                col_s1, col_s2, col_s3, col_s4 = st.columns(4)
                col_s1.metric("Totaal in database",    f"{len(master_df):,}")
                col_s2.metric("AI Verrijkt ✅",        f"{n_klaar:,}")
                col_s3.metric("Nog te verrijken",      f"{n_resterend:,}")
                col_s4.metric("Voortgang",             f"{pct_klaar}%")

                st.progress(pct_klaar / 100)

                # ── Onbekend-statistieken ─────────────────────────────────────
                if n_klaar > 0:
                    with st.expander("📊 Onbekend-statistieken (kwaliteitscheck)", expanded=False):
                        stats_onb = get_onbekend_stats(master_df)
                        if stats_onb:
                            df_stats = pd.DataFrame([
                                {"Veld": k, "Onbekend": v["onbekend"], "Percentage": f"{v['pct']}%"}
                                for k, v in stats_onb.items()
                            ]).sort_values("Onbekend", ascending=False)
                            st.dataframe(df_stats, use_container_width=True, hide_index=True)
                        st.caption(
                            "Streefwaarde: < 15% Onbekend per veld. "
                            "Parkeerplaatsen zullen structureel 'Nee' tonen voor sanitair/stroom/wifi."
                        )

                st.divider()

                if n_resterend == 0:
                    st.success("🎉 Alle locaties zijn al verrijkt!")
                    if st.button("🔄 Alles opnieuw verrijken (reset stempels)"):
                        master_df["ai_gecheckt"] = "Nee"
                        save_data(master_df)
                        st.rerun()
                else:
                    # ── Batch instellingen ────────────────────────────────────
                    st.markdown("#### ⚙️ Batch instellingen")

                    col_inst1, col_inst2 = st.columns(2)
                    with col_inst1:
                        max_te_verwerken = st.number_input(
                            "Maximaal te verwerken",
                            min_value=10,
                            max_value=len(master_df),
                            value=min(n_resterend, 700),
                            step=50,
                            help="0 = alle resterend locaties"
                        )
                    with col_inst2:
                        st.info(
                            f"⏱️ Geschatte tijd: **{estimate_batch_time(max_te_verwerken)}**\n\n"
                            f"Methode: 20 parallelle scrapers + batches van 5 per AI-aanroep"
                        )

                    # ── Uitleg over de aanpak ─────────────────────────────────
                    with st.expander("ℹ️ Hoe werkt de snelle batch?"):
                        st.markdown("""
            **Stap 1 — Parallelle scraping (20 workers tegelijk)**
            Alle websites, Campercontact en Park4Night worden gelijktijdig opgehaald.
            Dit duurt slechts enkele minuten voor 700 locaties.

            **Stap 2 — Batch AI-verrijking (5 locaties per aanroep)**
            In plaats van 700 losse Gemini-aanroepen worden 5 locaties tegelijk
            in één prompt verwerkt. Dit is **5× sneller** en **5× goedkoper**.
            Gemini zoekt via Search Grounding actief op alle platformen.

            **Stap 3 — Automatisch checkpointing**
            - Elke 25 locaties → CSV backup (snel, lokaal)
            - Elke 50 locaties → Google Sheets (cloud sync)

            **Bij een crash:** herstart gewoon — al verwerkte locaties worden overgeslagen.
                        """)

                    # ── Start knop ────────────────────────────────────────────
                    if "batch_running" not in st.session_state:
                        st.session_state["batch_running"] = False

                    if not st.session_state["batch_running"]:
                        if st.button(
                            f"🚀 Start Hoge-Snelheid Verrijking voor {max_te_verwerken} locaties",
                            type="primary",
                            use_container_width=True,
                        ):
                            st.session_state["batch_running"] = True
                            st.rerun()

                    if st.session_state["batch_running"]:
                        st.warning("⚡ Batch actief — sluit dit venster NIET", icon="⚠️")

                        progress_bar  = st.progress(0.0)
                        status_label  = st.empty()
                        fase_label    = st.empty()
                        metrics_row   = st.empty()

                        def _update_progress(verwerkt, totaal, label):
                            pct = min(verwerkt / totaal, 1.0) if totaal > 0 else 0
                            progress_bar.progress(pct)
                            fase_label.markdown(
                                f"<small style='color:#6B7F94;'>{label}</small>",
                                unsafe_allow_html=True,
                            )

                        def _update_status(tekst):
                            status_label.info(tekst)

                        try:
                            bijgewerkte_df = run_full_batch(
                                master_df        = master_df,
                                max_locations    = int(max_te_verwerken),
                                progress_cb      = _update_progress,
                                status_cb        = _update_status,
                            )

                            # Finale opslag
                            save_data(bijgewerkte_df)

                            n_nu_klaar = int((bijgewerkte_df["ai_gecheckt"] == "Ja").sum())
                            progress_bar.progress(1.0)
                            status_label.success(
                                f"✅ Batch voltooid! {n_nu_klaar}/{len(bijgewerkte_df)} locaties verrijkt."
                            )

                            # Toon verbeteringsstatistieken
                            onb_stats = get_onbekend_stats(bijgewerkte_df)
                            if onb_stats:
                                st.markdown("#### 📈 Kwaliteitsresultaat")
                                df_res = pd.DataFrame([
                                    {"Veld": k, "Onbekend": v["onbekend"], "%": f"{v['pct']}%"}
                                    for k, v in onb_stats.items()
                                ]).sort_values("Onbekend")
                                st.dataframe(df_res, use_container_width=True, hide_index=True)

                        except Exception as e:
                            st.error(f"❌ Batch fout: {e}")
                            st.info("💾 Voortgang is bewaard in CSV. Herstart om door te gaan.")
                        finally:
                            st.session_state["batch_running"] = False

                        if st.button("🔄 Dashboard verversen"):
                            st.rerun()

        st.subheader("Actuele Cloud Dataset")
        st.dataframe(master_df.head(100), use_container_width=True, height=380)


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
