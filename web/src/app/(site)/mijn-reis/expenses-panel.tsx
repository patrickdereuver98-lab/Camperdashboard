"use client";

import { useMemo, useState } from "react";
import { eur } from "@/lib/format";
import { CATEGORIES, cleanExpense, summarize, versusBudget, type ExpenseCategory } from "@/lib/expenses";
import { useExpenses } from "@/lib/store";
import { Icon } from "@/components/icons";

const LABEL = Object.fromEntries(CATEGORIES.map((c) => [c.key, c.label])) as Record<ExpenseCategory, string>;
const input = "h-11 w-full rounded-lg border-2 border-line bg-surface px-3 focus:border-forest focus:outline-none focus:ring-2 focus:ring-forest";

const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const dateLabel = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString("nl-NL", { day: "numeric", month: "short" });

/** Wat je onderweg echt uitgeeft, naast de begroting van de reis */
export function ExpensesPanel({
  stops,
  budget,
}: {
  stops: { slug: string; name: string }[];
  budget: { stay: number; fuel: number | null; tax: number };
}) {
  const { list, add, remove } = useExpenses();
  const [category, setCategory] = useState<ExpenseCategory>("overnachting");
  const [err, setErr] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const summary = useMemo(() => summarize(list), [list]);
  const compare = versusBudget(summary, budget);
  const names = useMemo(() => Object.fromEntries(stops.map((s) => [s.slug, s.name])), [stops]);

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const item = cleanExpense({
      id: crypto.randomUUID(),
      date: String(f.get("date") || "") || today(),
      category,
      amountEur: f.get("amount"),
      liters: category === "brandstof" ? f.get("liters") : undefined,
      placeSlug: String(f.get("place") || "") || undefined,
      note: f.get("note"),
    });
    if (!item) return setErr("Vul een bedrag in tussen € 0,01 en € 10.000.");
    setErr(null);
    add(item);
    e.currentTarget.reset();
    setOpen(false);
  }

  return (
    <section aria-labelledby="uitgaven" className="rounded-2xl bg-surface p-5 shadow-low">
      <div className="flex items-center justify-between gap-3">
        <h2 id="uitgaven" className="font-display text-xl font-semibold">Uitgaven onderweg</h2>
        {!open && (
          <button
            type="button"
            onClick={() => {
              // Elke nieuwe uitgave begint bij de meest voorkomende soort, niet bij de vorige keuze
              setCategory("overnachting");
              setOpen(true);
            }}
            className="flex h-11 items-center gap-1.5 rounded-xl border-2 border-line px-3 font-semibold hover:border-forest">
            <Icon name="plus" size={18} /> Uitgave
          </button>
        )}
      </div>

      {open && (
        <form onSubmit={submit} className="mt-4 space-y-3 rounded-xl bg-sunken p-4" aria-label="Uitgave toevoegen">
          <fieldset>
            <legend className="mb-1.5 text-sm font-semibold">Waarvoor</legend>
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map((c) => (
                <button
                  key={c.key}
                  type="button"
                  aria-pressed={category === c.key}
                  onClick={() => setCategory(c.key)}
                  className="h-11 rounded-full border-2 border-line bg-surface px-3.5 text-sm font-semibold aria-pressed:border-forest aria-pressed:bg-forest-tint aria-pressed:text-forest"
                >
                  {c.label}
                </button>
              ))}
            </div>
          </fieldset>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="mb-1 block text-sm font-semibold">Bedrag in euro</span>
              <input name="amount" inputMode="decimal" required autoComplete="off" placeholder="24,50" className={input} />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-semibold">Datum</span>
              <input name="date" type="date" className={input} aria-describedby="datum-uitleg" />
              <span id="datum-uitleg" className="sr-only">Leeg laten is vandaag</span>
            </label>
            {category === "brandstof" && (
              <label className="block">
                <span className="mb-1 block text-sm font-semibold">Liters (optioneel)</span>
                <input name="liters" inputMode="decimal" autoComplete="off" placeholder="45" className={input} />
              </label>
            )}
            {stops.length > 0 && (
              <label className={`block ${category === "brandstof" ? "" : "col-span-2"}`}>
                <span className="mb-1 block text-sm font-semibold">Bij welke stop (optioneel)</span>
                <select name="place" defaultValue="" className={input}>
                  <option value="">Geen</option>
                  {stops.map((s) => (
                    <option key={s.slug} value={s.slug}>{s.name}</option>
                  ))}
                </select>
              </label>
            )}
          </div>
          <label className="block">
            <span className="mb-1 block text-sm font-semibold">Notitie (optioneel)</span>
            <input name="note" maxLength={120} autoComplete="off" className={input} />
          </label>
          {err && <p role="alert" className="rounded-lg bg-alert-tint px-3 py-2 text-alert">{err}</p>}
          <div className="flex gap-2">
            <button type="submit" className="h-12 flex-1 rounded-xl bg-forest font-semibold text-on-forest">Opslaan</button>
            <button type="button" onClick={() => setOpen(false)} className="h-12 rounded-xl px-4 font-semibold">Annuleren</button>
          </div>
        </form>
      )}

      {list.length === 0 ? (
        !open && <p className="mt-3 text-ink-2">Houd bij wat je onderweg uitgeeft. Dan zie je hoe het zich verhoudt tot je begroting.</p>
      ) : (
        <>
          <dl className="mt-4 space-y-2" data-testid="expense-summary">
            {compare.map((c) => (
              <div key={c.label} className="flex justify-between gap-3">
                <dt className="text-ink-2">{c.label}</dt>
                <dd className="text-right font-semibold">
                  {eur(c.spent)}
                  <span className="block text-sm font-normal text-muted">{c.planned === null ? "Geen begroting" : `Begroot ${eur(c.planned, true)}`}</span>
                </dd>
              </div>
            ))}
            {(["boodschappen", "eten", "tol", "overig"] as const)
              .filter((k) => summary.byCategory[k] > 0)
              .map((k) => (
                <div key={k} className="flex justify-between">
                  <dt className="text-ink-2">{LABEL[k]}</dt>
                  <dd className="font-semibold">{eur(summary.byCategory[k])}</dd>
                </div>
              ))}
            <div className="flex justify-between border-t border-line pt-2">
              <dt className="font-display text-lg font-semibold">Uitgegeven</dt>
              <dd className="font-display text-2xl font-semibold">{eur(summary.total)}</dd>
            </div>
          </dl>
          <p className="mt-2 text-sm text-muted">
            {summary.perDay !== undefined && `Gemiddeld ${eur(summary.perDay)} per dag over ${summary.days} ${summary.days === 1 ? "dag" : "dagen"}.`}
            {summary.fuelPricePerLiter !== undefined && ` Je tankte voor gemiddeld ${eur(summary.fuelPricePerLiter)} per liter.`}
          </p>

          <ul className="mt-4 divide-y divide-line">
            {list.slice(0, 50).map((x) => (
              <li key={x.id} className="flex items-center gap-3 py-2">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">
                    {LABEL[x.category]} <span className="font-normal text-muted">{dateLabel(x.date)}</span>
                  </p>
                  <p className="truncate text-sm text-ink-2">
                    {[x.placeSlug ? (names[x.placeSlug] ?? "Stop van een eerdere reis") : "", x.liters ? `${String(x.liters).replace(".", ",")} liter` : "", x.note ?? ""].filter(Boolean).join(", ")}
                  </p>
                </div>
                <span className="font-semibold">{eur(x.amountEur)}</span>
                <button type="button" onClick={() => remove(x.id)} aria-label={`${LABEL[x.category]} van ${eur(x.amountEur)} weghalen`} className="grid h-11 w-11 place-items-center rounded-xl text-ink-2 hover:bg-sunken">
                  <Icon name="trash" size={18} />
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
