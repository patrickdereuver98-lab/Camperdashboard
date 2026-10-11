"use client";

import Link from "next/link";
import { useId, useState } from "react";
import { DEFAULT_FILTERS, type DepartureGroup } from "@/lib/search";
import { DestinationSearch } from "./destination-search";
import { Icon } from "./icons";

const CHOICES: { value?: DepartureGroup; label: string }[] = [
  { value: undefined, label: "Alle" },
  { value: "vrij", label: "Zonder vertrektijd" },
  { value: "uitslapers", label: "Uitslapers" },
];

/** Zoekkaart op de startpagina: bestemming plus de keuze voor vertrektijd (bepaalt de resultaatpagina) */
export function HomeSearch() {
  const id = useId();
  const [departure, setDeparture] = useState<DepartureGroup | undefined>(undefined);
  return (
    <div className="rounded-2xl bg-surface p-4 shadow-lift ring-[3px] ring-ember sm:p-5">
      <DestinationSearch variant="hero" base={{ ...DEFAULT_FILTERS, departure }}>
        <fieldset className="min-w-0 lg:w-[23rem]">
          <legend id={`${id}-v`} className="mb-1.5 block text-sm font-semibold text-ink-2">
            Vertrekken
          </legend>
          <div className="grid h-14 grid-cols-[auto_1fr_auto] gap-1 rounded-xl bg-paper p-1 ring-2 ring-line">
            {CHOICES.map((c) => {
              const on = departure === c.value;
              return (
                <button
                  key={c.label}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setDeparture(c.value)}
                  className={`flex items-center justify-center gap-1.5 rounded-lg px-2 text-[15px] sm:px-3 font-semibold whitespace-nowrap transition-colors ${
                    on ? "bg-forest text-on-forest shadow-sm" : "text-ink-2 hover:bg-sunken"
                  }`}
                >
                  {c.value && <Icon name="clock" size={16} className={`hidden sm:block ${on ? "" : "text-forest"}`} />}
                  {c.label}
                </button>
              );
            })}
          </div>
        </fieldset>
      </DestinationSearch>
      <Link href="/dichtbij" className="mt-3 inline-flex h-11 items-center gap-2 font-semibold text-forest hover:underline">
        <Icon name="locate" size={20} /> Of zoek plekken dichtbij mij
      </Link>
    </div>
  );
}
