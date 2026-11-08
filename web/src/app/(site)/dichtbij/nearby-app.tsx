"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { coarse, formatKm, type LatLng } from "@/lib/geo";
import { formatDuration, pluralize } from "@/lib/format";
import { confirmedFirst, FACILITIES, isOpenOn, type FacilityKey } from "@/lib/search";
import {
  activeFilterLabels,
  clearedChoices,
  closerSuggestions,
  NEARBY_DEFAULTS,
  nearbySuggestions,
  nearestPlaces,
  nearestIsFar,
  withinDrive,
  type Drive,
  type NearbyChoices,
} from "@/lib/nearby";
import { usePlaces, useVehicle } from "@/lib/store";
import { useMediaQuery } from "@/lib/use-media";
import type { PlaceSummary } from "@/lib/types";
import { CardSkeleton, MapPick, PlaceCard, RESULT_LIST } from "@/components/place-ui";
import { PlaceMap } from "@/components/place-map";
import { Icon } from "@/components/icons";
import { Chip } from "@/components/chip";
import { Landscape } from "@/components/landscape";
import { Sign, type SignName } from "@/components/sign";

type Status = "idle" | "locating" | "denied" | "unavailable" | "ready";

// Wat je onderweg het eerst wilt weten staat vooraan
const NEARBY_ORDER: FacilityKey[] = ["power", "dogs", "water", "dumpStation", "toilet", "shower", "wifi"];

export function NearbyApp() {
  const [status, setStatus] = useState<Status>("idle");
  // De plekkenlijst pas ophalen als je locatie wordt bepaald (tegelijk met de GPS); niet al op het welkomstscherm (R33)
  const { data: places } = usePlaces(status === "locating" || status === "ready");
  const [pos, setPos] = useState<LatLng | null>(null);
  // "Nu open" en "Nu nog aankomen" staan voor vannacht standaard aan: ze verbergen alleen wat zeker dicht is.
  // De lengte uit Mijn camper telt mee, net als bij Zoeken; met de chip zet je dat uit.
  const [choices, setChoices] = useState<NearbyChoices>(NEARBY_DEFAULTS);
  const { facilities, openNow, arriveNow, departure, lengthOff, within30 } = choices;
  const set = (patch: Partial<NearbyChoices>) => setChoices((c) => ({ ...c, ...patch }));
  const [vehicle] = useVehicle();
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
    return nearestPlaces(places, pos, { facilities, openNow, arriveNow, departure, lengthOff, within30: false }, vehicle);
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
        <h1 className="mt-6 font-display text-h1 font-semibold">Waar kun je vannacht staan?</h1>
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
          <div role="alert" className="mt-5 rounded-lg border border-alert/40 bg-alert-tint p-4 text-alert">
            <p>
              {status === "denied"
                ? "Je hebt geen toegang tot je locatie gegeven. Sta het toe in de instellingen van je browser, of zoek op plaatsnaam."
                : "Je locatie kon niet worden bepaald. Probeer het opnieuw of zoek op plaatsnaam."}
            </p>
            <Link href="/zoeken" className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-md border border-line bg-surface px-4 font-semibold text-ink hover:border-forest">
              <Icon name="search" size={18} /> Zoek op plaats
            </Link>
          </div>
        )}
        <p className="mt-6 text-sm text-muted">Je locatie wordt alleen gebruikt om afstanden te berekenen en niet opgeslagen.</p>
      </div>
    );
  }

  const all = sorted ?? [];
  const list = withinDrive(all, drives, within30);
  const active = activeFilterLabels(choices, vehicle);
  const suggestions = places && list.length === 0 ? nearbySuggestions(places, pos, choices, vehicle, { farther: all.length }) : [];
  // Wel plekken, maar de dichtste is ver weg: welke ene aanpassing geeft een plek dichterbij? Pas als de rijtijden er
  // zijn (of zeker niet komen), anders springt het voorstel weg zodra ze binnenkomen.
  const far = places && (drives || driveError) ? nearestIsFar(list, drives) : false;
  const closer = far && places ? closerSuggestions(places, pos, choices, vehicle, Math.min(...list.map((r) => r.km))) : [];
  const pickedPlace = picked ? list.find((r) => r.place.slug === picked)?.place : undefined;
  return (
    <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,0.85fr)]">
      <section className="min-w-0 px-3 pt-3 pb-8 sm:px-6 sm:pt-5">
        <div className="flex items-center justify-between gap-3">
          <h1 className="font-display text-h1 font-semibold">Dichtbij jou</h1>
          <button type="button" onClick={locate} className="flex h-11 items-center gap-1.5 font-semibold text-forest">
            <Icon name="refresh" size={18} /> Opnieuw
          </button>
        </div>
        <ul className="no-scrollbar -mx-3 mt-1 flex gap-2 overflow-x-auto px-3 pb-1 sm:mx-0 sm:mt-3 sm:flex-wrap sm:px-0">
          <li className="shrink-0">
            <Chip pressed={openNow} onClick={() => set({ openNow: !openNow })} className="pl-1.5">
              <Sign name="calendar" size={24} state={openNow ? "on" : "unknown"} />
              Nu open
            </Chip>
          </li>
          <li className="shrink-0">
            <Chip pressed={arriveNow} onClick={() => set({ arriveNow: !arriveNow })} className="pl-1.5">
              <Sign name="clock" size={24} state={arriveNow ? "on" : "unknown"} />
              Nu nog aankomen
            </Chip>
          </li>
          <li className="shrink-0">
            <Chip pressed={within30} onClick={() => set({ within30: !within30 })} className="pl-1.5">
              <Sign name="camper" size={24} state={within30 ? "on" : "unknown"} />
              Binnen 30 min
            </Chip>
          </li>
          {vehicle.lengthM && (
            <li className="shrink-0">
              <Chip pressed={!lengthOff} onClick={() => set({ lengthOff: !lengthOff })} className="pl-1.5">
                <Sign name="length" size={24} state={lengthOff ? "unknown" : "on"} />
                Mijn camper ({String(vehicle.lengthM).replace(".", ",")} m)
              </Chip>
            </li>
          )}
          {(
            [
              ["vrij", "Zonder vertrektijd"],
              ["uitslapers", "Uitslapers"],
            ] as const
          ).map(([g, label]) => (
            <li key={g} className="shrink-0">
              <Chip pressed={departure === g} onClick={() => set({ departure: departure === g ? undefined : g })} className="pl-1.5">
                <Sign name="clock" size={24} state={departure === g ? "on" : "unknown"} />
                {label}
              </Chip>
            </li>
          ))}
          {NEARBY_ORDER.map((key) => FACILITIES.find((f) => f.key === key)!).map((f) => {
            const on = facilities.includes(f.key);
            return (
              <li key={f.key} className="shrink-0">
                <Chip pressed={on} onClick={() => set({ facilities: on ? facilities.filter((k) => k !== f.key) : [...facilities, f.key as FacilityKey] })} className="pl-1.5">
                  <Sign name={f.icon as SignName} size={24} state={on ? "on" : "unknown"} />
                  {f.label}
                </Chip>
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
              ? within30 && drives && all.length > 0
                ? "Geen plekken binnen 30 minuten rijden met deze keuzes."
                : "Geen plekken binnen 80 km met deze keuzes."
              : drives
                ? `${pluralize(list.length, "plek", "plekken")}, dichtstbij eerst (rijtijd).`
                : driveError
                  ? `${pluralize(list.length, "plek", "plekken")}, dichtstbij eerst. Rijtijden lukken nu niet, je ziet de afstand hemelsbreed.`
                  : `${pluralize(list.length, "plek", "plekken")} gevonden. Rijtijden berekenen…`}
          {openNow && list.length > 0 && " Wat nu dicht is, staat er niet bij."}
          {arriveNow && list.length > 0 && " Ook niet waar je vandaag niet meer kunt aankomen."}
          {within30 && driveError && list.length > 0 && " Binnen 30 min werkt pas als de rijtijden er zijn."}
        </p>
        {places && active.length > 0 && (
          <p className="mt-1 flex flex-wrap items-center gap-x-3 text-sm text-ink-2" data-testid="nearby-active">
            <span>Filters: {active.join(", ")}.</span>
            <button type="button" onClick={() => setChoices(clearedChoices(vehicle))} className="-my-2 min-h-11 font-semibold text-forest underline underline-offset-2">
              Wis filters
            </button>
          </p>
        )}
        {closer.length > 0 && (
          <div className="mt-3 rounded-lg border border-line bg-surface p-4" data-testid="nearby-closer">
            <p className="text-ink-2">
              {far === "rijtijd"
                ? "De dichtste plek is meer dan 30 minuten rijden. Met één aanpassing vind je er een die hemelsbreed dichterbij ligt:"
                : "De dichtste plek ligt hemelsbreed meer dan 25 km weg. Met één aanpassing vind je er een dichterbij:"}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {closer.map((o) => (
                <button
                  key={o.label}
                  type="button"
                  onClick={() => setChoices(o.next)}
                  className="min-h-11 rounded-lg border border-line px-4 text-left font-semibold hover:border-forest hover:text-forest"
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>
        )}
        {places && list.length === 0 && (
          <div className="mt-3 rounded-lg border border-line bg-surface p-4" data-testid="nearby-empty">
            <p className="text-ink-2">{suggestions.length ? "Met één aanpassing vind je wel iets:" : "Hier past niets binnen 80 km. Zoek op een plaats verderop."}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {suggestions.map((o) => (
                <button
                  key={o.label}
                  type="button"
                  onClick={() => setChoices(o.next)}
                  className="min-h-11 rounded-lg border border-line px-4 text-left font-semibold hover:border-forest hover:text-forest"
                >
                  {o.label}
                  {o.count !== undefined && <span className="font-normal text-muted"> ({o.count})</span>}
                </button>
              ))}
              {!suggestions.length && (
                <Link href="/zoeken" className="flex min-h-11 items-center gap-2 rounded-lg border border-line px-4 font-semibold hover:border-forest hover:text-forest">
                  <Icon name="search" size={18} /> Zoek op plaats
                </Link>
              )}
            </div>
          </div>
        )}
        {!places && <CardSkeleton />}
        <ul className={`mt-2 sm:mt-3 ${RESULT_LIST}`}>
          {list.map(({ place, km }) => (
            <li key={place.id}>
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
