#!/usr/bin/env bash
# Edge function `pipeline` uitrollen zoals docs/HANDLEIDING.md ("Scraper uitrollen") beschrijft: Supabase krijgt één
# regel die de code van een vastgezette commit uit GitHub importeert, en bundelt die bij het uitrollen.
#
#   web/scripts/deploy-pipeline.sh [commit]     (standaard: origin/main)
#
# Nodig: Supabase CLI (`npx supabase`) en SUPABASE_ACCESS_TOKEN (supabase.com → Account → Access tokens).
# Geheimen: de functie gebruikt alleen SUPABASE_URL en SUPABASE_SERVICE_ROLE_KEY, die Supabase zelf meegeeft, plus
# internal_secrets.pipeline_key in de database. Er hoeft niets in `supabase secrets` te staan.
# Agents zonder CLI doen hetzelfde met de MCP-tool deploy_edge_function (verify_jwt uit, bestand index.ts = de stub).
set -euo pipefail
PROJECT=qkrmthrhwmmmwswmfgwc
REPO=patrickdereuver98-lab/Camperdashboard

git fetch -q origin main acceptatie
commit="$(git rev-parse "${1:-origin/main}^{commit}")"
# Alleen code die op main of acceptatie staat (samengevoegd), nooit een losse branch
if ! git branch -r --contains "$commit" | grep -Eq 'origin/(main|acceptatie)$'; then
  echo "Commit $commit staat niet op origin/main of origin/acceptatie" >&2
  exit 1
fi
git cat-file -e "$commit:web/supabase/functions/pipeline/index.ts"

work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT
mkdir -p "$work/supabase/functions/pipeline"
cat > "$work/supabase/functions/pipeline/index.ts" <<STUB
// VrijStaan data-pipeline, uitgerold met web/scripts/deploy-pipeline.sh op $(date -u +%Y-%m-%d).
import "https://raw.githubusercontent.com/$REPO/$commit/web/supabase/functions/pipeline/index.ts";
STUB
echo "Uitrollen: pipeline @ $commit"
npx supabase functions deploy pipeline --project-ref "$PROJECT" --no-verify-jwt --workdir "$work"
echo "Klaar. Noteer de nieuwe versie in docs/specs/06-implementatieplan.md."
