#!/usr/bin/env bash
# SQL-tests voor de geo_master-migraties op een lege Postgres 16 (geen Supabase nodig).
#   DATABASE_URL=postgres://… web/supabase/tests/run.sh   (bv. de service-container in CI)
#   web/supabase/tests/run.sh                              (start een tijdelijke cluster met initdb/pg_ctl)
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
migrations="$here/../migrations"

if [ -z "${DATABASE_URL:-}" ]; then
  bin="$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1)"
  tmp="$(mktemp -d)"
  # Postgres draait niet als root: dan als gebruiker postgres
  as=(); if [ "$(id -u)" = 0 ]; then chown postgres "$tmp"; as=(runuser -u postgres --); fi
  trap '"${as[@]}" "$bin/pg_ctl" -D "$tmp/data" -m immediate stop >/dev/null 2>&1 || true; rm -rf "$tmp"' EXIT
  "${as[@]}" "$bin/initdb" -D "$tmp/data" -U postgres -A trust >/dev/null
  "${as[@]}" "$bin/pg_ctl" -D "$tmp/data" -o "-p 54329 -k $tmp -c listen_addresses=''" -l "$tmp/log" -w start >/dev/null
  DATABASE_URL="postgresql://postgres@/postgres?host=$tmp&port=54329"
fi

psql "$DATABASE_URL" -q -v ON_ERROR_STOP=1 -X <<SQL
\i $here/stub_schema.sql
\i $migrations/20261030120000_geo_master.sql
\i $migrations/20261031090000_promote_geo_master.sql
\i $migrations/20261031170000_koppelen_zonder_promotie.sql
\i $migrations/20261031210000_places_lat_lng.sql
\i $here/promote_geo_master.test.sql
\i $here/stub_scraper.sql
\i $migrations/20261031180000_kernfeit_booster.sql
\i $migrations/20261031190000_concepten.sql
\i $migrations/20261031200000_servicepunten_dichtstbij.sql
\i $here/kernfeit.test.sql
SQL
