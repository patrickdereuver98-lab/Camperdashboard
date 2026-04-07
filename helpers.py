"""
utils/helpers.py — Gedeelde utility functies voor VrijStaan v5.
Crash-proof, type-hinted, PEP8. Geen Streamlit afhankelijkheden.
"""
from __future__ import annotations

import html as _html
from math import radians, cos, sin, asin, sqrt
from typing import Any

import pandas as pd

_EMPTY = {"nan", "none", "", "onbekend", "unknown", "n/a", "null", "-", "–", "[]"}


def clean_val(val: Any, fallback: str = "Onbekend") -> str:
    """Converteert élke waarde naar bruikbare string, fallback bij lege/nan."""
    if val is None:
        return fallback
    s = str(val).strip()
    return fallback if s.lower() in _EMPTY else s


def safe_html(val: Any) -> str:
    """HTML-escape voor veilig gebruik in f-string HTML."""
    return _html.escape(str(val))


def format_score(raw: Any) -> str:
    """Getal → '4.2/5' | Tekst → tekst | Leeg → ''"""
    val = clean_val(raw, "")
    if not val:
        return ""
    try:
        float(val.replace(",", "."))
        return f"{val}/5"
    except ValueError:
        return val


def is_ja(val: Any) -> bool:
    """True als veld 'Ja' (case-insensitive)."""
    return str(val).strip().lower() == "ja"


def safe_float(val: Any, default: float = 0.0) -> float:
    """Float conversie met fallback."""
    try:
        return float(str(val).replace(",", "."))
    except (ValueError, TypeError):
        return default


def truncate(text: str, max_chars: int = 120) -> str:
    """Verkort tekst tot max_chars."""
    return text if len(text) <= max_chars else text[:max_chars].rsplit(" ", 1)[0] + "…"


def facility_badges_html(row: Any) -> str:
    """HTML badge-string voor een locatierij."""
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
    """HTML badge voor prijsweergave."""
    p = clean_val(prijs, "")
    if p.lower() == "gratis":
        return '<span class="vs-badge vs-badge-gratis">💰 Gratis</span>'
    if not p:
        return '<span class="vs-badge vs-badge-onbekend">❓ Onbekend</span>'
    return f'<span class="vs-badge vs-badge-betaald">💶 {safe_html(p)}</span>'


# ── HAVERSINE AFSTAND ──────────────────────────────────────────────────────────

def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Berekent afstand in km tussen twee GPS-coördinaten."""
    R = 6371.0
    lat1, lon1, lat2, lon2 = map(radians, [lat1, lon1, lat2, lon2])
    a = sin((lat2 - lat1) / 2) ** 2 + cos(lat1) * cos(lat2) * sin((lon2 - lon1) / 2) ** 2
    return R * 2 * asin(sqrt(a))


def add_distances(
    df: pd.DataFrame,
    user_lat: float,
    user_lon: float,
) -> pd.DataFrame:
    """
    Voegt 'afstand_km' en 'afstand_label' kolommen toe en sorteert op afstand.

    Args:
      df:       Dataset met 'latitude' en 'longitude' kolommen
      user_lat: GPS latitude van de gebruiker
      user_lon: GPS longitude van de gebruiker

    Returns:
      Gesorteerde DataFrame met afstandskolommen
    """
    df = df.copy()

    def _dist(row: Any) -> float:
        try:
            return haversine_km(
                user_lat, user_lon,
                float(str(row["latitude"]).replace(",", ".")),
                float(str(row["longitude"]).replace(",", ".")),
            )
        except (ValueError, TypeError):
            return 9999.0

    df["afstand_km"]    = df.apply(_dist, axis=1)
    df["afstand_label"] = df["afstand_km"].apply(
        lambda x: f"{x:.0f} km" if x < 9999 else ""
    )
    return df.sort_values("afstand_km").reset_index(drop=True)


# ── HYBRIDE ZOEKFUNCTIE (Pijler 4) ────────────────────────────────────────────

def hybrid_search_df(df: pd.DataFrame, query: str) -> tuple[pd.DataFrame, bool]:
    """
    Stap 1: Exacte naam/provincie match (case-insensitive).
    Stap 2: Als geen match → retourneer origineel + use_ai=True.

    Returns:
      (gefilterde_df, use_ai)
    """
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
