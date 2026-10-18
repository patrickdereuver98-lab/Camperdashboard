// MCP-server vrijstaan-bronnen (dataplan W0.6): adressen, robots.txt en pagina naar tekst.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  cleanSearch, filterLines, htmlToText, parseRobots, publicUrl, robotsAllows, robotsBlocksAll, safeEqual,
} from "../supabase/functions/bronnen-mcp/lib.ts";

test("publicUrl: alleen openbare http(s)-hostnamen", () => {
  assert.equal(publicUrl("https://www.camperplaats-assen.nl/tarieven")?.hostname, "www.camperplaats-assen.nl");
  for (const bad of [
    "ftp://example.nl/", "http://localhost:3000/", "http://127.0.0.1/", "http://[::1]/", "http://10.0.0.5/x",
    "http://169.254.169.254/latest/meta-data", "https://intranet/", "https://db.internal/", "https://abc.supabase.co/rest/v1",
    "https://user:pw@example.nl/", "https://example.nl:8443/", "geen adres",
  ]) assert.equal(publicUrl(bad), null, bad);
});

test("robots.txt: eigen groep gaat voor, langste regel wint, Allow wint bij gelijke lengte", () => {
  const txt = [
    "User-agent: *", "Disallow: /zoeken", "Disallow: /*?sort=", "Allow: /zoeken/camperplaatsen",
    "", "User-agent: GPTBot", "User-agent: CCBot", "Disallow: /",
  ].join("\n");
  const rules = parseRobots(txt);
  assert.equal(robotsAllows(rules, "/camperplaats/assen"), true);
  assert.equal(robotsAllows(rules, "/zoeken?q=drenthe"), false);
  assert.equal(robotsAllows(rules, "/zoeken/camperplaatsen/drenthe"), true);
  assert.equal(robotsAllows(rules, "/lijst?sort=prijs"), false);
  assert.equal(robotsBlocksAll(rules), false);

  const own = parseRobots("User-agent: *\nDisallow:\n\nUser-agent: VrijStaanBot\nDisallow: /\n");
  assert.equal(robotsBlocksAll(own), true);
  assert.equal(robotsAllows(own, "/"), false);

  const end = parseRobots("User-agent: *\nDisallow: /*.pdf$\n");
  assert.equal(robotsAllows(end, "/tarieven.pdf"), false);
  assert.equal(robotsAllows(end, "/tarieven.pdf.html"), true);
  assert.deepEqual(parseRobots(""), []);
});

test("htmlToText: blokken op eigen regels, tabelcellen, geen scripts, entiteiten", () => {
  const html = `<html><head><title>x</title><style>p{}</style></head><body>
    <nav><a href="/">Home</a></nav><script>var a = "vertrek 11:00";</script>
    <h2>Tarieven&nbsp;2026</h2><p>Geen vaste vertrektijd: u bepaalt zelf wanneer u vertrekt.<br>Prijs &euro; 15,00 per nacht.</p>
    <table><tr><td>Stroom</td><td>&euro; 3</td></tr></table></body></html>`;
  const t = htmlToText(html);
  assert.ok(!t.includes("var a"));
  assert.ok(!t.includes("p{}"));
  assert.match(t, /^Tarieven 2026$/m);
  assert.match(t, /^Geen vaste vertrektijd: u bepaalt zelf wanneer u vertrekt\.$/m);
  assert.match(t, /^Prijs € 15,00 per nacht\.$/m);
  assert.match(t, /^Stroom \| € 3$/m);
});

test("filterLines: alleen regels met de woorden, met context en een scheidingsteken", () => {
  const t = ["a", "b", "Vertrek tot 11:00", "c", "d", "e", "f", "Prijs € 12", "g"].join("\n");
  assert.equal(filterLines(t, ["vertrek"], 1), "b\nVertrek tot 11:00\nc");
  assert.equal(filterLines(t, ["vertrek", "prijs"], 0), "Vertrek tot 11:00\n…\nPrijs € 12");
  assert.equal(filterLines(t, []), t);
});

test("safeEqual en cleanSearch", () => {
  assert.equal(safeEqual("abc", "abc"), true);
  assert.equal(safeEqual("abc", "abd"), false);
  assert.equal(safeEqual("abc", "abcd"), false);
  assert.equal(safeEqual("", "x"), false);
  assert.equal(cleanSearch("Assen,name.eq.x)(%*"), "Assen name.eq.x");
});
