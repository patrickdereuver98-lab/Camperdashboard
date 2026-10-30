"""Archie's Campings (GPX van heel Europa, één naam per waypoint) → alleen Nederland, schone namen.

De naam van een waypoint is "Naam - Plaats [<51] (01/01-31/12) -CCA (215m) +31612345678". We houden:
  - de naam (vóór " - ") als <name>, de plaats als <desc>;
  - "hele jaar open" alleen als de periode letterlijk 01/01-31/12 is (extensie jaarrond_open=ja).
Nederland = binnen de rechthoek (50,7–53,6 NB, 3,3–7,2 OL) én een Nederlands nummer (+31) of geen nummer; een Belgisch
of Duits nummer valt af. De promotie controleert daarna nog de afstand tot een Nederlandse plaats.

Het resultaat is een bestand van een derde partij: niet in de (openbare) repository zetten (README open punt 74).

    python tools/data-collectors/filter_archies.py archies_europe.gpx tools/data-collectors/aanlevering/archies_nl.gpx
"""

from __future__ import annotations

import re
import sys
import xml.etree.ElementTree as ET
from xml.sax.saxutils import escape

NS = {"g": "http://www.topografix.com/GPX/1/1"}
NAME = re.compile(r"^(?P<naam>.+?)\s+-\s+(?P<plaats>[^\[(+]+?)\s*(?:\[|\(|\+|-CCA|$)")
PHONE = re.compile(r"\+(\d+)\s*$")
ALL_YEAR = "(01/01-31/12)"


def parse_name(raw: str) -> tuple[str, str | None, str | None, bool]:
    """(naam, plaats, telefoon, hele jaar open)"""
    raw = re.sub(r"\s+", " ", raw).strip()
    phone = PHONE.search(raw)
    m = NAME.match(raw)
    naam = (m.group("naam") if m else raw.split(" (")[0]).strip()
    plaats = m.group("plaats").strip() if m else None
    return naam, plaats, ("+" + phone.group(1)) if phone else None, ALL_YEAR in raw


def in_nl(lat: float, lon: float, phone: str | None) -> bool:
    return 50.7 <= lat <= 53.6 and 3.3 <= lon <= 7.2 and (phone is None or phone.startswith("+31"))


def main(src: str, dst: str) -> int:
    root = ET.parse(src).getroot()
    out, total, buiten = [], 0, 0
    for w in root.findall("g:wpt", NS):
        total += 1
        lat, lon = float(w.get("lat")), float(w.get("lon"))
        naam, plaats, phone, all_year = parse_name(w.findtext("g:name", "", NS))
        if not in_nl(lat, lon, phone):
            buiten += 1
            continue
        ext = "<extensions><jaarrond_open>ja</jaarrond_open></extensions>" if all_year else ""
        desc = f"<desc>{escape(plaats)}</desc>" if plaats else ""
        out.append(f'<wpt lat="{lat}" lon="{lon}"><name>{escape(naam)}</name>{desc}{ext}</wpt>')
    with open(dst, "w", encoding="utf-8") as f:
        f.write('<?xml version="1.0" encoding="UTF-8"?>\n<gpx version="1.1" creator="VrijStaan filter_archies" '
                'xmlns="http://www.topografix.com/GPX/1/1">\n' + "\n".join(out) + "\n</gpx>\n")
    print(f"{total} waypoints in Europa, {len(out)} in Nederland, {buiten} daarbuiten → {dst}")
    return 0


if __name__ == "__main__":
    sys.exit(main(*sys.argv[1:3]))
