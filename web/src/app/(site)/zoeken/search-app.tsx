"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { applyFilters, filtersToQuery, parseFilters, refinementCount, type Filters, type SortKey } from "@/lib/search";
import { usePlaces } from "@/lib/store";
import { useMediaQuery } from "@/lib/use-media";
import { pluralize } from "@/lib/format";
import { DestinationSearch } from "@/components/destination-search";
import { FilterSheet } from "@/components/filter-sheet";
import { CardSkeleton, PlaceCard } from "@/components/place-ui";
import { PlaceMap } from "@/components/place-map";
import { Icon } from "@/components/icons";
import { FACILITIES } from "@/lib/search";
import { KIND_LABEL } from "@/lib/types";

const PAGE = 20;

const SORTS: { key: SortKey; label: string; needsCenter?: boolean }[] = [
  { key: "aanbevolen", label: "Aanbevolen" },
  { key: "afstand", label: "Afstand", needsCenter: true },
  { key: "prijs", label: "Laagste prijs" },
  { key: "score", label: "Beste score" },
];

/** Verwijderbare chips voor elke actieve verfijning (Baymard: gekozen filters zichtbaar houden) */
function activeChips(f: Filters): { label: string; without: Filters }[] {
  const chips: { label: string; without: Filters }[] = [];
  for (const fac of FACILITIES)
    if (f.facilities.includes(fac.key)) chips.push({ label: fac.label, without: { ...f, facilities: f.facilities.filter((x) => x !== fac.key) } });
  for (const k of f.kinds) chips.push({ label: KIND_LABEL[k], without: { ...f, kinds: f.kinds.filter((x) => x !== k) } });
  if (f.free) chips.push({ label: "Gratis", without: { ...f, free: false } });
  if (f.maxPrice) chips.push({ label: `Tot € ${f.maxPrice}`, without: { ...f, maxPrice: undefined } });
  if (f.minLength) chips.push({ label: `Camper ${f.minLength} m`, without: { ...f, minLength: undefined } });
  if (f.openNow) chips.push({ label: "Nu open", without: { ...f, openNow: false } });
  if (f.minScore) chips.push({ label: `Score ${f.minScore}+`, without: { ...f, minScore: undefined } });
  return chips;
}

export function SearchApp() {
  const router = useRouter();
  const params = useSearchParams();
  const filters = useMemo(() => parseFilters(params), [params]);
  const key = filtersToQuery(filters);
  const { data: places, error } = usePlaces();
  const results = useMemo(() => (places ? applyFilters(places, filters) : null), [places, filters]);
  const [hovered, setHovered] = useState<string | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [mapOpen, setMapOpen] = useState(false);
  const wide = useMediaQuery("(min-width: 1024px)");

  const update = (f: Filters) => {
    const q = filtersToQuery(f);
    router.replace(q ? `/zoeken?${q}` : "/zoeken", { scroll: false });
  };

  const focusCard = (slug: string) => {
    setHovered(slug);
    if (wide) document.querySelector(`[data-slug="${CSS.escape(slug)}"]`)?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  const count = refinementCount(filters);
  const chips = activeChips(filters);
  const heading = filters.where ?? filters.province ?? "Nederland";

  const map = results && (
    <PlaceMap
      places={results.slice(0, 600).map((r) => r.place)}
      highlight={hovered}
      onSelect={focusCard}
      fitKey={key}
      user={filters.where === "Mijn locatie" ? filters.center : null}
      className="h-full w-full"
    />
  );

  return (
    <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,0.85fr)]">
      <div className="min-w-0">
        {/* Zoekbalk en filters, plakt op mobiel onder de header */}
        <div className="sticky top-16 z-30 border-b border-line bg-surface px-3 pt-3 pb-3 sm:px-6 lg:static lg:border-0 lg:bg-transparent lg:pt-6">
          <DestinationSearch key={filters.where ?? ""} variant="bar" base={filters} initial={filters.where ?? filters.province ?? ""} onPick={update} />
          <div className="mt-3 flex items-center gap-2">
            <button
              type="button"
              onClick={() => setFiltersOpen(true)}
              className="flex h-11 items-center gap-2 rounded-xl border-2 border-line bg-surface px-4 font-semibold hover:border-road"
            >
              <Icon name="sliders" size={19} />
              Filters
              {count > 0 && (
                <span className="grid h-6 min-w-6 place-items-center rounded-full bg-road px-1.5 text-sm text-on-road">{count}</span>
              )}
            </button>
            <label className="relative flex h-11 items-center rounded-xl border-2 border-line bg-surface pr-9 pl-3 font-semibold hover:border-road">
              <span className="sr-only">Sorteren</span>
              <Icon name="sort" size={18} className="mr-2 text-muted" />
              <select
                value={filters.sort}
                onChange={(e) => update({ ...filters, sort: e.target.value as SortKey })}
                className="appearance-none bg-transparent focus:outline-none"
              >
                {SORTS.filter((s) => !s.needsCenter || filters.center).map((s) => (
                  <option key={s.key} value={s.key}>
                    {s.label}
                  </option>
                ))}
              </select>
              <Icon name="chevronDown" size={16} className="pointer-events-none absolute right-3" />
            </label>
            {!wide && (
              <button
                type="button"
                onClick={() => setMapOpen((o) => !o)}
                aria-pressed={mapOpen}
                className="ml-auto flex h-11 items-center gap-2 rounded-xl border-2 border-line bg-surface px-4 font-semibold aria-pressed:border-road aria-pressed:bg-road aria-pressed:text-on-road"
              >
                <Icon name={mapOpen ? "list" : "map"} size={19} />
                {mapOpen ? "Lijst" : "Kaart"}
              </button>
            )}
          </div>
          {chips.length > 0 && (
            <ul className="no-scrollbar -mx-3 mt-3 flex gap-2 overflow-x-auto px-3 sm:mx-0 sm:flex-wrap sm:px-0">
              {chips.map((c) => (
                <li key={c.label} className="shrink-0">
                  <button
                    type="button"
                    onClick={() => update(c.without)}
                    className="flex h-9 items-center gap-1.5 rounded-full bg-road-tint pr-2.5 pl-3.5 text-sm font-semibold text-road"
                    aria-label={`Filter ${c.label} verwijderen`}
                  >
                    {c.label}
                    <Icon name="x" size={15} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Mobiele kaart */}
        {!wide && mapOpen && <div className="h-[calc(100dvh-12rem)]">{map}</div>}

        <section className={`px-3 pt-4 pb-8 sm:px-6 ${!wide && mapOpen ? "hidden" : ""}`} aria-live="polite">
          <h1 className="font-sign text-2xl font-bold">
            {results ? pluralize(results.length, "plek", "plekken") : "Plekken laden"}{" "}
            <span className="font-semibold text-muted">
              {filters.center ? `binnen ${filters.radiusKm} km van ${heading}` : `in ${heading}`}
            </span>
          </h1>

          {error && (
            <p className="mt-4 rounded-2xl bg-alert-tint p-5 text-alert">
              De plekken konden niet worden geladen. Controleer je verbinding en ververs de pagina.
            </p>
          )}
          {!results && !error && (
            <div className="mt-4 space-y-3">
              {[0, 1, 2, 3].map((i) => (
                <CardSkeleton key={i} />
              ))}
            </div>
          )}
          {results && results.length === 0 && <Empty filters={filters} onChange={update} />}
          {results && results.length > 0 && <Results key={key} results={results} hovered={hovered} onHover={setHovered} />}
        </section>
      </div>

      {wide && <aside className="sticky top-16 h-[calc(100dvh-4rem)] border-l border-line">{map}</aside>}

      <FilterSheet open={filtersOpen} onClose={() => setFiltersOpen(false)} filters={filters} places={places} onApply={update} />
    </div>
  );
}

function Results({
  results,
  hovered,
  onHover,
}: {
  results: ReturnType<typeof applyFilters>;
  hovered: string | null;
  onHover: (s: string | null) => void;
}) {
  const [limit, setLimit] = useState(PAGE);
  return (
    <>
      <ul className="mt-4 space-y-3">
        {results.slice(0, limit).map((r) => (
          <li key={r.place.id}>
            <PlaceCard place={r.place} km={r.km} active={hovered === r.place.slug} onHover={onHover} />
          </li>
        ))}
      </ul>
      {limit < results.length && (
        <div className="mt-6 text-center">
          <button
            type="button"
            onClick={() => setLimit((l) => l + PAGE)}
            className="h-12 rounded-xl border-2 border-line bg-surface px-6 font-semibold hover:border-road"
          >
            Toon meer plekken
          </button>
          <p className="mt-2 text-sm text-muted">
            {Math.min(limit, results.length)} van {results.length} getoond
          </p>
        </div>
      )}
    </>
  );
}

function Empty({ filters, onChange }: { filters: Filters; onChange: (f: Filters) => void }) {
  const options: { label: string; next: Filters }[] = [];
  if (filters.center && filters.radiusKm < 100) options.push({ label: `Zoek binnen ${filters.radiusKm * 2} km`, next: { ...filters, radiusKm: filters.radiusKm * 2 } });
  if (refinementCount(filters) > 0)
    options.push({
      label: "Wis alle filters",
      next: { ...filters, facilities: [], kinds: [], free: false, maxPrice: undefined, minLength: undefined, openNow: false, minScore: undefined },
    });
  if (filters.province || filters.center) options.push({ label: "Zoek in heel Nederland", next: { ...filters, where: undefined, center: undefined, province: undefined } });
  return (
    <div className="mt-6 rounded-2xl bg-surface p-6 outline-1 outline-line outline">
      <h2 className="font-sign text-xl font-bold">Geen plekken die aan alles voldoen</h2>
      <p className="mt-2 text-ink-2">We tonen alleen plekken waarvan de gegevens compleet zijn. Met minder filters of een grotere afstand vind je vaak wel iets.</p>
      <div className="mt-4 flex flex-wrap gap-2">
        {options.map((o) => (
          <button
            key={o.label}
            type="button"
            onClick={() => onChange(o.next)}
            className="h-11 rounded-xl border-2 border-line px-4 font-semibold hover:border-road hover:text-road"
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}
