"""Dependency-radar: beoordeel een Dependabot-PR en kies Kritiek, Aanbevolen of Uitstellen.

Draait in .github/workflows/ai-dependency-triage.yml. Alleen de standaardbibliotheek: geen pip install in CI.

Invoer (omgevingsvariabelen, uit dependabot/fetch-metadata en de PR):
  DEP_NAMES, DEP_FROM, DEP_TO, DEP_UPDATE_TYPE (version-update:semver-major|minor|patch), DEP_ECOSYSTEM,
  DEP_GHSA (lege tekst als het geen beveiligingsupdate is), PR_TITLE, PR_BODY, PR_URL
  GEMINI_API_KEY (optioneel: zonder sleutel een vaste regel), GEMINI_MODEL (standaard gemini-2.5-flash)

Uitvoer: JSON-bestand (argument 1) met het voorstel voor log-dependency, en category=… in $GITHUB_OUTPUT.

Spelregels (ook als het model iets anders zegt):
  - Kritiek alleen bij een beveiligingsupdate (GHSA) of een duidelijke beveiligingsfix, en nooit bij een major-versie.
    Kritiek wordt automatisch samengevoegd, en alleen na groene CI (gh pr merge --auto).
  - Een major-versie is nooit Kritiek: daar kijkt een mens naar.
"""

from __future__ import annotations

import json
import os
import re
import sys
import urllib.error
import urllib.request

CATEGORIES = ("kritiek", "aanbevolen", "uitstellen")
MODEL = os.environ.get("GEMINI_MODEL") or "gemini-2.5-flash"
API = "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
BODY_MAX = 6000

PROMPT = """Je beoordeelt een automatische pakket-update (Dependabot) voor VrijStaan, een Next.js-site met Supabase.
Kies precies één categorie:
- kritiek: beveiligingslek of ernstige fout die de live site raakt; moet zo snel mogelijk, ook zonder handwerk.
- aanbevolen: veilige, nuttige update (patch of minor, bugfixes) die een mens even nakijkt en samenvoegt.
- uitstellen: grote of riskante wijziging (major, breaking changes, nieuwe vereisten) of geen duidelijke winst.
Geef een advies van hoogstens twee korte Nederlandse zinnen: wat verandert er en waarom deze categorie.
Verzin niets: noem alleen wat in de gegevens hieronder staat.

Pakket(ten): {names}
Ecosysteem: {ecosystem}
Van {version_from} naar {version_to} ({update_type})
Beveiligingsadvies (GHSA): {ghsa}
Titel: {title}

Beschrijving van de PR (release notes, ingekort):
{body}
"""


def update_type(raw: str) -> str:
    m = re.search(r"semver-(major|minor|patch)", raw or "")
    return m.group(1) if m else "onbekend"


def rule_based(kind: str, ghsa: str, title: str, body: str) -> tuple[str, str]:
    """Vaste regel als er geen AI is (of als die faalt)."""
    security = bool(ghsa) or bool(re.search(r"\b(security|vulnerab|CVE-\d{4}-\d+|GHSA-)", f"{title}\n{body}", re.I))
    if kind == "major":
        return "uitstellen", "Major-versie: kan breaking changes bevatten. Lees de release notes en test op acceptatie."
    if security:
        return "kritiek", "Beveiligingsupdate zonder major-versie: wordt na groene CI automatisch samengevoegd."
    if kind in ("minor", "patch"):
        return "aanbevolen", f"{kind.capitalize()}-update zonder bekend beveiligingslek: nakijken en samenvoegen."
    return "uitstellen", "Soort update onbekend: eerst zelf bekijken."


def ask_gemini(key: str, prompt: str) -> tuple[str, str]:
    payload = {
        "contents": [{"role": "user", "parts": [{"text": prompt}]}],
        "generationConfig": {
            "temperature": 0,
            "maxOutputTokens": 400,
            "responseMimeType": "application/json",
            "responseSchema": {
                "type": "OBJECT",
                "properties": {
                    "category": {"type": "STRING", "enum": list(CATEGORIES)},
                    "advice": {"type": "STRING"},
                },
                "required": ["category", "advice"],
            },
        },
    }
    req = urllib.request.Request(
        API.format(model=MODEL),
        data=json.dumps(payload).encode(),
        headers={"Content-Type": "application/json", "x-goog-api-key": key},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=60) as res:
        data = json.load(res)
    text = data["candidates"][0]["content"]["parts"][0]["text"]
    out = json.loads(text)
    category = str(out.get("category", "")).lower()
    if category not in CATEGORIES:
        raise ValueError(f"onbekende categorie {category!r}")
    return category, str(out.get("advice", "")).strip()[:500]


def triage(env: dict[str, str]) -> dict:
    kind = update_type(env.get("DEP_UPDATE_TYPE", ""))
    ghsa = env.get("DEP_GHSA", "").strip()
    title = env.get("PR_TITLE", "")
    body = env.get("PR_BODY", "")[:BODY_MAX]
    names = env.get("DEP_NAMES", "").strip() or "onbekend"

    model = None
    key = env.get("GEMINI_API_KEY", "").strip()
    if key:
        prompt = PROMPT.format(
            names=names, ecosystem=env.get("DEP_ECOSYSTEM", "?"), version_from=env.get("DEP_FROM", "?"),
            version_to=env.get("DEP_TO", "?"), update_type=kind, ghsa=ghsa or "geen", title=title, body=body or "(leeg)",
        )
        try:
            category, advice = ask_gemini(key, prompt)
            model = MODEL
        except (urllib.error.URLError, KeyError, IndexError, ValueError, TimeoutError) as e:
            print(f"Gemini faalde ({e.__class__.__name__}); vaste regel gebruikt", file=sys.stderr)
            category, advice = rule_based(kind, ghsa, title, body)
            advice = f"[regel, AI faalde] {advice}"
    else:
        category, advice = rule_based(kind, ghsa, title, body)
        advice = f"[regel, geen AI] {advice}"

    # Spelregel: nooit automatisch samenvoegen bij een major-versie
    if category == "kritiek" and kind == "major":
        category = "aanbevolen"
        advice = f"{advice} (Major-versie: niet automatisch samengevoegd.)"

    return {
        "package_name": names.split(",")[0].strip()[:214],
        "version_from": env.get("DEP_FROM") or None,
        "version_to": env.get("DEP_TO") or None,
        "update_type": kind,
        "ecosystem": env.get("DEP_ECOSYSTEM") or None,
        "category": category,
        "ai_advice": advice[:600],
        "ai_model": model,
        "status": "pending_review",
        "pr_url": env.get("PR_URL") or None,
    }


def main() -> None:
    result = triage(dict(os.environ))
    with open(sys.argv[1], "w", encoding="utf-8") as f:
        json.dump(result, f, ensure_ascii=False)
    out = os.environ.get("GITHUB_OUTPUT")
    if out:
        with open(out, "a", encoding="utf-8") as f:
            f.write(f"category={result['category']}\n")
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
