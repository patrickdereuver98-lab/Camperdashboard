// Onvolledige plekken en "mogelijk verouderd" (PRD 18 oktober 2026, README #42 en #45).
import { strict as assert } from "node:assert";
import { test } from "node:test";
import { isIncomplete, isPossiblyOutdated, lastChecked } from "../src/lib/place-status.ts";

const NOW = new Date("2026-10-22T12:00:00Z");

test("onvolledig: alleen zonder vertrekregel", () => {
  assert.equal(isIncomplete({}), true);
  assert.equal(isIncomplete({ departure: undefined }), true);
  assert.equal(isIncomplete({ departure: "vrij" }), false);
  assert.equal(isIncomplete({ departure: "per24" }), false);
  assert.equal(isIncomplete({ departure: "vast" }), false);
});

test("laatste controle: de jongste van website en vertrekcontrole", () => {
  assert.equal(lastChecked({}), undefined);
  assert.equal(lastChecked({ verifiedAt: "2025-01-01T00:00:00Z" }), "2025-01-01T00:00:00Z");
  assert.equal(lastChecked({ departureCheckedAt: "2026-03-01T00:00:00Z" }), "2026-03-01T00:00:00Z");
  assert.equal(
    lastChecked({ verifiedAt: "2024-05-01T00:00:00Z", departureCheckedAt: "2026-03-01T00:00:00Z" }),
    "2026-03-01T00:00:00Z",
  );
  assert.equal(
    lastChecked({ verifiedAt: "2026-06-01T10:00:00+00:00", departureCheckedAt: "2025-03-01T00:00:00Z" }),
    "2026-06-01T10:00:00+00:00",
  );
});

test("laatste controle: een onleesbare datum telt niet", () => {
  assert.equal(lastChecked({ verifiedAt: "geen datum" }), undefined);
  assert.equal(lastChecked({ verifiedAt: "geen datum", departureCheckedAt: "2026-01-01T00:00:00Z" }), "2026-01-01T00:00:00Z");
});

test("mogelijk verouderd: pas na 12 maanden", () => {
  assert.equal(isPossiblyOutdated({ verifiedAt: "2025-10-23T12:00:00Z" }, NOW), false);
  assert.equal(isPossiblyOutdated({ verifiedAt: "2025-10-22T12:00:00Z" }, NOW), false);
  assert.equal(isPossiblyOutdated({ verifiedAt: "2025-10-21T12:00:00Z" }, NOW), true);
  assert.equal(isPossiblyOutdated({ verifiedAt: "2023-01-01T00:00:00Z" }, NOW), true);
  assert.equal(isPossiblyOutdated({ verifiedAt: "2026-09-01T00:00:00Z" }, NOW), false);
});

test("mogelijk verouderd: een recente vertrekcontrole maakt een oude websitedatum goed", () => {
  assert.equal(isPossiblyOutdated({ verifiedAt: "2024-01-01T00:00:00Z", departureCheckedAt: "2026-05-01T00:00:00Z" }, NOW), false);
});

test("mogelijk verouderd: zonder datum geen melding", () => {
  assert.equal(isPossiblyOutdated({}, NOW), false);
  assert.equal(isPossiblyOutdated({ verifiedAt: "onzin" }, NOW), false);
});
