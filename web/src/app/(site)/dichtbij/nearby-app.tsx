"use client";

import { useEffect, useMemo, useState } from "react";
import { distanceKm, formatKm, type LatLng } from "@/lib/geo";
import { formatDuration } from "@/lib/format";
import { applyFilters, DEFAULT_FILTERS, FACILITIES, type FacilityKey } from "@/lib/search";
import { usePlaces } from "@/lib/store";
import { useMediaQuery } from "@/lib/use-media";
import type { PlaceSummary } from "@/lib/types";
import { CardSkeleton, PlaceCard } from "@/components/place-ui";
import { PlaceMap } from "@/components/place-map";
import { Icon } from "@/components/icons";
import { Sign, type SignName } from "@/components/sign";

type Status = "idle" | "locating" | "denied" | "unavailable" | "ready";
type Drive = { km: number; seconds: number };

const MAX = 30;

export function NearbyApp() {
  const { data: places } = usePlaces();
  const [status, setStatus] = useState<Status>("idle");
  const [pos, setPos] = useState<LatLng | null>(null);
  const [facilities, setFacilities] = useState<FacilityKey[]>([]);
  const [drives, setDrives] = useState<Record<string, Drive> | null>(null);
  const [driveError, setDriveError] = useState(false);
  const wide = useMediaQuery("(min-width: 1024px)");

  function locate() {
    if (!("geolocation" in navigator)) return setStatus("unavailable");
    setStatus("locating");
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setPos({ lat: p.coords.latitude, lng: p.coords.longitude });
        setStatus("ready");
      },
      (err) => setStatus(err.code === err.PERMISSION_DENIED ? "denied" : "unavailable"),
      { enableHighAccuracy: false, timeout: 15000, maximumAge: 300000 },
    );
  }

  // Dichtstbijzijnde plekken hemelsbreed, daarna echte rijafstand
  const nearest = useMemo(() => {
    if (!places || !pos) return null;
    return applyFilters(places, { ...DEFAULT_FILTERS, facilities })
      .map((r) => ({ place: r.place, km: distanceKm(pos, r.place) }))
      .filter((r) => r.km < 80)
      .sort((a, b) => a.km - b.km)
      .slice(0, MAX);
  }, [places, pos, facilities]);

  useEffect(() => {
    if (!pos || !nearest?.length) return;
    let alive = true;
    const p = [`${pos.lat},${pos.lng}`, ...nearest.map((n) => `${n.place.lat},${n.place.lng}`)].join(";");
    fetch(`/api/distances?p=${p}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((m: { distancesM: (number | null)[]; durationsS: (number | null)[] }) => {
        if (!alive) return;
        const out: Record<string, Drive> = {};
        nearest.forEach((n, i) => {
          const d = m.distancesM[i];
          const t = m.durationsS[i];
          if (d != null && t != null) out[n.place.slug] = { km: d / 1000, seconds: t };
        });
        setDrives(out);
        setDriveError(false);
      })
      .catch(() => alive && setDriveError(true));
    return () => {
      alive = false;
    };
  }, [pos, nearest]);

  const sorted = useMemo(() => {
    if (!nearest) return null;
    if (!drives) return nearest;
    return [...nearest].sort((a, b) => (drives[a.place.slug]?.seconds ?? 1e9) - (drives[b.place.slug]?.seconds ?? 1e9));
  }, [nearest, drives]);

  if (status !== "ready" || !pos) {
    return (
      <div className="mx-auto max-w-xl px-4 pt-8 text-center sm:pt-14">
        <div className="sign-panel mx-auto grid h-28 w-28 place-items-center">
          <Icon name="locate" size={56} />
        </div>
        <h1 className="mt-8 font-sign text-3xl font-extrabold sm:text-4xl">Waar kun je vannacht staan?</h1>
        <p className="mt-3 text-lg text-ink-2">
          Deel je locatie en we zetten de plekken om je heen op een rij, gesorteerd op echte rijtijd.
        </p>
        <button
          type="button"
          onClick={locate}
          disabled={status === "locating"}
          className="mt-8 inline-flex h-14 items-center gap-2 rounded-xl bg-road px-7 font-sign text-lg font-bold text-on-road disabled:opacity-70"
        >
          <Icon name="locate" size={22} />
          {status === "locating" ? "Locatie bepalen…" : "Gebruik mijn locatie"}
        </button>
        {status === "denied" && (
          <p role="alert" className="mt-5 rounded-xl bg-alert-tint p-4 text-alert">
            Je hebt geen toegang tot je locatie gegeven. Sta het toe in de instellingen van je browser, of zoek op plaatsnaam via Zoeken.
          </p>
        )}
        {status === "unavailable" && (
          <p role="alert" className="mt-5 rounded-xl bg-alert-tint p-4 text-alert">
            Je locatie kon niet worden bepaald. Probeer het opnieuw of zoek op plaatsnaam.
          </p>
        )}
        <p className="mt-6 text-sm text-muted">Je locatie wordt alleen gebruikt om afstanden te berekenen en niet opgeslagen.</p>
      </div>
    );
  }

  const list = sorted ?? [];
  return (
    <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,0.85fr)]">
      <section className="min-w-0 px-3 pt-5 pb-8 sm:px-6">
        <div className="flex items-center justify-between gap-3">
          <h1 className="font-sign text-2xl font-extrabold sm:text-3xl">Dichtbij jou</h1>
          <button type="button" onClick={locate} className="flex h-11 items-center gap-1.5 font-semibold text-road">
            <Icon name="refresh" size={18} /> Opnieuw
          </button>
        </div>
        <ul className="no-scrollbar -mx-3 mt-3 flex gap-2 overflow-x-auto px-3 sm:mx-0 sm:flex-wrap sm:px-0">
          {FACILITIES.map((f) => {
            const on = facilities.includes(f.key);
            return (
              <li key={f.key} className="shrink-0">
                <button
                  type="button"
                  aria-pressed={on}
                  onClick={() => setFacilities((x) => (on ? x.filter((k) => k !== f.key) : [...x, f.key]))}
                  className="flex h-11 items-center gap-2 rounded-xl border-2 border-line bg-surface pr-3 pl-1.5 font-semibold aria-pressed:border-road aria-pressed:bg-road-tint aria-pressed:text-road"
                >
                  <Sign name={f.icon as SignName} size={28} state={on ? "on" : "unknown"} />
                  {f.label}
                </button>
              </li>
            );
          })}
        </ul>

        {!wide && list.length > 0 && (
          <PlaceMap places={list.map((r) => r.place)} user={pos} fitKey={`${pos.lat}-${list.length}`} className="mt-4 h-56 rounded-2xl outline-1 outline-line outline" />
        )}

        <p className="mt-5 text-ink-2" aria-live="polite">
          {!places
            ? "Plekken laden…"
            : list.length === 0
              ? "Geen plekken binnen 80 km met deze voorzieningen."
              : drives
                ? `${list.length} dichtstbijzijnde plekken, gesorteerd op rijtijd.`
                : driveError
                  ? `${list.length} dichtstbijzijnde plekken. Rijtijden zijn even niet beschikbaar; we tonen de afstand hemelsbreed.`
                  : `${list.length} plekken gevonden. Rijtijden berekenen…`}
        </p>
        {!places && <CardSkeleton />}
        <ul className="mt-3 space-y-3">
          {list.map(({ place, km }) => (
            <li key={place.id}>
              <DriveLabel drive={drives?.[place.slug]} km={km} />
              <PlaceCard place={place as PlaceSummary} />
            </li>
          ))}
        </ul>
      </section>
      {wide && (
        <aside className="sticky top-16 h-[calc(100dvh-4rem)] border-l border-line">
          <PlaceMap places={list.map((r) => r.place)} user={pos} fitKey={`${pos.lat}-${list.length}`} className="h-full w-full" />
        </aside>
      )}
    </div>
  );
}

function DriveLabel({ drive, km }: { drive?: Drive; km: number }) {
  return (
    <p className="mb-1.5 flex items-center gap-1.5 pl-1 text-sm font-semibold text-road">
      <Icon name="route" size={16} />
      {drive ? `${formatDuration(drive.seconds)} rijden, ${formatKm(drive.km)}` : `${formatKm(km)} hemelsbreed`}
    </p>
  );
}
