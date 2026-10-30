"""Hele dataketen in één run: bronnen ophalen en omzetten → merge_master → promote (workflow data_pipeline.yml).

1. Elke bron uit `bronnen.json` (in volgorde van voorrang) wordt een lijst in de standaardvorm:
   - type "api": ophalen met api_client.py (retries, backoff) en omzetten met map_api_data.py;
   - type "bestanden": alle KML/KMZ/GPX/CSV in de opgegeven map, via parse_statics.py.
2. Lukt één bron niet, dan stopt de run vóór het samenvoegen: merge_master hoort álle lijsten tegelijk te krijgen
   (een ontbrekende lijst laat zijn oude masters staan en verwart de vaste ids).
3. merge_master (pipeline) zet de lijsten in geo_master; promote zet wat aan de bronregels voldoet in places
   (promote_geo_master; alleen bronnen die een mens in geo_bronnen op `toegestaan` zette).

Geheimen in bronnen.json staan als ${NAAM}; de waarde komt uit de omgeving of uit SECRETS_JSON (de workflow geeft
daar `toJSON(secrets)` in). Aanmelden bij de pipeline: PIPELINE_KEY, of anders een GitHub-OIDC-token (alleen in de
workflow data_pipeline.yml op main, die id-token: write heeft).

    python tools/data-collectors/run_pipeline.py --dry-run
"""

from __future__ import annotations

import argparse
import json
import logging
import os
import re
import sys
import time
from pathlib import Path
from typing import Any, Callable

import requests

from api_client import DATA_DIR, ApiClient, write_json
from map_api_data import map_raw
from parse_statics import PARSERS, ParseResult, dedupe_ids, parse_file

log = logging.getLogger("run_pipeline")

HERE = Path(__file__).resolve().parent
DEFAULT_CONFIG = HERE / "bronnen.json"
PIPELINE_URL = "https://qkrmthrhwmmmwswmfgwc.supabase.co/functions/v1/pipeline"
OIDC_AUDIENCE = "vrijstaan-pipeline"
SECRET = re.compile(r"\$\{([A-Z0-9_]+)\}")


class ConfigError(Exception):
    pass


def resolve_secrets(value: Any, env: dict[str, str]) -> Any:
    """${NAAM} → waarde uit env; ontbreekt die, dan een fout (nooit met een lege sleutel doorgaan)."""
    if isinstance(value, str):
        def sub(m: re.Match[str]) -> str:
            if m.group(1) not in env or not env[m.group(1)]:
                raise ConfigError(f"geheim {m.group(1)} ontbreekt")
            return env[m.group(1)]
        return SECRET.sub(sub, value)
    if isinstance(value, dict):
        return {k: resolve_secrets(v, env) for k, v in value.items()}
    if isinstance(value, list):
        return [resolve_secrets(v, env) for v in value]
    return value


def load_config(path: Path) -> list[dict[str, Any]]:
    cfg = json.loads(path.read_text(encoding="utf-8"))
    bronnen = cfg.get("bronnen")
    if not isinstance(bronnen, list):
        raise ConfigError("bronnen.json: 'bronnen' moet een lijst zijn")
    seen: set[str] = set()
    for b in bronnen:
        name = b.get("bron")
        if not isinstance(name, str) or not re.fullmatch(r"[a-z0-9_]{2,40}", name):
            raise ConfigError(f"bron {name!r}: alleen a-z, 0-9 en _ (2–40 tekens), zoals in geo_bronnen")
        if name in seen:
            raise ConfigError(f"bron {name} staat er twee keer in")
        seen.add(name)
        if b.get("type") == "api" and not b.get("url"):
            raise ConfigError(f"bron {name}: type api zonder url")
        if b.get("type") == "bestanden" and not b.get("map"):
            raise ConfigError(f"bron {name}: type bestanden zonder map")
        if b.get("type") not in ("api", "bestanden"):
            raise ConfigError(f"bron {name}: type moet api of bestanden zijn")
    return bronnen


def collect_api(b: dict[str, Any], env: dict[str, str], client_factory: Callable[..., ApiClient] = ApiClient) -> ParseResult:
    client = client_factory(headers=resolve_secrets(b.get("headers", {}), env))
    params = resolve_secrets(b.get("params", {}), env)
    pages = b.get("pagineren")
    if pages:
        raw: Any = list(client.iter_pages(b["url"], params, page_param=pages.get("param", "page"),
                                          start=pages.get("start", 1), items_key=pages.get("items_key")))
    else:
        raw = client.get_json(b["url"], params=params or None)
    write_json(raw, DATA_DIR / f"raw_{b['bron']}.json")
    return map_raw(raw, b["bron"], b.get("alle_velden", False))


def collect_files(b: dict[str, Any]) -> ParseResult:
    folder = (HERE / b["map"]).resolve()
    if HERE not in folder.parents and folder != HERE:
        raise ConfigError(f"bron {b['bron']}: map moet binnen tools/data-collectors liggen")
    files = sorted(p for p in folder.glob("*") if p.suffix.lower() in PARSERS)
    if not files:
        raise ConfigError(f"bron {b['bron']}: geen bestanden in {folder}")
    total = ParseResult()
    for f in files:
        total.extend(parse_file(f, b["bron"], b.get("alle_velden", False)))
    return total


def collect_all(bronnen: list[dict[str, Any]], env: dict[str, str], **kw: Any) -> tuple[list[list[dict[str, Any]]], list[dict[str, Any]]]:
    """Alle lijsten in volgorde van voorrang, plus een verslag per bron. Eén fout = uitzondering (geen halve run)."""
    lists, report = [], []
    for b in bronnen:
        res = collect_api(b, env, **kw) if b["type"] == "api" else collect_files(b)
        records = dedupe_ids(res.records)
        if not records:
            raise ConfigError(f"bron {b['bron']}: geen enkele bruikbare plek (overgeslagen: {res.skipped})")
        lists.append(records)
        report.append({"bron": b["bron"], "plekken": len(records), "overgeslagen": res.skipped})
        log.info("%s: %d plekken, overgeslagen %s", b["bron"], len(records), res.skipped or "geen")
    return lists, report


class Pipeline:
    """Aanroepen van de edge function, met dezelfde retries als de API-client."""

    def __init__(self, url: str, env: dict[str, str], client: ApiClient | None = None):
        self.url, self.env = url, env
        self.client = client or ApiClient(timeout=150, max_attempts=4)
        self._token: tuple[str, float] | None = None

    def _oidc(self) -> str:
        if self._token and time.monotonic() - self._token[1] < 240:
            return self._token[0]
        url, bearer = self.env.get("ACTIONS_ID_TOKEN_REQUEST_URL"), self.env.get("ACTIONS_ID_TOKEN_REQUEST_TOKEN")
        if not url or not bearer:
            raise ConfigError("geen PIPELINE_KEY en geen OIDC (draai in data_pipeline.yml met id-token: write)")
        res = requests.get(f"{url}{'&' if '?' in url else '?'}audience={OIDC_AUDIENCE}",
                           headers={"Authorization": f"Bearer {bearer}"}, timeout=30)
        res.raise_for_status()
        self._token = (res.json()["value"], time.monotonic())
        return self._token[0]

    def call(self, action: str, **body: Any) -> Any:
        key = self.env.get("PIPELINE_KEY")
        headers = {"x-pipeline-key": key} if key else {"x-github-oidc": self._oidc()}
        return self.client.post_json(self.url, {"action": action, **body}, headers=headers)


def summary_markdown(report: list[dict[str, Any]], merged: Any, promoted: Any, dry_run: bool) -> str:
    rows = "\n".join(f"| {r['bron']} | {r['plekken']} | {sum(r['overgeslagen'].values())} |" for r in report)
    redenen = "\n".join(f"- {k}: {v}" for k, v in (promoted or {}).get("redenen", {}).items()) or "- geen"
    return (
        f"## Dataketen{' (proef)' if dry_run else ''}\n\n| Bron | Plekken | Overgeslagen |\n|---|---|---|\n{rows}\n\n"
        f"**merge_master**: {json.dumps(merged, ensure_ascii=False)}\n\n"
        f"**promote**: nieuw {promoted.get('nieuw')}, gekoppeld {promoted.get('gekoppeld')}, "
        f"geweigerd {promoted.get('geweigerd')}\n\nRedenen:\n{redenen}\n"
    )


def run(config: Path, dry_run: bool, env: dict[str, str], pipeline: Pipeline | None = None, **kw: Any) -> dict[str, Any]:
    bronnen = load_config(config)
    if not bronnen:
        log.warning("geen bronnen in %s: niets te doen", config)
        return {"bronnen": 0}
    lists, report = collect_all(bronnen, env, **kw)
    pipeline = pipeline or Pipeline(env.get("PIPELINE_URL", PIPELINE_URL), env)
    merged = pipeline.call("merge_master", lists=lists, dry_run=dry_run)
    log.info("merge_master: %s", merged)
    if isinstance(merged, dict) and merged.get("failed"):
        raise RuntimeError(f"merge_master: stukken mislukt {merged['failed']}; promotie overgeslagen")
    # Bij een proef staat er niets nieuws in geo_master; de promotie-proef laat zien wat er nu al door zou gaan
    promoted = pipeline.call("promote", dry_run=dry_run, n=5000)
    log.info("promote: %s", promoted)
    out = {"bronnen": report, "merge_master": merged, "promote": promoted, "dry_run": dry_run}
    if env.get("GITHUB_STEP_SUMMARY"):
        with open(env["GITHUB_STEP_SUMMARY"], "a", encoding="utf-8") as f:
            f.write(summary_markdown(report, merged, promoted, dry_run))
    return out


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description="Bronnen → merge_master → promote")
    ap.add_argument("--config", default=str(DEFAULT_CONFIG))
    ap.add_argument("--dry-run", action="store_true", help="niets schrijven in geo_master of places")
    args = ap.parse_args(argv)
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
    env = dict(os.environ)
    try:
        env = {**json.loads(env.pop("SECRETS_JSON", "") or "{}"), **env}
    except json.JSONDecodeError:
        log.error("SECRETS_JSON is geen JSON")
        return 1
    try:
        out = run(Path(args.config), args.dry_run, env)
    except (ConfigError, RuntimeError, OSError, ValueError, requests.RequestException) as e:
        log.error("%s", e)
        return 1
    print(json.dumps(out, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())
