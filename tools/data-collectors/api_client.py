"""HTTP-client voor de API's van partners (dataverzamelaars van VrijStaan).

Haalt JSON op met `requests` en probeert het opnieuw met exponential backoff (via `tenacity`) bij:
  - 429 Too Many Requests (een `Retry-After` van de server gaat voor als die langer is dan onze wachttijd);
  - 5xx-fouten van de server;
  - verbindingsfouten en time-outs.

Andere 4xx-fouten (400, 401, 403, 404, …) zijn fouten aan onze kant: die proberen we niet opnieuw.

Gebruik als module:

    from api_client import ApiClient, write_json

    client = ApiClient("https://api.partner.nl/v1", headers={"Authorization": "Bearer …"})
    data = client.get_json("plekken", params={"provincie": "GE"})
    write_json(data, "uit/partner.json")

Of vanaf de opdrachtregel:

    python api_client.py https://api.partner.nl/v1/plekken --header "Authorization: Bearer …"

Zonder `--out` komt de ruwe respons in `data/raw_api_data.json` (naast dit script); `map_api_data.py` zet die om
naar de standaardvorm. Alleen een geslaagde fetch wordt weggeschreven: bij een fout blijft het oude bestand staan.
"""

from __future__ import annotations

import argparse
import email.utils
import json
import logging
import os
import sys
import tempfile
import time
from pathlib import Path
from typing import Any, Iterator, Mapping

import requests
from tenacity import (
    RetryCallState,
    retry_if_exception,
    stop_after_attempt,
    stop_after_delay,
    wait_exponential_jitter,
    Retrying,
)

log = logging.getLogger("api_client")

DEFAULT_TIMEOUT_S = 30.0
DEFAULT_ATTEMPTS = 6
DEFAULT_MAX_WAIT_S = 120.0
USER_AGENT = "VrijStaanBot/1.0 (+https://vrijstaan.nl/bot; camperplaatsengids)"
DATA_DIR = Path(__file__).resolve().parent / "data"
DEFAULT_RAW_PATH = DATA_DIR / "raw_api_data.json"


class RetryableHTTPError(Exception):
    """429 of 5xx: de server kan het later wel. `retry_after` is de wachttijd die de server zelf noemt (seconden)."""

    def __init__(self, status: int, url: str, retry_after: float | None = None, body: str = ""):
        super().__init__(f"HTTP {status} voor {url}: {body[:200]}")
        self.status, self.url, self.retry_after = status, url, retry_after


class ApiError(Exception):
    """Fout die opnieuw proberen niet oplost (4xx behalve 429, of een antwoord dat geen JSON is)."""

    def __init__(self, message: str, status: int | None = None):
        super().__init__(message)
        self.status = status


def parse_retry_after(value: str | None, now: float | None = None) -> float | None:
    """`Retry-After` is een aantal seconden of een HTTP-datum. Geeft seconden (≥ 0) of None als het niet te lezen is."""
    if not value:
        return None
    value = value.strip()
    if value.isdigit():
        return float(value)
    try:
        when = email.utils.parsedate_to_datetime(value)
    except (TypeError, ValueError):
        return None
    if when is None:
        return None
    return max(0.0, when.timestamp() - (time.time() if now is None else now))


def is_retryable(exc: BaseException) -> bool:
    return isinstance(exc, (RetryableHTTPError, requests.ConnectionError, requests.Timeout))


class _WaitRespectingRetryAfter:
    """Exponential backoff met jitter; noemt de server een langere `Retry-After`, dan wachten we die (tot max_wait)."""

    def __init__(self, initial: float, max_wait: float):
        self.backoff = wait_exponential_jitter(multiplier=initial, max=max_wait, jitter=initial)
        self.max_wait = max_wait

    def __call__(self, state: RetryCallState) -> float:
        wait = self.backoff(state)
        exc = state.outcome.exception() if state.outcome else None
        if isinstance(exc, RetryableHTTPError) and exc.retry_after is not None:
            wait = max(wait, min(exc.retry_after, self.max_wait))
        return wait


class ApiClient:
    """Dunne laag over `requests.Session` met vaste time-out, User-Agent en retries."""

    def __init__(
        self,
        base_url: str = "",
        *,
        headers: Mapping[str, str] | None = None,
        timeout: float = DEFAULT_TIMEOUT_S,
        max_attempts: int = DEFAULT_ATTEMPTS,
        initial_wait: float = 1.0,
        max_wait: float = DEFAULT_MAX_WAIT_S,
        max_total_s: float | None = None,
        session: requests.Session | None = None,
        sleep=time.sleep,
    ):
        self.base_url = base_url.rstrip("/")
        self.timeout = timeout
        self.session = session or requests.Session()
        self.session.headers.setdefault("User-Agent", USER_AGENT)
        self.session.headers.setdefault("Accept", "application/json")
        if headers:
            self.session.headers.update(headers)
        stop = stop_after_attempt(max_attempts)
        if max_total_s is not None:
            stop = stop | stop_after_delay(max_total_s)
        self._retrying = Retrying(
            retry=retry_if_exception(is_retryable),
            wait=_WaitRespectingRetryAfter(initial_wait, max_wait),
            stop=stop,
            sleep=sleep,
            reraise=True,
            before_sleep=self._log_retry,
        )

    @staticmethod
    def _log_retry(state: RetryCallState) -> None:
        exc = state.outcome.exception() if state.outcome else None
        wait = state.next_action.sleep if state.next_action else 0
        log.warning("poging %d mislukt (%s); opnieuw over %.1f s", state.attempt_number, exc, wait)

    def url(self, path: str) -> str:
        if path.startswith(("http://", "https://")) or not self.base_url:
            return path
        return f"{self.base_url}/{path.lstrip('/')}"

    def _send_once(self, method: str, url: str, **kwargs: Any) -> Any:
        res = self.session.request(method, url, timeout=self.timeout, **kwargs)
        if res.status_code == 429 or res.status_code >= 500:
            raise RetryableHTTPError(res.status_code, url, parse_retry_after(res.headers.get("Retry-After")), res.text)
        if res.status_code >= 400:
            raise ApiError(f"HTTP {res.status_code} voor {url}: {res.text[:200]}", res.status_code)
        if res.status_code == 204 or not res.content:
            return None
        try:
            return res.json()
        except ValueError as e:
            raise ApiError(f"Geen JSON van {url} ({res.headers.get('Content-Type')}): {e}", res.status_code) from e

    def request_json(self, method: str, path: str, **kwargs: Any) -> Any:
        """Eén verzoek met retries. Geeft de JSON terug (None bij een leeg antwoord)."""
        url = self.url(path)
        return self._retrying(self._send_once, method.upper(), url, **kwargs)

    def get_json(self, path: str, params: Mapping[str, Any] | None = None, **kwargs: Any) -> Any:
        return self.request_json("GET", path, params=params, **kwargs)

    def post_json(self, path: str, payload: Any, **kwargs: Any) -> Any:
        return self.request_json("POST", path, json=payload, **kwargs)

    def iter_pages(
        self,
        path: str,
        params: Mapping[str, Any] | None = None,
        *,
        page_param: str = "page",
        start: int = 1,
        items_key: str | None = None,
        max_pages: int = 10_000,
    ) -> Iterator[Any]:
        """Pagina's ophalen tot er een lege pagina komt. `items_key` wijst de lijst aan als die in een object zit."""
        for page in range(start, start + max_pages):
            data = self.get_json(path, params={**(params or {}), page_param: page})
            items = data.get(items_key, []) if items_key and isinstance(data, dict) else data
            if not items:
                return
            yield from items if isinstance(items, list) else [items]


def write_json(data: Any, path: str | os.PathLike[str]) -> Path:
    """JSON atomair wegschrijven (eerst een tijdelijk bestand, dan hernoemen): een halve run laat nooit kapotte JSON na."""
    target = Path(path)
    target.parent.mkdir(parents=True, exist_ok=True)
    fd, tmp = tempfile.mkstemp(dir=target.parent, prefix=f".{target.name}.", suffix=".tmp")
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
            f.write("\n")
        os.replace(tmp, target)
    except BaseException:
        Path(tmp).unlink(missing_ok=True)
        raise
    return target


def _parse_header(value: str) -> tuple[str, str]:
    name, sep, val = value.partition(":")
    if not sep or not name.strip():
        raise argparse.ArgumentTypeError(f"header moet 'Naam: waarde' zijn, niet {value!r}")
    return name.strip(), val.strip()


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(description="JSON ophalen van een partner-API, met retries.")
    p.add_argument("url")
    p.add_argument("--out", default=str(DEFAULT_RAW_PATH), help=f"pad voor de ruwe JSON (standaard {DEFAULT_RAW_PATH})")
    p.add_argument("--stdout", action="store_true", help="naar stdout in plaats van een bestand")
    p.add_argument("--header", action="append", type=_parse_header, default=[], help="'Naam: waarde' (herhaalbaar)")
    p.add_argument("--param", action="append", default=[], help="naam=waarde voor de querystring (herhaalbaar)")
    p.add_argument("--attempts", type=int, default=DEFAULT_ATTEMPTS)
    p.add_argument("--timeout", type=float, default=DEFAULT_TIMEOUT_S)
    p.add_argument("--initial-wait", type=float, default=1.0, help="eerste wachttijd in seconden bij een retry")
    p.add_argument("--max-wait", type=float, default=DEFAULT_MAX_WAIT_S, help="langste wachttijd in seconden")
    args = p.parse_args(argv)

    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
    params = dict(kv.split("=", 1) for kv in args.param)
    client = ApiClient(headers=dict(args.header), timeout=args.timeout, max_attempts=args.attempts,
                       initial_wait=args.initial_wait, max_wait=args.max_wait)
    try:
        data = client.get_json(args.url, params=params or None)
    except (ApiError, RetryableHTTPError, requests.RequestException) as e:
        log.error("%s", e)
        return 1
    if not args.stdout:
        log.info("geschreven: %s", write_json(data, args.out))
    else:
        json.dump(data, sys.stdout, ensure_ascii=False, indent=2)
        sys.stdout.write("\n")
    return 0


if __name__ == "__main__":
    sys.exit(main())
