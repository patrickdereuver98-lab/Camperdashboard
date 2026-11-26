import { strict as assert } from "node:assert";
import { test } from "node:test";
import { adminMfaStep, qrDataUrl, totpCode } from "../src/lib/admin-mfa.ts";

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

test("qrDataUrl codeert de SVG van Supabase, zodat # en % de data-URL niet breken", () => {
  const svg = '<svg xmlns="http://www.w3.org/2000/svg"><path fill="#000" d="M0 0h1v1H0z"/></svg>';
  const out = qrDataUrl(`data:image/svg+xml;utf-8,${svg}`);
  assert.ok(out.startsWith("data:image/svg+xml;charset=utf-8,"));
  assert.ok(!out.includes("#"));
  assert.equal(decodeURIComponent(out.slice(out.indexOf(",") + 1)), svg);
  assert.equal(qrDataUrl("data:image/png;base64,AAAA"), "data:image/png;base64,AAAA");
});
