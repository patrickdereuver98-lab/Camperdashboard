"use client";

import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { startTransition, useDeferredValue, useEffect, useMemo, useOptimistic, useRef, useState } from "react";
import { AnimatePresence, MotionConfig, motion } from "motion/react";
import {
  applyFilters,
  DEPARTURE_PAGES,
  filtersToQuery,
  parseFilters,
  refinementCount,
  relaxations,
  searchHref,
  type DeparturePage,
  type Filters,
  type Result,
  type SortKey,
  withPage,
} from "@/lib/search";
import { usePlaces, useVehicle } from "@/lib/store";
import { applyVehicle } from "@/lib/vehicle";
import { requestMyLocation, useMyLocation } from "@/lib/my-location";
import { useHydrated, useMediaQuery } from "@/lib/use-media";
import { pluralize } from "@/lib/format";
import { DestinationSearch } from "@/components/destination-search";
import { FilterSheet } from "@/components/filter-sheet";
import { QuickChips } from "@/components/quick-chips";
import { Legend } from "@/components/legend";
import { CardSkeleton, MapPick, PlaceCard, RESULT_LIST } from "@/components/place-ui";
import { PlaceMap } from "@/components/place-map";
import { Icon } from "@/components/icons";
import { FACILITIES, normalize } from "@/lib/search";
import { saveLastSearch, saveResultOrder } from "@/lib/last-search";
import { DataDate } from "@/components/data-date";
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
  // Stroom, lozen, gratis en 8+ staan al als snelle chip aan; hier alleen wat in de filtersheet is gekozen
  for (const fac of FACILITIES)
    if (f.facilities.includes(fac.key) && fac.key !== "power" && fac.key !== "dumpStation") chips.push({ label: fac.label, without: { ...f, facilities: f.facilities.filter((x) => x !== fac.key) } });
  for (const k of f.kinds) chips.push({ label: KIND_LABEL[k], without: { ...f, kinds: f.kinds.filter((x) => x !== k) } });
  if (f.maxPrice) chips.push({ label: `Tot € ${f.maxPrice}`, without: { ...f, maxPrice: undefined } });
  // Uitzetten blijft uit, ook als het camperprofiel een lengte heeft (lengte=0 in het adres)
  const len = String(f.minLength).replace(".", ",");
  if (f.minLength) chips.push({ label: f.lengthFromVehicle ? `Mijn camper (${len} m)` : `Camper ${len} m`, without: { ...f, minLength: undefined, lengthOff: true } });
  if (f.openNow) chips.push({ label: "Zonder gesloten plekken", without: { ...f, openNow: false } });
  if (f.priceUnknown && (f.free || f.maxPrice)) chips.push({ label: "Ook onbekende prijs", without: { ...f, priceUnknown: false } });
  if (f.minScore && f.minScore !== 8) chips.push({ label: `Score ${f.minScore}+`, without: { ...f, minScore: undefined } });
  return chips;
}

/** De eerste plekken van deze zoekopdracht, op de server berekend (zie search.tsx) */
export type InitialResults = { key: string; results: Result[]; total: number };

export function SearchApp({ page, updated, initial }: { page?: DeparturePage; updated?: string; initial?: InitialResults }) {
  const router = useRouter();
  const params = useSearchParams();
  const [vehicle] = useVehicle();
  const filters = useMemo(() => applyVehicle(withPage(parseFilters(params), page), vehicle), [params, page, vehicle]);
  const key = filtersToQuery(filters);
  const { data: places, error, cachedAt } = usePlaces();
  // Tot de hele dataset er is, tonen we de plekken die de server al meegaf (alleen als het om dezelfde zoekopdracht gaat)
  const early = !places && initial?.key === key ? initial : undefined;
  // Filteren over ±2.000 plekken kost op een trage telefoon een paar honderd ms: de chips reageren meteen, de lijst
  // en de kaart volgen met de uitgestelde filters (R36)
  const deferredFilters = useDeferredValue(filters);
  const results = useMemo(() => (places ? applyFilters(places, deferredFilters) : (early?.results ?? null)), [places, deferredFilters, early]);
  const resultsKey = filtersToQuery(deferredFilters);
  const total = early ? early.total : results?.length;
  const [hovered, setHovered] = useState<string | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [mapOpen, setMapOpen] = useState(params.get("kaart") === "1");
  const hasReviews = useMemo(() => Boolean(places?.some((p) => p.ratingCount > 0)), [places]);
  const wide = useMediaQuery("(min-width: 1024px)");
  // Kaart: dezelfde gefilterde plekken als de lijst, uit de dataset die al in het geheugen staat. Eén nieuwe set per
  // filterwijziging (MapLibre clustert in een worker); verschuiven en zoomen kost geen verzoek en geen nieuwe clustering.
  const mapPlaces = useMemo(() => results?.map((r) => r.place) ?? [], [results]);
  // Telefoon: een tik op een stip toont de plek onderaan de kaart (MapPick) in plaats van een popup
  const [picked, setPicked] = useState<string | null>(null);
  const pickedIndex = picked ? mapPlaces.findIndex((p) => p.slug === picked) : -1;
  const pickedPlace = pickedIndex >= 0 ? mapPlaces[pickedIndex] : undefined;
  const pickAt = (i: number) => {
    const p = mapPlaces[i];
    if (!p) return;
    setPicked(p.slug);
    setHovered(p.slug);
  };

  // Elke vertrekgroep heeft een eigen pagina; een andere groep kiezen gaat naar die pagina
  // De gekozen filters staan meteen op de knoppen (optimistisch); lijst en kaart volgen zodra het adres is bijgewerkt (R36)
  const [shown, setShown] = useOptimistic(filters);
  const update = (f: Filters) =>
    startTransition(() => {
      setShown(f);
      router.replace(searchHref(f), { scroll: false });
    });

  // Het tabblad Zoeken brengt je hier terug, met dezelfde filters (deze sessie)
  useEffect(() => {
    saveLastSearch(window.location.pathname + window.location.search);
  }, [params, page]);
  // Volgorde van de lijst, voor Vorige en Volgende op de plekpagina
  useEffect(() => {
    if (results && places) saveResultOrder(results.map((r) => ({ slug: r.place.slug, name: r.place.name })), window.location.pathname + window.location.search);
  }, [results, places]);

  // Wegschuivende zoekbalk (K3): op een telefoon bij omlaag scrollen alleen de rij Filters, Sorteren en Kaart; bij
  // omhoog scrollen alles terug, zoals de adresbalk van Safari
  const topPart = useRef<HTMLDivElement>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [topHeight, setTopHeight] = useState(0);
  useEffect(() => {
    if (wide || mapOpen) return;
    let last = window.scrollY;
    const onScroll = () => {
      const y = window.scrollY;
      if (Math.abs(y - last) < 8) return;
      setCollapsed(y > last && y > 160);
      last = y;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      setCollapsed(false);
    };
  }, [wide, mapOpen]);
  useEffect(() => {
    const el = topPart.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setTopHeight(el.offsetHeight));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const hideTop = collapsed && !wide && !mapOpen;

  // Oude links (/zoeken?vrij=1 of ?vertrek=…) naar de juiste pagina sturen
  const misplaced = !page && filters.departure ? searchHref(filters) : null;
  useEffect(() => {
    if (misplaced) router.replace(misplaced);
  }, [misplaced, router]);

  const focusCard = (slug: string) => {
    setHovered(slug);
    if (!wide) setPicked(slug);
    if (wide) document.querySelector(`[data-slug="${CSS.escape(slug)}"]`)?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  const count = refinementCount(filters);
  const chips = activeChips(filters);
  // Een plaatsnaam in de link zonder coördinaten of provincie kennen we niet: zeg dat eerlijk in plaats van "in xyz"
  const unknownPlace = filters.where && !filters.center && !filters.province ? filters.where : undefined;
  const heading = unknownPlace ? "Nederland" : (filters.where ?? filters.province ?? "Nederland");

  const map = places && results && (
    <PlaceMap
      places={mapPlaces}
      highlight={hovered}
      onSelect={focusCard}
      fitKey={key}
      user={filters.where === "Mijn locatie" ? filters.center : null}
      onShowList={() => setMapOpen(false)}
      popup={wide}
      focus={wide ? null : picked}
      locate
      onSearchArea={(center, radiusKm) =>
        update({ ...filters, where: "Kaartgebied", center, radiusKm, province: undefined, sort: filters.sort === "afstand" ? "afstand" : filters.sort })
      }
      className="h-full w-full"
    />
  );

  return (
    <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,0.85fr)]">
      <div className="min-w-0">
        {/* Zoekbalk en filters, plakt op mobiel onder de header */}
        <DepartureIntro page={page} filters={filters} />
        <div
          className="sticky top-14 z-30 border-b border-line bg-surface px-3 pt-2 pb-1 transition-transform duration-200 motion-reduce:transition-none sm:top-16 sm:px-6 sm:pt-3 sm:pb-3 lg:static lg:border-0 lg:bg-transparent lg:pt-4"
          style={hideTop ? { transform: `translateY(-${topHeight}px)` } : undefined}
          onFocusCapture={() => setCollapsed(false)}
        >
          <div ref={topPart} className={hideTop ? "invisible" : undefined}>
          <DestinationSearch key={filters.where ?? ""} variant="bar" base={filters} initial={filters.where ?? filters.province ?? ""} onPick={update} places={places} />
          <div className="mt-2 sm:mt-3">
            <QuickChips filters={shown} onChange={update} onFilters={() => setFiltersOpen(true)} />
          </div>
          </div>
          {/* Mobiel: één rustige rij zoals bij Booking (filters, sorteren, kaart); groter scherm: knoppen met rand */}
          <div className="mt-1 flex min-w-0 items-center divide-x divide-line sm:mt-3 sm:gap-2 sm:divide-x-0">
            <button
              type="button"
              onClick={() => setFiltersOpen(true)}
              className="flex h-11 min-w-0 flex-1 items-center justify-center gap-1.5 font-semibold sm:flex-none sm:rounded-lg sm:border sm:border-line sm:bg-surface sm:px-4 sm:text-base sm:hover:border-forest"
            >
              <Icon name="sliders" size={18} />
              Filters
              {count > 0 && (
                <span className="grid h-6 min-w-6 place-items-center rounded-full bg-forest px-1.5 text-sm text-on-forest">{count}</span>
              )}
            </button>
            <label className="relative flex h-11 min-w-0 flex-1 items-center justify-center font-semibold has-[select:focus-visible]:rounded-lg has-[select:focus-visible]:outline-[3px] has-[select:focus-visible]:outline-forest sm:flex-none sm:rounded-lg sm:border sm:border-line sm:bg-surface sm:pr-9 sm:pl-3 sm:text-base sm:hover:border-forest">
              <Icon name="sort" size={17} className="mr-1.5 shrink-0 text-muted" />
              {/* Mobiel staat er alleen "Sorteren" (de keuze past niet); een stip als het niet de standaard is */}
              <span className="sm:hidden">Sorteren</span>
              {shown.sort !== "aanbevolen" && <span className="ml-1 h-2 w-2 rounded-full bg-forest sm:hidden" aria-hidden="true" />}
              <select
                aria-label="Sorteren"
                value={shown.sort}
                onChange={(e) => update({ ...filters, sort: e.target.value as SortKey })}
                className="absolute inset-0 min-w-0 appearance-none truncate bg-transparent opacity-0 focus:outline-none sm:static sm:h-full sm:w-full sm:opacity-100"
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
                className="flex h-11 min-w-0 flex-1 items-center justify-center gap-1.5 font-semibold aria-pressed:text-forest sm:flex-none sm:rounded-lg sm:border sm:border-line sm:bg-surface sm:px-4 sm:text-base"
              >
                <Icon name={mapOpen ? "list" : "map"} size={18} />
                {mapOpen ? "Lijst" : "Kaart"}
                {!mapOpen && total !== undefined && <span className="font-normal text-muted tabular-nums">({total})</span>}
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
                    className="flex h-11 items-center gap-1.5 rounded-md border border-forest bg-forest pr-2.5 pl-3 font-semibold whitespace-nowrap text-on-forest"
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
        {!wide && mapOpen && (
          <div className="animate-fade-in relative h-[calc(100dvh-15rem-env(safe-area-inset-bottom))] min-h-80">
            {map}
            {pickedPlace && (
              <MapPick
                key={pickedPlace.slug}
                place={pickedPlace}
                onClose={() => {
                  setPicked(null);
                  setHovered(null);
                }}
                onPrev={pickedIndex > 0 ? () => pickAt(pickedIndex - 1) : undefined}
                onNext={pickedIndex < mapPlaces.length - 1 ? () => pickAt(pickedIndex + 1) : undefined}
                position={`${pickedIndex + 1} van ${mapPlaces.length}`}
              />
            )}
          </div>
        )}

        <section className={`px-3 pt-3 pb-24 sm:px-6 sm:pt-4 lg:pb-8 ${!wide && mapOpen ? "hidden" : "animate-fade-in"}`}>
          {/* Alleen de teller is live: een schermlezer hoort "12 plekken in Gelderland", niet de hele lijst (R30) */}
          <h1 className="font-display text-h1 font-semibold" aria-live="polite" aria-atomic="true">
            <span key={total} className="animate-fade-in inline-block">
              {total !== undefined ? pluralize(total, "plek", "plekken") : "Plekken laden"}
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
            <DataDate cachedAt={cachedAt} />
            <Legend label="Uitleg icoontjes" />
            <DistanceToggle />
          </div>

          {error && (
            <div className="mt-4 rounded-lg border border-alert/40 bg-alert-tint p-4 text-alert">
              <p>De plekken konden niet worden geladen. Controleer je verbinding en probeer het opnieuw.</p>
              <button type="button" onClick={() => window.location.reload()} className="mt-3 min-h-11 rounded-md border border-line bg-surface px-4 font-semibold text-ink hover:border-forest">
                Opnieuw proberen
              </button>
            </div>
          )}
          {!results && !error && (
            <div className="mt-4 border-t border-line">
              {[0, 1, 2, 3].map((i) => (
                <CardSkeleton key={i} />
              ))}
            </div>
          )}
          {results && places && results.length === 0 && <Empty filters={filters} places={places} onChange={update} />}
          {results && results.length > 0 && <Results key={resultsKey} queryKey={resultsKey} results={results} total={total ?? results.length} fromServer={!!early} hovered={hovered} onHover={setHovered} />}
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
  // UI/UX-plan T19: één uitlegregel. Niet "zonder opgegeven vaste vertrektijd": dat zou betekenen dat de tijd onbekend is
  vrij: "Hier staan plekken zonder vaste vertrektijd. Je vertrekt wanneer je wilt, of je betaalt per 24 uur.",
  uitslapers: "Je hoeft pas om 12:00 of later weg. Genoeg tijd voor een rustig ontbijt.",
  overig: "Plekken waar je vóór 12:00 weg moet, en plekken waarvan we de vertrektijd nog niet zeker weten.",
};

/**
 * Kop en uitleg van de vertrekpagina's (Zonder vertrektijd, Uitslapers, Overige). De tabbladen zijn vervangen door de
 * snelle chip "Zonder vertrektijd" (redesign 30 oktober 2026); de pagina's zelf blijven, met hun eigen kop.
 */
function DepartureIntro({ page, filters }: { page?: DeparturePage; filters: Filters }) {
  if (!page) return null;
  return (
    <div className="border-b border-line bg-surface px-3 sm:px-6 lg:border-0 lg:bg-transparent lg:pt-6">
        <div className="pt-3 pb-1">
          <h2 className="font-display text-h2 font-semibold">{DEPARTURE_PAGES[page].title}</h2>
          <p className="mt-0.5 text-ink-2">{INTRO[page]}</p>
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
    </div>
  );
}

/**
 * Hoeveel plekken er open staan per zoekopdracht, voor deze sessie. Tik je een plek aan en ga je terug, dan staan er
 * weer evenveel plekken en kan de browser je terugzetten waar je was (UX-audit november, K1).
 */
const SHOWN_KEY = "vrijstaan:getoond";

function readShown(queryKey: string): number {
  try {
    const saved = JSON.parse(sessionStorage.getItem(SHOWN_KEY) ?? "null") as { q?: string; n?: number } | null;
    return saved?.q === queryKey && typeof saved.n === "number" && saved.n > PAGE ? saved.n : PAGE;
  } catch {
    return PAGE;
  }
}

function Results({
  queryKey,
  results,
  total,
  fromServer,
  hovered,
  onHover,
}: {
  queryKey: string;
  results: Result[];
  /** Kan groter zijn dan results, zolang alleen de eerste plekken van de server er zijn */
  total: number;
  /** Plekken die al in de HTML stonden komen niet opnieuw binnenvliegen (en de eerste foto is meteen zichtbaar) */
  fromServer: boolean;
  hovered: string | null;
  onHover: (s: string | null) => void;
}) {
  // Terug van een plek (navigatie in de browser): meteen evenveel plekken als toen, zodat de browser je scrollpositie
  // kan terugzetten. Bij de eerste keer laden (HTML van de server) eerst 20, daarna het aantal van deze sessie.
  const hydrated = useHydrated();
  const [limit, setLimit] = useState(() => (hydrated ? readShown(queryKey) : PAGE));
  useEffect(() => {
    const n = readShown(queryKey);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sessionStorage bestaat pas in de browser
    if (n > PAGE) setLimit((l) => Math.max(l, n));
  }, [queryKey]);
  // Altijd vanaf de actuele stand ophogen: vanzelf laden en het teruggezette aantal mogen elkaar niet overschrijven
  const showMore = () => setLimit((l) => l + PAGE);
  useEffect(() => {
    if (limit <= PAGE) return;
    try {
      sessionStorage.setItem(SHOWN_KEY, JSON.stringify({ q: queryKey, n: limit }));
    } catch {
      // Opslag uit (privévenster): dan begint de lijst bij terugkomen weer bij 20
    }
  }, [limit, queryKey]);
  const [animate] = useState(!fromServer);

  // Zoeken in deze plekken (Z4): bij veel resultaten op naam of plaats, alleen op het toestel
  const [within, setWithin] = useState("");
  const q = normalize(within);
  const visible = q ? results.filter((r) => normalize(`${r.place.name} ${r.place.town}`).includes(q)) : results;
  const shownTotal = q ? visible.length : total;

  // Vanzelf meer laden als de knop in beeld komt; de knop blijft voor toetsenbord en schermlezer
  const more = useRef<HTMLDivElement>(null);
  const showMoreRef = useRef(showMore);
  useEffect(() => {
    showMoreRef.current = showMore;
  });
  const canLoadMore = limit < shownTotal;
  useEffect(() => {
    const el = more.current;
    if (!el || !canLoadMore || !("IntersectionObserver" in window)) return;
    const io = new IntersectionObserver((entries) => entries.some((e) => e.isIntersecting) && showMoreRef.current(), { rootMargin: "400px 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, [canLoadMore, limit]);

  return (
    <>
      {total > 40 && (
        <label className="mt-3 flex h-11 items-center gap-2 rounded-lg bg-sunken px-3 text-ink-2 focus-within:ring-2 focus-within:ring-forest">
          <Icon name="search" size={17} className="shrink-0 text-muted" />
          <span className="sr-only">Zoek in deze plekken</span>
          <input
            type="search"
            value={within}
            onChange={(e) => setWithin(e.target.value)}
            placeholder="Zoek in deze plekken op naam of plaats"
            enterKeyHint="search"
            autoComplete="off"
            className="h-full min-w-0 flex-1 bg-transparent text-base placeholder:text-muted focus:outline-none"
          />
        </label>
      )}
      {q && (
        <p role="status" className="mt-2 text-sm text-muted">
          {visible.length === 0 ? `Geen plek met "${within.trim()}" in deze resultaten.` : `${pluralize(visible.length, "plek", "plekken")} met "${within.trim()}"`}
        </p>
      )}
      <ul className={`mt-2 sm:mt-4 ${RESULT_LIST}`}>
        {visible.slice(0, limit).map((r, i) => (
          <li key={r.place.id} className={animate ? "enter cv-auto" : "cv-auto"} style={{ ["--i" as string]: i % 24 }}>
            <PlaceCard place={r.place} km={r.km} active={hovered === r.place.slug} onHover={onHover} eager={i < 2} />
          </li>
        ))}
      </ul>
      {canLoadMore && (
        <div ref={more} className="mt-6 text-center">
          <button
            type="button"
            onClick={showMore}
            className="h-12 rounded-lg border border-line bg-surface px-6 font-semibold hover:border-forest"
          >
            Toon meer plekken
          </button>
          <p className="mt-2 text-sm text-muted">
            {Math.min(limit, visible.length)} van {shownTotal} getoond
          </p>
        </div>
      )}
    </>
  );
}

function Empty({ filters, places, onChange }: { filters: Filters; places: PlaceSummary[]; onChange: (f: Filters) => void }) {
  // Concrete alternatieven met het aantal plekken dat ze opleveren
  // Staat alleen de straal in de weg, dan "Binnen 50 km" vooraan: dat is de kleinste stap
  const options = relaxations(places, filters)
    .sort((a, b) => Number(b.label.startsWith("Binnen ")) - Number(a.label.startsWith("Binnen ")))
    .slice(0, 4);
  return (
    <div className="mt-6 rounded-lg border border-line bg-surface p-5">
      <h2 className="font-display text-h2 font-semibold">Geen plekken die aan alles voldoen</h2>
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
