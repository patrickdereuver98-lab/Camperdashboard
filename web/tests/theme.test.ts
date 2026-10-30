import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveTheme, THEME_BOOT } from "../src/lib/theme";

test("avondmodus: automatisch volgt de zon in Nederland, een vaste keuze wint", () => {
  // 30 oktober 2026 (wintertijd): zon op rond 07:15, onder rond 16:55 Nederlandse tijd (UTC+1)
  const at = (iso: string) => new Date(iso);
  assert.equal(resolveTheme(null, false, at("2026-10-30T12:00:00Z")), "light");
  assert.equal(resolveTheme(null, false, at("2026-10-30T17:30:00Z")), "dark");
  assert.equal(resolveTheme("automatisch", false, at("2026-10-30T05:00:00Z")), "dark");
  // Midzomer: om 21:00 Nederlandse tijd (19:00 UTC) is het nog licht, om 23:00 donker
  assert.equal(resolveTheme(null, false, at("2026-06-21T19:00:00Z")), "light");
  assert.equal(resolveTheme(null, false, at("2026-06-21T21:30:00Z")), "dark");
  // Systeem donker of een vaste keuze
  assert.equal(resolveTheme(null, true, at("2026-10-30T12:00:00Z")), "dark");
  assert.equal(resolveTheme("licht", true, at("2026-10-30T22:00:00Z")), "light");
  assert.equal(resolveTheme("donker", false, at("2026-10-30T12:00:00Z")), "dark");
});

test("het script voor <head> werkt zonder de rest van de app", () => {
  const el = { dataset: {} as Record<string, string> };
  const fn = new Function("document", "localStorage", "matchMedia", THEME_BOOT);
  fn({ documentElement: el }, { getItem: () => "donker" }, () => ({ matches: false }));
  assert.equal(el.dataset.theme, "dark");
  // Geen opslag (privévenster): geen fout, automatisch
  fn({ documentElement: el }, { getItem: () => { throw new Error("geblokkeerd"); } }, () => ({ matches: true }));
  assert.equal(el.dataset.theme, "dark");
});
