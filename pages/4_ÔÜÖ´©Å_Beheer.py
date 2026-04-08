"""
pages/4_⚙️_Beheer.py — VrijStaan v5 Admin Dashboard.
Pijler 5: API Health monitor (groen/rood bolletje), Systeem Logboek,
Auto-pilot batch, MD5 statistieken.
Pijler 3: Crowdsource meldingen bekijken.
Pijler 0: Technische elementen UITSLUITEND hier.
"""
from __future__ import annotations

import json
import os
import time
from pathlib import Path

import pandas as pd
import streamlit as st

from ui.theme import apply_theme, render_sidebar_header, BRAND_PRIMARY, BORDER, TEXT_MUTED
from utils.auth import require_admin_auth
from utils.data_handler import load_data, save_data
from utils.batch_engine import (
    run_full_batch, get_onbekend_stats,
    estimate_batch_time, check_api_health,
)

# ── PAGINA CONFIGURATIE ────────────────────────────────────────────────────────
st.set_page_config(
    page_title="VrijStaan | Beheer",
    page_icon="⚙️",
    layout="wide",
)
apply_theme()
render_sidebar_header()

if not require_admin_auth():
    st.stop()

with st.sidebar:
    st.markdown(f"""<div style="padding:0.8rem 0.9rem;">
<div style="font-weight:700;color:{BRAND_PRIMARY};margin-bottom:0.5rem;">⚙️ Systeembeheer</div>
</div>""", unsafe_allow_html=True)
    if st.button("🔓 Uitloggen", use_container_width=True):
        st.session_state["admin_authenticated"] = False
        st.rerun()

# ── TITEL ─────────────────────────────────────────────────────────────────────
st.markdown("""<h1 style="font-family:'DM Serif Display',serif;color:var(--vs-text);
margin-bottom:0.2rem;">⚙️ Beheer Dashboard</h1>
<p style="color:var(--vs-muted);margin-bottom:1.5rem;">VrijStaan v5 Administratie</p>""",
    unsafe_allow_html=True)

# ── DATA LADEN ─────────────────────────────────────────────────────────────────
master_df = load_data()

# ── TABS ───────────────────────────────────────────────────────────────────────
tab_status, tab_batch, tab_data, tab_sync, tab_meldingen, tab_import = st.tabs([
    "🟢 API Status",
    "🤖 Auto Batch",
    "📊 Dataset",
    "🚀 OSM Sync",
    "📋 Meldingen",
    "📂 Import",
])


# ══════════════════════════════════════════════════════════════════════════════
# TAB 1: API STATUS MONITOR (Pijler 5)
# ══════════════════════════════════════════════════════════════════════════════
with tab_status:
    st.subheader("🟢 API Status Monitor")
    st.markdown(f"<span style='font-size:0.82rem;color:{TEXT_MUTED};'>Klik 'Vernieuwen' om actuele status op te halen.</span>",
        unsafe_allow_html=True)

    col_refresh, col_empty = st.columns([1, 4])
    with col_refresh:
        vernieuwen = st.button("🔄 Vernieuwen", type="secondary")

    if vernieuwen or "api_health" not in st.session_state:
        with st.spinner("API-status controleren…"):
            st.session_state["api_health"] = check_api_health()
            st.session_state["api_health_time"] = time.strftime("%H:%M:%S")

    health = st.session_state.get("api_health", {})
    health_time = st.session_state.get("api_health_time", "?")

    st.markdown(f"<span style='font-size:0.75rem;color:{TEXT_MUTED};'>Laatste check: {health_time}</span>",
        unsafe_allow_html=True)
    st.write("")

    services = [
        ("Gemini API",      health.get("Gemini API", False),     "AI-verrijking en zoekopdrachten"),
        ("OSM Overpass",    health.get("OSM Overpass", False),   "OpenStreetMap data ophalen"),
        ("Google Sheets",   health.get("Google Sheets", False),  "Cloud database synchronisatie"),
    ]
    for name, is_ok, beschrijving in services:
        dot_cls  = "green" if is_ok else "red"
        status_s = "✅ Operationeel" if is_ok else "❌ Niet bereikbaar"
        st.markdown(f"""
<div class="vs-status-row">
  <span class="vs-status-dot {dot_cls}"></span>
  <div style="flex:1;">
    <strong style="font-size:0.88rem;">{name}</strong>
    <span style="font-size:0.76rem;color:var(--vs-muted);margin-left:8px;">{beschrijving}</span>
  </div>
  <span style="font-size:0.82rem;font-weight:600;">{status_s}</span>
</div>""", unsafe_allow_html=True)

    st.markdown("---")
    st.subheader("📋 Systeem Logboek")

    log_path = Path("logs/vrijstaan.log")
    if log_path.exists():
        try:
            lines = log_path.read_text(encoding="utf-8", errors="replace").splitlines()
            recent = lines[-100:][::-1]  # Laatste 100, nieuwste boven
            log_text = "\n".join(recent)
            st.text_area("Recente log-entries (nieuwste boven)", log_text,
                         height=350, label_visibility="collapsed")
            col_dl, col_clr = st.columns(2)
            with col_dl:
                st.download_button(
                    "📥 Download logboek",
                    data=log_path.read_bytes(),
                    file_name="vrijstaan.log",
                    mime="text/plain",
                )
            with col_clr:
                if st.button("🗑️ Log wissen", type="secondary"):
                    log_path.write_text("", encoding="utf-8")
                    st.success("Log gewist.")
                    st.rerun()
        except Exception as e:
            st.error(f"Log lezen mislukt: {e}")
    else:
        st.info("Nog geen log-bestand aanwezig (logs/vrijstaan.log).")


# ══════════════════════════════════════════════════════════════════════════════
# TAB 2: AUTO BATCH (Pijler 5)
# ══════════════════════════════════════════════════════════════════════════════
with tab_batch:
    st.subheader("🤖 Volautomatische AI Verrijking")
    st.markdown("""
**Auto-Pilot pipeline voor alle 750 locaties:**
1. **IO-fase:** Websites parallel scrapen (20 workers) + foto's ophalen
2. **MD5 hash-check:** Ongewijzigde websites worden OVERGESLAGEN (sneller!)
3. **Compute-fase:** Gemini 2.5 Flash verrijkt sequentieel (geen deadlocks)
4. **Pijler 6:** Drukte-indicator, max voertuiglengte, Remote Work Score
5. **Checkpoints:** CSV elke 25 · Sheets elke 50 · Auto-resume na herstart
""")

    if master_df.empty:
        st.error("Geen data. Voer eerst een OSM Sync uit (tab 4).")
    else:
        if "ai_gecheckt" not in master_df.columns:
            master_df["ai_gecheckt"] = "Nee"
        nog_te_doen = int((master_df["ai_gecheckt"] != "Ja").sum())
        al_klaar    = len(master_df) - nog_te_doen

        c1, c2, c3 = st.columns(3)
        c1.metric("✅ Al verrijkt",  f"{al_klaar}/{len(master_df)}")
        c2.metric("⏳ Openstaand",   f"{nog_te_doen}")
        c3.metric("⏱️ Geschatte tijd", estimate_batch_time(nog_te_doen))

        st.divider()

        cfg1, cfg2 = st.columns(2)
        with cfg1:
            max_run = st.number_input("Max locaties voor deze run (0=alle)", 0, len(master_df), 0)
        with cfg2:
            reset_cp = st.checkbox("♻️ Alle stempels wissen (opnieuw beginnen)", False)

        if reset_cp:
            st.warning("⚠️ Dit verwerkt de VOLLEDIGE database opnieuw!")

        start_btn = st.button(
            f"🚀 Start Auto-Pilot ({nog_te_doen if not reset_cp else len(master_df)} locaties)",
            type="primary", use_container_width=True,
            disabled=(nog_te_doen == 0 and not reset_cp),
        )

        if start_btn:
            if reset_cp:
                master_df["ai_gecheckt"] = "Nee"
                cp = Path("data/checkpoints/batch_progress.csv")
                if cp.exists():
                    cp.unlink()

            pbar     = st.progress(0.0)
            stat_box = st.empty()
            stop_req = [False]

            if st.button("🛑 Stop na huidige batch", type="secondary"):
                stop_req[0] = True

            def _progress(done: int, total: int, label: str) -> None:
                pbar.progress(min(done / max(total, 1), 1.0))
                stat_box.info(f"**{label}** — {done}/{total} ({done/max(total,1)*100:.0f}%)")

            def _status(msg: str) -> None:
                stat_box.info(f"📋 {msg}")

            try:
                result_df = run_full_batch(
                    master_df, int(max_run), _progress, _status, lambda: stop_req[0]
                )
                pbar.progress(1.0)
                stat_box.success("✅ Batch voltooid!")
                save_data(result_df)
                st.success(f"💾 {len(result_df)} locaties opgeslagen in Google Sheets.")
                st.balloons()
            except Exception as e:
                st.error(f"❌ Batch fout: {e}")


# ══════════════════════════════════════════════════════════════════════════════
# TAB 3: DATASET
# ══════════════════════════════════════════════════════════════════════════════
with tab_data:
    st.subheader("📊 Dataset Overzicht")

    if master_df.empty:
        st.warning("⚠️ Database leeg of niet bereikbaar.")
    else:
        gecheckt   = int((master_df.get("ai_gecheckt", pd.Series(dtype=str)) == "Ja").sum())
        gratis     = int(master_df["prijs"].astype(str).str.lower().str.contains("gratis", na=False).sum())
        has_photos = int(master_df.get("photos", pd.Series(dtype=str)).astype(str).str.len().gt(5).sum()) if "photos" in master_df.columns else 0
        drukte_ok  = int(master_df.get("drukte_indicator", pd.Series(dtype=str)).astype(str).str.lower().ne("onbekend").sum()) if "drukte_indicator" in master_df.columns else 0

        kpi1, kpi2, kpi3, kpi4 = st.columns(4)
        kpi1.metric("📍 Locaties",        f"{len(master_df):,}")
        kpi2.metric("🤖 AI verrijkt",     f"{gecheckt}/{len(master_df)}")
        kpi3.metric("📸 Met foto's",      f"{has_photos:,}")
        kpi4.metric("🔴 Drukte-data",     f"{drukte_ok:,}")

        with st.expander("📊 Onbekend-statistieken per veld", expanded=False):
            stats = get_onbekend_stats(master_df)
            if stats:
                sdf = pd.DataFrame([
                    {"Veld": k, "# Onbekend": v["onbekend"], "%": f"{v['pct']}%"}
                    for k, v in sorted(stats.items(), key=lambda x: -x[1]["onbekend"])
                ])
                st.dataframe(sdf, use_container_width=True, hide_index=True)

        st.subheader("Eerste 100 rijen")
        st.dataframe(master_df.head(100), use_container_width=True, height=360)

        csv_bytes = master_df.to_csv(index=False).encode("utf-8")
        st.download_button("📥 Volledige CSV downloaden", csv_bytes,
                           "vrijstaan_export.csv", "text/csv")


# ══════════════════════════════════════════════════════════════════════════════
# TAB 4: OSM SYNC (Pijler 5: Exponential Backoff)
# ══════════════════════════════════════════════════════════════════════════════
with tab_sync:
    st.subheader("🌍 OpenStreetMap Synchronisatie")
    st.info("OSM sync gebruikt exponential backoff en roteert over 3 Overpass endpoints (Pijler 5).")
    st.warning("⚠️ Sync kan handmatige wijzigingen overschrijven. Maak eerst een backup!")

    col_bk, col_sync = st.columns(2)
    with col_bk:
        if not master_df.empty:
            st.download_button(
                "📥 CSV Backup downloaden",
                master_df.to_csv(index=False).encode("utf-8"),
                "vrijstaan_backup.csv", "text/csv",
                use_container_width=True,
            )
    with col_sync:
        if st.button("🚀 Start OSM Sync", type="primary", use_container_width=True):
            with st.spinner("OSM data ophalen (exponential backoff ingeschakeld)…"):
                try:
                    from utils.data_handler import load_data_from_osm
                    df_new = load_data_from_osm()
                    if not df_new.empty:
                        save_data(df_new)
                        st.success(f"✅ {len(df_new)} locaties opgeslagen.")
                        st.rerun()
                    else:
                        st.error("Geen data ontvangen van OSM.")
                except Exception as e:
                    st.error(f"OSM sync fout: {e}")


# ══════════════════════════════════════════════════════════════════════════════
# TAB 5: CROWDSOURCE MELDINGEN (Pijler 3)
# ══════════════════════════════════════════════════════════════════════════════
with tab_meldingen:
    st.subheader("📋 Crowdsource Meldingen")
    st.markdown("Correcties ingediend door gebruikers via het 'Foutje gezien?' formulier.")

    melding_path = Path("data/meldingen.json")
    if not melding_path.exists():
        st.info("Nog geen meldingen ontvangen.")
    else:
        try:
            meldingen = json.loads(melding_path.read_text(encoding="utf-8"))
            if not meldingen:
                st.info("Geen openstaande meldingen.")
            else:
                mdf = pd.DataFrame(meldingen)
                # Filter op status
                status_filter = st.selectbox(
                    "Filter op status", ["alle", "nieuw", "verwerkt", "afgewezen"]
                )
                if status_filter != "alle":
                    mdf = mdf[mdf["status"] == status_filter]

                st.metric("📋 Openstaande meldingen",
                          int((mdf["status"] == "nieuw").sum()) if "status" in mdf else 0)

                for i, row in mdf.iterrows():
                    with st.expander(
                        f"[{row.get('status','?').upper()}] {row.get('naam','?')} · "
                        f"{row.get('veld','?')} · {row.get('timestamp','?')[:10]}",
                        expanded=False,
                    ):
                        st.markdown(f"**Locatie:** {row.get('naam','?')}")
                        st.markdown(f"**Veld:** {row.get('veld','?')}")
                        st.markdown(f"**Correctie:** {row.get('correctie','?')}")
                        st.markdown(f"**Opmerking:** {row.get('opmerking','?') or '—'}")

                        actieCols = st.columns(3)
                        with actieCols[0]:
                            if st.button("✅ Verwerkt", key=f"ok_{i}"):
                                meldingen[i]["status"] = "verwerkt"
                                melding_path.write_text(
                                    json.dumps(meldingen, ensure_ascii=False, indent=2)
                                )
                                st.rerun()
                        with actieCols[1]:
                            if st.button("❌ Afwijzen", key=f"rej_{i}"):
                                meldingen[i]["status"] = "afgewezen"
                                melding_path.write_text(
                                    json.dumps(meldingen, ensure_ascii=False, indent=2)
                                )
                                st.rerun()

                # Bulk export
                mdf_export = pd.DataFrame(meldingen)
                st.download_button(
                    "📥 Alle meldingen downloaden",
                    mdf_export.to_csv(index=False).encode("utf-8"),
                    "vrijstaan_meldingen.csv", "text/csv",
                )

        except Exception as e:
            st.error(f"Meldingen laden mislukt: {e}")


# ══════════════════════════════════════════════════════════════════════════════
# TAB 6: CSV IMPORT
# ══════════════════════════════════════════════════════════════════════════════
with tab_import:
    st.subheader("📂 CSV Import")
    uploaded = st.file_uploader("Upload CSV bestand", type="csv")
    if uploaded:
        try:
            import_df = pd.read_csv(uploaded)
            st.write(f"**{len(import_df)} rijen** gevonden.")
            st.dataframe(import_df.head(10), use_container_width=True)

            m_col, r_col = st.columns(2)
            with m_col:
                if st.button("✅ Samenvoegen", type="primary"):
                    combined = pd.concat([master_df, import_df], ignore_index=True)
                    combined = combined.drop_duplicates(subset=["naam", "latitude", "longitude"])
                    save_data(combined)
                    st.success(f"✅ {len(combined)} locaties opgeslagen.")
                    st.rerun()
            with r_col:
                if st.button("⚠️ Vervangen", type="secondary"):
                    save_data(import_df)
                    st.warning(f"Database vervangen door {len(import_df)} rijen.")
                    st.rerun()
        except Exception as e:
            st.error(f"CSV lezen mislukt: {e}")
