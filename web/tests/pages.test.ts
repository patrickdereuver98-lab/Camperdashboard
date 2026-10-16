// Welke pagina's de scraper leest: vertrekpagina's eerst, op adres én linktekst, met de sitemap als terugval.
import { test } from "node:test";
import assert from "node:assert/strict";
import { deeperLinks, extractLinks, needsSitemap, parseSitemap, pdfLinks, rankLinks, sitemapsFromRobots } from "../supabase/functions/pipeline/pages.ts";

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
