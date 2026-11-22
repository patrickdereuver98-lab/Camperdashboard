import { strict as assert } from "node:assert";
import { test } from "node:test";
import { TRIAGE_PROMPT, groupUpdates, parseTriage, triageText } from "../src/lib/update-triage.ts";

test("triageText bevat de vaste prompt, de waarden en de geschiedenis, geen persoonsgegevens", () => {
  const t = triageText({
    field: "power",
    oldValue: false,
    newValue: true,
    placeName: "De Proef",
    history: [{ field: "wifi", newValue: true, status: "rejected" }],
  });
  assert.ok(t.startsWith(TRIAGE_PROMPT));
  assert.match(t, /Oude waarde: false/);
  assert.match(t, /Nieuwe waarde: true/);
  assert.match(t, /- wifi: true \(rejected\)/);
  assert.doesNotMatch(t, /@/);
});

test("triageText zonder geschiedenis zegt 'geen'", () => {
  assert.match(triageText({ field: "departure", oldValue: null, newValue: "12:00", history: [] }), /- geen/);
});

test("parseTriage controleert en begrenst het antwoord", () => {
  assert.deepEqual(parseTriage('{"score": 87.6, "advice": " Logisch,  past bij de website. "}'), {
    score: 88,
    advice: "Logisch, past bij de website.",
  });
  assert.equal(parseTriage('{"score": 150, "advice": "x"}')?.score, 100);
  assert.equal(parseTriage('{"score": "40", "advice": "Twijfel."}')?.score, 40);
  assert.equal(parseTriage("geen json"), null);
  assert.equal(parseTriage('{"score": 50}'), null);
  assert.equal(parseTriage('{"score": "veel", "advice": "x"}'), null);
  assert.equal(parseTriage(`{"score": 1, "advice": "${"a".repeat(500)}"}`)?.advice.length, 300);
});

test("groupUpdates: regel en tijd uit één lezing van de AI-lezer zijn één voorstel", () => {
  const row = (id: string, field_changed: string, reading_id: string | null) => ({ id, field_changed, submission_id: null, owner_reply_id: null, reading_id });
  const out = groupUpdates([row("t", "checkout_until", "L1"), row("r", "departure", "L1"), row("p", "price_eur", "L1"), row("x", "departure", null)]);
  assert.deepEqual(out.map((r) => r.fields.map((f) => f.id)), [["r", "t"], ["p"], ["x"]]);
});
