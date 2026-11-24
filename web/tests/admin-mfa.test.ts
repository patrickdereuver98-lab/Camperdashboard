import { strict as assert } from "node:assert";
import { test } from "node:test";
import { adminMfaStep, totpCode } from "../src/lib/admin-mfa.ts";

test("adminMfaStep: alleen een aal2-sessie gaat door naar de rechtencontrole", () => {
  assert.equal(adminMfaStep({ currentLevel: "aal2", nextLevel: "aal2" }), "rechten");
  assert.equal(adminMfaStep({ currentLevel: "aal1", nextLevel: "aal2" }), "code");
  assert.equal(adminMfaStep({ currentLevel: "aal1", nextLevel: "aal1" }), "instellen");
  assert.equal(adminMfaStep({ currentLevel: null, nextLevel: null }), "instellen");
});

test("totpCode accepteert precies zes cijfers, ook met spaties", () => {
  assert.equal(totpCode("123456"), "123456");
  assert.equal(totpCode(" 123 456 "), "123456");
  assert.equal(totpCode("12345"), null);
  assert.equal(totpCode("1234567"), null);
  assert.equal(totpCode("abcdef"), null);
});
