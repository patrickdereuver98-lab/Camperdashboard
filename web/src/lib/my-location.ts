"use client";

import { useEffect, useSyncExternalStore } from "react";
import type { LatLng } from "./geo";

/**
 * Je eigen locatie, gedeeld door alle kaarten op de pagina, voor "12 km van je locatie". Blijft op het apparaat:
 * de afstand wordt hier berekend, er gaat niets naar de server. Is locatie al eerder toegestaan, dan vragen we
 * hem stil op; anders pas na een tik op "Afstand tonen".
 */
type State = { status: "idle" | "locating" | "ready" | "denied" | "unavailable"; pos: LatLng | null };

let state: State = { status: "idle", pos: null };
let checked = false;
const listeners = new Set<() => void>();

function set(next: State) {
  state = next;
  for (const l of listeners) l();
}

export function requestMyLocation() {
  if (typeof navigator === "undefined" || !("geolocation" in navigator)) return set({ status: "unavailable", pos: null });
  if (state.status === "locating" || state.status === "ready") return;
  set({ ...state, status: "locating" });
  navigator.geolocation.getCurrentPosition(
    (p) => set({ status: "ready", pos: { lat: p.coords.latitude, lng: p.coords.longitude } }),
    (err) => set({ status: err.code === err.PERMISSION_DENIED ? "denied" : "unavailable", pos: null }),
    { enableHighAccuracy: false, timeout: 15000, maximumAge: 600000 },
  );
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
const SERVER: State = { status: "idle", pos: null };

export function useMyLocation(): State {
  useEffect(() => {
    if (checked) return;
    checked = true;
    navigator.permissions
      ?.query({ name: "geolocation" as PermissionName })
      .then((r) => {
        if (r.state === "granted") requestMyLocation();
        else if (r.state === "denied") set({ status: "denied", pos: null });
      })
      .catch(() => undefined);
  }, []);
  return useSyncExternalStore(subscribe, () => state, () => SERVER);
}
