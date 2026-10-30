"""Stealth-lezer van VrijStaan (bronnenbeleid §3a).

Leest websites die de gewone scraper niet of nauwelijks kon lezen, met Scrapling in stealth-modus: een echte browser
die zich als gewone bezoeker voordoet en Cloudflare-controles oplost. De lezer haalt alleen op; de pipeline (edge
function, acties stealth_*) kiest de pagina's en leest ze uit met dezelfde extractor als de gewone scraper.

Eén proces leest de hele wachtrij leeg (besluit eigenaar 30 oktober 2026): geen verdeling over losse lezers meer, maar
STEALTH_PARALLEL browsers in één proces die samen één klok per host delen. Tijdelijke fouten (time-outs, 5xx, 429)
krijgen een nieuwe poging met exponentiële wachttijd en willekeurige spreiding; pas daarna gaat de plek terug in de
wachtrij.

Grenzen die blijven (bronnenbeleid §3a): geen inlog- of betaalmuren, hoogstens één verzoek per 5 seconden per host (plus
spreiding), de subpagina's die de pipeline kiest (stealth.ts), en bij 429 langzamer in plaats van sneller.

Omgeving:
  PIPELINE_URL      https://<project>.supabase.co/functions/v1/pipeline
  PIPELINE_KEY      optioneel: internal_secrets.pipeline_key. Zonder sleutel meldt de lezer zich aan met een GitHub-
                    OIDC-token (alleen in de workflow stealth-lezer.yml op main, die id-token: write heeft)
  STEALTH_PROXIES   optioneel: proxy-adressen, gescheiden door komma's (http://user:pass@host:port)
  STEALTH_MINUTES   hoe lang één run mag duren (standaard 330; de workflow start daarna zelf de volgende)
  STEALTH_BATCH     plekken per aanvraag (standaard 5)
  STEALTH_PARALLEL  browsers tegelijk in dit proces (standaard 6); per host blijft er één verzoek per 5 seconden
  STEALTH_CHROME    optioneel: pad naar een eigen Chromium (anders die van `scrapling install`)
"""

from __future__ import annotations

import base64
import json
import os
import queue
import random
import re
import sys
import threading
import time
import urllib.error
import urllib.request
from urllib.parse import urljoin, urlsplit, urlunsplit

HOST_DELAY_S = 5.0
HOST_JITTER_S = 2.5  # willekeurige extra wachttijd per verzoek, zodat het verkeer niet als een metronoom loopt
RETRIES = 3  # nieuwe pogingen per pagina bij een tijdelijke fout
BACKOFF_S = 4.0  # eerste wachttijd na een tijdelijke fout; daarna 8, 16 … seconden
BACKOFF_MAX_S = 600.0
PAGE_TIMEOUT_MS = 45_000
PDF_MAX_BYTES = 3_000_000
ROBOTS_AGENT = "VrijStaanBot"

# Adressen die naar een inlog- of accountpagina wijzen: die lezen we niet
LOGIN_PATH = re.compile(r"/(login|inloggen|aanmelden|signin|sign-in|account|mijn-account|wp-admin|wp-login)", re.I)


class TooManyRequests(Exception):
    """429 bleef na alle pogingen: we stoppen met deze plek; de wachtrij probeert het later opnieuw."""


class Transient(Exception):
    """Tijdelijke fout (5xx, time-out, verbinding weg): nog een poging na een wachttijd."""


def backoff(attempt: int, base: float = BACKOFF_S, cap: float = BACKOFF_MAX_S, rand=random.random) -> float:
    """Exponentiële wachttijd met volledige spreiding: willekeurig tussen de helft en het geheel van base * 2^attempt."""
    top = min(cap, base * (2**attempt))
    return top / 2 + rand() * top / 2


def retry_after(value) -> float | None:
    """Retry-After in seconden (alleen de getalvorm; een datum negeren we en dan geldt onze eigen wachttijd)."""
    try:
        return max(0.0, min(BACKOFF_MAX_S, float(str(value).strip())))
    except (TypeError, ValueError):
        return None


def host_of(url: str) -> str:
    return (urlsplit(url).hostname or "").removeprefix("www.")


class HostClock:
    """Hoogstens één verzoek per HOST_DELAY_S (+ spreiding) per host (www. telt als dezelfde host), ook over threads.

    Elke aanvraag reserveert onder een slot het eerstvolgende vrije moment voor zijn host en slaapt daarna buiten het
    slot, zodat andere hosts niet hoeven te wachten. Na een 429 schuift slow_down het volgende moment op.
    """

    def __init__(self, delay: float = HOST_DELAY_S, jitter: float = HOST_JITTER_S, now=time.monotonic, sleep=time.sleep, rand=random.random):
        self.delay, self.jitter, self.now, self.sleep, self.rand = delay, jitter, now, sleep, rand
        self.last: dict[str, float] = {}
        self.lock = threading.Lock()

    def wait(self, url: str) -> None:
        host = host_of(url)
        with self.lock:
            now = self.now()
            prev = self.last.get(host)
            slot = now if prev is None else max(now, prev + self.delay + self.rand() * self.jitter)
            self.last[host] = slot
        if slot > now:
            self.sleep(slot - now)

    def slow_down(self, url: str, seconds: float) -> None:
        """De site vroeg om rustiger aan te doen: het volgende verzoek naar deze host pas over `seconds`."""
        host = host_of(url)
        with self.lock:
            self.last[host] = max(self.last.get(host, 0.0), self.now() + seconds - self.delay)


def with_retries(fn, url: str, clock: HostClock, retries: int = RETRIES, sleep=time.sleep):
    """fn() opnieuw bij Transient en bij 429 (dan wacht de hele host), met exponentiële wachttijd."""
    for attempt in range(retries + 1):
        try:
            return fn()
        except TooManyRequests as e:
            if attempt == retries:
                raise
            wait = retry_after(getattr(e, "retry_after", None)) or backoff(attempt + 1)
            clock.slow_down(url, wait)
        except Transient:
            if attempt == retries:
                raise
            sleep(backoff(attempt))
    raise AssertionError("onbereikbaar")


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


OIDC_AUDIENCE = "vrijstaan-pipeline"
OIDC_REUSE_S = 240  # tokens van GitHub zijn kort geldig; na 4 minuten een nieuw


class GithubToken:
    """OIDC-token van GitHub Actions voor de pipeline, zodat er geen geheim in GitHub hoeft te staan."""

    def __init__(self, request_url: str, request_token: str, now=time.monotonic):
        self.request_url, self.request_token, self.now = request_url, request_token, now
        self.value, self.at = "", -OIDC_REUSE_S

    def get(self) -> str:
        if not self.value or self.now() - self.at > OIDC_REUSE_S:
            sep = "&" if "?" in self.request_url else "?"
            req = urllib.request.Request(
                f"{self.request_url}{sep}audience={OIDC_AUDIENCE}",
                headers={"Authorization": f"Bearer {self.request_token}"},
            )
            with urllib.request.urlopen(req, timeout=30) as res:
                self.value, self.at = json.loads(res.read())["value"], self.now()
        return self.value


class Pipeline:
    def __init__(self, url: str, key: str | None = None, token: GithubToken | None = None):
        self.url, self.key, self.token = url, key, token

    def headers(self) -> dict[str, str]:
        h = {"Content-Type": "application/json"}
        if self.key:
            h["x-pipeline-key"] = self.key
        elif self.token:
            h["x-github-oidc"] = self.token.get()
        return h

    def call(self, action: str, retries: int = 4, sleep=time.sleep, **body):
        """Actie op de pipeline; bij een netwerkfout, 429 of 5xx tot vier keer opnieuw met exponentiële wachttijd."""
        data = json.dumps({"action": action, **body}).encode()
        for attempt in range(retries + 1):
            req = urllib.request.Request(self.url, data=data, headers=self.headers(), method="POST")
            try:
                with urllib.request.urlopen(req, timeout=120) as res:
                    return json.loads(res.read())
            except urllib.error.HTTPError as e:
                if attempt == retries or not (e.code == 429 or e.code >= 500):
                    raise
            except (urllib.error.URLError, TimeoutError, ConnectionError):
                if attempt == retries:
                    raise
            sleep(backoff(attempt, base=2.0, cap=60.0))
        raise AssertionError("onbereikbaar")


class Reader:
    """Eén browser per thread; de klok per host deelt hij met de andere threads."""

    def __init__(self, proxies: list[str], clock: HostClock):
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
        self.clock = clock

    def close(self):
        self.session.close()

    @staticmethod
    def check(status: int, url: str, headers=None) -> None:
        if status == 429:
            e = TooManyRequests(f"HTTP 429 van {urlsplit(url).hostname}")
            e.retry_after = (headers or {}).get("retry-after")
            raise e
        if status in (500, 502, 503, 504, 520, 521, 522, 524):
            raise Transient(f"HTTP {status} van {urlsplit(url).hostname}")

    def html(self, url: str) -> str | None:
        """HTML na JavaScript; None bij 404/410, een inlogmuur of een andere blijvende fout."""

        def once():
            self.clock.wait(url)
            try:
                page = self.session.fetch(url, network_idle=True)
            except Exception as e:  # noqa: BLE001 - time-out of verbinding weg: nog een poging
                raise Transient(str(e)[:200]) from e
            self.check(page.status, url, page.headers)
            return page

        page = with_retries(once, url, self.clock)
        if page.status >= 400:
            return None
        html = page.html_content or ""
        return None if not html or is_login_wall(str(page.url or url), html) else html

    def raw(self, url: str) -> tuple[int, str, bytes]:
        """Robots.txt, sitemaps en PDF's: zonder browser, met de vingerafdruk van Chrome."""
        from scrapling.fetchers import Fetcher

        kw = {"impersonate": "chrome", "stealthy_headers": True, "timeout": 20}
        if self.rotator:
            kw["proxy_rotator"] = self.rotator

        def once():
            self.clock.wait(url)
            try:
                page = Fetcher.get(url, **kw)
            except Exception as e:  # noqa: BLE001
                raise Transient(str(e)[:200]) from e
            self.check(page.status, url, page.headers)
            return page

        page = with_retries(once, url, self.clock)
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
        for sm in list(dict.fromkeys(sitemaps_from_robots(robots) + [urljoin(origin, "/sitemap.xml")]))[:3]:
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


def read_one(reader: Reader, pipe: Pipeline, place: dict) -> bool:
    """Eén plek lezen en wegschrijven; een fout wordt vastgelegd zodat de wachtrij hem later opnieuw probeert."""
    print(f"{place.get('name')} ({place.get('reason')}): {place['website']}")
    try:
        res = read_place(reader, pipe, place)
        fields = res.get("fields", [])
        print(f"  {len(fields)} velden: {', '.join(fields)}")
        return bool(fields)
    except Exception as e:  # noqa: BLE001 - fout vastleggen, door met de volgende
        print(f"  fout: {e}", file=sys.stderr)
        try:
            pipe.call("stealth_apply", id=place["id"], error=str(e)[:300])
        except Exception as e2:  # noqa: BLE001
            print(f"  fout vastleggen mislukt: {e2}", file=sys.stderr)
        return False


class Feed:
    """Haalt plekken uit de wachtrij van de pipeline voor alle threads; leeg = klaar."""

    def __init__(self, pipe: Pipeline, batch_size: int, deadline: float, now=time.monotonic):
        self.pipe, self.batch_size, self.deadline, self.now = pipe, batch_size, deadline, now
        self.buffer: queue.SimpleQueue = queue.SimpleQueue()
        self.lock = threading.Lock()
        self.empty = False

    def next(self) -> dict | None:
        # Na de deadline geen nieuwe plekken meer: de lease verloopt na een uur en de plek komt vanzelf terug
        if self.now() >= self.deadline:
            return None
        with self.lock:
            if self.buffer.empty() and not self.empty:
                batch = self.pipe.call("stealth_batch", n=self.batch_size)
                if not batch:
                    self.empty = True
                for place in batch or []:
                    self.buffer.put(place)
            return None if self.buffer.empty() else self.buffer.get()


def main() -> int:
    url, key = os.environ.get("PIPELINE_URL"), os.environ.get("PIPELINE_KEY")
    oidc_url, oidc_token = os.environ.get("ACTIONS_ID_TOKEN_REQUEST_URL"), os.environ.get("ACTIONS_ID_TOKEN_REQUEST_TOKEN")
    if not url or not (key or (oidc_url and oidc_token)):
        print("PIPELINE_URL en PIPELINE_KEY (of een GitHub-OIDC-token) zijn nodig", file=sys.stderr)
        return 2
    proxies = [p.strip() for p in os.environ.get("STEALTH_PROXIES", "").split(",") if p.strip()]
    deadline = time.monotonic() + 60 * float(os.environ.get("STEALTH_MINUTES", "330"))
    parallel = max(1, int(os.environ.get("STEALTH_PARALLEL", "6")))
    pipe = Pipeline(url, key, None if key else GithubToken(oidc_url, oidc_token))
    feed = Feed(pipe, max(1, int(os.environ.get("STEALTH_BATCH", "5"))), deadline)
    clock = HostClock()
    counts = {"done": 0, "found": 0}
    count_lock = threading.Lock()

    def work():
        reader = Reader(proxies, clock)
        try:
            while (place := feed.next()) is not None:
                ok = read_one(reader, pipe, place)
                with count_lock:
                    counts["done"] += 1
                    counts["found"] += ok
        finally:
            reader.close()

    threads = [threading.Thread(target=work, name=f"lezer-{i}") for i in range(parallel)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()
    if feed.empty:
        print("Wachtrij leeg")
    print(f"Klaar: {counts['done']} plekken gelezen, {counts['found']} met gegevens")
    write_output("meer", "false" if feed.empty else "true")
    return 0


def write_output(name: str, value: str) -> None:
    """Uitvoer voor de workflow: is er nog werk, dan start die zichzelf opnieuw (geplande runs slaat GitHub vaak over)."""
    path = os.environ.get("GITHUB_OUTPUT")
    if path:
        with open(path, "a") as f:
            f.write(f"{name}={value}\n")


if __name__ == "__main__":
    sys.exit(main())
