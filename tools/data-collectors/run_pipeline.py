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

from api_client import DATA_DIR, ApiClient, ApiError, RetryableHTTPError, write_json
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


class MissingFile(ConfigError):
    """Een bestandsbron waarvan het bestand (nog) niet is aangeleverd."""


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


FILE_TYPES = {"file_csv": (".csv", ".tsv", ".txt"), "file_gpx": (".gpx",), "file_kml": (".kml", ".kmz")}
TYPES = {"api", "api_overpass", "bestanden", *FILE_TYPES}
MARKDOWN_LINK = re.compile(r"^\[([^\]]*)\]\((https?://[^)\s]+)\)$")


def clean_url(value: Any, name: str) -> str:
    """Een URL, ook als hij als markdown-link is geplakt ("[https://x](https://x)"). Alleen https."""
    url = str(value or "").strip()
    m = MARKDOWN_LINK.match(url)
    if m:
        url = m.group(2)
    if not re.fullmatch(r"https://[^\s]+", url):
        raise ConfigError(f"bron {name}: url moet met https:// beginnen, niet {url!r}")
    return url


def inside(path: str, name: str) -> Path:
    """Pad binnen tools/data-collectors (nooit daarbuiten)."""
    p = (HERE / path).resolve()
    if HERE not in p.parents:
        raise ConfigError(f"bron {name}: {path!r} moet binnen tools/data-collectors liggen")
    return p


def load_config(path: Path) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    """Actieve bronnen (in volgorde van voorrang) en de bronnen die niet actief zijn.

    Vorm: een lijst, of {"bronnen": [...]}. Per bron: bron_id (of bron), naam, type, en per type url (+ query bij
    api_overpass), pad (file_csv, file_gpx, file_kml) of map (bestanden). Alleen status "actief" (standaard) draait.
    """
    cfg = json.loads(path.read_text(encoding="utf-8"))
    bronnen = cfg.get("bronnen") if isinstance(cfg, dict) else cfg
    if not isinstance(bronnen, list):
        raise ConfigError("bronnen.json: een lijst van bronnen (of 'bronnen': [...])")
    active, inactive, seen = [], [], set()
    for raw in bronnen:
        if not isinstance(raw, dict):
            raise ConfigError("bronnen.json: elke bron is een object")
        name = raw.get("bron_id", raw.get("bron"))
        if not isinstance(name, str) or not re.fullmatch(r"[a-z0-9_]{2,40}", name):
            raise ConfigError(f"bron {name!r}: alleen a-z, 0-9 en _ (2–40 tekens), zoals in geo_bronnen")
        if name in seen:
            raise ConfigError(f"bron {name} staat er twee keer in")
        seen.add(name)
        kind = raw.get("type")
        if kind not in TYPES:
            raise ConfigError(f"bron {name}: type moet een van {sorted(TYPES)} zijn")
        b = {**raw, "bron": name}
        if kind in ("api", "api_overpass"):
            b["url"] = clean_url(raw.get("url"), name)
        if kind == "api_overpass" and not str(raw.get("query", "")).strip():
            raise ConfigError(f"bron {name}: api_overpass zonder query")
        if kind in FILE_TYPES:
            if not raw.get("pad"):
                raise ConfigError(f"bron {name}: {kind} zonder pad")
            if not str(raw["pad"]).lower().endswith(FILE_TYPES[kind]):
                raise ConfigError(f"bron {name}: {raw['pad']} past niet bij {kind}")
            inside(raw["pad"], name)
        if kind == "bestanden" and not raw.get("map"):
            raise ConfigError(f"bron {name}: type bestanden zonder map")
        (active if raw.get("status", "actief") == "actief" else inactive).append(b)
    for b in inactive:
        log.info("%s staat op %r: overgeslagen", b["bron"], b.get("status"))
    return active, inactive


# Zelfde reeks als OVERPASS in web/supabase/functions/pipeline/index.ts: overpass-api.de weigert verzoeken vanaf sommige
# cloud-adressen (406 vanaf GitHub Actions, 30 oktober 2026), dan nemen we de volgende
OVERPASS_MIRRORS = (
    "https://overpass-api.de/api/interpreter",
    "https://overpass.private.coffee/api/interpreter",
    "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
)


def fetch_overpass(b: dict[str, Any], client_factory: Callable[..., ApiClient] = ApiClient) -> Any:
    """Query als ?data= (GET, zoals index.ts), eerst op de url uit bronnen.json en dan op de mirrors. Per server de
    gewone retries (429/5xx); een 4xx (zoals 406) gaat meteen door naar de volgende."""
    client = client_factory(timeout=240, max_attempts=3, initial_wait=10, max_wait=120)
    # Geen Accept-header: overpass-api.de antwoordt op Accept: application/json met 406 (zie overpass() in index.ts)
    session = getattr(client, "session", None)
    if session is not None:
        session.headers.pop("Accept", None)
    errors = []
    for url in dict.fromkeys([b["url"], *OVERPASS_MIRRORS]):
        try:
            data = client.request_json("GET", url, params={"data": b["query"]})
        except (ApiError, RetryableHTTPError, requests.RequestException) as e:
            errors.append(f"{url.split('/')[2]}: {e}"[:200])
            log.warning("Overpass %s lukt niet, volgende: %s", url, str(e)[:120])
            continue
        if isinstance(data, dict) and isinstance(data.get("elements"), list):
            log.info("Overpass %s: %d elementen", url, len(data["elements"]))
            return data
        errors.append(f"{url.split('/')[2]}: geen elements in het antwoord")
    raise ConfigError("Overpass: geen enkele server gaf antwoord | " + " | ".join(errors))


def collect_api(b: dict[str, Any], env: dict[str, str], client_factory: Callable[..., ApiClient] = ApiClient) -> ParseResult:
    if b["type"] == "api_overpass":
        raw: Any = fetch_overpass(b, client_factory)
    else:
        client = client_factory(headers=resolve_secrets(b.get("headers", {}), env))
        params = resolve_secrets(b.get("params", {}), env)
        pages = b.get("pagineren")
        if pages:
            raw = list(client.iter_pages(b["url"], params, page_param=pages.get("param", "page"),
                                         start=pages.get("start", 1), items_key=pages.get("items_key")))
        else:
            raw = client.get_json(b["url"], params=params or None)
    write_json(raw, DATA_DIR / f"raw_{b['bron']}.json")
    return map_raw(raw, b["bron"], b.get("alle_velden", False))


def collect_files(b: dict[str, Any]) -> ParseResult:
    if b["type"] in FILE_TYPES:
        f = inside(b["pad"], b["bron"])
        if not f.is_file():
            raise MissingFile(f"bron {b['bron']}: bestand {b['pad']} ontbreekt")
        return parse_file(f, b["bron"], b.get("alle_velden", False))
    folder = inside(b["map"], b["bron"]) if b["map"] not in (".", "") else HERE
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
        try:
            res = collect_api(b, env, **kw) if b["type"] in ("api", "api_overpass") else collect_files(b)
        except MissingFile as e:
            # Nog niet aangeleverd: overslaan en melden, niet de hele run stoppen. Een bron die eerder wel data gaf en nu
            # ontbreekt, laat zijn records in geo_master staan (merge_master ruimt alleen op wat in een andere groep viel).
            log.warning("%s: wacht op bestand", e)
            report.append({"bron": b["bron"], "plekken": 0, "overgeslagen": {}, "wacht_op_bestand": b.get("pad")})
            continue
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
    rows = "\n".join(
        f"| {r['bron']} | {'wacht op bestand ' + r['wacht_op_bestand'] if r.get('wacht_op_bestand') else r['plekken']} | {sum(r['overgeslagen'].values())} |"
        for r in report
    )
    redenen = "\n".join(f"- {k}: {v}" for k, v in (promoted or {}).get("redenen", {}).items()) or "- geen"
    return (
        f"## Dataketen{' (proef)' if dry_run else ''}\n\n| Bron | Plekken | Overgeslagen |\n|---|---|---|\n{rows}\n\n"
        f"**merge_master**: {json.dumps(merged, ensure_ascii=False)}\n\n"
        f"**promote**: nieuw {promoted.get('nieuw')}, gekoppeld {promoted.get('gekoppeld')}, "
        f"geweigerd {promoted.get('geweigerd')}\n\nRedenen:\n{redenen}\n"
    )


def run(config: Path, dry_run: bool, env: dict[str, str], pipeline: Pipeline | None = None, **kw: Any) -> dict[str, Any]:
    bronnen, inactive = load_config(config)
    if not bronnen:
        log.warning("geen bronnen in %s: niets te doen", config)
        return {"bronnen": 0}
    lists, report = collect_all(bronnen, env, **kw)
    if not lists:
        log.warning("geen enkele bron leverde plekken: niets samen te voegen")
        return {"bronnen": report, "merge_master": None, "promote": None, "dry_run": dry_run}
    pipeline = pipeline or Pipeline(env.get("PIPELINE_URL", PIPELINE_URL), env)
    merged = pipeline.call("merge_master", lists=lists, dry_run=dry_run)
    log.info("merge_master: %s", {k: v for k, v in merged.items() if k != "sample"} if isinstance(merged, dict) else merged)
    if isinstance(merged, dict) and merged.get("failed"):
        raise RuntimeError(f"merge_master: stukken mislukt {merged['failed']}; promotie overgeslagen")
    # Bij een proef staat er niets nieuws in geo_master; de promotie-proef laat zien wat er nu al door zou gaan
    promoted = pipeline.call("promote", dry_run=dry_run, n=5000)
    log.info("promote: %s", promoted)
    out = {"bronnen": report, "niet_actief": [{"bron": b["bron"], "status": b.get("status")} for b in inactive],
           "merge_master": merged, "promote": promoted, "dry_run": dry_run}
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
