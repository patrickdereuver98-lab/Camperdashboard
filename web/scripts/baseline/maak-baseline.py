#!/usr/bin/env python3
"""Nulmigratie (baseline) uit het live schema, via introspectie (review november 2026, R5).

Leest alleen. Schrijft:
  web/supabase/migrations/<versie>_baseline.sql   het schema van public en private plus wat de app elders zet
  web/supabase/baseline/vingerafdruk.txt         één regel per object; de herbouwtest vergelijkt hiermee
  web/supabase/baseline/cron.sql                 de cron-taken (los: niet in een testdatabase laten lopen)
  web/supabase/baseline/migraties.txt            de live migratieversies op het moment van de baseline

Verbinding (een van beide):
  SUPABASE_ACCESS_TOKEN=…  (Management API, alleen-lezen eindpunt; project via SUPABASE_PROJECT_REF)
  SUPABASE_DB_URL=postgres://…  (psql)

Gebruik (vanuit de repo): python3 web/scripts/baseline/maak-baseline.py [versie]
Zonder versie: de hoogste live migratieversie (zoals `supabase migration squash` doet).
"""
import csv
import io
import json
import os
import subprocess
import sys
import urllib.error
import urllib.request
from datetime import datetime, timezone

HIER = os.path.dirname(os.path.abspath(__file__))
WEB = os.path.dirname(os.path.dirname(HIER))
SUPA = os.path.join(WEB, "supabase")
PROJECT = os.environ.get("SUPABASE_PROJECT_REF", "qkrmthrhwmmmwswmfgwc")


def vraag(sql):
    """Voert sql uit (alleen lezen) en geeft een lijst dicts terug."""
    url = os.environ.get("SUPABASE_DB_URL")
    if url:
        uit = subprocess.run(["psql", url, "-X", "-q", "--csv", "-v", "ON_ERROR_STOP=1",
                              "-c", "set default_transaction_read_only = on", "-c", sql],
                             check=True, capture_output=True, text=True).stdout
        return list(csv.DictReader(io.StringIO(uit)))
    token = os.environ.get("SUPABASE_ACCESS_TOKEN")
    if not token:
        sys.exit("Zet SUPABASE_ACCESS_TOKEN of SUPABASE_DB_URL")
    req = urllib.request.Request(
        f"https://api.supabase.com/v1/projects/{PROJECT}/database/query/read-only",
        data=json.dumps({"query": sql}).encode(), method="POST",
        headers={"Authorization": "Bearer " + token, "Content-Type": "application/json", "User-Agent": "vrijstaan-baseline"})
    try:
        return json.load(urllib.request.urlopen(req, timeout=300))
    except urllib.error.HTTPError as e:
        sys.exit(f"Management API {e.code}: {e.read().decode()[:2000]}")


def lees(naam):
    with open(os.path.join(HIER, naam)) as f:
        return f.read()


def main():
    migraties = vraag("select version, name from supabase_migrations.schema_migrations order by version")
    versie = sys.argv[1] if len(sys.argv) > 1 else migraties[-1]["version"]
    datum = datetime.now(timezone.utc).strftime("%Y-%m-%d")

    extensies = vraag("select extname, extnamespace::regnamespace::text as schema from pg_extension "
                      "where extname not in ('plpgsql', 'pg_graphql', 'supabase_vault', 'pg_stat_statements') order by extname")
    regels = vraag(lees("ddl.sql"))

    os.makedirs(os.path.join(SUPA, "baseline"), exist_ok=True)
    pad = os.path.join(SUPA, "migrations", f"{versie}_baseline.sql")
    with open(pad, "w") as f:
        f.write(f"""-- Nulmigratie (baseline) van VrijStaan: het live schema op {datum}, tot en met live migratie {versie}.
-- Gemaakt met web/scripts/baseline/maak-baseline.py uit de catalogus van de live database (introspectie, geen data).
-- Vervangt alle eerdere migraties (die staan in web/supabase/archief/migrations/ als geschiedenis); zie
-- docs/specs/05-backend-schema.md, "Herbouwen". Niet met de hand wijzigen: nieuwe wijzigingen gaan in een nieuwe
-- migratie. Draait op een nieuw Supabase-project (of de image supabase/postgres) als rol postgres.
-- Live staat deze versie als {versie} geregistreerd; op live wordt dit bestand dus nooit uitgevoerd.
-- Geen rijen, geen geheimen; cron-taken staan in web/supabase/baseline/cron.sql.

set check_function_bodies = false;
set client_min_messages = warning;

""")
        for e in extensies:
            naam = e["extname"]
            schema = e["schema"]
            if schema == "pg_catalog":
                f.write(f'create extension if not exists "{naam}";\n')
            else:
                f.write(f'create extension if not exists "{naam}" with schema {schema};\n')
        vorige = None
        kopjes = {20: "Schema's", 30: "Reeksen", 40: "Tabellen", 50: "Reeksen aan kolommen", 60: "Functies",
                  70: "Standaardwaarden", 80: "Primaire sleutels", 81: "Unieke sleutels", 82: "Checks",
                  83: "Verwijzingen", 90: "Indexen", 100: "Triggers", 110: "Rijbeveiliging", 120: "Policies",
                  130: "Rechten op tabellen", 132: "Kolomrechten", 133: "Rechten op reeksen", 135: "Rechten op functies",
                  137: "Rechten op schema's", 140: "Standaardrechten", 150: "Realtime", 160: "Opslagbuckets"}
        for r in regels:
            stap = int(r["stap"])
            if stap != vorige and stap in kopjes:
                f.write(f"\n-- {kopjes[stap]}\n")
            vorige = stap
            f.write(r["ddl"].rstrip() + "\n")
            if stap == 60:
                f.write("\n")
        f.write("\nreset check_function_bodies;\nreset client_min_messages;\n")
    print(f"{pad}: {len(regels)} statements")

    afdruk = vraag(lees("vingerafdruk.sql"))
    with open(os.path.join(SUPA, "baseline", "vingerafdruk.txt"), "w") as f:
        # sorteren op bytes (zoals LC_ALL=C sort in de herbouwtest), los van de collatie van de server
        for regel in sorted("\t".join([r["soort"], r["naam"], r["detail"] or ""]) for r in afdruk):
            f.write(regel + "\n")
    print(f"vingerafdruk: {len(afdruk)} regels")

    cron = vraag("select jobname, schedule, command, active from cron.job order by jobname")
    with open(os.path.join(SUPA, "baseline", "cron.sql"), "w") as f:
        f.write(f"-- Cron-taken van live op {datum} (zonder geheimen: de opdrachten lezen sleutels uit private.secrets).\n"
                "-- Na de nulmigratie uitvoeren op een nieuw project; niet in een testdatabase.\n")
        for c in cron:
            f.write("select cron.schedule({}, {}, {});\n".format(*(lit(c[k]) for k in ("jobname", "schedule", "command"))))
    print(f"cron: {len(cron)} taken")

    with open(os.path.join(SUPA, "baseline", "migraties.txt"), "w") as f:
        for m in migraties:
            f.write(f"{m['version']}\t{m['name']}\n")


def lit(s):
    return "'" + str(s).replace("'", "''") + "'"


if __name__ == "__main__":
    main()
