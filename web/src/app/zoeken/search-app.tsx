"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import {
  activeFilterCount,
  applyFilters,
  EMPTY_FILTERS,
  FACETS,
  filtersFromParams,
  filtersToParams,
  type Filters,
} from "@/lib/filters";
import { usePlaces } from "@/lib/client-data";
import { useMediaQuery } from "@/lib/use-media";
import type { Place } from "@/lib/types";
import { SearchBox } from "@/components/search-box";
import { FilterBar } from "@/components/filter-bar";
import { CardSkeleton, PlaceCard } from "@/components/place-bits";
import { PlaceMap } from "@/components/place-map";
import { Landscape } from "@/components/landscape";
import { Icon } from "@/components/icons";

const PAGE = 24;
const nf = new Intl.NumberFormat("nl-NL");

export function SearchApp() {
  const router = useRouter();
  const params = useSearchParams();
  const filters = useMemo(() => filtersFromParams(params), [params]);
  const paramKey = filtersToParams(filters).toString();
  const { places, error } = usePlaces();
  const results = useMemo(
    () => (places ? applyFilters(places, filters) : null),
    [places, filters],
  );
  const [hovered, setHovered] = useState<string | null>(null);
  const [mapOpen, setMapOpen] = useState(false);
  const wide = useMediaQuery("(min-width: 1024px)");

  function update(next: Filters) {
    const qs = filtersToParams(next).toString();
    router.replace(qs ? `/zoeken?${qs}` : "/zoeken", { scroll: false });
  }

  function focusCard(slug: string) {
    setHovered(slug);
    document
      .querySelector(`[data-slug="${CSS.escape(slug)}"]`)
      ?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  const map = results && (
    <PlaceMap
      places={results}
      highlight={hovered}
      onSelect={focusCard}
      fitKey={paramKey}
      className="h-full w-full"
    />
  );

  return (
    <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)] xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <section className="min-w-0 px-4 pt-5 pb-24 sm:px-6 lg:pb-10">
        <div className="space-y-4">
          <SearchBox
            key={filters.q}
            size="md"
            initial={filters.q}
            base={filters}
            onSearch={update}
          />
          <FilterBar filters={filters} onChange={update} />
        </div>

        <div className="mt-6 mb-4 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
          <h1 className="font-display text-2xl font-semibold text-ink">
            {results ? (
              <>
                {nf.format(results.length)}{" "}
                {results.length === 1 ? "plek" : "plekken"}
                <span className="text-ink-soft font-normal">
                  {" "}
                  {filters.province ? `in ${filters.province}` : "in Nederland"}
                </span>
              </>
            ) : (
              "Plekken laden…"
            )}
          </h1>
          <ActiveFilters filters={filters} onChange={update} />
        </div>

        {error && (
          <p className="rounded-2xl border border-line bg-surface p-6 text-ink-soft">
            De plekken konden niet worden geladen. Ververs de pagina om het
            opnieuw te proberen.
          </p>
        )}
        {!results && !error && (
          <div className="space-y-3">
            {Array.from({ length: 5 }, (_, i) => (
              <CardSkeleton key={i} />
            ))}
          </div>
        )}
        {results && results.length === 0 && (
          <NoResults filters={filters} onChange={update} />
        )}
        {results && results.length > 0 && (
          <ResultList
            key={paramKey}
            results={results}
            hovered={hovered}
            onHover={setHovered}
          />
        )}
      </section>

      {/* Desktop: kaart rechts, plakt onder de header */}
      {wide && (
        <aside className="sticky top-16 h-[calc(100dvh-4rem)] border-l border-line">
          {map}
        </aside>
      )}

      {/* Mobiel: kaart als volledig scherm */}
      {!wide && (
        <>
          {mapOpen && (
            <div className="fixed inset-x-0 top-16 bottom-[calc(64px+env(safe-area-inset-bottom))] z-30">
              {map}
            </div>
          )}
          <button
            type="button"
            onClick={() => setMapOpen((o) => !o)}
            className="fixed bottom-[calc(80px+env(safe-area-inset-bottom))] left-1/2 z-30 flex -translate-x-1/2 items-center gap-2 rounded-full bg-ink px-5 py-3 text-sm font-semibold text-paper shadow-lift"
          >
            <Icon name={mapOpen ? "list" : "map"} size={17} />
            {mapOpen ? "Lijst" : "Kaart"}
          </button>
        </>
      )}
    </div>
  );
}

function ResultList({
  results,
  hovered,
  onHover,
}: {
  results: Place[];
  hovered: string | null;
  onHover: (slug: string | null) => void;
}) {
  const [limit, setLimit] = useState(PAGE);
  return (
    <>
      <ul className="space-y-3">
        {results.slice(0, limit).map((p) => (
          <li key={p.slug}>
            <PlaceCard
              place={p}
              active={hovered === p.slug}
              onHover={onHover}
            />
          </li>
        ))}
      </ul>
      {limit < results.length && (
        <div className="mt-6 flex flex-col items-center gap-2">
          <button
            type="button"
            onClick={() => setLimit((l) => l + PAGE)}
            className="rounded-full border border-line bg-surface px-6 py-3 text-sm font-semibold text-ink shadow-card transition hover:border-forest hover:text-forest"
          >
            Meer plekken laden
          </button>
          <p className="text-sm text-muted">
            {nf.format(limit)} van {nf.format(results.length)} getoond
          </p>
        </div>
      )}
    </>
  );
}

function ActiveFilters({
  filters,
  onChange,
}: {
  filters: Filters;
  onChange: (f: Filters) => void;
}) {
  const count = activeFilterCount(filters) + (filters.q ? 1 : 0);
  if (!count) return null;
  return (
    <button
      type="button"
      onClick={() => onChange({ ...EMPTY_FILTERS, sort: filters.sort })}
      className="flex items-center gap-1 text-sm font-medium text-forest hover:underline"
    >
      <Icon name="x" size={14} />
      Wis {count === 1 ? "filter" : `${count} filters`}
    </button>
  );
}

function NoResults({
  filters,
  onChange,
}: {
  filters: Filters;
  onChange: (f: Filters) => void;
}) {
  const loosen: { label: string; next: Filters }[] = [];
  if (filters.q)
    loosen.push({
      label: `Zonder “${filters.q}”`,
      next: { ...filters, q: "" },
    });
  if (filters.province)
    loosen.push({
      label: "In heel Nederland",
      next: { ...filters, province: undefined },
    });
  for (const f of FACETS)
    if (filters[f.key])
      loosen.push({
        label: `Zonder “${f.label.toLowerCase()}”`,
        next: { ...filters, [f.key]: false },
      });

  return (
    <div className="overflow-hidden rounded-3xl border border-line bg-surface text-center">
      <Landscape seed="leeg" variant={3} className="h-40 w-full" />
      <div className="p-6 sm:p-8">
        <h2 className="font-display text-xl font-semibold text-ink">
          Hier is (nog) geen plek gevonden
        </h2>
        <p className="mx-auto mt-2 max-w-md text-ink-soft">
          Veel plekken hebben nog niet alle informatie. Met minder filters vind
          je vaak wel iets in de buurt.
        </p>
        {loosen.length > 0 && (
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            {loosen.map((l) => (
              <button
                key={l.label}
                type="button"
                onClick={() => onChange(l.next)}
                className="rounded-full border border-line px-4 py-2 text-sm font-medium text-ink-soft transition hover:border-forest hover:text-forest"
              >
                {l.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
