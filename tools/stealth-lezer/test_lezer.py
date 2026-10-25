"""Tests voor de pure delen van de stealth-lezer: python -m pytest tools/stealth-lezer"""

from lezer import HostClock, home_candidates, is_login_wall, robots_disallows, sitemaps_from_robots


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
