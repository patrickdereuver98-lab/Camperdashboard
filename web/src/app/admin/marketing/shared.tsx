"use client";

import type { ReactNode } from "react";
import { parseFacts, type Facts } from "@/lib/marketing/facts";
import { db, useQuery } from "../ui";

/** Feitenbank uit de database (marketing_facts); null zolang laden of bij een fout */
export function useFacts(): { facts: Facts | null; error: string | null; loading: boolean; reload: () => void } {
  const q = useQuery(() => db().rpc("marketing_facts"), []);
  return { facts: parseFacts(q.data), error: notLive(q.error), loading: q.loading, reload: q.reload };
}

/** Fout van een tabel of functie die nog niet live staat, leesbaar maken */
export function notLive(error: string | null): string | null {
  if (!error) return null;
  if (/does not exist|could not find|schema cache|PGRST20[02]/i.test(error))
    return "Dit onderdeel staat nog niet live: de migratie van het marketingdashboard moet eerst worden toegepast.";
  return error;
}

export function Stat({ label, value, sub, tone }: { label: string; value: ReactNode; sub?: ReactNode; tone?: "up" | "down" }) {
  return (
    <div className="rounded-lg bg-surface p-4 outline outline-1 outline-line">
      <p className="text-sm text-muted">{label}</p>
      <p className="mt-1 font-display text-2xl font-semibold tabular-nums">{value}</p>
      {sub && <p className={`mt-0.5 text-sm ${tone === "up" ? "text-forest" : tone === "down" ? "text-alert" : "text-muted"}`}>{sub}</p>}
    </div>
  );
}

export function Section({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-lg font-semibold">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

/** "+12%" of "−3%" ten opzichte van de vorige periode; leeg als er geen vorige periode is */
export function delta(now: number, before: number): { text: string; tone?: "up" | "down" } {
  if (!before) return { text: now ? "nieuw" : "" };
  const pct = Math.round(((now - before) / before) * 100);
  return { text: `${pct > 0 ? "+" : pct < 0 ? "−" : ""}${Math.abs(pct)}% t.o.v. vorige periode`, tone: pct > 0 ? "up" : pct < 0 ? "down" : undefined };
}
