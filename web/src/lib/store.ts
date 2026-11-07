"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import type { PlaceSummary, Town } from "./types";
import { cleanVehicle, type Vehicle } from "./vehicle";
import { cleanExpenses, type Expense } from "./expenses";
import { createLocalStore, onStorageFailure, storageFailed, type StoreOptions } from "./local-store";
import { clampNights, decodeTrip, decodeTripPlaces, encodeTrip, encodeTripPlaces, type TripPlacesCopy } from "./trip-storage";

// ── Kleine localStorage-store met abonnement (kern in local-store.ts) ───────

function createStore<T>(key: string, fallback: T, validate: (v: unknown) => v is T, codec?: StoreOptions<T>) {
  const store = createLocalStore<T>(key, fallback, {
    decode: codec?.decode ?? ((v) => (validate(v) ? v : undefined)),
    encode: codec?.encode,
  });
  const use = () => useSyncExternalStore(store.subscribe, store.read, () => fallback);
  return { read: store.read, write: store.write, use };
}

/** Of opslaan op dit toestel is mislukt (dan staat alles alleen in het geheugen, tot je de pagina sluit) */
export const useStorageFailed = () => useSyncExternalStore(onStorageFailure, storageFailed, () => false);

// ── Mijn reis ───────────────────────────────────────────────────────────────

export interface TripStop {
  slug: string;
  nights: number;
}

const EMPTY_TRIP: TripStop[] = [];
// Met versieveld (trip-storage.ts): oude opslag (een losse lijst) wordt bij het lezen omgezet, nachten begrensd
const tripStore = createStore<TripStop[]>("vrijstaan:reis", EMPTY_TRIP, (v): v is TripStop[] => decodeTrip(v) !== undefined, {
  decode: decodeTrip,
  encode: encodeTrip,
});
/** De reis zoals hij nu op dit toestel staat (buiten React, bijvoorbeeld na een await) */
export const readTrip = () => tripStore.read();
export const writeTrip = (next: TripStop[]) => tripStore.write(decodeTrip(next) ?? EMPTY_TRIP);

export function useTrip() {
  const stops = tripStore.use();
  const set = writeTrip;
  return {
    stops,
    has: (slug: string) => stops.some((s) => s.slug === slug),
    toggle: (slug: string) =>
      set(stops.some((s) => s.slug === slug) ? stops.filter((s) => s.slug !== slug) : [...stops, { slug, nights: clampNights(1) }]),
    remove: (slug: string) => set(stops.filter((s) => s.slug !== slug)),
    setNights: (slug: string, nights: number) =>
      set(stops.map((s) => (s.slug === slug ? { ...s, nights: clampNights(nights) } : s))),
    move: (from: number, to: number) => {
      if (to < 0 || to >= stops.length) return;
      const next = [...stops];
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item);
      set(next);
    },
    replace: writeTrip,
    clear: () => set([]),
  };
}

// ── Mijn camper (voertuigkluis) ───────────────────────────────────────────

const EMPTY_VEHICLE: Vehicle = {};
const vehicleStore = createStore<Vehicle>("vrijstaan:camper", EMPTY_VEHICLE, (v): v is Vehicle => typeof v === "object" && v !== null && !Array.isArray(v));
export const useVehicle = () => [vehicleStore.use(), (v: Vehicle) => vehicleStore.write(cleanVehicle(v))] as const;
export const readVehicle = () => vehicleStore.read();
export const writeVehicle = (v: Vehicle) => vehicleStore.write(cleanVehicle(v));

// ── Samen plannen (gedeelde reis) ─────────────────────────────────────────

export type SharedLink = { id: string; name: string; code: string };
const sharedStore = createStore<SharedLink | null>("vrijstaan:samen", null, (v): v is SharedLink | null =>
  v === null || (typeof v === "object" && typeof (v as SharedLink).id === "string" && typeof (v as SharedLink).code === "string"),
);
export const useSharedLink = () => [sharedStore.use(), sharedStore.write] as const;

// ── Uitgaven onderweg ──────────────────────────────────────────────────────

const EMPTY_EXPENSES: Expense[] = [];
const expenseStore = createStore<Expense[]>("vrijstaan:uitgaven", EMPTY_EXPENSES, (v): v is Expense[] => Array.isArray(v));
export const readExpenses = () => expenseStore.read();
export const writeExpenses = (next: Expense[]) => expenseStore.write(cleanExpenses(next));
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

/**
 * Header die de service worker (public/sw.js) meegeeft als een antwoord uit zijn cache komt: het moment waarop het
 * van de server kwam. Ontbreekt hij, dan is het antwoord vers.
 */
export const CACHED_AT_HEADER = "x-vrijstaan-opgeslagen";

type Loaded<T> = { data: T; cachedAt: string | null };

let placesPromise: Promise<Loaded<PlaceSummary[]>> | null = null;
let townsPromise: Promise<Loaded<Town[]>> | null = null;

function once<T>(url: string, slot: "places" | "towns"): Promise<Loaded<T>> {
  const p = fetch(url).then(async (r) => {
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const stamp = r.headers.get(CACHED_AT_HEADER);
    const cachedAt = stamp && !Number.isNaN(Date.parse(stamp)) ? new Date(stamp).toISOString() : null;
    return { data: (await r.json()) as T, cachedAt };
  });
  p.catch(() => {
    if (slot === "places") placesPromise = null;
    else townsPromise = null;
  });
  return p;
}

type LoaderState<T> = {
  data: T | null;
  error: boolean;
  /** Kwam de dataset uit de cache van de service worker: wanneer hij van de server kwam (ISO); anders null */
  cachedAt: string | null;
};

function useLoader<T>(get: () => Promise<Loaded<T>>) {
  const [state, setState] = useState<LoaderState<T>>({ data: null, error: false, cachedAt: null });
  useEffect(() => {
    let alive = true;
    get().then(
      ({ data, cachedAt }) => alive && setState({ data, error: false, cachedAt }),
      () => alive && setState({ data: null, error: true, cachedAt: null }),
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

// ── Reisplekken lokaal bewaren, zodat Mijn reis ook zonder bereik werkt ──────

const TRIP_PLACES = "vrijstaan:reis-plekken";
// Past de kopie niet in de opslag, dan in elk geval voor dit bezoek
let tripPlacesMemory: TripPlacesCopy | null = null;

/** Kopie van de reisplekken bewaren, met de datum waarop de gegevens van de server kwamen (`savedAt`, ISO) */
export function rememberTripPlaces(places: PlaceSummary[], slugs: string[], savedAt: string = new Date().toISOString()) {
  const copy = encodeTripPlaces(places, slugs, savedAt);
  tripPlacesMemory = { places: copy.places, savedAt };
  try {
    localStorage.setItem(TRIP_PLACES, JSON.stringify(copy));
    tripPlacesMemory = null;
  } catch {
    /* opslag vol of geblokkeerd: dan alleen tijdens dit bezoek */
  }
}

/** De bewaarde kopie met de datum van de gegevens (null bij een kopie van vóór november 2026) */
export function readTripPlacesCopy(): TripPlacesCopy {
  if (tripPlacesMemory) return tripPlacesMemory;
  try {
    return decodeTripPlaces(JSON.parse(localStorage.getItem(TRIP_PLACES) ?? "[]"));
  } catch {
    return { places: [], savedAt: null };
  }
}

export function readTripPlaces(): PlaceSummary[] {
  return readTripPlacesCopy().places;
}

// ── Welkom (onboarding) ─────────────────────────────────────────────────────

/** Verhoog de versie alleen als de uitleg echt anders wordt; dan ziet iedereen hem één keer opnieuw */
export const WELCOME_VERSION = "2026-11";
const welcomeStore = createStore<string | null>("vrijstaan:welkom", null, (v): v is string | null => v === null || typeof v === "string");
// Ook in het geheugen: werkt de opslag niet (geblokkeerd), dan geldt "gezien" in elk geval voor dit bezoek
let welcomeDone = false;
export const readWelcome = () => (welcomeDone ? WELCOME_VERSION : welcomeStore.read());
export const markWelcomeSeen = () => {
  welcomeDone = true;
  welcomeStore.write(WELCOME_VERSION);
};
/** true zolang de welkomstuitleg nog moet komen of open staat; de cookiebalk wacht daarop */
export function useWelcomeSeen(): boolean {
  return welcomeStore.use() !== null || welcomeDone;
}

// ── Plekpuls (één vraag na een bezoek) ─────────────────────────────────────

export type PulseAnswer = "ja" | "nee" | "weet-niet";
export type PulseRecord = { answer: PulseAnswer; at: string };
const EMPTY_PULSE: Record<string, PulseRecord> = {};
const pulseStore = createStore<Record<string, PulseRecord>>("vrijstaan:plekpuls", EMPTY_PULSE, (v): v is Record<string, PulseRecord> =>
  typeof v === "object" && v !== null && !Array.isArray(v),
);
/** Antwoorden blijven op dit toestel tot de koppeling met de bronnenlaag er is (README 2.0, concept A) */
export function usePulse() {
  const answers = pulseStore.use();
  return {
    answers,
    answer: (key: string, answer: PulseAnswer) => pulseStore.write({ ...answers, [key]: { answer, at: new Date().toISOString() } }),
  };
}
