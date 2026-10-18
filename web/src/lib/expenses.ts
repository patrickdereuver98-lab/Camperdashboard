export type ExpenseCategory = "overnachting" | "brandstof" | "boodschappen" | "eten" | "tol" | "overig";

export const CATEGORIES: { key: ExpenseCategory; label: string }[] = [
  { key: "overnachting", label: "Overnachting" },
  { key: "brandstof", label: "Brandstof" },
  { key: "boodschappen", label: "Boodschappen" },
  { key: "eten", label: "Uit eten" },
  { key: "tol", label: "Tol en parkeren" },
  { key: "overig", label: "Overig" },
];

export interface Expense {
  id: string;
  /** yyyy-mm-dd */
  date: string;
  category: ExpenseCategory;
  amountEur: number;
  /** Alleen bij brandstof: getankte liters (of kWh) */
  liters?: number;
  /** Plek uit Mijn reis waar het bij hoort */
  placeSlug?: string;
  note?: string;
}

const CAT_KEYS = CATEGORIES.map((c) => c.key);
const round2 = (n: number) => Math.round(n * 100) / 100;

/** Alleen geldige posten; de rest valt weg. Bedragen in euro's met hoogstens 2 decimalen. */
export function cleanExpense(v: unknown): Expense | null {
  const e = (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
  const amount = Number(String(e.amountEur ?? "").replace(",", "."));
  if (typeof e.id !== "string" || !/^[\w-]{6,64}$/.test(e.id)) return null;
  if (typeof e.date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(e.date)) return null;
  if (!CAT_KEYS.includes(e.category as ExpenseCategory)) return null;
  if (!Number.isFinite(amount) || amount <= 0 || amount > 10000) return null;
  const out: Expense = { id: e.id, date: e.date, category: e.category as ExpenseCategory, amountEur: round2(amount) };
  const liters = Number(String(e.liters ?? "").replace(",", "."));
  if (out.category === "brandstof" && e.liters !== undefined && e.liters !== "" && Number.isFinite(liters) && liters > 0 && liters < 1000) out.liters = round2(liters);
  if (typeof e.placeSlug === "string" && /^[a-z0-9-]{1,120}$/.test(e.placeSlug)) out.placeSlug = e.placeSlug;
  if (typeof e.note === "string" && e.note.trim()) out.note = e.note.trim().slice(0, 120);
  return out;
}

export function cleanExpenses(v: unknown): Expense[] {
  return (Array.isArray(v) ? v : []).map(cleanExpense).filter((e): e is Expense => !!e);
}

/** Toestel en account samenvoegen: op id, het toestel wint; nieuwste datum bovenaan; max. 1000 */
export function mergeExpenses(local: Expense[], remote: unknown): Expense[] {
  const seen = new Map<string, Expense>();
  for (const e of [...cleanExpenses(local), ...cleanExpenses(remote)]) if (!seen.has(e.id)) seen.set(e.id, e);
  return [...seen.values()].sort((a, b) => b.date.localeCompare(a.date) || a.id.localeCompare(b.id)).slice(0, 1000);
}

export type ExpenseSummary = {
  total: number;
  byCategory: Record<ExpenseCategory, number>;
  /** Gemiddelde prijs per liter, alleen als er tankbeurten met liters zijn */
  fuelPricePerLiter?: number;
  liters: number;
  days: number;
  perDay?: number;
};

export function summarize(expenses: Expense[]): ExpenseSummary {
  const byCategory = Object.fromEntries(CAT_KEYS.map((k) => [k, 0])) as Record<ExpenseCategory, number>;
  let total = 0;
  let liters = 0;
  let fuelWithLiters = 0;
  const days = new Set<string>();
  for (const e of expenses) {
    byCategory[e.category] = round2(byCategory[e.category] + e.amountEur);
    total += e.amountEur;
    days.add(e.date);
    if (e.category === "brandstof" && e.liters) {
      liters += e.liters;
      fuelWithLiters += e.amountEur;
    }
  }
  return {
    total: round2(total),
    byCategory,
    liters: round2(liters),
    fuelPricePerLiter: liters > 0 ? Math.round((fuelWithLiters / liters) * 1000) / 1000 : undefined,
    days: days.size,
    perDay: days.size ? round2(total / days.size) : undefined,
  };
}

/** Echt uitgegeven tegenover de begroting van Mijn reis (alleen de soorten die de begroting kent) */
export function versusBudget(s: ExpenseSummary, budget: { stay: number; fuel: number | null; tax: number }) {
  return [
    { label: "Overnachtingen", spent: s.byCategory.overnachting, planned: round2(budget.stay + budget.tax) },
    { label: "Brandstof", spent: s.byCategory.brandstof, planned: budget.fuel === null ? null : round2(budget.fuel) },
  ];
}
