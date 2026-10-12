"use client";

import Link from "next/link";
import { useId, useState } from "react";
import { motion } from "motion/react";
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
    <div className="rounded-[1.75rem] bg-surface p-4 shadow-float ring-[3px] ring-ember sm:p-5">
      <DestinationSearch variant="hero" base={{ ...DEFAULT_FILTERS, departure }}>
        <fieldset className="min-w-0 lg:w-[23rem]">
          <legend id={`${id}-v`} className="mb-1.5 block text-sm font-semibold text-ink-2">
            Vertrekken
          </legend>
          <div className="grid h-14 grid-cols-[auto_1fr_auto] gap-1 rounded-xl bg-paper p-1 shadow-[inset_0_1px_3px_rgb(0_0_0/0.06)] ring-2 ring-line">
            {CHOICES.map((c) => {
              const on = departure === c.value;
              return (
                <button
                  key={c.label}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setDeparture(c.value)}
                  className={`relative flex items-center justify-center gap-1.5 rounded-lg px-2 text-[15px] font-semibold whitespace-nowrap transition-colors duration-200 sm:px-3 ${
                    on ? "text-on-forest" : "text-ink-2 hover:text-ink"
                  }`}
                >
                  {on && (
                    <motion.span
                      layoutId={`${id}-keuze`}
                      transition={{ type: "spring", stiffness: 520, damping: 40 }}
                      className="absolute inset-0 rounded-lg bg-forest shadow-[0_2px_6px_-2px_rgb(20_40_28/0.5)]"
                    />
                  )}
                  {c.value && <Icon name="clock" size={16} className={`relative hidden sm:block ${on ? "" : "text-forest"}`} />}
                  <span className="relative">{c.label}</span>
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
