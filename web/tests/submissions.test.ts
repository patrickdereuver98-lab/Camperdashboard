// Inzending "vertrektijd" met één klik overnemen in beheer: alleen een regel die we zeker kunnen lezen.
import { test } from "node:test";
import assert from "node:assert/strict";
import { departureFromSubmission } from "../src/lib/submissions";

test("vrij en per 24 uur zonder tijd; vaste tijd genormaliseerd", () => {
  assert.deepEqual(departureFromSubmission({ onderwerp: "vertrektijd", vertrek: "vrij" }), { departure: "vrij", checkout_until: null });
  assert.deepEqual(departureFromSubmission({ onderwerp: "vertrektijd", vertrek: "per24", vertrek_uiterlijk: "11:00" }), { departure: "per24", checkout_until: null });
  assert.deepEqual(departureFromSubmission({ onderwerp: "vertrektijd", vertrek: "vast", vertrek_uiterlijk: "9.30" }), { departure: "vast", checkout_until: "09:30" });
  assert.deepEqual(departureFromSubmission({ onderwerp: "vertrektijd", vertrek: "vast", vertrek_uiterlijk: "12:00" }), { departure: "vast", checkout_until: "12:00" });
});

test("niet over te nemen: geen tijd, onleesbare tijd of geen keuze", () => {
  assert.ok("reason" in (departureFromSubmission({ onderwerp: "vertrektijd", vertrek: "vast", vertrek_uiterlijk: null }) ?? {}));
  assert.ok("reason" in (departureFromSubmission({ onderwerp: "vertrektijd", vertrek: "vast", vertrek_uiterlijk: "rond de middag" }) ?? {}));
  assert.ok("reason" in (departureFromSubmission({ onderwerp: "vertrektijd", vertrek: "vast", vertrek_uiterlijk: "24:00" }) ?? {}));
  assert.ok("reason" in (departureFromSubmission({ onderwerp: "vertrektijd", vertrek: "" }) ?? {}));
});

test("andere inzendingen hebben geen knop", () => {
  assert.equal(departureFromSubmission({ onderwerp: "prijs", toelichting: "Nu € 15" }), undefined);
  assert.equal(departureFromSubmission({ naam: "Camperplaats X" }), undefined);
});
