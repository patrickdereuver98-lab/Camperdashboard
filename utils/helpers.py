"""
utils/helpers.py — Gedeelde utility functies voor VrijStaan.
Geen Streamlit-afhankelijkheden: puur Python.
Fix: centraliseert alle nan/none/lege-waarde checks (was op 20+ plekken verspreid).
"""
import html as _html
from typing import Any

# Alle waarden die als "leeg" worden beschouwd
_EMPTY = {"nan", "none", "", "onbekend", "unknown", "n/a", "null", "-", "–"}


def clean_val(val: Any, fallback: str = "Onbekend") -> str:
    """
    Converteert élke waarde naar een bruikbare string.
    Geeft `fallback` terug bij lege, nan, none of onbekende waarden.
    Gebruik dit OVERAL in plaats van: str(val) in ("nan", "none", "")
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
    Fix: voorkomt XSS via locatienamen uit de database.
    """
    return _html.escape(str(val))


def format_score(raw: Any) -> str:
    """
    Formatteert een beoordelingsscore correct:
    - Getal  → '4.2/5'
    - Tekst  → 'Uitstekend' (geen /5 suffix)
    - Leeg   → '' (geen output)
    Fix: voorkomt 'Goed/5' en 'Onbekend/5' in de UI.
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


def facility_badges_html(row) -> str:
    """
    Genereert HTML badge-string voor een locatierij.
    Centrale implementatie — gebruik overal in de app.
    Fix: waterfront was vergeten in de nieuwe Camperplaatsen-pagina.
    """
    badges = []
    mapping = [
        ("stroom",             "vs-badge-stroom",   "⚡", "Stroom"),
        ("honden_toegestaan",  "vs-badge-honden",   "🐾", "Honden"),
        ("wifi",               "vs-badge-wifi",     "📶", "Wifi"),
        ("water_tanken",       "vs-badge-water",    "🚰", "Water"),
        ("waterfront",         "vs-badge-water",    "🌊", "Waterfront"),
        ("sanitair",           "vs-badge-groen",    "🚿", "Sanitair"),
    ]
    for col, cls, icon, label in mapping:
        if is_ja(row.get(col, "")):
            badges.append(f'<span class="vs-badge {cls}">{icon} {label}</span>')
    return "".join(badges)


def price_badge_html(prijs: Any) -> str:
    """HTML badge voor prijsweergave. Centraal — gebruik overal."""
    p = clean_val(prijs, "")
    if p.lower() == "gratis":
        return '<span class="vs-badge vs-badge-gratis">💰 Gratis</span>'
    elif not p:
        return '<span class="vs-badge vs-badge-onbekend">❓ Onbekend</span>'
    else:
        return f'<span class="vs-badge vs-badge-betaald">💶 {safe_html(p)}</span>'
