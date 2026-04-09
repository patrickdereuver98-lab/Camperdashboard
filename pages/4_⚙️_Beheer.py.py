"""
pages/4_⚙️_Beheer.py — VrijStaan v5.2 Admin Dashboard.

Wijzigingen t.o.v. v5.1:
  - Systeem Overzicht balk boven de tabs (KPI's in één oogopslag).
  - Compactere API-status met inline badges i.p.v. losse rows.
  - Betere kolom-indeling in Dataset-tab.
  - Sidebar uitlogknop in eigen sectie met visuele scheiding.
  - Alle functionaliteit (batch, meldingen, sync, import) volledig intact.
"""
from __future__ import annotations

import json
import time
from pathlib import Path

import pandas as pd
import streamlit as st

from ui.theme import (
    apply_theme, render_sidebar_header,
    BRAND_PRIMARY, BRAND_DARK, BRAND_GREEN, BORDER, TEXT_MUTED,
)
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

# ── SIDEBAR: UITLOGGEN ─────────────────────────────────────────────────────────
with st.sidebar:
    st.markdown(
        f"""<div style="padding:0.9rem 0.9rem 0.5rem;">
<hr style="border-color:{BORDER};margin:0 0 0.7rem;">
<div style="font-size:0.68rem;font-weight:700;color:#8A9DB5;
text-transform:uppercase;letter-spacing:0.1em;margin-bottom:0.5rem;">
Admin sessie</div>
</div>""",
        unsafe_allow_html=True,
    )
    if st.button("🔓 Uitloggen", use_container_width=True, type="secondary"):
        st.session_state["admin_authenticated"] = False
        st.rerun()


# ── PAGINATITEL ────────────────────────────────────────────────────────────────
st.markdown("""
<div style="padding:1.6rem 0 0;">
  <h1 style="font-family:'DM Serif Display',serif;color:var(--vs-text);
  margin:0 0 0.15rem;font-size:2rem;">⚙️ Beheer Dashboard</h1>
  <p style="color:var(--vs-muted);margin:0 0 1.4rem;font-size:0.88rem;">
  VrijStaan v5.2 — Administratie & Data Pipeline</p>
</div>
""", unsafe_allow_html=True)


# ── DATA LADEN ─────────────────────────────────────────────────────────────────
master_df = load_data()


# ══════════════════════════════════════════════════════════════════════════════
# SYSTEEM OVERZICHT — compacte KPI-balk boven de tabs
# ══════════════════════════════════════════════════════════════════════════════
if not master_df.empty:
    gecheckt_n   = int((master_df.get("ai_gecheckt", pd.Series(dtype=str)) == "Ja").sum())
    openstaand_n = len(master_df) - gecheckt_n
    gratis_n     = int(
        master_df["prijs"].astype(str).str.lower()
        .str.contains("gratis", na=False).sum()
    )
    prov_n = int(master_df["provincie"].nunique())

    ov1, ov2, ov3, ov4, ov5 = st.columns(5)
    with ov1:
        st.markdown(f"""<div class="vs-kpi-card">
<div class="vs-kpi-num">{len(master_df):,}</div>
<div class="vs-kpi-label">📍 Locaties totaal</div>
</div>""", unsafe_allow_html=True)
    with ov2:
        st.markdown(f"""<div class="vs-kpi-card">
<div class="vs-kpi-num">{gecheckt_n:,}</div>
<div class="vs-kpi-label">🤖 AI verrijkt</div>
</div>""", unsafe_allow_html=True)
    with ov3:
        st.markdown(f"""<div class="vs-kpi-card">
<div class="vs-kpi-num" style="color:{'var(--vs-green)' if openstaand_n == 0 else 'var(--vs-primary)'};">{openstaand_n:,}</div>
<div class="vs-kpi-label">⏳ Openstaand</div>
</div>""", unsafe_allow_html=True)
    with ov4:
        st.markdown(f"""<div class="vs-kpi-card">
<div class="vs-kpi-num" style="color:var(--vs-green);">{gratis_n:,}</div>
<div class="vs-kpi-label">💰 Gratis plekken</div>
</div>""", unsafe_allow_html=True)
    with ov5:
        st.markdown(f"""<div class="vs-kpi-card">
<div class="vs-kpi-num">{prov_n}</div>
<div class="vs-kpi-label">🗺️ Provincies</div>
</div>""", unsafe_allow_html=True)

    st.write("")

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
# TAB 1 — API STATUS MONITOR
# ══════════════════════════════════════════════════════════════════════════════
with tab_status:
    st.markdown("""<div style="margin-bottom:1rem;">
<span style="font-family:'DM Serif Display',serif;font-size:1.2rem;">
🟢 Dienst Status</span>
<span style="font-size:0.8rem;color:var(--vs-muted);margin-left:10px;">
Gemini via REST GET · OSM via HTTP · Sheets via connection-check</span>
</div>""", unsafe_allow_html=True)

    refresh_col, time_col = st.columns([1, 4])
    with refresh_col:
        vernieuwen = st.button("🔄 Vernieuwen", type="secondary", use_container_width=True)
    with time_col:
        check_time = st.session_state.get("api_health_time", "–")
        st.markdown(
            f"<span style='font-size:0.78rem;color:{TEXT_MUTED};"
            f"line-height:2.5;'>Laatste check: {check_time}</span>",
            unsafe_allow_html=True,
        )

    if vernieuwen or "api_health" not in st.session_state:
        with st.spinner("Status controleren…"):
            st.session_state["api_health"]      = check_api_health()
            st.session_state["api_health_time"] = time.strftime("%H:%M:%S")

    health = st.session_state.get("api_health", {})
    st.write("")

    services = [
        (
            "Gemini 2.5 Flash",
            bool(health.get("Gemini API", False)),
            str(health.get("Gemini Status", "Niet gecontroleerd")),
            "AI verrijking · zoekintentie · agentic fallback",
        ),
        (
            "OSM Overpass API",
            bool(health.get("OSM Overpass", False)),
            "Bereikbaar" if health.get("OSM Overpass") else "Niet bereikbaar",
            "OpenStreetMap synchronisatie (3 endpoints met backoff)",
        ),
        (
            "Google Sheets",
            bool(health.get("Google Sheets", False)),
            "Verbonden" if health.get("Google Sheets") else "Niet verbonden",
            "Cloud database — lezen & schrijven",
        ),
    ]

    for name, is_ok, msg, beschrijving in services:
        dot_cls = "green" if is_ok else "red"
        st.markdown(
            f"""<div class="vs-status-row">
  <span class="vs-status-dot {dot_cls}"></span>
  <div style="flex:1;min-width:0;">
    <strong style="font-size:0.87rem;">{name}</strong>
    <span style="font-size:0.73rem;color:var(--vs-muted);margin-left:8px;">{beschrijving}</span>
  </div>
  <span style="font-size:0.81rem;font-weight:600;white-space:nowrap;
  color:{'var(--vs-green)' if is_ok else 'var(--vs-red, #C0392B)'};">{msg}</span>
</div>""",
            unsafe_allow_html=True,
        )

    # Handmatige key-test
    st.markdown("---")
    with st.expander("🔑 API-key handmatig valideren"):
        c_key, c_btn = st.columns([4, 1])
        with c_key:
            test_key = st.text_input(
                "API-key", type="password",
                placeholder="Plak hier je Gemini API-key (AIza…)",
                label_visibility="collapsed",
                key="manual_api_key",
            )
        with c_btn:
            run_test = st.button("Test", type="primary", use_container_width=True,
                                 disabled=not test_key)
        if run_test:
            from utils.ai_helper import validate_gemini_key
            ok, msg_result = validate_gemini_key(test_key)
            if ok:
                st.success(f"✅ Geldig: {msg_result}")
            else:
                st.error(f"❌ Ongeldig: {msg_result}")

    # Systeem logboek
    st.markdown("---")
    st.markdown("""<span style="font-family:'DM Serif Display',serif;
font-size:1.1rem;">📋 Systeem Logboek</span>""", unsafe_allow_html=True)

    log_path = Path("logs/vrijstaan.log")
    if log_path.exists():
        try:
            raw_lines = log_path.read_text(encoding="utf-8", errors="replace").splitlines()
            recent    = raw_lines[-150:][::-1]
            st.text_area(
                "Logboek (nieuwste bovenaan)",
                "\n".join(recent),
                height=320,
                label_visibility="collapsed",
            )
            dl_c, clr_c, _ = st.columns([1, 1, 2])
            with dl_c:
                st.download_button(
                    "📥 Download",
                    data=log_path.read_bytes(),
                    file_name="vrijstaan.log",
                    mime="text/plain",
                    use_container_width=True,
                )
            with clr_c:
                if st.button("🗑️ Wissen", type="secondary", use_container_width=True):
                    log_path.write_text("", encoding="utf-8")
                    st.success("Log gewist.")
                    st.rerun()
        except Exception as exc:
            st.error(f"Log lezen mislukt: {exc}")
    else:
        st.info("Nog geen log-bestand aanwezig (logs/vrijstaan.log).")


# ══════════════════════════════════════════════════════════════════════════════
# TAB 2 — AUTO BATCH
# ══════════════════════════════════════════════════════════════════════════════
with tab_batch:
    st.markdown("""<div style="margin-bottom:1rem;">
<span style="font-family:'DM Serif Display',serif;font-size:1.2rem;">
🤖 Stealth Scraper + Agentic AI Auto-Pilot</span></div>""", unsafe_allow_html=True)

    # Pipeline uitleg in compacte tabel
    st.markdown("""
| # | Stap | Techniek |
|---|------|---------|
| 1 | Scraping | **cloudscraper** · imiteert Windows Chrome · bypast Cloudflare |
| 2 | I/O fase | **ThreadPoolExecutor** (10 workers) · parallel, Streamlit blokkeert niet |
| 3 | Compute fase | **Sequentieel** · 1 per 1 met 1.5s pauze · rate-limits respecteren |
| 4 | Hash-check | MD5 fingerprint · ongewijzigde sites → AI overgeslagen |
| 5 | Agentic fallback | Google Search Grounding · < 250 tekens of >4 onbekend |
| 6 | Checkpoint | CSV elke 25 · Sheets elke 50 · auto-resume na herstart |
""")

    if master_df.empty:
        st.error("⚠️ Geen data. Start eerst een OSM Sync (tab 🚀).")
    else:
        if "ai_gecheckt" not in master_df.columns:
            master_df["ai_gecheckt"] = "Nee"

        nog_te_doen = int((master_df["ai_gecheckt"] != "Ja").sum())
        al_klaar    = len(master_df) - nog_te_doen

        # Voortgangs-indicator
        pct_klaar = al_klaar / max(len(master_df), 1)
        st.progress(pct_klaar, text=f"Verrijkt: {al_klaar}/{len(master_df)} ({pct_klaar*100:.0f}%)")
        st.markdown(f"**Geschatte tijd voor {nog_te_doen} openstaande:** {estimate_batch_time(nog_te_doen)}")

        st.divider()

        cfg1, cfg2 = st.columns(2)
        with cfg1:
            max_run = st.number_input(
                "Max locaties deze run (0 = alle openstaande)",
                min_value=0, max_value=len(master_df), value=0,
                help="0 = alles verwerken. Handig voor test-runs.",
            )
        with cfg2:
            reset_cp = st.checkbox(
                "♻️ Alle stempels wissen & opnieuw beginnen",
                value=False,
                help="Zet alle ai_gecheckt terug op 'Nee'. Volledige herverwerking.",
            )

        if reset_cp:
            st.warning("⚠️ Dit verwerkt de volledige database opnieuw — kan lang duren!")

        if nog_te_doen == 0 and not reset_cp:
            st.success("🎉 Alles verrijkt! Gebruik 'Alle stempels wissen' om opnieuw te beginnen.")

        start_btn = st.button(
            f"🚀 Start Auto-Pilot"
            f" ({'alle ' + str(len(master_df)) if reset_cp else str(nog_te_doen)} locaties)",
            type="primary",
            use_container_width=True,
            disabled=(nog_te_doen == 0 and not reset_cp),
        )

        if start_btn:
            if reset_cp:
                master_df["ai_gecheckt"] = "Nee"
                cp = Path("data/checkpoints/batch_progress.csv")
                if cp.exists():
                    cp.unlink()
                st.info("♻️ Checkpoint gewist — verwerking gestart…")

            pbar             = st.progress(0.0)
            stat_box         = st.empty()
            stop_flag_state  = [False]

            stp_col, _ = st.columns([1, 3])
            with stp_col:
                if st.button("🛑 Stop na huidige batch", type="secondary"):
                    stop_flag_state[0] = True

            def _on_progress(done: int, total: int, label: str) -> None:
                pbar.progress(min(done / max(total, 1), 1.0))
                stat_box.info(f"**{label}** — `{done}/{total}` ({done/max(total,1)*100:.0f}%)")

            def _on_status(msg: str) -> None:
                stat_box.info(f"📋 {msg}")

            def _should_stop() -> bool:
                return stop_flag_state[0]

            try:
                verrijkt_df = run_full_batch(
                    master_df     = master_df,
                    max_locations = int(max_run),
                    progress_cb   = _on_progress,
                    status_cb     = _on_status,
                    stop_flag     = _should_stop,
                )
                pbar.progress(1.0)
                stat_box.success("✅ Batch voltooid!")
                save_data(verrijkt_df)
                st.success(f"💾 {len(verrijkt_df):,} locaties opgeslagen in Google Sheets.")
                st.balloons()
            except Exception as exc:
                st.error(f"❌ Batch mislukt: {exc}")
                st.exception(exc)


# ══════════════════════════════════════════════════════════════════════════════
# TAB 3 — DATASET
# ══════════════════════════════════════════════════════════════════════════════
with tab_data:
    st.markdown("""<span style="font-family:'DM Serif Display',serif;font-size:1.2rem;">
📊 Dataset Overzicht</span>""", unsafe_allow_html=True)
    st.write("")

    if master_df.empty:
        st.warning("⚠️ Database leeg of niet bereikbaar.")
    else:
        # KPI grid
        k1, k2, k3, k4 = st.columns(4)
        gecheckt_n = int((master_df.get("ai_gecheckt", pd.Series(dtype=str)) == "Ja").sum())
        has_photos = int(master_df.get("photos", pd.Series(dtype=str)).astype(str).str.len().gt(5).sum()) if "photos" in master_df.columns else 0
        drukte_ok  = int(master_df.get("drukte_indicator", pd.Series(dtype=str)).astype(str).str.lower().ne("onbekend").sum()) if "drukte_indicator" in master_df.columns else 0

        k1.metric("📍 Locaties",    f"{len(master_df):,}")
        k2.metric("🤖 Verrijkt",    f"{gecheckt_n}/{len(master_df)}")
        k3.metric("📸 Met foto's",  f"{has_photos:,}")
        k4.metric("🔴 Drukte-data", f"{drukte_ok:,}")

        # Kwaliteitsstatistieken
        with st.expander("📊 Veld-kwaliteit (% Onbekend per kolom)", expanded=False):
            stats_dict = get_onbekend_stats(master_df)
            if stats_dict:
                sdf = pd.DataFrame([
                    {"Veld": k, "Onbekend #": v["onbekend"], "Onbekend %": v["pct"]}
                    for k, v in sorted(stats_dict.items(), key=lambda x: -x[1]["onbekend"])
                ])
                # Kleur: rood = veel onbekend, groen = weinig
                st.dataframe(sdf, use_container_width=True, hide_index=True)

        # Data preview + download naast elkaar
        preview_col, dl_col = st.columns([3, 1])
        with preview_col:
            st.markdown("**Eerste 100 rijen**")
            st.dataframe(master_df.head(100), use_container_width=True, height=340)
        with dl_col:
            st.markdown("**Exporteren**")
            st.download_button(
                "📥 Download CSV",
                master_df.to_csv(index=False).encode("utf-8"),
                "vrijstaan_export.csv", "text/csv",
                use_container_width=True,
            )
            st.caption(f"{len(master_df):,} rijen · {len(master_df.columns)} kolommen")


# ══════════════════════════════════════════════════════════════════════════════
# TAB 4 — OSM SYNC
# ══════════════════════════════════════════════════════════════════════════════
with tab_sync:
    st.markdown("""<span style="font-family:'DM Serif Display',serif;font-size:1.2rem;">
🌍 OpenStreetMap Synchronisatie</span>""", unsafe_allow_html=True)
    st.write("")

    st.info(
        "Sync gebruikt **Exponential Backoff** en roteert over 3 Overpass-endpoints "
        "met een custom User-Agent om blokkades te voorkomen."
    )
    st.warning("⚠️ Een sync kan handmatige wijzigingen overschrijven. Maak altijd eerst een backup!")

    backup_col, sync_col = st.columns(2)
    with backup_col:
        st.markdown("**Stap 1: Backup**")
        if not master_df.empty:
            st.download_button(
                "📥 Download CSV backup",
                master_df.to_csv(index=False).encode("utf-8"),
                "vrijstaan_backup.csv", "text/csv",
                use_container_width=True,
            )
        else:
            st.caption("Geen data om te backuppen.")
    with sync_col:
        st.markdown("**Stap 2: Sync**")
        if st.button("🚀 Start OSM Sync", type="primary", use_container_width=True):
            with st.spinner("OSM data ophalen…"):
                try:
                    from utils.data_handler import load_data_from_osm
                    df_new = load_data_from_osm()
                    if not df_new.empty:
                        save_data(df_new)
                        st.success(f"✅ {len(df_new):,} locaties opgeslagen vanuit OSM.")
                        st.rerun()
                    else:
                        st.error("Geen data ontvangen van OSM.")
                except Exception as exc:
                    st.error(f"OSM sync mislukt: {exc}")


# ══════════════════════════════════════════════════════════════════════════════
# TAB 5 — CROWDSOURCE MELDINGEN
# ══════════════════════════════════════════════════════════════════════════════
with tab_meldingen:
    st.markdown("""<span style="font-family:'DM Serif Display',serif;font-size:1.2rem;">
📋 Crowdsource Meldingen</span>""", unsafe_allow_html=True)
    st.caption("Correcties ingediend via het 'Foutje gezien?' formulier op de detailpagina.")
    st.write("")

    melding_path = Path("data/meldingen.json")
    if not melding_path.exists():
        st.info("📭 Nog geen meldingen ontvangen.")
    else:
        try:
            meldingen: list[dict] = json.loads(
                melding_path.read_text(encoding="utf-8")
            )
        except Exception as exc:
            st.error(f"Meldingen laden mislukt: {exc}")
            meldingen = []

        if not meldingen:
            st.info("📭 Geen meldingen in de lijst.")
        else:
            mdf = pd.DataFrame(meldingen)

            # Filter + teller
            flt_col, cnt_col = st.columns([2, 3])
            with flt_col:
                status_filter = st.selectbox(
                    "Filter op status",
                    ["alle", "nieuw", "verwerkt", "afgewezen"],
                    label_visibility="collapsed",
                )
            with cnt_col:
                n_nieuw = int(
                    (pd.DataFrame(meldingen).get("status", pd.Series(dtype=str)) == "nieuw").sum()
                )
                st.markdown(
                    f"<span style='font-size:0.85rem;color:{TEXT_MUTED};'>"
                    f"<strong style='color:var(--vs-primary);'>{n_nieuw}</strong> openstaande meldingen</span>",
                    unsafe_allow_html=True,
                )

            if status_filter != "alle" and "status" in mdf.columns:
                mdf = mdf[mdf["status"] == status_filter]

            st.write("")
            for i, row in mdf.iterrows():
                ts   = str(row.get("timestamp", ""))[:10]
                naam = str(row.get("naam",   "?"))
                veld = str(row.get("veld",   "?"))
                stat = str(row.get("status", "?")).upper()
                badge_color = (
                    "var(--vs-primary)" if stat == "NIEUW"
                    else ("var(--vs-green)" if stat == "VERWERKT" else "var(--vs-muted)")
                )

                with st.expander(
                    f"[{stat}] {naam} · {veld} · {ts}", expanded=False
                ):
                    c_info, c_action = st.columns([3, 1])
                    with c_info:
                        st.markdown(f"**📍 Locatie:** {naam}")
                        st.markdown(f"**🏷️ Veld:** `{veld}`")
                        st.markdown(f"**✏️ Correctie:** {row.get('correctie','–')}")
                        if row.get("opmerking"):
                            st.caption(f"💬 {row.get('opmerking')}")
                    with c_action:
                        if st.button("✅ Verwerkt", key=f"ok_{i}", use_container_width=True):
                            meldingen[i]["status"] = "verwerkt"
                            melding_path.write_text(
                                json.dumps(meldingen, ensure_ascii=False, indent=2),
                                encoding="utf-8",
                            )
                            st.rerun()
                        if st.button("❌ Afwijzen", key=f"rej_{i}", type="secondary",
                                     use_container_width=True):
                            meldingen[i]["status"] = "afgewezen"
                            melding_path.write_text(
                                json.dumps(meldingen, ensure_ascii=False, indent=2),
                                encoding="utf-8",
                            )
                            st.rerun()

            st.download_button(
                "📥 Exporteer meldingen (CSV)",
                pd.DataFrame(meldingen).to_csv(index=False).encode("utf-8"),
                "vrijstaan_meldingen.csv", "text/csv",
            )


# ══════════════════════════════════════════════════════════════════════════════
# TAB 6 — CSV IMPORT
# ══════════════════════════════════════════════════════════════════════════════
with tab_import:
    st.markdown("""<span style="font-family:'DM Serif Display',serif;font-size:1.2rem;">
📂 CSV Import</span>""", unsafe_allow_html=True)
    st.caption("Voeg een CSV samen met de database, of vervang de database volledig.")
    st.write("")

    uploaded = st.file_uploader("Upload CSV bestand", type="csv")
    if uploaded:
        try:
            import_df = pd.read_csv(uploaded)
            st.write(f"**{len(import_df):,} rijen** gevonden in `{uploaded.name}`.")
            st.dataframe(import_df.head(10), use_container_width=True)

            merge_col, replace_col = st.columns(2)
            with merge_col:
                if st.button("✅ Samenvoegen met bestaande database", type="primary",
                              use_container_width=True):
                    combined = pd.concat(
                        [master_df, import_df], ignore_index=True
                    ).drop_duplicates(subset=["naam", "latitude", "longitude"])
                    save_data(combined)
                    diff = len(combined) - len(master_df)
                    st.success(
                        f"✅ {len(combined):,} locaties opgeslagen "
                        f"({diff:+d} rijen toegevoegd)."
                    )
                    st.rerun()
            with replace_col:
                if st.button("⚠️ Vervang volledige database", type="secondary",
                              use_container_width=True):
                    save_data(import_df)
                    st.warning(f"Database vervangen door {len(import_df):,} rijen.")
                    st.rerun()
        except Exception as exc:
            st.error(f"CSV lezen mislukt: {exc}")
