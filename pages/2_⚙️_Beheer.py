"""
2_⚙️_Beheer.py — Beveiligd beheer-dashboard.

Fase 4 fixes:
- Wachtwoordbeveiliging via utils/auth.py (#12)
- validate_and_merge voor CSV import (#8)
- Logging viewer (#13)
- Kolomvalidatie en feedback (#8)
"""
import os
import pandas as pd
import streamlit as st

from utils.auth import require_admin_auth
from utils.data_handler import load_data, validate_and_merge, CSV_PATH
from utils.logger import logger

st.set_page_config(page_title="VrijStaan | Beheer", page_icon="⚙️", layout="wide")

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

tab_sync, tab_import, tab_data, tab_logs = st.tabs(
    ["🚀 API Sync", "📂 CSV Import", "📊 Dataset", "📋 Logboek"]
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
                # Cache wissen zodat load_data echt opnieuw fetcht
                load_data.clear()
                df_new = load_data()

            if not df_new.empty:
                st.success(f"✅ Sync voltooid! **{len(df_new)}** locaties opgehaald en opgeslagen.")
                logger.info(f"Handmatige sync: {len(df_new)} locaties")
                st.session_state["master_df"] = df_new

                prov_counts = df_new["provincie"].value_counts().head(5)
                st.markdown("**Top 5 provincies:**")
                for prov, cnt in prov_counts.items():
                    st.markdown(f"- {prov}: {cnt} locaties")
            else:
                st.error("❌ Sync mislukt of geen data ontvangen. Controleer het logboek.")

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

            if st.button("✅ Importeer en merge met master dataset", use_container_width=True):
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
        bijgewerkt = master_df["bijgewerkt_op"].max() if "bijgewerkt_op" in master_df.columns else "–"

        m1, m2, m3, m4 = st.columns(4)
        m1.metric("Totaal locaties", len(master_df))
        m2.metric("Gratis", len(master_df[master_df["prijs"].astype(str).str.lower() == "gratis"]))
        m3.metric("Provincies", master_df["provincie"].nunique() if "provincie" in master_df.columns else "–")
        m4.metric("Bijgewerkt op", bijgewerkt)

        st.dataframe(master_df, use_container_width=True, height=400)

        csv_bytes = master_df.to_csv(index=False).encode("utf-8")
        st.download_button(
            "📥 Exporteer als CSV backup",
            data=csv_bytes,
            file_name="vrijstaan_backup.csv",
            mime="text/csv",
        )

        if st.button("🗑️ Reset master dataset", type="secondary"):
            os.remove(CSV_PATH)
            load_data.clear()
            st.warning("Master dataset verwijderd. Draai een API Sync om opnieuw te beginnen.")
            st.rerun()
    else:
        st.warning("Nog geen master dataset. Draai eerst een API Sync of importeer een CSV.")

# ── TAB 4: LOGBOEK ────────────────────────────────────────────────────────────
with tab_logs:
    st.subheader("Applicatielogboek")
    LOG_PATH = "logs/vrijstaan.log"

    if os.path.exists(LOG_PATH):
        with open(LOG_PATH, "r", encoding="utf-8") as f:
            log_lines = f.readlines()

        level_filter = st.selectbox("Filter op niveau", ["Alle", "INFO", "WARNING", "ERROR"])
        n_lines = st.slider("Aantal regels tonen", 20, 500, 100)

        filtered = log_lines
        if level_filter != "Alle":
            filtered = [l for l in log_lines if level_filter in l]

        filtered = filtered[-n_lines:]

        log_text = "".join(filtered)
        st.text_area("Log output", value=log_text, height=400, label_visibility="collapsed")

        log_bytes = log_text.encode("utf-8")
        st.download_button("📥 Download logbestand", data=log_bytes,
                           file_name="vrijstaan.log", mime="text/plain")
    else:
        st.info("Nog geen logbestand. De app schrijft logs zodra er activiteit is.")
