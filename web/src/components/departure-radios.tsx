"use client";

export type DepartureAnswer = "" | "vrij" | "per24" | "vast";

const CHOICES: [Exclude<DepartureAnswer, "">, string][] = [
  ["vrij", "Geen vaste tijd, je vertrekt wanneer je wilt"],
  ["per24", "24 uur na aankomst"],
  ["vast", "Op een vaste tijd"],
];

/** "Hoe laat moet je hier weg?" Gebruikt bij Doe mee en bij een review. Bij "vast" volgt een tijdveld `checkout`. */
export function DepartureRadios({
  id,
  label,
  value,
  onChange,
  fieldClass,
}: {
  id: string;
  label: string;
  value: DepartureAnswer;
  onChange: (v: DepartureAnswer) => void;
  fieldClass: string;
}) {
  return (
    <div role="radiogroup" aria-labelledby={id}>
      <span id={id} className="mb-1.5 block font-semibold">
        {label}
      </span>
      <div className="grid gap-2">
        {CHOICES.map(([v, l]) => (
          <button
            key={v}
            type="button"
            role="radio"
            aria-checked={value === v}
            // Nog een keer tikken haalt de keuze weg
            onClick={() => onChange(value === v ? "" : v)}
            className="min-h-12 rounded-xl border-2 border-line px-4 py-2 text-left font-semibold aria-checked:border-forest aria-checked:bg-forest-tint aria-checked:text-forest"
          >
            {l}
          </button>
        ))}
      </div>
      {value === "vast" && (
        <label className="mt-3 block">
          <span className="mb-1.5 block font-semibold">Uiterlijk weg om</span>
          <input name="checkout" type="time" step={900} defaultValue="11:00" required className={`${fieldClass} max-w-40`} />
        </label>
      )}
    </div>
  );
}
