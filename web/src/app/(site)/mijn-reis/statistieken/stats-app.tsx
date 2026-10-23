"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { CATEGORIES, summarize } from "@/lib/expenses";
import { eur, pluralize } from "@/lib/format";
import { readTripPlaces, useExpenses, usePlaces, useTrip } from "@/lib/store";
import { tripStats } from "@/lib/trip-stats";
import { Icon } from "@/components/icons";

const nf = new Intl.NumberFormat("nl-NL");
const pct = (x: number) => `${Math.round(x * 100)}%`;

type Bar = { label: string; value: number; display: string; muted?: boolean };

/** Horizontale staven, één reeks: waarde aan het eind van de staaf, geen legenda (de kop zegt wat het is) */
function BarChart({ title, bars, caption }: { title: string; bars: Bar[]; caption?: string }) {
  const [active, setActive] = useState<string | null>(null);
  const max = Math.max(...bars.map((b) => b.value), 0);
  if (max <= 0) return null;
  return (
    <figure className="rounded-2xl bg-surface p-5 shadow-low">
      <figcaption className="font-display text-xl font-semibold">{title}</figcaption>
      {caption && <p className="mt-1 text-sm text-muted">{caption}</p>}
      <ul className="mt-4 space-y-3" role="list">
        {bars.map((b) => (
          <li
            key={b.label}
            tabIndex={0}
            aria-label={`${b.label}: ${b.display}`}
            onMouseEnter={() => setActive(b.label)}
            onMouseLeave={() => setActive(null)}
            onFocus={() => setActive(b.label)}
            onBlur={() => setActive(null)}
            className={`grid grid-cols-[7.5rem_1fr] items-center gap-3 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-forest ${active && active !== b.label ? "opacity-60" : ""}`}
          >
            <span className="truncate text-sm text-ink-2">{b.label}</span>
            <span className="flex min-w-0 items-center gap-2">
              <span
                aria-hidden="true"
                className={`h-5 max-w-full shrink-0 rounded-r ${b.muted ? "bg-line" : "bg-forest"}`}
                style={{ width: `calc(${(b.value / max) * 100}% - 4rem)`, minWidth: b.value > 0 ? 4 : 0 }}
              />
              <span className="shrink-0 text-sm font-semibold">{b.display}</span>
            </span>
          </li>
        ))}
      </ul>
      <details className="mt-4 text-sm">
        <summary className="-my-2.5 cursor-pointer py-2.5 font-semibold text-ink-2">Als tabel</summary>
        <table className="mt-2 w-full">
          <tbody>
            {bars.map((b) => (
              <tr key={b.label} className="border-t border-line">
                <th scope="row" className="py-1.5 text-left font-normal text-ink-2">{b.label}</th>
                <td className="py-1.5 text-right font-semibold">{b.display}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}

function Tile({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="rounded-2xl bg-surface p-4 shadow-low">
      <p className="text-sm text-ink-2">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
      {note && <p className="mt-0.5 text-sm text-muted">{note}</p>}
    </div>
  );
}

export function StatsApp() {
  const trip = useTrip();
  const { list } = useExpenses();
  const { data: live, error } = usePlaces();
  const places = useMemo(() => live ?? (error ? readTripPlaces() : null), [live, error]);
  const stops = useMemo(() => {
    if (!places) return null;
    const bySlug = new Map(places.map((p) => [p.slug, p]));
    return trip.stops.map((s) => ({ ...s, place: bySlug.get(s.slug)! })).filter((s) => s.place);
  }, [places, trip.stops]);

  const routeKey = useMemo(
    () => (stops && stops.length >= 2 ? stops.map((s) => `${s.place.lat.toFixed(5)},${s.place.lng.toFixed(5)}`).join(";") : null),
    [stops],
  );
  const [route, setRoute] = useState<{ key: string; km: number | null }>({ key: "", km: null });
  useEffect(() => {
    if (!routeKey) return;
    let alive = true;
    fetch(`/api/route?p=${routeKey}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then(
        (d: { distanceM: number }) => alive && setRoute({ key: routeKey, km: d.distanceM / 1000 }),
        () => alive && setRoute({ key: routeKey, km: null }),
      );
    return () => {
      alive = false;
    };
  }, [routeKey]);

  const summary = useMemo(() => summarize(list), [list]);
  if (!stops) return <p className="text-muted">Je reis laden…</p>;

  const km = routeKey && route.key === routeKey ? route.km : null;
  const t = tripStats(stops, km, summary);

  if (!stops.length && !list.length)
    return (
      <>
        <h1 className="font-display text-3xl font-semibold">Reisstatistieken</h1>
        <p className="mt-3 text-lg text-ink-2">Bewaar plekken in Mijn reis of houd je uitgaven bij. Dan zie je hier je reis in cijfers.</p>
        <Link href="/mijn-reis" className="mt-6 inline-flex h-12 items-center gap-2 rounded-xl bg-forest px-5 font-semibold text-on-forest">
          <Icon name="heart" size={19} /> Naar Mijn reis
        </Link>
      </>
    );

  const kmLabel = !routeKey ? "Voeg een stop toe" : route.key !== routeKey ? "Berekenen…" : km === null ? "Niet beschikbaar" : `${nf.format(Math.round(km))} km`;

  return (
    <>
      <Link href="/mijn-reis" className="inline-flex h-11 items-center gap-1 font-semibold text-forest">
        <Icon name="chevronLeft" size={18} /> Mijn reis
      </Link>
      <h1 className="mt-2 font-display text-3xl font-semibold">Reisstatistieken</h1>
      <p className="mt-1 text-ink-2">
        {pluralize(t.stops, "stop", "stops")}, {pluralize(t.nights, "nacht", "nachten")}
      </p>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4" data-testid="stat-tiles">
        <Tile label="Rijden" value={kmLabel} note="Langs je stops" />
        <Tile label="Nachten" value={nf.format(t.nights)} note={t.freeNights ? `${t.freeNights} gratis` : undefined} />
        <Tile
          label="Gemiddeld per nacht"
          value={t.avgPricePerNight === null ? "Onbekend" : eur(t.avgPricePerNight)}
          note={t.knownPriceNights < t.nights && t.avgPricePerNight !== null ? `Over ${pluralize(t.knownPriceNights, "nacht", "nachten")} met bekende prijs` : "Volgens de plekken"}
        />
        <Tile
          label="Zonder stroom"
          value={t.offGridShare === null ? "Onbekend" : pct(t.offGridShare)}
          note={t.power.onbekend ? `${pluralize(t.power.onbekend, "nacht", "nachten")} onbekend` : "Van je nachten"}
        />
      </div>

      <div className="mt-6 space-y-4">
        <BarChart
          title="Nachten per stroomsituatie"
          bars={[
            { label: "Met stroom", value: t.power.met, display: pluralize(t.power.met, "nacht", "nachten") },
            { label: "Zonder stroom", value: t.power.zonder, display: pluralize(t.power.zonder, "nacht", "nachten") },
            { label: "Onbekend", value: t.power.onbekend, display: pluralize(t.power.onbekend, "nacht", "nachten"), muted: true },
          ]}
        />
        {summary.total > 0 && (
          <BarChart
            title="Uitgegeven per soort"
            caption={`Totaal ${eur(summary.total)}${summary.perDay !== undefined ? `, gemiddeld ${eur(summary.perDay)} per dag` : ""}${t.spentPerNight !== null ? `. Aan overnachtingen ${eur(t.spentPerNight)} per nacht` : ""}.`}
            bars={CATEGORIES.filter((c) => summary.byCategory[c.key] > 0)
              .map((c) => ({ label: c.label, value: summary.byCategory[c.key], display: eur(summary.byCategory[c.key]) }))
              .sort((a, b) => b.value - a.value)}
          />
        )}
      </div>
    </>
  );
}
