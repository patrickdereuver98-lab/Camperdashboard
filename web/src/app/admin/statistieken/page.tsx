"use client";

import Link from "next/link";
import { useState } from "react";
import { Card, Empty, ErrorNote, PageTitle, Segmented, db, secondary, useQuery } from "../ui";

type Stats = {
  days: number;
  totals: { page_views: number; sessions: number; searches: number; place_views: number; outbound: number; routes: number; saves: number };
  per_day: { day: string; page_views: number; sessions: number }[] | null;
  top_pages: { path: string; n: number }[] | null;
  top_searches: { q: string; n: number }[] | null;
  top_places: { slug: string; name: string | null; views: number; routes: number; outbound: number }[] | null;
  consent: { total: number; analytics: number } | null;
};

type Period = "7" | "30" | "90" | "365";

const PERIODS: { value: Period; label: string }[] = [
  { value: "7", label: "7 dagen" },
  { value: "30", label: "30 dagen" },
  { value: "90", label: "90 dagen" },
  { value: "365", label: "365 dagen" },
];

const TILES: { key: keyof Stats["totals"]; label: string }[] = [
  { key: "page_views", label: "Paginaweergaven" },
  { key: "sessions", label: "Bezoeken" },
  { key: "searches", label: "Zoekopdrachten" },
  { key: "place_views", label: "Plekken bekeken" },
  { key: "routes", label: "Route geopend" },
  { key: "outbound", label: "Naar website" },
  { key: "saves", label: "Bewaard" },
];

const nf = (n: number) => (n ?? 0).toLocaleString("nl-NL");

export default function Statistieken() {
  const [period, setPeriod] = useState<Period>("30");
  const days = Number(period);
  const { data, error, loading, reload } = useQuery(() => db().rpc("admin_stats", { p_days: days }), [days]);
  const s = data as Stats | null;
  const t = s?.totals;
  const hasData = !!t && Object.values(t).some((v) => Number(v) > 0);
  const consent = s?.consent;
  const consentPct = consent?.total ? Math.round((consent.analytics / consent.total) * 100) : null;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageTitle title="Statistieken">
        <button onClick={reload} className={secondary}>Vernieuwen</button>
      </PageTitle>
      <div className="space-y-1 text-sm text-muted">
        <p>Alleen bezoekers die statistieken toestonden. Geen IP-adressen, geen cookies; gegevens worden na 13 maanden verwijderd.</p>
        {consent && (
          <p>
            {consentPct === null
              ? "Nog geen bezoekers die een keuze maakten."
              : `${nf(consent.analytics)} van ${nf(consent.total)} bezoekers die een keuze maakten, stonden statistieken toe (${consentPct}%).`}
          </p>
        )}
      </div>
      <Segmented label="Periode" value={period} onChange={setPeriod} options={PERIODS} />
      <ErrorNote message={error} />
      {!s ? (
        <p className="text-muted">Cijfers laden…</p>
      ) : !hasData ? (
        <Empty>Nog geen statistieken. Die verschijnen zodra bezoekers statistieken toestaan.</Empty>
      ) : (
        <div className={`space-y-6 transition-opacity ${loading ? "opacity-60" : ""}`} aria-busy={loading}>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
            {TILES.map((tile) => (
              <div key={tile.key} className="rounded-2xl bg-surface p-4 outline-1 outline-line outline">
                <p className="text-sm font-semibold text-muted">{tile.label}</p>
                <p className="mt-1 font-display text-2xl font-semibold tabular-nums sm:text-3xl">{nf(t![tile.key])}</p>
              </div>
            ))}
          </div>

          <Card>
            <h2 className="font-display text-lg font-semibold">Bezoek per dag</h2>
            <DayChart rows={s.per_day ?? []} days={s.days || days} />
          </Card>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <h2 className="font-display text-lg font-semibold">Populairste pagina&apos;s</h2>
              <Ranked rows={(s.top_pages ?? []).map((p) => ({ key: p.path, label: p.path, n: p.n }))} unit="Weergaven" />
            </Card>
            <Card>
              <h2 className="font-display text-lg font-semibold">Meest gezochte plaatsen</h2>
              <Ranked rows={(s.top_searches ?? []).map((q) => ({ key: q.q, label: q.q, n: q.n }))} unit="Keer" />
            </Card>
          </div>

          <Card>
            <h2 className="font-display text-lg font-semibold">Populairste plekken</h2>
            {(s.top_places ?? []).length === 0 ? (
              <p className="mt-3 text-muted">Nog geen plekken bekeken in deze periode.</p>
            ) : (
              <div className="-mx-4 mt-3 overflow-x-auto px-4">
                <table className="w-full text-sm">
                  <thead className="text-left text-muted">
                    <tr>
                      <th className="py-1 pr-3 font-semibold">Plek</th>
                      <th className="px-2 text-right font-semibold">Bekeken</th>
                      <th className="px-2 text-right font-semibold">Routes</th>
                      <th className="pl-2 text-right font-semibold">Website-kliks</th>
                    </tr>
                  </thead>
                  <tbody className="tabular-nums">
                    {(s.top_places ?? []).map((p) => (
                      <tr key={p.slug} className="border-t border-line">
                        <td className="max-w-[12rem] py-1.5 pr-3 sm:max-w-none">
                          <Link href={`/plek/${p.slug}`} className="block truncate font-semibold text-forest hover:underline">
                            {p.name || p.slug}
                          </Link>
                        </td>
                        <td className="px-2 text-right">{nf(p.views)}</td>
                        <td className="px-2 text-right">{nf(p.routes)}</td>
                        <td className="pl-2 text-right">{nf(p.outbound)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}

function Ranked({ rows, unit }: { rows: { key: string; label: string; n: number }[]; unit: string }) {
  if (rows.length === 0) return <p className="mt-3 text-muted">Nog niets in deze periode.</p>;
  return (
    <table className="mt-3 w-full table-fixed text-sm">
      <thead className="text-left text-muted">
        <tr>
          <th className="py-1 font-semibold">Wat</th>
          <th className="w-24 text-right font-semibold">{unit}</th>
        </tr>
      </thead>
      <tbody className="tabular-nums">
        {rows.map((r) => (
          <tr key={r.key} className="border-t border-line">
            <td className="truncate py-1.5 pr-3" title={r.label}>{r.label}</td>
            <td className="text-right">{nf(r.n)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** YYYY-MM-DD van vandaag in Nederlandse tijd */
function today() {
  return new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Amsterdam" });
}

function shift(day: string, delta: number) {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

function label(day: string, withYear: boolean) {
  return new Date(`${day}T00:00:00Z`).toLocaleDateString("nl-NL", {
    timeZone: "UTC",
    day: "numeric",
    month: "short",
    ...(withYear ? { year: "2-digit" } : {}),
  });
}

/** Staafdiagram van paginaweergaven per dag, met bezoeken als dunne lijn; ontbrekende dagen tellen als 0 */
function DayChart({ rows, days }: { rows: NonNullable<Stats["per_day"]>; days: number }) {
  const byDay = new Map(rows.map((r) => [r.day.slice(0, 10), r]));
  const last = rows.reduce((m, r) => (r.day.slice(0, 10) > m ? r.day.slice(0, 10) : m), today());
  const series = Array.from({ length: days }, (_, i) => {
    const day = shift(last, i - days + 1);
    const r = byDay.get(day);
    return { day, views: Number(r?.page_views ?? 0), sessions: Number(r?.sessions ?? 0) };
  });
  const max = Math.max(1, ...series.map((d) => Math.max(d.views, d.sessions)));
  const H = 100;
  const n = series.length;
  const gap = n > 60 ? 0 : 0.2;
  const line = series.map((d, i) => `${i + 0.5},${H - (d.sessions / max) * H}`).join(" ");
  const ticks = Array.from(new Set([0, Math.round((n - 1) / 3), Math.round(((n - 1) * 2) / 3), n - 1]));
  const withYear = days > 90;

  return (
    <figure className="mt-3">
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted">
        <span className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded-sm bg-forest" aria-hidden /> Paginaweergaven</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-0.5 w-4 rounded bg-lake" aria-hidden /> Bezoeken</span>
      </div>
      <div className="mt-3 grid grid-cols-[auto_1fr] gap-x-2">
        <div className="flex h-44 flex-col justify-between text-right text-xs tabular-nums text-muted sm:h-56">
          <span>{nf(max)}</span>
          <span>{nf(Math.round(max / 2))}</span>
          <span>0</span>
        </div>
        <div className="relative h-44 border-b border-l border-line sm:h-56">
          <div className="pointer-events-none absolute inset-x-0 top-0 border-t border-dashed border-line" />
          <div className="pointer-events-none absolute inset-x-0 top-1/2 border-t border-dashed border-line" />
          <svg
            viewBox={`0 0 ${n} ${H}`}
            preserveAspectRatio="none"
            className="absolute inset-0 h-full w-full"
            role="img"
            aria-label={`Paginaweergaven en bezoeken per dag, laatste ${days} dagen`}
          >
            {series.map((d, i) => (
              <rect key={d.day} x={i + gap / 2} y={H - (d.views / max) * H} width={1 - gap} height={(d.views / max) * H} className="fill-forest">
                <title>{`${label(d.day, true)}: ${nf(d.views)} weergaven, ${nf(d.sessions)} bezoeken`}</title>
              </rect>
            ))}
            <polyline
              points={line}
              fill="none"
              className="stroke-lake"
              strokeWidth={2}
              strokeOpacity={0.8}
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />
          </svg>
        </div>
        <div />
        <div className="relative mt-1 h-5 text-xs text-muted">
          {ticks.map((i) => (
            <span
              key={i}
              className="absolute top-0 whitespace-nowrap"
              style={{
                left: `${((i + 0.5) / n) * 100}%`,
                transform: i === 0 ? "translateX(0)" : i === n - 1 ? "translateX(-100%)" : "translateX(-50%)",
              }}
            >
              {label(series[i].day, withYear)}
            </span>
          ))}
        </div>
      </div>
    </figure>
  );
}
