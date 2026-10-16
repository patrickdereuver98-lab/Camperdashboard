import { strict as assert } from "node:assert";
import { test } from "node:test";
import { cleanExpense, mergeExpenses, summarize, versusBudget } from "../src/lib/expenses.ts";

const e = (id: string, extra: Record<string, unknown> = {}) => ({ id: `exp-${id}-test`, date: "2026-10-12", category: "overig", amountEur: 10, ...extra });

test("cleanExpense: geldige post, komma als decimaal, liters alleen bij brandstof", () => {
  assert.deepEqual(cleanExpense(e("1", { category: "brandstof", amountEur: "84,30", liters: "45,2", placeSlug: "de-wei", note: "  Shell A28 " })), {
    id: "exp-1-test", date: "2026-10-12", category: "brandstof", amountEur: 84.3, liters: 45.2, placeSlug: "de-wei", note: "Shell A28",
  });
  assert.equal(cleanExpense(e("2", { liters: 40 }))!.liters, undefined);
});

test("cleanExpense weigert rommel", () => {
  for (const bad of [null, e("3", { amountEur: 0 }), e("4", { amountEur: -5 }), e("5", { category: "casino" }), e("6", { date: "12-10-2026" }), { ...e("7"), id: "x" }]) {
    assert.equal(cleanExpense(bad), null, JSON.stringify(bad));
  }
});

test("mergeExpenses: op id, toestel wint, nieuwste eerst", () => {
  const merged = mergeExpenses(
    [cleanExpense(e("a", { amountEur: 20, date: "2026-10-10" }))!],
    [e("a", { amountEur: 99 }), e("b", { date: "2026-10-11" }), "rommel"],
  );
  assert.deepEqual(merged.map((x) => [x.id, x.amountEur]), [["exp-b-test", 10], ["exp-a-test", 20]]);
});

test("summarize: totalen, literprijs en per dag", () => {
  const s = summarize([
    e("1", { category: "brandstof", amountEur: 90, liters: 50 }),
    e("2", { category: "brandstof", amountEur: 30 }),
    e("3", { category: "overnachting", amountEur: 22.5, date: "2026-10-13" }),
  ].map((x) => cleanExpense(x)!));
  assert.equal(s.total, 142.5);
  assert.equal(s.byCategory.brandstof, 120);
  assert.equal(s.fuelPricePerLiter, 1.8);
  assert.equal(s.liters, 50);
  assert.equal(s.days, 2);
  assert.equal(s.perDay, 71.25);
  assert.equal(summarize([]).fuelPricePerLiter, undefined);
});

test("versusBudget: overnachting telt toeristenbelasting mee, brandstof onbekend blijft onbekend", () => {
  const s = summarize([cleanExpense(e("1", { category: "overnachting", amountEur: 40 }))!]);
  assert.deepEqual(versusBudget(s, { stay: 50, fuel: null, tax: 6 }), [
    { label: "Overnachtingen", spent: 40, planned: 56 },
    { label: "Brandstof", spent: 0, planned: null },
  ]);
});
