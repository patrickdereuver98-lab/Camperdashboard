"""Tests voor de dataverzamelaars: python -m pytest tools/data-collectors"""

import json
import zipfile
import io

import pytest
import requests

from api_client import ApiClient, ApiError, RetryableHTTPError, USER_AGENT, parse_retry_after, write_json
from parse_statics import dedupe_ids, parse_csv, parse_file, parse_gpx, parse_kml, parse_value


# ── api_client ───────────────────────────────────────────────────────────────

class FakeResponse:
    def __init__(self, status, body=None, headers=None):
        self.status_code = status
        self.headers = headers or {}
        self._body = body
        self.content = b"" if body is None else json.dumps(body).encode()
        self.text = self.content.decode()

    def json(self):
        if self._body is None:
            raise ValueError("leeg")
        return self._body


class FakeSession(requests.Session):
    def __init__(self, responses):
        super().__init__()
        self.responses = list(responses)
        self.calls = []

    def request(self, method, url, **kwargs):
        self.calls.append((method, url, kwargs))
        r = self.responses.pop(0)
        if isinstance(r, Exception):
            raise r
        return r


def client(responses, **kw):
    slept = []
    s = FakeSession(responses)
    c = ApiClient("https://api.test/v1", session=s, sleep=slept.append, **kw)
    return c, s, slept


def test_429_en_5xx_opnieuw_met_backoff():
    c, s, slept = client([FakeResponse(429), FakeResponse(503), FakeResponse(200, {"ok": 1})])
    assert c.get_json("plekken") == {"ok": 1}
    assert len(s.calls) == 3
    assert s.calls[0][1] == "https://api.test/v1/plekken"
    assert len(slept) == 2 and slept[1] >= slept[0] * 0.5  # oplopend, met jitter


def test_retry_after_gaat_voor():
    c, _, slept = client([FakeResponse(429, headers={"Retry-After": "30"}), FakeResponse(200, [1])])
    assert c.get_json("x") == [1]
    assert slept[0] >= 30


def test_verbindingsfout_opnieuw():
    c, s, _ = client([requests.ConnectionError("weg"), FakeResponse(200, [])])
    assert c.get_json("x") == []
    assert len(s.calls) == 2


def test_404_niet_opnieuw():
    c, s, slept = client([FakeResponse(404, {"fout": "niet gevonden"})])
    with pytest.raises(ApiError) as e:
        c.get_json("x")
    assert e.value.status == 404 and len(s.calls) == 1 and slept == []


def test_geeft_op_na_max_pogingen():
    c, s, _ = client([FakeResponse(500)] * 3, max_attempts=3)
    with pytest.raises(RetryableHTTPError):
        c.get_json("x")
    assert len(s.calls) == 3


def test_pagineren_tot_lege_pagina():
    c, s, _ = client([FakeResponse(200, {"items": [1, 2]}), FakeResponse(200, {"items": [3]}), FakeResponse(200, {"items": []})])
    assert list(c.iter_pages("p", items_key="items")) == [1, 2, 3]
    assert [call[2]["params"]["page"] for call in s.calls] == [1, 2, 3]


def test_retry_after_als_datum():
    assert parse_retry_after("Wed, 21 Oct 2015 07:28:10 GMT", now=1445412480.0) == pytest.approx(10.0)
    assert parse_retry_after("onzin") is None
    assert parse_retry_after(None) is None


def test_write_json_atomair(tmp_path):
    out = write_json({"naam": "Ø"}, tmp_path / "sub" / "a.json")
    assert json.loads(out.read_text(encoding="utf-8")) == {"naam": "Ø"}
    assert list(out.parent.iterdir()) == [out]  # geen tijdelijk bestand achtergelaten


# ── parse_statics ────────────────────────────────────────────────────────────

def test_waarden():
    assert parse_value("Ja") is True and parse_value("nee") is False
    assert parse_value("onbekend") is None and parse_value(" ") is None
    assert parse_value("12") == 12 and parse_value("7,5") == 7.5
    assert parse_value("betaald") == "betaald"


def test_csv_puntkomma_decimale_komma_en_faciliteiten():
    data = "Naam;Breedtegraad;Lengtegraad;ID;Stroom;Honden;Kleur\nDe Hoeve;52,1;5,2;77;ja;;rood\n".encode("cp1252")
    res = parse_csv(data, "partner")
    assert res.records == [{"naam": "De Hoeve", "lat": 52.1, "lon": 5.2, "bron_id": "partner:77", "faciliteiten": {"stroom": True}}]


def test_csv_zonder_id_geeft_vast_id_en_slaat_lege_coordinaten_over():
    data = b"name,lat,lon,water\nA,52.1,5.2,yes\nB,,5.2,no\nC,0,0,\n"
    res = parse_csv(data, "x")
    assert len(res.records) == 1
    assert res.records[0]["bron_id"] == parse_csv(data, "x").records[0]["bron_id"]  # stabiel
    assert res.records[0]["faciliteiten"] == {"water": True}
    assert res.skipped == {"geen geldige coördinaten": 2}


def test_csv_naam_ontbreekt_blijft_leeg_en_alle_velden():
    res = parse_csv(b"lat,lon,prijs\n52.1,5.2,15\n", "x", keep_unknown=True)
    assert res.records[0]["naam"] is None
    assert res.records[0]["faciliteiten"] == {"prijs": 15}


def test_csv_tegenstrijdige_kolommen_weggelaten():
    res = parse_csv(b"name,lat,lon,stroom,power\nA,52.1,5.2,ja,nee\n", "x")
    assert res.records[0]["faciliteiten"] == {}


KML = b"""<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2"><Document><Folder>
  <Placemark id="pm1"><name>De Hoeve</name>
    <ExtendedData><Data name="Stroom"><value>ja</value></Data><Data name="Douche"><value>nee</value></Data></ExtendedData>
    <Point><coordinates>5.2,52.1,0</coordinates></Point></Placemark>
  <Placemark><name>Gebied</name><Polygon><outerBoundaryIs><LinearRing><coordinates>5,52 5.1,52 5.1,52.1 5,52</coordinates></LinearRing></outerBoundaryIs></Polygon></Placemark>
  <Placemark><name>Zonder id</name><ExtendedData><SchemaData><SimpleData name="water">yes</SimpleData></SchemaData></ExtendedData>
    <Point><coordinates> 4.9,52.3 </coordinates></Point></Placemark>
</Folder></Document></kml>"""


def test_kml_punten_ja_vlakken_nee():
    res = parse_kml(KML, "kaart")
    assert [r["naam"] for r in res.records] == ["De Hoeve", "Zonder id"]
    assert res.records[0] == {"naam": "De Hoeve", "lat": 52.1, "lon": 5.2, "bron_id": "kaart:pm1",
                              "faciliteiten": {"stroom": True, "douche": False}}
    assert res.records[1]["faciliteiten"] == {"water": True}
    assert res.skipped == {"geen enkel punt (vlak, lijn of meerdere punten)": 1}


def test_kmz():
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as z:
        z.writestr("doc.kml", KML)
    assert len(parse_kml(buf.getvalue(), "k").records) == 2


def test_kml_entiteiten_geweigerd():
    with pytest.raises(ValueError):
        parse_kml(b'<?xml version="1.0"?><!DOCTYPE k [<!ENTITY a "aaaa">]><kml>&a;</kml>', "k")


def test_gpx_waypoints_en_extensies_tracks_overgeslagen():
    gpx = b"""<?xml version="1.0"?>
<gpx version="1.1" creator="t" xmlns="http://www.topografix.com/GPX/1/1" xmlns:v="https://vrijstaan.nl/gpx">
  <wpt lat="52.1" lon="5.2"><name>De Hoeve</name><type>Water</type>
    <extensions><v:stroom>ja</v:stroom></extensions></wpt>
  <wpt lat="91" lon="5.2"><name>Fout</name></wpt>
  <trk><name>Route</name><trkseg><trkpt lat="52" lon="5"/></trkseg></trk>
</gpx>"""
    res = parse_gpx(gpx, "route")
    assert len(res.records) == 1
    assert res.records[0]["naam"] == "De Hoeve"
    assert res.records[0]["faciliteiten"] == {"stroom": True, "water": True}
    assert res.skipped == {"geen geldige coördinaten": 1, "track of route (geen plek)": 1}


def test_bestandstype_en_dubbele_ids(tmp_path):
    p = tmp_path / "Partner X.csv"
    p.write_bytes(b"id,name,lat,lon\n1,A,52.1,5.2\n1,B,52.2,5.3\n")
    recs = dedupe_ids(parse_file(p).records)
    assert [r["bron_id"] for r in recs] == ["partner_x:1", "partner_x:1#2"]
    with pytest.raises(ValueError):
        parse_file(tmp_path / "a.xlsx")


# ── api_client tegen een echte lokale HTTP-server ────────────────────────────

def test_retry_via_echte_socket(tmp_path):
    """429 (met Retry-After) en 503 van een echte server, daarna 200: één bestand met de respons."""
    import threading
    from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

    hits = []

    class Handler(BaseHTTPRequestHandler):
        def log_message(self, *a):
            pass

        def do_GET(self):
            hits.append(self.path)
            code = {1: 429, 2: 503}.get(len(hits), 200)
            body = json.dumps({"type": "FeatureCollection", "features": []} if code == 200 else {"fout": code}).encode()
            self.send_response(code)
            if code == 429:
                self.send_header("Retry-After", "0")
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)

    server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    try:
        from api_client import main
        out = tmp_path / "raw.json"
        assert main([f"http://127.0.0.1:{server.server_port}/plekken", "--out", str(out), "--initial-wait", "0.01", "--max-wait", "0.05"]) == 0
        assert len(hits) == 3
        assert json.loads(out.read_text())["type"] == "FeatureCollection"
    finally:
        server.shutdown()


# ── map_api_data ─────────────────────────────────────────────────────────────

from map_api_data import map_raw  # noqa: E402


def test_geojson_tekstcoordinaten_en_geneste_faciliteiten():
    raw = {"type": "FeatureCollection", "features": [
        {"type": "Feature", "id": 7, "geometry": {"type": "Point", "coordinates": ["5,12", "52.09"]},
         "properties": {"title": "De Bosrand", "voorzieningen": {"stroom": "yes"}, "amenities": ["water", "zwembad"]}},
        {"type": "Feature", "geometry": {"type": "Polygon", "coordinates": []}, "properties": {}},
        {"type": "Feature", "geometry": {"type": "Point", "coordinates": ["abc", "52"]}, "properties": {}},
    ]}
    res = map_raw(raw, "api")
    assert res.records == [{"naam": "De Bosrand", "lat": 52.09, "lon": 5.12, "bron_id": "api:7",
                            "faciliteiten": {"stroom": True, "water": True}}]
    assert res.skipped == {"geen punt (vlak, lijn of geen geometrie)": 1, "geen geldige coördinaten": 1}


def test_overpass():
    raw = {"elements": [
        {"type": "node", "id": 1, "lat": 52.1, "lon": 5.2, "tags": {"tourism": "caravan_site", "name": "A", "power_supply": "yes", "fee": "yes"}},
        {"type": "way", "id": 2, "center": {"lat": 52.2, "lon": 5.3}, "tags": {"tourism": "camp_site", "drinking_water": "no"}},
    ]}
    res = map_raw(raw, "osm")
    assert [r["bron_id"] for r in res.records] == ["osm:node/1", "osm:way/2"]
    assert res.records[0]["faciliteiten"] == {"stroom": True}
    assert res.records[1] == {"naam": None, "lat": 52.2, "lon": 5.3, "bron_id": "osm:way/2", "faciliteiten": {"water": False}}


def test_overpass_toelating_zoals_osm_ts():
    """Zelfde regel als isMotorhomePlace (besluit B2): geen tentencampings en geen motorhome=no."""
    el = lambda i, tags: {"type": "node", "id": i, "lat": 52.1, "lon": 5.2, "tags": {"name": f"P{i}", **tags}}
    raw = {"elements": [
        el(1, {"tourism": "camp_site"}),
        el(2, {"tourism": "camp_site", "motorhome": "no"}),
        el(3, {"tourism": "camp_site", "tents": "only"}),
        el(4, {"amenity": "parking", "motorhome": "yes"}),
        el(5, {"amenity": "parking"}),
        el(6, {"tourism": "camp_site", "motorhome": "Designated;fee"}),
    ]}
    res = map_raw(raw, "osm")
    assert [r["bron_id"] for r in res.records] == ["osm:node/1", "osm:node/4", "osm:node/6"]
    assert sum(res.skipped.values()) == 3


def test_gewone_records_ingepakt_en_geneste_locatie():
    raw = {"data": [
        {"id": "x1", "naam": "B", "location": {"latitude": "52.3", "longitude": "4.9"}, "faciliteiten": {"wifi": "ja"}},
        {"id": "x2", "name": "C", "lat": 52.4, "lng": 4.8, "toiletten": 1},
        {"id": "x3", "name": "D", "coordinates": "52.5,4.7"},
        "geen object",
    ]}
    res = map_raw(raw, "p")
    assert [(r["bron_id"], r["lat"], r["lon"]) for r in res.records] == [("p:x1", 52.3, 4.9), ("p:x2", 52.4, 4.8), ("p:x3", 52.5, 4.7)]
    assert res.records[0]["faciliteiten"] == {"wifi": True}
    assert res.records[1]["faciliteiten"] == {"toilet": True}
    assert res.skipped == {"geen object": 1}


def test_onbekende_vorm():
    with pytest.raises(ValueError):
        map_raw({"iets": 1}, "p")


# ── run_pipeline ─────────────────────────────────────────────────────────────

import run_pipeline as rp  # noqa: E402


def _config(tmp_path, bronnen):
    p = tmp_path / "bronnen.json"
    p.write_text(json.dumps({"bronnen": bronnen}))
    return p


class FakePipeline:
    def __init__(self, merged=None):
        self.calls = []
        self.merged = merged or {"masters": 2}

    def call(self, action, **body):
        self.calls.append((action, body))
        return self.merged if action == "merge_master" else {"nieuw": 1, "gekoppeld": 0, "geweigerd": 1, "redenen": {"geen toegestane bron": 1}}


def test_geheimen_uit_omgeving_en_nooit_leeg():
    assert rp.resolve_secrets({"Authorization": "Bearer ${TOKEN_X}"}, {"TOKEN_X": "abc"}) == {"Authorization": "Bearer abc"}
    with pytest.raises(rp.ConfigError):
        rp.resolve_secrets("Bearer ${TOKEN_X}", {})
    with pytest.raises(rp.ConfigError):
        rp.resolve_secrets("Bearer ${TOKEN_X}", {"TOKEN_X": ""})


def test_config_controle(tmp_path):
    for bad in ([{"bron": "Partner X", "type": "api", "url": "x"}], [{"bron": "px", "type": "ftp"}],
                [{"bron": "px", "type": "api"}], [{"bron": "px", "type": "api", "url": "u"}, {"bron": "px", "type": "api", "url": "u"}]):
        with pytest.raises(rp.ConfigError):
            rp.load_config(_config(tmp_path, bad))


def test_lege_config_doet_niets(tmp_path):
    fake = FakePipeline()
    assert rp.run(_config(tmp_path, []), True, {}, pipeline=fake) == {"bronnen": 0}
    assert fake.calls == []


def test_bestanden_dan_merge_dan_promote_in_volgorde(tmp_path, monkeypatch):
    folder = rp.HERE / "aanlevering_test_tmp"
    folder.mkdir()
    try:
        (folder / "a.csv").write_bytes(b"id,name,lat,lon,stroom\n1,De Hoeve,52.1,5.2,ja\n")
        summary = tmp_path / "summary.md"
        fake = FakePipeline()
        out = rp.run(_config(tmp_path, [{"bron": "partner_y", "type": "bestanden", "map": "aanlevering_test_tmp"}]), False,
                     {"GITHUB_STEP_SUMMARY": str(summary)}, pipeline=fake)
        assert [c[0] for c in fake.calls] == ["merge_master", "promote"]
        lists = fake.calls[0][1]["lists"]
        assert lists == [[{"naam": "De Hoeve", "lat": 52.1, "lon": 5.2, "bron_id": "partner_y:1", "faciliteiten": {"stroom": True}}]]
        assert fake.calls[0][1]["dry_run"] is False and fake.calls[1][1] == {"dry_run": False, "n": 5000}
        assert out["bronnen"] == [{"bron": "partner_y", "plekken": 1, "overgeslagen": {}}]
        text = summary.read_text()
        assert "geen toegestane bron: 1" in text
        # Er ging er één door: geen waarschuwing
        assert "[!WARNING]" not in text and out["waarschuwingen"] == []
    finally:
        for f in folder.iterdir():
            f.unlink()
        folder.rmdir()


def test_waarschuwingen():
    assert rp.warnings_for([{"bron": "a", "plekken": 3}, {"bron": "b", "plekken": 0, "wacht_op_bestand": "x.gpx"}],
                           {"bekeken": 4, "nieuw": 0, "gekoppeld": 0, "gekoppeld_zonder_promotie": 2}) == [
        "bron b leverde 0 plekken (wacht op bestand x.gpx)"]
    assert rp.warnings_for([], {"bekeken": 0}) == []
    assert rp.warnings_for([], {"bekeken": 3598, "nieuw": 0, "gekoppeld": 0, "geweigerd": 3598}) == [
        "alle 3598 bekeken masters zijn geweigerd door de bronregels (100%)"]
    assert "> [!WARNING]\n> x\n" in rp.summary_markdown([], {}, {"nieuw": 0}, False, ["x"])


def test_mislukte_run_schrijft_samenvatting(tmp_path, monkeypatch):
    summary = tmp_path / "s.md"
    cfg = _config(tmp_path, [{"bron": "px", "type": "api", "url": "http://niet-https"}])
    monkeypatch.setenv("GITHUB_STEP_SUMMARY", str(summary))
    assert rp.main(["--config", str(cfg)]) == 1
    assert "Dataketen mislukt" in summary.read_text() and "[!CAUTION]" in summary.read_text()


def test_een_bron_faalt_dan_geen_merge(tmp_path):
    class Broken:
        def __init__(self, **kw):
            pass

        def get_json(self, *a, **kw):
            raise RetryableHTTPError(503, "u")

    fake = FakePipeline()
    cfg = _config(tmp_path, [{"bron": "partner_x", "type": "api", "url": "https://x"}])
    with pytest.raises(RetryableHTTPError):
        rp.run(cfg, False, {}, pipeline=fake, client_factory=Broken)
    assert fake.calls == []


def test_map_buiten_de_map_geweigerd(tmp_path):
    with pytest.raises(rp.ConfigError):
        rp.collect_files({"bron": "x", "type": "bestanden", "map": "../../.."})


def test_mislukte_upsert_slaat_promotie_over(tmp_path):
    folder = rp.HERE / "aanlevering_test_tmp2"
    folder.mkdir()
    try:
        (folder / "a.csv").write_bytes(b"id,name,lat,lon\n1,A,52.1,5.2\n")
        fake = FakePipeline(merged={"failed": [{"chunk": 0, "error": "kapot"}]})
        with pytest.raises(RuntimeError):
            rp.run(_config(tmp_path, [{"bron": "partner_p", "type": "bestanden", "map": "aanlevering_test_tmp2"}]), False, {}, pipeline=fake)
        assert [c[0] for c in fake.calls] == ["merge_master"]
    finally:
        for f in folder.iterdir():
            f.unlink()
        folder.rmdir()


def test_pipeline_aanmelden_met_sleutel_of_oidc(monkeypatch):
    sent = []

    class C:
        def post_json(self, url, payload, headers):
            sent.append(headers)
            return {}

    rp.Pipeline("u", {"PIPELINE_KEY": "k"}, client=C()).call("promote")
    assert sent[-1] == {"x-pipeline-key": "k"}
    with pytest.raises(rp.ConfigError):
        rp.Pipeline("u", {}, client=C()).call("promote")

    class R:
        def raise_for_status(self):
            pass

        def json(self):
            return {"value": "tok"}

    monkeypatch.setattr(rp.requests, "get", lambda url, **kw: (sent.append(url), R())[1])
    p = rp.Pipeline("u", {"ACTIONS_ID_TOKEN_REQUEST_URL": "https://gh/token?x=1", "ACTIONS_ID_TOKEN_REQUEST_TOKEN": "b"}, client=C())
    p.call("promote")
    p.call("merge_master")
    assert sent[-1] == {"x-github-oidc": "tok"}
    assert [s for s in sent if isinstance(s, str)] == ["https://gh/token?x=1&audience=vrijstaan-pipeline"]  # één token, hergebruikt


def test_config_in_lijstvorm_met_status_en_markdown_url(tmp_path):
    cfg = tmp_path / "bronnen.json"
    cfg.write_text(json.dumps([
        {"bron_id": "osm", "naam": "OpenStreetMap", "type": "api_overpass",
         "url": "[https://overpass-api.de/api/interpreter](https://overpass-api.de/api/interpreter)",
         "query": "[out:json];node(1);out;", "betrouwbaarheid": 4, "status": "actief"},
        {"bron_id": "archies", "type": "file_csv", "pad": "data/archies.csv", "status": "wacht_op_toestemming"},
    ]))
    active, inactive = rp.load_config(cfg)
    assert [b["bron"] for b in active] == ["osm"] and active[0]["url"] == "https://overpass-api.de/api/interpreter"
    assert [b["bron"] for b in inactive] == ["archies"]
    for bad in ([{"bron_id": "x1", "type": "api_overpass", "url": "https://o.example"}],          # geen query
                [{"bron_id": "x1", "type": "file_gpx", "pad": "data/a.csv"}],                        # verkeerde extensie
                [{"bron_id": "x1", "type": "file_csv", "pad": "../../geheim.csv"}],                  # buiten de map
                [{"bron_id": "x1", "type": "api", "url": "http://onveilig.example"}]):               # geen https
        cfg.write_text(json.dumps(bad))
        with pytest.raises(rp.ConfigError):
            rp.load_config(cfg)


def test_overpass_get_met_accept_alles_en_mirror_bij_406(tmp_path, monkeypatch):
    """406 van overpass-api.de (zoals vanaf GitHub Actions op 30 oktober): door naar de volgende server."""
    monkeypatch.setattr(rp, "DATA_DIR", tmp_path)
    calls = []

    class Fake:
        def __init__(self, **kw):
            self.session = requests.Session()
            self.session.headers["Accept"] = "application/json"

        def request_json(self, method, url, **kw):
            calls.append((method, url, kw.get("params"), self.session.headers.get("Accept")))
            if "overpass-api.de" in url:
                raise ApiError("HTTP 406", 406)
            return {"elements": [{"type": "node", "id": 7, "lat": 52.1, "lon": 5.2, "tags": {"tourism": "camp_site", "name": "De Wei"}}]}

    res = rp.collect_api({"bron": "osm", "type": "api_overpass", "url": "https://overpass-api.de/api/interpreter", "query": "Q"}, {}, client_factory=Fake)
    assert [c[1].split("/")[2] for c in calls] == ["overpass-api.de", "overpass.private.coffee"]
    assert all(c[0] == "GET" and c[2] == {"data": "Q"} and c[3] == "*/*" for c in calls)
    assert res.records[0]["bron_id"] == "osm:node/7"


def test_eigen_user_agent_gaat_echt_mee():
    """requests.Session heeft al "python-requests/…": setdefault liet die staan, en Overpass weigerde hem (31 oktober)."""
    c = ApiClient()
    assert c.session.headers["User-Agent"] == USER_AGENT
    assert c.session.headers["Accept"] == "application/json"
    assert ApiClient(headers={"User-Agent": "Partner/2"}).session.headers["User-Agent"] == "Partner/2"


def test_overpass_alle_servers_weg_is_een_fout(tmp_path):
    class Down:
        def __init__(self, **kw):
            pass

        def request_json(self, *a, **kw):
            raise RetryableHTTPError(504, "u")

    with pytest.raises(rp.ConfigError):
        rp.fetch_overpass({"url": "https://overpass-api.de/api/interpreter", "query": "Q"}, client_factory=Down)


def test_ontbrekend_bestand_wacht_en_stopt_de_rest_niet(tmp_path, monkeypatch):
    with pytest.raises(rp.MissingFile):
        rp.collect_files({"bron": "svr", "type": "file_gpx", "pad": "data/bestaat_niet.gpx"})
    monkeypatch.setattr(rp, "DATA_DIR", tmp_path)

    class Fake:
        def __init__(self, **kw):
            self.session = requests.Session()

        def request_json(self, *a, **kw):
            return {"elements": [{"type": "node", "id": 1, "lat": 52.1, "lon": 5.2, "tags": {"tourism": "camp_site", "name": "De Wei"}}]}

    fake = FakePipeline()
    cfg = _config(tmp_path, [
        {"bron_id": "osm", "type": "api_overpass", "url": "https://o.example/api", "query": "Q"},
        {"bron_id": "svr", "type": "file_gpx", "pad": "data/bestaat_niet.gpx"},
    ])
    out = rp.run(cfg, True, {}, pipeline=fake, client_factory=Fake)
    assert [len(x) for x in fake.calls[0][1]["lists"]] == [1]
    assert out["bronnen"][1] == {"bron": "svr", "plekken": 0, "overgeslagen": {}, "wacht_op_bestand": "data/bestaat_niet.gpx"}


def test_alleen_ontbrekende_bestanden_dan_geen_aanroep(tmp_path):
    fake = FakePipeline()
    cfg = _config(tmp_path, [{"bron_id": "svr", "type": "file_gpx", "pad": "data/bestaat_niet.gpx"}])
    assert rp.run(cfg, False, {}, pipeline=fake)["merge_master"] is None
    assert fake.calls == []


# ── filter_archies ───────────────────────────────────────────────────────────

from filter_archies import in_nl, parse_name  # noqa: E402


def test_archies_naam_plaats_telefoon_en_hele_jaar():
    assert parse_name("Natuurlijk Limburg - Remersdaal (01/01-31/12) -CCA (261m) +3243810176") == (
        "Natuurlijk Limburg", "Remersdaal", "+3243810176", True)
    assert parse_name("Huguet - Sant Julia de Loria [<51] (01/04-31/10)  (890m) +376843718") == (
        "Huguet", "Sant Julia de Loria", "+376843718", False)
    assert parse_name("Alleen een naam")[0] == "Alleen een naam"


def test_archies_nederland_op_rechthoek_en_landcode():
    assert in_nl(52.1, 5.2, "+31301234567")
    assert in_nl(52.1, 5.2, None)
    assert not in_nl(50.76, 4.62, "+3216474286")  # binnen de rechthoek, maar België
    assert not in_nl(42.5, 1.5, "+376843718")
