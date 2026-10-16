"use client";

import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, MotionConfig, motion } from "motion/react";
import {
  applyFilters,
  DEPARTURE_PAGES,
  filtersToQuery,
  pageOf,
  parseFilters,
  refinementCount,
  relaxations,
  searchHref,
  type DeparturePage,
  type Filters,
  type SortKey,
} from "@/lib/search";
import { usePlaces, useVehicle, useViewportPlaces } from "@/lib/store";
import { applyVehicle } from "@/lib/vehicle";
import type { Bbox } from "@/lib/bbox";
import { requestMyLocation, useMyLocation } from "@/lib/my-location";
import { useMediaQuery } from "@/lib/use-media";
import { pluralize } from "@/lib/format";
import { DestinationSearch } from "@/components/destination-search";
import { FilterSheet } from "@/components/filter-sheet";
import { Legend } from "@/components/legend";
import { CardSkeleton, PlaceCard } from "@/components/place-ui";
import { PlaceMap } from "@/components/place-map";
import { Icon } from "@/components/icons";
import { FACILITIES } from "@/lib/search";
import { KIND_LABEL, type PlaceSummary } from "@/lib/types";

const PAGE = 20;

const SORTS: { key: SortKey; label: string; needsCenter?: boolean }[] = [
  { key: "aanbevolen", label: "Aanbevolen" },
  { key: "afstand", label: "Afstand", needsCenter: true },
  { key: "prijs", label: "Laagste prijs" },
  { key: "score", label: "Beste score" },
];

/** Verwijderbare chips voor elke actieve verfijning (Baymard: gekozen filters zichtbaar houden) */
function activeChips(f: Filters & { lengthFromVehicle?: boolean }): { label: string; without: Filters }[] {
  const chips: { label: string; without: Filters }[] = [];
  for (const fac of FACILITIES)
    if (f.facilities.includes(fac.key)) chips.push({ label: fac.label, without: { ...f, facilities: f.facilities.filter((x) => x !== fac.key) } });
  for (const k of f.kinds) chips.push({ label: KIND_LABEL[k], without: { ...f, kinds: f.kinds.filter((x) => x !== k) } });
  if (f.free) chips.push({ label: "Gratis", without: { ...f, free: false } });
  if (f.maxPrice) chips.push({ label: `Tot € ${f.maxPrice}`, without: { ...f, maxPrice: undefined } });
  // Uitzetten blijft uit, ook als het camperprofiel een lengte heeft (lengte=0 in het adres)
  const len = String(f.minLength).replace(".", ",");
  if (f.minLength) chips.push({ label: f.lengthFromVehicle ? `Mijn camper (${len} m)` : `Camper ${len} m`, without: { ...f, minLength: undefined, lengthOff: true } });
  if (f.openNow) chips.push({ label: "Zonder gesloten plekken", without: { ...f, openNow: false } });
  if (f.priceUnknown && (f.free || f.maxPrice)) chips.push({ label: "Ook onbekende prijs", without: { ...f, priceUnknown: false } });
  if (f.minScore) chips.push({ label: `Score ${f.minScore}+`, without: { ...f, minScore: undefined } });
  return chips;
}

/** Op een vertrekpagina ligt de groep vast via het adres; op Overige kan nog "vroeg" of "onbekend" gekozen worden */
function withPage(f: Filters, page?: DeparturePage): Filters {
  if (!page) return f;
  if (page === "overig") return { ...f, departure: f.departure && pageOf(f.departure) === "overig" ? f.departure : "overig" };
  return { ...f, departure: page };
}

export function SearchApp({ page, updated }: { page?: DeparturePage; updated?: string }) {
  const router = useRouter();
  const params = useSearchParams();
  const [vehicle] = useVehicle();
  const filters = useMemo(() => applyVehicle(withPage(parseFilters(params), page), vehicle), [params, page, vehicle]);
  const key = filtersToQuery(filters);
  const { data: places, error } = usePlaces();
  const results = useMemo(() => (places ? applyFilters(places, filters) : null), [places, filters]);
  const [hovered, setHovered] = useState<string | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [mapOpen, setMapOpen] = useState(params.get("kaart") === "1");
  const hasReviews = useMemo(() => Boolean(places?.some((p) => p.ratingCount > 0)), [places]);
  const wide = useMediaQuery("(min-width: 1024px)");
  // Kaart: alleen plekken binnen het zichtbare gebied (PostGIS-bbox), met dezelfde filters als de lijst
  const [viewport, setViewport] = useState<Bbox | null>(null);
  const viewportPlaces = useViewportPlaces(viewport);
  const mapPlaces = useMemo(
    () => (viewportPlaces ? applyFilters(viewportPlaces, filters) : (results ?? [])).map((r) => r.place),
    [viewportPlaces, results, filters],
  );
  const fitPlaces = useMemo(() => results?.map((r) => r.place), [results]);

  // Elke vertrekgroep heeft een eigen pagina; een andere groep kiezen gaat naar die pagina
  const update = (f: Filters) => router.replace(searchHref(f), { scroll: false });

  // Oude links (/zoeken?vrij=1 of ?vertrek=…) naar de juiste pagina sturen
  const misplaced = !page && filters.departure ? searchHref(filters) : null;
  useEffect(() => {
    if (misplaced) router.replace(misplaced);
  }, [misplaced, router]);

  const focusCard = (slug: string) => {
    setHovered(slug);
    if (wide) document.querySelector(`[data-slug="${CSS.escape(slug)}"]`)?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  const count = refinementCount(filters);
  const chips = activeChips(filters);
  // Een plaatsnaam in de link zonder coördinaten of provincie kennen we niet: zeg dat eerlijk in plaats van "in xyz"
  const unknownPlace = filters.where && !filters.center && !filters.province ? filters.where : undefined;
  const heading = unknownPlace ? "Nederland" : (filters.where ?? filters.province ?? "Nederland");

  const map = results && (
    <PlaceMap
      places={mapPlaces}
      fitPlaces={fitPlaces}
      onViewportChange={setViewport}
      highlight={hovered}
      onSelect={focusCard}
      fitKey={key}
      user={filters.where === "Mijn locatie" ? filters.center : null}
      onShowList={() => setMapOpen(false)}
      className="h-full w-full"
    />
  );

  return (
    <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,0.85fr)]">
      <div className="min-w-0">
        {/* Zoekbalk en filters, plakt op mobiel onder de header */}
        <DepartureTabs page={page} filters={filters} places={places} />
        <div className="sticky top-14 z-30 border-b border-line bg-surface px-3 pt-2 pb-1 sm:top-16 sm:px-6 sm:pt-3 sm:pb-3 lg:static lg:border-0 lg:bg-transparent lg:pt-4">
          <DestinationSearch key={filters.where ?? ""} variant="bar" base={filters} initial={filters.where ?? filters.province ?? ""} onPick={update} />
          {/* Mobiel: één rustige rij zoals bij Booking (filters, sorteren, kaart); groter scherm: knoppen met rand */}
          <div className="mt-1 flex min-w-0 items-center divide-x divide-line sm:mt-3 sm:gap-2 sm:divide-x-0">
            <button
              type="button"
              onClick={() => setFiltersOpen(true)}
              className="flex h-11 min-w-0 flex-1 items-center justify-center gap-1.5 text-[0.9375rem] font-semibold sm:flex-none sm:rounded-lg sm:border sm:border-line sm:bg-surface sm:px-4 sm:text-base sm:hover:border-forest"
            >
              <Icon name="sliders" size={18} />
              Filters
              {count > 0 && (
                <span className="grid h-5 min-w-5 place-items-center rounded-full bg-forest px-1 text-xs text-on-forest">{count}</span>
              )}
            </button>
            <label className="relative flex h-11 min-w-0 flex-1 items-center justify-center text-[0.9375rem] font-semibold has-[select:focus-visible]:rounded-lg has-[select:focus-visible]:outline-[3px] has-[select:focus-visible]:outline-forest sm:flex-none sm:rounded-lg sm:border sm:border-line sm:bg-surface sm:pr-9 sm:pl-3 sm:text-base sm:hover:border-forest">
              <Icon name="sort" size={17} className="mr-1.5 shrink-0 text-muted" />
              {/* Mobiel staat er alleen "Sorteren" (de keuze past niet); een stip als het niet de standaard is */}
              <span className="sm:hidden">Sorteren</span>
              {filters.sort !== "aanbevolen" && <span className="ml-1 h-2 w-2 rounded-full bg-ember sm:hidden" aria-hidden="true" />}
              <select
                aria-label="Sorteren"
                value={filters.sort}
                onChange={(e) => update({ ...filters, sort: e.target.value as SortKey })}
                className="absolute inset-0 min-w-0 appearance-none truncate bg-transparent opacity-0 focus:outline-none sm:static sm:w-full sm:opacity-100"
              >
                {SORTS.filter((s) => (!s.needsCenter || filters.center) && (s.key !== "score" || hasReviews)).map((s) => (
                  <option key={s.key} value={s.key}>
                    {s.label}
                  </option>
                ))}
              </select>
              <Icon name="chevronDown" size={16} className="pointer-events-none absolute right-3 hidden sm:block" />
            </label>
            {!wide && (
              <button
                type="button"
                onClick={() => {
                  setMapOpen((o) => !o);
                  window.scrollTo({ top: 0 });
                }}
                aria-pressed={mapOpen}
                className="flex h-11 min-w-0 flex-1 items-center justify-center gap-1.5 text-[0.9375rem] font-semibold aria-pressed:text-forest sm:flex-none sm:rounded-lg sm:border sm:border-line sm:bg-surface sm:px-4 sm:text-base"
              >
                <Icon name={mapOpen ? "list" : "map"} size={18} />
                {mapOpen ? "Lijst" : "Kaart"}
              </button>
            )}
          </div>
          {chips.length > 0 && (
            <MotionConfig reducedMotion="user">
            <ul className="no-scrollbar -mx-3 mt-1 mb-1 flex gap-2 overflow-x-auto px-3 sm:mx-0 sm:mt-3 sm:mb-0 sm:flex-wrap sm:px-0">
              <AnimatePresence initial={false}>
              {chips.map((c) => (
                <motion.li
                  key={c.label}
                  layout
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ duration: 0.16 }}
                  className="shrink-0"
                >
                  <button
                    type="button"
                    onClick={() => update(c.without)}
                    className="flex h-11 items-center gap-1.5 rounded-full bg-forest-tint pr-3 pl-4 text-sm font-semibold text-forest"
                    aria-label={`Filter ${c.label} verwijderen`}
                  >
                    {c.label}
                    <Icon name="x" size={15} />
                  </button>
                </motion.li>
              ))}
              </AnimatePresence>
            </ul>
            </MotionConfig>
          )}
        </div>

        {/* Mobiele kaart */}
        {!wide && mapOpen && <div className="animate-fade-in h-[calc(100dvh-15rem-env(safe-area-inset-bottom))] min-h-80">{map}</div>}

        <section className={`px-3 pt-3 pb-24 sm:px-6 sm:pt-4 lg:pb-8 ${!wide && mapOpen ? "hidden" : "animate-fade-in"}`} aria-live="polite">
          <h1 className="font-display text-lg leading-snug font-semibold sm:text-2xl">
            <span key={results?.length} className="animate-fade-in inline-block">
              {results ? pluralize(results.length, "plek", "plekken") : "Plekken laden"}
            </span>{" "}
            <span>{filters.center ? `binnen ${filters.radiusKm} km van ${heading}` : `in ${heading}`}</span>
          </h1>
          {unknownPlace && (
            <p role="status" className="mt-2 rounded-lg bg-sunken px-4 py-3 text-ink-2">
              We kennen geen plaats die &ldquo;{unknownPlace}&rdquo; heet. Daarom zie je alle plekken. Typ een plaats of
              provincie in het zoekveld.
            </p>
          )}
          {/* Eén regel: datum, uitleg en afstand; loopt door op een smal scherm */}
          <div className="-mb-1 flex flex-wrap items-center gap-x-4">
            {updated && <p className="text-sm text-muted">Laatste update: {updated}</p>}
            <Legend label="Uitleg icoontjes" />
            <DistanceToggle />
          </div>

          {error && (
            <div className="mt-4 rounded-xl bg-alert-tint p-5 text-alert">
              <p>De plekken konden niet worden geladen. Controleer je verbinding en probeer het opnieuw.</p>
              <button type="button" onClick={() => window.location.reload()} className="mt-3 min-h-11 rounded-lg bg-surface px-4 font-semibold text-ink shadow-low">
                Opnieuw proberen
              </button>
            </div>
          )}
          {!results && !error && (
            <div className="mt-4 space-y-3">
              {[0, 1, 2, 3].map((i) => (
                <CardSkeleton key={i} />
              ))}
            </div>
          )}
          {results && places && results.length === 0 && <Empty filters={filters} places={places} onChange={update} />}
          {results && results.length > 0 && <Results key={key} results={results} hovered={hovered} onHover={setHovered} />}
        </section>
      </div>

      {wide && <aside className="sticky top-16 h-[calc(100dvh-4rem)] border-l border-line">{map}</aside>}

      <FilterSheet open={filtersOpen} onClose={() => setFiltersOpen(false)} filters={filters} places={places} onApply={update} showScore={hasReviews} />
    </div>
  );
}

/** "Afstand tonen": vraagt één keer je locatie; daarna staat bij elke plek hoe ver het hemelsbreed is */
function DistanceToggle() {
  const { status } = useMyLocation();
  if (status === "ready" || status === "unavailable") return null;
  if (status === "denied") return <span className="text-sm text-muted">Locatie staat uit, afstand onbekend</span>;
  return (
    <button
      type="button"
      onClick={requestMyLocation}
      disabled={status === "locating"}
      className="inline-flex h-11 items-center gap-1.5 text-sm font-semibold text-forest hover:underline disabled:opacity-60"
    >
      <Icon name="locate" size={17} /> {status === "locating" ? "Locatie bepalen…" : "Afstand tonen"}
    </button>
  );
}

const INTRO: Record<DeparturePage, string> = {
  vrij: "Hier is geen vaste vertrektijd. Je vertrekt wanneer je wilt, of je betaalt per 24 uur vanaf je aankomst. Elke plek op deze lijst hebben we gecontroleerd bij de plek zelf.",
  uitslapers: "Je hoeft pas om 12:00 of later weg. Genoeg tijd voor een rustig ontbijt.",
  overig: "Plekken waar je vóór 12:00 weg moet, en plekken waarvan we de vertrektijd nog niet zeker weten.",
};

/** De drie pagina's als tabbladen, met het aantal plekken bij de huidige zoekopdracht */
function DepartureTabs({ page, filters, places }: { page?: DeparturePage; filters: Filters; places: PlaceSummary[] | null }) {
  const counts = useMemo(() => {
    if (!places) return null;
    const base = { ...filters, departure: undefined };
    return {
      alle: applyFilters(places, base).length,
      vrij: applyFilters(places, { ...base, departure: "vrij" }).length,
      uitslapers: applyFilters(places, { ...base, departure: "uitslapers" }).length,
      overig: applyFilters(places, { ...base, departure: "overig" }).length,
    };
  }, [places, filters]);
  const tabs: { key: DeparturePage | "alle"; label: string; href: string }[] = [
    { key: "alle", label: "Alle", href: searchHref({ ...filters, departure: undefined }) },
    ...(Object.keys(DEPARTURE_PAGES) as DeparturePage[]).map((k) => ({
      key: k,
      label: DEPARTURE_PAGES[k].tab,
      href: searchHref({ ...filters, departure: k }),
    })),
  ];
  const active = page ?? "alle";
  const list = useRef<HTMLUListElement>(null);
  useEffect(() => {
    // Actief tabblad in beeld schuiven, alleen horizontaal
    const ul = list.current;
    const el = ul?.querySelector<HTMLElement>('[aria-current="page"]');
    if (ul && el && (el.offsetLeft < ul.scrollLeft || el.offsetLeft + el.offsetWidth > ul.scrollLeft + ul.clientWidth)) {
      ul.scrollLeft = el.offsetLeft - ul.offsetLeft - 12;
    }
  }, [active, counts]);
  return (
    <nav aria-label="Vertrektijden" className="border-b border-line bg-surface px-3 pt-1 sm:px-6 sm:pt-3 lg:border-0 lg:bg-transparent lg:pt-6">
      <ul ref={list} className="no-scrollbar -mx-3 flex gap-1 overflow-x-auto px-3 sm:mx-0 sm:px-0">
        {tabs.map((t) => (
          <li key={t.key} className="shrink-0">
            <Link
              href={t.href}
              replace
              scroll={false}
              aria-current={active === t.key ? "page" : undefined}
              className={`flex h-11 items-center whitespace-nowrap gap-1.5 rounded-t-lg border-b-[3px] px-2.5 text-[0.9375rem] font-semibold sm:px-3 sm:text-base ${
                active === t.key ? "border-forest text-forest" : "border-transparent text-ink-2 hover:text-forest"
              }`}
            >
              {t.label}
              {counts && <span className="text-sm font-normal text-muted">{counts[t.key].toLocaleString("nl-NL")}</span>}
            </Link>
          </li>
        ))}
      </ul>
      {page && (
        <div className="pt-3 pb-1">
          <h2 className="font-display text-lg font-semibold sm:text-xl">{DEPARTURE_PAGES[page].title}</h2>
          <p className="mt-0.5 text-[0.9375rem] text-ink-2 sm:text-base">{INTRO[page]}</p>
          {page === "overig" && (
            <div className="no-scrollbar -mx-3 mt-1 flex gap-2 overflow-x-auto px-3 sm:mx-0 sm:px-0" role="group" aria-label="Soort vertrektijd">
              {(
                [
                  ["overig", "Alle"],
                  ["ruim", "11:00 tot 12:00"],
                  ["vroeg", "Vóór 11:00"],
                  ["onbekend", "Onbekend"],
                ] as const
              ).map(([g, label]) => (
                <Link
                  key={g}
                  href={searchHref({ ...filters, departure: g })}
                  replace
                  scroll={false}
                  aria-current={filters.departure === g ? "true" : undefined}
                  className="flex h-11 shrink-0 items-center rounded-full border border-line px-4 text-sm font-semibold whitespace-nowrap aria-[current=true]:border-forest aria-[current=true]:bg-forest-tint aria-[current=true]:text-forest"
                >
                  {label}
                </Link>
              ))}
            </div>
          )}
        </div>
      )}
    </nav>
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
      <ul className="mt-2 space-y-2.5 sm:mt-4 sm:space-y-3">
        {results.slice(0, limit).map((r, i) => (
          <li key={r.place.id} className="enter cv-auto" style={{ ["--i" as string]: i % 24 }}>
            <PlaceCard place={r.place} km={r.km} active={hovered === r.place.slug} onHover={onHover} />
          </li>
        ))}
      </ul>
      {limit < results.length && (
        <div className="mt-6 text-center">
          <button
            type="button"
            onClick={() => setLimit((l) => l + PAGE)}
            className="h-12 rounded-lg border border-line bg-surface px-6 font-semibold hover:border-forest"
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

function Empty({ filters, places, onChange }: { filters: Filters; places: PlaceSummary[]; onChange: (f: Filters) => void }) {
  // Concrete alternatieven met het aantal plekken dat ze opleveren
  const options = relaxations(places, filters).slice(0, 4);
  return (
    <div className="mt-6 rounded-xl bg-surface p-6 shadow-low">
      <h2 className="font-display text-xl font-semibold">Geen plekken die aan alles voldoen</h2>
      <p className="mt-2 text-ink-2">{options.length ? "Met één aanpassing vind je wel iets:" : "Probeer een andere plaats of streek."}</p>
      <div className="mt-4 flex flex-wrap gap-2">
        {options.map((o) => (
          <button
            key={o.label}
            type="button"
            onClick={() => onChange(o.next)}
            className="min-h-11 rounded-lg border border-line px-4 font-semibold hover:border-forest hover:text-forest"
          >
            {o.label} <span className="font-normal text-muted">({o.count})</span>
          </button>
        ))}
      </div>
    </div>
  );
}
