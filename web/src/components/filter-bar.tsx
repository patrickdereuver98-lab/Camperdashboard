"use client";

import { FACETS, type Filters, type SortKey } from "@/lib/filters";
import { PROVINCES } from "@/lib/types";
import { Icon, type IconName } from "./icons";

const FACET_ICONS: Record<string, IconName> = {
  free: "euro",
  power: "bolt",
  dogs: "paw",
  water: "waves",
};

const chip =
  "flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-2 text-sm font-medium transition";
const chipOff =
  "border-line bg-surface text-ink-soft hover:border-forest hover:text-forest";
const chipOn = "border-forest bg-forest text-on-forest";

export function FilterBar({
  filters,
  onChange,
  showSort = true,
  showProvince = true,
}: {
  filters: Filters;
  onChange: (f: Filters) => void;
  showSort?: boolean;
  showProvince?: boolean;
}) {
  return (
    <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:px-0">
      {showProvince && (
        <label
          className={`${chip} relative ${filters.province ? chipOn : chipOff} pr-8`}
        >
          <Icon name="pin" size={15} />
          <span className="sr-only">Provincie</span>
          <select
            value={filters.province ?? ""}
            onChange={(e) =>
              onChange({ ...filters, province: e.target.value || undefined })
            }
            className="appearance-none bg-transparent focus:outline-none [&>option]:bg-surface [&>option]:text-ink"
          >
            <option value="">Heel Nederland</option>
            {PROVINCES.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
          <Icon
            name="chevronDown"
            size={14}
            className="pointer-events-none absolute right-3"
          />
        </label>
      )}

      {FACETS.map((f) => (
        <button
          key={f.key}
          type="button"
          aria-pressed={filters[f.key]}
          onClick={() => onChange({ ...filters, [f.key]: !filters[f.key] })}
          className={`${chip} ${filters[f.key] ? chipOn : chipOff}`}
        >
          <Icon
            name={filters[f.key] ? "check" : FACET_ICONS[f.key]}
            size={15}
          />
          {f.label}
        </button>
      ))}

      {showSort && (
        <label className={`${chip} ${chipOff} relative pr-8 sm:ml-auto`}>
          <span className="text-muted">Sorteer:</span>
          <select
            value={filters.sort}
            onChange={(e) =>
              onChange({ ...filters, sort: e.target.value as SortKey })
            }
            className="appearance-none bg-transparent text-ink focus:outline-none [&>option]:bg-surface"
          >
            <option value="info">Meeste info</option>
            <option value="naam">Naam (A–Z)</option>
          </select>
          <Icon
            name="chevronDown"
            size={14}
            className="pointer-events-none absolute right-3"
          />
        </label>
      )}
    </div>
  );
}
