// R2: een productiebuild op Vercel zonder NEXT_PUBLIC_SITE_URL faalt, in plaats van stil vrijstaan.nl te gebruiken.
import { strict as assert } from "node:assert";
import { test } from "node:test";
import { resolveSiteUrl } from "../src/lib/env";

test("productie op Vercel zonder NEXT_PUBLIC_SITE_URL faalt", () => {
  assert.throws(() => resolveSiteUrl({ VERCEL_ENV: "production" }), /NEXT_PUBLIC_SITE_URL ontbreekt/);
  assert.throws(() => resolveSiteUrl({ VERCEL_ENV: "production", NEXT_PUBLIC_SITE_URL: "  " }), /ontbreekt/);
});

test("met adres: dat adres, zonder slash aan het eind", () => {
  assert.equal(resolveSiteUrl({ VERCEL_ENV: "production", NEXT_PUBLIC_SITE_URL: "https://www.vrijstaan.nl/" }), "https://www.vrijstaan.nl");
  assert.equal(resolveSiteUrl({ NEXT_PUBLIC_SITE_URL: "https://preview.example" }), "https://preview.example");
});

test("lokaal, CI en previews houden de terugval", () => {
  assert.equal(resolveSiteUrl({}), "https://vrijstaan.nl");
  assert.equal(resolveSiteUrl({ VERCEL_ENV: "preview" }), "https://vrijstaan.nl");
});
