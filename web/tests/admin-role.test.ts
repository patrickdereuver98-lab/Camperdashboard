import { strict as assert } from "node:assert";
import { test } from "node:test";
import { ADMIN_ONLY_PATHS, can, canOpen, parseRole } from "../src/lib/admin-role.ts";

test("parseRole kent alleen admin en support", () => {
  assert.equal(parseRole("admin"), "admin");
  assert.equal(parseRole("support"), "support");
  for (const bad of [null, undefined, "", "Admin", "beheerder", true, 1, {}]) assert.equal(parseRole(bad), null, String(bad));
});

test("beheerder mag elke beheerpagina openen", () => {
  for (const p of ["/admin", ...ADMIN_ONLY_PATHS, "/admin/support", "/admin/plekken"]) assert.ok(canOpen("admin", p), p);
});

test("support mag inzendingen, reviews, foto's, meldingen en plekken", () => {
  for (const p of ["/admin", "/admin/support", "/admin/inzendingen", "/admin/reviews", "/admin/fotos", "/admin/plekken", "/admin/vertrektijden"]) {
    assert.ok(canOpen("support", p), p);
  }
});

test("support mag geen instellingen, logs, statistieken, FAQ of dubbelen", () => {
  for (const p of ADMIN_ONLY_PATHS) {
    assert.equal(canOpen("support", p), false, p);
    // Varianten van hetzelfde pad mogen er niet langs
    for (const v of [`${p}/`, `${p}/iets`, `${p}?tab=1`, `${p}#x`, p.toUpperCase(), p.replace("/admin/", "/admin//")]) {
      assert.equal(canOpen("support", v), false, v);
    }
  }
  // Een pad dat alleen met dezelfde letters begint, is een ander pad
  assert.ok(canOpen("support", "/admin/faqx") === true);
});

test("zonder rol geen toegang", () => {
  assert.equal(canOpen(null, "/admin"), false);
  assert.equal(canOpen(null, "/admin/reviews"), false);
});

test("acties: verwijderen, status en samenvoegen alleen voor de beheerder", () => {
  for (const a of ["review-verwijderen", "plek-status", "plek-verwijderen", "plekken-samenvoegen"] as const) {
    assert.equal(can("admin", a), true, a);
    assert.equal(can("support", a), false, a);
    assert.equal(can(null, a), false, a);
  }
});
