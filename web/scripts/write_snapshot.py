"""Zet een MCP/SQL-export van public.export_snapshot() om naar src/data/snapshot.json.

Gebruik: python3 scripts/write_snapshot.py <bestand-met-sql-resultaat>
Het bestand mag ruwe JSON zijn ({"places": ...}) of de verpakte uitvoer van de Supabase-tool.
"""
import json
import re
import sys
from pathlib import Path

raw = Path(sys.argv[1]).read_text(encoding="utf-8")
try:
    data = json.loads(raw)
    if "result" in data:
        inner = data["result"]
        rows = json.loads(re.search(r"(\[\{.*\}\])", inner, re.S).group(1))
        snap = rows[0]["snap"]
        data = json.loads(snap) if isinstance(snap, str) else snap
except json.JSONDecodeError:
    sys.exit("Onbekend formaat")
out = Path(__file__).resolve().parents[1] / "src" / "data" / "snapshot.json"
out.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
print(f"{len(data['places'])} plekken, {len(data['towns'])} plaatsen, {len(data['faq'])} vragen → {out}")
