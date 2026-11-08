"use client";

import { RadioCards } from "./radio-cards";

export type DepartureAnswer = "" | "vrij" | "per24" | "vast";

const CHOICES: [Exclude<DepartureAnswer, "">, string][] = [
  ["vrij", "Geen vaste tijd, je vertrekt wanneer je wilt"],
  ["per24", "24 uur na aankomst"],
  ["vast", "Op een vaste tijd"],
];

/** "Hoe laat moet je hier weg?" Gebruikt bij Doe mee, bij een review en in het eigenaarsformulier. Bij "vast" volgt een tijdveld `checkout`. */
export function DepartureRadios({
  id,
  label,
  value,
  onChange,
  fieldClass,
  checkoutDefault = "11:00",
  errorId,
}: {
  id: string;
  label: string;
  value: DepartureAnswer;
  onChange: (v: DepartureAnswer) => void;
  fieldClass: string;
  /** Beginwaarde van het tijdveld, bijvoorbeeld uit een bewaard concept */
  checkoutDefault?: string;
  /** id van een foutmelding over deze vraag */
  errorId?: string;
}) {
  return (
    <div>
      {/* Nog een keer tikken haalt de keuze weg */}
      <RadioCards label={label} labelId={id} options={CHOICES} value={value} onChange={onChange} clearable errorId={errorId} />
      {value === "vast" && (
        <label className="mt-3 block">
          <span className="mb-1.5 block font-semibold">Uiterlijk weg om</span>
          <input name="checkout" type="time" step={900} defaultValue={checkoutDefault} required className={`${fieldClass} max-w-40`} />
        </label>
      )}
    </div>
  );
}
