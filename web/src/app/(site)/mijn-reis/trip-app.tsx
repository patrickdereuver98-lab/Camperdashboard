"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { MotionConfig } from "motion/react";
import { useSession } from "@/lib/auth";
import { coarse, distanceKm, formatKm, type LatLng } from "@/lib/geo";
import { departureShort, eur, extraLabel, formatDuration, pluralize } from "@/lib/format";
import {
  readTripPlacesCopy,
  rememberTripPlaces,
  usePlaces,
  useRouteEnds,
  useRoutePrefs,
  useSharedLink,
  useTrip,
  useTripDate,
  useTrips,
  useTripSettings,
  useVehicle,
  linkedTripId,
  writeTripStops,
  type TripPoint,
  type TripStop,
} from "@/lib/store";
import { closedText, dayValue, parseDay, shortDay, tripDates } from "@/lib/trip-dates";
import { tripCosts } from "@/lib/trip-extras";
import { clampNights } from "@/lib/trip-merge";
import { planTrip, minutesText, type Leg, type LegPlan } from "@/lib/trip-plan";
import { fullDayLegs, overnightSuggestions } from "@/lib/trip-overnight";
import { legStartKm } from "@/lib/route-corridor";
import { optimizeOrder, routeCost, crowTable } from "@/lib/trip-optimize";
import { buildGpx, buildIcs, download, googleMapsParts, type ExportStop } from "@/lib/trip-export";
import { endPoint } from "@/lib/route-prefs";
import { routeOptionsQuery, type RouteOptions } from "@/lib/route-options";
import type { PlaceSummary } from "@/lib/types";
import { tripText, tripToday } from "@/lib/trip-share";
import { BrandMark, Icon } from "@/components/icons";
import { PlaceMap } from "@/components/place-map";
import { Sign } from "@/components/sign";
import { AddPoint } from "./add-point";
import { AlongRoute } from "./along-route";
import { EndCard, StartCard } from "./endpoint-card";
import { ExportPanel } from "./export-panel";
import { ExpensesPanel } from "./expenses-panel";
import { RoutePrefsPanel, vehicleText } from "./route-prefs-panel";
import { SharedCard } from "./shared-card";
import { LegRow, OvernightList, Reorder, StopItem } from "./stop-list";
import { NextStop, TripMoreMenu } from "./next-stop";
import { TripSwitcher } from "./trip-switcher";
import { assumedText, dataDateText, fromPriceNote, surchargeNote } from "./trip-notes";

type RouteData = {
  distanceM: number;
  durationS: number;
  legs: Leg[];
  geometry: [number, number][];
  provider?: "openrouteservice" | "osrm";
  vehicleApplied?: boolean;
  avoidApplied?: boolean;
};
type RouteFailure = "dienst" | "buiten" | "aantal" | "formaat";
type Stop = TripStop & { place: PlaceSummary };

/**
 * Een eigen punt als "plek" voor de lijst, de route en de planning: alleen sleutel, naam en ligging. Verder niets
 * invullen (geen prijs, vertrektijd of seizoen): onbekend blijft onbekend.
 */
const pointPlace = (slug: string, p: TripPoint) => ({ slug, name: p.name, lat: p.lat, lng: p.lng, town: "" }) as unknown as PlaceSummary;

/** Maximaal aantal punten dat de routeplanner in één keer rekent (beginpunt, 25 stops, eindpunt) */
const MAX_ROUTE_POINTS = 27;

const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n, 12);
const exact = (p: LatLng) => `${p.lat.toFixed(5)},${p.lng.toFixed(5)}`;


export function TripApp() {
  const trip = useTrip();
  const trips = useTrips();
  const [sharedLink] = useSharedLink();
  const linkedId = linkedTripId(sharedLink);
  const { session } = useSession();
  const router = useRouter();
  const params = useSearchParams();
  const { data: livePlaces, error: placesError, cachedAt } = usePlaces();
  // Zonder bereik: de plekken van je reis zoals ze de vorige keer zijn bewaard, met de datum van die gegevens
  const offlineCopy = useMemo(() => (placesError ? readTripPlacesCopy() : null), [placesError]);
  const places = livePlaces ?? offlineCopy?.places ?? null;
  // Kwamen de gegevens uit de cache van de app of uit de kopie op dit toestel: van wanneer ze zijn
  const dataDate = dataDateText(livePlaces ? cachedAt : offlineCopy?.savedAt);
  // Plekken van al je reizen (geen eigen punten): die bewaren we voor onderweg zonder bereik
  const slugsKey = [...new Set(trips.list.flatMap((t) => t.stops.filter((s) => !s.point).map((s) => s.slug)))].join(",");
  useEffect(() => {
    if (livePlaces) rememberTripPlaces(livePlaces, slugsKey.split(","), cachedAt ?? new Date().toISOString());
  }, [livePlaces, slugsKey, cachedAt]);
  // De plekpagina's van de reis vast op dit toestel zetten (service worker), zodat ze onderweg zonder bereik openen
  useEffect(() => {
    const t = setTimeout(() => {
      if (!("serviceWorker" in navigator)) return;
      const paths = slugsKey ? slugsKey.split(",").map((slug) => `/plek/${slug}`) : [];
      navigator.serviceWorker.controller?.postMessage({ type: "bewaar-plekken", paths });
    }, 1500);
    return () => clearTimeout(t);
  }, [slugsKey]);
  const [settings, setSettings] = useTripSettings();
  const [tripDate, setTripDate] = useTripDate();
  const [ends, setEnds] = useRouteEnds();
  const [prefs, setPrefs] = useRoutePrefs();
  const [vehicle] = useVehicle();
  const start = ends.start;
  const endPt = endPoint(ends);
  const [routeResult, setRouteResult] = useState<{ key: string; data: RouteData | null; failed: RouteFailure | null }>({ key: "", data: null, failed: null });
  const [shared, setShared] = useState(false);
  const [textCopied, setTextCopied] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  // Volgorde tijdens het slepen; pas bij loslaten gaat hij de opslag in (anders bij elke stap een nieuwe route)
  const [dragOrder, setDragOrder] = useState<string[] | null>(null);
  // Laatste volgorde ook in een ref: onDragEnd kan nog de waarde van het begin van het slepen zien
  const dragRef = useRef<string[] | null>(null);
  // Ongedaan maken van de laatste grote wijziging
  // `revert` ontbreekt als er niets terug te zetten is (bijvoorbeeld "al de kortste volgorde")
  // `trip`: in welke reis de wijziging was; open je intussen een andere reis, dan verdwijnt "Ongedaan maken"
  const [undo, setUndo] = useState<{ text: string; revert?: () => void; trip?: string } | null>(null);
  const [addingPoint, setAddingPoint] = useState(false);
  const [optimizing, setOptimizing] = useState(false);
  const [alongLeg, setAlongLeg] = useState<number | null>(null);
  const [alongOpen, setAlongOpen] = useState(false);

  useEffect(() => {
    if (!undo) return;
    const t = setTimeout(() => setUndo(null), 10000);
    return () => clearTimeout(t);
  }, [undo]);

  // Gedeelde reis: /mijn-reis?r=slug.2,slug.1, met vertrekdatum &d=2026-11-06
  const incoming = params.get("r");
  const incomingDate = parseDay(params.get("d")) ? params.get("d") : null;
  const incomingStops = useMemo<TripStop[] | null>(() => {
    if (!incoming) return null;
    return incoming
      .split(",")
      .map((s) => {
        const [slug, n] = s.split(".");
        return { slug, nights: clampNights(n === undefined ? 1 : n) };
      })
      .filter((s) => s.slug);
  }, [incoming]);

  const stops = useMemo<Stop[] | null>(() => {
    if (!places) return null;
    const bySlug = new Map(places.map((p) => [p.slug, p]));
    return trip.stops.map((s) => ({ ...s, place: s.point ? pointPlace(s.slug, s.point) : bySlug.get(s.slug)! })).filter((s) => s.place);
  }, [places, trip.stops]);

  const routeOptions = useMemo<RouteOptions>(
    () => ({
      avoid: prefs.avoid,
      ...(prefs.useVehicle ? { heightM: vehicle.heightM, weightKg: vehicle.weightKg, lengthM: vehicle.lengthM, widthM: vehicle.widthM } : {}),
    }),
    [prefs.avoid, prefs.useVehicle, vehicle.heightM, vehicle.weightKg, vehicle.lengthM, vehicle.widthM],
  );

  // Alle punten van de route: beginpunt, stops, eindpunt
  const waypoints = useMemo<LatLng[]>(
    () => (stops ? [...(start ? [start] : []), ...stops.map((s) => s.place), ...(endPt ? [endPt] : [])] : []),
    [stops, start, endPt],
  );

  const routeKey = useMemo(() => {
    if (!stops || waypoints.length < 2) return null;
    // Begin- en eindpunt en eigen punten kunnen je eigen locatie of huisadres zijn: alleen afgerond versturen
    const pts = [...(start ? [coarse(start)] : []), ...stops.map((s) => (s.point ? coarse(s.place) : exact(s.place))), ...(endPt ? [coarse(endPt)] : [])];
    return `${pts.join(";")}${routeOptionsQuery(routeOptions)}`;
  }, [stops, start, endPt, waypoints.length, routeOptions]);

  useEffect(() => {
    if (!routeKey) return;
    let alive = true;
    if (waypoints.length > MAX_ROUTE_POINTS) {
      queueMicrotask(() => alive && setRouteResult({ key: routeKey, data: null, failed: "aantal" }));
      return () => {
        alive = false;
      };
    }
    fetch(`/api/route?p=${routeKey}`)
      .then(async (r) => {
        if (r.ok) return { data: (await r.json()) as RouteData, failed: null };
        const body = (await r.json().catch(() => ({}))) as { reason?: RouteFailure };
        return { data: null, failed: body.reason ?? "dienst" };
      })
      .catch(() => ({ data: null, failed: "dienst" as const }))
      .then((res) => alive && setRouteResult({ key: routeKey, ...res }));
    return () => {
      alive = false;
    };
  }, [routeKey, waypoints.length]);
  // Tijdens het herberekenen blijft de vorige route zichtbaar
  const route = routeKey ? routeResult.data : null;
  const routeState = !routeKey ? "idle" : routeResult.key !== routeKey ? "loading" : routeResult.failed ? "error" : "idle";
  const routeFailure = routeState === "error" ? routeResult.failed : null;

  // Dagplanning: alleen met een berekende route (anders weten we de rijtijden niet)
  const plan = useMemo(() => {
    if (!stops || !route) return null;
    const legs = route.legs;
    const legOf = (i: number): Leg | undefined => (start ? legs[i] : i === 0 ? undefined : legs[i - 1]);
    return planTrip({ stops, legs: stops.map((_, i) => legOf(i)), endLeg: endPt ? legs[legs.length - 1] : undefined, prefs });
  }, [stops, route, start, endPt, prefs]);

  // Overnachten voorstellen waar een dag te lang wordt: per te lange etappe (positie in de route) hoogstens 3 plekken
  const overnight = useMemo(() => {
    // Alleen op de actuele route: tijdens herberekenen hoort de oude lijn bij andere stops
    if (!plan || !route || routeResult.key !== routeKey || !places || !stops || prefs.maxDriveMin <= 0) return null;
    const all = [
      ...plan.legs.map((l, i) => (l ? { routeLeg: start ? i : i - 1, plan: l } : null)),
      plan.endLeg ? { routeLeg: route.legs.length - 1, plan: plan.endLeg } : null,
    ].filter((x): x is { routeLeg: number; plan: LegPlan } => !!x);
    const targets = fullDayLegs(all.map((x) => x.plan)).map((i) => all[i]);
    if (!targets.length) return null;
    const inTrip = new Set(stops.map((s) => s.slug));
    return overnightSuggestions({
      geometry: route.geometry,
      waypoints,
      legStarts: legStartKm(route.geometry, waypoints),
      places: places.filter((p) => !inTrip.has(p.slug)),
      legs: targets,
      maxDriveMin: prefs.maxDriveMin,
    });
  }, [plan, route, routeResult.key, routeKey, places, stops, start, waypoints, prefs.maxDriveMin]);

  if (incomingStops && incomingStops.length) {
    // Eerst laten zien wat er gedeeld is; pas daarna toevoegen of vervangen
    const bySlug = new Map((places ?? []).map((p) => [p.slug, p]));
    const merged = [...trip.stops, ...incomingStops.filter((s) => !trip.has(s.slug))];
    // De vertrekdatum van de afzender reist mee: dan per stop de datums, en waar de plek volgens het seizoen dicht is
    const incomingStart = parseDay(incomingDate);
    const incomingDated = incomingStart ? tripDates(incomingStart, incomingStops.map((s) => ({ nights: s.nights, place: bySlug.get(s.slug) ?? {} }))) : null;
    // Vervangen of een lege reis: de datum van de gedeelde reis. Toevoegen: je eigen datum blijft, als je die had
    const take = (next: TripStop[], keepOwnDate: boolean) => {
      trip.replace(next);
      if (incomingDate && !(keepOwnDate && tripDate)) setTripDate(incomingDate);
      router.replace("/mijn-reis");
    };
    return (
      <div className="mx-auto max-w-xl px-4 pt-8 pb-10">
        <h1 className="font-display text-h1 font-semibold">Gedeelde reis</h1>
        <p className="mt-2 text-ink-2">
          Iemand heeft deze reis met {pluralize(incomingStops.length, "stop", "stops")} met je gedeeld
          {incomingDated && incomingDated.length > 0 ? `, van ${shortDay(incomingDated[0].arrive)} tot ${shortDay(incomingDated[incomingDated.length - 1].leave)}` : ""}.
        </p>
        <ol className="mt-5 space-y-2">
          {incomingStops.map((s, i) => {
            const p = bySlug.get(s.slug);
            const dates = incomingDated?.[i];
            return (
              <li key={s.slug} className="flex items-center gap-3 rounded-lg border border-line bg-surface p-3">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-forest font-display text-sm font-semibold text-on-forest">{i + 1}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{p?.name ?? s.slug}</span>
                  {dates && (
                    <span className="block text-sm font-semibold text-ink-2" data-testid="shared-stop-dates">
                      {shortDay(dates.arrive)} tot {shortDay(dates.leave)}
                      {dates.closedNights.length > 0 && <span className="block font-normal text-alert">Volgens het seizoen dicht op {closedText(dates.closedNights)}</span>}
                    </span>
                  )}
                  <span className="block truncate text-sm text-muted">
                    {p ? `${p.town}, ` : ""}
                    {s.nights === 0 ? "tussenstop" : pluralize(s.nights, "nacht", "nachten")}
                    {p?.priceEur !== undefined ? `, ${p.priceEur === 0 ? "gratis" : `${p.priceFrom ? "vanaf " : ""}${eur(p.priceEur)} per nacht`}` : ""}
                  </span>
                </span>
              </li>
            );
          })}
        </ol>
        <div className="mt-6 grid gap-2">
          {trip.stops.length > 0 ? (
            <>
              <button type="button" onClick={() => take(merged, true)} className="h-12 rounded-lg bg-forest px-6 font-semibold text-on-forest">
                Toevoegen aan mijn reis
              </button>
              <button type="button" onClick={() => take(incomingStops, false)} className="h-12 rounded-lg border border-line px-6 font-semibold">
                Mijn reis vervangen ({pluralize(trip.stops.length, "stop", "stops")} gaan weg)
              </button>
            </>
          ) : (
            <button type="button" onClick={() => take(incomingStops, false)} className="h-12 rounded-lg bg-forest px-6 font-semibold text-on-forest">
              Bewaar deze reis
            </button>
          )}
          {trip.stops.length > 0 && (
            <button
              type="button"
              onClick={() => {
                trips.create("Gedeelde reis", incomingStops);
                if (incomingDate && !tripDate) setTripDate(incomingDate);
                router.replace("/mijn-reis");
              }}
              className="h-12 rounded-lg border border-line px-6 font-semibold"
            >
              Als nieuwe reis bewaren
            </button>
          )}
          <button type="button" onClick={() => router.replace("/mijn-reis")} className="h-12 rounded-lg px-6 font-semibold text-forest underline">
            Niet bewaren
          </button>
        </div>
      </div>
    );
  }

  // "Ongedaan maken" na weghalen, omdraaien, slimste volgorde of toevoegen; ook als de reis daarna leeg is
  const undoToast = undo && (!undo.trip || undo.trip === trips.active.id) && (
        <div
          role="status"
          // Zelfde vorm als de melding "Bewaard in Mijn reis" (chrome.tsx), maar boven de cookiebalk: anders is
          // "Ongedaan maken" bij een eerste bezoek op de telefoon niet aan te tikken
          className="animate-toast fixed left-1/2 bottom-[calc(76px+env(safe-area-inset-bottom))] z-[60] flex w-[min(92vw,26rem)] items-center gap-2 rounded-lg bg-ink py-2 pr-1 pl-4 text-surface shadow-float lg:bottom-6"
          data-testid="undo-toast"
        >
          <p className="min-w-0 flex-1 text-sm">{undo.text}</p>
          {undo.revert && (
            <button
              type="button"
              onClick={() => {
                undo.revert?.();
                setUndo(null);
              }}
              className="flex h-11 shrink-0 items-center gap-1.5 rounded-md px-2 font-semibold underline"
            >
              <Icon name="undo" size={18} /> Ongedaan maken
            </button>
          )}
          <button type="button" onClick={() => setUndo(null)} aria-label="Melding sluiten" className="grid h-11 w-11 shrink-0 place-items-center">
            <Icon name="x" size={18} />
          </button>
        </div>
  );

  const onTripRemoved = (r: { trip: { name: string }; index: number; wasActive: boolean } & Parameters<typeof trips.restore>[0]) =>
    setUndo({ text: `${r.trip.name} is verwijderd.`, revert: () => trips.restore(r) });
  const addPoint = (p: TripPoint) => {
    const id = trips.active.id;
    const before = trip.stops;
    trip.addPoint(p);
    setAddingPoint(false);
    setUndo({ text: `${p.name} is toegevoegd als stop ${before.length + 1}.`, revert: () => writeTripStops(id, before), trip: id });
  };
  const lastPoint = stops && stops.length ? stops[stops.length - 1].place : (start ?? undefined);
  // Naam van de reis met de lijst met reizen; in de lege toestand is "Je reis is nog leeg" de kop
  const header = (asHeading: boolean) => (
    <div className="text-left">
      {asHeading ? (
        <h1 className="font-display text-h1 font-semibold" data-testid="trip-name">
          {trips.active.name}
        </h1>
      ) : (
        <p className="font-display text-h2 font-semibold" data-testid="trip-name">
          {trips.active.name}
        </p>
      )}
      <TripSwitcher trips={trips} linkedId={linkedId} signedIn={!!session} onRemoved={onTripRemoved} />
    </div>
  );

  if (trip.stops.length === 0) {
    return (
      <div className="mx-auto max-w-xl px-4 pt-6 sm:pt-10">
        {undoToast}
        {(trips.list.length > 1 || trips.active.name !== "Mijn reis") && <div className="mb-6">{header(false)}</div>}
        <div className="text-center">
        <BrandMark width={128} className="animate-rise mx-auto" />
        <h1 className="mt-4 font-display text-h1 font-semibold">Je reis is nog leeg</h1>
        <p className="mt-2 text-ink-2 sm:text-lg">
          Tik op het hartje bij een plek om hem te bewaren. Hier zet je ze op volgorde en zie je de echte rijtijd en wat de reis ongeveer kost.
        </p>
        <Link href="/zoeken" className="mt-8 inline-flex h-14 items-center gap-2 rounded-lg bg-forest px-7 font-display text-lg font-semibold text-on-forest hover:bg-forest-deep">
          <Icon name="search" size={21} /> Plekken zoeken
        </Link>
        {!addingPoint && (
          <button type="button" onClick={() => setAddingPoint(true)} className="mx-auto mt-3 flex h-11 items-center gap-1.5 font-semibold text-forest underline">
            <Icon name="pin" size={18} /> Eigen punt toevoegen
          </button>
        )}
        </div>
        {addingPoint && <AddPoint near={start ?? undefined} onAdd={addPoint} onClose={() => setAddingPoint(false)} />}
        {trips.list.length === 1 && trips.active.name === "Mijn reis" && <div className="mt-8">{header(false)}</div>}
      </div>
    );
  }


  if (!stops) return <p className="px-6 pt-12 text-center text-muted">Je reis laden…</p>;

  const routeLegs = route?.legs ?? [];
  // Etappe naar stop i; zonder beginpunt heeft de eerste stop geen etappe
  const legFor = (i: number): Leg | undefined => (start ? routeLegs[i] : i === 0 ? undefined : routeLegs[i - 1]);
  const totalKm = route ? route.distanceM / 1000 : null;
  const nights = stops.reduce((a, s) => a + s.nights, 0);
  // Met een vertrekdatum: per stop aankomst en vertrek, en de nachten waarop de plek volgens het seizoen dicht is
  const startDay = parseDay(tripDate);
  const dated = startDay ? tripDates(startDay, stops) : null;
  // Reisdag: vandaag weg of vannacht ergens (alleen met een vertrekdatum; UX-audit)
  const today = dated ? tripToday(dated, new Date()) : undefined;
  // Alleen bekende prijzen optellen; plekken zonder prijs noemen we apart (nooit een geschat bedrag).
  // Verplichte kosten per persoon en toeristenbelasting van de plek zelf tellen mee; andere toeslagen noemen we apart.
  const costs = tripCosts(stops.map((s) => ({ ...s, own: !!s.point })), settings.persons, settings.touristTax);
  // Eigen punten waar je overnacht: daarvan weten we de kosten niet, dat zeggen we erbij
  const ownNights = stops.filter((s) => s.point && s.nights > 0).length;
  const { stay, tax, unknownPriceStops } = costs;
  // Een vanaf-prijs is het laagste tarief: dan is ook het totaal een vanaf-bedrag
  const fromPrice = (costs.fromPriceStops ?? 0) > 0;
  const fromNote = fromPriceNote(costs.fromPriceStops);
  const assumed = costs.assumed ?? [];
  const fuel = totalKm !== null ? (totalKm * settings.litersPer100 * settings.fuelPrice) / 100 : null;
  const total = stay + (fuel ?? 0) + tax;
  const vehicleDims = vehicleText(vehicle);
  const wantsVehicle = prefs.useVehicle && !!(vehicle.heightM || vehicle.weightKg || vehicle.lengthM || vehicle.widthM);

  // De vertrekdatum gaat mee, zodat de ontvanger dezelfde datums ziet. Begin- en eindpunt, eigen punten en notities
  // niet (privé; een eigen punt kan je huisadres zijn).
  const shareUrl =
    typeof window !== "undefined"
      ? `${location.origin}/mijn-reis?r=${trip.stops.filter((s) => !s.point).map((s) => `${s.slug}.${s.nights}`).join(",")}${startDay && tripDate ? `&d=${tripDate}` : ""}`
      : "";
  const gmapsParts = googleMapsParts(
    stops.map((s) => s.place),
    start,
    endPt,
  );

  /** Wijziging met "Ongedaan maken" */
  const withUndo = (text: string, change: () => void) => {
    const before = trip.stops;
    const id = trips.active.id;
    change();
    setUndo({ text, revert: () => writeTripStops(id, before), trip: id });
  };

  const names = [...(start ? [start.label] : []), ...stops.map((s) => s.place.name), ...(endPt ? [ends.end === "start" ? "beginpunt" : endPt.label] : [])];
  const alongLegs = names.slice(1).map((to, i) => ({ from: names[i], to, durationS: routeLegs[i]?.durationS, distanceM: routeLegs[i]?.distanceM }));
  // Etappe in de route naar de plaats in de lijst stops waar een nieuwe plek tussen moet
  // De route telt alleen stops met bekende plekgegevens (`stops`); invoegen gebeurt in de hele lijst (`trip.stops`)
  const insertIndexForLeg = (leg: number) => {
    const i = Math.min(stops.length, leg + (start ? 0 : 1));
    if (i === 0) return 0;
    const at = trip.stops.findIndex((s) => s.slug === stops[i - 1].slug);
    return at < 0 ? i : at + 1;
  };
  const routeLegIndexOfStop = (i: number) => (start ? i : i - 1);
  const openAlong = (leg: number | null) => {
    setAlongLeg(leg);
    setAlongOpen(true);
    setTimeout(() => document.getElementById("langs-de-route")?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  };

  /** Slimste volgorde: begin- en eindpunt blijven staan; zonder beginpunt blijft de eerste stop de eerste */
  async function optimize() {
    if (!stops || stops.length < 2) return;
    setOptimizing(true);
    const pts: LatLng[] = [...(start ? [start] : []), ...stops.map((s) => s.place), ...(endPt && ends.end !== "start" ? [endPt] : [])];
    const startIdx = start ? 0 : null;
    const first = start ? 1 : 0;
    const stopIdx = stops.map((_, i) => first + i);
    const endIdx = ends.end === "start" && start ? 0 : endPt ? pts.length - 1 : null;
    let cost: (number | null)[][] | null = null;
    if (pts.length >= 3 && pts.length <= MAX_ROUTE_POINTS) {
      // Begin- en eindpunt en eigen punten alleen afgerond (zie routeKey)
      const own = (i: number) => i >= first && i < first + stops.length && !!stops[i - first].point;
      const key = pts.map((p, i) => ((i === 0 && start) || (endPt && ends.end !== "start" && i === pts.length - 1) || own(i) ? coarse(p) : exact(p))).join(";");
      try {
        const r = await fetch(`/api/matrix?p=${key}${routeOptionsQuery(routeOptions)}`);
        if (r.ok) cost = ((await r.json()) as { durationsS: (number | null)[][] }).durationsS;
      } catch {
        /* hemelsbreed */
      }
    }
    const byCrow = !cost;
    cost ??= crowTable(pts, distanceKm);
    // Zonder beginpunt houden we de eerste stop vast als begin
    const input = startIdx !== null ? { cost, start: startIdx, end: endIdx, stops: stopIdx } : { cost, start: stopIdx[0], end: endIdx, stops: stopIdx.slice(1) };
    const order = optimizeOrder(input);
    const full = startIdx !== null ? order : [stopIdx[0], ...order];
    const before = routeCost({ cost, start: startIdx, end: endIdx }, stopIdx);
    const after = routeCost({ cost, start: startIdx, end: endIdx }, full);
    setOptimizing(false);
    const next = full.map((idx) => trip.stops.find((s) => s.slug === stops[idx - first].slug)!).filter(Boolean);
    if (after >= before - (byCrow ? 0.5 : 60)) {
      setUndo({ text: "Je volgorde is al de kortste die we kunnen vinden." });
      return;
    }
    const saved = byCrow ? `${formatKm(before - after)} korter (hemelsbreed)` : `${minutesText((before - after) / 60)} minder rijden`;
    withUndo(`Volgorde aangepast: ${saved}.`, () => trip.replace(next));
  }

  function exportGpx() {
    if (!stops) return;
    const pts: ExportStop[] = [
      ...(start ? [{ name: "Beginpunt", lat: start.lat, lng: start.lng }] : []),
      ...stops.map((s, i) => ({
        name: `${i + 1}. ${s.place.name}`,
        lat: s.place.lat,
        lng: s.place.lng,
        // Je eigen bestand: ook je privénotities gaan mee
        desc: [s.point ? "eigen punt" : s.place.town, s.nights === 0 ? "tussenstop" : pluralize(s.nights, "nacht", "nachten"), departureShort(s.place), ...(s.notes ?? []).map((n) => n.text)]
          .filter(Boolean)
          .join(". "),
        ...(s.point ? {} : { url: `${location.origin}/plek/${s.slug}` }),
      })),
      ...(endPt ? [{ name: "Eindpunt", lat: endPt.lat, lng: endPt.lng }] : []),
    ];
    download("mijn-camperreis.gpx", buildGpx("Mijn camperreis", pts, route?.geometry), "application/gpx+xml");
  }

  function exportIcs() {
    if (!startDay || !dated || !stops) return;
    const stays = stops.map((s, i) => ({
      uid: `${s.slug}-${dayValue(dated[i].arrive)}`,
      name: s.place.name,
      arrive: dated[i].arrive,
      leave: dated[i].leave,
      nights: s.nights,
      location: s.point ? undefined : s.place.town,
      description: [departureShort(s.place), ...(s.notes ?? []).map((n) => n.text)].filter(Boolean).join("\n"),
      url: s.point ? undefined : `${location.origin}/plek/${s.slug}`,
      lat: s.place.lat,
      lng: s.place.lng,
    }));
    const drives = plan
      ? [...plan.legs.map((l, i) => (l ? { l, title: `Rijden naar ${stops[i].place.name}` } : null)), plan.endLeg ? { l: plan.endLeg, title: "Rijden naar het eindpunt" } : null]
          .filter((x): x is NonNullable<typeof x> => !!x)
          .map(({ l, title }, i) => ({ uid: `rit-${i}-${dayValue(addDays(startDay, l.day))}`, title, day: addDays(startDay, l.day), departMin: l.departMin, arriveMin: l.arriveMin }))
      : [];
    download("mijn-camperreis.ics", buildIcs(stays, drives), "text/calendar");
  }

  /** Overnachtingsvoorstellen bij een te lange etappe (positie in de route); toevoegen zet de plek vóór het etappe-eind */
  const suggestionsFor = (routeLeg: number) => {
    const o = overnight?.get(routeLeg);
    if (!o) return undefined;
    return (
      <OvernightList
        hits={o.hits}
        onAdd={(slug) => {
          const name = places?.find((p) => p.slug === slug)?.name ?? "De plek";
          const at = insertIndexForLeg(routeLeg);
          withUndo(`${name} is toegevoegd als stop ${at + 1}, voor 1 nacht.`, () => trip.insertAt(slug, at, 1));
        }}
      />
    );
  };

  const display = dragOrder ? dragOrder.map((slug) => stops.find((s) => s.slug === slug)).filter((s): s is Stop => !!s) : stops;
  const legDate = (day: number | undefined) => (startDay && day !== undefined ? addDays(startDay, day) : undefined);
  const notice =
    routeFailure === "buiten"
      ? "Een van de punten ligt buiten Europa. Die route kunnen we niet berekenen; afstanden zijn hemelsbreed."
      : routeFailure === "aantal"
        ? `De routeplanner rekent met maximaal ${MAX_ROUTE_POINTS - 2} stops tegelijk. Afstanden zijn hemelsbreed.`
        : routeFailure
          ? "De routeplanner is even niet bereikbaar; afstanden zijn hemelsbreed."
          : null;

  return (
    <div className="mx-auto max-w-6xl px-3 pt-3 pb-10 sm:px-6 sm:pt-5">
      <div className="flex flex-wrap items-end justify-between gap-x-3 gap-y-2">
        <div>
          {header(true)}
          {/* Eén regel met de hele reis (ontwerpronde 2): stops, nachten, afstand en het totaal, eerlijk over wat ontbreekt */}
          <p className="text-sm text-ink-2 sm:text-base" data-testid="trip-summary">
            {pluralize(stops.length, "stop", "stops")}, {pluralize(nights, "nacht", "nachten")}
            {route ? `, ${formatKm(route.distanceM / 1000)}` : ""}
            {total > 0 ? `, ${fromPrice ? "vanaf " : ""}${eur(total, true)}${unknownPriceStops > 0 ? ` + ${unknownPriceStops} onbekend` : ""}` : ""}
          </p>
        </div>
        {placesError ? (
          <p role="status" className="w-full rounded-lg bg-sunken px-4 py-3 text-sm text-ink-2" data-testid="trip-data-date">
            Geen verbinding. Je ziet de gegevens van je reis zoals ze de vorige keer zijn bewaard.
            {dataDate && ` Gegevens van ${dataDate}.`}
          </p>
        ) : (
          dataDate && (
            <p className="w-full text-sm text-muted" data-testid="trip-data-date">
              Gegevens van {dataDate}.
            </p>
          )
        )}
      </div>

      <NextStop stops={stops} dated={dated} today={today} />

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={async () => {
              if (navigator.share) await navigator.share({ title: "Mijn camperreis", url: shareUrl }).catch(() => undefined);
              else {
                await navigator.clipboard.writeText(shareUrl);
                setShared(true);
                setTimeout(() => setShared(false), 2500);
              }
            }}
          className="flex h-11 items-center gap-1.5 rounded-md border border-line bg-surface px-3.5 font-semibold hover:border-forest"
        >
          <Icon name={shared ? "check" : "share"} size={18} /> {shared ? "Link gekopieerd" : "Delen"}
        </button>
        <TripMoreMenu
          items={[
            { label: optimizing ? "Rekenen…" : "Slimste volgorde", icon: "route", onSelect: optimize, disabled: optimizing || stops.length < 2 },
            { label: "Omdraaien", icon: "swap", onSelect: () => withUndo("Volgorde omgedraaid.", () => trip.reverse()), disabled: stops.length < 2 },
            { label: "Als tekst delen", icon: "list", onSelect: async () => {
              // Platte lijst voor groepen waar niemand een link opent (UX-audit)
              // Eigen punten met alleen hun naam, en alleen gedeelde notities
              const text = tripText(stops.map((s) => ({ ...s, own: !!s.point })), dated);
              if (navigator.share) await navigator.share({ title: "Mijn camperreis", text }).catch(() => undefined);
              else {
                await navigator.clipboard.writeText(text).catch(() => undefined);
                setTextCopied(true);
                setTimeout(() => setTextCopied(false), 2500);
              }
            } },
            { label: "Statistieken", icon: "chart", href: "/mijn-reis/statistieken" },
          ]}
        />
        {textCopied && (
          <p role="status" className="text-sm font-semibold text-forest">
            Tekst gekopieerd
          </p>
        )}
      </div>

      <div className="mt-4 grid gap-6 sm:mt-6 sm:gap-8 lg:grid-cols-[1.2fr_1fr]">
        <div className="min-w-0">
          {/* Start en vertrekdatum in één regel, open te klappen (ontwerpronde 2), zodat de stops hoog op het scherm staan */}
          <details className="group mb-3 rounded-lg border border-line bg-surface" data-testid="trip-setup">
            <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-3 py-2 [&::-webkit-details-marker]:hidden">
              <span className="min-w-0 text-ink-2">
                <span className="font-semibold text-ink">Start:</span> {start ? (start.label ?? "eigen adres") : "eerste stop"}
                {", "}
                <span className="font-semibold text-ink">vertrek:</span> {startDay ? shortDay(startDay) : "geen datum"}
              </span>
              <span className="shrink-0 font-semibold text-forest underline underline-offset-2 group-open:hidden">Wijzig</span>
              <Icon name="chevronUp" size={20} className="hidden shrink-0 text-muted group-open:block" />
            </summary>
            <div className="space-y-3 border-t border-line p-3">
          <StartCard
            start={start}
            onChange={(s) => setEnds({ start: s, end: !s && ends.end === "start" ? "laatste" : ends.end })}
          />

          {/* Vertrekdatum: optioneel. Daarmee staat bij elke stop wanneer je er bent en of de plek dan open is */}
          <div className="rounded-lg border border-line bg-surface p-3">
            <div className="flex flex-wrap items-end gap-x-3 gap-y-2">
              <label className="min-w-0 flex-1">
                <span className="block font-semibold">Vertrekdatum</span>
                <input
                  type="date"
                  value={tripDate ?? ""}
                  min={dayValue(new Date())}
                  onChange={(e) => setTripDate(parseDay(e.target.value) ? e.target.value : null)}
                  className="mt-1 h-11 w-full rounded-lg border border-field bg-surface px-3 text-base focus:ring-2 focus:ring-forest focus:outline-none"
                />
              </label>
              {tripDate && (
                <button type="button" onClick={() => setTripDate(null)} aria-label="Vertrekdatum wissen" className="h-11 px-3 font-semibold text-forest underline">
                  Wissen
                </button>
              )}
            </div>
            {!tripDate && <p className="mt-1.5 text-sm text-muted">Kies een datum, dan zie je per stop wanneer je er bent en of de plek dan open is.</p>}
          </div>

            </div>
          </details>

          <p className="mb-1 text-sm text-muted">Sleep een stop aan de greep, of gebruik de pijltjes, om de volgorde te veranderen.</p>
          <MotionConfig reducedMotion="user">
            <Reorder.Group axis="y" values={display.map((s) => s.slug)} onReorder={(order: string[]) => {
                dragRef.current = order;
                setDragOrder(order);
              }}
              as="ol"
            >
              {display.map((s, i) => {
                const leg = dragOrder ? undefined : legFor(i);
                const lp = dragOrder ? undefined : plan?.legs[i];
                const hasLegRow = i > 0 || !!start;
                return (
                  <StopItem
                    key={s.slug}
                    stop={s}
                    index={i}
                    count={display.length}
                    dated={dragOrder ? undefined : dated?.[i]}
                    onDragEnd={() => {
                      const order = dragRef.current;
                      dragRef.current = null;
                      setDragOrder(null);
                      if (!order) return;
                      if (order.join() === trip.stops.map((x) => x.slug).join()) return;
                      trip.replace(order.map((slug) => trip.stops.find((x) => x.slug === slug)!).filter(Boolean));
                    }}
                    actions={{
                      setNights: trip.setNights,
                      saveNote: trip.saveNote,
                      removeNote: trip.removeNote,
                      move: trip.move,
                      remove: (slug) => withUndo(`${s.place.name} is uit je reis gehaald.`, () => trip.remove(slug)),
                    }}
                    legRow={
                      hasLegRow && !dragOrder ? (
                        <LegRow
                          leg={leg}
                          plan={lp}
                          date={legDate(lp?.day)}
                          from={i === 0 ? start! : stops[i - 1].place}
                          fromPlace={i > 0 && !stops[i - 1].point ? stops[i - 1].place : undefined}
                          to={s.place}
                          loading={routeState === "loading"}
                          maxDriveMin={prefs.maxDriveMin}
                          onFindStop={route ? () => openAlong(routeLegIndexOfStop(i)) : undefined}
                          suggestions={suggestionsFor(routeLegIndexOfStop(i))}
                        />
                      ) : hasLegRow ? (
                        <div className="h-4" />
                      ) : undefined
                    }
                  />
                );
              })}
            </Reorder.Group>
          </MotionConfig>

          {endPt && !dragOrder && (
            <LegRow
              leg={endPt && route ? routeLegs[routeLegs.length - 1] : undefined}
              plan={plan?.endLeg}
              date={legDate(plan?.endLeg?.day)}
              from={stops[stops.length - 1].place}
              fromPlace={stops[stops.length - 1].point ? undefined : stops[stops.length - 1].place}
              to={endPt}
              loading={routeState === "loading"}
              maxDriveMin={prefs.maxDriveMin}
              onFindStop={route ? () => openAlong(routeLegs.length - 1) : undefined}
              suggestions={suggestionsFor(routeLegs.length - 1)}
            />
          )}
          <EndCard end={ends.end} hasStart={!!start} onChange={(e) => setEnds({ ...ends, end: e })} />

          <div className="mt-4 grid grid-cols-2 gap-2">
            <Link href="/zoeken" className="flex h-12 items-center justify-center gap-2 rounded-lg border border-dashed border-line font-semibold text-forest hover:border-forest">
              <Icon name="plus" size={19} /> Plek toevoegen
            </Link>
            <button
              type="button"
              onClick={() => setAddingPoint(!addingPoint)}
              aria-expanded={addingPoint}
              className="flex h-12 items-center justify-center gap-2 rounded-lg border border-dashed border-line font-semibold text-forest hover:border-forest"
            >
              <Icon name="pin" size={19} /> Eigen punt
            </button>
            <button
              type="button"
              onClick={() => (alongOpen ? setAlongOpen(false) : openAlong(null))}
              disabled={!route || !places}
              aria-expanded={alongOpen}
              className="col-span-2 flex h-12 items-center justify-center gap-2 rounded-lg border border-line font-semibold hover:border-forest disabled:opacity-50"
            >
              <Icon name="map" size={19} /> Langs de route
            </button>
          </div>
          {/* Kaart van de route direct onder de stops (ontwerpronde 2), niet meer onderaan na de uitgaven */}
          <div className="mt-4 space-y-2">
          <PlaceMap
            places={stops.filter((s) => !s.point).map((s) => s.place)}
            pins={stops.flatMap((s, i) => (s.point ? [{ lat: s.point.lat, lng: s.point.lng, label: s.point.name, number: i + 1 }] : []))}
            route={route?.geometry ?? null}
            user={start}
            cluster={false}
            // Pas laden als de kaart bijna in beeld is: de tegels (±1,8 MB) verdrongen op trage 4G de rest (R65, 26 november)
            whenVisible
            fitKey={routeKey ?? stops.map((s) => s.slug).join()}
            className="h-80 rounded-lg border border-line"
          />
          <p className="flex items-center gap-2 text-sm text-muted">
            <Sign name="camper" size={22} />
            {route?.vehicleApplied ? `Route over de weg via OpenRouteService, met je camper (${vehicleDims}).` : "Route over de weg via OpenRouteService of OSRM."}
          </p>
          </div>
          {addingPoint && <AddPoint near={lastPoint} onAdd={addPoint} onClose={() => setAddingPoint(false)} />}
          {alongOpen && route && places && (
            <AlongRoute
              geometry={route.geometry}
              waypoints={waypoints}
              legs={alongLegs}
              places={places}
              exclude={new Set(trip.stops.map((s) => s.slug))}
              leg={alongLeg}
              onLeg={setAlongLeg}
              onAdd={(slug, leg) => {
                const name = places.find((p) => p.slug === slug)?.name ?? "De plek";
                withUndo(`${name} is toegevoegd als stop ${insertIndexForLeg(leg) + 1}.`, () => trip.insertAt(slug, insertIndexForLeg(leg)));
              }}
            />
          )}
        </div>

        <aside className="min-w-0 space-y-4">
          <div className="rounded-lg border border-line bg-surface p-4 sm:p-5">
            <h2 className="font-display text-h2 font-semibold">Overzicht</h2>
            <dl className="mt-3 space-y-2">
              <div className="flex justify-between">
                <dt className="text-ink-2">Rijden</dt>
                <dd className="text-right font-semibold">
                  {route ? `${formatKm(route.distanceM / 1000)}, ${formatDuration(route.durationS)}` : routeState === "loading" ? "Berekenen…" : waypoints.length < 2 ? "Voeg een stop toe" : "Niet beschikbaar"}
                  {plan && plan.driveDays > 0 && (
                    <span className="block text-sm font-normal text-ink-2" data-testid="drive-days">
                      {pluralize(plan.driveDays, "rijdag", "rijdagen")}, langste {minutesText(plan.longestDayMin)}
                      {plan.overLimitCount > 0 && <span className="block text-muted">{pluralize(plan.overLimitCount, "etappe", "etappes")} langer dan je per dag wilt</span>}
                      {plan.arrivalIssues > 0 && <span className="block text-muted">{pluralize(plan.arrivalIssues, "aankomst", "aankomsten")} buiten de aankomsttijden</span>}
                    </span>
                  )}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="shrink-0 text-ink-2">Overnachtingen{fromPrice ? " (vanaf)" : ""}</dt>
                <dd className="text-right font-semibold">
                  {eur(stay, true)}
                  {!!costs.perPerson && (
                    <span className="block text-sm font-normal text-muted" data-testid="per-person">
                      waarvan {eur(costs.perPerson, true)} toeslag per persoon
                    </span>
                  )}
                  {unknownPriceStops > 0 && (
                    <span className="block text-sm font-normal text-muted">
                      + {unknownPriceStops} {unknownPriceStops === 1 ? "plek" : "plekken"} zonder bekende prijs
                    </span>
                  )}
                  {ownNights > 0 && (
                    <span className="block text-sm font-normal text-muted" data-testid="own-nights">
                      {ownNights === 1 ? "1 eigen punt telt niet mee" : `${ownNights} eigen punten tellen niet mee`}
                    </span>
                  )}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-ink-2">Brandstof*</dt>
                <dd className="font-semibold">{fuel === null ? "–" : eur(fuel, true)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-ink-2">Toeristenbelasting*</dt>
                <dd className="font-semibold">{eur(tax, true)}</dd>
              </div>
              <div className="flex justify-between border-t border-line pt-2">
                <dt className="font-display text-lg font-semibold">{fuel === null ? "Totaal, zonder brandstof*" : "Totaal met jouw schatting*"}</dt>
                {/* Eerlijk totaal: ontbreken er prijzen, dan staat dat in het bedrag zelf ("€ 84 + 2 onbekend"), zodat
                    het nooit volledig lijkt (UX-audit, implementatieplan) */}
                <dd className="text-right font-display text-2xl font-semibold" data-testid="trip-total">
                  {fromPrice && <span className="block text-sm font-normal tracking-normal text-muted">vanaf</span>}
                  {eur(total, true)}
                  {unknownPriceStops > 0 && <span className="text-lg text-muted"> + {unknownPriceStops} onbekend</span>}
                  {costs.listed.length > 0 && <span className="block text-sm font-normal tracking-normal text-muted">+ toeslagen, niet meegeteld</span>}
                </dd>
              </div>
            </dl>
            <p className="mt-2 text-sm text-muted">
              * Berekend met jouw uitgangspunten hieronder. Noemt een plek zelf een bedrag voor de toeristenbelasting, dan
              rekenen we met dat bedrag en niet met jouw schatting. Gratis plekken en plekken waar de belasting al in de prijs
              zit tellen niet mee. Toeslagen per persoon tellen mee voor {pluralize(Math.max(1, Math.round(settings.persons)), "persoon", "personen")}.
            </p>
            {(assumed.length > 0 || fromNote) && (
              <div className="mt-3 rounded-lg bg-sunken p-3 text-sm" data-testid="assumptions">
                <p className="font-semibold">Zo hebben we gerekend</p>
                {fromNote && <p className="mt-0.5 text-ink-2">{fromNote}</p>}
                {assumed.length > 0 && (
                  <ul className="mt-2 space-y-1.5">
                    {assumed.map(({ index, extras }) => (
                      <li key={stops[index].slug}>
                        <span className="font-semibold">{stops[index].place.name}:</span>{" "}
                        <span className="text-ink-2">{extras.map(assumedText).join("; ")}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
            {costs.listed.length > 0 && (
              <div className="mt-3 rounded-lg bg-sunken p-3 text-sm" data-testid="surcharges">
                <p className="font-semibold">+ toeslagen, niet meegeteld</p>
                <p className="mt-0.5 text-ink-2">{surchargeNote(costs.listed.flatMap((l) => l.extras))}</p>
                <ul className="mt-2 space-y-1.5">
                  {costs.listed.map(({ index, extras }) => (
                    <li key={stops[index].slug}>
                      <span className="font-semibold">{stops[index].place.name}:</span>{" "}
                      <span className="text-ink-2">{extras.map((x) => `${x.label.toLowerCase()} ${extraLabel(x)}`).join(", ")}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {notice && (
              <p className="mt-2 text-sm text-alert" data-testid="route-notice">
                {notice}
              </p>
            )}
            {route && wantsVehicle && route.vehicleApplied === false && (
              <p className="mt-2 text-sm text-muted" data-testid="vehicle-not-applied">
                De routeplanner rekent nu zonder je camper ({vehicleDims}). Let zelf op lage bruggen en gewichtsgrenzen.
              </p>
            )}
            {route && prefs.avoid.length > 0 && route.avoidApplied === false && (
              <p className="mt-2 text-sm text-muted">Wat je wilt vermijden kon de routeplanner nu niet meenemen.</p>
            )}

            <details className="mt-4 rounded-lg bg-sunken p-4">
              <summary className="-my-2.5 cursor-pointer py-2.5 font-semibold">Uitgangspunten aanpassen</summary>
              <div className="mt-3 grid grid-cols-2 gap-3">
                {(
                  [
                    ["litersPer100", "Verbruik (l/100 km)", 0.5],
                    ["fuelPrice", "Brandstof (€/l)", 0.01],
                    ["persons", "Personen", 1],
                    ["touristTax", "Toeristenbelasting p.p.", 0.1],
                  ] as const
                ).map(([k, label, step]) => (
                  <label key={k} className="block">
                    <span className="mb-1 block text-sm font-semibold">{label}</span>
                    <input
                      type="number"
                      inputMode="decimal"
                      step={step}
                      min={0}
                      value={settings[k]}
                      onChange={(e) => setSettings({ ...settings, [k]: Number(e.target.value) || 0 })}
                      className="h-11 w-full rounded-lg border border-field bg-surface px-3"
                    />
                  </label>
                ))}
              </div>
            </details>

            <RoutePrefsPanel prefs={prefs} onChange={setPrefs} vehicle={vehicle} />

            <ExportPanel parts={gmapsParts} onGpx={exportGpx} onIcs={exportIcs} canIcs={!!startDay} />
          </div>

          <SharedCard />

          <ExpensesPanel stops={stops.map((s) => ({ slug: s.slug, name: s.place.name }))} budget={{ stay, fuel, tax }} />

          {confirmClear ? (
            <div role="alert" className="animate-fade-in rounded-lg bg-alert-tint p-4">
              <p className="font-semibold text-alert">Je hele reis wissen? Dit kun je niet ongedaan maken.</p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button type="button" onClick={() => setConfirmClear(false)} className="h-12 rounded-lg border border-line bg-surface font-semibold">
                  Annuleren
                </button>
                <button
                  type="button"
                  onClick={() => {
                    trip.clear();
                    setConfirmClear(false);
                  }}
                  className="h-12 rounded-lg bg-alert font-semibold text-surface"
                >
                  Ja, wissen
                </button>
              </div>
            </div>
          ) : (
            <button type="button" onClick={() => setConfirmClear(true)} className="h-11 font-semibold text-alert underline">
              Reis wissen
            </button>
          )}
        </aside>
      </div>

      {undoToast}
    </div>
  );
}
