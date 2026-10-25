// Stealth-lezer (bronnenbeleid §3a): de pipeline kiest de pagina's die de Python-lezer ophaalt
import { test } from "node:test";
import assert from "node:assert/strict";
import { STEALTH_FIRST, STEALTH_PAGE_CHARS, STEALTH_SUBPAGES, stealthDeeper, stealthPages, stealthPlan } from "../supabase/functions/pipeline/stealth";

const home = new URL("https://www.camping.nl/");
const menu = (paths: string[]) => paths.map((p) => `<a href="${p}">${p.slice(1)}</a>`).join("");

test("eerste laag: vertrek en tarieven eerst, hoogstens 5", () => {
  const html = menu(["/huisregels", "/tarieven", "/faq", "/camperplaats", "/contact", "/aankomst-en-vertrek", "/faciliteiten", "/nieuws", "/fotos"]);
  const plan = stealthPlan(home, html);
  assert.equal(plan.picked.length, STEALTH_FIRST);
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

test("tweede laag past binnen 7 subpagina's", () => {
  const faq = menu(["/vertrektijden", "/check-out", "/inchecken"]) + `<a href="/reglement.pdf">Reglement</a>`;
  const seen = [home.href, ...["/a", "/b", "/c", "/d", "/e", "/f"].map((p) => new URL(p, home).href)];
  const { deeper, pdfs } = stealthDeeper(home, [faq], seen);
  assert.equal(deeper.length, STEALTH_SUBPAGES - 6);
  assert.deepEqual(pdfs, ["https://www.camping.nl/reglement.pdf"]);
});

test("aangeleverde pagina's: alleen tekst, ingekort en hoogstens 8", () => {
  const pages = stealthPages(["x".repeat(STEALTH_PAGE_CHARS + 10), 3, "", ...Array(10).fill("<p>a</p>")]);
  assert.equal(pages.length, 1 + STEALTH_SUBPAGES);
  assert.equal(pages[0].length, STEALTH_PAGE_CHARS);
  assert.deepEqual(stealthPages("geen lijst"), []);
});
