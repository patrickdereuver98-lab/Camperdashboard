import { test } from "node:test";
import assert from "node:assert/strict";
import { isUnsure, SiteUnsure } from "../supabase/functions/pipeline/discover.ts";

// Review R71: een time-out of serverfout is geen "geen website", een niet-bestaand domein wel
test("isUnsure: time-out en 5xx zijn onzeker, DNS-fout en geen match niet", () => {
  assert.equal(isUnsure(new SiteUnsure("HTTP 503")), true);
  assert.equal(isUnsure(Object.assign(new Error("signal timed out"), { name: "TimeoutError" })), true);
  assert.equal(isUnsure(Object.assign(new Error("aborted"), { name: "AbortError" })), true);
  assert.equal(isUnsure(new TypeError("error sending request: dns error: failed to lookup address")), false);
  assert.equal(isUnsure(null), false);
});
