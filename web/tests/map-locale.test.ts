import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { MAP_LOCALE_NL } from "../src/lib/map-locale";

// De standaardteksten van maplibre-gl staan in de gebundelde code als `const defaultLocale = { ... }`
const bundle = readFileSync(new URL("../node_modules/maplibre-gl/dist/maplibre-gl-dev.mjs", import.meta.url), "utf8");
const block = bundle.match(/const defaultLocale = \{([\s\S]*?)\n\};/)?.[1] ?? "";
const keys = [...block.matchAll(/"([A-Za-z]+\.[A-Za-z]+)":/g)].map((m) => m[1]);

test("de lijst van maplibre-gl is gevonden", () => {
  assert.ok(keys.length >= 10, `te weinig sleutels gevonden: ${keys.length}`);
});

test("elke knop en melding van MapLibre heeft een Nederlandse tekst", () => {
  const missing = keys.filter((k) => !MAP_LOCALE_NL[k]?.trim());
  assert.deepEqual(missing, []);
});

test("geen Engelse standaardtekst blijft staan", () => {
  for (const k of ["NavigationControl.ZoomIn", "NavigationControl.ZoomOut", "AttributionControl.ToggleAttribution", "Popup.Close"]) {
    assert.doesNotMatch(MAP_LOCALE_NL[k], /zoom (in|out)|toggle|close/i, k);
  }
});
