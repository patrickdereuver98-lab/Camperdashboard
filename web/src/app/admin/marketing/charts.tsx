"use client";

import { useState } from "react";
import { nl } from "@/lib/marketing/facts";

const shortDate = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString("nl-NL", { day: "numeric", month: "short" });

/**
 * Eén reeks per dag als staven (dataviz-richtlijn: één as, één kleur, geen legenda bij één reeks). Bosgroen via het
 * thema-token, zodat donker vanzelf de donkere stap krijgt. Hover of focus toont dag en waarde; een tabel staat eronder.
 */
export function DayBars({ title, rows }: { title: string; rows: { date: string; value: number }[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 600;
  const H = 160;
  const max = Math.max(1, ...rows.map((r) => r.value));
  const n = Math.max(1, rows.length);
  const step = W / n;
  const bar = Math.max(1, step - 2);
  const h = (v: number) => (v / max) * (H - 8);
  const active = hover !== null ? rows[hover] : undefined;
  return (
    <figure className="space-y-2 rounded-lg bg-surface p-4 outline outline-1 outline-line">
      <figcaption className="flex items-baseline justify-between gap-2">
        <span className="font-semibold">{title}</span>
        <span className="text-sm text-muted tabular-nums" aria-live="polite">
          {active ? `${shortDate(active.date)}: ${nl(active.value)}` : `hoogste ${nl(max)}`}
        </span>
      </figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-40 w-full" role="img" aria-label={`${title}, ${rows.length} dagen, hoogste ${nl(max)}`} onMouseLeave={() => setHover(null)}>
        <line x1={0} x2={W} y1={H - 0.5} y2={H - 0.5} className="stroke-line" strokeWidth={1} />
        {rows.map((r, i) => {
          const bh = h(r.value);
          const x = i * step + 1;
          const radius = Math.min(4, bar / 2, bh);
          return (
            <g key={r.date} onMouseEnter={() => setHover(i)}>
              {/* Raakvlak over de hele hoogte, groter dan de staaf */}
              <rect x={i * step} y={0} width={step} height={H} fill="transparent" />
              {bh > 0 && (
                <path
                  d={`M${x},${H} V${H - bh + radius} Q${x},${H - bh} ${x + radius},${H - bh} H${x + bar - radius} Q${x + bar},${H - bh} ${x + bar},${H - bh + radius} V${H} Z`}
                  className={hover === i ? "fill-forest-deep" : "fill-forest"}
                />
              )}
            </g>
          );
        })}
      </svg>
      <div className="flex justify-between text-sm text-muted">
        <span>{rows[0] && shortDate(rows[0].date)}</span>
        <span>{rows.at(-1) && shortDate(rows.at(-1)!.date)}</span>
      </div>
      <details className="text-sm">
        <summary className="cursor-pointer font-semibold text-forest">Als tabel</summary>
        <table className="mt-2 w-full">
          <thead>
            <tr><th className="text-left font-semibold text-muted">Dag</th><th className="text-right font-semibold text-muted">{title.split(" ")[0]}</th></tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.date}><td>{shortDate(r.date)}</td><td className="text-right tabular-nums">{nl(r.value)}</td></tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}
