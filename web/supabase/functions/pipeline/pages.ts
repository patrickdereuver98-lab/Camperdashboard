// Welke pagina's van een website lezen we? De vertrektijd staat zelden op de homepage, maar in de huisregels, bij
// "aankomst en vertrek", in de FAQ of bij de tarieven. We kiezen op het adres én op de linktekst, en gebruiken de
// sitemap als het menu in JavaScript staat (Wix, Squarespace en dergelijke) en de homepage dus geen links heeft.

export type Link = { url: string; text: string };

// Hoogste prioriteit eerst. Vertrektijden gaan voor: dat is het kernfeit, en prijzen staan vaak op dezelfde pagina.
export const SUBPAGES: { re: RegExp; max: number }[] = [
  // Sterk: hier staat de vertrektijd bijna altijd
  {
    re: /aankomst|vertrek|check-?in|check-?out|inchecken|uitchecken|huisregel|huishoudelijk|reglement|anreise|abreise|platzordnung|hausordnung|house-?rules/i,
    max: 3,
  },
  // Algemeen: vaak, maar niet altijd
  { re: /regels|praktisch|praktische|faq|veelgestelde|vragen/i, max: 2 },
  { re: /tarie|prijs|prijzen|kosten|preise|tarife|prices|rates/i, max: 2 },
  { re: /camper|stellplatz|motorhome|wohnmobil|campers/i, max: 2 },
  { re: /faciliteit|voorzien|ausstattung|facilities|sanitair/i, max: 1 },
  { re: /info|informatie|openingstijden|seizoen/i, max: 1 },
  { re: /over-ons|contact|ueber-uns|about/i, max: 1 },
];

export const MAX_SUBPAGES = 10;

const SKIP = /\.(pdf|jpe?g|png|gif|webp|svg|zip|docx?|xlsx?|mp4|mp3)$/i;
const NOT_CONTENT = /\/(wp-content|wp-json|feed|tag|author|category|cart|winkelwagen|checkout-cart|login|account)\b/i;

const decode = (s: string) =>
  s
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#?\w+;/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/** Links naar pagina's op dezelfde site, met hun zichtbare tekst */
export function extractLinks(html: string, home: URL): Link[] {
  const seen = new Map<string, string>();
  for (const m of html.matchAll(/<a\s[^>]*href=["']([^"'#]+)["'][^>]*>([\s\S]{0,400}?)<\/a>/gi)) {
    let u: URL;
    try {
      u = new URL(m[1], home);
    } catch {
      continue;
    }
    if (!/^https?:$/.test(u.protocol) || u.host !== home.host || u.pathname === home.pathname) continue;
    if (SKIP.test(u.pathname) || NOT_CONTENT.test(u.pathname)) continue;
    const key = u.origin + u.pathname;
    const text = decode(m[2]).slice(0, 80);
    if (!seen.has(key) || (!seen.get(key) && text)) seen.set(key, text);
  }
  return [...seen].map(([url, text]) => ({ url, text }));
}

/** Pagina-adressen uit een sitemap; bij een sitemap-index de onderliggende sitemaps */
export function parseSitemap(xml: string): { pages: string[]; sitemaps: string[] } {
  const locs = [...xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi)].map((m) => m[1].replace(/&amp;/g, "&"));
  return /<sitemapindex/i.test(xml) ? { pages: [], sitemaps: locs } : { pages: locs, sitemaps: [] };
}

/** Sitemaps uit robots.txt ("Sitemap: https://…") */
export function sitemapsFromRobots(robots: string): string[] {
  return [...robots.matchAll(/^\s*sitemap:\s*(\S+)/gim)].map((m) => m[1]);
}

/**
 * De beste subpagina's: per soort een maximum, vertrekpagina's eerst, en binnen een soort de kortste adressen
 * (meestal de hoofdpagina van dat onderwerp, niet een blogbericht erover).
 */
export function rankLinks(links: Link[], home: URL, max = MAX_SUBPAGES): string[] {
  const perRank = new Map<number, number>();
  const ranked = links
    .filter((l) => {
      try {
        const u = new URL(l.url);
        return u.host === home.host && u.pathname !== home.pathname && !SKIP.test(u.pathname) && !NOT_CONTENT.test(u.pathname);
      } catch {
        return false;
      }
    })
    .map((l) => {
      const path = decodeURIComponent(new URL(l.url).pathname);
      return { url: l.url, rank: SUBPAGES.findIndex((s) => s.re.test(path) || s.re.test(l.text)), len: path.length };
    })
    .filter((l) => l.rank >= 0)
    .sort((a, b) => a.rank - b.rank || a.len - b.len);
  const out: string[] = [];
  for (const l of ranked) {
    const n = perRank.get(l.rank) ?? 0;
    if (n >= SUBPAGES[l.rank].max || out.includes(l.url)) continue;
    perRank.set(l.rank, n + 1);
    out.push(l.url);
    if (out.length >= max) break;
  }
  return out;
}

/** Weinig bruikbare links op de homepage? Dan ook de sitemap proberen. */
export const needsSitemap = (picked: string[]) => picked.length < 3;
