import { strict as assert } from "node:assert";
import { test } from "node:test";
import { bearer, parseDependencyUpdate } from "../src/lib/dependency-log.ts";

const PR = "https://github.com/patrickdereuver98-lab/camperdashboard/pull/42";

test("parseDependencyUpdate: geldige melding, nummer uit de PR-link", () => {
  const u = parseDependencyUpdate({
    package_name: "@supabase/supabase-js", version_from: "2.118.0", version_to: "2.119.1", update_type: "minor",
    category: "Aanbevolen", ai_advice: "  Kleine fixes.  ", pr_url: PR,
  });
  assert.ok(!("error" in u));
  assert.equal(u.category, "aanbevolen");
  assert.equal(u.status, "pending_review");
  assert.equal(u.pr_number, 42);
  assert.equal(u.ai_advice, "Kleine fixes.");
});

test("parseDependencyUpdate weigert rommel", () => {
  assert.ok("error" in parseDependencyUpdate(null));
  assert.ok("error" in parseDependencyUpdate([]));
  assert.ok("error" in parseDependencyUpdate({ package_name: "next" }), "zonder categorie");
  assert.ok("error" in parseDependencyUpdate({ package_name: "next; drop table", category: "kritiek" }));
  assert.ok("error" in parseDependencyUpdate({ package_name: "next", category: "kritiek", status: "gemerged" }));
  assert.ok("error" in parseDependencyUpdate({ package_name: "next", category: "kritiek", pr_url: "https://evil.nl/pull/1" }));
});

test("parseDependencyUpdate kort lange tekst in en laat vreemde versies weg", () => {
  const u = parseDependencyUpdate({ package_name: "next", category: "uitstellen", ai_advice: "x".repeat(2000), version_to: "<script>" });
  assert.ok(!("error" in u));
  assert.equal(u.ai_advice?.length, 600);
  assert.equal(u.version_to, null);
  assert.equal(u.update_type, "onbekend");
});

test("bearer leest de sleutel uit Authorization of x-vrijstaan-key", () => {
  assert.equal(bearer(new Headers({ authorization: "Bearer abc123" })), "abc123");
  assert.equal(bearer(new Headers({ "x-vrijstaan-key": "def" })), "def");
  assert.equal(bearer(new Headers({ authorization: "Basic abc" })), "");
  assert.equal(bearer(new Headers()), "");
});
