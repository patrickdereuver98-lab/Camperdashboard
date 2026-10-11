"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { distanceKm, formatKm, type LatLng } from "@/lib/geo";
import { eur, formatDuration, pluralize } from "@/lib/format";
import { usePlaces, useTrip, useTripSettings, type TripStop } from "@/lib/store";
import type { PlaceSummary } from "@/lib/types";
import { Icon } from "@/components/icons";
import { PlaceMap } from "@/components/place-map";
import { PlacePhoto } from "@/components/place-ui";
import { Sign } from "@/components/sign";

/** Aanname als de prijs van een betaalde plek niet bekend is (gemiddelde NL camperplaats 2026) */
const UNKNOWN_PRICE = 18;

type RouteData = { distanceM: number; durationS: number; legs: { distanceM: number; durationS: number }[]; geometry: [number, number][] };
type Stop = TripStop & { place: PlaceSummary };

/** Simpele "dichtstbijzijnde eerst"-volgorde vanaf het eerste punt */
function optimize(stops: Stop[], start?: LatLng | null): Stop[] {
  const rest = [...stops];
  const out: Stop[] = [];
  let cur: LatLng = start ?? rest.shift()!.place;
  if (!start) out.push(stops[0]);
  while (rest.length) {
    let best = 0;
    for (let i = 1; i < rest.length; i++) if (distanceKm(cur, rest[i].place) < distanceKm(cur, rest[best].place)) best = i;
    const [next] = rest.splice(best, 1);
    out.push(next);
    cur = next.place;
  }
  return out;
}

export function TripApp() {
  const trip = useTrip();
  const router = useRouter();
  const params = useSearchParams();
  const { data: places } = usePlaces();
  const [settings, setSettings] = useTripSettings();
  const [start, setStart] = useState<LatLng | null>(null);
  const [routeResult, setRouteResult] = useState<{ key: string; data: RouteData | null; failed: boolean }>({ key: "", data: null, failed: false });
  const [shared, setShared] = useState(false);

  // Gedeelde reis: /mijn-reis?r=slug.2,slug.1
  const incoming = params.get("r");
  const incomingStops = useMemo<TripStop[] | null>(() => {
    if (!incoming) return null;
    return incoming
      .split(",")
      .map((s) => {
        const [slug, n] = s.split(".");
        return { slug, nights: Math.max(1, Math.min(21, Number(n) || 1)) };
      })
      .filter((s) => s.slug);
  }, [incoming]);

  const stops = useMemo<Stop[] | null>(() => {
    if (!places) return null;
    const bySlug = new Map(places.map((p) => [p.slug, p]));
    return trip.stops.map((s) => ({ ...s, place: bySlug.get(s.slug)! })).filter((s) => s.place);
  }, [places, trip.stops]);

  const routeKey = useMemo(() => {
    if (!stops || stops.length + (start ? 1 : 0) < 2) return null;
    const pts = [...(start ? [start] : []), ...stops.map((s) => s.place)];
    return pts.map((p) => `${p.lat.toFixed(5)},${p.lng.toFixed(5)}`).join(";");
  }, [stops, start]);

  useEffect(() => {
    if (!routeKey) return;
    let alive = true;
    fetch(`/api/route?p=${routeKey}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(
        (data: RouteData) => alive && setRouteResult({ key: routeKey, data, failed: false }),
        () => alive && setRouteResult({ key: routeKey, data: null, failed: true }),
      );
    return () => {
      alive = false;
    };
  }, [routeKey]);
  // Tijdens het herberekenen blijft de vorige route zichtbaar
  const route = routeKey ? routeResult.data : null;
  const routeState = !routeKey ? "idle" : routeResult.key !== routeKey ? "loading" : routeResult.failed ? "error" : "idle";

  if (incomingStops && incomingStops.length) {
    return (
      <div className="mx-auto max-w-xl px-4 pt-10 text-center">
        <h1 className="font-sign text-3xl font-extrabold">Gedeelde reis openen</h1>
        <p className="mt-3 text-lg text-ink-2">Iemand heeft een reis met {pluralize(incomingStops.length, "stop", "stops")} met je gedeeld.</p>
        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
          <button type="button" onClick={() => { trip.replace(incomingStops); router.replace("/mijn-reis"); }} className="h-12 rounded-xl bg-road px-6 font-semibold text-on-road">
            {trip.stops.length ? "Vervang mijn reis" : "Open deze reis"}
          </button>
          <button type="button" onClick={() => router.replace("/mijn-reis")} className="h-12 rounded-xl border-2 border-line px-6 font-semibold">
            Annuleren
          </button>
        </div>
      </div>
    );
  }

  if (trip.stops.length === 0) {
    return (
      <div className="mx-auto max-w-xl px-4 pt-10 text-center sm:pt-14">
        <div className="sign-panel mx-auto grid h-28 w-28 place-items-center">
          <Icon name="heart" size={52} />
        </div>
        <h1 className="mt-8 font-sign text-3xl font-extrabold sm:text-4xl">Je reis is nog leeg</h1>
        <p className="mt-3 text-lg text-ink-2">
          Tik op het hartje bij een plek om hem te bewaren. Hier zet je ze op volgorde en zie je de echte rijtijd en wat de reis ongeveer kost.
        </p>
        <Link href="/zoeken" className="mt-8 inline-flex h-14 items-center gap-2 rounded-xl bg-road px-7 font-sign text-lg font-bold text-on-road">
          <Icon name="search" size={21} /> Plekken zoeken
        </Link>
      </div>
    );
  }

  if (!stops) return <p className="px-6 pt-12 text-center text-muted">Je reis laden…</p>;

  const legs = route?.legs ?? [];
  const legFor = (i: number) => legs[start ? i : i - 1];
  const totalKm = route ? route.distanceM / 1000 : null;
  const nights = stops.reduce((a, s) => a + s.nights, 0);
  const unknownPrice = stops.some((s) => s.place.priceEur === undefined);
  const stay = stops.reduce((a, s) => a + (s.place.priceEur ?? UNKNOWN_PRICE) * s.nights, 0);
  const fuel = totalKm !== null ? (totalKm * settings.litersPer100 * settings.fuelPrice) / 100 : null;
  const tax = settings.persons * settings.touristTax * stops.filter((s) => s.place.priceEur !== 0).reduce((a, s) => a + s.nights, 0);
  const total = stay + (fuel ?? 0) + tax;

  const shareUrl = typeof window !== "undefined" ? `${location.origin}/mijn-reis?r=${trip.stops.map((s) => `${s.slug}.${s.nights}`).join(",")}` : "";
  const gmaps = (() => {
    const pts = stops.map((s) => `${s.place.lat},${s.place.lng}`);
    const dest = pts.pop()!;
    const q = new URLSearchParams({ api: "1", destination: dest, travelmode: "driving" });
    if (pts.length) q.set("waypoints", pts.slice(0, 9).join("|"));
    return `https://www.google.com/maps/dir/?${q}`;
  })();

  return (
    <div className="mx-auto max-w-6xl px-3 pt-5 pb-10 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-sign text-3xl font-extrabold">Mijn reis</h1>
          <p className="text-ink-2">
            {pluralize(stops.length, "stop", "stops")}, {pluralize(nights, "nacht", "nachten")}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => trip.replace(optimize(stops, start).map(({ slug, nights: n }) => ({ slug, nights: n })))}
            className="flex h-11 items-center gap-2 rounded-xl border-2 border-line bg-surface px-4 font-semibold hover:border-road"
          >
            <Icon name="route" size={18} /> Slimste volgorde
          </button>
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
            className="flex h-11 items-center gap-2 rounded-xl border-2 border-line bg-surface px-4 font-semibold hover:border-road"
          >
            <Icon name={shared ? "check" : "share"} size={18} /> {shared ? "Link gekopieerd" : "Delen"}
          </button>
        </div>
      </div>

      <div className="mt-6 grid gap-8 lg:grid-cols-[1.2fr_1fr]">
        <div className="min-w-0">
          {/* Vertrekpunt */}
          <div className="mb-3 flex items-center gap-3 rounded-2xl bg-surface p-3 outline-1 outline-line outline">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-sunken text-ink-2">
              <Icon name="locate" size={20} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-semibold">Vertrekpunt</p>
              <p className="text-sm text-muted">{start ? "Je huidige locatie" : "Eerste stop"}</p>
            </div>
            {start ? (
              <button type="button" onClick={() => setStart(null)} className="h-11 px-3 font-semibold text-road underline">
                Wissen
              </button>
            ) : (
              <button
                type="button"
                onClick={() =>
                  navigator.geolocation?.getCurrentPosition(
                    (p) => setStart({ lat: p.coords.latitude, lng: p.coords.longitude }),
                    () => undefined,
                    { timeout: 12000 },
                  )
                }
                className="h-11 rounded-xl border-2 border-line px-3 font-semibold hover:border-road"
              >
                Mijn locatie
              </button>
            )}
          </div>

          <ol>
            {stops.map((s, i) => {
              const leg = legFor(i);
              return (
                <li key={s.slug}>
                  {(i > 0 || start) && (
                    <div className="flex items-center gap-3 py-2 pl-5 text-sm text-ink-2">
                      <span className="h-8 border-l-[3px] border-dotted border-road" aria-hidden="true" />
                      {leg
                        ? `${formatDuration(leg.durationS)} rijden, ${formatKm(leg.distanceM / 1000)}`
                        : routeState === "loading"
                          ? "Route berekenen…"
                          : `${formatKm(distanceKm(i === 0 ? start! : stops[i - 1].place, s.place))} hemelsbreed`}
                    </div>
                  )}
                  <div className="flex gap-3 rounded-2xl bg-surface p-3 outline-1 outline-line outline">
                    <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl">
                      <PlacePhoto src={s.place.imageUrl} alt="" kind={s.place.kind} className="h-full w-full" />
                      <span className="absolute top-1 left-1 grid h-7 w-7 place-items-center rounded-full bg-road font-sign text-sm font-bold text-on-road">
                        {i + 1}
                      </span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <Link href={`/plek/${s.slug}`} className="block truncate font-sign text-lg font-bold hover:text-road">
                        {s.place.name}
                      </Link>
                      <p className="truncate text-sm text-muted">
                        {s.place.town}, {s.place.priceEur === undefined ? "prijs onbekend" : s.place.priceEur === 0 ? "gratis" : `${eur(s.place.priceEur)} per nacht`}
                      </p>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <div className="flex items-center rounded-xl border-2 border-line" role="group" aria-label={`Nachten bij ${s.place.name}`}>
                          <button type="button" aria-label="Een nacht minder" disabled={s.nights <= 1} onClick={() => trip.setNights(s.slug, s.nights - 1)} className="grid h-10 w-10 place-items-center disabled:opacity-30">
                            <Icon name="minus" size={18} />
                          </button>
                          <span className="min-w-20 text-center font-semibold">{pluralize(s.nights, "nacht", "nachten")}</span>
                          <button type="button" aria-label="Een nacht meer" onClick={() => trip.setNights(s.slug, s.nights + 1)} className="grid h-10 w-10 place-items-center">
                            <Icon name="plus" size={18} />
                          </button>
                        </div>
                        <div className="ml-auto flex items-center">
                          <button type="button" aria-label="Eerder in de reis" disabled={i === 0} onClick={() => trip.move(i, i - 1)} className="grid h-10 w-10 place-items-center rounded-lg hover:bg-sunken disabled:opacity-25">
                            <Icon name="chevronUp" />
                          </button>
                          <button type="button" aria-label="Later in de reis" disabled={i === stops.length - 1} onClick={() => trip.move(i, i + 1)} className="grid h-10 w-10 place-items-center rounded-lg hover:bg-sunken disabled:opacity-25">
                            <Icon name="chevronDown" />
                          </button>
                          <button type="button" aria-label={`${s.place.name} verwijderen`} onClick={() => trip.remove(s.slug)} className="grid h-10 w-10 place-items-center rounded-lg text-alert hover:bg-alert-tint">
                            <Icon name="trash" size={19} />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
          <Link href="/zoeken" className="mt-4 flex h-12 items-center justify-center gap-2 rounded-xl border-2 border-dashed border-line font-semibold text-road hover:border-road">
            <Icon name="plus" size={19} /> Plek toevoegen
          </Link>
        </div>

        <aside className="min-w-0 space-y-4">
          <div className="rounded-2xl bg-surface p-5 outline-1 outline-line outline">
            <h2 className="font-sign text-xl font-bold">Overzicht</h2>
            <dl className="mt-3 space-y-2">
              <div className="flex justify-between">
                <dt className="text-ink-2">Rijden</dt>
                <dd className="font-semibold">
                  {route ? `${formatKm(route.distanceM / 1000)}, ${formatDuration(route.durationS)}` : routeState === "loading" ? "Berekenen…" : stops.length + (start ? 1 : 0) < 2 ? "Voeg een stop toe" : "Niet beschikbaar"}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-ink-2">Overnachtingen{unknownPrice ? "*" : ""}</dt>
                <dd className="font-semibold">{eur(stay, true)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-ink-2">Brandstof</dt>
                <dd className="font-semibold">{fuel === null ? "–" : eur(fuel, true)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-ink-2">Toeristenbelasting</dt>
                <dd className="font-semibold">{eur(tax, true)}</dd>
              </div>
              <div className="flex justify-between border-t border-line pt-2">
                <dt className="font-sign text-lg font-bold">Totaal ongeveer</dt>
                <dd className="font-sign text-2xl font-extrabold">{eur(total, true)}</dd>
              </div>
            </dl>
            {unknownPrice && <p className="mt-2 text-sm text-muted">* Voor plekken zonder bekende prijs rekenen we {eur(UNKNOWN_PRICE)} per nacht.</p>}
            {routeState === "error" && <p className="mt-2 text-sm text-alert">De routeplanner is even niet bereikbaar; afstanden zijn hemelsbreed.</p>}

            <details className="mt-4 rounded-xl bg-sunken p-4">
              <summary className="cursor-pointer font-semibold">Uitgangspunten aanpassen</summary>
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
                      className="h-11 w-full rounded-lg border-2 border-line bg-surface px-3"
                    />
                  </label>
                ))}
              </div>
            </details>

            <a href={gmaps} target="_blank" rel="noopener noreferrer" className="mt-4 flex h-12 items-center justify-center gap-2 rounded-xl bg-road font-semibold text-on-road">
              <Icon name="route" size={19} /> Open route in Google Maps
            </a>
          </div>

          <PlaceMap
            places={stops.map((s) => s.place)}
            route={route?.geometry ?? null}
            user={start}
            cluster={false}
            fitKey={routeKey ?? stops.map((s) => s.slug).join()}
            className="h-80 rounded-2xl outline-1 outline-line outline"
          />
          <p className="flex items-center gap-2 text-sm text-muted">
            <Sign name="camper" size={22} /> Route over de weg via OpenRouteService of OSRM.
          </p>
          <button type="button" onClick={() => confirm("Weet je zeker dat je je hele reis wilt wissen?") && trip.clear()} className="h-11 font-semibold text-alert underline">
            Reis wissen
          </button>
        </aside>
      </div>
    </div>
  );
}
