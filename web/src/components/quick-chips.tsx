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
      {chips.map((c) =>
        c.key === "voorzieningen" ? (
          // Geen schakelaar maar een knop die de filtersheet opent: geen aria-pressed, het aantal staat in de tekst
          <button
            key={c.key}
            type="button"
            aria-haspopup="dialog"
            onClick={onFilters}
            className="flex min-h-11 min-w-11 shrink-0 items-center justify-center gap-1.5 rounded-md border border-line bg-surface px-3 font-semibold whitespace-nowrap text-ink transition-colors duration-150 hover:border-forest"
          >
            {c.label}
            {filters.facilities.length > 0 && <span className="text-forest tabular-nums">({filters.facilities.length})</span>}
          </button>
        ) : (
          <Chip key={c.key} pressed={c.on} icon={icon[c.key]} onClick={() => onChange(c.toggle())}>
            {c.label}
          </Chip>
        ),
      )}
    </div>
  );
}
