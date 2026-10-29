"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { coarse, distanceKm, formatKm, type LatLng } from "@/lib/geo";
import { formatDuration } from "@/lib/format";
import { applyFilters, arrivalClosed, confirmedFirst, DEFAULT_FILTERS, FACILITIES, isOpenOn, nowInNL, type FacilityKey } from "@/lib/search";
import { usePlaces, useVehicle } from "@/lib/store";
import { applyVehicle } from "@/lib/vehicle";
import { useMediaQuery } from "@/lib/use-media";
import type { PlaceSummary } from "@/lib/types";
import { CardSkeleton, MapPick, PlaceCard } from "@/components/place-ui";
import { PlaceMap } from "@/components/place-map";
import { Icon } from "@/components/icons";
import { Landscape } from "@/components/landscape";
import { Sign, type SignName } from "@/components/sign";

type Status = "idle" | "locating" | "denied" | "unavailable" | "ready";
type Drive = { km: number; seconds: number };

const MAX = 30;
// Wat je onderweg het eerst wilt weten staat vooraan
const NEARBY_ORDER: FacilityKey[] = ["power", "dogs", "water", "dumpStation", "toilet", "shower", "wifi"];

export function NearbyApp() {
  const { data: places } = usePlaces();
  const [status, setStatus] = useState<Status>("idle");
  const [pos, setPos] = useState<LatLng | null>(null);
  const [facilities, setFacilities] = useState<FacilityKey[]>([]);
  // Voor "vannacht" standaard aan: verbergt alleen plekken die nu zeker dicht zijn
  const [openNow, setOpenNow] = useState(true);
  // Ook standaard aan: verbergt alleen plekken waar de laatste aankomsttijd van vandaag al voorbij is
  const [arriveNow, setArriveNow] = useState(true);
  const [departure, setDeparture] = useState<"vrij" | "uitslapers" | undefined>(undefined);
  // Lengte uit Mijn camper, net als bij Zoeken; met de chip zet je het filter uit
  const [vehicle] = useVehicle();
  const [lengthOff, setLengthOff] = useState(false);
  const [drives, setDrives] = useState<Record<string, Drive> | null>(null);
  const [driveError, setDriveError] = useState(false);
  const wide = useMediaQuery("(min-width: 1024px)");
  // Telefoon: gekozen stip als paneel onderaan de kaart (concept "Kaart eerst")
  const [picked, setPicked] = useState<string | null>(null);

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

  // Locatie al eerder toegestaan: meteen zoeken, zonder extra tik
  const locateRef = useRef(locate);
  useEffect(() => {
    locateRef.current = locate;
  });
  useEffect(() => {
    navigator.permissions
      ?.query({ name: "geolocation" as PermissionName })
      .then((r) => r.state === "granted" && locateRef.current())
      .catch(() => undefined);
  }, []);

  // Dichtstbijzijnde plekken hemelsbreed, daarna echte rijafstand
  const nearest = useMemo(() => {
    if (!places || !pos) return null;
    return applyFilters(places, applyVehicle({ ...DEFAULT_FILTERS, facilities, openNow, departure, lengthOff: lengthOff || undefined }, vehicle))
      .filter((r) => !arriveNow || !arrivalClosed(r.place, nowInNL()))
      .map((r) => ({ place: r.place, km: distanceKm(pos, r.place) }))
      .filter((r) => r.km < 80)
      .sort((a, b) => a.km - b.km || confirmedFirst(a.place, b.place))
      .slice(0, MAX);
  }, [places, pos, facilities, openNow, arriveNow, departure, vehicle, lengthOff]);

  useEffect(() => {
    if (!pos || !nearest?.length) return;
    let alive = true;
    const p = [coarse(pos), ...nearest.map((n) => `${n.place.lat},${n.place.lng}`)].join(";");
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
    const now = new Date();
    // Rijtijd gaat voor; bij gelijke rijtijd staat bevestigd "geen vaste vertrektijd" eerst
    const byDrive = drives
      ? [...nearest].sort((a, b) => (drives[a.place.slug]?.seconds ?? 1e9) - (drives[b.place.slug]?.seconds ?? 1e9) || confirmedFirst(a.place, b.place))
      : nearest;
    // Zeker gesloten plekken onderaan
    return [...byDrive.filter((r) => isOpenOn(r.place, now) !== false), ...byDrive.filter((r) => isOpenOn(r.place, now) === false)];
  }, [nearest, drives]);

  if (status !== "ready" || !pos) {
    return (
      <div className="mx-auto max-w-xl px-4 pt-8 text-center sm:pt-14">
        <div className="animate-rise relative mx-auto h-36 overflow-hidden rounded-2xl shadow-lift">
          <Landscape seed="dichtbij" variant={0} van wide className="absolute inset-0 h-full w-full" />
        </div>
        <h1 className="mt-6 font-display text-2xl font-semibold sm:text-4xl">Waar kun je vannacht staan?</h1>
        <p className="mt-2 text-ink-2 sm:text-lg">
          Deel je locatie en we zetten de plekken om je heen op een rij, gesorteerd op echte rijtijd.
        </p>
        <button
          type="button"
          onClick={locate}
          disabled={status === "locating"}
          className="mt-8 inline-flex h-14 items-center gap-2 rounded-lg bg-forest hover:bg-forest-deep px-7 font-display text-lg font-semibold text-on-forest disabled:opacity-60"
        >
          <Icon name="locate" size={22} />
          {status === "locating" ? "Locatie bepalen…" : "Gebruik mijn locatie"}
        </button>
        {(status === "denied" || status === "unavailable") && (
          <div role="alert" className="mt-5 rounded-xl bg-alert-tint p-4 text-alert">
            <p>
              {status === "denied"
                ? "Je hebt geen toegang tot je locatie gegeven. Sta het toe in de instellingen van je browser, of zoek op plaatsnaam."
                : "Je locatie kon niet worden bepaald. Probeer het opnieuw of zoek op plaatsnaam."}
            </p>
            <Link href="/zoeken" className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-lg bg-surface px-4 font-semibold text-ink shadow-low">
              <Icon name="search" size={18} /> Zoek op plaats
            </Link>
          </div>
        )}
        <p className="mt-6 text-sm text-muted">Je locatie wordt alleen gebruikt om afstanden te berekenen en niet opgeslagen.</p>
      </div>
    );
  }

  const list = sorted ?? [];
  const pickedPlace = picked ? list.find((r) => r.place.slug === picked)?.place : undefined;
  return (
    <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,0.85fr)]">
      <section className="min-w-0 px-3 pt-3 pb-8 sm:px-6 sm:pt-5">
        <div className="flex items-center justify-between gap-3">
          <h1 className="font-display text-xl font-semibold sm:text-3xl">Dichtbij jou</h1>
          <button type="button" onClick={locate} className="flex h-11 items-center gap-1.5 font-semibold text-forest">
            <Icon name="refresh" size={18} /> Opnieuw
          </button>
        </div>
        <ul className="no-scrollbar scroll-fade -mx-3 mt-1 flex gap-2 overflow-x-auto px-3 pb-1 sm:mx-0 sm:mt-3 sm:flex-wrap sm:px-0">
          <li className="shrink-0">
            <button
              type="button"
              aria-pressed={openNow}
              onClick={() => setOpenNow((o) => !o)}
              className="flex h-11 items-center gap-1.5 rounded-full border border-line bg-surface pr-3.5 pl-1.5 font-semibold aria-pressed:border-forest aria-pressed:bg-forest-tint aria-pressed:text-forest"
            >
              <Sign name="calendar" size={24} state={openNow ? "on" : "unknown"} />
              Nu open
            </button>
          </li>
          <li className="shrink-0">
            <button
              type="button"
              aria-pressed={arriveNow}
              onClick={() => setArriveNow((o) => !o)}
              className="flex h-11 items-center gap-1.5 rounded-full border border-line bg-surface pr-3.5 pl-1.5 text-[0.9375rem] font-semibold aria-pressed:border-forest aria-pressed:bg-forest-tint aria-pressed:text-forest"
            >
              <Sign name="clock" size={24} state={arriveNow ? "on" : "unknown"} />
              Nu nog aankomen
            </button>
          </li>
          {vehicle.lengthM && (
            <li className="shrink-0">
              <button
                type="button"
                aria-pressed={!lengthOff}
                onClick={() => setLengthOff((o) => !o)}
                className="flex h-11 items-center gap-1.5 rounded-full border border-line bg-surface pr-3.5 pl-1.5 font-semibold aria-pressed:border-forest aria-pressed:bg-forest-tint aria-pressed:text-forest"
              >
                <Sign name="length" size={24} state={lengthOff ? "unknown" : "on"} />
                Mijn camper ({String(vehicle.lengthM).replace(".", ",")} m)
              </button>
            </li>
          )}
          {(
            [
              ["vrij", "Zonder vertrektijd"],
              ["uitslapers", "Uitslapers"],
            ] as const
          ).map(([g, label]) => (
            <li key={g} className="shrink-0">
              <button
                type="button"
                aria-pressed={departure === g}
                onClick={() => setDeparture((d) => (d === g ? undefined : g))}
                className="flex h-11 items-center gap-1.5 rounded-full border border-line bg-surface pr-3.5 pl-1.5 font-semibold aria-pressed:border-forest aria-pressed:bg-forest-tint aria-pressed:text-forest"
              >
                <Sign name="clock" size={24} state={departure === g ? "on" : "unknown"} />
                {label}
              </button>
            </li>
          ))}
          {NEARBY_ORDER.map((key) => FACILITIES.find((f) => f.key === key)!).map((f) => {
            const on = facilities.includes(f.key);
            return (
              <li key={f.key} className="shrink-0">
                <button
                  type="button"
                  aria-pressed={on}
                  onClick={() => setFacilities((x) => (on ? x.filter((k) => k !== f.key) : [...x, f.key]))}
                  className="flex h-11 items-center gap-1.5 rounded-full border border-line bg-surface pr-3.5 pl-1.5 font-semibold aria-pressed:border-forest aria-pressed:bg-forest-tint aria-pressed:text-forest"
                >
                  <Sign name={f.icon as SignName} size={24} state={on ? "on" : "unknown"} />
                  {f.label}
                </button>
              </li>
            );
          })}
        </ul>

        {/* Telefoon: kaart eerst, groot en van rand tot rand; de lijst ligt eronder als een sheet die je omhoog veegt */}
        {!wide && list.length > 0 && (
          <div className="relative -mx-3 mt-3 h-[52dvh] min-h-80 sm:-mx-6">
            <PlaceMap
              places={list.map((r) => r.place)}
              user={pos}
              fitKey={`${pos.lat}-${list.length}`}
              highlight={picked}
              onSelect={setPicked}
              popup={false}
              className="h-full w-full"
            />
            {pickedPlace && <MapPick key={pickedPlace.slug} place={pickedPlace as PlaceSummary} onClose={() => setPicked(null)} />}
          </div>
        )}

        <div className={!wide && list.length > 0 ? "relative z-10 -mx-3 -mt-4 rounded-t-2xl bg-paper px-3 pt-2 shadow-float sm:-mx-6 sm:px-6" : ""}>
        {!wide && list.length > 0 && <span aria-hidden="true" className="mx-auto mb-1 block h-1 w-10 rounded-full bg-line" />}
        <p className="mt-3 text-sm text-ink-2" aria-live="polite">
          {!places
            ? "Plekken laden…"
            : list.length === 0
              ? "Geen plekken binnen 80 km met deze keuzes."
              : drives
                ? `${list.length} plekken, dichtstbij eerst (rijtijd).`
                : driveError
                  ? `${list.length} plekken, dichtstbij eerst. Rijtijden lukken nu niet, je ziet de afstand hemelsbreed.`
                  : `${list.length} plekken gevonden. Rijtijden berekenen…`}
          {openNow && list.length > 0 && " Wat nu dicht is, staat er niet bij."}
          {arriveNow && list.length > 0 && " Ook niet waar je vandaag niet meer kunt aankomen."}
        </p>
        {!places && <CardSkeleton />}
        <ul className="mt-2 space-y-2.5 sm:mt-3 sm:space-y-3">
          {list.map(({ place, km }) => (
            <li key={place.slug}>
              <PlaceCard place={place as PlaceSummary} distanceLabel={<DriveLabel drive={drives?.[place.slug]} km={km} />} />
            </li>
          ))}
        </ul>
        </div>
      </section>
      {wide && (
        <aside className="sticky top-16 h-[calc(100dvh-4rem)] border-l border-line">
          <PlaceMap places={list.map((r) => r.place)} user={pos} fitKey={`${pos.lat}-${list.length}`} className="h-full w-full" />
        </aside>
      )}
    </div>
  );
}

/** Echte rijtijd met het route-icoon; zolang die er niet is de hemelsbrede afstand met een kompaspictogram */
function DriveLabel({ drive, km }: { drive?: Drive; km: number }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <Icon name={drive ? "route" : "locate"} size={15} className="shrink-0" />
      {drive ? `${formatDuration(drive.seconds)} rijden, ${formatKm(drive.km)}` : `${formatKm(km)} hemelsbreed`}
    </span>
  );
}
