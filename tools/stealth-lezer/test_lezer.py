"""Tests voor de pure delen van de stealth-lezer: python -m pytest tools/stealth-lezer"""

import re
from pathlib import Path

from lezer import GithubToken, HostClock, Pipeline, home_candidates, is_login_wall, robots_disallows, sitemaps_from_robots


def test_wachttijd_per_host():
    t = [100.0]
    slept = []
    clock = HostClock(5, now=lambda: t[0], sleep=lambda s: (slept.append(s), t.__setitem__(0, t[0] + s)))
    clock.wait("https://www.camping.nl/a")
    t[0] += 1
    clock.wait("https://camping.nl/b")  # zelfde site zonder www
    assert slept == [4]
    clock.wait("https://andere.nl/")  # andere host: niet wachten
    assert slept == [4]


def test_inlogmuur():
    assert is_login_wall("https://x.nl/inloggen", "<p>hoi</p>")
    assert is_login_wall("https://x.nl/", '<form><input type="password" name="pw"></form>')
    lang = "<p>" + "Camperplaats aan het water, vertrek voor 12:00. " * 80 + "</p>"
    assert not is_login_wall("https://x.nl/", lang + '<input type="password">')
    assert not is_login_wall("https://x.nl/tarieven", "<p>€ 15 per nacht</p>")


def test_startpagina_kandidaten():
    assert home_candidates("https://www.camping.nl/camper") == [
        "https://www.camping.nl/camper",
        "https://www.camping.nl/",
        "https://camping.nl/camper",
    ]
    assert home_candidates("https://camping.nl/") == ["https://camping.nl/", "https://www.camping.nl/"]


def test_robots_wordt_vastgelegd():
    assert robots_disallows("User-agent: *\nDisallow: /", "https://x.nl/")
    assert robots_disallows("User-agent: VrijStaanBot\nDisallow: /\n\nUser-agent: *\nAllow: /", "https://x.nl/")
    assert not robots_disallows("User-agent: *\nDisallow: /wp-admin", "https://x.nl/")
    assert not robots_disallows("", "https://x.nl/")
    assert sitemaps_from_robots("Sitemap: https://x.nl/s.xml\nsitemap: /b.xml") == ["https://x.nl/s.xml", "/b.xml"]



def test_aanmelden_met_sleutel_of_github_token(monkeypatch):
    import io
    import json

    import lezer

    assert Pipeline("u", key="geheim").headers()["x-pipeline-key"] == "geheim"

    asked = []

    def fake_urlopen(req, timeout):
        asked.append((req.full_url, req.headers["Authorization"]))
        return io.BytesIO(json.dumps({"value": f"token-{len(asked)}"}).encode())

    monkeypatch.setattr(lezer.urllib.request, "urlopen", fake_urlopen)
    t = [0.0]
    tok = GithubToken("https://gh/token?api-version=2.0", "verzoek", now=lambda: t[0])
    pipe = Pipeline("u", token=tok)
    h = pipe.headers()
    assert h["x-github-oidc"] == "token-1" and "x-pipeline-key" not in h
    assert asked[0] == ("https://gh/token?api-version=2.0&audience=vrijstaan-pipeline", "Bearer verzoek")
    t[0] = 100
    assert pipe.headers()["x-github-oidc"] == "token-1"  # binnen 4 minuten hergebruikt
    t[0] = 400
    assert pipe.headers()["x-github-oidc"] == "token-2"  # daarna een nieuw token


def test_uitvoer_voor_de_workflow(tmp_path, monkeypatch):
    import lezer

    out = tmp_path / "out"
    monkeypatch.setenv("GITHUB_OUTPUT", str(out))
    lezer.write_output("meer", "true")
    assert out.read_text() == "meer=true\n"
    monkeypatch.delenv("GITHUB_OUTPUT")
    lezer.write_output("meer", "false")  # buiten GitHub: niets


def test_403_en_5xx_tellen_als_mislukt():
    """R21: alleen 404/410 is 'bestaat niet'; 403, 5xx en andere fouten zijn een haperende pagina."""
    from lezer import failed_status, gone

    assert gone(404) and gone(410) and not gone(403)
    for status in (400, 401, 403, 500, 502, 503, 520):
        assert failed_status(status), status
    for status in (200, 301, 404, 410):
        assert not failed_status(status), status


class _Page:
    def __init__(self, status, html="", url=""):
        self.status, self.html_content, self.url = status, html, url


class _Session:
    def __init__(self, pages):
        self.pages = pages

    def fetch(self, url, network_idle=True):
        return self.pages.get(url, _Page(404))


class _Pipe:
    def __init__(self, picked, deeper=(), pdfs=()):
        self.picked, self.deeper, self.pdfs = list(picked), list(deeper), list(pdfs)
        self.applied = None

    def call(self, action, **body):
        if action == "stealth_plan":
            return {"picked": self.picked, "links": 5}
        if action == "stealth_deeper":
            return {"deeper": self.deeper, "pdfs": self.pdfs}
        if action == "stealth_apply":
            self.applied = body
            return {"fields": []}
        raise AssertionError(action)


def _reader(pages, raw):
    import lezer

    r = lezer.Reader.__new__(lezer.Reader)
    r.session, r.rotator, r.clock = _Session(pages), None, HostClock(0)
    r.raw = raw
    return r


def test_haperende_paginas_en_pdfs_tellen_mee_bij_failed():
    """R21: een 403- of 503-pagina en een mislukte PDF komen in `failed`, zodat apply_scrape niets wist; 404 niet."""
    from lezer import read_place

    home = "https://camping.nl/"
    pages = {
        home: _Page(200, "<p>Welkom</p>", home),
        "https://camping.nl/huisregels": _Page(403),
        "https://camping.nl/tarieven": _Page(503),
        "https://camping.nl/oud": _Page(404),
        "https://camping.nl/faq": _Page(200, "<p>Vertrek voor 11:00</p>"),
    }

    def raw(url):
        if url.endswith("/robots.txt"):
            return 404, "text/plain", b""
        if url.endswith("kapot.pdf"):
            raise OSError("verbinding verbroken")
        if url.endswith("weg.pdf"):
            return 410, "text/html", b""
        if url.endswith("fout.pdf"):
            return 500, "text/html", b""
        return 200, "application/pdf", b"%PDF-1.4"

    pipe = _Pipe(
        ["https://camping.nl/huisregels", "https://camping.nl/tarieven", "https://camping.nl/oud", "https://camping.nl/faq"],
        pdfs=["https://camping.nl/kapot.pdf", "https://camping.nl/weg.pdf", "https://camping.nl/fout.pdf", "https://camping.nl/goed.pdf"],
    )
    read_place(_reader(pages, raw), pipe, {"id": "p1", "website": home})
    assert pipe.applied["failed"] == 4  # 403, 503, kapotte PDF, PDF met 500
    assert len(pipe.applied["pages"]) == 2  # startpagina en FAQ
    assert len(pipe.applied["pdfs"]) == 1


def test_alles_in_orde_geeft_geen_failed():
    from lezer import read_place

    home = "https://camping.nl/"
    pages = {home: _Page(200, "<p>Welkom</p>", home), "https://camping.nl/oud": _Page(410)}
    pipe = _Pipe(["https://camping.nl/oud"])
    read_place(_reader(pages, lambda url: (404, "text/plain", b"")), pipe, {"id": "p2", "website": home})
    assert pipe.applied["failed"] == 0


def _pins(requirements: str) -> dict[str, str]:
    """Exacte pins (`naam==versie`, ook met extras) uit een requirements-bestand; commentaar telt niet mee."""
    pins = {}
    for line in requirements.splitlines():
        m = re.fullmatch(r"([A-Za-z0-9._-]+)(?:\[[^\]]*\])?==(\d[\w.+!-]*)", line.split("#", 1)[0].strip())
        if m:
            pins[re.sub(r"[-_.]+", "-", m.group(1)).lower()] = m.group(2)
    return pins


def test_browserversies_liggen_vast():
    """R58: patchright zoekt de Chromium die bij zijn eigen versie hoort, maar `scrapling install` haalt die van
    playwright. Lopen ze los mee (>=), dan installeert een nieuwe playwright een andere browser en breekt elke run."""
    pins = _pins((Path(__file__).parent / "requirements.txt").read_text())
    for naam in ("playwright", "patchright"):
        assert naam in pins, f"{naam} moet exact vastgepind staan (naam==versie) in requirements.txt"
    assert pins["playwright"].split(".")[:2] == pins["patchright"].split(".")[:2], (
        f"playwright {pins['playwright']} en patchright {pins['patchright']} moeten dezelfde major.minor hebben"
    )


def test_lege_wachtrij_zegt_klaar(tmp_path, monkeypatch):
    """Lege wachtrij: browser dicht, exitcode 0 en `meer=false`, zodat de workflow zichzelf niet opnieuw start."""
    import lezer

    out = tmp_path / "out"
    for naam in ("STEALTH_PROXIES", "STEALTH_MINUTES", "STEALTH_BATCH", "STEALTH_SHARD", "STEALTH_SHARDS"):
        monkeypatch.delenv(naam, raising=False)  # onafhankelijk van de omgeving van de workflowjob
    monkeypatch.setenv("PIPELINE_URL", "https://pipeline.test/")
    monkeypatch.setenv("PIPELINE_KEY", "geheim")
    monkeypatch.setenv("GITHUB_OUTPUT", str(out))

    readers = []

    class NepReader:
        def __init__(self, proxies):
            self.proxies, self.gesloten = proxies, False
            readers.append(self)

        def close(self):
            self.gesloten = True

    def call(self, action, **body):
        assert action == "stealth_batch", action
        return []

    monkeypatch.setattr(lezer, "Reader", NepReader)
    monkeypatch.setattr(lezer.Pipeline, "call", call)

    assert lezer.main() == 0
    assert out.read_text() == "meer=false\n"
    assert len(readers) == 1 and readers[0].gesloten


def test_run_waarin_alles_faalt_is_rood():
    """R72: alles mislukt of fouten niet vast te leggen geeft exitcode 1; een paar fouten tussen goede plekken niet."""
    from lezer import exit_code

    assert exit_code(done=5, errors=5, record_failed=0) == 1
    assert exit_code(done=5, errors=2, record_failed=1) == 1
    assert exit_code(done=5, errors=2, record_failed=0) == 0
    assert exit_code(done=0, errors=0, record_failed=0) == 0
