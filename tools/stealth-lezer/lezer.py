"""Stealth-lezer van VrijStaan (bronnenbeleid §3a).

Leest websites die de gewone scraper niet of nauwelijks kon lezen, met Scrapling in stealth-modus: een echte browser
die zich als gewone bezoeker voordoet en Cloudflare-controles oplost. De lezer haalt alleen op; de pipeline (edge
function, acties stealth_*) kiest de pagina's en leest ze uit met dezelfde extractor als de gewone scraper.

Grenzen die blijven (bronnenbeleid §3a): geen inlog- of betaalmuren, hoogstens één verzoek per 5 seconden per host,
hoogstens 7 subpagina's per site per ronde, en bij 429 langzamer in plaats van sneller.

Omgeving:
  PIPELINE_URL      https://<project>.supabase.co/functions/v1/pipeline
  PIPELINE_KEY      internal_secrets.pipeline_key
  STEALTH_PROXIES   optioneel: proxy-adressen, gescheiden door komma's (http://user:pass@host:port)
  STEALTH_MINUTES   hoe lang één run mag duren (standaard 50)
  STEALTH_BATCH     plekken per aanvraag (standaard 5)
  STEALTH_CHROME    optioneel: pad naar een eigen Chromium (anders die van `scrapling install`)
"""

from __future__ import annotations

import base64
import json
import os
import re
import sys
import time
import urllib.request
from urllib.parse import urljoin, urlsplit, urlunsplit

HOST_DELAY_S = 5.0
PAGE_TIMEOUT_MS = 45_000
PDF_MAX_BYTES = 3_000_000
ROBOTS_AGENT = "VrijStaanBot"

# Adressen die naar een inlog- of accountpagina wijzen: die lezen we niet
LOGIN_PATH = re.compile(r"/(login|inloggen|aanmelden|signin|sign-in|account|mijn-account|wp-admin|wp-login)", re.I)


class TooManyRequests(Exception):
    """429: de site vraagt ons langzamer te gaan. We stoppen met deze plek; de wachtrij probeert het later opnieuw."""


class HostClock:
    """Hoogstens één verzoek per HOST_DELAY_S seconden per host (www. telt als dezelfde host)."""

    def __init__(self, delay: float = HOST_DELAY_S, now=time.monotonic, sleep=time.sleep):
        self.delay, self.now, self.sleep = delay, now, sleep
        self.last: dict[str, float] = {}

    def wait(self, url: str) -> None:
        host = (urlsplit(url).hostname or "").removeprefix("www.")
        prev = self.last.get(host)
        if prev is not None:
            rest = self.delay - (self.now() - prev)
            if rest > 0:
                self.sleep(rest)
        self.last[host] = self.now()


def is_login_wall(url: str, html: str) -> bool:
    """Inlogpagina of pagina die alleen na inloggen inhoud toont: een wachtwoordveld en weinig andere tekst."""
    if LOGIN_PATH.search(urlsplit(url).path):
        return True
    if not re.search(r"<input[^>]+type=[\"']?password", html, re.I):
        return False
    text = re.sub(r"<script[\s\S]*?</script>|<style[\s\S]*?</style>|<[^>]+>", " ", html)
    return len(re.sub(r"\s+", " ", text)) < 2500


def home_candidates(website: str) -> list[str]:
    """Het opgegeven adres, de hoofdpagina van het domein en de variant met of zonder www (zoals pages.ts)."""
    u = urlsplit(website)
    out = [website]
    if len([p for p in u.path.split("/") if p]) == 1:
        out.append(urlunsplit((u.scheme, u.netloc, "/", "", "")))
    host = u.netloc[4:] if u.netloc.startswith("www.") else f"www.{u.netloc}"
    out.append(urlunsplit((u.scheme, host, u.path or "/", u.query, "")))
    return list(dict.fromkeys(out))


def robots_disallows(robots: str, url: str) -> bool:
    """Wil de site ons niet? We lezen toch (besluit eigenaar), maar leggen het vast in sources.stealth."""
    if not robots.strip():
        return False
    from protego import Protego

    return not Protego.parse(robots).can_fetch(url, ROBOTS_AGENT)


def sitemaps_from_robots(robots: str) -> list[str]:
    return re.findall(r"^\s*sitemap:\s*(\S+)", robots, re.I | re.M)


class Pipeline:
    def __init__(self, url: str, key: str):
        self.url, self.key = url, key

    def call(self, action: str, **body):
        req = urllib.request.Request(
            self.url,
            data=json.dumps({"action": action, **body}).encode(),
            headers={"Content-Type": "application/json", "x-pipeline-key": self.key},
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=120) as res:
            return json.loads(res.read())


class Reader:
    """Eén browser voor de hele run; verzoeken per host met wachttijd."""

    def __init__(self, proxies: list[str]):
        from scrapling.engines.toolbelt import ProxyRotator
        from scrapling.fetchers import StealthySession

        self.rotator = ProxyRotator(proxies) if proxies else None
        opts = {"headless": True, "solve_cloudflare": True, "block_webrtc": True, "timeout": PAGE_TIMEOUT_MS, "locale": "nl-NL"}
        if self.rotator:
            opts["proxy_rotator"] = self.rotator
        if os.environ.get("STEALTH_CHROME"):
            opts["executable_path"] = os.environ["STEALTH_CHROME"]
        self.session = StealthySession(**opts)
        self.session.start()
        self.clock = HostClock()

    def close(self):
        self.session.close()

    def html(self, url: str) -> str | None:
        """HTML na JavaScript; None bij 404/410, een inlogmuur of een andere fout. 429 stopt de plek."""
        self.clock.wait(url)
        page = self.session.fetch(url, network_idle=True)
        if page.status == 429:
            raise TooManyRequests(f"HTTP 429 van {urlsplit(url).hostname}")
        if page.status >= 400:
            return None
        html = page.html_content or ""
        return None if not html or is_login_wall(str(page.url or url), html) else html

    def raw(self, url: str) -> tuple[int, str, bytes]:
        """Robots.txt, sitemaps en PDF's: zonder browser, met de vingerafdruk van Chrome."""
        from scrapling.fetchers import Fetcher

        self.clock.wait(url)
        kw = {"impersonate": "chrome", "stealthy_headers": True, "timeout": 20}
        if self.rotator:
            kw["proxy_rotator"] = self.rotator
        page = Fetcher.get(url, **kw)
        if page.status == 429:
            raise TooManyRequests(f"HTTP 429 van {urlsplit(url).hostname}")
        ctype = str((page.headers or {}).get("content-type", ""))
        return page.status, ctype, page.body or b""


def text(body: bytes) -> str:
    return body.decode("utf-8", errors="replace")


def read_place(reader: Reader, pipe: Pipeline, place: dict) -> dict:
    home, html = None, None
    for cand in home_candidates(place["website"]):
        try:
            html = reader.html(cand)
        except TooManyRequests:
            raise
        except Exception as e:  # noqa: BLE001 - volgende kandidaat
            print(f"  {cand}: {e}", file=sys.stderr)
            continue
        if html:
            home = cand
            break
    if not home or not html:
        raise RuntimeError("Startpagina niet te lezen (ook niet met stealth)")

    origin = urlunsplit((*urlsplit(home)[:2], "", "", ""))
    robots = ""
    try:
        status, _, body = reader.raw(urljoin(origin, "/robots.txt"))
        robots = text(body) if status == 200 else ""
    except TooManyRequests:
        raise
    except Exception:  # noqa: BLE001 - geen robots.txt is ook goed
        pass

    plan = pipe.call("stealth_plan", home=home, html=html)
    if plan.get("wantSitemap"):
        xmls = []
        for sm in (sitemaps_from_robots(robots) + [urljoin(origin, "/sitemap.xml")])[:2]:
            try:
                status, ctype, body = reader.raw(urljoin(origin, sm))
                if status == 200 and re.search(r"xml|text/plain", ctype):
                    xmls.append(text(body))
            except TooManyRequests:
                raise
            except Exception:  # noqa: BLE001
                continue
        if xmls:
            plan = pipe.call("stealth_plan", home=home, html=html, sitemaps=xmls)

    pages, failed, seen = [html], 0, [home]

    def read_all(urls: list[str]):
        nonlocal failed
        for u in urls:
            seen.append(u)
            try:
                h = reader.html(u)
            except TooManyRequests:
                raise
            except Exception:  # noqa: BLE001 - telt als haperende pagina: apply_scrape wist dan niets
                failed += 1
                continue
            if h:
                pages.append(h)

    read_all(plan.get("picked", []))
    deeper = pipe.call("stealth_deeper", home=home, pages=pages, seen=seen)
    read_all(deeper.get("deeper", []))

    pdfs = []
    for u in deeper.get("pdfs", []):
        try:
            status, ctype, body = reader.raw(u)
            if status == 200 and "pdf" in ctype and len(body) <= PDF_MAX_BYTES:
                pdfs.append(base64.b64encode(body).decode())
        except TooManyRequests:
            raise
        except Exception:  # noqa: BLE001
            continue

    return pipe.call(
        "stealth_apply",
        id=place["id"],
        home=home,
        pages=pages,
        pdfs=pdfs,
        failed=failed,
        links=plan.get("links", 0),
        robots_disallows=robots_disallows(robots, home),
        proxy=reader.rotator is not None,
    )


def main() -> int:
    url, key = os.environ.get("PIPELINE_URL"), os.environ.get("PIPELINE_KEY")
    if not url or not key:
        print("PIPELINE_URL en PIPELINE_KEY zijn nodig", file=sys.stderr)
        return 2
    proxies = [p.strip() for p in os.environ.get("STEALTH_PROXIES", "").split(",") if p.strip()]
    deadline = time.monotonic() + 60 * float(os.environ.get("STEALTH_MINUTES", "50"))
    batch_size = int(os.environ.get("STEALTH_BATCH", "5"))
    pipe = Pipeline(url, key)
    reader = Reader(proxies)
    done = found = 0
    try:
        while time.monotonic() < deadline:
            batch = pipe.call("stealth_batch", n=batch_size)
            if not batch:
                print("Wachtrij leeg")
                break
            for place in batch:
                if time.monotonic() >= deadline:
                    break  # lease verloopt na een uur; de plek komt vanzelf terug
                print(f"{place.get('name')} ({place.get('reason')}): {place['website']}")
                try:
                    res = read_place(reader, pipe, place)
                    fields = res.get("fields", [])
                    found += bool(fields)
                    print(f"  {len(fields)} velden: {', '.join(fields)}")
                except Exception as e:  # noqa: BLE001 - fout vastleggen, door met de volgende
                    print(f"  fout: {e}", file=sys.stderr)
                    try:
                        pipe.call("stealth_apply", id=place["id"], error=str(e)[:300])
                    except Exception as e2:  # noqa: BLE001
                        print(f"  fout vastleggen mislukt: {e2}", file=sys.stderr)
                done += 1
    finally:
        reader.close()
    print(f"Klaar: {done} plekken gelezen, {found} met gegevens")
    return 0


if __name__ == "__main__":
    sys.exit(main())
