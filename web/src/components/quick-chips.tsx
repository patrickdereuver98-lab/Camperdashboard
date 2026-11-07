"use client";

import { useEffect, useRef } from "react";
import { Icon } from "./icons";
import { Chip } from "./chip";
import { requestMyLocation, useMyLocation } from "@/lib/my-location";
import type { Filters } from "@/lib/search";
import { quickChips, type QuickChipKey } from "@/lib/quick-chips";

/**
 * Snelle filters boven de resultaten (redesign 30 oktober 2026, UX-audit stap 3): de keuzes die een camperaar onderweg
 * het vaakst wil, met één tik aan of uit. De rest staat in de filtersheet. Vervangt de tabbladen voor de vertrekregel.
 * Alle chips zien er hetzelfde uit (`Chip`, review R49): uit = rand, aan = vol bosgroen met vinkje.
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
    vrij: <Icon name="clock" size={17} />,
  };
  return (
    <div role="group" aria-label="Snel filteren" className="no-scrollbar -mx-3 flex gap-2 overflow-x-auto px-3 py-1 sm:mx-0 sm:flex-wrap sm:px-0">
      {chips.map((c) => {
        const locating = c.key === "dichtbij" && !c.on && loc.status === "locating";
        const off = c.key === "dichtbij" && !c.on && loc.status === "denied";
        return (
          <Chip
            key={c.key}
            pressed={c.on}
            icon={icon[c.key]}
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
          >
            {locating ? "Locatie zoeken…" : c.label}
          </Chip>
        );
      })}
    </div>
  );
}
