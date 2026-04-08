"""
pages/4_⚙️_Beheer.py — VrijStaan v5.1 Admin Dashboard.

Verbeteringen t.o.v. v5.0:
  - API Health Monitor: gebruikt validate_gemini_key() via REST (geen SDK init).
  - Batch UI correct gekoppeld aan nieuwe multithreaded run_full_batch().
  - BatchStats (hash_skipped, ai_fallback) zichtbaar in voortgang.
  - Crowdsource meldingen: status-workflow intact.
  - Alle 6 tabbladen behouden met identieke styling.
  - GEEN wijzigingen aan frontend/UI-bestanden.
"""
from __future__ import annotations

import json
import time
from pathlib import Path

import pandas as pd
import requests
import streamlit as st

from ui.theme import apply_theme, render_sidebar_header, BRAND_PRIMARY, BORDER, TEXT_MUTED
from utils.auth import require_admin_auth
from utils.data_handler import load_data, save_data
from utils.batch_engine import (
    run_full_batch,
    get_onbekend_stats,
    estimate_batch_time,
    check_api_health,
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

# Sidebar uitloggen
with st.sidebar:
    st.markdown(
        f"""<div style="padding:0.8rem 0.9rem;">
<div style="font-weight:700;color:{BRAND_PRIMARY};margin-bottom:0.5rem;">
⚙️ Systeembeheer</div></div>""",
        unsafe_allow_html=True,
    )
    if st.button("🔓 Uitloggen", use_container_width=True):
        st.session_state["admin_authenticated"] = False
        st.rerun()

# ── PAGINATITEL ────────────────────────────────────────────────────────────────
st.markdown(
    """<h1 style="font-family:'DM Serif Display',serif;color:var(--vs-text);
margin-bottom:0.2rem;">⚙️ Beheer Dashboard</h1>
<p style="color:var(--vs-muted);margin-bottom:1.5rem;">VrijStaan v5.1 Administratie</p>""",
    unsafe_allow_html=True,
)

# ── DATA LADEN ─────────────────────────────────────────────────────────────────
master_df = load_data()

# ── TABS ───────────────────────────────────────────────────────────────────────
(
    tab_status,
    tab_batch,
    tab_data,
    tab_sync,
    tab_meldingen,
    tab_import,
) = st.tabs([
    "🟢 API Status",
    "🤖 Auto Batch",
    "📊 Dataset",
    "🚀 OSM Sync",
    "📋 Meldingen",
    "📂 Import",
])


# ══════════════════════════════════════════════════════════════════════════════
# TAB 1 — API STATUS MONITOR
# ══════════════════════════════════════════════════════════════════════════════
with tab_status:
    st.subheader("🟢 API Status Monitor")
    st.caption(
        "Gemini wordt gevalideerd via een lichte REST GET — geen SDK-init nodig. "
        "OSM en Sheets via een HTTP-ping."
    )

    col_btn, _ = st.columns([1, 4])
    with col_btn:
        vernieuwen = st.button("🔄 Vernieuwen", type="secondary")

    if vernieuwen or "api_health" not in st.session_state:
        with st.spinner("API-status controleren…"):
            st.session_state["api_health"]      = check_api_health()
            st.session_state["api_health_time"] = time.strftime("%H:%M:%S")

    health     = st.session_state.get("api_health", {})
    check_time = st.session_state.get("api_health_time", "–")

    st.caption(f"Laatste check: {check_time}")
    st.write("")

    services = [
        (
            "Gemini API",
            bool(health.get("Gemini API", False)),
            str(health.get("Gemini Status", "Niet gecontroleerd")),
            "Vereist voor AI verrijking, zoekintentie en agentic fallback",
        ),
        (
            "OSM Overpass",
            bool(health.get("OSM Overpass", False)),
            "Operationeel" if health.get("OSM Overpass") else "Niet bereikbaar",
            "OpenStreetMap data synchronisatie",
        ),
        (
            "Google Sheets",
            bool(health.get("Google Sheets", False)),
            "Verbonden" if health.get("Google Sheets") else "Niet verbonden",
            "Cloud database opslag en synchronisatie",
        ),
    ]

    for name, is_ok, msg, beschrijving in services:
        dot_cls = "green" if is_ok else "red"
        st.markdown(
            f"""
<div class="vs-status-row">
  <span class="vs-status-dot {dot_cls}"></span>
  <div style="flex:1;min-width:0;">
    <strong style="font-size:0.88rem;">{name}</strong>
    <span style="font-size:0.74rem;color:var(--vs-muted);margin-left:8px;">{beschrijving}</span>
  </div>
  <span style="font-size:0.82rem;font-weight:600;white-space:nowrap;">{msg}</span>
</div>""",
            unsafe_allow_html=True,
        )

    # ── Extra: directe API key test ────────────────────────────────────────
    st.markdown("---")
    with st.expander("🔑 Gemini API-key handmatig testen"):
        test_key = st.text_input(
            "API-key",
            type="password",
            placeholder="AIza…",
            key="manual_api_key",
        )
        if st.button("🔍 Test deze key", disabled=not test_key):
            from utils.ai_helper import validate_gemini_key
            ok, result_msg = validate_gemini_key(test_key)
            if ok:
                st.success(f"✅ Key geldig: {result_msg}")
            else:
                st.error(f"❌ Key ongeldig: {result_msg}")

    # ── Systeem Logboek ────────────────────────────────────────────────────
    st.markdown("---")
    st.subheader("📋 Systeem Logboek")

    log_path = Path("logs/vrijstaan.log")
    if log_path.exists():
        try:
            raw_lines = log_path.read_text(encoding="utf-8", errors="replace").splitlines()
            recent    = raw_lines[-150:][::-1]  # Laatste 150, nieuwste boven
            log_text  = "\n".join(recent)
            st.text_area(
                "Recente log-entries (nieuwste boven)",
                log_text, height=350,
                label_visibility="collapsed",
            )
            dl_col, clr_col = st.columns(2)
            with dl_col:
                st.download_button(
                    "📥 Download logboek",
                    data=log_path.read_bytes(),
                    file_name="vrijstaan.log",
                    mime="text/plain",
                )
            with clr_col:
                if st.button("🗑️ Log wissen", type="secondary"):
                    log_path.write_text("", encoding="utf-8")
                    st.success("Log gewist.")
                    st.rerun()
        except Exception as e:
            st.error(f"Log lezen mislukt: {e}")
    else:
        st.info("Nog geen log-bestand (logs/vrijstaan.log).")


# ══════════════════════════════════════════════════════════════════════════════
# TAB 2 — VOLAUTOMATISCHE AI BATCH
# ══════════════════════════════════════════════════════════════════════════════
with tab_batch:
    st.subheader("🤖 Volautomatische AI Verrijking v5.1")

    st.markdown("""
**Stealth Scraper + Agentic AI pipeline:**
| Stap | Techniek | Detail |
|------|----------|--------|
| 🕵️ Scraping | **cloudscraper** | Imiteert Windows Chrome — bypast Cloudflare/Datadome |
| ⚡ I/O fase | **ThreadPoolExecutor** (max 10 workers) | Websites parallel scrapen, Streamlit blokkeert niet |
| ⏱️ Compute fase | **Sequentieel** (1 per 1 met sleep 1.5s) | Gemini rate-limits respecteren |
| 🔑 MD5 check | Hash vergelijking | Ongewijzigde websites → AI overgeslagen |
| 🤖 Agentic fallback | Google Search Grounding | <250 tekens of >4 onbekend → automatisch actief |
| 💾 Checkpoint | Elke 25/50 locaties | Auto-resume na onderbreking |
""")

    if master_df.empty:
        st.error("⚠️ Geen data geladen. Voer eerst een OSM Sync uit (tab 4).")
    else:
        if "ai_gecheckt" not in master_df.columns:
            master_df["ai_gecheckt"] = "Nee"

        nog_te_doen = int((master_df["ai_gecheckt"] != "Ja").sum())
        al_klaar    = len(master_df) - nog_te_doen

        kpi1, kpi2, kpi3, kpi4 = st.columns(4)
        kpi1.metric("📍 Totaal locaties",   f"{len(master_df):,}")
        kpi2.metric("✅ Al verrijkt",        f"{al_klaar}/{len(master_df)}")
        kpi3.metric("⏳ Openstaand",         f"{nog_te_doen}")
        kpi4.metric("⏱️ Geschat",            estimate_batch_time(nog_te_doen))

        st.divider()

        cfg_col1, cfg_col2 = st.columns(2)
        with cfg_col1:
            max_run = st.number_input(
                "Max locaties voor deze run (0 = alle openstaande)",
                min_value=0,
                max_value=len(master_df),
                value=0,
                help="Stel een limiet in voor test-runs. 0 = verwerk alles.",
            )
        with cfg_col2:
            reset_cp = st.checkbox(
                "♻️ Checkpoint wissen & opnieuw beginnen",
                value=False,
                help="Verwijdert alle ai_gecheckt-stempels. Volledige herverwerking.",
            )

        if reset_cp:
            st.warning(
                "⚠️ Dit verwijdert alle stempels en verwerkt de volledige database opnieuw!"
            )

        if nog_te_doen == 0 and not reset_cp:
            st.success(
                "🎉 Alle locaties zijn al verrijkt! "
                "Vink 'Checkpoint wissen' aan om opnieuw te starten."
            )

        start_btn = st.button(
            f"🚀 Start Auto-Pilot "
            f"({'alle ' + str(len(master_df)) if reset_cp else str(nog_te_doen)} locaties)",
            type="primary",
            use_container_width=True,
            disabled=(nog_te_doen == 0 and not reset_cp),
        )

        if start_btn:
            # Reset indien gewenst
            if reset_cp:
                master_df["ai_gecheckt"] = "Nee"
                cp = Path("data/checkpoints/batch_progress.csv")
                if cp.exists():
                    cp.unlink()
                st.info("♻️ Checkpoint gewist. Volledige verwerking gestart…")

            # Voortgangs-UI
            pbar      = st.progress(0.0)
            stat_box  = st.empty()
            stop_flag_state = [False]

            stop_col, _ = st.columns([1, 3])
            with stop_col:
                if st.button("🛑 Stop na huidige batch", type="secondary"):
                    stop_flag_state[0] = True

            def _on_progress(done: int, total: int, label: str) -> None:
                pbar.progress(min(done / max(total, 1), 1.0))
                stat_box.info(
                    f"**{label}**\n\n"
                    f"`{done}/{total}` ({done / max(total, 1) * 100:.0f}%)"
                )

            def _on_status(msg: str) -> None:
                stat_box.info(f"📋 {msg}")

            def _should_stop() -> bool:
                return stop_flag_state[0]

            try:
                verrijkt_df = run_full_batch(
                    master_df      = master_df,
                    max_locations  = int(max_run),
                    progress_cb    = _on_progress,
                    status_cb      = _on_status,
                    stop_flag      = _should_stop,
                )
                pbar.progress(1.0)
                stat_box.success("✅ Batch voltooid!")
                save_data(verrijkt_df)
                st.success(
                    f"💾 {len(verrijkt_df):,} locaties definitief opgeslagen "
                    "in Google Sheets."
                )
                st.balloons()

            except Exception as e:
                st.error(f"❌ Batch mislukt: {e}")
                st.exception(e)


# ══════════════════════════════════════════════════════════════════════════════
# TAB 3 — DATASET OVERZICHT
# ══════════════════════════════════════════════════════════════════════════════
with tab_data:
    st.subheader("📊 Dataset Overzicht")

    if master_df.empty:
        st.warning("⚠️ Database leeg of niet bereikbaar.")
    else:
        gecheckt   = int((master_df.get("ai_gecheckt", pd.Series(dtype=str)) == "Ja").sum())
        gratis     = int(
            master_df["prijs"].astype(str).str.lower()
            .str.contains("gratis", na=False).sum()
        )
        has_photos = 0
        if "photos" in master_df.columns:
            has_photos = int(
                master_df["photos"].astype(str).str.len().gt(5).sum()
            )
        drukte_ok  = 0
        if "drukte_indicator" in master_df.columns:
            drukte_ok = int(
                master_df["drukte_indicator"].astype(str).str.lower().ne("onbekend").sum()
            )

        k1, k2, k3, k4 = st.columns(4)
        k1.metric("📍 Locaties",       f"{len(master_df):,}")
        k2.metric("🤖 AI verrijkt",    f"{gecheckt}/{len(master_df)}")
        k3.metric("📸 Met foto's",     f"{has_photos:,}")
        k4.metric("🔴 Drukte-data",    f"{drukte_ok:,}")

        with st.expander("📊 Onbekend-statistieken per veld", expanded=False):
            stats_dict = get_onbekend_stats(master_df)
            if stats_dict:
                sdf = pd.DataFrame([
                    {"Veld": k, "# Onbekend": v["onbekend"], "%": f"{v['pct']}%"}
                    for k, v in sorted(
                        stats_dict.items(), key=lambda x: -x[1]["onbekend"]
                    )
                ])
                st.dataframe(sdf, use_container_width=True, hide_index=True)

        st.subheader("Eerste 100 rijen")
        st.dataframe(master_df.head(100), use_container_width=True, height=360)

        st.download_button(
            "📥 Volledige CSV downloaden",
            master_df.to_csv(index=False).encode("utf-8"),
            "vrijstaan_export.csv",
            "text/csv",
        )


# ══════════════════════════════════════════════════════════════════════════════
# TAB 4 — OSM SYNC
# ══════════════════════════════════════════════════════════════════════════════
with tab_sync:
    st.subheader("🌍 OpenStreetMap Synchronisatie")
    st.info(
        "OSM sync gebruikt **Exponential Backoff** en roteert over 3 Overpass "
        "endpoints met een custom User-Agent om blokkades te voorkomen."
    )
    st.warning("⚠️ Sync kan handmatige wijzigingen overschrijven. Maak eerst een backup!")

    bk_col, sync_col = st.columns(2)
    with bk_col:
        if not master_df.empty:
            st.download_button(
                "📥 CSV Backup downloaden",
                master_df.to_csv(index=False).encode("utf-8"),
                "vrijstaan_backup.csv",
                "text/csv",
                use_container_width=True,
            )
    with sync_col:
        if st.button(
            "🚀 Start OSM Sync", type="primary", use_container_width=True
        ):
            with st.spinner(
                "OSM data ophalen (Exponential Backoff, 3 endpoints)…"
            ):
                try:
                    from utils.data_handler import load_data_from_osm  # noqa: PLC0415
                    df_new = load_data_from_osm()
                    if not df_new.empty:
                        save_data(df_new)
                        st.success(f"✅ {len(df_new):,} locaties opgeslagen uit OSM.")
                        st.rerun()
                    else:
                        st.error("Geen data ontvangen van OSM.")
                except Exception as e:
                    st.error(f"OSM sync mislukt: {e}")


# ══════════════════════════════════════════════════════════════════════════════
# TAB 5 — CROWDSOURCE MELDINGEN
# ══════════════════════════════════════════════════════════════════════════════
with tab_meldingen:
    st.subheader("📋 Crowdsource Meldingen")
    st.caption(
        "Correcties ingediend door gebruikers via het 'Foutje gezien?' formulier "
        "in de detail-pagina."
    )

    melding_path = Path("data/meldingen.json")
    if not melding_path.exists():
        st.info("Nog geen meldingen ontvangen.")
    else:
        try:
            meldingen: list[dict] = json.loads(
                melding_path.read_text(encoding="utf-8")
            )
        except Exception as e:
            st.error(f"Meldingen laden mislukt: {e}")
            meldingen = []

        if not meldingen:
            st.info("Lijst is leeg.")
        else:
            mdf = pd.DataFrame(meldingen)

            status_filter = st.selectbox(
                "Filter op status",
                ["alle", "nieuw", "verwerkt", "afgewezen"],
            )
            if status_filter != "alle" and "status" in mdf.columns:
                mdf = mdf[mdf["status"] == status_filter]

            n_nieuw = int(
                (pd.DataFrame(meldingen).get("status", pd.Series(dtype=str)) == "nieuw").sum()
            )
            st.metric("📋 Openstaande meldingen", n_nieuw)
            st.write("")

            for i, row in mdf.iterrows():
                ts   = str(row.get("timestamp", ""))[:10]
                naam = str(row.get("naam",    "?"))
                veld = str(row.get("veld",    "?"))
                stat = str(row.get("status",  "?")).upper()

                with st.expander(
                    f"[{stat}] {naam} · {veld} · {ts}", expanded=False
                ):
                    st.markdown(f"**📍 Locatie:** {naam}")
                    st.markdown(f"**🏷️ Veld:** `{veld}`")
                    st.markdown(
                        f"**✏️ Correctie:** {row.get('correctie', '–')}"
                    )
                    if row.get("opmerking"):
                        st.markdown(f"**💬 Opmerking:** {row.get('opmerking')}")

                    act1, act2, _ = st.columns([1, 1, 3])
                    with act1:
                        if st.button("✅ Verwerkt", key=f"ok_{i}"):
                            meldingen[i]["status"] = "verwerkt"
                            melding_path.write_text(
                                json.dumps(meldingen, ensure_ascii=False, indent=2),
                                encoding="utf-8",
                            )
                            st.rerun()
                    with act2:
                        if st.button("❌ Afwijzen", key=f"rej_{i}"):
                            meldingen[i]["status"] = "afgewezen"
                            melding_path.write_text(
                                json.dumps(meldingen, ensure_ascii=False, indent=2),
                                encoding="utf-8",
                            )
                            st.rerun()

            st.download_button(
                "📥 Alle meldingen exporteren als CSV",
                pd.DataFrame(meldingen).to_csv(index=False).encode("utf-8"),
                "vrijstaan_meldingen.csv",
                "text/csv",
            )


# ══════════════════════════════════════════════════════════════════════════════
# TAB 6 — CSV IMPORT
# ══════════════════════════════════════════════════════════════════════════════
with tab_import:
    st.subheader("📂 CSV Import")
    st.caption(
        "Upload een CSV om samen te voegen met of te vervangen van de huidige database. "
        "Duplicaten worden gefilterd op naam + coördinaten."
    )

    uploaded = st.file_uploader("Upload CSV bestand", type="csv")
    if uploaded:
        try:
            import_df = pd.read_csv(uploaded)
            st.write(f"**{len(import_df):,} rijen** gevonden in het bestand.")
            st.dataframe(import_df.head(10), use_container_width=True)

            merge_col, replace_col = st.columns(2)
            with merge_col:
                if st.button("✅ Samenvoegen met bestaande database", type="primary"):
                    combined = pd.concat(
                        [master_df, import_df], ignore_index=True
                    ).drop_duplicates(subset=["naam", "latitude", "longitude"])
                    save_data(combined)
                    st.success(
                        f"✅ {len(combined):,} locaties opgeslagen "
                        f"({len(combined) - len(master_df):+d} nieuw)."
                    )
                    st.rerun()

            with replace_col:
                if st.button("⚠️ Vervang volledige database", type="secondary"):
                    save_data(import_df)
                    st.warning(
                        f"Database vervangen door {len(import_df):,} rijen uit CSV."
                    )
                    st.rerun()

        except Exception as e:
            st.error(f"CSV lezen mislukt: {e}")
