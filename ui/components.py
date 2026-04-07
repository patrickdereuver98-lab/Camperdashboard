"""
ui/components.py — Herbruikbare UI-componenten voor VrijStaan v4.
Booking.com-stijl kaartcomponenten, detail-dialoog en faciliteiten-grid.

Exports:
  render_result_card()  — Booking.com-stijl resultaatkaart
  show_detail_dialog()  — Rijke detailpagina met tabbladen
  render_no_results()   — Lege-staat weergave
  score_label()         — Vertaling score naar tekstlabel
"""
from __future__ import annotations

import html as _html
from typing import Any

import streamlit as st
import folium
import streamlit.components.v1 as components

from ui.theme import (
    BRAND_PRIMARY, BRAND_DARK, BRAND_ACCENT, TEXT_MUTED, BORDER, BG_CARD,
)
from utils.helpers import clean_val, safe_html, format_score, is_ja
from utils.favorites import get_favorites, toggle_favorite


# ── HELPERS ────────────────────────────────────────────────────────────────────

def score_label(score: float) -> str:
    """Booking.com-stijl score-label: Geweldig, Heel goed, Goed, etc."""
    if score >= 9.0:   return "Uitzonderlijk"
    if score >= 8.5:   return "Geweldig"
    if score >= 8.0:   return "Heel goed"
    if score >= 7.5:   return "Goed"
    if score >= 7.0:   return "Prima"
    if score >= 6.0:   return "Redelijk"
    return "Laag"


def _parse_score(raw: Any) -> float | None:
    """Parseer score naar float (0.0–10.0 range, converteert van 5.0 schaal)."""
    val = clean_val(raw, "")
    if not val:
        return None
    try:
        f = float(val.replace(",", ".").split("/")[0].strip())
        # Converteer 5.0-schaal → 10.0-schaal als nodig
        if f <= 5.0:
            f = f * 2.0
        return round(f, 1)
    except (ValueError, TypeError):
        return None


def _score_html(raw: Any) -> str:
    """Genereert het blauwe Booking.com score-badge HTML blokje."""
    score = _parse_score(raw)
    if score is None:
        return ""
    label = score_label(score)
    css_class = "great" if score >= 8.5 else "good"
    return f"""
<div class="vs-score-block">
  <div class="vs-score-label">{safe_html(label)}<br>
    <span style="font-size:0.65rem;color:#aaa;">{int(round(score * 10))} reviews</span>
  </div>
  <div class="vs-score-badge {css_class}">{score:.1f}</div>
</div>"""


def _price_html(prijs: Any) -> str:
    """Genereert de prijs-sectie HTML voor de kaart."""
    p = clean_val(prijs, "")
    if p.lower() == "gratis":
        return """
<div class="vs-price-block">
  <div class="vs-price-from">per nacht</div>
  <div class="vs-price-main gratis">Gratis</div>
  <div class="vs-price-sub">geen vertrektijd</div>
</div>"""
    elif not p:
        return """
<div class="vs-price-block">
  <div class="vs-price-main" style="font-size:0.9rem;color:#aaa;">Prijs onbekend</div>
</div>"""
    else:
        return f"""
<div class="vs-price-block">
  <div class="vs-price-from">per nacht</div>
  <div class="vs-price-main">{safe_html(p)}</div>
  <div class="vs-price-sub">inclusief toeristenbelasting</div>
</div>"""


def _facilities_chips_html(row: Any) -> str:
    """Genereert faciliteiten-chips rij voor de kaartweergave."""
    chips = []
    mapping = [
        ("stroom",            "⚡", "Stroom",    True),
        ("wifi",              "📶", "Wifi",      True),
        ("honden_toegestaan", "🐾", "Honden ok", True),
        ("water_tanken",      "🚰", "Water",     False),
        ("sanitair",          "🚿", "Sanitair",  False),
        ("afvalwater",        "🗑️", "Afval",    False),
    ]
    for col, icon, label, highlight in mapping:
        if is_ja(row.get(col, "")):
            cls = "highlight" if highlight else ""
            chips.append(
                f'<span class="vs-facility-chip {cls}">{icon} {label}</span>'
            )
    return "".join(chips) if chips else ""


def _get_primary_photo(row: Any) -> str:
    """Geeft de beste beschikbare foto URL terug."""
    # Probeer photos-lijst eerst (rijkere data)
    photos = row.get("photos", "")
    if photos and str(photos).strip() not in ("", "nan", "Onbekend", "[]"):
        try:
            import json
            photo_list = json.loads(str(photos)) if isinstance(photos, str) else photos
            if isinstance(photo_list, list) and photo_list:
                return str(photo_list[0])
        except Exception:
            pass
    # Fallback naar enkelvoudige afbeelding
    img = clean_val(row.get("afbeelding", ""), "")
    if img:
        return img
    return "https://images.unsplash.com/photo-1523987355523-c7b5b0dd90a7?w=400&q=80&auto=format"


# ── HOOFD KAART COMPONENT ──────────────────────────────────────────────────────

def render_result_card(row: Any, idx: int | str) -> None:
    """
    Rendert één Booking.com-stijl resultaatkaart.

    Layout:
      [Foto 260px] | [Info: naam, locatie, beschrijving, chips] | [Score + Prijs]

    Args:
      row:  pandas Series of dict met locatiedata
      idx:  unieke identifier voor Streamlit-keys
    """
    naam_raw  = clean_val(row.get("naam"), "Onbekend")
    naam_s    = safe_html(naam_raw)
    prov_s    = safe_html(clean_val(row.get("provincie"), "Onbekend"))
    prijs     = row.get("prijs", "")
    desc      = clean_val(row.get("beschrijving"), "")
    loc_type  = clean_val(row.get("loc_type"), "Camperplaats")
    img_url   = _get_primary_photo(row)
    chips     = _facilities_chips_html(row)
    score_blk = _score_html(row.get("beoordeling"))
    price_blk = _price_html(prijs)

    is_fav    = naam_raw in get_favorites()
    fav_icon  = "❤️" if is_fav else "🤍"

    # HTML kaart renderen
    st.markdown(f"""
<div class="vs-result-card">
  <div class="vs-card-img-col">
    <img class="vs-card-img"
         src="{safe_html(img_url)}"
         alt="{naam_s}"
         loading="lazy"
         onerror="this.src='https://images.unsplash.com/photo-1523987355523-c7b5b0dd90a7?w=400&q=80&auto=format'">
    <div class="vs-fav-overlay" title="Favoriet">{fav_icon}</div>
  </div>

  <div class="vs-card-info-col">
    <div>
      <div class="vs-card-name" title="{naam_s}">{naam_s}</div>
      <div class="vs-card-location">📍 {prov_s}</div>
      <div class="vs-card-type-badge">🚐 {safe_html(loc_type)}</div>
      {f'<div class="vs-card-desc">{safe_html(desc)}</div>' if desc else ''}
      <div class="vs-facilities-row">{chips}</div>
    </div>
  </div>

  <div class="vs-card-price-col">
    {score_blk}
    {price_blk}
  </div>
</div>
""", unsafe_allow_html=True)

    # Interactieve knoppen (Streamlit-native, onder de HTML-kaart)
    btn_col, fav_col = st.columns([4, 1])
    with btn_col:
        if st.button(
            "🔍 Bekijk details",
            key=f"detail_{idx}",
            type="primary",
            use_container_width=True,
        ):
            show_detail_dialog(row)
    with fav_col:
        if st.button(
            fav_icon,
            key=f"fav_{idx}",
            use_container_width=True,
            help="Toevoegen/verwijderen uit favorieten",
        ):
            toggle_favorite(naam_raw)
            st.rerun()


# ── DETAIL DIALOG ──────────────────────────────────────────────────────────────

@st.dialog("📍 Locatiedetails", width="large")
def show_detail_dialog(row: Any) -> None:
    """
    Rijke detailpagina met tabbladen, zoals Booking.com detail-pagina.
    Tabbladen: Overzicht | Faciliteiten | Huisregels | Reviews | Kaart
    """
    naam  = safe_html(clean_val(row.get("naam"), "Onbekend"))
    prov  = safe_html(clean_val(row.get("provincie"), "Onbekend"))
    prijs = clean_val(row.get("prijs"), "Onbekend")
    score = _parse_score(row.get("beoordeling"))

    # Header
    score_badge = (
        f'<span style="background:{BRAND_DARK};color:white;border-radius:6px;'
        f'padding:4px 10px;font-weight:700;font-size:0.95rem;">{score:.1f}</span>'
        if score else ""
    )
    st.markdown(f"""
<div class="vs-detail-header">
  <div style="display:flex;justify-content:space-between;align-items:flex-start;">
    <div>
      <div class="vs-detail-name">{naam}</div>
      <div class="vs-detail-location">📍 {prov} &nbsp;·&nbsp; 🚐 Camperplaats</div>
    </div>
    <div style="text-align:right;">
      {score_badge}
      {f'<div style="font-size:0.7rem;color:rgba(255,255,255,0.6);margin-top:2px;">{score_label(score) if score else ""}</div>' if score else ""}
    </div>
  </div>
</div>
""", unsafe_allow_html=True)

    tab_ov, tab_fac, tab_regels, tab_rev, tab_kaart = st.tabs(
        ["📋 Overzicht", "🔌 Faciliteiten", "📜 Huisregels", "⭐ Reviews", "🗺️ Kaart"]
    )

    # ── TAB 1: OVERZICHT ──────────────────────────────────────────────
    with tab_ov:
        col_img, col_info = st.columns([1, 1.5])
        with col_img:
            img = _get_primary_photo(row)
            st.image(img, use_container_width=True)
            # Extra foto's (als beschikbaar)
            photos = row.get("photos", "")
            if photos and str(photos) not in ("", "nan", "Onbekend", "[]"):
                try:
                    import json
                    photo_list = (
                        json.loads(str(photos))
                        if isinstance(photos, str) else photos
                    )
                    if isinstance(photo_list, list) and len(photo_list) > 1:
                        st.caption(f"📸 {len(photo_list)} foto's beschikbaar")
                        for p in photo_list[1:3]:
                            st.image(str(p), use_container_width=True)
                except Exception:
                    pass
            site = clean_val(row.get("website"), "")
            if site:
                if not site.startswith("http"):
                    site = "https://" + site
                st.markdown(f"[🌐 Bezoek website]({site})")

        with col_info:
            desc = clean_val(row.get("beschrijving"), "Geen beschrijving beschikbaar.")
            st.markdown(f"*{desc}*")
            st.markdown("---")
            for emoji, label, col_key in [
                ("💶", "Prijs",          "prijs"),
                ("🏕️", "Aantal plekken", "aantal_plekken"),
                ("⛰️", "Ondergrond",     "ondergrond"),
                ("🤫", "Rust",           "rust"),
                ("🕐", "Check-in/out",   "check_in_out"),
                ("♿", "Toegankelijk",   "toegankelijkheid"),
                ("📞", "Telefoon",       "telefoonnummer"),
            ]:
                val = clean_val(row.get(col_key), "Onbekend")
                st.markdown(f"**{emoji} {label}:** {val}")

    # ── TAB 2: FACILITEITEN (GRID MET ICONEN) ─────────────────────────
    with tab_fac:
        st.markdown("""<div style="font-family:'DM Serif Display',serif;
font-size:1.1rem;margin-bottom:0.8rem;">Aanwezige faciliteiten</div>""",
            unsafe_allow_html=True)

        # Alle faciliteiten met status
        all_fac = [
            ("⚡", "Stroom",            "stroom"),
            ("💡", "Stroomprijs",       "stroom_prijs"),
            ("📶", "Wifi",              "wifi"),
            ("🐾", "Honden toegestaan", "honden_toegestaan"),
            ("🚿", "Sanitair",          "sanitair"),
            ("🚰", "Water tanken",      "water_tanken"),
            ("🗑️", "Afvalwater dump",  "afvalwater"),
            ("🚽", "Chemisch toilet",   "chemisch_toilet"),
            ("♿", "Toegankelijk",      "toegankelijkheid"),
            ("🌊", "Waterfront",        "waterfront"),
        ]

        items_html = ""
        for icon, label, col_key in all_fac:
            val = clean_val(row.get(col_key), "Onbekend")
            val_lower = val.lower()
            if val_lower == "ja":
                cls  = "ja"
                disp = f"{icon} {label}"
            elif val_lower == "nee":
                cls  = "nee"
                disp = f"{icon} {label}"
            else:
                cls  = ""
                disp = f"{icon} {label}: {safe_html(val)}"
            items_html += f'<div class="vs-facility-item {cls}">{disp}</div>'

        st.markdown(
            f'<div class="vs-facility-grid">{items_html}</div>',
            unsafe_allow_html=True,
        )

        # Uitgebreide faciliteiten uit rijke AI data
        extra_fac = clean_val(row.get("faciliteiten_extra"), "")
        if extra_fac and extra_fac != "Onbekend":
            st.markdown("**Overige faciliteiten:**")
            st.markdown(extra_fac)

    # ── TAB 3: HUISREGELS ─────────────────────────────────────────────
    with tab_regels:
        st.markdown("""<div style="font-family:'DM Serif Display',serif;
font-size:1.1rem;margin-bottom:0.8rem;">Huisregels & beleid</div>""",
            unsafe_allow_html=True)

        rules_data = [
            ("🕐", "Check-in",        "check_in_out"),
            ("🐾", "Huisdieren",      "honden_toegestaan"),
            ("🚬", "Roken",           "roken"),
            ("🎉", "Feesten",         "feesten"),
            ("🔇", "Stilteplicht",    "stilteplicht"),
            ("♿", "Toegankelijkheid","toegankelijkheid"),
        ]
        for icon, label, col_key in rules_data:
            val = clean_val(row.get(col_key), "Onbekend")
            val_lower = val.lower()
            if val_lower == "ja":
                disp = "✅ Toegestaan"
            elif val_lower == "nee":
                disp = "❌ Niet toegestaan"
            else:
                disp = safe_html(val)
            st.markdown(f"**{icon} {label}:** {disp}")

        extra_rules = clean_val(row.get("huisregels"), "")
        if extra_rules and extra_rules != "Onbekend":
            st.info(f"📋 {extra_rules}")

    # ── TAB 4: REVIEWS ────────────────────────────────────────────────
    with tab_rev:
        score_parsed = _parse_score(row.get("beoordeling"))
        if score_parsed:
            st.markdown(f"""
<div style="display:flex;align-items:center;gap:16px;margin-bottom:1rem;">
  <div style="background:{BRAND_DARK};color:white;border-radius:10px 10px 10px 0;
              padding:12px 16px;font-size:2rem;font-weight:700;">{score_parsed:.1f}</div>
  <div>
    <div style="font-family:'DM Serif Display',serif;font-size:1.2rem;">{score_label(score_parsed)}</div>
    <div style="font-size:0.8rem;color:{TEXT_MUTED};">Gebaseerd op beoordelingen</div>
  </div>
</div>""", unsafe_allow_html=True)

        samen = clean_val(row.get("samenvatting_reviews"), "Nog geen reviews beschikbaar.")
        st.info(f"💬 {samen}")

        # Uitgebreide review tekst
        rev_text = clean_val(row.get("reviews_tekst"), "")
        if rev_text and rev_text != "Onbekend":
            with st.expander("Meer reviews lezen"):
                st.markdown(rev_text)

    # ── TAB 5: KAART ──────────────────────────────────────────────────
    with tab_kaart:
        try:
            lat_f = float(str(row.get("latitude", "")).replace(",", "."))
            lon_f = float(str(row.get("longitude", "")).replace(",", "."))
            m = folium.Map(location=[lat_f, lon_f], zoom_start=14,
                           tiles="CartoDB Positron")
            folium.Marker(
                [lat_f, lon_f],
                popup=clean_val(row.get("naam"), "Camperplaats"),
                icon=folium.Icon(color="blue", icon="home", prefix="fa"),
            ).add_to(m)
            components.html(m._repr_html_(), height=360)
            st.markdown(
                f"[📍 Open in Google Maps](https://www.google.com/maps?q={lat_f},{lon_f})"
            )
        except (TypeError, ValueError):
            st.warning("⚠️ Geen geldige coördinaten beschikbaar voor deze locatie.")


# ── LEGE STAAT ─────────────────────────────────────────────────────────────────

def render_no_results(query: str = "") -> None:
    """Rendert de 'geen resultaten gevonden' weergave."""
    msg = (
        f"Geen resultaten voor <strong>'{safe_html(query)}'</strong>"
        if query
        else "Geen camperplaatsen gevonden"
    )
    st.markdown(f"""
<div class="vs-no-results">
  <div class="vs-no-results-icon">🔭</div>
  <div style="font-size:1.2rem;font-weight:600;color:#2D3748;margin-bottom:0.5rem;">
    {msg}
  </div>
  <div style="font-size:0.88rem;">
    Probeer andere zoektermen of verwijder een paar filters.
  </div>
</div>
""", unsafe_allow_html=True)
