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

/** www.camping.nl en camping.nl zijn dezelfde site */
export const sameSite = (a: string, b: string) => a.replace(/^www\./, "") === b.replace(/^www\./, "");

/** Vaste adressen die we proberen als een site geen bruikbare links of sitemap heeft (menu in JavaScript) */
export const PROBE_PATHS = [
  "/huisregels", "/reglement", "/faq", "/veelgestelde-vragen", "/praktische-informatie", "/informatie",
  "/tarieven", "/camperplaats", "/camperplaatsen", "/aankomst-en-vertrek",
];

/** Vertrek-PDF's (reglement, huisregels, tarieven): die staan vaak alleen als bestand online */
export const PDF_RE = /reglement|huisregel|huishoudelijk|voorwaarden|tarie|prijs|platzordnung|informatie/i;

/** Links naar PDF's op dezelfde site die over regels of tarieven gaan, hoogstens `max` */
export function pdfLinks(html: string, home: URL, max = 2): string[] {
  const out: string[] = [];
  for (const m of html.matchAll(/<a\s[^>]*href=["']([^"'#]+\.pdf)(?:\?[^"']*)?["'][^>]*>([\s\S]{0,300}?)<\/a>/gi)) {
    let u: URL;
    try {
      u = new URL(m[1], home);
    } catch {
      continue;
    }
    if (!sameSite(u.host, home.host) || !(PDF_RE.test(u.pathname) || PDF_RE.test(decode(m[2])))) continue;
    if (!out.includes(u.href)) out.push(u.href);
    if (out.length >= max) break;
  }
  return out;
}

/** Tweede laag: vanaf al gelezen pagina's (FAQ, huisregels) de links die sterk naar vertrektijden wijzen */
export function deeperLinks(htmls: string[], home: URL, visited: string[], max = 3): string[] {
  const strong = SUBPAGES[0].re;
  const out: string[] = [];
  for (const html of htmls)
    for (const l of extractLinks(html, home)) {
      const path = decodeURIComponent(new URL(l.url).pathname);
      if (visited.includes(l.url) || out.includes(l.url) || !(strong.test(path) || strong.test(l.text))) continue;
      out.push(l.url);
      if (out.length >= max) return out;
    }
  return out;
}

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
    if (!/^https?:$/.test(u.protocol) || !sameSite(u.host, home.host) || u.pathname === home.pathname) continue;
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
        return sameSite(u.host, home.host) && u.pathname !== home.pathname && !SKIP.test(u.pathname) && !NOT_CONTENT.test(u.pathname);
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

/**
 * Tekenset: uit de header, anders uit <meta charset> in het begin van de pagina. Oude sites in ISO-8859-1 zonder
 * header werden anders als UTF-8 gelezen, en dan werd "vóór" onleesbaar ("v r") en viel de vertrektijd weg.
 */
export function decodeHtml(bytes: Uint8Array, contentType: string): string {
  const head = new TextDecoder("latin1").decode(bytes.subarray(0, 4096));
  const charset =
    /charset=["']?([\w-]+)/i.exec(contentType)?.[1] ??
    /<meta[^>]+charset=["']?([\w-]+)/i.exec(head)?.[1] ??
    "utf-8";
  try {
    return new TextDecoder(charset).decode(bytes);
  } catch {
    return new TextDecoder().decode(bytes);
  }
}

/**
 * Adressen om de startpagina te proberen, in volgorde. Verhuisde pagina (404) met één niveau diep adres
 * ("/minicamping"): dan de hoofdpagina van het domein; bij dieper adressen niet, want daar staan vaak meerdere
 * locaties onder één domein en dan zou een tijd van een andere plek worden overgenomen. Bij een certificaat- of
 * verbindingsfout ook de variant met/zonder www en daarna http.
 */
export function homeCandidates(website: string): string[] {
  const u = new URL(website);
  const out = [u.href];
  const depth = u.pathname.split("/").filter(Boolean).length;
  if (depth === 1) out.push(u.origin + "/");
  const other = new URL(u.href);
  other.hostname = u.hostname.startsWith("www.") ? u.hostname.slice(4) : `www.${u.hostname}`;
  out.push(other.href);
  if (u.protocol === "https:") {
    const http = new URL(u.href);
    http.protocol = "http:";
    out.push(http.href);
  }
  return [...new Set(out)];
}
