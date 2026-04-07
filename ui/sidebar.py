"""
ui/sidebar.py — Filter sidebar voor VrijStaan v5.
Booking.com-stijl, opvouwbaar, met voertuig-restricties (Pijler 3/6).

Exporteert:
  render_filter_sidebar() → SidebarFilters dataclass
"""
from __future__ import annotations

from dataclasses import dataclass, field

import pandas as pd
import streamlit as st

from ui.theme import P_BLUE, P_YELLOW, BORDER, TEXT_MUTE


@dataclass
class SidebarFilters:
    """Gebundelde filter-instellingen van de sidebar."""
    selected_provs:   list[str]  = field(default_factory=list)
    prijs_cat:        str        = "Alle"
    sort_keuze:       str        = "Standaard"
    f_stroom:         bool       = False
    f_honden:         bool       = False
    f_wifi:           bool       = False
    f_water:          bool       = False
    f_sanitair:       bool       = False
    f_afvalwater:     bool       = False
    f_gratis:         bool       = False
    f_waterfront:     bool       = False
    # Voertuig restricties (Pijler 6)
    f_lang_voertuig:  bool       = False   # >8m toegestaan
    f_zwaar_voertuig: bool       = False   # >3.5t toegestaan
    # Overige
    toon_favs:        bool       = False
    toon_kaart:       bool       = False
    naam_query:       str        = ""
    radius_km:        int        = 0       # 0 = geen radius-filter


def render_filter_sidebar(df: pd.DataFrame) -> SidebarFilters:
    """
    Rendert de volledige filter sidebar.

    Args:
      df: Volledige dataset voor provincie-opties

    Returns:
      SidebarFilters dataclass met alle actieve filters
    """
    filters = SidebarFilters()

    with st.sidebar:
        # ── KAART TOGGLE ────────────────────────────────────────────
        st.markdown(f"""
<div style="padding:0.6rem 0.8rem 0.1rem;">
  <span class="vs-sidebar-label">🗺️ Kaartweergave</span>
</div>""", unsafe_allow_html=True)
        filters.toon_kaart = st.toggle(
            "Toon op kaart",
            value=st.session_state.get("show_map", False),
            help="Klik om de interactieve kaart te tonen",
        )
        st.session_state["show_map"] = filters.toon_kaart

        st.markdown(f"<hr style='border-color:{BORDER};margin:0.5rem 0.8rem;'>",
                    unsafe_allow_html=True)

        # ── NAAM ZOEKEN ─────────────────────────────────────────────
        st.markdown(f"""
<div style="padding:0.2rem 0.8rem 0.1rem;">
  <span class="vs-sidebar-label">🔎 Naam zoeken</span>
</div>""", unsafe_allow_html=True)
        filters.naam_query = st.text_input(
            "naam_query",
            placeholder="Bijv. Camping de Parel…",
            label_visibility="collapsed",
        )

        st.markdown(f"<hr style='border-color:{BORDER};margin:0.5rem 0.8rem;'>",
                    unsafe_allow_html=True)

        # ── POPULAIRE FILTERS (Booking.com bovenaan) ────────────────
        st.markdown(f"""
<div style="padding:0.2rem 0.8rem 0.1rem;">
  <span class="vs-sidebar-label">⭐ Populaire filters</span>
</div>""", unsafe_allow_html=True)

        with st.container():
            filters.f_gratis   = st.checkbox("💰 Gratis overnachten")
            filters.f_honden   = st.checkbox("🐾 Honden welkom")
            filters.f_stroom   = st.checkbox("⚡ Stroom aanwezig")
            filters.f_wifi     = st.checkbox("📶 Wifi beschikbaar")

        st.markdown(f"<hr style='border-color:{BORDER};margin:0.5rem 0.8rem;'>",
                    unsafe_allow_html=True)

        # ── PROVINCIE ────────────────────────────────────────────────
        st.markdown(f"""
<div style="padding:0.2rem 0.8rem 0.1rem;">
  <span class="vs-sidebar-label">📍 Provincie</span>
</div>""", unsafe_allow_html=True)

        prov_opties = sorted([
            p for p in df["provincie"].dropna().unique()
            if str(p).lower() not in ("onbekend", "", "nan")
        ])
        preset = st.session_state.pop("_landing_province", None)
        default_p = [preset] if (preset and preset in prov_opties) else []

        filters.selected_provs = st.multiselect(
            "Provincie selecteren",
            prov_opties,
            default=default_p,
            placeholder="Alle provincies",
            label_visibility="collapsed",
        )

        st.markdown(f"<hr style='border-color:{BORDER};margin:0.5rem 0.8rem;'>",
                    unsafe_allow_html=True)

        # ── BUDGET ────────────────────────────────────────────────────
        st.markdown(f"""
<div style="padding:0.2rem 0.8rem 0.1rem;">
  <span class="vs-sidebar-label">💶 Budget</span>
</div>""", unsafe_allow_html=True)

        filters.prijs_cat = st.radio(
            "Prijs",
            ["Alle", "Gratis", "Betaald"],
            label_visibility="collapsed",
            horizontal=True,
        )

        st.markdown(f"<hr style='border-color:{BORDER};margin:0.5rem 0.8rem;'>",
                    unsafe_allow_html=True)

        # ── ALLE FACILITEITEN ─────────────────────────────────────────
        with st.expander("🔧 Alle faciliteiten", expanded=False):
            filters.f_water      = st.checkbox("🚰 Water tanken")
            filters.f_sanitair   = st.checkbox("🚿 Sanitaire voorzieningen")
            filters.f_afvalwater = st.checkbox("🗑️ Afvalwater dump")
            filters.f_waterfront = st.checkbox("🌊 Waterfront locatie")

        st.markdown(f"<hr style='border-color:{BORDER};margin:0.5rem 0.8rem;'>",
                    unsafe_allow_html=True)

        # ── VOERTUIG RESTRICTIES (Pijler 3 & 6) ──────────────────────
        with st.expander("🚐 Voertuig-eisen", expanded=False):
            st.caption("Filter op toegestane voertuigafmetingen")
            filters.f_lang_voertuig  = st.checkbox("📏 Geschikt voor >8 meter")
            filters.f_zwaar_voertuig = st.checkbox("⚖️ Geschikt voor >3.5 ton")

        st.markdown(f"<hr style='border-color:{BORDER};margin:0.5rem 0.8rem;'>",
                    unsafe_allow_html=True)

        # ── SORTEREN ──────────────────────────────────────────────────
        st.markdown(f"""
<div style="padding:0.2rem 0.8rem 0.1rem;">
  <span class="vs-sidebar-label">↕️ Sorteren</span>
</div>""", unsafe_allow_html=True)

        filters.sort_keuze = st.selectbox(
            "Sorteren op",
            ["Standaard", "Naam A→Z", "Prijs (gratis eerst)",
             "Beoordeling ↓", "Dichtstbij"],
            label_visibility="collapsed",
        )

        st.markdown(f"<hr style='border-color:{BORDER};margin:0.5rem 0.8rem;'>",
                    unsafe_allow_html=True)

        # ── EXTRA ─────────────────────────────────────────────────────
        filters.toon_favs = st.checkbox("❤️ Alleen mijn favorieten")

        st.write("")
        if st.button("🔄 Filters wissen", use_container_width=True, type="secondary"):
            for k in ("ai_query_cp", "ai_active_filters"):
                st.session_state[k] = [] if k == "ai_active_filters" else ""
            st.rerun()

    return filters
