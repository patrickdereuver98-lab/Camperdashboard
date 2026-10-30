"""Tests voor de pure delen van de stealth-lezer: python -m pytest tools/stealth-lezer"""

import pytest

from lezer import (
    Feed,
    GithubToken,
    HostClock,
    Pipeline,
    TooManyRequests,
    Transient,
    backoff,
    home_candidates,
    is_login_wall,
    retry_after,
    robots_disallows,
    sitemaps_from_robots,
    with_retries,
)


def test_wachttijd_per_host():
    t = [100.0]
    slept = []
    clock = HostClock(5, jitter=0, now=lambda: t[0], sleep=lambda s: (slept.append(s), t.__setitem__(0, t[0] + s)))
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


def test_spreiding_en_429_vertragen_de_host():
    t = [0.0]
    slept = []
    sleep = lambda s: (slept.append(s), t.__setitem__(0, t[0] + s))  # noqa: E731
    clock = HostClock(5, jitter=2, now=lambda: t[0], sleep=sleep, rand=lambda: 0.5)
    clock.wait("https://x.nl/a")
    clock.wait("https://x.nl/b")
    assert slept == [6]  # 5 s plus de helft van 2 s spreiding
    clock.slow_down("https://x.nl/", 60)
    clock.wait("https://x.nl/c")
    assert slept[-1] == pytest.approx(61)  # 60 s rust, plus spreiding


def test_wachttijd_groeit_exponentieel_met_een_plafond():
    assert backoff(0, base=4, rand=lambda: 1) == 4
    assert backoff(3, base=4, rand=lambda: 1) == 32
    assert backoff(3, base=4, rand=lambda: 0) == 16
    assert backoff(20, base=4, cap=600, rand=lambda: 1) == 600
    assert retry_after("30") == 30 and retry_after("Wed, 21 Oct 2026 07:28:00 GMT") is None and retry_after(None) is None


def test_nieuwe_pogingen_bij_tijdelijke_fouten():
    calls = []
    slept = []

    def flaky():
        calls.append(1)
        if len(calls) < 3:
            raise Transient("503")
        return "ok"

    clock = HostClock(0, jitter=0, sleep=lambda s: None)
    assert with_retries(flaky, "https://x.nl/", clock, sleep=slept.append) == "ok"
    assert len(calls) == 3 and len(slept) == 2

    def always_429():
        e = TooManyRequests("429")
        e.retry_after = "1"
        raise e

    with pytest.raises(TooManyRequests):
        with_retries(always_429, "https://x.nl/", clock, retries=2, sleep=slept.append)


def test_pipeline_probeert_opnieuw_bij_503(monkeypatch):
    import io
    import json
    import urllib.error

    import lezer

    tries = []

    def fake_urlopen(req, timeout):
        tries.append(1)
        if len(tries) < 3:
            raise urllib.error.HTTPError(req.full_url, 503, "Service Unavailable", {}, None)
        return io.BytesIO(json.dumps([{"id": "a"}]).encode())

    monkeypatch.setattr(lezer.urllib.request, "urlopen", fake_urlopen)
    assert Pipeline("https://pipe.test", key="k").call("stealth_batch", n=1, sleep=lambda s: None) == [{"id": "a"}]
    assert len(tries) == 3

    def forbidden(req, timeout):
        raise urllib.error.HTTPError(req.full_url, 403, "Forbidden", {}, None)

    monkeypatch.setattr(lezer.urllib.request, "urlopen", forbidden)
    with pytest.raises(urllib.error.HTTPError):
        Pipeline("https://pipe.test", key="k").call("stealth_batch", sleep=lambda s: None)


def test_wachtrij_wordt_helemaal_leeggelezen():
    class FakePipe:
        def __init__(self):
            self.batches = [[{"id": 1}, {"id": 2}], [{"id": 3}], []]

        def call(self, action, **body):
            assert action == "stealth_batch" and "shard" not in body
            return self.batches.pop(0)

    feed = Feed(FakePipe(), 2, deadline=float("inf"))
    got = []
    while (p := feed.next()) is not None:
        got.append(p["id"])
    assert got == [1, 2, 3] and feed.empty
    assert Feed(FakePipe(), 2, deadline=0, now=lambda: 1).next() is None  # na de deadline geen nieuwe plekken
