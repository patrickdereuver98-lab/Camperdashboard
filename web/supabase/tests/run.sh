#!/usr/bin/env bash
# SQL-tests voor migraties op een lege Postgres 16 (geen Supabase nodig): geo_master, Mission Control, bewaking, drempel en RLS.
#   DATABASE_URL=postgres://… web/supabase/tests/run.sh   (bv. de service-container in CI)
#   web/supabase/tests/run.sh                              (start een tijdelijke cluster met initdb/pg_ctl)
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
migrations="$here/../migrations"
archief="$here/../archief/migrations"   # migraties tot en met de nulmigratie (geschiedenis, R5)

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
\i $archief/20261030102938_geo_master.sql
\i $archief/20261030162002_promote_geo_master.sql
\i $archief/20261101002100_geo_bronnen_pdok.sql
\i $archief/20261031175939_koppelen_zonder_promotie.sql
\i $archief/20261031183926_places_lat_lng.sql
\i $here/promote_geo_master.test.sql
\i $here/pdok_bron.test.sql
\i $archief/20261101002102_pdok_toegestaan.sql
\i $here/pdok_toegestaan.test.sql
\i $here/stub_scraper.sql
\i $archief/20261031175940_kernfeit_booster.sql
\i $archief/20261031175943_concepten.sql
\i $archief/20261031175944_servicepunten_dichtstbij.sql
\i $here/kernfeit.test.sql
SQL

# Mission Control (rol, admin_logs, updates_queue, dependency-radar) in een eigen database: eigen stub van auth,
# cron en pg_net, los van de geo_master-stub hierboven
psql "$DATABASE_URL" -q -X -c "drop database if exists mission_control" -c "create database mission_control"
mc_url="$(python3 -c 'import sys,urllib.parse as u;p=u.urlsplit(sys.argv[1]);print(u.urlunsplit(p._replace(path="/mission_control")))' "$DATABASE_URL")"
psql "$mc_url" -q -v ON_ERROR_STOP=1 -X <<SQL
\i $here/mission_control_stub.sql
\i $archief/20261102074903_mission_control.sql
\i $here/mission_control.test.sql
\set migration $archief/20261102082358_eigenaar_inbox.sql
\i $here/eigenaar_inbox.test.sql
\set migration $archief/20261102085642_vertrektijd_wachtrij.sql
\i $here/vertrektijd_wachtrij.test.sql
\set migration $archief/20261102105405_vertrektijd_voorstel.sql
\i $here/vertrektijd_voorstel.test.sql
\set migration $archief/20261102132558_marketing_dashboard.sql
\i $here/marketing_dashboard.test.sql
\set migration_ops $migrations/20261106200000_health_en_ops_probe.sql
\set migration_cron $migrations/20261106200100_cron_rustiger_en_opschonen.sql
\i $here/ops.test.sql
SQL

# Publicatiedrempel en leesregel van places (RLS) in een eigen database
psql "$DATABASE_URL" -q -X -c "drop database if exists drempel" -c "create database drempel"
dr_url="$(python3 -c 'import sys,urllib.parse as u;p=u.urlsplit(sys.argv[1]);print(u.urlunsplit(p._replace(path="/drempel")))' "$DATABASE_URL")"
psql "$dr_url" -q -v ON_ERROR_STOP=1 -X <<SQL
\i $here/drempel_stub.sql
\set migration $migrations/20261106200200_publicatiedrempel.sql
\i $here/drempel_rls.test.sql
SQL
