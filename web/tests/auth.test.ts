import { strict as assert } from "node:assert";
import { test } from "node:test";
import { authErrorMessage, safeNext } from "../src/lib/auth-utils.ts";

test("safeNext laat alleen interne paden door (geen open redirect)", () => {
  assert.equal(safeNext("/mijn-reis"), "/mijn-reis");
  assert.equal(safeNext("/plek/abc?x=1"), "/plek/abc?x=1");
  for (const bad of [null, undefined, "", "https://evil.nl", "//evil.nl", "/\\evil.nl", "javascript:alert(1)"]) {
    assert.equal(safeNext(bad), "/account", String(bad));
  }
});

test("authErrorMessage vertaalt bekende Supabase-fouten", () => {
  assert.match(authErrorMessage("Unsupported provider: provider is not enabled"), /nog niet beschikbaar/);
  assert.match(authErrorMessage("For security purposes, you can only request this after 49 seconds."), /Wacht een minuutje/);
  assert.match(authErrorMessage("Email link is invalid or has expired"), /verlopen/);
  assert.match(authErrorMessage("access_denied"), /geannuleerd/);
  assert.match(authErrorMessage("iets raars"), /Inloggen lukte niet/);
});
