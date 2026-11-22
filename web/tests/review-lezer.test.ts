// Review-lezer (README 141): een voorstel pas bij twee verschillende reviews met hetzelfde, en elke review wordt gecontroleerd
// zoals de AI-lezer dat doet (citaat letterlijk, tijd in het citaat).
import { strict as assert } from "node:assert";
import { test } from "node:test";
import { checkReview, corroborate, isRelevant, reviewPage } from "../supabase/functions/pipeline/review-lezer.ts";

const gid = "ChIJ-test_place_id_1";
const answer = (o: Record<string, unknown>) => JSON.stringify({ vertrekregel: "onbekend", ...o });
const verdict = (ref: string, body: string, o: Record<string, unknown>) => checkReview(ref, answer(o), reviewPage(gid, 1, body));

test("relevantie: alleen reviews over vertrek, prijs, maten of sluiting", () => {
  assert.equal(isRelevant({ ref: "a", rating: 5, body: "Mooie rustige plek aan het water, heerlijk gestaan.", published_at: null }), false);
  assert.equal(isRelevant({ ref: "a", rating: 4, body: "Het kost € 15 per nacht en vertrekken kan tot 12:00 uur.", published_at: null }), true);
  assert.equal(isRelevant({ ref: "a", rating: 4, body: null, published_at: null }), false);
});

test("citaat dat niet in de review staat valt weg", () => {
  const v = verdict("r1", "Prima plek, vertrek voor 11:00 uur graag.", { vertrekregel: "vast", vertrektijd: "12:00", vertrek_citaat: "je moet om 12:00 uur weg zijn van de plek" });
  assert.equal(v.proposals.length, 0);
});

test("één review is geen voorstel, twee verschillende reviews wel", () => {
  const a = verdict("r1", "Let op: vertrek voor 11:00 uur graag, anders betaal je extra.", { vertrekregel: "vast", vertrektijd: "11:00", vertrek_citaat: "vertrek voor 11:00 uur graag" });
  const b = verdict("r2", "Leuke plek. Je moet vertrek voor 11:00 uur regelen, wij vertrokken netjes.", { vertrekregel: "vast", vertrektijd: "11:00", vertrek_citaat: "vertrek voor 11:00 uur regelen" });
  assert.equal(a.proposals.length > 0, true, "controle moet de eerste review aanvaarden");
  assert.deepEqual(corroborate([a]).proposals, []);
  const both = corroborate([a, b]);
  assert.equal(both.proposals.some((p) => p.field === "departure"), true);
  assert.match(both.proposals[0].quote, /2 reviews zeggen dit/);
});

test("dezelfde review twee keer telt één keer", () => {
  const a = verdict("r1", "Let op: vertrek voor 11:00 uur graag, anders betaal je extra.", { vertrekregel: "vast", vertrektijd: "11:00", vertrek_citaat: "vertrek voor 11:00 uur graag" });
  assert.deepEqual(corroborate([a, a]).proposals, []);
});

test("tegenspraak: geen voorstel, wel een melding", () => {
  const mk = (ref: string, t: string) =>
    verdict(ref, `Let op: vertrek voor ${t} uur graag, anders betaal je extra.`, { vertrekregel: "vast", vertrektijd: t, vertrek_citaat: `vertrek voor ${t} uur graag` });
  const r = corroborate([mk("r1", "11:00"), mk("r2", "11:00"), mk("r3", "12:00")]);
  // Over de soort regel (vast) zijn ze het eens, over de tijd niet
  assert.deepEqual(r.proposals.filter((p) => p.field === "checkout_until"), []);
  assert.equal(r.conflicts.includes("checkout_until"), true);
});
