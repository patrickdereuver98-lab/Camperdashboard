"""
ui/components.py — VrijStaan v5 UI componenten.
Booking.com-stijl resultaatkaart + Airbnb detail-pagina + Crowdsource formulier.
Pijler 3: Crowdsource "Foutje gezien?". Pijler 6: Drukte/voertuig/remote indicators.
Opgeschoond: Integratie van review_score, beschrijving_lang en storytelling.
"""
from __future__ import annotations

import html as _html
import json
from datetime import datetime
from pathlib import Path
from typing import Any

import folium
import pandas as pd
import streamlit as st
import streamlit.components.v1 as components

from ui.theme import (
    BRAND_PRIMARY, BRAND_DARK, TEXT_MUTED, BORDER,
)
from utils.helpers import clean_val, safe_html, is_ja
from utils.favorites import get_favorites, toggle_favorite

# Path voor crowdsource meldingen
REPORT_PATH = Path("data/meldingen.json")


# ── HELPERS ────────────────────────────────────────────────────────────────────

def _parse_score(raw: Any) -> float | None:
    """Parseer score naar float (0-10 schaal)."""
    val = clean_val(raw, "")
    if not val:
        return None
    try:
        f = float(val.replace(",", ".").split("/")[0].strip())
        return round(f * 2.0, 1) if f <= 5.0 else round(f, 1)
    except (ValueError, TypeError):
        return None


def _score_label(score: float) -> str:
    if score >= 9.0:   return "Uitzonderlijk"
    if score >= 8.5:   return "Geweldig"
    if score >= 8.0:   return "Heel goed"
    if score >= 7.5:   return "Goed"
    if score >= 7.0:   return "Prima"
    return "Redelijk"


def _score_html(row: Any) -> str:
    raw_score = row.get("review_score") or row.get("beoordeling")
    score = _parse_score(raw_score)
    if not score:
        return ""
    label = _score_label(score)
    
    aantal = clean_val(row.get("review_aantal", ""), "")
    aantal_html = f"<span style='font-size:0.62rem;color:#aaa;'>{safe_html(aantal)} reviews</span>" if aantal and aantal != "Onbekend" else "<span style='font-size:0.62rem;color:#aaa;'>beoordeling</span>"
    
    return f"""
<div class="vs-score-block">
  <div class="vs-score-label">{safe_html(label)}<br>
    {aantal_html}
  </div>
  <div class="vs-score-badge">{score:.1f}</div>
</div>"""


def _price_html(prijs: Any) -> str:
    p = clean_val(prijs, "")
    if p.lower() == "gratis":
        return '<div class="vs-price-block"><div class="vs-price-from">per nacht</div><div class="vs-price-main gratis">Gratis</div><div class="vs-price-sub">geen vertrektijd</div></div>'
    elif not p:
        return '<div class="vs-price-block"><div class="vs-price-main onbekend">Prijs onbekend</div></div>'
    return f'<div class="vs-price-block"><div class="vs-price-from">per nacht</div><div class="vs-price-main">{safe_html(p)}</div><div class="vs-price-sub">incl. toeristenbelasting</div></div>'


def _drukte_html(row: Any) -> str:
    """Pijler 6: Drukte-indicator chip."""
    drukte = clean_val(row.get("drukte_indicator", ""), "")
    if not drukte or drukte == "Onbekend":
        return ""
    d_lower = drukte.lower()
    if "snel vol" in d_lower or "vol" in d_lower:
        return '<span class="vs-drukte-pill vs-drukte-vol">🔴 Snel vol</span>'
    if "druk" in d_lower:
        return '<span class="vs-drukte-pill vs-drukte-druk">🟠 Druk</span>'
    if "plek" in d_lower or "vrij" in d_lower or "ruim" in d_lower:
        return '<span class="vs-drukte-pill vs-drukte-plek">🟢 Vaak plek</span>'
    return f'<span class="vs-drukte-pill vs-drukte-plek">{safe_html(drukte)}</span>'


def _facilities_chips(row: Any) -> str:
    chips = []
    mapping = [
        ("stroom",            "⚡", "Stroom",    True),
        ("wifi",              "📶", "Wifi",      True),
        ("honden_toegestaan", "🐾", "Honden ok", True),
        ("water_tanken",      "🚰", "Water",     False),
        ("sanitair",          "🚿", "Sanitair",  False),
        ("afvalwater",        "🗑️", "Afval",    False),
    ]
    for col, icon, label, hl in mapping:
        if is_ja(row.get(col, "")):
            cls = "highlight" if hl else ""
            chips.append(f'<span class="vs-facility-chip {cls}">{icon} {label}</span>')
    # Voertuig restricties (Pijler 6)
    max_len = clean_val(row.get("max_lengte", ""), "")
    if max_len and max_len != "Onbekend":
        chips.append(f'<span class="vs-facility-chip">📏 max {safe_html(max_len)}</span>')
    return "".join(chips)


def _get_photo(row: Any) -> str:
    photos = row.get("photos", "")
    if photos and str(photos) not in ("", "nan", "Onbekend", "[]"):
        try:
            pl = json.loads(str(photos)) if isinstance(photos, str) else photos
            if isinstance(pl, list) and pl:
                return str(pl[0])
        except Exception:
            pass
    img = clean_val(row.get("afbeelding", ""), "")
    return img or "https://images.unsplash.com/photo-1523987355523-c7b5b0dd90a7?w=500&q=80&auto=format"


# ── RESULTAATKAART ─────────────────────────────────────────────────────────────

def render_result_card(row: Any, idx: int | str) -> None:
    """
    Booking.com-stijl resultaatkaart.
    [Foto] | [Info: naam, loc, afstand, chips, drukte] | [Score + Prijs]
    """
    naam_raw  = clean_val(row.get("naam"), "Onbekend")
    naam_s    = safe_html(naam_raw)
    prov_s    = safe_html(clean_val(row.get("provincie"), "Onbekend"))
    
    # Backwards compatibility: probeer eerst kort, anders standaard beschrijving
    desc      = clean_val(row.get("beschrijving_kort"), "") or clean_val(row.get("beschrijving"), "")
    
    afstand   = clean_val(row.get("afstand_label", ""), "")
    img_url   = _get_photo(row)
    chips     = _facilities_chips(row)
    drukte    = _drukte_html(row)
    score_blk = _score_html(row)
    price_blk = _price_html(row.get("prijs"))
    is_fav    = naam_raw in get_favorites()
    fav_icon  = "❤️" if is_fav else "🤍"

    st.markdown(f"""
<div class="vs-result-card">
  <div class="vs-card-img-col">
    <img class="vs-card-img"
         src="{safe_html(img_url)}"
         alt="{naam_s}"
         loading="lazy"
         onerror="this.src='https://images.unsplash.com/photo-1523987355523-c7b5b0dd90a7?w=400&q=80&auto=format'">
  </div>
  <div class="vs-card-info-col">
    <div>
      <div class="vs-card-name" title="{naam_s}">{naam_s}</div>
      <div class="vs-card-location">📍 {prov_s}{f" · {safe_html(afstand)}" if afstand else ""}</div>
      {f'<div class="vs-card-desc">{safe_html(desc)}</div>' if desc else ''}
      <div class="vs-facilities-row">{chips}</div>
      {drukte}
    </div>
  </div>
  <div class="vs-card-price-col">
    {score_blk}
    {price_blk}
  </div>
</div>
""", unsafe_allow_html=True)

    btn_col, fav_col = st.columns([4, 1])
    with btn_col:
        if st.button("🔍 Bekijk details", key=f"det_{idx}", type="primary", use_container_width=True):
            show_detail_dialog(row)
    with fav_col:
        if st.button(fav_icon, key=f"fav_{idx}", use_container_width=True,
                     help="Favoriet aan/uitschakelen"):
            toggle_favorite(naam_raw)
            st.rerun()


# ── DETAIL DIALOG ──────────────────────────────────────────────────────────────

@st.dialog("📍 Locatiedetails", width="large")
def show_detail_dialog(row: Any) -> None:
    """
    Rijke detailpagina in Booking.com-stijl.
    Tabbladen: Overzicht | Faciliteiten | Camper Info | Reviews | Kaart
    + Crowdsource "Foutje gezien?" formulier (Pijler 3).
    + Deel-knop + Navigeer-knop (Pijler 3).
    """
    naam  = safe_html(clean_val(row.get("naam"), "Onbekend"))
    prov  = safe_html(clean_val(row.get("provincie"), "Onbekend"))
    
    score_val = row.get("review_score") or row.get("beoordeling")
    score = _parse_score(score_val)

    score_badge = (
        f'<div class="vs-score-badge" style="font-size:1.4rem;padding:8px 14px;">'
        f'{score:.1f}</div>'
        if score else ""
    )

    st.markdown(f"""
<div class="vs-detail-hero">
  <div style="display:flex;justify-content:space-between;align-items:flex-start;">
    <div>
      <div class="vs-detail-name">{naam}</div>
      <div class="vs-detail-loc">📍 {prov}  ·  🚐 Camperplaats</div>
    </div>
    {score_badge}
  </div>
</div>
""", unsafe_allow_html=True)

    # Actie-knoppen (Navigeer + Deel)
    try:
        lat_f = float(str(row.get("latitude", "")).replace(",", "."))
        lon_f = float(str(row.get("longitude", "")).replace(",", "."))
        maps_url = f"https://www.google.com/maps/dir/?api=1&destination={lat_f},{lon_f}"
        share_url = f"https://www.google.com/maps?q={lat_f},{lon_f}"
    except (ValueError, TypeError):
        maps_url = share_url = ""

    act_cols = st.columns([2, 2, 3])
    with act_cols[0]:
        if maps_url:
            st.link_button("🧭 Navigeer", maps_url, use_container_width=True)
    with act_cols[1]:
        if share_url:
            st.link_button("🔗 Deel plek", share_url, use_container_width=True)

    st.markdown("---")

    tab_ov, tab_fac, tab_camper, tab_rev, tab_kaart = st.tabs([
        "📋 Overzicht", "🔌 Faciliteiten", "🚐 Camper Info", "⭐ Reviews", "🗺️ Kaart"
    ])

    # ── TAB 1: OVERZICHT ───────────────────────────────────────────────
    with tab_ov:
        col_img, col_info = st.columns([1, 1.5])
        with col_img:
            img = _get_photo(row)
            st.image(img, use_container_width=True)
            # Extra foto's
            photos = row.get("photos", "")
            if photos and str(photos) not in ("", "nan", "Onbekend", "[]"):
                try:
                    pl = json.loads(str(photos)) if isinstance(photos, str) else photos
                    if isinstance(pl, list) and len(pl) > 1:
                        for p in pl[1:3]:
                            st.image(str(p), use_container_width=True)
                        if len(pl) > 3:
                            st.caption(f"📸 {len(pl)} foto's beschikbaar")
                except Exception:
                    pass
            site = clean_val(row.get("website"), "")
            if site:
                if not site.startswith("http"):
                    site = "https://" + site
                st.markdown(f"[🌐 Bezoek website]({site})")

        with col_info:
            desc = clean_val(row.get("beschrijving_lang"), "") or clean_val(row.get("beschrijving"), "Geen beschrijving beschikbaar.")
            st.markdown(f"*{desc}*")
            st.markdown("---")
            for emoji, label, col_key in [
                ("💶", "Prijs",          "prijs"),
                ("🏕️", "Aantal plekken", "aantal_plekken"),
                ("⛰️", "Ondergrond",     "ondergrond"),
                ("🤫", "Rust",           "rust"),
                ("🕐", "Check-in/out",   "check_in_out"),
                ("📞", "Telefoon",       "telefoonnummer"),
            ]:
                val = clean_val(row.get(col_key), "Onbekend")
                st.markdown(f"**{emoji} {label}:** {val}")

    # ── TAB 2: FACILITEITEN GRID ───────────────────────────────────────
    with tab_fac:
        st.markdown("""<div style="font-family:'DM Serif Display',serif;
font-size:1.1rem;margin-bottom:0.8rem;color:var(--vs-text);">
Faciliteiten & Voorzieningen</div>""", unsafe_allow_html=True)

        all_fac = [
            ("⚡", "Stroom",             "stroom"),
            ("💡", "Stroomprijs",        "stroom_prijs"),
            ("📶", "Wifi",               "wifi"),
            ("🐾", "Honden toegestaan",  "honden_toegestaan"),
            ("🚿", "Sanitair",           "sanitair"),
            ("🚰", "Water tanken",       "water_tanken"),
            ("🗑️", "Afvalwater dump",   "afvalwater"),
            ("🚽", "Chemisch toilet",    "chemisch_toilet"),
        ]
        items = ""
        for icon, label, key in all_fac:
            val = clean_val(row.get(key), "Onbekend")
            vl  = val.lower()
            cls = "ja" if vl == "ja" else ("nee" if vl == "nee" else "")
            disp = f"{icon} {label}" if vl in ("ja", "nee") else f"{icon} {label}: {safe_html(val)}"
            items += f'<div class="vs-facility-item {cls}">{disp}</div>'
        st.markdown(f'<div class="vs-facility-grid">{items}</div>', unsafe_allow_html=True)

    # ── TAB 3: CAMPER-SPECIFIEKE INFO (Pijler 6) ─────────────────────
    with tab_camper:
        st.markdown("""<div style="font-family:'DM Serif Display',serif;
font-size:1.1rem;margin-bottom:0.8rem;">Camper-specifieke informatie</div>""",
            unsafe_allow_html=True)

        camper_info = [
            ("📏", "Max voertuiglengte",    "max_lengte"),
            ("⚖️", "Max gewicht",           "max_gewicht"),
            ("🔴", "Drukte-indicator",      "drukte_indicator"),
            ("📱", "4G/5G kwaliteit",       "remote_work_score"),
            ("🚗", "Voertuigtypes",         "voertuig_types"),
            ("🏷️", "Tarieftype",            "tarieftype"),
        ]
        for emoji, label, key in camper_info:
            val = clean_val(row.get(key), "Onbekend")
            st.markdown(f"**{emoji} {label}:** {val}")

        # Remote work score visueel (Pijler 6)
        rws = clean_val(row.get("remote_work_score", ""), "")
        if rws and rws != "Onbekend":
            st.markdown("---")
            st.markdown("**📱 Remote Work Score:**")
            rws_lower = rws.lower()
            if "uitstekend" in rws_lower or "goed" in rws_lower:
                st.success(f"✅ {rws}")
            elif "matig" in rws_lower or "slecht" in rws_lower:
                st.warning(f"⚠️ {rws}")
            else:
                st.info(f"ℹ️ {rws}")

    # ── TAB 4: REVIEWS ────────────────────────────────────────────────
    with tab_rev:
        score_val = row.get("review_score") or row.get("beoordeling")
        score_p = _parse_score(score_val)
        aantal = clean_val(row.get("review_aantal"), "")
        aantal_text = f"Gebaseerd op {aantal} reviews" if aantal and aantal != "Onbekend" else "Gebaseerd op beoordelingen"
        
        if score_p:
            st.markdown(f"""
<div style="display:flex;align-items:center;gap:16px;margin-bottom:1.5rem;">
  <div style="background:{BRAND_DARK};color:white;border-radius:10px 10px 10px 0;
              padding:10px 14px;font-size:1.8rem;font-weight:700;">{score_p:.1f}</div>
  <div>
    <div style="font-family:'DM Serif Display',serif;font-size:1.1rem;font-weight:700;">
      {_score_label(score_p)}
    </div>
    <div style="font-size:0.78rem;color:{TEXT_MUTED};">{aantal_text}</div>
  </div>
</div>""", unsafe_allow_html=True)

        vibe = clean_val(row.get("review_vibe"), "")
        plus = clean_val(row.get("review_pluspunt"), "")
        minp = clean_val(row.get("review_minpunt"), "")
        oude_samenvatting = clean_val(row.get("samenvatting_reviews"), "")

        if vibe and vibe != "Onbekend":
            st.markdown(f"**✨ Sfeer:** {vibe}")
        if plus and plus != "Onbekend":
            st.markdown(f"**👍 Pluspunt:** {plus}")
        if minp and minp != "Onbekend":
            st.markdown(f"**📉 Minpunt:** {minp}")
            
        # Terugval op oude data als nieuwe AI data nog ontbreekt
        if not vibe and not plus and oude_samenvatting and oude_samenvatting != "Onbekend":
            st.info(f"💬 {oude_samenvatting}")
            
        rev_extra = clean_val(row.get("reviews_tekst", ""), "")
        if rev_extra and rev_extra != "Onbekend":
            with st.expander("Meer reviews lezen"):
                st.markdown(rev_extra)

    # ── TAB 5: KAART ──────────────────────────────────────────────────
    with tab_kaart:
        try:
            lat_f = float(str(row.get("latitude", "")).replace(",", "."))
            lon_f = float(str(row.get("longitude", "")).replace(",", "."))
            m = folium.Map(location=[lat_f, lon_f], zoom_start=14, tiles="CartoDB Positron")
            folium.Marker(
                [lat_f, lon_f],
                popup=clean_val(row.get("naam"), "Camperplaats"),
                icon=folium.Icon(color="blue", icon="home", prefix="fa"),
            ).add_to(m)
            components.html(m._repr_html_(), height=340)
            st.markdown(f"[📍 Open in Google Maps](https://www.google.com/maps?q={lat_f},{lon_f})")
        except (TypeError, ValueError):
            st.warning("⚠️ Geen geldige coördinaten voor deze locatie.")

    # ── CROWDSOURCE FORMULIER (Pijler 3) ──────────────────────────────
    st.markdown("---")
    st.markdown("""<div class="vs-report-box">
<div class="vs-report-title">🔧 Foutje gezien? Help ons verbeteren!</div>
</div>""", unsafe_allow_html=True)

    with st.expander("Geef een correctie door ›", expanded=False):
        with st.form(f"report_form_{naam}"):
            veld = st.selectbox("Welk veld klopt niet?", [
                "prijs", "honden_toegestaan", "stroom", "wifi", "sanitair",
                "water_tanken", "telefoonnummer", "beschrijving", "anders"
            ])
            correctie = st.text_area("Wat is de juiste waarde?", max_chars=500)
            opmerking = st.text_input("Optioneel: bron of toelichting", max_chars=200)
            submitted = st.form_submit_button("📤 Correctie insturen", type="primary")
            if submitted and correctie.strip():
                _save_report(naam, veld, correctie, opmerking)
                st.success("✅ Bedankt! We bekijken je correctie zo snel mogelijk.")


def _save_report(naam: str, veld: str, correctie: str, opmerking: str) -> None:
    """Sla een crowdsource melding op als JSON."""
    REPORT_PATH.parent.mkdir(parents=True, exist_ok=True)
    try:
        existing = json.loads(REPORT_PATH.read_text(encoding="utf-8")) if REPORT_PATH.exists() else []
    except Exception:
        existing = []
    existing.append({
        "timestamp": datetime.now().isoformat(),
        "naam":      naam,
        "veld":      veld,
        "correctie": correctie,
        "opmerking": opmerking,
        "status":    "nieuw",
    })
    REPORT_PATH.write_text(json.dumps(existing, ensure_ascii=False, indent=2), encoding="utf-8")


# ── LEGE STAAT ─────────────────────────────────────────────────────────────────

def render_no_results(query: str = "") -> None:
    msg = (
        f"Geen resultaten voor <strong>'{safe_html(query)}'</strong>"
        if query else "Geen camperplaatsen gevonden"
    )
    st.markdown(f"""
<div class="vs-no-results">
  <div class="vs-no-results-icon">🔭</div>
  <div style="font-size:1.15rem;font-weight:600;margin-bottom:0.5rem;">{msg}</div>
  <div style="font-size:0.88rem;">Probeer andere zoektermen of verwijder filters.</div>
</div>""", unsafe_allow_html=True)
