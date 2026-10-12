import { strict as assert } from "node:assert";
import { test } from "node:test";
import { applyVehicle, cleanVehicle, hasVehicle } from "../src/lib/vehicle.ts";

test("cleanVehicle houdt alleen geldige waarden", () => {
  assert.deepEqual(cleanVehicle({ name: "  Onze Hymer ", lengthM: "7,45", heightM: 2.9, widthM: 9, weightKg: "3499.6", fuel: "diesel", consumption: "11" }), {
    name: "Onze Hymer", lengthM: 7.45, heightM: 2.9, weightKg: 3500, fuel: "diesel", consumption: 11,
  });
  assert.deepEqual(cleanVehicle({ lengthM: "", fuel: "kerosine", x: 1 }), {});
  assert.deepEqual(cleanVehicle(null), {});
  assert.equal(hasVehicle({}), false);
});

test("applyVehicle zet de lengte uit het profiel", () => {
  assert.deepEqual(applyVehicle({}, { lengthM: 7.45 }), { minLength: 7.45, lengthFromVehicle: true });
});

test("applyVehicle respecteert een eigen keuze of 'uit'", () => {
  assert.deepEqual(applyVehicle({ minLength: 6 }, { lengthM: 7.4 }), { minLength: 6 });
  assert.deepEqual(applyVehicle({ lengthOff: true }, { lengthM: 7.4 }), { lengthOff: true });
  assert.deepEqual(applyVehicle({}, {}), {});
});
