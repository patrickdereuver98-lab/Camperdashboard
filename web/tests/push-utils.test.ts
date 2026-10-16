import { strict as assert } from "node:assert";
import { test } from "node:test";
import { base64UrlToBytes, bytesToBase64Url, pushSupport } from "../src/lib/push-utils.ts";

test("base64url heen en terug", () => {
  const bytes = new Uint8Array([0, 1, 250, 251, 252, 253, 254, 255, 62, 63]);
  const s = bytesToBase64Url(bytes.buffer);
  assert.doesNotMatch(s, /[+/=]/);
  assert.deepEqual([...base64UrlToBytes(s)], [...bytes]);
  assert.equal(bytesToBase64Url(null), "");
});

test("pushSupport", () => {
  const base = { hasSW: true, hasPush: true, hasNotification: true, ios: false, standalone: false };
  assert.equal(pushSupport(base), "ok");
  assert.equal(pushSupport({ ...base, permission: "denied" }), "denied");
  assert.equal(pushSupport({ ...base, hasPush: false, ios: true }), "ios-install");
  assert.equal(pushSupport({ ...base, hasPush: false, ios: true, standalone: true }), "unsupported");
  assert.equal(pushSupport({ ...base, hasPush: false }), "unsupported");
});
