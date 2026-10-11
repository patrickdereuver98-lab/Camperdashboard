"use client";

import { useState } from "react";
import { Badge, Empty, ErrorNote, PageTitle, Segmented, db, input, secondary, useQuery, when } from "../ui";

type Log = { id: number; ts: string; level: string; source: string; message: string; context: unknown };
type Audit = { id: number; ts: string; actor_email: string | null; action: string; entity: string; entity_id: string; details: unknown };
type Consent = { id: number; ts: string; consent_id: string; analytics: boolean; marketing: boolean; version: string };
type Run = { id: number; kind: string; started_at: string; finished_at: string | null; status: string; stats: unknown };

const TONE = { error: "red", warn: "yellow", info: "road", debug: "neutral" } as const;

export default function Logs() {
  const [tab, setTab] = useState<"app" | "audit" | "runs" | "consent">("app");
  const [level, setLevel] = useState("");
  const [term, setTerm] = useState("");

  const { data, error, reload } = useQuery(() => {
    if (tab === "audit") return db().from("audit_log").select("*").order("ts", { ascending: false }).limit(150);
    if (tab === "runs") return db().from("ingest_runs").select("*").order("started_at", { ascending: false }).limit(100);
    if (tab === "consent") return db().from("consent_log").select("*").order("ts", { ascending: false }).limit(150);
    let q = db().from("app_logs").select("*").order("ts", { ascending: false }).limit(200);
    if (level) q = q.eq("level", level);
    if (term) q = q.ilike("message", `%${term}%`);
    return q;
  }, [tab, level, term]);
  const rows = (data as unknown[] | null) ?? [];

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <PageTitle title="Logs">
        <button className={secondary} onClick={reload}>Vernieuwen</button>
      </PageTitle>
      <Segmented
        label="Soort log"
        value={tab}
        onChange={setTab}
        options={[
          { value: "app", label: "Systeem en fouten" },
          { value: "audit", label: "Wijzigingen door beheer" },
          { value: "runs", label: "Data-imports" },
          { value: "consent", label: "Cookietoestemming" },
        ]}
      />
      {tab === "app" && (
        <div className="grid gap-2 sm:grid-cols-[10rem_1fr]">
          <select className={input} value={level} onChange={(e) => setLevel(e.target.value)} aria-label="Niveau">
            <option value="">Alle niveaus</option>
            <option value="error">Fouten</option>
            <option value="warn">Waarschuwingen</option>
            <option value="info">Info</option>
          </select>
          <input className={input} placeholder="Zoek in berichten" value={term} onChange={(e) => setTerm(e.target.value)} />
        </div>
      )}
      <ErrorNote message={error} />
      {rows.length === 0 ? (
        <Empty>Geen regels.</Empty>
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-2xl bg-surface text-sm outline-1 outline-line outline">
          {tab === "app" &&
            (rows as Log[]).map((l) => (
              <li key={l.id} className="px-4 py-2.5">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={TONE[l.level as keyof typeof TONE] ?? "neutral"}>{l.level}</Badge>
                  <span className="text-muted">{l.source}</span>
                  <span className="ml-auto text-muted">{when(l.ts)}</span>
                </div>
                <p className="mt-1 break-words">{l.message}</p>
                <Context value={l.context} />
              </li>
            ))}
          {tab === "audit" &&
            (rows as Audit[]).map((a) => (
              <li key={a.id} className="px-4 py-2.5">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone="road">{a.action}</Badge>
                  <span>{a.entity}</span>
                  <span className="text-muted">{a.actor_email}</span>
                  <span className="ml-auto text-muted">{when(a.ts)}</span>
                </div>
                <Context value={a.details} />
              </li>
            ))}
          {tab === "runs" &&
            (rows as Run[]).map((r) => (
              <li key={r.id} className="px-4 py-2.5">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={r.status === "ok" ? "green" : r.status === "error" ? "red" : "road"}>{r.status}</Badge>
                  <span className="font-semibold">{r.kind}</span>
                  <span className="ml-auto text-muted">{when(r.started_at)}</span>
                </div>
                <Context value={r.stats} />
              </li>
            ))}
          {tab === "consent" &&
            (rows as Consent[]).map((c) => (
              <li key={c.id} className="flex flex-wrap items-center gap-2 px-4 py-2.5">
                <span className="font-mono text-xs text-muted">{c.consent_id.slice(0, 8)}</span>
                <Badge tone={c.analytics ? "green" : "neutral"}>analytisch {c.analytics ? "ja" : "nee"}</Badge>
                <Badge tone={c.marketing ? "green" : "neutral"}>marketing {c.marketing ? "ja" : "nee"}</Badge>
                <span className="text-muted">versie {c.version}</span>
                <span className="ml-auto text-muted">{when(c.ts)}</span>
              </li>
            ))}
        </ul>
      )}
    </div>
  );
}

function Context({ value }: { value: unknown }) {
  if (!value || (typeof value === "object" && !Object.keys(value as object).length)) return null;
  return (
    <details className="mt-1">
      <summary className="cursor-pointer text-muted">Details</summary>
      <pre className="mt-1 overflow-x-auto rounded-lg bg-sunken p-2 text-xs whitespace-pre-wrap">{JSON.stringify(value, null, 2)}</pre>
    </details>
  );
}
