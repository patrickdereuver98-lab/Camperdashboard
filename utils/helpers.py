"""
utils/helpers.py — VrijStaan v5 Utility functies.
Pijler 7: 100% crash-proof via safe .get() overal.
Pijler 4: Hybride zoekfunctie (exacte match → AI fallback).
"""
from __future__ import annotations

import html as _html
from typing import Any

_EMPTY = {"nan", "none", "", "onbekend", "unknown", "n/a", "null", "-", "–", "[]"}


def clean_val(val: Any, fallback: str = "Onbekend") -> str:
    """Crash-proof waarde naar string. Lege/nan/onbekende → fallback."""
    if val is None:
        return fallback
    s = str(val).strip()
    return fallback if s.lower() in _EMPTY else s


def safe_html(val: Any) -> str:
    """Escape HTML-gevaarlijke tekens."""
    return _html.escape(str(val))


def format_score(raw: Any) -> str:
    """Getal → '4.2/5'. Leeg → ''."""
    val = clean_val(raw, "")
    if not val:
        return ""
    try:
        float(val.replace(",", "."))
        return f"{val}/5"
    except ValueError:
        return val


def is_ja(val: Any) -> bool:
    """True als veld 'Ja' bevat (case-insensitive)."""
    return str(val).strip().lower() == "ja"


def safe_float(val: Any, default: float = 0.0) -> float:
    """Crash-proof float conversie."""
    try:
        return float(str(val).replace(",", "."))
    except (ValueError, TypeError):
        return default


def truncate(text: str, max_chars: int = 120) -> str:
    """Verkort tekst tot max_chars."""
    if len(text) <= max_chars:
        return text
    return text[:max_chars].rsplit(" ", 1)[0] + "…"


def facility_badges_html(row: Any) -> str:
    """Compact badge-HTML voor alle aanwezige faciliteiten."""
    badges = []
    mapping = [
        ("stroom",            "vs-badge-stroom", "⚡", "Stroom"),
        ("honden_toegestaan", "vs-badge-honden", "🐾", "Honden"),
        ("wifi",              "vs-badge-wifi",   "📶", "Wifi"),
        ("water_tanken",      "vs-badge-water",  "🚰", "Water"),
        ("waterfront",        "vs-badge-water",  "🌊", "Waterfront"),
        ("sanitair",          "vs-badge-groen",  "🚿", "Sanitair"),
    ]
    for col, cls, icon, label in mapping:
        if is_ja(row.get(col, "")):
            badges.append(f'<span class="vs-badge {cls}">{icon} {label}</span>')
    return "".join(badges)


def price_badge_html(prijs: Any) -> str:
    """HTML price badge."""
    p = clean_val(prijs, "")
    if p.lower() == "gratis":
        return '<span class="vs-badge vs-badge-gratis">💰 Gratis</span>'
    elif not p:
        return '<span class="vs-badge vs-badge-onbekend">❓ Onbekend</span>'
    return f'<span class="vs-badge vs-badge-betaald">💶 {safe_html(p)}</span>'


def hybrid_search_df(
    df: "pd.DataFrame",  # type: ignore[name-defined]
    query: str,
) -> "tuple[pd.DataFrame, bool]":  # type: ignore[name-defined]
    """
    Pijler 4: Hybride zoekfunctie.
    Stap 1: Exacte naam / provincie match.
    Stap 2: Geen match → use_ai=True (AI-intentie zoeken).

    Returns: (gefilterde_df, use_ai)
    """
    import pandas as pd  # noqa: PLC0415

    q = query.strip().lower()
    if not q:
        return df, False

    naam_match = df[df["naam"].astype(str).str.lower().str.contains(q, na=False)]
    if not naam_match.empty:
        return naam_match, False

    prov_match = df[df["provincie"].astype(str).str.lower().str.contains(q, na=False)]
    if not prov_match.empty:
        return prov_match, False

    return df, True


def apply_vehicle_filters(
    df: "pd.DataFrame",  # type: ignore[name-defined]
    f_lange_camper: bool,
    f_zwaar_voertuig: bool,
) -> "pd.DataFrame":  # type: ignore[name-defined]
    """
    Pijler 3: Filter op voertuig-restricties.
    f_lange_camper:   locaties geschikt voor >8m voertuigen.
    f_zwaar_voertuig: locaties geschikt voor >3.5t voertuigen.
    """
    if f_lange_camper and "max_lengte" in df.columns:
        def _accepts_long(v: Any) -> bool:
            raw = clean_val(v, "0")
            raw = raw.lower().replace("m", "").replace(">", "").replace("≥", "").strip()
            try:
                return float(raw) >= 8.0
            except ValueError:
                return False  # Onbekend → toon niet bij strikte filter

        df = df[df["max_lengte"].apply(_accepts_long)]

    if f_zwaar_voertuig and "max_gewicht" in df.columns:
        def _accepts_heavy(v: Any) -> bool:
            raw = clean_val(v, "0")
            raw = (raw.lower().replace("t", "").replace("ton", "")
                   .replace(">", "").replace("≥", "").strip())
            try:
                return float(raw) >= 3.5
            except ValueError:
                return False

        df = df[df["max_gewicht"].apply(_accepts_heavy)]

    return df
