"""
ui/sidebar.py — Filter sidebar component voor VrijStaan v4.
Booking.com-stijl opvouwbare filterlijst in de linker sidebar.

Exporteert:
  render_filter_sidebar() → SidebarFilters dataclass met alle instellingen
"""
from __future__ import annotations

from dataclasses import dataclass, field

import pandas as pd
import streamlit as st

from ui.theme import BRAND_PRIMARY, BRAND_ACCENT, BORDER, TEXT_MUTED


@dataclass
class SidebarFilters:
    """Alle filter-instellingen van de sidebar gebundeld."""
    selected_provs:   list[str]  = field(default_factory=list)
    prijs_cat:        str        = "Alle"
    sort_keuze:       str        = "Standaard"
    f_stroom:         bool       = False
    f_honden:         bool       = False
    f_wifi:           bool       = False
    f_water:          bool       = False
    f_sanitair:       bool       = False
    f_gratis:         bool       = False
    f_afvalwater:     bool       = False
    toon_favs:        bool       = False
    toon_kaart:       bool       = False   # "Toon op kaart" knop
    naam_query:       str        = ""


def render_filter_sidebar(df: pd.DataFrame) -> SidebarFilters:
    """
    Rendert de volledige filter-sidebar in Booking.com-stijl.
    Retourneert een SidebarFilters dataclass met alle actieve filters.

    Args:
      df: De volledige dataset (voor het ophalen van provincie-opties)

    Returns:
      SidebarFilters met alle ingestelde filters
    """
    filters = SidebarFilters()

    with st.sidebar:
        # ── KAART KNOP (bovenaan, zoals Booking.com) ────────────────
        st.markdown(f"""
<div style="padding:0.8rem 0.8rem 0.2rem;">
  <span class="vs-filter-section-title">🗺️ Kaartweergave</span>
</div>""", unsafe_allow_html=True)

        filters.toon_kaart = st.toggle(
            "🗺️ Toon op kaart",
            value=st.session_state.get("show_map", False),
            help="Klik om de volledige kaart te tonen/verbergen",
        )
        st.session_state["show_map"] = filters.toon_kaart

        st.markdown(f"<hr style='border-color:{BORDER};margin:0.4rem 0;'>",
                    unsafe_allow_html=True)

        # ── ZOEKEN OP NAAM ───────────────────────────────────────────
        st.markdown(f"""
<div style="padding:0.4rem 0 0;">
  <span class="vs-filter-section-title">🔎 Naam zoeken</span>
</div>""", unsafe_allow_html=True)
        filters.naam_query = st.text_input(
            "naam_input",
            placeholder="Bijv. Camping de Parel…",
            label_visibility="collapsed",
        )

        st.markdown(f"<hr style='border-color:{BORDER};margin:0.6rem 0 0.3rem;'>",
                    unsafe_allow_html=True)

        # ── JOUW BUDGET ──────────────────────────────────────────────
        st.markdown(f"""
<div style="padding:0.4rem 0 0;">
  <span class="vs-filter-section-title">💶 Budget</span>
</div>""", unsafe_allow_html=True)

        filters.prijs_cat = st.radio(
            "Prijs",
            ["Alle", "Gratis", "Betaald"],
            label_visibility="collapsed",
            horizontal=True,
        )

        st.markdown(f"<hr style='border-color:{BORDER};margin:0.6rem 0 0.3rem;'>",
                    unsafe_allow_html=True)

        # ── PROVINCIE ────────────────────────────────────────────────
        st.markdown(f"""
<div style="padding:0.4rem 0 0;">
  <span class="vs-filter-section-title">📍 Provincie</span>
</div>""", unsafe_allow_html=True)

        prov_opties = sorted([
            p for p in df["provincie"].dropna().unique()
            if str(p).lower() not in ("onbekend", "", "nan")
        ])
        preset_prov = st.session_state.pop("_landing_province", None)
        default_provs = [preset_prov] if (preset_prov and preset_prov in prov_opties) else []

        filters.selected_provs = st.multiselect(
            "Provincie selecteren",
            prov_opties,
            default=default_provs,
            placeholder="Alle provincies",
            label_visibility="collapsed",
        )

        st.markdown(f"<hr style='border-color:{BORDER};margin:0.6rem 0 0.3rem;'>",
                    unsafe_allow_html=True)

        # ── FACILITEITEN ─────────────────────────────────────────────
        st.markdown(f"""
<div style="padding:0.4rem 0 0;">
  <span class="vs-filter-section-title">✅ Faciliteiten</span>
</div>""", unsafe_allow_html=True)

        filters.f_stroom    = st.checkbox("⚡ Stroom aanwezig")
        filters.f_wifi      = st.checkbox("📶 Wifi beschikbaar")
        filters.f_honden    = st.checkbox("🐾 Honden welkom")
        filters.f_water     = st.checkbox("🚰 Water tanken")
        filters.f_sanitair  = st.checkbox("🚿 Sanitaire voorzieningen")
        filters.f_afvalwater = st.checkbox("🗑️ Afvalwater dump")

        st.markdown(f"<hr style='border-color:{BORDER};margin:0.6rem 0 0.3rem;'>",
                    unsafe_allow_html=True)

        # ── SORTEREN ─────────────────────────────────────────────────
        st.markdown(f"""
<div style="padding:0.4rem 0 0;">
  <span class="vs-filter-section-title">↕️ Sorteren</span>
</div>""", unsafe_allow_html=True)

        filters.sort_keuze = st.selectbox(
            "Sorteren op",
            ["Standaard", "Naam A→Z", "Prijs (gratis eerst)", "Beoordeling ↓"],
            label_visibility="collapsed",
        )

        st.markdown(f"<hr style='border-color:{BORDER};margin:0.6rem 0 0.3rem;'>",
                    unsafe_allow_html=True)

        # ── EXTRA ────────────────────────────────────────────────────
        filters.toon_favs = st.checkbox("❤️ Alleen mijn favorieten")

        st.write("")
        if st.button("🔄 Alle filters wissen", use_container_width=True, type="secondary"):
            for k in ("ai_query_cp", "ai_active_filters", "qf_gratis",
                      "qf_honden", "qf_stroom", "qf_wifi"):
                st.session_state[k] = (
                    [] if k == "ai_active_filters"
                    else (False if k.startswith("qf") else "")
                )
            st.rerun()

    return filters
