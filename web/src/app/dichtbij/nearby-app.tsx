"use client";

import { useMemo, useState } from "react";
import { applyFilters, EMPTY_FILTERS, type Filters } from "@/lib/filters";
import { distanceKm, type LatLng } from "@/lib/geo";
import { usePlaces } from "@/lib/client-data";
import { useMediaQuery } from "@/lib/use-media";
import { FilterBar } from "@/components/filter-bar";
import { CardSkeleton, PlaceCard } from "@/components/place-bits";
import { PlaceMap } from "@/components/place-map";
import { Landscape } from "@/components/landscape";
import { Icon } from "@/components/icons";

const RADII = [10, 25, 50, 100];

type Status = "idle" | "locating" | "denied" | "unavailable" | "ready";

export function NearbyApp() {
  const { places } = usePlaces();
  const [status, setStatus] = useState<Status>("idle");
  const [pos, setPos] = useState<LatLng | null>(null);
  const [radius, setRadius] = useState(25);
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [hovered, setHovered] = useState<string | null>(null);
  const wide = useMediaQuery("(min-width: 1024px)");

  function locate() {
    if (!("geolocation" in navigator)) {
      setStatus("unavailable");
      return;
    }
    setStatus("locating");
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setPos({ lat: p.coords.latitude, lng: p.coords.longitude });
        setStatus("ready");
      },
      (err) =>
        setStatus(
          err.code === err.PERMISSION_DENIED ? "denied" : "unavailable",
        ),
      { enableHighAccuracy: false, timeout: 15000, maximumAge: 300000 },
    );
  }

  const results = useMemo(() => {
    if (!places || !pos) return null;
    return applyFilters(places, filters)
      .map((place) => ({ place, km: distanceKm(pos, place) }))
      .filter((r) => r.km <= radius)
      .sort((a, b) => a.km - b.km);
  }, [places, pos, filters, radius]);

  if (status !== "ready" || !pos) {
    return (
      <div className="mx-auto max-w-xl px-4 pt-10 pb-16 text-center sm:pt-16">
        <div className="overflow-hidden rounded-[2rem] shadow-lift">
          <Landscape seed="dichtbij" variant={0} van className="h-52 w-full" />
        </div>
        <h1 className="mt-8 font-display text-4xl font-semibold text-ink">
          Wat is er dichtbij?
        </h1>
        <p className="mt-3 text-lg text-ink-soft">
          Onderweg en geen plan voor vannacht? Deel je locatie en we zetten de
          plekken om je heen op een rij.
        </p>
        <button
          type="button"
          onClick={locate}
          disabled={status === "locating"}
          className="mt-8 inline-flex items-center gap-2 rounded-full bg-forest px-7 py-4 text-base font-semibold text-on-forest shadow-lift transition hover:bg-forest-deep disabled:opacity-70"
        >
          <Icon
            name="locate"
            size={20}
            className={status === "locating" ? "animate-spin" : ""}
          />
          {status === "locating" ? "Locatie bepalen…" : "Gebruik mijn locatie"}
        </button>
        {status === "denied" && (
          <p className="mt-5 rounded-2xl bg-ember-tint p-4 text-sm text-ember">
            Je hebt geen toegang tot je locatie gegeven. Sta dit toe in de
            instellingen van je browser en probeer het opnieuw.
          </p>
        )}
        {status === "unavailable" && (
          <p className="mt-5 rounded-2xl bg-ember-tint p-4 text-sm text-ember">
            Je locatie kon niet worden bepaald. Probeer het zo nog eens, of zoek
            op plaatsnaam.
          </p>
        )}
        <p className="mt-6 text-sm text-muted">
          Je locatie blijft op je eigen apparaat en wordt niet opgeslagen.
        </p>
      </div>
    );
  }

  return (
    <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)]">
      <section className="min-w-0 px-4 pt-5 pb-10 sm:px-6">
        <h1 className="font-display text-3xl font-semibold text-ink">
          Dichtbij jou
        </h1>
        <div className="mt-4 space-y-3">
          <div
            className="flex flex-wrap items-center gap-2"
            role="group"
            aria-label="Straal"
          >
            <span className="text-sm text-muted">Binnen</span>
            {RADII.map((r) => (
              <button
                key={r}
                type="button"
                aria-pressed={radius === r}
                onClick={() => setRadius(r)}
                className="rounded-full border border-line bg-surface px-3.5 py-1.5 text-sm font-medium text-ink-soft transition hover:border-forest aria-pressed:border-forest aria-pressed:bg-forest aria-pressed:text-on-forest"
              >
                {r} km
              </button>
            ))}
            <button
              type="button"
              onClick={locate}
              className="ml-auto flex items-center gap-1 text-sm font-medium text-forest hover:underline"
            >
              <Icon name="locate" size={15} /> Opnieuw bepalen
            </button>
          </div>
          <FilterBar
            filters={filters}
            onChange={setFilters}
            showSort={false}
            showProvince={false}
          />
        </div>

        <p className="mt-6 mb-4 text-ink-soft">
          {results
            ? `${results.length} ${results.length === 1 ? "plek" : "plekken"} binnen ${radius} km`
            : "Laden…"}
        </p>
        {!wide && results && results.length > 0 && (
          <PlaceMap
            places={results.slice(0, 60).map((r) => r.place)}
            user={pos}
            fitKey={`${radius}-${pos.lat}-${results.length}`}
            className="mb-4 h-56 rounded-2xl border border-line"
          />
        )}
        {!results && <CardSkeleton />}
        {results && results.length === 0 && (
          <div className="rounded-2xl border border-line bg-surface p-6 text-center text-ink-soft">
            Geen plekken binnen {radius} km met deze filters.{" "}
            {radius < 100 && (
              <button
                type="button"
                className="font-semibold text-forest underline"
                onClick={() => setRadius(RADII[RADII.indexOf(radius) + 1])}
              >
                Zoek verder weg
              </button>
            )}
          </div>
        )}
        <ul className="space-y-3">
          {results?.slice(0, 60).map(({ place, km }) => (
            <li key={place.slug}>
              <PlaceCard
                place={place}
                km={km}
                active={hovered === place.slug}
                onHover={setHovered}
              />
            </li>
          ))}
        </ul>
      </section>
      {wide && results && (
        <aside className="sticky top-16 h-[calc(100dvh-4rem)] border-l border-line">
          <PlaceMap
            places={results.slice(0, 60).map((r) => r.place)}
            user={pos}
            highlight={hovered}
            fitKey={`${radius}-${pos.lat}-${results.length}`}
            className="h-full w-full"
          />
        </aside>
      )}
    </div>
  );
}
