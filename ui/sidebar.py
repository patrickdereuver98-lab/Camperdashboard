"""
ui/sidebar.py — VrijStaan v5 Filter Sidebar.
Pijler 3: Voertuiglengte (>8m) en gewicht (>3.5t) filters toegevoegd.
Opvouwbare secties, rustig en minimalistisch.
"""
from __future__ import annotations

from dataclasses import dataclass, field
import pandas as pd
import streamlit as st
from ui.theme import BORDER, BRAND_PRIMARY


@dataclass
class SidebarFilters:
    """Alle filter-instellingen gebundeld."""
    selected_provs:     list[str] = field(default_factory=list)
    prijs_cat:          str       = "Alle"
    sort_keuze:         str       = "Standaard"
    f_stroom:           bool      = False
    f_honden:           bool      = False
    f_wifi:             bool      = False
    f_water:            bool      = False
    f_sanitair:         bool      = False
    f_gratis:           bool      = False
    f_afvalwater:       bool      = False
    f_lange_camper:     bool      = False   # >8m voertuiglengte
    f_zwaar_voertuig:   bool      = False   # >3.5t gewicht
    toon_favs:          bool      = False
    toon_kaart:         bool      = False
    naam_query:         str       = ""
    min_score:          float     = 0.0


def render_filter_sidebar(df: pd.DataFrame) -> SidebarFilters:
    """
    Rendert de volledige Booking.com-stijl filter sidebar.
    Retourneert SidebarFilters dataclass.
    """
    filters = SidebarFilters()

    with st.sidebar:
        # ── KAART TOGGLE ────────────────────────────────────────────────
        st.markdown(f"""<div class="vs-filter-section">
<span class="vs-filter-title">🗺️ Kaartweergave</span></div>""",
            unsafe_allow_html=True)

        filters.toon_kaart = st.toggle(
            "Toon op kaart",
            value=st.session_state.get("show_map", False),
        )
        st.session_state["show_map"] = filters.toon_kaart

        st.markdown(f"<hr style='border-color:{BORDER};margin:0;'>", unsafe_allow_html=True)

        # ── NAAM ZOEKEN ──────────────────────────────────────────────────
        st.markdown(f"""<div class="vs-filter-section">
<span class="vs-filter-title">🔎 Naam zoeken</span></div>""",
            unsafe_allow_html=True)
        filters.naam_query = st.text_input(
            "naam_sb", label_visibility="collapsed",
            placeholder="Campingnaam…"
        )

        st.markdown(f"<hr style='border-color:{BORDER};margin:0;'>", unsafe_allow_html=True)

        # ── PROVINCIE ────────────────────────────────────────────────────
        with st.expander("📍 Provincie", expanded=True):
            prov_opties = sorted([
                p for p in df["provincie"].dropna().unique()
                if str(p).lower() not in ("onbekend", "", "nan")
            ])
            preset = st.session_state.pop("_landing_province", None)
            default = [preset] if (preset and preset in prov_opties) else []
            filters.selected_provs = st.multiselect(
                "Provincie", prov_opties, default=default,
                placeholder="Alle provincies", label_visibility="collapsed",
            )

        # ── BUDGET ───────────────────────────────────────────────────────
        with st.expander("💶 Budget"):
            filters.prijs_cat = st.radio(
                "Prijs", ["Alle", "Gratis", "Betaald"],
                label_visibility="collapsed", horizontal=True,
            )

        # ── BEOORDELING ──────────────────────────────────────────────────
        with st.expander("⭐ Min. beoordeling"):
            filters.min_score = st.slider(
                "Minimale score (0–10)", 0.0, 10.0, 0.0, 0.5,
                label_visibility="collapsed",
                format="%.1f",
            )

        # ── POPULAIRE FILTERS ────────────────────────────────────────────
        with st.expander("✅ Faciliteiten", expanded=True):
            c1, c2 = st.columns(2)
            with c1:
                filters.f_stroom    = st.checkbox("⚡ Stroom")
                filters.f_honden    = st.checkbox("🐾 Honden")
                filters.f_wifi      = st.checkbox("📶 Wifi")
            with c2:
                filters.f_water     = st.checkbox("🚰 Water")
                filters.f_sanitair  = st.checkbox("🚿 Sanitair")
                filters.f_afvalwater = st.checkbox("🗑️ Afval")

        # ── VOERTUIG FILTERS (Pijler 3 nieuw) ──────────────────────────
        with st.expander("🚐 Voertuig restricties"):
            filters.f_lange_camper = st.checkbox(
                "📏 Toegankelijk voor >8m",
                help="Toon alleen locaties geschikt voor lange campervans/caravans",
            )
            filters.f_zwaar_voertuig = st.checkbox(
                "⚖️ Toegankelijk voor >3.5t",
                help="Toon alleen locaties geschikt voor zware voertuigen",
            )

        # ── SORTEREN ─────────────────────────────────────────────────────
        with st.expander("↕️ Sorteren"):
            filters.sort_keuze = st.radio(
                "Sortering",
                ["Standaard", "Naam A→Z", "Prijs (gratis eerst)",
                 "Beoordeling ↓", "Afstand ↑"],
                label_visibility="collapsed",
            )

        # ── EXTRA ────────────────────────────────────────────────────────
        with st.expander("❤️ Mijn lijst"):
            filters.toon_favs = st.checkbox("Alleen mijn favorieten")

        st.markdown(f"<hr style='border-color:{BORDER};margin:0.3rem 0;'>", unsafe_allow_html=True)

        if st.button("🔄 Filters wissen", use_container_width=True, type="secondary"):
            for k in ("ai_query_cp", "ai_active_filters", "qf_gratis",
                      "qf_honden", "qf_stroom", "qf_wifi"):
                st.session_state[k] = (
                    [] if k == "ai_active_filters"
                    else (False if k.startswith("qf") else "")
                )
            st.rerun()

    return filters
