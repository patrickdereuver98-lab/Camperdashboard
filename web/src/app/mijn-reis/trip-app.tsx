"use client";

import Link from "next/link";
import { useMemo } from "react";
import { usePlaces, useTrip } from "@/lib/client-data";
import { directionsUrl, distanceKm, formatKm } from "@/lib/geo";
import type { Place } from "@/lib/types";
import { PriceTag } from "@/components/place-bits";
import { PlaceMap } from "@/components/place-map";
import { Landscape } from "@/components/landscape";
import { Icon } from "@/components/icons";

/** Aanname voor betaalde plekken zonder bekende prijs (gemiddelde NL camperplaats). */
const PAID_ESTIMATE = 18;
const eur = new Intl.NumberFormat("nl-NL", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});

export function TripApp() {
  const trip = useTrip();
  const { places } = usePlaces();

  const stops = useMemo(() => {
    if (!places) return null;
    const bySlug = new Map(places.map((p) => [p.slug, p]));
    return trip.stops
      .map((s) => ({ ...s, place: bySlug.get(s.slug) }))
      .filter((s): s is typeof s & { place: Place } => !!s.place);
  }, [places, trip.stops]);

  if (trip.stops.length === 0) {
    return (
      <div className="mx-auto max-w-xl px-4 pt-10 pb-16 text-center sm:pt-16">
        <div className="overflow-hidden rounded-[2rem] shadow-lift">
          <Landscape
            seed="reis"
            variant={1}
            water
            van
            className="h-52 w-full"
          />
        </div>
        <h1 className="mt-8 font-display text-4xl font-semibold text-ink">
          Je reis begint hier
        </h1>
        <p className="mt-3 text-lg text-ink-soft">
          Tik op het hartje bij een plek om hem te bewaren. Hier zet je ze op
          volgorde, kies je het aantal nachten en zie je wat de route ongeveer
          kost.
        </p>
        <Link
          href="/zoeken"
          className="mt-8 inline-flex items-center gap-2 rounded-full bg-forest px-7 py-4 font-semibold text-on-forest shadow-lift transition hover:bg-forest-deep"
        >
          <Icon name="search" size={19} /> Plekken zoeken
        </Link>
      </div>
    );
  }

  if (!stops) {
    return <p className="px-6 py-16 text-center text-muted">Je reis laden…</p>;
  }

  const legs = stops.map((s, i) =>
    i === 0 ? 0 : distanceKm(stops[i - 1].place, s.place),
  );
  const totalKm = legs.reduce((a, b) => a + b, 0);
  const nights = stops.reduce((a, s) => a + s.nights, 0);
  const nightly = (p: Place) =>
    p.price === "gratis" ? 0 : (p.priceEur ?? PAID_ESTIMATE);
  const estimated = stops.some(
    (s) => s.place.price !== "gratis" && !s.place.priceEur,
  );
  const budget = stops.reduce((a, s) => a + nightly(s.place) * s.nights, 0);
  const last = stops[stops.length - 1]?.place;
  const via = stops
    .slice(0, -1)
    .slice(-9)
    .map((s) => s.place);

  return (
    <main className="mx-auto w-full max-w-6xl px-4 pt-6 pb-16 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl font-semibold text-ink">
            Mijn reis
          </h1>
          <p className="mt-1 text-ink-soft">
            {stops.length} {stops.length === 1 ? "stop" : "stops"} · {nights}{" "}
            {nights === 1 ? "nacht" : "nachten"}
          </p>
        </div>
        <button
          type="button"
          onClick={() =>
            confirm("Weet je zeker dat je je hele reis wilt wissen?") &&
            trip.clear()
          }
          className="flex items-center gap-1.5 text-sm font-medium text-muted hover:text-ember"
        >
          <Icon name="trash" size={15} /> Reis wissen
        </button>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-8 lg:grid-cols-[1.15fr_1fr]">
        <ol className="min-w-0">
          {stops.map((s, i) => (
            <li key={s.slug}>
              {i > 0 && (
                <div className="flex items-center gap-3 py-1.5 pl-[18px] text-xs text-muted">
                  <span className="h-6 border-l-2 border-dashed border-line" />
                  {formatKm(legs[i])} hemelsbreed
                </div>
              )}
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl border border-line bg-surface p-3 shadow-card">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-forest font-display font-semibold text-on-forest">
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/plek/${s.slug}`}
                    className="block truncate font-semibold text-ink hover:text-forest"
                  >
                    {s.place.name}
                  </Link>
                  <div className="flex items-center gap-2 text-sm text-muted">
                    <span className="truncate">{s.place.town}</span>
                    <PriceTag place={s.place} />
                  </div>
                </div>
                <div className="ml-12 flex flex-1 basis-full items-center justify-between gap-3 sm:ml-0 sm:flex-none sm:basis-auto sm:justify-start">
                  <div
                    role="group"
                    className="flex items-center rounded-full border border-line"
                    aria-label={`Nachten bij ${s.place.name}`}
                  >
                    <button
                      type="button"
                      aria-label="Een nacht minder"
                      onClick={() => trip.setNights(s.slug, s.nights - 1)}
                      className="grid h-8 w-8 place-items-center text-ink-soft hover:text-ink disabled:opacity-30"
                      disabled={s.nights <= 1}
                    >
                      <Icon name="minus" size={14} />
                    </button>
                    <span className="flex w-11 items-center justify-center gap-1 text-sm font-medium text-ink tabular-nums">
                      <Icon name="moon" size={13} className="text-muted" />
                      {s.nights}
                    </span>
                    <button
                      type="button"
                      aria-label="Een nacht meer"
                      onClick={() => trip.setNights(s.slug, s.nights + 1)}
                      className="grid h-8 w-8 place-items-center text-ink-soft hover:text-ink"
                    >
                      <Icon name="plus" size={14} />
                    </button>
                  </div>
                  <div className="flex flex-col">
                    <button
                      type="button"
                      aria-label="Eerder in de reis"
                      disabled={i === 0}
                      onClick={() => trip.move(s.slug, -1)}
                      className="text-muted hover:text-ink disabled:opacity-25"
                    >
                      <Icon name="chevronUp" size={18} />
                    </button>
                    <button
                      type="button"
                      aria-label="Later in de reis"
                      disabled={i === stops.length - 1}
                      onClick={() => trip.move(s.slug, 1)}
                      className="text-muted hover:text-ink disabled:opacity-25"
                    >
                      <Icon name="chevronDown" size={18} />
                    </button>
                  </div>
                  <button
                    type="button"
                    aria-label={`Verwijder ${s.place.name}`}
                    onClick={() => trip.remove(s.slug)}
                    className="text-muted hover:text-ember"
                  >
                    <Icon name="x" size={18} />
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ol>

        <aside className="min-w-0 space-y-4">
          <div className="grid grid-cols-3 divide-x divide-line rounded-2xl border border-line bg-surface p-4 text-center shadow-card">
            <Stat label="Afstand" value={`± ${formatKm(totalKm * 1.25)}`} />
            <Stat label="Nachten" value={String(nights)} />
            <Stat
              label="Overnachten"
              value={`${estimated ? "± " : ""}${eur.format(budget)}`}
            />
          </div>
          <p className="flex gap-2 text-xs leading-relaxed text-muted">
            <Icon name="info" size={14} className="mt-0.5 shrink-0" />
            Rijafstand geschat als 1,25× hemelsbreed. Waar de prijs per nacht
            bekend is rekenen we die; anders gaan we uit van{" "}
            {eur.format(PAID_ESTIMATE)} per nacht.
          </p>
          <PlaceMap
            places={stops.map((s) => s.place)}
            route
            fitKey={stops.map((s) => s.slug).join()}
            className="h-80 rounded-2xl border border-line"
          />
          {last && (
            <a
              href={directionsUrl(last, via)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 rounded-full bg-forest px-5 py-3.5 font-semibold text-on-forest transition hover:bg-forest-deep"
            >
              <Icon name="route" size={18} /> Open route in Google Maps
            </a>
          )}
        </aside>
      </div>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-2">
      <p className="font-display text-xl font-semibold text-ink tabular-nums sm:text-2xl">
        {value}
      </p>
      <p className="text-xs text-muted">{label}</p>
    </div>
  );
}
