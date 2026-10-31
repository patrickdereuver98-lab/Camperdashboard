"use client";

import { useEffect, useRef } from "react";
import { Icon } from "./icons";
import { Sign } from "./sign";
import { requestMyLocation, useMyLocation } from "@/lib/my-location";
import type { Filters } from "@/lib/search";
import { quickChips, type QuickChipKey } from "@/lib/quick-chips";

/**
 * Snelle filters boven de resultaten (redesign 30 oktober 2026, UX-audit stap 3): de keuzes die een camperaar onderweg
 * het vaakst wil, met één tik aan of uit. De rest staat in de filtersheet. Vervangt de tabbladen voor de vertrekregel:
 * "Zonder vertrektijd" is de kernbelofte en daarom de enige gekleurde chip (bosgroen = geen vaste vertrektijd).
 */

export function QuickChips({ filters, onChange }: { filters: Filters; onChange: (f: Filters) => void }) {
  const loc = useMyLocation();
  // Dichtbij zonder bekende locatie: eerst om de locatie vragen, daarna de filter zetten
  const waiting = useRef(false);
  useEffect(() => {
    if (!waiting.current) return;
    if (loc.status === "ready" && loc.pos) {
      waiting.current = false;
      onChange({ ...filters, where: "Mijn locatie", center: loc.pos, province: undefined, sort: "afstand" });
    } else if (loc.status === "denied" || loc.status === "unavailable") waiting.current = false;
  }, [loc, filters, onChange]);

  const chips = quickChips(filters, loc.pos);
  const icon: Partial<Record<QuickChipKey, React.ReactNode>> = {
    dichtbij: <Icon name="locate" size={17} />,
    vrij: <Sign name="clock" size={18} state="on" />,
  };
  return (
    <div role="group" aria-label="Snel filteren" className="no-scrollbar -mx-3 flex gap-2 overflow-x-auto px-3 py-1 sm:mx-0 sm:flex-wrap sm:px-0">
      {chips.map((c) => {
        const locating = c.key === "dichtbij" && !c.on && loc.status === "locating";
        const off = c.key === "dichtbij" && !c.on && loc.status === "denied";
        return (
          <button
            key={c.key}
            type="button"
            aria-pressed={c.on}
            disabled={locating || off}
            title={off ? "Locatie staat uit in je browser" : undefined}
            onClick={() => {
              if (c.key === "dichtbij" && !c.on && !loc.pos) {
                waiting.current = true;
                requestMyLocation();
                return;
              }
              onChange(c.toggle());
            }}
            className={`flex h-11 min-w-11 shrink-0 items-center justify-center gap-1.5 rounded-md border px-3 text-sm font-semibold whitespace-nowrap transition-colors duration-150 disabled:opacity-60 ${
              c.on
                ? "border-forest bg-forest text-on-forest"
                : c.brand
                  ? "border-forest bg-forest-tint text-forest"
                  : "border-line bg-surface text-ink-2 hover:border-ink-2/40 hover:text-ink"
            }`}
          >
            {icon[c.key]}
            {locating ? "Locatie zoeken…" : c.label}
            {c.on && <Icon name="check" size={15} />}
          </button>
        );
      })}
    </div>
  );
}
