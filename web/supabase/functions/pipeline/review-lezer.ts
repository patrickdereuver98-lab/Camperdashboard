// Review-lezer (besluit Patrick, 21 november 2026, README 141, bronnenbeleid §3c): leest de Google-reviews die de job
// `scripts/google-ratings.mjs` bewaarde (`private.place_google_reviews`) en maakt er voorstellen van voor de Triage Inbox
// (bron "google-review"). Elke review gaat apart door het model en door dezelfde controles als de AI-lezer (`verifyAnswer`):
// het citaat staat letterlijk in de review, de tijd of het bedrag in het citaat, het juiste onderwerp.
// Tier 5 (bronnenbeleid §2): een voorstel komt er pas als minstens twee verschillende reviews hetzelfde zeggen, en zeggen
// reviews iets verschillends over hetzelfde veld, dan geen voorstel (tegenspraak, een mens beslist).
//
// Zuiver (geen netwerk, geen database), zodat de regels in `web/tests/review-lezer.test.ts` draaien.

import { parseAnswer, verifyAnswer, type AiAnswer, type Proposal } from "./ai.ts";

/** Ophogen bij elke wijziging in prompt of controles: reviews worden dan opnieuw gelezen */
export const REVIEW_VERSION = "1";

/** Een review uit de database, zonder naam van de schrijver */
export type ReviewRow = { ref: string; rating: number | null; body: string | null; published_at: string | null };

// Alleen reviews die iets over vertrek, prijs, maten, verblijf of sluiting zeggen gaan naar het model: dat scheelt kosten
const RELEVANT = /vertrek|uitcheck|check[- ]?out|moesten (we )?(er )?(voor|om|uiterlijk)|weg (voor|om|uiterlijk)|€|euro|\bprijs|per nacht|nachtprijs|24 uur|max(?:imaal|imum)?\b.{0,20}(nacht|dagen|meter|lang)|gesloten|opgeheven|incheck|aankomst|aankomen|slagboom|lengte/i;

/** Bronnenbeleid §2: alleen vermeldingen van de laatste 24 maanden tellen. Zonder datum telt een review niet mee. */
export const MAX_AGE_MONTHS = 24;
export function isRecent(r: ReviewRow, now = Date.now()): boolean {
  const t = r.published_at ? Date.parse(r.published_at) : NaN;
  return Number.isFinite(t) && now - t <= MAX_AGE_MONTHS * 30.44 * 86400_000;
}

export const isRelevant = (r: ReviewRow, now = Date.now()) => !!r.body && r.body.length >= 20 && isRecent(r, now) && RELEVANT.test(r.body);

export const REVIEW_SYSTEM = `Je leest één review van een bezoeker van een camperplaats, camping of jachthaven in Nederland.
Je haalt alleen feiten eruit die de bezoeker LETTERLIJK noemt als regel of tarief van de plek. Niets afleiden, niets aanvullen.
Regels:
1. Elk feit krijgt een citaat: een stuk tekst van minstens 15 tekens dat letterlijk (tekenvoor-teken) in de review staat, uit
   één zin, waarin het getal, de tijd of de uitspraak zelf staat. Geen citaat, dan het veld null.
2. Alleen wat voor de camperplaats geldt. Een persoonlijke ervaring van één dag, een uitzondering, een gok ("ik denk dat het
   rond 11 uur is") of iets dat de bezoeker van een ander heeft gehoord, is geen feit: dan null.
3. vertrekregel: "vrij" alleen als de bezoeker zegt dat er geen vaste vertrektijd is of dat je vertrekt wanneer je wilt; "per24"
   alleen als het per 24 uur gaat vanaf aankomst; "vast" bij een genoemde vaste tijd waarop je weg moest (vertrektijd in HH:MM);
   anders "onbekend".
4. nachtprijs: wat de bezoeker per nacht voor de camper betaalde, zonder toeristenbelasting, stroom of andere toeslagen.
5. laatste_aankomst, aankomst_vanaf, max_lengte_m, max_nachten en gesloten alleen bij een duidelijke uitspraak over de regel.
Twijfel je, dan null.`;

/** Pseudo-pagina voor de controle: elke review is een eigen "pagina" met een adres naar de plek op Google Maps */
export function reviewPage(googlePlaceId: string, index: number, body: string): string {
  return `### https://www.google.com/maps/place/?q=place_id:${googlePlaceId}#review-${index}\n${body.replace(/\r/g, "").trim()}`;
}

export type ReviewVerdict = { ref: string; answer: AiAnswer; proposals: Proposal[]; rejected: string[] };

/** Het antwoord van het model voor één review controleren tegen de tekst van die review */
export function checkReview(ref: string, raw: string, page: string): ReviewVerdict {
  const answer = parseAnswer(raw);
  const v = verifyAnswer(answer, page);
  return { ref, answer, proposals: v.proposals, rejected: v.rejected };
}

/**
 * Samenvoegen over de reviews van één plek: een voorstel per veld, alleen als minstens `min` verschillende reviews dezelfde
 * waarde onderbouwen. Zegt een andere review iets anders over hetzelfde veld, dan geen voorstel (tegenspraak).
 */
export function corroborate(verdicts: ReviewVerdict[], min = 2): { proposals: Proposal[]; conflicts: string[] } {
  const byField = new Map<string, Map<string, { value: unknown; refs: Set<string>; first: Proposal }>>();
  for (const v of verdicts) {
    for (const p of v.proposals) {
      const values = byField.get(p.field) ?? new Map();
      const key = JSON.stringify(p.value);
      const g = values.get(key) ?? { value: p.value, refs: new Set<string>(), first: p };
      g.refs.add(v.ref);
      values.set(key, g);
      byField.set(p.field, values);
    }
  }
  const proposals: Proposal[] = [];
  const conflicts: string[] = [];
  for (const [field, values] of byField) {
    const strong = [...values.values()].filter((g) => g.refs.size >= min);
    if (!strong.length) continue;
    // Tegenspraak (tweede waarde, ook van één review): geen voorstel, een mens kijkt (bronnenbeleid §2)
    if (values.size > 1) {
      conflicts.push(field);
      continue;
    }
    const g = strong[0];
    proposals.push({ ...g.first, quote: `${g.first.quote}`.slice(0, 460) + ` (${g.refs.size} reviews zeggen dit)` });
  }
  return { proposals, conflicts };
}
