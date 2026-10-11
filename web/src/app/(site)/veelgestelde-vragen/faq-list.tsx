"use client";

import { useMemo, useState } from "react";
import { normalize } from "@/lib/search";
import type { FaqItem } from "@/lib/places";
import { Icon } from "@/components/icons";

export function FaqList({ items }: { items: FaqItem[] }) {
  const [q, setQ] = useState("");
  const filtered = useMemo(() => {
    const n = normalize(q);
    return n ? items.filter((f) => normalize(`${f.question} ${f.answer}`).includes(n)) : items;
  }, [items, q]);
  const groups = [...new Set(filtered.map((f) => f.category))];
  return (
    <>
      <label className="mt-6 flex h-12 items-center gap-2 rounded-xl bg-surface px-3 ring-2 ring-line focus-within:ring-road">
        <Icon name="search" size={20} className="text-muted" />
        <span className="sr-only">Zoek in de vragen</span>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Zoek in de vragen" className="h-full flex-1 bg-transparent focus:outline-none" />
      </label>
      {groups.length === 0 && <p className="mt-6 text-ink-2">Geen vragen gevonden voor &quot;{q}&quot;.</p>}
      {groups.map((g) => (
        <section key={g} className="mt-8">
          <h2 className="font-sign text-xl font-bold">{g}</h2>
          <div className="mt-3 divide-y divide-line overflow-hidden rounded-2xl bg-surface outline-1 outline-line outline">
            {filtered
              .filter((f) => f.category === g)
              .map((f) => (
                <details key={f.id} className="group">
                  <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 font-semibold [&::-webkit-details-marker]:hidden">
                    {f.question}
                    <Icon name="chevronDown" size={20} className="shrink-0 text-muted transition-transform group-open:rotate-180" />
                  </summary>
                  <p className="px-4 pb-4 text-ink-2">{f.answer}</p>
                </details>
              ))}
          </div>
        </section>
      ))}
    </>
  );
}
