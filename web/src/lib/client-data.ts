"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import type { Place } from "./types";

// ── Dataset (één keer per sessie opgehaald) ───────────────────────────────────

let placesPromise: Promise<Place[]> | null = null;

function loadPlaces(): Promise<Place[]> {
  placesPromise ??= fetch("/api/places")
    .then((r) => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json() as Promise<Place[]>;
    })
    .catch((err) => {
      placesPromise = null;
      throw err;
    });
  return placesPromise;
}

export function usePlaces(): { places: Place[] | null; error: boolean } {
  const [state, setState] = useState<{
    places: Place[] | null;
    error: boolean;
  }>({
    places: null,
    error: false,
  });
  useEffect(() => {
    let alive = true;
    loadPlaces().then(
      (places) => alive && setState({ places, error: false }),
      () => alive && setState({ places: null, error: true }),
    );
    return () => {
      alive = false;
    };
  }, []);
  return state;
}

// ── Mijn reis (localStorage) ──────────────────────────────────────────────────

export interface TripStop {
  slug: string;
  nights: number;
}

const KEY = "vrijstaan:reis";
const EMPTY: TripStop[] = [];
const listeners = new Set<() => void>();
let cache: { raw: string | null; value: TripStop[] } = {
  raw: null,
  value: EMPTY,
};

function read(): TripStop[] {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(KEY);
  } catch {
    return EMPTY;
  }
  if (raw === cache.raw) return cache.value;
  let value = EMPTY;
  try {
    const parsed = raw ? JSON.parse(raw) : [];
    if (Array.isArray(parsed))
      value = parsed.filter((s) => typeof s?.slug === "string");
  } catch {
    /* kapotte opslag: begin leeg */
  }
  cache = { raw, value };
  return value;
}

function write(next: TripStop[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* opslag niet beschikbaar (privévenster) */
  }
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => e.key === KEY && listener();
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

export function useTrip() {
  const stops = useSyncExternalStore(subscribe, read, () => EMPTY);
  return {
    stops,
    has: (slug: string) => stops.some((s) => s.slug === slug),
    toggle: (slug: string) =>
      write(
        stops.some((s) => s.slug === slug)
          ? stops.filter((s) => s.slug !== slug)
          : [...stops, { slug, nights: 1 }],
      ),
    remove: (slug: string) => write(stops.filter((s) => s.slug !== slug)),
    setNights: (slug: string, nights: number) =>
      write(
        stops.map((s) =>
          s.slug === slug
            ? { ...s, nights: Math.max(1, Math.min(14, nights)) }
            : s,
        ),
      ),
    move: (slug: string, dir: -1 | 1) => {
      const i = stops.findIndex((s) => s.slug === slug);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= stops.length) return;
      const next = [...stops];
      [next[i], next[j]] = [next[j], next[i]];
      write(next);
    },
    clear: () => write([]),
  };
}
