// Stealth-lezer (bronnenbeleid §3a): de pipeline kiest de pagina's die de Python-lezer ophaalt
import { test } from "node:test";
import assert from "node:assert/strict";
import { STEALTH_FIRST, STEALTH_PAGE_CHARS, STEALTH_SUBPAGES, stealthClaimsOk, stealthDeeper, stealthMayWipe, stealthPages, stealthPlan } from "../supabase/functions/pipeline/stealth";

const home = new URL("https://www.camping.nl/");
const menu = (paths: string[]) => paths.map((p) => `<a href="${p}">${p.slice(1)}</a>`).join("");

test("eerste laag: vertrek en tarieven eerst, hoogstens 10", () => {
  const html = menu([
    "/huisregels", "/tarieven", "/faq", "/camperplaats", "/contact", "/aankomst-en-vertrek", "/faciliteiten", "/nieuws", "/fotos",
    "/prijzen", "/plattegrond", "/voorzieningen", "/route", "/over-ons", "/openingstijden", "/arrangementen",
  ]);
  const plan = stealthPlan(home, html);
  // rankLinks laat pagina's zonder feiten (nieuws, foto's) weg; de rest tot de grens
  assert.ok(plan.picked.length > 5 && plan.picked.length <= STEALTH_FIRST, `${plan.picked.length}`);
  assert.equal(plan.picked[0], "https://www.camping.nl/huisregels");
  assert.ok(plan.picked.includes("https://www.camping.nl/aankomst-en-vertrek"));
  assert.equal(plan.wantSitemap, false);
});

test("menu in JavaScript: vraagt de sitemap en gebruikt die", () => {
  const first = stealthPlan(home, "<div id=app></div>");
  assert.equal(first.wantSitemap, true);
  const xml = "<urlset><url><loc>https://www.camping.nl/tarieven</loc></url><url><loc>https://www.camping.nl/huisregels</loc></url></urlset>";
  const second = stealthPlan(home, "<div id=app></div>", [xml]);
  assert.equal(second.wantSitemap, false);
  assert.deepEqual(second.picked.slice(0, 2), ["https://www.camping.nl/huisregels", "https://www.camping.nl/tarieven"]);
});

test("tweede laag past binnen 15 subpagina's", () => {
  const faq = menu(["/vertrektijden", "/check-out", "/inchecken"]) + `<a href="/reglement.pdf">Reglement</a>`;
  const first = Array.from({ length: STEALTH_SUBPAGES - 2 }, (_, i) => new URL(`/p${i}`, home).href);
  const { deeper, pdfs } = stealthDeeper(home, [faq], [home.href, ...first]);
  assert.equal(deeper.length, 2);
  assert.equal(stealthDeeper(home, [faq], [home.href]).deeper.length, 3);
  assert.deepEqual(pdfs, ["https://www.camping.nl/reglement.pdf"]);
});

test("aangeleverde pagina's: alleen tekst, ingekort en hoogstens 16", () => {
  const pages = stealthPages(["x".repeat(STEALTH_PAGE_CHARS + 10), 3, "", ...Array(25).fill("<p>a</p>")]);
  assert.equal(pages.length, 1 + STEALTH_SUBPAGES);
  assert.equal(pages[0].length, STEALTH_PAGE_CHARS);
  assert.deepEqual(stealthPages("geen lijst"), []);
});

test("alleen de stealth-workflow op main mag zonder sleutel", () => {
  const ok = {
    repository: "patrickdereuver98-lab/Camperdashboard",
    ref: "refs/heads/main",
    workflow_ref: "patrickdereuver98-lab/Camperdashboard/.github/workflows/stealth-lezer.yml@refs/heads/main",
    event_name: "schedule",
  };
  assert.equal(stealthClaimsOk(ok), true);
  assert.equal(stealthClaimsOk({ ...ok, event_name: "workflow_dispatch" }), true);
  assert.equal(stealthClaimsOk({ ...ok, event_name: "pull_request" }), false);
  assert.equal(stealthClaimsOk({ ...ok, ref: "refs/heads/acceptatie" }), false);
  assert.equal(stealthClaimsOk({ ...ok, repository: "iemand/Camperdashboard" }), false);
  assert.equal(stealthClaimsOk({ ...ok, workflow_ref: ok.workflow_ref.replace("stealth-lezer", "ci") }), false);
  assert.equal(stealthClaimsOk({}), false);
});

test("wissen alleen na een volledige lezing met velden", () => {
  assert.equal(stealthMayWipe(1, 6), false); // alleen de startpagina
  assert.equal(stealthMayWipe(5, 0), false); // niets gevonden
  assert.equal(stealthMayWipe(2, 3), true);
});
