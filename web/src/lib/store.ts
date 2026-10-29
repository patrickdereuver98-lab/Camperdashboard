"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { bboxKey, snapBbox, type Bbox } from "./bbox";
import type { PlaceSummary, Town } from "./types";
import { cleanVehicle, type Vehicle } from "./vehicle";
import { cleanExpenses, type Expense } from "./expenses";

// ── Kleine localStorage-store met abonnement ───────────────────────────────

function createStore<T>(key: string, fallback: T, validate: (v: unknown) => v is T) {
  const listeners = new Set<() => void>();
  let cache: { raw: string | null; value: T } = { raw: null, value: fallback };

  const read = (): T => {
    let raw: string | null = null;
    try {
      raw = localStorage.getItem(key);
    } catch {
      return fallback;
    }
    if (raw === cache.raw) return cache.value;
    let value = fallback;
    try {
      const parsed = raw ? JSON.parse(raw) : fallback;
      if (validate(parsed)) value = parsed;
    } catch {
      /* kapotte opslag: begin opnieuw */
    }
    cache = { raw, value };
    return value;
  };

  const write = (next: T) => {
    try {
      localStorage.setItem(key, JSON.stringify(next));
    } catch {
      /* privévenster of volle opslag */
    }
    listeners.forEach((l) => l());
  };

  const subscribe = (l: () => void) => {
    listeners.add(l);
    const onStorage = (e: StorageEvent) => e.key === key && l();
    window.addEventListener("storage", onStorage);
    return () => {
      listeners.delete(l);
      window.removeEventListener("storage", onStorage);
    };
  };

  const use = () => useSyncExternalStore(subscribe, read, () => fallback);
  return { read, write, use };
}

// ── Mijn reis ───────────────────────────────────────────────────────────────

export interface TripStop {
  slug: string;
  nights: number;
}

const EMPTY_TRIP: TripStop[] = [];
const tripStore = createStore<TripStop[]>("vrijstaan:reis", EMPTY_TRIP, (v): v is TripStop[] =>
  Array.isArray(v) && v.every((s) => typeof s?.slug === "string"),
);

export function useTrip() {
  const stops = tripStore.use();
  const set = tripStore.write;
  return {
    stops,
    has: (slug: string) => stops.some((s) => s.slug === slug),
    toggle: (slug: string) =>
      set(stops.some((s) => s.slug === slug) ? stops.filter((s) => s.slug !== slug) : [...stops, { slug, nights: 1 }]),
    remove: (slug: string) => set(stops.filter((s) => s.slug !== slug)),
    setNights: (slug: string, nights: number) =>
      set(stops.map((s) => (s.slug === slug ? { ...s, nights: Math.max(1, Math.min(21, nights)) } : s))),
    move: (from: number, to: number) => {
      if (to < 0 || to >= stops.length) return;
      const next = [...stops];
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item);
      set(next);
    },
    replace: (next: TripStop[]) => set(next),
    clear: () => set([]),
  };
}

// ── Mijn camper (voertuigkluis) ───────────────────────────────────────────

const EMPTY_VEHICLE: Vehicle = {};
const vehicleStore = createStore<Vehicle>("vrijstaan:camper", EMPTY_VEHICLE, (v): v is Vehicle => typeof v === "object" && v !== null && !Array.isArray(v));
export const useVehicle = () => [vehicleStore.use(), (v: Vehicle) => vehicleStore.write(cleanVehicle(v))] as const;
export const readVehicle = () => vehicleStore.read();

// ── Samen plannen (gedeelde reis) ─────────────────────────────────────────

export type SharedLink = { id: string; name: string; code: string };
const sharedStore = createStore<SharedLink | null>("vrijstaan:samen", null, (v): v is SharedLink | null =>
  v === null || (typeof v === "object" && typeof (v as SharedLink).id === "string" && typeof (v as SharedLink).code === "string"),
);
export const useSharedLink = () => [sharedStore.use(), sharedStore.write] as const;

// ── Uitgaven onderweg ──────────────────────────────────────────────────────

const EMPTY_EXPENSES: Expense[] = [];
const expenseStore = createStore<Expense[]>("vrijstaan:uitgaven", EMPTY_EXPENSES, (v): v is Expense[] => Array.isArray(v));
export function useExpenses() {
  const list = expenseStore.use();
  const set = (next: Expense[]) => expenseStore.write(cleanExpenses(next));
  return {
    list,
    replace: set,
    add: (e: Expense) => set([e, ...list.filter((x) => x.id !== e.id)].sort((a, b) => b.date.localeCompare(a.date))),
    remove: (id: string) => set(list.filter((x) => x.id !== id)),
  };
}

// ── Reisinstellingen (verbruik, brandstofprijs) ────────────────────────────

export interface TripSettings {
  litersPer100: number;
  fuelPrice: number;
  persons: number;
  touristTax: number;
}

const DEFAULT_SETTINGS: TripSettings = { litersPer100: 11, fuelPrice: 1.85, persons: 2, touristTax: 1.5 };
const settingsStore = createStore<TripSettings>("vrijstaan:reisinstellingen", DEFAULT_SETTINGS, (v): v is TripSettings =>
  typeof v === "object" && v !== null && "litersPer100" in v,
);
export const useTripSettings = () => [settingsStore.use(), settingsStore.write] as const;

/** Vertrekdatum van de reis ("2026-11-06"); leeg = geen datums. Los van de instellingen, zodat oude opslag blijft werken */
const tripDateStore = createStore<string | null>("vrijstaan:reisdatum", null, (v): v is string | null => v === null || typeof v === "string");
export const useTripDate = () => [tripDateStore.use(), tripDateStore.write] as const;

// ── Cookie-toestemming ──────────────────────────────────────────────────────

export interface Consent {
  id: string;
  analytics: boolean;
  version: string;
  at: string;
}

export const CONSENT_VERSION = "2026-10";
const consentStore = createStore<Consent | null>("vrijstaan:toestemming", null, (v): v is Consent | null =>
  v === null || (typeof v === "object" && typeof (v as Consent).id === "string"),
);
export const useConsent = () => consentStore.use();
export const readConsent = () => consentStore.read();
export const writeConsent = (c: Consent) => consentStore.write(c);

// ── Dataset voor zoeken (één keer per sessie) ──────────────────────────────

let placesPromise: Promise<PlaceSummary[]> | null = null;
let townsPromise: Promise<Town[]> | null = null;

function once<T>(url: string, slot: "places" | "towns"): Promise<T> {
  const p = fetch(url).then((r) => {
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json() as Promise<T>;
  });
  p.catch(() => {
    if (slot === "places") placesPromise = null;
    else townsPromise = null;
  });
  return p;
}

function useLoader<T>(get: () => Promise<T>) {
  const [state, setState] = useState<{ data: T | null; error: boolean }>({ data: null, error: false });
  useEffect(() => {
    let alive = true;
    get().then(
      (data) => alive && setState({ data, error: false }),
      () => alive && setState({ data: null, error: true }),
    );
    return () => {
      alive = false;
    };
  }, [get]);
  return state;
}

const getPlaces = () => (placesPromise ??= once<PlaceSummary[]>("/api/places", "places"));
const getTowns = () => (townsPromise ??= once<Town[]>("/api/towns", "towns"));

export const usePlaces = () => useLoader(getPlaces);
export const useTowns = () => useLoader(getTowns);

// ── Plekken binnen de zichtbare kaart (PostGIS-bbox, per afgerond gebied gecachet) ──

const bboxCache = new Map<string, Promise<PlaceSummary[]>>();

function getBbox(key: string) {
  let p = bboxCache.get(key);
  if (!p) {
    p = fetch(`/api/places?bbox=${key}`).then((r) => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json() as Promise<PlaceSummary[]>;
    });
    p.catch(() => bboxCache.delete(key));
    bboxCache.set(key, p);
  }
  return p;
}

/** Plekken in het zichtbare kaartgebied; `null` zolang de kaart nog geen gebied heeft doorgegeven */
export function useViewportPlaces(bbox: Bbox | null) {
  const key = bbox ? bboxKey(snapBbox(bbox)) : null;
  const [state, setState] = useState<{ key: string | null; data: PlaceSummary[] | null }>({ key: null, data: null });
  useEffect(() => {
    if (!key) return;
    let alive = true;
    // Bij een fout blijft het vorige gebied staan (de kaart valt terug op de volledige zoekresultaten)
    getBbox(key).then((data) => alive && setState({ key, data }), () => {});
    return () => {
      alive = false;
    };
  }, [key]);
  return state.data;
}

// ── Reisplekken lokaal bewaren, zodat Mijn reis ook zonder bereik werkt ──────

const TRIP_PLACES = "vrijstaan:reis-plekken";

export function rememberTripPlaces(places: PlaceSummary[], slugs: string[]) {
  try {
    localStorage.setItem(TRIP_PLACES, JSON.stringify(places.filter((p) => slugs.includes(p.slug))));
  } catch {
    /* opslag vol of geblokkeerd: niet erg, dan alleen online */
  }
}

export function readTripPlaces(): PlaceSummary[] {
  try {
    const v = JSON.parse(localStorage.getItem(TRIP_PLACES) ?? "[]");
    return Array.isArray(v) ? (v as PlaceSummary[]) : [];
  } catch {
    return [];
  }
}
