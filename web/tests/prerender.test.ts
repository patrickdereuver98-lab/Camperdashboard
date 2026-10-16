import { strict as assert } from "node:assert";
import { test } from "node:test";
import { PRERENDER_LIMIT, rankForPrerender } from "../src/lib/prerender.ts";

const place = (slug: string, extra: Record<string, unknown> = {}) => ({ slug, completeness: 50, ...extra });

test("rankForPrerender begrenst tot de limiet (standaard 100)", () => {
  const many = Array.from({ length: 700 }, (_, i) => place(`p-${i}`));
  assert.equal(PRERENDER_LIMIT, 100);
  assert.equal(rankForPrerender(many).length, 100);
  assert.equal(rankForPrerender(many, 5).length, 5);
});

test("rankForPrerender: reviews, dan score, dan foto, dan volledigheid", () => {
  const ranked = rankForPrerender([
    place("compleet", { completeness: 99 }),
    place("foto", { imageUrl: "https://x" }),
    place("score", { ratingCount: 1, ratingAvg: 9 }),
    place("populair", { ratingCount: 12, ratingAvg: 7 }),
  ]).map((p) => p.slug);
  assert.deepEqual(ranked, ["populair", "score", "foto", "compleet"]);
});

test("rankForPrerender is deterministisch en muteert de invoer niet", () => {
  const input = [place("b"), place("a")];
  assert.deepEqual(rankForPrerender(input).map((p) => p.slug), ["a", "b"]);
  assert.deepEqual(input.map((p) => p.slug), ["b", "a"]);
});
