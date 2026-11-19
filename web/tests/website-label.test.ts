// Het domein onder de websiteknop: alleen het domein, nooit een los pad als "/c" (melding Patrick, 19 november 2026)
import { strict as assert } from "node:assert";
import { test } from "node:test";
import { websiteLabel } from "../src/lib/format.ts";

test("websiteLabel toont alleen het domein", () => {
  assert.equal(websiteLabel("https://www.streejp.nl/c"), "streejp.nl");
  assert.equal(websiteLabel("https://camping-de-hoeve.nl/nl/camperplaatsen?x=1#tarief"), "camping-de-hoeve.nl");
  assert.equal(websiteLabel("http://www.voorbeeld.nl/"), "voorbeeld.nl");
  assert.equal(websiteLabel("geen-url.nl/pad"), "geen-url.nl");
});
