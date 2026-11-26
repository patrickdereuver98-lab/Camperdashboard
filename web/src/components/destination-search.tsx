"use client";

import { useRouter } from "next/navigation";
import { Fragment, useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import { editDistance, DEFAULT_FILTERS, normalize, searchHref, searchForm, type Filters } from "@/lib/search";
import { rememberSearch, usePlaceIndex, useRecent, useTowns } from "@/lib/store";
import { filtersLabel, parseQuery } from "@/lib/query-parse";
import type { PlaceRef } from "@/lib/place-index";
import { track } from "@/lib/track";
import { PROVINCES, type Town } from "@/lib/types";
import { distanceKm } from "@/lib/geo";
import { cleanQuery, LOCATION_KIND, withoutKnownTowns, type Location, type SuggestAnswer } from "@/lib/pdok";
import { Icon } from "./icons";

/** Eilanden en streken waar camperaars op zoeken; middelpunt en straal bij benadering */
const REGIONS: { name: string; lat: number; lng: number; radiusKm: number }[] = [
  { name: "Texel", lat: 53.07, lng: 4.8, radiusKm: 15 },
  { name: "Vlieland", lat: 53.27, lng: 5.0, radiusKm: 10 },
  { name: "Terschelling", lat: 53.4, lng: 5.35, radiusKm: 15 },
  { name: "Ameland", lat: 53.45, lng: 5.77, radiusKm: 12 },
  { name: "Schiermonnikoog", lat: 53.48, lng: 6.17, radiusKm: 8 },
  { name: "Veluwe", lat: 52.2, lng: 5.85, radiusKm: 30 },
  { name: "Walcheren", lat: 51.53, lng: 3.55, radiusKm: 15 },
  { name: "Zeeuws-Vlaanderen", lat: 51.3, lng: 3.85, radiusKm: 30 },
  { name: "Schouwen-Duiveland", lat: 51.68, lng: 3.92, radiusKm: 15 },
  { name: "Goeree-Overflakkee", lat: 51.78, lng: 4.15, radiusKm: 15 },
  { name: "Achterhoek", lat: 51.98, lng: 6.5, radiusKm: 30 },
  { name: "Twente", lat: 52.3, lng: 6.75, radiusKm: 30 },
  { name: "Salland", lat: 52.38, lng: 6.25, radiusKm: 20 },
  { name: "Zuid-Limburg", lat: 50.87, lng: 5.85, radiusKm: 25 },
  { name: "De Peel", lat: 51.45, lng: 5.85, radiusKm: 25 },
  { name: "Utrechtse Heuvelrug", lat: 52.05, lng: 5.4, radiusKm: 20 },
  { name: "Biesbosch", lat: 51.75, lng: 4.8, radiusKm: 15 },
  { name: "Kop van Noord-Holland", lat: 52.9, lng: 4.8, radiusKm: 20 },
  { name: "Waddenkust", lat: 53.35, lng: 6.2, radiusKm: 35 },
];

type Option =
  | { type: "near"; label: string }
  /** Eerder gezocht (alleen op dit toestel) */
  | { type: "recent"; label: string; href: string }
  /** Laatst bekeken plek (alleen op dit toestel) */
  | { type: "viewed"; label: string; sub: string; slug: string }
  /** Alleen filters getypt ("stroom", "gratis honden"): die aanzetten op de huidige bestemming */
  | { type: "filters"; label: string; sub: string }
  | { type: "province"; label: string }
  | { type: "town"; label: string; sub: string; lat: number; lng: number; radiusKm?: number }
  | { type: "place"; label: string; sub: string; slug: string }
  /** Adres, postcode, woonplaats of gemeente van PDOK (via onze eigen /api/locatie) */
  | { type: "address"; label: string; sub: string; loc: Location };

/** Suggesties van PDOK via onze server; de browser praat zelf nooit met PDOK */
async function fetchLocations(q: string, signal?: AbortSignal): Promise<SuggestAnswer> {
  const res = await fetch(`/api/locatie?q=${encodeURIComponent(q)}`, { signal });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

/** Kopje boven een groep suggesties; null = geen kopje */
const GROUP: Record<Option["type"], string | null> = {
  near: null,
  filters: null,
  recent: "Eerder gezocht",
  viewed: "Laatst bekeken",
  province: "Plaatsen en streken",
  town: "Plaatsen en streken",
  address: "Adressen en postcodes",
  place: "Plekken",
};

/** Het getypte deel vet in de suggestie ("**Giet**hoorn"); alleen als het letterlijk voorkomt */
function Highlight({ text, query }: { text: string; query: string }) {
  const q = query.trim().toLowerCase();
  const i = q.length > 1 ? text.toLowerCase().indexOf(q) : -1;
  if (i < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, i)}
      <mark className="bg-transparent font-bold text-inherit">{text.slice(i, i + q.length)}</mark>
      {text.slice(i + q.length)}
    </>
  );
}

/** In de URL en de kop: bij een woonplaats of gemeente alleen de naam ("Giethoorn"), anders de hele weergavenaam */
const whereLabel = (l: Location) => (l.type === "woonplaats" || l.type === "gemeente" ? l.label.split(",")[0].trim() : l.label);

export function DestinationSearch({
  variant = "hero",
  base,
  initial = "",
  onPick,
  places: given,
  children,
}: {
  variant?: "hero" | "bar";
  /**
   * Plekken die de pagina al heeft (zoeken: de hele lijst; null = nog onderweg). Zonder deze prop haalt het zoekvak
   * zelf de lichte suggestie-index op, pas als je het gebruikt (R33).
   */
  places?: PlaceRef[] | null;
  /** Extra velden tussen het zoekveld en de knop */
  children?: ReactNode;
  /** Verfijningen die behouden blijven bij een nieuwe bestemming */
  base?: Filters;
  initial?: string;
  onPick?: (f: Filters) => void;
}) {
  const router = useRouter();
  const id = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [text, setText] = useState(initial);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [locating, setLocating] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState<string | null>(null);
  const [resolving, setResolving] = useState(false);
  // Antwoord van /api/locatie voor de zoekterm `q`; alleen PDOK-antwoorden (de terugval is dezelfde lijst als hieronder)
  const [remote, setRemote] = useState<{ q: string; items: Location[] } | null>(null);
  // Woonplaatsen en de suggestie-index pas ophalen als je het zoekvak aanraakt of er al iets in staat
  const [used, setUsed] = useState(initial !== "");
  const { data: towns } = useTowns(used);
  const { data: index } = usePlaceIndex(used && given === undefined);
  const places = given === undefined ? index : given;
  const recent = useRecent();
  // "gratis texel met stroom": filters eruit, de rest is de plaats (Z2)
  const parsed = useMemo(() => parseQuery(text), [text]);
  const remoteQuery = cleanQuery(parsed.rest);

  // Adressen, postcodes en alle woonplaatsen: pas vragen als je even stopt met typen
  useEffect(() => {
    if (!remoteQuery) return;
    const ctrl = new AbortController();
    // Een postcode (4 cijfers) meteen vragen: daar zit geen plaatsnaam in die we zelf kennen
    const delay = /^\d{4}/.test(remoteQuery) ? 0 : 250;
    const timer = setTimeout(() => {
      fetchLocations(remoteQuery, ctrl.signal).then(
        (a) => setRemote({ q: remoteQuery, items: a.bron === "pdok" ? a.resultaten : [] }),
        () => {
          // Geen verbinding of PDOK plat: het zoekvak werkt gewoon door met de eigen lijst
        },
      );
    }, delay);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [remoteQuery]);

  // Op een computer: "/" opent het zoekvak (zoals op veel zoeksites), behalve als je al ergens typt
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "/" || e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
      if (document.querySelector('[role="dialog"]')) return;
      e.preventDefault();
      inputRef.current?.focus();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const options = useMemo<Option[]>(() => {
    const q = searchForm(parsed.rest);
    const out: Option[] = [{ type: "near", label: "Dichtbij mijn locatie" }];
    if (!text.trim()) {
      // Leeg: eerst wat je eerder deed (alleen op dit toestel), anders vier provincies
      for (const r of recent.searches) out.push({ type: "recent", label: r.label, href: r.href });
      for (const v of recent.places.slice(0, 3)) out.push({ type: "viewed", label: v.name, sub: v.town, slug: v.slug });
      if (out.length === 1) for (const p of ["Zeeland", "Gelderland", "Friesland", "Limburg"]) out.push({ type: "province", label: p });
      return out;
    }
    if (!q) {
      // Alleen filters getypt ("stroom", "gratis honden"): die aanzetten
      const where = base?.where ?? base?.province;
      if (parsed.labels.length)
        out.push({ type: "filters", label: `Filter: ${parsed.labels.join(", ")}`, sub: where ? `Bij ${where}` : "In heel Nederland" });
      return out;
    }
    // Overeenkomst: exact (0), begint met (1), bevat (2), bijna goed gespeld (3 plus 0,1 per tikfout), zodat
    // "Giethorn" bij Giethoorn (1 fout) uitkomt en niet bij een grotere plaats met 2 fouten
    const rankOf = (name: string) => {
      const n = normalize(name);
      if (n === q) return 0;
      if (n.startsWith(q)) return 1;
      if (q.length > 2 && n.includes(q)) return 2;
      const d = q.length >= 5 ? editDistance(q, n, q.length >= 8 ? 2 : 1) : Infinity;
      return Number.isFinite(d) ? 3 + d / 10 : -1;
    };
    const nearbyCount = (c: { lat: number; lng: number }, r = 25) => (places ?? []).filter((p) => distanceKm(c, p) <= r).length;

    for (const p of PROVINCES) if (rankOf(p) >= 0) out.push({ type: "province", label: p });
    // Eilanden en streken met hun eigen zoekstraal
    for (const r of REGIONS)
      if (rankOf(r.name) >= 0) {
        const n = nearbyCount(r, r.radiusKm);
        if (!places || n > 0)
          out.push({ type: "town", label: r.name, sub: places ? `Streek, ${n} ${n === 1 ? "plek" : "plekken"}` : "Streek", lat: r.lat, lng: r.lng, radiusKm: r.radiusKm });
      }
    // Woonplaatsen, plus plaatsnamen die alleen bij plekken voorkomen (zoals Domburg)
    const all = new Map<string, Town>();
    for (const t of towns ?? []) all.set(t.name, t);
    for (const p of places ?? []) if (!all.has(p.town)) all.set(p.town, { name: p.town, province: p.province, lat: p.lat, lng: p.lng });
    const matches: { t: Town; rank: number; nearby: number }[] = [];
    for (const t of all.values()) {
      const rank = rankOf(t.name);
      if (rank < 0) continue;
      const nearby = nearbyCount(t);
      if (places && nearby === 0) continue;
      matches.push({ t, rank, nearby });
    }
    matches.sort((a, b) => a.rank - b.rank || b.nearby - a.nearby);
    for (const { t, nearby } of matches.slice(0, 7))
      out.push({
        type: "town",
        label: t.name,
        sub: places ? `${t.province}, ${nearby} ${nearby === 1 ? "plek" : "plekken"} binnen 25 km` : t.province,
        lat: t.lat,
        lng: t.lng,
      });
    // Van PDOK: adressen, postcodes, gemeenten en woonplaatsen die hierboven nog niet staan
    if (remote && remote.q === remoteQuery) {
      const shown = out.flatMap((o) => (o.type === "town" ? [o.label] : []));
      for (const loc of withoutKnownTowns(remote.items, shown).slice(0, 6)) {
        const kind = LOCATION_KIND[loc.type];
        let sub = kind;
        if (places && loc.lat !== undefined && loc.lng !== undefined) {
          const n = nearbyCount({ lat: loc.lat, lng: loc.lng });
          sub = `${kind}, ${n === 0 ? "geen plekken" : `${n} ${n === 1 ? "plek" : "plekken"}`} binnen 25 km`;
        }
        out.push({ type: "address", label: loc.label, sub, loc });
      }
    }
    if (q.length > 2) {
      // Plekken op naam: ook met een tikfout in één woord ("zeelndia"); de precies goede naam komt meteen na Dichtbij
      const found: { p: PlaceRef; exact: boolean }[] = [];
      for (const p of places ?? []) {
        const n = normalize(p.name);
        const hit = n.includes(q) || (q.length >= 5 && !q.includes(" ") && n.split(" ").some((w) => editDistance(q, w, q.length >= 8 ? 2 : 1) !== Infinity));
        if (hit) found.push({ p, exact: n === q });
        if (found.length > 12) break;
      }
      for (const { p, exact } of found) {
        const o: Option = { type: "place", label: p.name, sub: `${p.town}, ${p.province}`, slug: p.slug };
        if (exact) out.splice(1, 0, o);
        else if (out.length <= 14) out.push(o);
      }
    }
    return out;
  }, [text, parsed, towns, places, remote, remoteQuery, recent.searches, recent.places, base?.where, base?.province]);

  /** `waarTrack`: wat de statistieken zien; bij een adres of postcode alleen de soort, nooit het adres zelf */
  function go(f: Filters, waarTrack: string | null = f.where ?? null) {
    track("search", { waar: waarTrack, provincie: f.province ?? null });
    // Eerder gezocht, alleen op dit toestel; "Mijn locatie" niet (dat punt klopt morgen niet meer)
    if (f.where !== "Mijn locatie") rememberSearch(filtersLabel(f), searchHref(f));
    if (onPick) onPick(f);
    else router.push(searchHref(f));
  }

  function pick(o: Option) {
    setOpen(false);
    // Herkende filters uit de zoekvraag gaan mee ("gratis texel" → Texel met Gratis aan)
    const keep: Filters = { ...(base ?? DEFAULT_FILTERS), ...parsed.patch, where: undefined, center: undefined, province: undefined };
    if (o.type === "place" || o.type === "viewed") {
      router.push(`/plek/${o.slug}`);
      return;
    }
    if (o.type === "recent") {
      setText("");
      router.push(o.href);
      return;
    }
    if (o.type === "filters") {
      setText(base?.where ?? base?.province ?? "");
      go({ ...(base ?? DEFAULT_FILTERS), ...parsed.patch });
      return;
    }
    if (o.type === "province") {
      setText(o.label);
      go({ ...keep, where: o.label, province: o.label, sort: keep.sort === "afstand" ? "aanbevolen" : keep.sort });
      return;
    }
    if (o.type === "town") {
      setText(o.label);
      go({ ...keep, where: o.label, center: { lat: o.lat, lng: o.lng }, radiusKm: o.radiusKm ?? keep.radiusKm });
      return;
    }
    if (o.type === "address") {
      void pickLocation(o.loc, keep);
      return;
    }
    if (!("geolocation" in navigator)) {
      setGeoError("Je browser kan je locatie niet bepalen. Typ een plaatsnaam.");
      return;
    }
    setLocating(true);
    setGeoError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        setText("Mijn locatie");
        go({ ...keep, where: "Mijn locatie", center: { lat: pos.coords.latitude, lng: pos.coords.longitude }, sort: "afstand" });
      },
      (err) => {
        setLocating(false);
        setGeoError(
          err.code === err.PERMISSION_DENIED
            ? "Geen toegang tot je locatie. Sta het toe in je browser of typ een plaatsnaam."
            : "Je locatie kon niet worden bepaald. Probeer het opnieuw of typ een plaatsnaam.",
        );
      },
      { timeout: 12000, maximumAge: 300000 },
    );
  }

  /** Adres of postcode gekozen: middelpunt op die plek; zonder coördinaat eerst opzoeken via onze server */
  async function pickLocation(loc: Location, keep: Filters) {
    setText(loc.label);
    setNotFound(null);
    let point = loc.lat !== undefined && loc.lng !== undefined ? { lat: loc.lat, lng: loc.lng } : null;
    if (!point && loc.id) {
      setResolving(true);
      try {
        const res = await fetch(`/api/locatie?id=${encodeURIComponent(loc.id)}`);
        const found = res.ok ? ((await res.json()) as Location) : null;
        if (found?.lat !== undefined && found.lng !== undefined) point = { lat: found.lat, lng: found.lng };
      } catch {
        // Hieronder: melding dat we het niet vonden
      } finally {
        setResolving(false);
      }
    }
    if (!point) {
      setNotFound(loc.label);
      inputRef.current?.focus();
      return;
    }
    const exact = loc.type === "adres" || loc.type === "postcode";
    go({ ...keep, where: whereLabel(loc), center: point }, exact ? LOCATION_KIND[loc.type].toLowerCase() : whereLabel(loc));
  }

  async function submit() {
    const first = options.find((o) => o.type !== "near" && o.type !== "recent" && o.type !== "viewed");
    const typed = text.trim();
    setNotFound(null);
    if (typed && first) return pick(first);
    if (!typed) return go({ ...(base ?? DEFAULT_FILTERS), where: undefined, center: undefined, province: undefined });
    // Nog geen suggesties van PDOK binnen (snel getypt en Enter): nu vragen
    const q = cleanQuery(typed);
    if (q) {
      setResolving(true);
      const answer = await fetchLocations(q).catch(() => null);
      setResolving(false);
      const loc = answer?.resultaten[0];
      if (loc) return pick({ type: "address", label: loc.label, sub: "", loc });
    }
    setNotFound(typed);
    inputRef.current?.focus();
  }

  const hero = variant === "hero";
  const listId = `${id}-lijst`;

  const listbox = open && options.length > 0 && (
    <ul
      id={listId}
      role="listbox"
      className="absolute inset-x-0 top-full z-30 mt-2 max-h-[min(60vh,420px)] overflow-auto rounded-lg border border-line bg-surface py-1 text-ink shadow-float"
    >
      {parsed.labels.length > 0 && parsed.rest && (
        <li role="presentation" className="px-4 pt-1 pb-2 text-sm text-ink-2">
          Met filters: <span className="font-semibold text-forest">{parsed.labels.join(", ")}</span>
        </li>
      )}
      {options.map((o, i) => (
        <Fragment key={`${o.type}-${o.label}-${i}`}>
        {GROUP[o.type] && GROUP[o.type] !== GROUP[options[i - 1]?.type] && (
          <li role="presentation" className="flex items-center justify-between px-4 pt-3 pb-1 text-sm font-semibold text-muted">
            {GROUP[o.type]}
            {o.type === "recent" && i === options.findIndex((x) => x.type === "recent") && (
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  recent.clear();
                }}
                className="min-h-11 px-1 font-semibold text-forest underline"
              >
                Wis geschiedenis
              </button>
            )}
          </li>
        )}
        <li
          id={`${id}-o${i}`}
          role="option"
          aria-selected={i === active}
          onMouseDown={(e) => {
            e.preventDefault();
            pick(o);
          }}
          onMouseEnter={() => setActive(i)}
          className="flex min-h-12 cursor-pointer items-center gap-3 px-4 py-2 aria-selected:bg-forest-tint"
        >
          <Icon
            name={o.type === "near" ? "locate" : o.type === "place" || o.type === "viewed" ? "home" : o.type === "recent" ? "clock" : o.type === "filters" ? "sliders" : "pin"}
            size={20}
            className={o.type === "near" || o.type === "filters" ? "text-forest" : "text-muted"}
          />
          <span className="min-w-0 flex-1">
            <span className={`block truncate ${o.type === "near" || o.type === "filters" ? "font-semibold text-forest" : "font-semibold"}`}>
              {o.type === "recent" || o.type === "viewed" ? o.label : <Highlight text={o.label} query={parsed.rest} />}
            </span>
            {"sub" in o && <span className="block truncate text-sm text-muted">{o.sub}</span>}
            {o.type === "province" && <span className="block text-sm text-muted">Provincie</span>}
          </span>
        </li>
        </Fragment>
      ))}
    </ul>
  );

  return (
    <div>
      <form
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          if (open && options[active]) pick(options[active]);
          else void submit();
        }}
        className={hero ? "flex flex-col gap-2.5 sm:gap-3 lg:flex-row lg:items-end" : "flex items-center gap-2"}
      >
        <div className="relative min-w-0 flex-1">
          <label htmlFor={`${id}-q`} className={hero ? "mb-1.5 block text-sm font-semibold text-ink-2" : "sr-only"}>
            Waar wil je staan?
          </label>
          <div
            className={`flex min-w-0 items-center gap-2 rounded-lg text-ink ring-1 ring-field transition-shadow focus-within:ring-2 focus-within:ring-forest ${
              hero ? "h-12 bg-paper px-4 sm:h-14" : "h-11 bg-surface px-3 sm:h-12"
            }`}
          >
            <Icon name="search" size={hero ? 22 : 18} className="shrink-0 text-muted" />
            <input
              ref={inputRef}
              id={`${id}-q`}
              role="combobox"
              aria-expanded={open}
              aria-controls={listId}
              aria-autocomplete="list"
              aria-activedescendant={open ? `${id}-o${active}` : undefined}
              autoComplete="off"
              enterKeyHint="search"
              value={text}
              placeholder={hero ? "Plaats, adres of postcode" : "Plaats, adres of naam"}
              onChange={(e) => {
                setNotFound(null);
                setText(e.target.value);
                setOpen(true);
                setUsed(true);
                setActive(e.target.value ? 1 : 0);
              }}
              onFocus={() => {
                setOpen(true);
                setUsed(true);
              }}
              onBlur={() => setTimeout(() => setOpen(false), 150)}
              onKeyDown={(e) => {
                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  setOpen(true);
                  setActive((a) => Math.min(options.length - 1, a + 1));
                } else if (e.key === "ArrowUp") {
                  e.preventDefault();
                  setActive((a) => Math.max(0, a - 1));
                } else if (e.key === "Home" && open) {
                  e.preventDefault();
                  setActive(0);
                } else if (e.key === "End" && open) {
                  e.preventDefault();
                  setActive(options.length - 1);
                } else if (e.key === "Escape") setOpen(false);
              }}
              className={`h-full min-w-0 flex-1 bg-transparent placeholder:text-muted focus:outline-none ${hero ? "text-[17px]" : "text-base sm:text-[17px]"}`}
            />
            {text && (
              <button
                type="button"
                aria-label="Zoekveld leegmaken"
                onClick={() => {
                  setText("");
                  inputRef.current?.focus();
                }}
                className="-mr-1 grid h-11 w-11 shrink-0 place-items-center rounded-full text-muted hover:bg-sunken"
              >
                <Icon name="x" size={18} />
              </button>
            )}
          </div>
          {listbox}
        </div>
        {children}
        <button
          type="submit"
          className={`font-semibold transition-colors ${
            hero
              ? "flex h-12 w-full shrink-0 items-center justify-center gap-2 rounded-lg bg-forest px-8 text-base text-on-forest hover:bg-forest-deep sm:h-14 lg:w-auto"
              : "h-11 shrink-0 rounded-lg bg-forest px-4 text-on-forest hover:bg-forest-deep sm:h-12 sm:px-5"
          }`}
        >
          {hero && <Icon name="search" size={20} />}
          Zoeken
        </button>
      </form>

      {locating && <p className="mt-2 text-sm text-muted">Locatie bepalen…</p>}
      {resolving && (
        <p role="status" className="mt-2 text-sm text-muted">
          Adres opzoeken…
        </p>
      )}
      {notFound && (
        <p role="status" className="mt-2 rounded-lg bg-sunken px-3 py-2 text-sm text-ink-2">
          Geen plaats, adres of plek gevonden voor &quot;{notFound}&quot;. Probeer een andere schrijfwijze of een plaats in de buurt.
        </p>
      )}
      {geoError && (
        <p role="alert" className="mt-2 rounded-lg bg-alert-tint px-3 py-2 text-sm text-alert">
          {geoError}
        </p>
      )}
    </div>
  );
}
