// Stealth-lezer (bronnenbeleid §3a): een Python-taak met Scrapling haalt de pagina's op, deze functie kiest welke en
// leest ze uit met dezelfde extractor als de gewone scraper. Zo blijft er één extractor en één keuze van pagina's.
//
//   1. stealth_batch  → plekken uit private.stealth_queue
//   2. stealth_plan   → startpagina (en eventueel sitemaps) in, subpagina's uit
//   3. stealth_deeper → gelezen pagina's in, tweede laag en PDF-links uit
//   4. stealth_apply  → alle pagina's in, extractie en apply_stealth

import { addExtraPages, deeperLinks, extractLinks, needsSitemap, onePage, parseSitemap, pdfLinks, rankLinks } from "./pages.ts";

/** Hoogstens 7 subpagina's per site per ronde (bronnenbeleid §3a), plus de startpagina en 2 PDF's */
export const STEALTH_SUBPAGES = 7;
/** Eerste laag; de rest van de 7 blijft over voor de tweede laag (aankomst en vertrek vanaf de FAQ) */
export const STEALTH_FIRST = 5;
/** Zelfde grens als fetchPage in de gewone scraper */
export const STEALTH_PAGE_CHARS = 1_200_000;

export type StealthPlan = { links: number; picked: string[]; wantSitemap: boolean };

/** Subpagina's van de eerste laag. Zonder bruikbare links vraagt de lezer de sitemap op en roept dit opnieuw aan. */
export function stealthPlan(home: URL, html: string, sitemaps: string[] = []): StealthPlan {
  const links = extractLinks(html, home);
  let picked = rankLinks(links, home);
  const single = onePage(html) && links.length <= 2;
  const weak = needsSitemap(picked);
  const fromSitemap = sitemaps.flatMap((xml) => parseSitemap(xml).pages).map((url) => ({ url, text: "" }));
  if (weak && fromSitemap.length) picked = rankLinks([...links, ...fromSitemap], home);
  picked = addExtraPages(picked, links, home, needsSitemap(picked), single);
  return { links: links.length, picked: picked.slice(0, STEALTH_FIRST), wantSitemap: weak && !sitemaps.length && !single };
}

/** Tweede laag en PDF's, binnen wat er van de 7 subpagina's over is */
export function stealthDeeper(home: URL, pages: string[], seen: string[]): { deeper: string[]; pdfs: string[] } {
  const room = Math.max(0, STEALTH_SUBPAGES - Math.max(0, seen.length - 1));
  return {
    deeper: deeperLinks(pages, home, seen).slice(0, room),
    pdfs: [...new Set(pages.flatMap((h) => pdfLinks(h, home)))].slice(0, 2),
  };
}

/** Pagina's van de lezer: alleen tekst, ingekort, en hoogstens startpagina + 7 subpagina's */
export function stealthPages(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  return input
    .filter((x): x is string => typeof x === "string" && x.length > 0)
    .slice(0, 1 + STEALTH_SUBPAGES)
    .map((x) => x.slice(0, STEALTH_PAGE_CHARS));
}

/**
 * Mag apply_scrape na deze lezing velden wissen die er nu niet meer staan? Niet als er geen enkel veld uitkwam of alleen
 * de startpagina gelezen werd: dat is bijna altijd een haperende site of een gemiste subpagina, geen site die alles
 * weghaalde. In de stealth-ronde van 25 tot 29 oktober verloren 11 plekken zo hun prijs en gingen er 22 van gepubliceerd
 * naar concept (Frerichsoord, De Kalverhoek, 't Looveld), terwijl emptySite alleen een startpagina zonder links ving.
 */
export const stealthMayWipe = (pages: number, fields: number) => pages > 1 && fields > 0;

// Aanmelden zonder geheim: de workflow vraagt GitHub om een ondertekend OIDC-token met dit publiek, en de pipeline
// controleert handtekening, uitgever en publiek (index.ts) en daarna deze claims. Elke actie hoort bij precies één
// workflow op main van deze repository (workflowForAction); een fork, een andere branch of een andere workflow mag niet.
export const OIDC_ISSUER = "https://token.actions.githubusercontent.com";
export const OIDC_AUDIENCE = "vrijstaan-pipeline";
const REPO = "patrickdereuver98-lab/camperdashboard";

/** Workflow-bestand dat deze actie met een OIDC-token mag aanroepen; null = alleen met de pipeline-sleutel */
export function workflowForAction(action: unknown): string | null {
  const a = String(action ?? "");
  if (a.startsWith("stealth_")) return "stealth-lezer.yml";
  if (a === "merge_master" || a === "promote") return "data_pipeline.yml";
  return null;
}

export function workflowClaimsOk(c: Record<string, unknown>, file: string): boolean {
  const repo = String(c.repository ?? "").toLowerCase();
  const workflow = String(c.workflow_ref ?? "").toLowerCase();
  return (
    repo === REPO &&
    c.ref === "refs/heads/main" &&
    workflow === `${REPO}/.github/workflows/${file}@refs/heads/main` &&
    (c.event_name === "schedule" || c.event_name === "workflow_dispatch")
  );
}

export const stealthClaimsOk = (c: Record<string, unknown>) => workflowClaimsOk(c, "stealth-lezer.yml");
