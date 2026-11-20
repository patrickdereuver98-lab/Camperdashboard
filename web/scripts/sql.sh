#!/usr/bin/env bash
# SQL op de live database via de Supabase Management API, zonder MCP-vraag (besluit Patrick 18, 22 oktober en
# 20 november 2026: altijd toegang). Nodig: SUPABASE_ACCESS_TOKEN in de omgeving.
#   web/scripts/sql.sh "select 1"          of          web/scripts/sql.sh -f bestand.sql
set -euo pipefail
q="${1:-}"
if [ "$q" = "-f" ]; then q="$(cat "$2")"; fi
[ -n "$q" ] || { echo "Gebruik: sql.sh \"<sql>\" | sql.sh -f <bestand>" >&2; exit 2; }
python3 -c 'import json,sys; print(json.dumps({"query": sys.stdin.read()}))' <<<"$q" |
  curl -sS --fail-with-body -X POST "https://api.supabase.com/v1/projects/qkrmthrhwmmmwswmfgwc/database/query" \
    -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" -H "Content-Type: application/json" --data-binary @-
echo
