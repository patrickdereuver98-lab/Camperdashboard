"""
pages/3_🗺️_Reisplanner.py — Budget & Route Planner voor VrijStaan v5.
Pijler 1: Planningspagina voor favorieten. Budget-tracker, dagindeling,
route-export naar Google Maps.

Carte Blanche toevoeging (Pijler 8):
  - Multi-stop route in volgorde slepen
  - Totaalkosten berekenen
  - "Export naar Google Maps" met waypoints
"""
from __future__ import annotations

import pandas as pd
import streamlit as st

from ui.theme import (
    apply_theme, render_sidebar_header,
    P_BLUE, P_DARK, P_YELLOW, P_GREEN,
    TEXT_H, TEXT_MUTE, BORDER, BG_CARD, BG_PAGE,
)
from ui.map_view import render_map_section
from utils.data_handler import load_data
from utils.favorites import get_favorites, init_favorites
from utils.helpers import clean_val, safe_html, safe_float

# ── PAGINA CONFIG ──────────────────────────────────────────────────────────────
st.set_page_config(
    page_title="VrijStaan | Reisplanner",
    page_icon="🗺️",
    layout="wide",
    initial_sidebar_state="expanded",
)
apply_theme()
render_sidebar_header()
init_favorites()

# ── SESSION STATE ──────────────────────────────────────────────────────────────
if "planner_stops" not in st.session_state:
    st.session_state["planner_stops"] = []

# ── DATA LADEN ─────────────────────────────────────────────────────────────────
@st.cache_data(ttl=300, show_spinner=False)
def _load() -> pd.DataFrame:
    return load_data()

df = _load()
favorieten = get_favorites()

# ── PAGINA HEADER ──────────────────────────────────────────────────────────────
st.markdown(f"""
<div style="background:linear-gradient(145deg,{P_DARK} 0%,{P_BLUE} 100%);
padding:1.8rem 2rem 2.2rem;margin-bottom:1.4rem;">
  <div style="font-family:'Syne',sans-serif;font-size:1.55rem;font-weight:800;
color:white;margin-bottom:0.2rem;">🗺️ Reisplanner</div>
  <div style="color:rgba(255,255,255,0.7);font-size:0.9rem;">
    Plan jouw camperreis: stops selecteren, budget bijhouden, route exporteren.
  </div>
</div>
""", unsafe_allow_html=True)

# ── FAVORIETEN LADEN ───────────────────────────────────────────────────────────
if not favorieten:
    st.markdown(f"""
<div style="text-align:center;padding:4rem 2rem;background:{BG_CARD};
border-radius:14px;border:1px solid {BORDER};">
  <div style="font-size:2.5rem;margin-bottom:1rem;">❤️</div>
  <div style="font-family:'Syne',sans-serif;font-size:1.2rem;font-weight:700;
margin-bottom:0.5rem;">Nog geen favorieten</div>
  <div style="font-size:0.88rem;color:{TEXT_MUTE};">
    Ga naar <strong>Zoeken</strong>, sla locaties op als favoriet (🤍),
    en plan dan hier jouw route.
  </div>
</div>
""", unsafe_allow_html=True)
    st.stop()

fav_df = df[df["naam"].isin(favorieten)].copy()

# ── TWEE KOLOMMEN: STOPS + BUDGET ─────────────────────────────────────────────
col_plan, col_budget = st.columns([1.4, 1])

with col_plan:
    st.markdown(f"""
<div style="font-family:'Syne',sans-serif;font-size:1.1rem;font-weight:700;
margin-bottom:0.8rem;">📍 Jouw favorieten ({len(fav_df)})</div>
""", unsafe_allow_html=True)

    # Stops toe-/afvoegen
    planner_stops: list[str] = st.session_state["planner_stops"]

    for _, row in fav_df.iterrows():
        naam_raw = clean_val(row.get("naam"), "Onbekend")
        naam_s   = safe_html(naam_raw)
        prov_s   = safe_html(clean_val(row.get("provincie"), ""))
        prijs_s  = clean_val(row.get("prijs"), "Onbekend")
        is_stop  = naam_raw in planner_stops

        # Compacte kaart-rij
        in_plan_html = (
            f'<span style="background:{P_GREEN};color:white;border-radius:5px;'
            f'padding:2px 7px;font-size:0.7rem;font-weight:700;margin-left:6px;">'
            f'In reisplan</span>'
            if is_stop else ""
        )

        st.markdown(f"""
<div class="vs-planner-stop">
  <div class="vs-planner-num">{planner_stops.index(naam_raw)+1 if is_stop else "+"}</div>
  <div style="flex:1;min-width:0;">
    <div style="font-weight:700;font-size:0.9rem;white-space:nowrap;
overflow:hidden;text-overflow:ellipsis;">{naam_s}{in_plan_html}</div>
    <div style="font-size:0.75rem;color:{TEXT_MUTE};">📍 {prov_s} · 💶 {safe_html(prijs_s)}</div>
  </div>
</div>
""", unsafe_allow_html=True)

        btn_add, btn_del = st.columns([3, 1])
        with btn_add:
            if not is_stop:
                if st.button(f"+ Toevoegen aan reisplan", key=f"add_{naam_raw[:10]}",
                             use_container_width=True, type="secondary"):
                    if naam_raw not in planner_stops:
                        planner_stops.append(naam_raw)
                    st.rerun()
            else:
                st.button(f"✅ In reisplan", key=f"in_{naam_raw[:10]}",
                          use_container_width=True, disabled=True)
        with btn_del:
            if is_stop:
                if st.button("✕", key=f"del_{naam_raw[:10]}", use_container_width=True):
                    planner_stops.remove(naam_raw)
                    st.rerun()

with col_budget:
    st.markdown(f"""
<div style="font-family:'Syne',sans-serif;font-size:1.1rem;font-weight:700;
margin-bottom:0.8rem;">💶 Budget & Plan</div>
""", unsafe_allow_html=True)

    if not planner_stops:
        st.markdown(f"""
<div style="background:{BG_PAGE};border:1px dashed {BORDER};border-radius:12px;
padding:2rem;text-align:center;color:{TEXT_MUTE};">
  <div style="font-size:1.5rem;margin-bottom:0.5rem;">🗺️</div>
  <div style="font-size:0.85rem;">Voeg stops toe om jouw budget te zien.</div>
</div>""", unsafe_allow_html=True)
    else:
        # Budget per stop
        totaal_kosten = 0.0
        totaal_nachten = 0

        st.markdown("**Stops in jouw reisplan:**")
        for i, naam in enumerate(planner_stops, 1):
            row_match = fav_df[fav_df["naam"] == naam]
            if row_match.empty:
                continue
            row = row_match.iloc[0]
            prijs_s = clean_val(row.get("prijs"), "Onbekend")

            # Probeer prijs te parsen
            prijs_num = 0.0
            if "gratis" in prijs_s.lower():
                prijs_num = 0.0
            else:
                import re
                nrs = re.findall(r"[\d,\.]+", prijs_s)
                if nrs:
                    prijs_num = safe_float(nrs[0].replace(",", "."))

            st.markdown(f"""
<div style="display:flex;align-items:center;justify-content:space-between;
padding:6px 0;border-bottom:1px solid {BORDER};">
  <div>
    <span style="background:{P_BLUE};color:white;border-radius:50%;
width:22px;height:22px;display:inline-flex;align-items:center;
justify-content:center;font-size:0.7rem;font-weight:800;margin-right:8px;">{i}</span>
    <strong style="font-size:0.88rem;">{safe_html(naam[:28])}</strong>
  </div>
  <div style="font-size:0.85rem;color:{TEXT_MUTE};">
    {'Gratis' if prijs_num == 0 else f'€{prijs_num:.0f}/nacht'}
  </div>
</div>""", unsafe_allow_html=True)

            nachten_key = f"nachten_{naam[:10]}"
            nachten = st.number_input(
                f"Nachten bij {naam[:20]}",
                min_value=1, max_value=30, value=1,
                key=nachten_key,
                label_visibility="collapsed",
            )
            totaal_nachten += nachten
            totaal_kosten  += prijs_num * nachten

        st.divider()

        # Budget samenvatting
        budget_max = st.number_input(
            "💰 Jouw budget (€)",
            min_value=0, value=int(max(totaal_kosten * 1.5, 100)),
            step=50,
        )
        pct = min(totaal_kosten / max(budget_max, 1) * 100, 100)
        kleur = P_GREEN if pct < 80 else ("#F59E0B" if pct < 100 else "#EF4444")

        st.markdown(f"""
<div style="margin:1rem 0;">
  <div style="display:flex;justify-content:space-between;margin-bottom:4px;">
    <span style="font-size:0.82rem;font-weight:600;">Totaalkosten</span>
    <span style="font-size:0.88rem;font-weight:800;color:{kleur};">
      €{totaal_kosten:.0f} / €{budget_max}
    </span>
  </div>
  <div class="vs-budget-bar-bg">
    <div class="vs-budget-bar" style="width:{pct:.0f}%;background:{kleur};"></div>
  </div>
  <div style="font-size:0.72rem;color:{TEXT_MUTE};margin-top:4px;">
    {totaal_nachten} nachten · €{totaal_kosten/max(totaal_nachten,1):.0f}/nacht gemiddeld
  </div>
</div>
""", unsafe_allow_html=True)

        st.markdown("")

        # Google Maps export
        stop_rows = [fav_df[fav_df["naam"] == n].iloc[0]
                     for n in planner_stops
                     if not fav_df[fav_df["naam"] == n].empty]

        if stop_rows:
            waypoints = []
            for r in stop_rows:
                try:
                    lat = float(str(r.get("latitude", "")).replace(",", "."))
                    lon = float(str(r.get("longitude", "")).replace(",", "."))
                    waypoints.append(f"{lat},{lon}")
                except (ValueError, TypeError):
                    pass

            if waypoints:
                if len(waypoints) == 1:
                    gmap_url = f"https://www.google.com/maps?q={waypoints[0]}"
                else:
                    origin = waypoints[0]
                    dest   = waypoints[-1]
                    via    = "|".join(waypoints[1:-1])
                    gmap_url = (
                        f"https://www.google.com/maps/dir/?api=1"
                        f"&origin={origin}&destination={dest}"
                        + (f"&waypoints={via}" if via else "")
                        + "&travelmode=driving"
                    )
                st.link_button(
                    "🗺️ Open route in Google Maps",
                    gmap_url,
                    use_container_width=True,
                    type="primary",
                )

        if st.button("🗑️ Reisplan wissen", use_container_width=True, type="secondary"):
            st.session_state["planner_stops"] = []
            st.rerun()

# ── KAART VAN HET REISPLAN ─────────────────────────────────────────────────────
if planner_stops:
    st.divider()
    st.markdown(f"### 🗺️ Kaart van jouw reisroute")
    plan_df = fav_df[fav_df["naam"].isin(planner_stops)].copy()
    if not plan_df.empty:
        render_map_section(plan_df, height=440)
