// Welke pagina's de scraper leest: vertrekpagina's eerst, op adres én linktekst, met de sitemap als terugval.
import { test } from "node:test";
import assert from "node:assert/strict";
import { addExtraPages, decodeHtml, emptySite, deeperLinks, extractLinks, homeCandidates, needsSitemap, onePage, parseSitemap, pdfLinks, rankLinks, sitemapsFromRobots } from "../supabase/functions/pipeline/pages.ts";

const home = new URL("https://camping-dewei.nl/");

test("linktekst telt mee: 'Praktische informatie' op een nietszeggend adres wordt gelezen", () => {
  const html = `<nav><a href="/pagina-12">Praktische informatie</a><a href="/blog/zomer">Ons nieuws</a><a href="https://elders.nl/huisregels">Elders</a></nav>`;
  const links = extractLinks(html, home);
  assert.deepEqual(links.map((l) => l.url).sort(), ["https://camping-dewei.nl/blog/zomer", "https://camping-dewei.nl/pagina-12"]);
  assert.deepEqual(rankLinks(links, home), ["https://camping-dewei.nl/pagina-12"]);
});

test("vertrekpagina's gaan voor tarieven en contact, met een maximum per soort", () => {
  const links = [
    "/contact", "/tarieven", "/tarieven-2027", "/prijzen-camper", "/huisregels", "/faq", "/reglement", "/praktisch",
    "/aankomst-en-vertrek", "/camperplaatsen", "/faciliteiten", "/info",
  ].map((p) => ({ url: `https://camping-dewei.nl${p}`, text: "" }));
  const picked = rankLinks(links, home).map((u) => new URL(u).pathname);
  assert.deepEqual(picked.slice(0, 3).sort(), ["/aankomst-en-vertrek", "/huisregels", "/reglement"]);
  assert.deepEqual(picked.slice(3, 5).sort(), ["/faq", "/praktisch"]);
  assert.ok(picked.includes("/tarieven"));
  assert.ok(picked.length <= 10);
});

test("geen bestanden, beheer- of winkelpagina's en geen andere sites", () => {
  const html = `<a href="/reglement.pdf">Reglement</a><a href="/wp-content/uploads/faq.html">FAQ</a><a href="/wp-login.php">Login</a><a href="mailto:x@y.nl">Mail</a><a href="/veelgestelde-vragen/">Vragen</a>`;
  assert.deepEqual(rankLinks(extractLinks(html, home), home), ["https://camping-dewei.nl/veelgestelde-vragen/"]);
});

test("sitemap: pagina's en sitemap-index", () => {
  assert.deepEqual(parseSitemap(`<urlset><url><loc> https://camping-dewei.nl/huisregels </loc></url></urlset>`), {
    pages: ["https://camping-dewei.nl/huisregels"],
    sitemaps: [],
  });
  assert.deepEqual(parseSitemap(`<sitemapindex><sitemap><loc>https://camping-dewei.nl/page-sitemap.xml</loc></sitemap></sitemapindex>`), {
    pages: [],
    sitemaps: ["https://camping-dewei.nl/page-sitemap.xml"],
  });
  assert.deepEqual(sitemapsFromRobots("User-agent: *\nDisallow: /wp-admin\nSitemap: https://camping-dewei.nl/sitemap_index.xml\n"), [
    "https://camping-dewei.nl/sitemap_index.xml",
  ]);
});

test("sitemap alleen als de homepage weinig bruikbare links heeft (menu in JavaScript)", () => {
  assert.equal(needsSitemap([]), true);
  assert.equal(needsSitemap(["a", "b", "c"]), false);
});

test("www en zonder www zijn dezelfde site", () => {
  const www = new URL("https://www.camping-dewei.nl/");
  const links = extractLinks(`<a href="https://camping-dewei.nl/huisregels">Huisregels</a>`, www);
  assert.deepEqual(rankLinks(links, www), ["https://camping-dewei.nl/huisregels"]);
});

test("PDF's met het reglement of de tarieven, niet elke PDF", () => {
  const html = `<a href="/docs/Reglement-2026.pdf">Download</a><a href="/menukaart.pdf">Menukaart</a><a href="/files/x.pdf">Onze tarieven</a><a href="https://elders.nl/reglement.pdf">x</a>`;
  assert.deepEqual(pdfLinks(html, home), ["https://camping-dewei.nl/docs/Reglement-2026.pdf", "https://camping-dewei.nl/files/x.pdf"]);
});

test("tweede laag: vanaf de FAQ alleen links over aankomst en vertrek, niet al bezochte", () => {
  const faq = `<a href="/faq/aankomst-en-vertrek">Hoe laat kan ik aankomen?</a><a href="/faq/honden">Honden</a><a href="/huisregels">Huisregels</a>`;
  assert.deepEqual(deeperLinks([faq], home, ["https://camping-dewei.nl/huisregels"]), ["https://camping-dewei.nl/faq/aankomst-en-vertrek"]);
});

test("tekenset uit <meta charset> als de header die mist: 'vóór' blijft leesbaar", () => {
  const bytes = new Uint8Array([...new TextEncoder().encode('<meta charset="iso-8859-1"><p>Vertrek v'), 0xf3, 0xf3, ...new TextEncoder().encode("r 12.00 uur</p>")]);
  assert.match(decodeHtml(bytes, "text/html"), /Vertrek vóór 12\.00 uur/);
  assert.match(decodeHtml(new TextEncoder().encode("<p>vóór</p>"), "text/html; charset=utf-8"), /vóór/);
});

test("startpagina: verhuisde subpagina één niveau diep valt terug op het domein, dieper niet; www en http als terugval", () => {
  assert.deepEqual(homeCandidates("https://campingdenesse.nl/minicamping"), [
    "https://campingdenesse.nl/minicamping",
    "https://campingdenesse.nl/",
    "https://www.campingdenesse.nl/minicamping",
    "http://campingdenesse.nl/minicamping",
  ]);
  assert.ok(!homeCandidates("https://www.logerenbijdeboswachter.nl/kamperen/dasselaar").includes("https://www.logerenbijdeboswachter.nl/"));
  assert.deepEqual(homeCandidates("https://www.camping.nl/"), ["https://www.camping.nl/", "https://camping.nl/", "http://www.camping.nl/"]);
});

test("WordPress zonder nette adressen: '/?page_id=21' is een eigen pagina, niet de homepage", () => {
  const home = new URL("https://www.campingmaereheerd.nl/");
  const html = `<a href="https://campingmaereheerd.nl/">Home</a><a href="https://campingmaereheerd.nl/?page_id=21">Huisregels</a><a href="https://campingmaereheerd.nl/?page_id=95">Tarieven</a>`;
  const links = extractLinks(html, home);
  assert.deepEqual(links.map((l) => l.url).sort(), ["https://campingmaereheerd.nl/?page_id=21", "https://campingmaereheerd.nl/?page_id=95"]);
  assert.deepEqual(rankLinks(links, home), ["https://campingmaereheerd.nl/?page_id=21", "https://campingmaereheerd.nl/?page_id=95"]);
});

test("reserveren telt als pagina met tijden en tarieven", () => {
  const home = new URL("https://www.dereuten.com/");
  assert.deepEqual(rankLinks(extractLinks(`<a href="/reserveren">Reserveren</a>`, home), home), ["https://www.dereuten.com/reserveren"]);
});

test("site van één pagina: menu met '#prijzen' herkend", () => {
  assert.equal(onePage(`<a href="#home">Home</a><a href="#faciliteiten">Faciliteiten</a><a href="#prijzen">Prijzen</a>`), true);
  assert.equal(onePage(`<a href="/huisregels">Huisregels</a><a href="#top">Naar boven</a>`), false);
});

test("kleine site met weinig herkende pagina's krijgt nog steeds de vaste adressen (regressie parser 42)", () => {
  const home = new URL("https://camping-dewei.nl/");
  const links = extractLinks(`<a href="/over">Over</a><a href="/albums">Albums</a><a href="/contact">Contact</a>`, home);
  const ranked = rankLinks(links, home);
  assert.equal(needsSitemap(ranked), true); // alleen "contact" is herkend: weak
  const out = addExtraPages(ranked, links, home, needsSitemap(ranked), false).map((u) => new URL(u).pathname);
  assert.ok(out.includes("/over") && out.includes("/albums"), "eigen pagina's van een kleine site");
  assert.ok(out.includes("/huisregels") && out.includes("/aankomst-en-vertrek"), "vaste adressen blijven");
  // eigen pagina's gaan voor de geraden adressen
  assert.ok(out.indexOf("/over") < out.indexOf("/huisregels"));
});

test("kleine site met genoeg herkende pagina's: geen geraden adressen, wel de rest van de pagina's", () => {
  const home = new URL("https://camping-dewei.nl/");
  const links = extractLinks(`<a href="/tarieven">T</a><a href="/huisregels">H</a><a href="/camperplaats">C</a><a href="/over">Over</a>`, home);
  const ranked = rankLinks(links, home);
  const out = addExtraPages(ranked, links, home, needsSitemap(ranked), false).map((u) => new URL(u).pathname);
  assert.ok(out.includes("/over"));
  assert.ok(!out.includes("/faq"));
});

test("site van één pagina: geen geraden adressen", () => {
  const home = new URL("https://camping-dewei.nl/");
  assert.deepEqual(addExtraPages([], [], home, true, true), []);
});

test("menulink met een SVG-icoon erin (lange inhoud) wordt niet weggegooid (De Bosfluiter, 23 oktober 2026)", () => {
  const home = new URL("https://debosfluiter.nl/");
  const svg = `<span class="ast-icon icon-arrow"><svg class="ast-arrow-svg" xmlns="http://www.w3.org/2000/svg" version="1.1" x="0px" y="0px" width="26px" height="16.043px" viewbox="57 35.171 26 16.043" enable-background="new 57 35.171 26 16.043" xml:space="preserve"><path d="M57.5,38.193l12.5,12.5l12.5-12.5l-2.5-2.5l-10,10l-10-10L57.5,38.193z" /></svg></span>${" ".repeat(300)}`;
  const html = `<a href="https://debosfluiter.nl/aankomst-en-vertrek-informatie/" class="menu-link">${svg}</a><a href="/tarieven">Tarieven</a>`;
  const links = extractLinks(html, home);
  assert.equal(links.length, 2);
  assert.ok(rankLinks(links, home)[0].endsWith("/aankomst-en-vertrek-informatie/"), "vertrekpagina gaat voor");
});

test("lege startpagina (geen links, geen velden) telt als haperende site; één link of één veld niet", () => {
  assert.equal(emptySite(0, 0), true);
  assert.equal(emptySite(1, 0), false);
  assert.equal(emptySite(0, 3), false);
});
