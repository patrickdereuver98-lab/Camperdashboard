"""Tests voor de pure delen van de stealth-lezer: python -m pytest tools/stealth-lezer"""

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
