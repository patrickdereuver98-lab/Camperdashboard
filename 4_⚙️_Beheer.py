"""
pages/4_⚙️_Beheer.py — Beheer Dashboard VrijStaan v5.
Pijler 0: B2B-backend — GEEN technische rommel op de voorkant.
Pijler 5: Status monitor, systeem logboek, volautomatische batch.

Bevat:
  - API Health Monitor (Gemini, OSM) met groen/rood bolletje
  - Centraal error-logboek
  - Volautomatische AI-batch (incl. MD5 hash-skip, stop-knop)
  - Crowdsource-inzendingen bekijken
  - OSM Sync met Exponential Backoff (Pijler 5)
  - CSV Import / Export
"""
from __future__ import annotations

import json
import os
import time
from datetime import datetime

import pandas as pd
import streamlit as st

from ui.theme import apply_theme, render_sidebar_header, P_BLUE, BORDER, TEXT_MUTE
from utils.auth import require_admin_auth
from utils.data_handler import load_data, save_data
from utils.batch_engine import (
    run_full_batch,
    get_onbekend_stats,
    estimate_batch_time,
    fetch_osm_with_backoff,
)
from utils.logger import logger

# ── PAGINA CONFIG ──────────────────────────────────────────────────────────────
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

# ── SIDEBAR ────────────────────────────────────────────────────────────────────
with st.sidebar:
    st.markdown(
        f"<div style='padding:0.8rem 0.8rem 0.2rem;font-weight:700;color:{P_BLUE};'>"
        f"⚙️ Systeembeheer</div>",
        unsafe_allow_html=True,
    )
    if st.button("🔓 Uitloggen", use_container_width=True):
        st.session_state["admin_authenticated"] = False
        st.rerun()

# ── HEADER ─────────────────────────────────────────────────────────────────────
st.markdown(
    f"<h1 style='font-family:Syne,sans-serif;font-weight:800;color:#1A1A2E;"
    f"margin-bottom:0.2rem;'>⚙️ Beheer Dashboard</h1>"
    f"<p style='color:{TEXT_MUTE};margin-bottom:1.5rem;'>VrijStaan Admin v5</p>",
    unsafe_allow_html=True,
)

# ── DATA LADEN ─────────────────────────────────────────────────────────────────
master_df = load_data()

# ── TABS ───────────────────────────────────────────────────────────────────────
tab_status, tab_batch, tab_crowd, tab_sync, tab_import = st.tabs([
    "🟢 Status & Log",
    "🤖 Auto AI Batch",
    "📝 Crowdsource",
    "🌍 OSM Sync",
    "📂 CSV Import",
])


# ══════════════════════════════════════════════════════════════════════════════
# TAB 1: STATUS MONITOR & LOGBOEK (Pijler 5)
# ══════════════════════════════════════════════════════════════════════════════
with tab_status:
    st.subheader("🟢 API Status Monitor")
    st.caption("Live health-check van externe API's.")

    col_g, col_osm, col_gs = st.columns(3)

    # ── Gemini API check ─────────────────────────────────────────────
    with col_g:
        try:
            import requests as _req
            api_key = st.secrets.get("GEMINI_API_KEY", "")
            if api_key:
                resp = _req.get(
                    f"https://generativelanguage.googleapis.com/v1beta/models?key={api_key}",
                    timeout=5,
                )
                gemini_ok = resp.status_code == 200
            else:
                gemini_ok = False
        except Exception:
            gemini_ok = False

        dot = "ok" if gemini_ok else "err"
        label = "Online" if gemini_ok else "Offline / Key ontbreekt"
        st.markdown(f"""
<div class="vs-api-status">
  <div class="vs-status-dot {dot}"></div>
  <div>
    <div style="font-weight:700;font-size:0.88rem;">Gemini AI (Google)</div>
    <div style="font-size:0.73rem;color:{TEXT_MUTE};">{label}</div>
  </div>
</div>""", unsafe_allow_html=True)

    # ── Overpass (OSM) API check ──────────────────────────────────────
    with col_osm:
        try:
            resp_osm = _req.get(
                "https://overpass-api.de/api/status",
                headers={"User-Agent": "VrijStaan/5.0"},
                timeout=5,
            )
            osm_ok = resp_osm.status_code == 200
        except Exception:
            osm_ok = False

        dot_osm = "ok" if osm_ok else "err"
        label_osm = "Online" if osm_ok else "Offline / Blokkade"
        st.markdown(f"""
<div class="vs-api-status">
  <div class="vs-status-dot {dot_osm}"></div>
  <div>
    <div style="font-weight:700;font-size:0.88rem;">Overpass API (OSM)</div>
    <div style="font-size:0.73rem;color:{TEXT_MUTE};">{label_osm}</div>
  </div>
</div>""", unsafe_allow_html=True)

    # ── Google Sheets check ───────────────────────────────────────────
    with col_gs:
        sheets_ok = not master_df.empty
        dot_gs    = "ok" if sheets_ok else "warn"
        label_gs  = f"{len(master_df)} rijen geladen" if sheets_ok else "Leeg of niet bereikbaar"
        st.markdown(f"""
<div class="vs-api-status">
  <div class="vs-status-dot {dot_gs}"></div>
  <div>
    <div style="font-weight:700;font-size:0.88rem;">Google Sheets</div>
    <div style="font-size:0.73rem;color:{TEXT_MUTE};">{label_gs}</div>
  </div>
</div>""", unsafe_allow_html=True)

    st.divider()

    # ── KPI's ─────────────────────────────────────────────────────────
    if not master_df.empty:
        c1, c2, c3, c4, c5 = st.columns(5)
        gecheckt  = int((master_df.get("ai_gecheckt", pd.Series("Nee")) == "Ja").sum())
        gratis    = int(master_df["prijs"].astype(str).str.lower().str.contains("gratis", na=False).sum())
        met_foto  = int(master_df.get("photos", pd.Series("[]")).astype(str).str.len().gt(5).sum())
        hash_fills = int(master_df.get("text_hash", pd.Series("")).astype(str).str.len().gt(5).sum())

        c1.metric("📍 Locaties", f"{len(master_df):,}")
        c2.metric("🤖 AI Verrijkt", f"{gecheckt}/{len(master_df)}")
        c3.metric("💰 Gratis", f"{gratis:,}")
        c4.metric("📸 Met foto's", f"{met_foto:,}")
        c5.metric("🔑 MD5 Hashes", f"{hash_fills:,}")

        # Onbekend-statistieken
        with st.expander("📊 Datakwaliteit per veld", expanded=False):
            stats = get_onbekend_stats(master_df)
            if stats:
                sdf = pd.DataFrame([
                    {"Veld": k, "Onbekend": v["onbekend"], "%": f"{v['pct']}%"}
                    for k, v in stats.items()
                ]).sort_values("Onbekend", ascending=False)
                st.dataframe(sdf, use_container_width=True, hide_index=True)

    # ── Logboek ───────────────────────────────────────────────────────
    st.subheader("📋 Systeem Logboek")
    log_path = "logs/vrijstaan.log"
    if os.path.exists(log_path):
        with open(log_path, "r", encoding="utf-8", errors="replace") as f:
            lines = f.readlines()
        laatste = lines[-50:]  # laatste 50 regels

        log_html = ""
        for line in reversed(laatste):
            line = line.strip()
            if not line:
                continue
            lvl = "err" if "ERROR" in line else "warn" if "WARNING" in line else "info"
            log_html += f'<div class="vs-log-entry {lvl}">{line}</div>'

        st.markdown(
            f'<div style="background:#0F1117;border-radius:10px;padding:1rem;'
            f'max-height:300px;overflow-y:auto;border:1px solid #2D3150;">'
            f'{log_html}</div>',
            unsafe_allow_html=True,
        )
        if st.button("🗑️ Log wissen", type="secondary"):
            with open(log_path, "w") as f:
                f.write("")
            st.success("Logboek gewist.")
            st.rerun()
    else:
        st.info("Geen logboek gevonden.")


# ══════════════════════════════════════════════════════════════════════════════
# TAB 2: VOLAUTOMATISCHE AI BATCH
# ══════════════════════════════════════════════════════════════════════════════
with tab_batch:
    st.subheader("🤖 Volautomatische AI Verrijking")
    st.markdown(f"""
**Pipeline:** Parallel scrapen (20 workers) → MD5 hash-check (skip ongewijzigd)
→ Gemini 2.5 Flash verrijkt in batches van 5 → Pijler 6 velden → Checkpoint saves.
""")

    if master_df.empty:
        st.error("Geen data. Voer eerst een OSM Sync uit.")
    else:
        if "ai_gecheckt" not in master_df.columns:
            master_df["ai_gecheckt"] = "Nee"

        mask       = master_df["ai_gecheckt"] != "Ja"
        nog_te_doen = int(mask.sum())
        al_klaar   = len(master_df) - nog_te_doen

        c_info1, c_info2, c_info3 = st.columns(3)
        c_info1.metric("✅ Verwerkt",   f"{al_klaar}/{len(master_df)}")
        c_info2.metric("⏳ Te doen",    f"{nog_te_doen}")
        c_info3.metric("⏱️ Schatting",  estimate_batch_time(nog_te_doen))

        st.divider()

        c_cfg1, c_cfg2 = st.columns(2)
        with c_cfg1:
            max_run = st.number_input(
                "Max locaties (0 = alle)",
                min_value=0, max_value=max(len(master_df), 1), value=0,
            )
        with c_cfg2:
            reset_cp = st.checkbox(
                "♻️ Checkpoint wissen (opnieuw beginnen)",
                help="Verwijdert alle ai_gecheckt=Ja stempels.",
            )

        if reset_cp:
            st.warning("⚠️ Dit verwijdert alle AI-stempels. Hele dataset wordt opnieuw verwerkt.")

        stop_requested = [False]
        start_btn = st.button(
            f"🚀 Start Batch ({nog_te_doen if not reset_cp else len(master_df)} locaties)",
            type="primary",
            use_container_width=True,
            disabled=(nog_te_doen == 0 and not reset_cp),
        )
        stop_btn = st.button("🛑 Stop na huidige batch", type="secondary")
        if stop_btn:
            stop_requested[0] = True

        if start_btn:
            if reset_cp:
                master_df["ai_gecheckt"] = "Nee"
                cp_path = "data/checkpoints/batch_progress.csv"
                if os.path.exists(cp_path):
                    os.remove(cp_path)

            pb    = st.progress(0.0)
            s_box = st.empty()
            l_box = st.empty()

            def _prog(done: int, total: int, label: str) -> None:
                pb.progress(min(done / max(total, 1), 1.0))
                s_box.markdown(f"**{label}** `{done}/{total}` ({done/max(total,1)*100:.1f}%)")

            def _stat(msg: str) -> None:
                l_box.info(f"📋 {msg}")

            try:
                verrijkt = run_full_batch(
                    master_df      = master_df,
                    max_locations  = int(max_run),
                    progress_cb    = _prog,
                    status_cb      = _stat,
                    stop_flag      = lambda: stop_requested[0],
                )
                pb.progress(1.0)
                s_box.success("✅ Batch voltooid!")
                save_data(verrijkt)
                st.success(f"💾 {len(verrijkt)} locaties opgeslagen.")
                st.balloons()
            except Exception as e:
                st.error(f"❌ Fout: {e}")
                logger.error(f"Batch fout in Beheer: {e}")


# ══════════════════════════════════════════════════════════════════════════════
# TAB 3: CROWDSOURCE INZENDINGEN (Pijler 3)
# ══════════════════════════════════════════════════════════════════════════════
with tab_crowd:
    st.subheader("📝 Gebruikerscorrecties (Crowdsource)")
    crowd_path = "data/crowdsource.json"

    if not os.path.exists(crowd_path):
        st.info("Nog geen correctie-inzendingen ontvangen.")
    else:
        try:
            with open(crowd_path, "r", encoding="utf-8") as f:
                entries = json.load(f)

            if not entries:
                st.info("Geen inzendingen.")
            else:
                st.caption(f"{len(entries)} correctie(s) ontvangen")
                crowd_df = pd.DataFrame(entries)
                st.dataframe(crowd_df, use_container_width=True, hide_index=True)

                col_dl, col_clear = st.columns(2)
                with col_dl:
                    csv_b = crowd_df.to_csv(index=False).encode("utf-8")
                    st.download_button(
                        "📥 Download CSV",
                        data=csv_b,
                        file_name="crowdsource_inzendingen.csv",
                        mime="text/csv",
                        use_container_width=True,
                    )
                with col_clear:
                    if st.button("🗑️ Wis alle inzendingen", type="secondary"):
                        with open(crowd_path, "w") as f:
                            json.dump([], f)
                        st.success("Inzendingen gewist.")
                        st.rerun()
        except Exception as e:
            st.error(f"Fout bij laden: {e}")


# ══════════════════════════════════════════════════════════════════════════════
# TAB 4: OSM SYNC (met Exponential Backoff)
# ══════════════════════════════════════════════════════════════════════════════
with tab_sync:
    st.subheader("🌍 OpenStreetMap Synchronisatie")
    st.info(
        "**Pijler 5:** De OSM-sync gebruikt Exponential Backoff + custom User-Agent "
        "om Overpass API-blokkades te voorkomen. Bij een 429 of 503 wacht het "
        "automatisch en probeert het via een ander endpoint."
    )
    st.warning("Let op: sync kan bestaande data overschrijven. Maak eerst een backup!")

    col_b, col_s = st.columns(2)
    with col_b:
        if not master_df.empty:
            st.download_button(
                "📥 Download backup CSV",
                data=master_df.to_csv(index=False).encode("utf-8"),
                file_name=f"vrijstaan_backup_{datetime.now().strftime('%Y%m%d_%H%M')}.csv",
                mime="text/csv",
                use_container_width=True,
            )

    with col_s:
        if st.button("🚀 Start OSM Sync", type="primary", use_container_width=True):
            with st.spinner("OSM-data ophalen (met Exponential Backoff)…"):
                try:
                    from utils.data_handler import load_data_from_osm
                    df_new = load_data_from_osm()
                    if not df_new.empty:
                        save_data(df_new)
                        st.success(f"✅ {len(df_new)} locaties gesynchroniseerd.")
                        st.rerun()
                    else:
                        st.error("Geen data opgehaald van OSM.")
                except Exception as e:
                    st.error(f"OSM sync fout: {e}")
                    logger.error(f"OSM sync fout: {e}")


# ══════════════════════════════════════════════════════════════════════════════
# TAB 5: CSV IMPORT
# ══════════════════════════════════════════════════════════════════════════════
with tab_import:
    st.subheader("📂 CSV Import")
    uploaded = st.file_uploader("Upload CSV bestand", type="csv")

    if uploaded:
        try:
            imp_df = pd.read_csv(uploaded)
            st.write(f"**{len(imp_df)} rijen** in bestand.")
            st.dataframe(imp_df.head(10), use_container_width=True)

            c1, c2 = st.columns(2)
            with c1:
                if st.button("✅ Samenvoegen", type="primary"):
                    combined = pd.concat(
                        [master_df, imp_df], ignore_index=True
                    ).drop_duplicates(subset=["naam", "latitude", "longitude"])
                    save_data(combined)
                    st.success(f"✅ {len(combined)} locaties opgeslagen.")
                    st.rerun()
            with c2:
                if st.button("⚠️ Vervangen", type="secondary"):
                    save_data(imp_df)
                    st.warning(f"Database vervangen door {len(imp_df)} rijen.")
                    st.rerun()
        except Exception as e:
            st.error(f"Fout: {e}")

    # Dataset preview
    if not master_df.empty:
        with st.expander("📊 Huidige dataset (eerste 100 rijen)", expanded=False):
            st.dataframe(master_df.head(100), use_container_width=True, height=380)
