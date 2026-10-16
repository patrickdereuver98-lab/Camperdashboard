import { strict as assert } from "node:assert";
import { test } from "node:test";
import { fitWithin, photoProblem } from "../src/lib/image-size.ts";

test("fitWithin verkleint met behoud van verhouding", () => {
  assert.deepEqual(fitWithin(4000, 3000), { width: 1600, height: 1200 });
  assert.deepEqual(fitWithin(3000, 4000), { width: 1200, height: 1600 });
  assert.deepEqual(fitWithin(1000, 800), { width: 1000, height: 800 }, "nooit vergroten");
  assert.throws(() => fitWithin(0, 100));
});

test("photoProblem", () => {
  assert.equal(photoProblem({ type: "image/jpeg", size: 3e6 }, 3000, 2000), null);
  assert.equal(photoProblem({ type: "image/heic", size: 3e6 }), null);
  assert.match(photoProblem({ type: "application/pdf", size: 1e5 })!, /Kies een foto/);
  assert.match(photoProblem({ type: "image/png", size: 30e6 })!, /te groot/);
  assert.match(photoProblem({ type: "image/png", size: 1e5 }, 300, 1000)!, /te klein/);
});
