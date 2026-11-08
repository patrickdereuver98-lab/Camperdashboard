#!/usr/bin/env bash
# Herbouwtest (review november 2026, R5): bouwt de database op een schone Supabase-Postgres op uit
# web/supabase/migrations/ (nulmigratie plus alles daarna), vergelijkt het schema na de nulmigratie met de
# vingerafdruk van live en draait daarna de SQL-tests in tests/herbouw/ op het volledige schema.
#
#   web/supabase/tests/herbouw.sh                    start zelf een container supabase/postgres (Docker nodig)
#   DATABASE_URL=postgres://postgres:…@host/postgres \
#   ADMIN_URL=postgres://supabase_admin:…@host/postgres web/supabase/tests/herbouw.sh   (bv. de service-container in CI)
#
# ADMIN_URL is nodig voor de stub van auth en storage (die tabellen zijn van supabase_admin); zonder ADMIN_URL wordt
# de gebruiker in DATABASE_URL vervangen door supabase_admin.
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
supa="$here/.."
image="${SUPABASE_POSTGRES_IMAGE:-supabase/postgres:17.6.1.054}"

if [ -z "${DATABASE_URL:-}" ]; then
  command -v docker >/dev/null || { echo "Geen DATABASE_URL en geen Docker: kan geen schone database starten" >&2; exit 2; }
  naam="vrijstaan-herbouw-$$"
  poort="${HERBOUW_POORT:-54331}"
  docker run -d --rm --name "$naam" -e POSTGRES_PASSWORD=postgres -p "$poort:5432" "$image" >/dev/null
  trap 'docker rm -f "$naam" >/dev/null 2>&1 || true' EXIT
  DATABASE_URL="postgresql://postgres:postgres@localhost:$poort/postgres"
fi
ADMIN_URL="${ADMIN_URL:-$(python3 -c 'import sys,urllib.parse as u;p=u.urlsplit(sys.argv[1]);h=p.netloc.split("@")[-1];pw=(p.password or "postgres");print(u.urlunsplit(p._replace(netloc=f"supabase_admin:{pw}@{h}")))' "$DATABASE_URL")}"

# Wachten tot de database klaar is (de image draait bij de eerste start eigen init-scripts)
for _ in $(seq 1 60); do
  if psql "$DATABASE_URL" -X -q -t -c "select 1 from pg_roles where rolname = 'authenticated'" 2>/dev/null | grep -q 1; then break; fi
  sleep 2
done

psql_run() { psql "$1" -X -q -v ON_ERROR_STOP=1 "${@:2}"; }

echo "Stub van auth en storage aanvullen"
psql_run "$ADMIN_URL" -f "$here/herbouw/platform.sql"

baseline="$(ls "$supa"/migrations/*_baseline.sql | sort | tail -1)"
[ -n "$baseline" ] || { echo "Geen nulmigratie (*_baseline.sql) in web/supabase/migrations" >&2; exit 1; }
tel=0
for f in $(ls "$supa"/migrations/*.sql | sort); do
  if [[ "$(basename "$f")" < "$(basename "$baseline")" ]]; then
    echo "FOUT: $(basename "$f") staat vóór de nulmigratie en zou nooit draaien; verplaats of hernummer" >&2; exit 1
  fi
  if ! uit="$(psql_run "$DATABASE_URL" -f "$f" 2>&1)"; then
    echo "FOUT bij migratie $(basename "$f"):" >&2; echo "$uit" >&2; exit 1
  fi
  tel=$((tel + 1))
  if [ "$f" = "$baseline" ]; then
    # Het schema na de nulmigratie moet gelijk zijn aan live op het moment van de baseline
    tmp="$(mktemp)"
    psql "$DATABASE_URL" -X -q -t -A -F $'\t' -v ON_ERROR_STOP=1 -f "$supa/../scripts/baseline/vingerafdruk.sql" \
      | grep -v '^SET$' | sed '/^$/d' | LC_ALL=C sort > "$tmp"
    if ! diff -u "$supa/baseline/vingerafdruk.txt" "$tmp" > "$tmp.diff"; then
      echo "FOUT: schema na de nulmigratie wijkt af van live (- live, + herbouw):" >&2
      grep -E '^[-+][^-+]' "$tmp.diff" | head -60 >&2
      echo "($(grep -cE '^[-+][^-+]' "$tmp.diff") verschillen)" >&2
      exit 1
    fi
    echo "Nulmigratie $(basename "$baseline"): schema gelijk aan live ($(wc -l < "$tmp") objecten)"
    rm -f "$tmp" "$tmp.diff"
  fi
done
echo "$tel migraties toegepast"

# Startgegevens (instellingen, regio's, FAQ, woonplaatsen) moeten op het herbouwde schema passen
if ! uit="$(psql_run "$DATABASE_URL" -f "$supa/seed.sql" 2>&1)"; then
  echo "FOUT in seed.sql:" >&2; echo "$uit" >&2; exit 1
fi
echo "seed.sql toegepast"

for t in $(ls "$here"/herbouw/*.test.sql 2>/dev/null | sort); do
  if ! uit="$(psql_run "$DATABASE_URL" -f "$t" 2>&1)"; then
    echo "FOUT in test $(basename "$t"):" >&2; echo "$uit" >&2; exit 1
  fi
  echo "$uit" | grep -E 'geslaagd|ok' | sed 's/^ *//' || true
done
echo "Herbouwtest geslaagd"
