import { strict as assert } from "node:assert";
import { test } from "node:test";
import { authErrorMessage, cleanCode, codeErrorMessage, safeNext } from "../src/lib/auth-utils.ts";

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

test("cleanCode houdt alleen cijfers over, maximaal 10", () => {
  assert.equal(cleanCode("123 456"), "123456");
  assert.equal(cleanCode(" 12-34-56\n"), "123456");
  assert.equal(cleanCode("12345678901234"), "1234567890");
  assert.equal(cleanCode("abc"), "");
});

test("codeErrorMessage: verkeerde of verlopen code, en te vaak geprobeerd", () => {
  assert.match(codeErrorMessage("Token has expired or is invalid"), /klopt niet of is verlopen/);
  assert.match(codeErrorMessage("For security purposes, you can only request this after 30 seconds."), /Wacht een minuutje/);
  assert.match(codeErrorMessage("Failed to fetch"), /Geen verbinding/);
});
