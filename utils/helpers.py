"""
utils/helpers.py — VrijStaan v5.1 Utility Functies.

Volledig compatibel met de v5 frontend (components.py, sidebar.py, etc.).
Alle gevraagde functies aanwezig:
  - clean_val(), safe_html(), safe_float(), is_ja()
  - haversine(), add_distances()
  - hybrid_search_df()
  - apply_vehicle_filters()
  - facility_badges_html(), price_badge_html(), format_score(), truncate()
"""
from __future__ import annotations

import html as _html
import math
from typing import Any


# ── LEGE WAARDEN SET ──────────────────────────────────────────────────────────
_EMPTY = {
    "nan", "none", "", "onbekend", "unknown", "n/a",
    "null", "-", "–", "[]", "nvt", "n.v.t.", "?",
}


# ══════════════════════════════════════════════════════════════════════════════
#  CORE HELPERS
# ══════════════════════════════════════════════════════════════════════════════

def clean_val(val: Any, fallback: str = "Onbekend") -> str:
    """
    Converteert elke waarde veilig naar een bruikbare string.
    Geeft `fallback` terug bij None, NaN, lege string, "Onbekend", etc.

    Args:
        val:      De in te voeren waarde (elk type).
        fallback: Retourwaarde bij lege/ongeldige invoer.

    Returns:
        Schone string of fallback.
    """
    if val is None:
        return fallback
    s = str(val).strip()
    if s.lower() in _EMPTY:
        return fallback
    return s


def safe_html(val: Any) -> str:
    """
    Escapet HTML-gevaarlijke tekens voor veilig gebruik in f-string HTML.
    Voorkomt XSS via locatienamen of gebruikersinvoer in de database.

    Args:
        val: Waarde om te escapen.

    Returns:
        HTML-veilige string.
    """
    return _html.escape(str(val))


def safe_float(val: Any, default: float = 0.0) -> float:
    """
    Crash-proof conversie naar float.
    Accepteert komma of punt als decimaalscheidingsteken.

    Args:
        val:     Te converteren waarde.
        default: Terugvalwaarde bij fout.

    Returns:
        Float, of default bij ValueError/TypeError.
    """
    try:
        return float(str(val).replace(",", ".").strip())
    except (ValueError, TypeError, AttributeError):
        return default


def is_ja(val: Any) -> bool:
    """
    Geeft True als een veld exact 'Ja' bevat (case-insensitive).
    Gebruikt door faciliteiten-detectie en kaartmarkers.

    Args:
        val: Te controleren waarde.

    Returns:
        True als val == 'ja' (case-insensitive).
    """
    return str(val).strip().lower() == "ja"


def format_score(raw: Any) -> str:
    """
    Formatteert een beoordelingsscore voor weergave.
    Getal  → '4.2/5'
    Tekst  → retourneer tekst
    Leeg   → '' (geen output)

    Args:
        raw: Ruwe score-waarde.

    Returns:
        Geformateerde string.
    """
    val = clean_val(raw, "")
    if not val:
        return ""
    try:
        float(val.replace(",", ".").split("/")[0])
        return f"{val}/5" if "/" not in val else val
    except ValueError:
        return val


def truncate(text: str, max_chars: int = 120) -> str:
    """
    Verkort een tekst tot max_chars tekens zonder woorden te breken.
    Voegt '…' toe als de tekst gekort wordt.

    Args:
        text:      Te verkorte tekst.
        max_chars: Maximale lengte inclusief '…'.

    Returns:
        Verkorte string.
    """
    if len(text) <= max_chars:
        return text
    return text[:max_chars].rsplit(" ", 1)[0] + "…"


# ══════════════════════════════════════════════════════════════════════════════
#  GEOGRAFISCHE FUNCTIES
# ══════════════════════════════════════════════════════════════════════════════

def haversine(
    lat1: float, lon1: float,
    lat2: float, lon2: float,
) -> float:
    """
    Berekent de afstand in kilometers tussen twee GPS-coördinaten via de
    Haversine-formule (hemelsbreed, rekening houdend met de aardbol).

    Args:
        lat1, lon1: Breedtegraad en lengtegraad van punt 1 (graden).
        lat2, lon2: Breedtegraad en lengtegraad van punt 2 (graden).

    Returns:
        Afstand in kilometers (float).
    """
    R = 6_371.0  # Straal van de aarde in km
    lat1_r, lon1_r, lat2_r, lon2_r = map(math.radians, [lat1, lon1, lat2, lon2])
    dlat = lat2_r - lat1_r
    dlon = lon2_r - lon1_r
    a    = (
        math.sin(dlat / 2) ** 2
        + math.cos(lat1_r) * math.cos(lat2_r) * math.sin(dlon / 2) ** 2
    )
    return R * 2.0 * math.asin(math.sqrt(a))


def add_distances(
    df: "pd.DataFrame",  # type: ignore[name-defined]
    user_lat: float,
    user_lon: float,
) -> "pd.DataFrame":  # type: ignore[name-defined]
    """
    Voegt 'afstand_km' en 'afstand_label' kolommen toe aan een DataFrame
    op basis van de GPS-locatie van de gebruiker.
    Locaties zonder geldige coördinaten krijgen afstand 9999.0.

    Args:
        df:       DataFrame met 'latitude' en 'longitude' kolommen.
        user_lat: Breedtegraad van de gebruiker.
        user_lon: Lengtegraad van de gebruiker.

    Returns:
        DataFrame met toegevoegde afstand-kolommen, gesorteerd op afstand.
    """
    import pandas as pd  # noqa: PLC0415

    df = df.copy()
    afstanden: list[float] = []

    for _, row in df.iterrows():
        try:
            rlat = safe_float(row.get("latitude",  ""), 9999.0)
            rlon = safe_float(row.get("longitude", ""), 9999.0)
            if rlat == 9999.0 or rlon == 9999.0:
                afstanden.append(9999.0)
            else:
                afstanden.append(haversine(user_lat, user_lon, rlat, rlon))
        except Exception:
            afstanden.append(9999.0)

    df["afstand_km"]    = afstanden
    df["afstand_label"] = df["afstand_km"].apply(
        lambda x: f"{x:.1f} km" if x < 9999 else "?"
    )
    return df.sort_values("afstand_km").reset_index(drop=True)


# ══════════════════════════════════════════════════════════════════════════════
#  HYBRIDE ZOEKFUNCTIE (Pijler 4)
# ══════════════════════════════════════════════════════════════════════════════

def hybrid_search_df(
    df: "pd.DataFrame",  # type: ignore[name-defined]
    query: str,
) -> "tuple[pd.DataFrame, bool]":  # type: ignore[name-defined]
    """
    Hybride zoekfunctie voor de zoekpagina.

    Stap 1: Exacte naam-match (case-insensitive, partial).
    Stap 2: Exacte provincie-match.
    Stap 3: Geen directe match → retourneer origineel + use_ai=True
            zodat de AI-zoekintentie kan worden geactiveerd.

    Args:
        df:    Volledige locatiedataset.
        query: Zoekterm van de gebruiker.

    Returns:
        Tuple (gefilterde_df, use_ai: bool)
        use_ai=True → schakel over naar AI-intentie zoeken.
    """
    import pandas as pd  # noqa: PLC0415

    q = query.strip().lower()
    if not q:
        return df, False

    # Naam-match
    naam_mask = df["naam"].astype(str).str.lower().str.contains(q, na=False)
    if naam_mask.any():
        return df[naam_mask].copy(), False

    # Provincie-match
    prov_mask = df["provincie"].astype(str).str.lower().str.contains(q, na=False)
    if prov_mask.any():
        return df[prov_mask].copy(), False

    # Geen directe match → AI fallback
    return df, True


# ══════════════════════════════════════════════════════════════════════════════
#  VOERTUIG FILTERS (Pijler 3)
# ══════════════════════════════════════════════════════════════════════════════

def apply_vehicle_filters(
    df: "pd.DataFrame",  # type: ignore[name-defined]
    f_lange_camper:   bool = False,
    f_zwaar_voertuig: bool = False,
) -> "pd.DataFrame":  # type: ignore[name-defined]
    """
    Filtert locaties op voertuig-restricties.
    Parset max_lengte en max_gewicht kolommen uit de AI-gegenereerde tekst.

    Args:
        df:                Locatiedataset.
        f_lange_camper:    True = toon alleen locaties geschikt voor ≥8m.
        f_zwaar_voertuig:  True = toon alleen locaties geschikt voor ≥3.5t.

    Returns:
        Gefilterde DataFrame.
    """
    import re  # noqa: PLC0415

    def _parse_meters(raw: Any) -> float:
        """Extraheer eerste getal uit 'max_lengte' tekst."""
        s = clean_val(raw, "0").lower()
        if "geen" in s or "onbeperkt" in s:
            return 99.0
        m = re.search(r"(\d+(?:[.,]\d+)?)", s)
        return safe_float(m.group(1)) if m else 0.0

    def _parse_ton(raw: Any) -> float:
        """Extraheer eerste getal uit 'max_gewicht' tekst."""
        s = clean_val(raw, "0").lower().replace(",", ".")
        if "geen" in s or "onbeperkt" in s:
            return 99.0
        m = re.search(r"(\d+(?:\.\d+)?)", s)
        return safe_float(m.group(1)) if m else 0.0

    result = df.copy()

    if f_lange_camper and "max_lengte" in result.columns:
        result = result[result["max_lengte"].apply(_parse_meters) >= 8.0]

    if f_zwaar_voertuig and "max_gewicht" in result.columns:
        result = result[result["max_gewicht"].apply(_parse_ton) >= 3.5]

    return result


# ══════════════════════════════════════════════════════════════════════════════
#  HTML BADGE HELPERS (gebruikt door components.py)
# ══════════════════════════════════════════════════════════════════════════════

def facility_badges_html(row: Any) -> str:
    """
    Genereert compacte HTML badge-string voor alle aanwezige faciliteiten.
    Gebruikt door de kaartrenderer voor een scanbare faciliteiten-rij.

    Args:
        row: Pandas Series of dict met locatiedata.

    Returns:
        HTML string met aaneengesloten badges.
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
    for col, css_cls, icon, label in mapping:
        if is_ja(row.get(col, "")):
            badges.append(
                f'<span class="vs-badge {css_cls}">{icon} {label}</span>'
            )
    return "".join(badges)


def price_badge_html(prijs: Any) -> str:
    """
    HTML-badge voor prijsweergave.
    Gratis → groen | Betaald → oranje | Onbekend → grijs.

    Args:
        prijs: Ruwe prijswaarde.

    Returns:
        HTML span met correct gekleurde badge.
    """
    p = clean_val(prijs, "")
    if p.lower() == "gratis":
        return '<span class="vs-badge vs-badge-gratis">💰 Gratis</span>'
    if not p:
        return '<span class="vs-badge vs-badge-onbekend">❓ Onbekend</span>'
    return f'<span class="vs-badge vs-badge-betaald">💶 {safe_html(p)}</span>'
