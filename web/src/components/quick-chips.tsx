"use client";

import { Icon } from "./icons";
import { Chip } from "./chip";
import type { Filters } from "@/lib/search";
import { quickChips, type QuickChipKey } from "@/lib/quick-chips";

/**
 * Snelle filters boven de resultaten: hoogstens vier (UI/UX-plan 26 november 2026, T13). De rest staat in de
 * filtersheet. Alle chips zien er hetzelfde uit (`Chip`, review R49): uit = rand, aan = vol bosgroen met vinkje.
 * Voorzieningen is geen schakelaar maar opent de filtersheet.
 */
export function QuickChips({ filters, onChange, onFilters }: { filters: Filters; onChange: (f: Filters) => void; onFilters: () => void }) {
  const chips = quickChips(filters);
  const icon: Partial<Record<QuickChipKey, React.ReactNode>> = {
    vrij: <Icon name="clock" size={17} />,
  };
  return (
    <div role="group" aria-label="Snel filteren" className="no-scrollbar -mx-3 flex gap-2 overflow-x-auto px-3 py-1 sm:mx-0 sm:flex-wrap sm:px-0">
      {chips.map((c) => (
        <Chip
          key={c.key}
          pressed={c.on}
          icon={icon[c.key]}
          onClick={() => (c.key === "voorzieningen" ? onFilters() : onChange(c.toggle()))}
        >
          {c.label}
        </Chip>
      ))}
    </div>
  );
}
