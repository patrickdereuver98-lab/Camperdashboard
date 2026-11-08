"use client";

import { useId } from "react";

/**
 * Keuzerondjes als vlakken: echte `<input type="radio">` (pijltjestoetsen, één tabstop per groep, schermlezers zeggen
 * "keuzerondje 2 van 3"), met het vlak als label. Review november R31: de eigen knoppen met role="radio" hadden geen
 * pijltjestoetsen.
 *
 * `clearable`: nog een keer tikken op de gekozen optie haalt de keuze weg (waarde ""), zoals de oude knoppen deden.
 */
export function RadioCards<T extends string>({
  label,
  labelId,
  options,
  value,
  onChange,
  name,
  clearable = false,
  className = "grid gap-2",
  cardClassName = "min-h-12 px-4 py-2",
  labelClassName = "mb-1.5 block font-semibold",
  groupClassName,
  errorId,
}: {
  label: React.ReactNode;
  /** Vast id voor het label, als er van buiten naar verwezen wordt */
  labelId?: string;
  options: readonly (readonly [T, string])[];
  value: T | "";
  onChange: (v: T | "") => void;
  /** Naam van de groep; zonder naam een eigen, unieke (de waarde gaat dan niet mee in FormData) */
  name?: string;
  clearable?: boolean;
  className?: string;
  cardClassName?: string;
  labelClassName?: string;
  /** Opmaak van de groep zelf, bijvoorbeeld label en knoppen naast elkaar */
  groupClassName?: string;
  /** id van de foutmelding bij deze groep: zet aria-invalid en koppelt de melding (WCAG 3.3.1) */
  errorId?: string;
}) {
  const auto = useId();
  const id = labelId ?? `${auto}-label`;
  const group = name ?? `${auto}-keuze`;
  return (
    <div
      role="radiogroup"
      aria-labelledby={id}
      aria-invalid={errorId ? true : undefined}
      aria-describedby={errorId}
      className={groupClassName}
    >
      <span id={id} className={labelClassName}>
        {label}
      </span>
      <div className={className}>
        {options.map(([v, l]) => (
          <label key={v || "leeg"} className="relative flex cursor-pointer">
            <input
              type="radio"
              name={group}
              value={v}
              checked={value === v}
              onChange={() => onChange(v)}
              onClick={() => {
                if (clearable && value === v) onChange("");
              }}
              className="peer absolute inset-0 z-10 m-0 h-full w-full cursor-pointer appearance-none opacity-0"
            />
            <span
              className={`flex w-full items-center rounded-lg border border-line bg-surface text-left font-semibold transition-colors peer-checked:border-forest peer-checked:bg-forest-tint peer-checked:text-forest peer-focus-visible:outline-3 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-forest ${cardClassName}`}
            >
              {l}
            </span>
          </label>
        ))}
      </div>
    </div>
  );
}
