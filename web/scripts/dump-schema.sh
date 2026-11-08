#!/usr/bin/env bash
# Controledump van de live database met pg_dump (review november 2026, R5/DB-02): schema zonder data.
# De nulmigratie zelf komt uit web/scripts/baseline/maak-baseline.py (introspectie, werkt ook zonder databasewachtwoord
# via de Management API) en wordt in CI herbouwd en vergeleken (web/supabase/tests/herbouw.sh). Deze pg_dump-variant
# is een tweede blik: naast de nulmigratie leggen om verschillen te zien, niet als migratie gebruiken.
#
# Gebruik (vanuit web/):
#   SUPABASE_DB_URL=postgres://… scripts/dump-schema.sh
# Schrijft in supabase/baseline/pg_dump/ (niet vastleggen): schema.sql (structuur met rechten, geen rijen, geen eigenaren, geen geheimen),
# migraties.txt (de live migratieversies op het moment van de dump) en cron.sql (de cron-taken).
# Nodig: pg_dump en psql van dezelfde hoofdversie als de server (17) of nieuwer.
set -euo pipefail
: "${SUPABASE_DB_URL:?Zet SUPABASE_DB_URL (Supabase → Connect → Session pooler, met wachtwoord)}"
here="$(cd "$(dirname "$0")/.." && pwd)"
out="$here/supabase/baseline/pg_dump"
mkdir -p "$out"

# Schema's van de app; auth, storage, cron en net horen bij Supabase en komen met een nieuw project mee.
# Met rechten (GRANT/REVOKE): RLS en grants voor anon, authenticated en service_role horen bij de beveiliging.
pg_dump "$SUPABASE_DB_URL" --schema-only --no-owner --no-comments \
  --schema=public --schema=private --file="$out/schema.tmp"
{
  echo "-- Baseline van het live schema (public en private), gemaakt met web/scripts/dump-schema.sh op $(date -u +%Y-%m-%d)."
  echo "-- Niet met de hand wijzigen: maak een nieuwe migratie en draai het script opnieuw."
  echo
  cat "$out/schema.tmp"
} > "$out/schema.sql"
rm -f "$out/schema.tmp"

# Cron-taken (zonder geheimen: de opdrachten lezen sleutels uit internal_secrets) en migratieversies
psql "$SUPABASE_DB_URL" -X -q -t -A -F $'\t' \
  -c "select version, name from supabase_migrations.schema_migrations order by version" > "$out/migraties.txt"
psql "$SUPABASE_DB_URL" -X -q -t -A \
  -c "select format('select cron.schedule(%L, %L, %L);', jobname, schedule, command) from cron.job order by jobid" > "$out/cron.sql"

echo "Baseline geschreven: $(wc -l < "$out/schema.sql") regels schema, $(wc -l < "$out/migraties.txt") migraties, $(wc -l < "$out/cron.sql") cron-taken"
