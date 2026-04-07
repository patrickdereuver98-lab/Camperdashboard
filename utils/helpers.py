"""
utils/helpers.py — Gedeelde utility functies voor VrijStaan v4.
Geen Streamlit-afhankelijkheden: puur Python.
Uitgebreid met nieuwe helpers voor Booking.com-stijl UI.
"""
from __future__ import annotations

import html as _html
from typing import Any

# Alle waarden die als "leeg" worden beschouwd
_EMPTY = {"nan", "none", "", "onbekend", "unknown", "n/a", "null", "-", "–", "[]"}


def clean_val(val: Any, fallback: str = "Onbekend") -> str:
    """
    Converteert élke waarde naar een bruikbare string.
    Geeft `fallback` terug bij lege, nan, none of onbekende waarden.
    """
    if val is None:
        return fallback
    s = str(val).strip()
    if s.lower() in _EMPTY:
        return fallback
    return s


def safe_html(val: Any) -> str:
    """Escapet HTML-gevaarlijke tekens voor veilig gebruik in f-string HTML."""
    return _html.escape(str(val))


def format_score(raw: Any) -> str:
    """
    Formatteert een beoordelingsscore correct.
    Getal → '4.2/5' | Tekst → retourneer tekst | Leeg → ''
    """
    val = clean_val(raw, "")
    if not val:
        return ""
    try:
        float(val.replace(",", "."))
        return f"{val}/5"
    except ValueError:
        return val


def is_ja(val: Any) -> bool:
    """Geeft True als een veld 'Ja' (case-insensitive) bevat."""
    return str(val).strip().lower() == "ja"


def safe_float(val: Any, default: float = 0.0) -> float:
    """Converteert naar float, geeft default terug bij een fout."""
    try:
        return float(str(val).replace(",", "."))
    except (ValueError, TypeError):
        return default


def facility_badges_html(row: Any) -> str:
    """
    Genereert HTML badge-string voor een locatierij.
    Gebruikt door kaartcomponenten voor compacte weergave.
    """
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
            badges.append(
                f'<span class="vs-badge {cls}">{icon} {label}</span>'
            )
    return "".join(badges)


def price_badge_html(prijs: Any) -> str:
    """HTML badge voor prijsweergave."""
    p = clean_val(prijs, "")
    if p.lower() == "gratis":
        return '<span class="vs-badge vs-badge-gratis">💰 Gratis</span>'
    elif not p:
        return '<span class="vs-badge vs-badge-onbekend">❓ Onbekend</span>'
    else:
        return f'<span class="vs-badge vs-badge-betaald">💶 {safe_html(p)}</span>'


def truncate(text: str, max_chars: int = 120) -> str:
    """Verkort een tekst tot max_chars, voegt '…' toe als nodig."""
    if len(text) <= max_chars:
        return text
    return text[:max_chars].rsplit(" ", 1)[0] + "…"


def hybrid_search_df(
    df: "pd.DataFrame",  # type: ignore
    query: str,
) -> tuple["pd.DataFrame", bool]:  # type: ignore
    """
    Pijler 4: Hybride zoekfunctie.
    Stap 1: Exacte naam/provincie match (case-insensitive).
    Stap 2: Als geen resultaten → geef origineel terug met use_ai=True.

    Returns:
      (gefilterde_df, use_ai)
      use_ai=True betekent: schakel over naar AI-intentie zoekopdracht.
    """
    import pandas as pd

    q = query.strip().lower()
    if not q:
        return df, False

    # Exacte naam match
    naam_match = df[
        df["naam"].astype(str).str.lower().str.contains(q, na=False)
    ]
    if not naam_match.empty:
        return naam_match, False

    # Exacte provincie match
    prov_match = df[
        df["provincie"].astype(str).str.lower().str.contains(q, na=False)
    ]
    if not prov_match.empty:
        return prov_match, False

    # Geen directe match → AI intent zoeken
    return df, True
