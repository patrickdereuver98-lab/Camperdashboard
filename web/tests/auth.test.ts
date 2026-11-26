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

test("safeNext weert omwegen via tab, regeleinde en backslash (audit 24 november 2026, M1)", () => {
  for (const bad of ["/\t/evil.nl", "/\n/evil.nl", "/\r/evil.nl", "/\t\\evil.nl", "/\\/evil.nl", "/\t/\t/evil.nl", "/%09/evil.nl/../\t/evil.nl", "/.//evil.nl", "/..//evil.nl", "/a/..//evil.nl", "/%2e%2e//evil.nl", "/./\\evil.nl", "/a/../\t/evil.nl"]) {
    const out = safeNext(bad);
    assert.equal(new URL(out, "https://vrijstaan.nl").origin, "https://vrijstaan.nl", JSON.stringify(bad));
    assert.ok(out.startsWith("/") && !out.startsWith("//") && !out.startsWith("/\\"), JSON.stringify(bad));
  }
  assert.equal(safeNext("/\t/evil.nl"), "/account");
  assert.equal(safeNext("/..//evil.nl"), "/account");
});

test("safeNext houdt zoekvraag en anker van een intern pad", () => {
  assert.equal(safeNext("/plek/abc?x=1#drukte"), "/plek/abc?x=1#drukte");
  assert.equal(safeNext("/samen/ABC123"), "/samen/ABC123");
  assert.equal(safeNext("/a/../mijn-reis"), "/mijn-reis");
  assert.equal(safeNext("/%09/evil.nl"), "/%09/evil.nl");
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
