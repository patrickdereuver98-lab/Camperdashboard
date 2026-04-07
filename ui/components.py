"""
ui/components.py — Herbruikbare UI-componenten voor VrijStaan v5.

Exports:
  render_result_card()    — Booking.com resultaatkaart met drukte-indicator
  show_detail_dialog()    — Rijke detail met fotogalerij + crowdsource formulier
  render_no_results()     — Anti-clutter lege staat
  render_photo_grid()     — Booking.com foto-grid (hoofd + thumbnails)
  score_label()           — Numerieke score → tekstlabel
"""
from __future__ import annotations

import json
import html as _html
from typing import Any

import streamlit as st
import folium
import streamlit.components.v1 as components

from ui.theme import (
    P_BLUE, P_DARK, P_YELLOW, P_GREEN,
    TEXT_H, TEXT_MUTE, BORDER, BG_CARD,
)
from utils.helpers import clean_val, safe_html, is_ja, safe_float
from utils.favorites import get_favorites, toggle_favorite
from utils.logger import logger


# ── SCORE HELPERS ──────────────────────────────────────────────────────────────

def score_label(score: float) -> str:
    """Booking.com-stijl score label."""
    if score >= 9.0:  return "Uitzonderlijk"
    if score >= 8.5:  return "Geweldig"
    if score >= 8.0:  return "Heel goed"
    if score >= 7.5:  return "Goed"
    if score >= 7.0:  return "Prima"
    if score >= 6.0:  return "Redelijk"
    return "Matig"


def _parse_score(raw: Any) -> float | None:
    """Parseer score naar float op 10.0-schaal."""
    val = clean_val(raw, "")
    if not val:
        return None
    try:
        f = float(val.replace(",", ".").split("/")[0].strip())
        return round(f * 2.0, 1) if f <= 5.0 else round(f, 1)
    except (ValueError, TypeError):
        return None


def _score_html(raw: Any) -> str:
    """Genereert het blauwe Booking.com score-badge HTML."""
    score = _parse_score(raw)
    if score is None:
        return "<div></div>"
    label  = score_label(score)
    css_cls = "high" if score >= 8.0 else ""
    return f"""
<div class="vs-score-wrap">
  <div class="vs-score-label-stack">
    <span class="vs-score-label-word">{safe_html(label)}</span>
    <span class="vs-score-label-count">recensies</span>
  </div>
  <div class="vs-score-box {css_cls}">{score:.1f}</div>
</div>"""


def _price_html(prijs: Any) -> str:
    """Prijs-sectie HTML voor de kaart."""
    p = clean_val(prijs, "")
    if p.lower() == "gratis":
        return """
<div class="vs-price-wrap">
  <div class="vs-price-label">per nacht</div>
  <div class="vs-price-value gratis">Gratis</div>
  <div class="vs-price-note">geen vertrektijd</div>
</div>"""
    elif not p:
        return """
<div class="vs-price-wrap">
  <div class="vs-price-value onbekend">Prijs onbekend</div>
</div>"""
    return f"""
<div class="vs-price-wrap">
  <div class="vs-price-label">per nacht</div>
  <div class="vs-price-value">{safe_html(p)}</div>
  <div class="vs-price-note">incl. lokale belasting</div>
</div>"""


def _drukte_badge(row: Any) -> str:
    """Drukte-indicator badge op de foto (Pijler 6)."""
    drukte = clean_val(row.get("drukte_indicator"), "")
    if not drukte or drukte == "Onbekend":
        return ""
    drukte_l = drukte.lower()
    if "snel" in drukte_l or "vol" in drukte_l:
        return f'<div class="vs-drukte-badge vs-drukte-snel">🔴 {safe_html(drukte)}</div>'
    if "gemiddeld" in drukte_l or "druk" in drukte_l:
        return f'<div class="vs-drukte-badge vs-drukte-medium">🟡 {safe_html(drukte)}</div>'
    return f'<div class="vs-drukte-badge vs-drukte-plek">🟢 {safe_html(drukte)}</div>'


def _chip_row(row: Any) -> str:
    """Faciliteiten chip-rij voor de kaart (Booking.com stijl)."""
    chips = []
    mapping = [
        ("stroom",            "⚡", "Stroom",    True),
        ("wifi",              "📶", "Wifi",      True),
        ("honden_toegestaan", "🐾", "Honden",    True),
        ("sanitair",          "🚿", "Sanitair",  False),
        ("water_tanken",      "🚰", "Water",     False),
    ]
    for col, icon, label, is_ok in mapping:
        if is_ja(row.get(col, "")):
            cls = "ok" if is_ok else ""
            chips.append(f'<span class="vs-chip {cls}">{icon} {label}</span>')
    return "".join(chips)


def _restrictions_html(row: Any) -> str:
    """Voertuig-restricties (Pijler 6)."""
    parts = []
    max_len = clean_val(row.get("max_lengte"), "")
    max_ton = clean_val(row.get("max_gewicht"), "")
    if max_len and max_len != "Onbekend":
        parts.append(f'<span class="vs-restriction">📏 Max {safe_html(max_len)}</span>')
    if max_ton and max_ton != "Onbekend":
        parts.append(f'<span class="vs-restriction">⚖️ Max {safe_html(max_ton)}</span>')
    return f'<div class="vs-card-restrictions">{"".join(parts)}</div>' if parts else ""


def _get_photos(row: Any) -> list[str]:
    """Haal lijst van foto-URLs op uit de rij."""
    fallback = "https://images.unsplash.com/photo-1523987355523-c7b5b0dd90a7?w=600&q=80&auto=format"
    photos_raw = row.get("photos", "")
    if photos_raw and str(photos_raw) not in ("", "nan", "Onbekend", "[]"):
        try:
            pl = json.loads(str(photos_raw)) if isinstance(photos_raw, str) else photos_raw
            if isinstance(pl, list) and pl:
                return [str(p) for p in pl if str(p).startswith("http")]
        except Exception:
            pass
    single = clean_val(row.get("afbeelding"), "")
    return [single] if single else [fallback]


# ── FOTO GRID ──────────────────────────────────────────────────────────────────

def render_photo_grid(photos: list[str]) -> None:
    """
    Booking.com-stijl fotogalerij: 1 groot + max 4 thumbnails.
    Wanneer er <2 foto's zijn → toon breed.
    """
    if not photos:
        return

    main_photo  = photos[0]
    thumb_photos = photos[1:5]

    if not thumb_photos:
        st.image(main_photo, use_container_width=True)
        return

    # Grid via HTML
    thumbs_html = ""
    for t in thumb_photos[:4]:
        thumbs_html += f'<img class="vs-detail-photo-thumb" src="{safe_html(t)}" alt="foto" loading="lazy">'

    st.markdown(f"""
<div class="vs-detail-photo-grid">
  <img class="vs-detail-photo-main" src="{safe_html(main_photo)}" alt="hoofdfoto" loading="lazy">
  {thumbs_html}
</div>
""", unsafe_allow_html=True)


# ── DETAIL DIALOG ──────────────────────────────────────────────────────────────

@st.dialog("📍 Locatiedetails", width="large")
def show_detail_dialog(row: Any) -> None:
    """
    Rijke Booking.com-stijl detail modal.
    Tabbladen: Overzicht | Faciliteiten | Huisregels | Reviews | Kaart
    Inclusief: fotogalerij, navigatie-knop, deel-knop, crowdsource formulier.
    """
    naam  = safe_html(clean_val(row.get("naam"), "Onbekend"))
    prov  = safe_html(clean_val(row.get("provincie"), "Onbekend"))
    score = _parse_score(row.get("beoordeling"))

    # Header balk
    score_badge = (
        f'<span style="background:{P_DARK};color:white;border-radius:8px 8px 8px 0;'
        f'padding:6px 12px;font-size:1.1rem;font-weight:800;">{score:.1f}</span>'
        if score else ""
    )
    st.markdown(f"""
<div style="background:linear-gradient(135deg,{P_DARK},{P_BLUE});border-radius:12px;
padding:1.2rem 1.5rem;margin-bottom:1rem;">
  <div style="display:flex;justify-content:space-between;align-items:flex-start;">
    <div>
      <div style="font-family:'Syne',sans-serif;font-size:1.5rem;font-weight:800;
color:white;margin-bottom:3px;">{naam}</div>
      <div style="font-size:0.82rem;color:rgba(255,255,255,0.7);">📍 {prov} · 🚐 Camperplaats</div>
    </div>
    <div>{score_badge}</div>
  </div>
</div>
""", unsafe_allow_html=True)

    # Navigatie + deel knoppen
    nav_lat = clean_val(row.get("latitude"), "")
    nav_lon = clean_val(row.get("longitude"), "")
    nav_url = f"https://www.google.com/maps?q={nav_lat},{nav_lon}" if nav_lat and nav_lon else ""
    naam_raw = clean_val(row.get("naam"), "Camperplaats")

    btn_nav, btn_deel, _ = st.columns([1, 1, 3])
    with btn_nav:
        if nav_url:
            st.link_button("📍 Navigeer", nav_url, use_container_width=True)
    with btn_deel:
        share_text = f"Check deze camperplaats: {naam_raw} in {clean_val(row.get('provincie'), '')} | VrijStaan"
        st.button("🔗 Deel", key=f"deel_{naam_raw[:10]}", use_container_width=True,
                  help=share_text)

    # Tabbladen
    tab_ov, tab_fac, tab_regels, tab_rev, tab_kaart = st.tabs(
        ["📋 Overzicht", "🔌 Faciliteiten", "📜 Huisregels", "⭐ Reviews", "🗺️ Kaart"]
    )

    # ── OVERZICHT ────────────────────────────────────────────────────
    with tab_ov:
        photos = _get_photos(row)
        render_photo_grid(photos)

        col_desc, col_side = st.columns([1.7, 1])
        with col_desc:
            desc = clean_val(row.get("beschrijving"), "Geen beschrijving beschikbaar.")
            st.markdown(f"*{desc}*")
            st.markdown("---")
            rows_info = [
                ("💶", "Prijs",           "prijs"),
                ("🏕️", "Plekken",         "aantal_plekken"),
                ("⛰️", "Ondergrond",      "ondergrond"),
                ("🤫", "Rust",            "rust"),
                ("🕐", "Check-in/out",    "check_in_out"),
                ("📞", "Telefoon",        "telefoonnummer"),
                ("♿", "Toegankelijk",    "toegankelijkheid"),
                ("📏", "Max. voertuig",   "max_lengte"),
                ("⚖️", "Max. gewicht",    "max_gewicht"),
                ("📶", "4G/5G kwaliteit", "remote_work_score"),
                ("📅", "Drukte",          "drukte_indicator"),
            ]
            for emoji, label, col_key in rows_info:
                val = clean_val(row.get(col_key), "Onbekend")
                st.markdown(f"**{emoji} {label}:** {val}")

        with col_side:
            # Highlights box
            st.markdown(f"""
<div class="vs-detail-highlight-box">
  <div style="font-weight:700;margin-bottom:8px;">✨ Hoogtepunten</div>
""", unsafe_allow_html=True)
            highlights = []
            if is_ja(row.get("stroom")):     highlights.append("⚡ Stroom beschikbaar")
            if is_ja(row.get("wifi")):       highlights.append("📶 Wifi aanwezig")
            if is_ja(row.get("sanitair")):   highlights.append("🚿 Sanitaire voorzieningen")
            if is_ja(row.get("water_tanken")): highlights.append("🚰 Water tanken")
            if is_ja(row.get("waterfront")): highlights.append("🌊 Waterfront locatie")
            drukte = clean_val(row.get("drukte_indicator"), "")
            if "plek" in drukte.lower() or "altijd" in drukte.lower():
                highlights.append("✅ Vaak een plek vrij")
            for h in highlights[:6]:
                st.markdown(f"✓ {h}")
            st.markdown("</div>", unsafe_allow_html=True)

            site = clean_val(row.get("website"), "")
            if site:
                if not site.startswith("http"):
                    site = "https://" + site
                st.link_button("🌐 Bezoek website", site, use_container_width=True)

    # ── FACILITEITEN (GRID) ───────────────────────────────────────────
    with tab_fac:
        st.markdown("""<div style="font-family:'Syne',sans-serif;font-size:1rem;
font-weight:700;margin-bottom:0.8rem;">Alle faciliteiten</div>""",
            unsafe_allow_html=True)

        ALL_FAC = [
            ("⚡", "Stroom",             "stroom"),
            ("💡", "Stroomprijs",        "stroom_prijs"),
            ("📶", "Wifi",               "wifi"),
            ("🐾", "Honden toegestaan",  "honden_toegestaan"),
            ("🚿", "Sanitair",           "sanitair"),
            ("🚰", "Water tanken",       "water_tanken"),
            ("🗑️", "Afvalwater dump",   "afvalwater"),
            ("🚽", "Chemisch toilet",    "chemisch_toilet"),
            ("♿", "Toegankelijk",       "toegankelijkheid"),
            ("🌊", "Waterfront",         "waterfront"),
            ("📏", "Max. voertuiglengte","max_lengte"),
            ("⚖️", "Max. gewicht",       "max_gewicht"),
            ("📶", "Remote work score",  "remote_work_score"),
            ("📅", "Drukte-indicator",   "drukte_indicator"),
        ]

        items_html = ""
        for icon, label, col_key in ALL_FAC:
            val = clean_val(row.get(col_key), "Onbekend")
            vl  = val.lower()
            if vl == "ja":
                cls  = "ja"
                disp = f"{icon} {label}"
            elif vl == "nee":
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

        extra = clean_val(row.get("faciliteiten_extra"), "")
        if extra and extra != "Onbekend":
            st.markdown(f"**Extra faciliteiten:** {extra}")

    # ── HUISREGELS ────────────────────────────────────────────────────
    with tab_regels:
        st.markdown("""<div style="font-family:'Syne',sans-serif;font-size:1rem;
font-weight:700;margin-bottom:0.8rem;">Huisregels & beleid</div>""",
            unsafe_allow_html=True)

        for icon, label, col_key in [
            ("🕐", "Check-in / Check-out",  "check_in_out"),
            ("🐾", "Huisdieren",            "honden_toegestaan"),
            ("🚬", "Roken",                 "roken"),
            ("🎉", "Feesten / lawaai",      "feesten"),
            ("🔇", "Stilteplicht",          "stilteplicht"),
            ("♿", "Toegankelijkheid",      "toegankelijkheid"),
        ]:
            val = clean_val(row.get(col_key), "Onbekend")
            vl  = val.lower()
            disp = ("✅ Toegestaan" if vl == "ja" else "❌ Niet toegestaan" if vl == "nee"
                    else safe_html(val))
            st.markdown(f"**{icon} {label}:** {disp}")

        regels = clean_val(row.get("huisregels"), "")
        if regels and regels != "Onbekend":
            st.info(f"📋 {regels}")

        # ── CROWDSOURCING: "Foutje gezien?" ────────────────────────
        with st.expander("✏️ Foutje gezien? Stel een wijziging voor", expanded=False):
            st.markdown(f"""
<div class="vs-crowdsource-box">
  <div style="font-weight:700;margin-bottom:6px;">📝 Verbeter deze informatie</div>
  <div style="font-size:0.82rem;color:{TEXT_MUTE};">
    Jouw correctie wordt door onze beheerders bekeken voordat deze live gaat.
  </div>
</div>
""", unsafe_allow_html=True)
            with st.form(f"crowdsource_{naam[:8]}"):
                veld = st.selectbox(
                    "Welk veld is onjuist?",
                    ["Prijs", "Stroom", "Honden", "Wifi", "Sanitair", "Water",
                     "Telefoonnummer", "Website", "Beschrijving", "Anders"],
                )
                correctie = st.text_area(
                    "Correcte waarde / omschrijving",
                    placeholder="Bijv: De prijs is €8,- per nacht, niet gratis.",
                    max_chars=500,
                )
                submit_cs = st.form_submit_button(
                    "📨 Stuur correctie", use_container_width=True
                )
            if submit_cs and correctie.strip():
                _log_crowdsource(naam, veld, correctie)
                st.success("✅ Bedankt! We bekijken jouw correctie.")

    # ── REVIEWS ───────────────────────────────────────────────────────
    with tab_rev:
        score_p = _parse_score(row.get("beoordeling"))
        if score_p:
            st.markdown(f"""
<div style="display:flex;align-items:center;gap:16px;margin-bottom:1rem;">
  <div style="background:{P_DARK};color:white;border-radius:12px 12px 12px 0;
padding:14px 18px;font-size:2rem;font-weight:800;">{score_p:.1f}</div>
  <div>
    <div style="font-family:'Syne',sans-serif;font-size:1.1rem;font-weight:700;">
      {score_label(score_p)}
    </div>
    <div style="font-size:0.8rem;color:{TEXT_MUTE};">Op basis van gastbeoordelingen</div>
  </div>
</div>""", unsafe_allow_html=True)

        samen = clean_val(row.get("samenvatting_reviews"), "Nog geen reviews verwerkt.")
        st.info(f"💬 {samen}")
        rev_ext = clean_val(row.get("reviews_tekst"), "")
        if rev_ext and rev_ext != "Onbekend":
            with st.expander("Lees meer reviews"):
                st.markdown(rev_ext)

    # ── KAART ─────────────────────────────────────────────────────────
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
            if nav_url:
                st.markdown(f"[📍 Open in Google Maps]({nav_url})")
        except (TypeError, ValueError):
            st.warning("⚠️ Geen geldige coördinaten voor deze locatie.")


def _log_crowdsource(naam: str, veld: str, correctie: str) -> None:
    """Sla crowdsource-suggestie op in een lokaal JSON-bestand."""
    import json, os
    from datetime import datetime
    path = "data/crowdsource.json"
    entry = {
        "ts": datetime.now().isoformat(),
        "naam": naam,
        "veld": veld,
        "correctie": correctie,
    }
    try:
        bestaand = []
        if os.path.exists(path):
            with open(path, "r", encoding="utf-8") as f:
                bestaand = json.load(f)
        bestaand.append(entry)
        with open(path, "w", encoding="utf-8") as f:
            json.dump(bestaand, f, ensure_ascii=False, indent=2)
        logger.info(f"Crowdsource entry: {naam} | {veld}")
    except Exception as e:
        logger.error(f"Crowdsource opslaan mislukt: {e}")


# ── HOOFD KAART COMPONENT ──────────────────────────────────────────────────────

def render_result_card(row: Any, idx: int | str) -> None:
    """
    Rendert één Booking.com-stijl resultaatkaart.
    Foto (links) | Info (midden) | Score + Prijs (rechts)
    Inclusief: drukte-badge, voertuig-restricties, Airbnb-stijl chips.
    """
    naam_raw = clean_val(row.get("naam"), "Onbekend")
    naam_s   = safe_html(naam_raw)
    prov_s   = safe_html(clean_val(row.get("provincie"), "Onbekend"))
    desc     = clean_val(row.get("beschrijving"), "")
    loc_type = clean_val(row.get("loc_type"), "Camperplaats")
    photos   = _get_photos(row)
    img_url  = safe_html(photos[0])
    chips    = _chip_row(row)
    restr    = _restrictions_html(row)
    drukte   = _drukte_badge(row)
    score_b  = _score_html(row.get("beoordeling"))
    price_b  = _price_html(row.get("prijs"))
    is_fav   = naam_raw in get_favorites()
    fav_ico  = "❤️" if is_fav else "🤍"

    # Afstand (indien beschikbaar)
    afstand = clean_val(row.get("afstand_label"), "")
    afstand_html = (
        f'<span class="vs-distance-badge">📍 {safe_html(afstand)}</span>'
        if afstand else ""
    )

    st.markdown(f"""
<div class="vs-result-card">

  <!-- FOTO KOLOM -->
  <div class="vs-card-img-wrap">
    <img class="vs-card-img"
         src="{img_url}"
         alt="{naam_s}"
         loading="lazy"
         onerror="this.src='https://images.unsplash.com/photo-1523987355523-c7b5b0dd90a7?w=600&q=80&auto=format'">
    <button class="vs-fav-btn" title="Favoriet">{fav_ico}</button>
    {drukte}
  </div>

  <!-- INFO KOLOM -->
  <div class="vs-card-info">
    <div>
      <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:3px;">
        <span class="vs-type-pill">🚐 {safe_html(loc_type)}</span>
        {afstand_html}
      </div>
      <div class="vs-card-name" title="{naam_s}">{naam_s}</div>
      <div class="vs-card-meta">📍 {prov_s}</div>
      {f'<div class="vs-card-desc">{safe_html(desc)}</div>' if desc else ''}
      <div class="vs-chip-row">{chips}</div>
      {restr}
    </div>
  </div>

  <!-- PRIJS KOLOM -->
  <div class="vs-card-price-col">
    {score_b}
    {price_b}
  </div>

</div>
""", unsafe_allow_html=True)

    btn_c, fav_c = st.columns([4, 1])
    with btn_c:
        if st.button(
            "Bekijk details →",
            key=f"det_{idx}",
            type="primary",
            use_container_width=True,
        ):
            show_detail_dialog(row)
    with fav_c:
        if st.button(fav_ico, key=f"fav_{idx}", use_container_width=True,
                     help="Favoriet aan/uit"):
            toggle_favorite(naam_raw)
            st.rerun()


# ── LEGE STAAT ─────────────────────────────────────────────────────────────────

def render_no_results(query: str = "") -> None:
    """Anti-clutter lege staat."""
    msg = (
        f"Geen resultaten voor <strong>'{safe_html(query)}'</strong>"
        if query else "Geen camperplaatsen gevonden"
    )
    st.markdown(f"""
<div class="vs-empty-state">
  <div style="font-size:3rem;margin-bottom:1rem;">🔭</div>
  <div style="font-size:1.2rem;font-weight:700;color:#2D3748;margin-bottom:0.5rem;">{msg}</div>
  <div style="font-size:0.88rem;">
    Verwijder een paar filters of probeer een andere zoekterm.
  </div>
</div>
""", unsafe_allow_html=True)
