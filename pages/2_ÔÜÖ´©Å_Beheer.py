"""
pages/2_⚙️_Beheer.py — Admin Dashboard voor VrijStaan v4.
Volledig herschreven met:
  - Volautomatische AI-batch (Pijler 3): alle 750 locaties zonder handmatig klikken
  - Onbekend-statistieken per veld
  - Batch-tijdschatting
  - Foto-scraping status
  - Auto-resume via checkpoint
"""
from __future__ import annotations

import time

import pandas as pd
import streamlit as st

from ui.theme import apply_theme, render_sidebar_header, BRAND_PRIMARY, BORDER
from utils.auth import require_admin_auth
from utils.data_handler import load_data, save_data
from utils.batch_engine import (
    run_full_batch,
    get_onbekend_stats,
    estimate_batch_time,
)

# ── PAGINA CONFIGURATIE ────────────────────────────────────────────────────────
st.set_page_config(
    page_title="VrijStaan | Beheer",
    page_icon="⚙️",
    layout="wide",
)
apply_theme()
render_sidebar_header()

# ── AUTH GUARD ─────────────────────────────────────────────────────────────────
if not require_admin_auth():
    st.stop()

# ── SIDEBAR: UITLOGGEN ─────────────────────────────────────────────────────────
with st.sidebar:
    st.markdown(
        f"<div style='padding:0.8rem;'><strong style='color:{BRAND_PRIMARY};'>"
        f"⚙️ Systeembeheer</strong></div>",
        unsafe_allow_html=True,
    )
    if st.button("🔓 Uitloggen", use_container_width=True):
        st.session_state["admin_authenticated"] = False
        st.rerun()

# ── PAGINATITEL ────────────────────────────────────────────────────────────────
st.markdown(
    f"<h1 style='font-family:DM Serif Display,serif;color:#1A1A2E;margin-bottom:0.2rem;'>"
    f"⚙️ Data & Beheer Dashboard</h1>"
    f"<p style='color:#6B7897;margin-bottom:1.5rem;'>VrijStaan administratie-console</p>",
    unsafe_allow_html=True,
)

# ── DATA LADEN ─────────────────────────────────────────────────────────────────
master_df = load_data()

# ── TABS ───────────────────────────────────────────────────────────────────────
tab_data, tab_batch, tab_sync, tab_import = st.tabs([
    "📊 Dataset",
    "🤖 Auto AI Batch",
    "🚀 OSM Sync",
    "📂 CSV Import",
])


# ══════════════════════════════════════════════════════════════════════════════
# TAB 1: DATASET OVERZICHT
# ══════════════════════════════════════════════════════════════════════════════
with tab_data:
    if master_df.empty:
        st.warning("⚠️ De Google Sheet is momenteel leeg of niet bereikbaar.")
    else:
        # KPI's
        c1, c2, c3, c4 = st.columns(4)
        gecheckt = 0
        if "ai_gecheckt" in master_df.columns:
            gecheckt = int((master_df["ai_gecheckt"] == "Ja").sum())
        gratis = int(
            master_df["prijs"].astype(str).str.lower().str.contains("gratis", na=False).sum()
        )
        has_photos = 0
        if "photos" in master_df.columns:
            has_photos = int(
                master_df["photos"].astype(str).str.len().gt(5).sum()
            )
        c1.metric("📍 Locaties", f"{len(master_df):,}")
        c2.metric("🤖 AI Verrijkt", f"{gecheckt}/{len(master_df)}", f"{gecheckt/max(len(master_df),1)*100:.0f}%")
        c3.metric("💰 Gratis plekken", f"{gratis:,}")
        c4.metric("📸 Met foto's", f"{has_photos:,}")

        # Onbekend statistieken
        with st.expander("📊 Onbekend-statistieken per veld", expanded=False):
            stats_dict = get_onbekend_stats(master_df)
            if stats_dict:
                stats_df = pd.DataFrame([
                    {"Veld": k, "Onbekend": v["onbekend"], "Percentage": f"{v['pct']}%"}
                    for k, v in stats_dict.items()
                ]).sort_values("Onbekend", ascending=False)
                st.dataframe(stats_df, use_container_width=True, hide_index=True)
            else:
                st.info("Statistieken niet beschikbaar.")

        st.subheader("Actuele dataset (eerste 100 rijen)")
        st.dataframe(master_df.head(100), use_container_width=True, height=380)


# ══════════════════════════════════════════════════════════════════════════════
# TAB 2: VOLLEDIG AUTOMATISCHE AI BATCH (Pijler 3)
# ══════════════════════════════════════════════════════════════════════════════
with tab_batch:
    st.subheader("🤖 Volautomatische AI Verrijking")
    st.markdown("""
Deze module verwerkt **alle 750 camperplaatsen** volledig automatisch:
- **Stap 1:** Websites parallel scrapen (20 workers tegelijk)
- **Stap 2:** Foto's ophalen van elke website (meerdere per locatie)
- **Stap 3:** Gemini 2.5 Flash verrijkt in batches van 5 (sequentieel)
- **Checkpoints:** elke 25 locaties CSV, elke 50 naar Google Sheets
- **Auto-resume:** bij herstart gaat hij door waar hij gebleven was
""")

    if master_df.empty:
        st.error("Geen data geladen. Voer eerst een OSM Sync uit.")
    else:
        # Status info
        if "ai_gecheckt" not in master_df.columns:
            master_df["ai_gecheckt"] = "Nee"

        mask       = master_df["ai_gecheckt"] != "Ja"
        nog_te_doen = int(mask.sum())
        al_klaar   = len(master_df) - nog_te_doen

        col_info1, col_info2 = st.columns(2)
        col_info1.metric("✅ Al verwerkt", f"{al_klaar}/{len(master_df)}")
        col_info2.metric("⏳ Nog te doen", f"{nog_te_doen}")

        if nog_te_doen > 0:
            st.info(
                f"**Geschatte verwerkingstijd:** {estimate_batch_time(nog_te_doen)} "
                f"voor {nog_te_doen} locaties."
            )

        st.divider()

        # Configuratie
        c_cfg1, c_cfg2 = st.columns(2)
        with c_cfg1:
            max_this_run = st.number_input(
                "Max locaties voor deze run (0 = alle)",
                min_value=0,
                max_value=len(master_df),
                value=0,
                help="Zet op 0 voor volledige automatische run van alle openstaande locaties.",
            )
        with c_cfg2:
            reset_checkpoint = st.checkbox(
                "♻️ Checkpoint wissen en opnieuw beginnen",
                value=False,
                help="Vink aan om alle 'ai_gecheckt=Ja' stempels te verwijderen.",
            )

        if reset_checkpoint:
            st.warning(
                "⚠️ Dit wist alle AI-stempels. De volledige dataset wordt opnieuw verwerkt!"
            )

        if nog_te_doen == 0 and not reset_checkpoint:
            st.success("🎉 Alle locaties zijn al verrijkt! Vink 'Checkpoint wissen' aan om opnieuw te starten.")

        # Start knop
        col_start, col_stop = st.columns([3, 1])
        with col_start:
            start_batch = st.button(
                f"🚀 Start Volautomatische Batch ({nog_te_doen if not reset_checkpoint else len(master_df)} locaties)",
                type="primary",
                use_container_width=True,
                disabled=(nog_te_doen == 0 and not reset_checkpoint),
            )

        if start_batch:
            # Optioneel: reset stempels
            if reset_checkpoint:
                master_df["ai_gecheckt"] = "Nee"
                import os
                checkpoint_path = "data/checkpoints/batch_progress.csv"
                if os.path.exists(checkpoint_path):
                    os.remove(checkpoint_path)
                st.info("♻️ Checkpoint gewist. Start volledige run…")

            # UI elementen voor voortgang
            progress_bar = st.progress(0.0)
            status_box   = st.empty()
            log_box      = st.empty()
            stop_requested = [False]

            # Stop-knop (apart in een container)
            with st.container():
                if st.button("🛑 Stoppen na huidige batch", type="secondary"):
                    stop_requested[0] = True

            def _progress(done: int, total: int, label: str) -> None:
                pct = done / max(total, 1)
                progress_bar.progress(min(pct, 1.0))
                status_box.markdown(
                    f"**{label}** &nbsp; `{done}/{total}` &nbsp; "
                    f"({pct*100:.1f}%)",
                    unsafe_allow_html=True,
                )

            def _status(msg: str) -> None:
                log_box.info(f"📋 {msg}")

            def _stop() -> bool:
                return stop_requested[0]

            try:
                verrijkt_df = run_full_batch(
                    master_df     = master_df,
                    max_locations = int(max_this_run),
                    progress_cb   = _progress,
                    status_cb     = _status,
                    stop_flag     = _stop,
                )
                progress_bar.progress(1.0)
                status_box.success("✅ Batch voltooid!")

                # Sla definitief op
                save_data(verrijkt_df)
                st.success(
                    f"💾 Alle data opgeslagen in Google Sheets. "
                    f"Totaal: {len(verrijkt_df)} locaties."
                )
                st.balloons()

            except Exception as e:
                st.error(f"❌ Fout tijdens batch: {e}")


# ══════════════════════════════════════════════════════════════════════════════
# TAB 3: OSM SYNC
# ══════════════════════════════════════════════════════════════════════════════
with tab_sync:
    st.subheader("🌍 OpenStreetMap Synchronisatie")
    st.warning(
        "Let op: Een OSM Sync kan bestaande handmatige wijzigingen overschrijven. "
        "Maak eerst een CSV-backup!"
    )

    col_sync, col_backup = st.columns(2)
    with col_backup:
        if not master_df.empty:
            csv_bytes = master_df.to_csv(index=False).encode("utf-8")
            st.download_button(
                "📥 Download CSV-backup",
                data=csv_bytes,
                file_name="vrijstaan_backup.csv",
                mime="text/csv",
                use_container_width=True,
            )

    with col_sync:
        if st.button("🚀 Start OSM Sync & Update Cloud", use_container_width=True, type="primary"):
            with st.spinner("Nieuwe data ophalen van Overpass API…"):
                from utils.data_handler import load_data_from_osm
                try:
                    df_new = load_data_from_osm()
                    if not df_new.empty:
                        save_data(df_new)
                        st.success(
                            f"✅ Cloud bijgewerkt met {len(df_new)} locaties van OSM."
                        )
                        st.rerun()
                    else:
                        st.error("Kon geen data ophalen van OSM.")
                except Exception as e:
                    st.error(f"Fout tijdens OSM sync: {e}")


# ══════════════════════════════════════════════════════════════════════════════
# TAB 4: CSV IMPORT
# ══════════════════════════════════════════════════════════════════════════════
with tab_import:
    st.subheader("📂 CSV naar Cloud Import")
    st.info(
        "Upload een CSV om toe te voegen of te samenvoegen met de huidige database. "
        "Duplicaten worden gefilterd op naam + coördinaten."
    )

    uploaded = st.file_uploader("Upload CSV bestand", type="csv")

    if uploaded:
        try:
            import_df = pd.read_csv(uploaded)
            st.write(f"**{len(import_df)} rijen** gevonden in het bestand.")
            st.dataframe(import_df.head(10), use_container_width=True)

            col_merge, col_replace = st.columns(2)
            with col_merge:
                if st.button("✅ Samenvoegen met bestaande database", type="primary"):
                    combined = pd.concat(
                        [master_df, import_df], ignore_index=True
                    ).drop_duplicates(subset=["naam", "latitude", "longitude"])
                    save_data(combined)
                    st.success(
                        f"✅ {len(combined)} locaties opgeslagen "
                        f"(was {len(master_df)}, nieuw: {len(combined) - len(master_df)})."
                    )
                    st.rerun()

            with col_replace:
                if st.button("⚠️ Vervang volledige database", type="secondary"):
                    save_data(import_df)
                    st.warning(
                        f"⚠️ Database vervangen door {len(import_df)} rijen uit CSV."
                    )
                    st.rerun()

        except Exception as e:
            st.error(f"Fout bij lezen CSV: {e}")
