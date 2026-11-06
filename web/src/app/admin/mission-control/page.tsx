"use client";

import Link from "next/link";
import { useState } from "react";
import { errorMessage } from "@/lib/supabase-browser";
import { groupUpdates } from "@/lib/update-triage";
import { Badge, Empty, ErrorNote, PageTitle, Segmented, danger, db, primary, secondary, useQuery, when } from "../ui";

type Tab = "inbox" | "logs" | "updates";

/**
 * Mission Control: Triage Inbox (updates van gebruikers met AI-advies), Logboeken (API's, cron, scrapers) en de
 * update-radar (Dependabot). Marketing staat apart op /admin/marketing. Alleen voor rol admin: de database (RLS, has_admin_role) geeft anderen lege lijsten.
 */
export default function MissionControl() {
  const [tab, setTab] = useState<Tab>("inbox");
  const role = useQuery(() => db().rpc("has_admin_role"), []);
  return (
    <div className="mx-auto max-w-7xl space-y-4">
      <PageTitle title="Mission Control" />
      {role.data === false && (
        <ErrorNote message="Alleen accounts met de rol admin zien Mission Control. Je rol is support of gebruiker." />
      )}
      <Segmented
        label="Onderdeel"
        value={tab}
        onChange={setTab}
        options={[
          { value: "inbox", label: "Triage Inbox" },
          { value: "logs", label: "Logboeken" },
          { value: "updates", label: "Updates" },
        ]}
      />
      {tab === "inbox" && <TriageInbox />}
      {tab === "logs" && <SystemLogs />}
      {tab === "updates" && <SystemUpdates />}
    </div>
  );
}

const th = "px-2 py-1.5 text-left font-semibold text-muted";
const td = "px-2 py-1.5 align-top";
const table = "w-full min-w-[56rem] border-collapse text-sm";
const wrap = "overflow-x-auto rounded-lg bg-surface outline-1 outline-line outline";

const show = (v: unknown) => (v === null || v === undefined ? "onbekend" : v === true ? "ja" : v === false ? "nee" : typeof v === "string" ? v : JSON.stringify(v));

// ── Triage Inbox ─────────────────────────────────────────────────────────────────────────────────────────────────────
type Update = {
  id: string;
  field_changed: string;
  old_value: unknown;
  new_value: unknown;
  source: string;
  submission_id: string | null;
  owner_reply_id: string | null;
  ai_score: number | null;
  ai_advice: string | null;
  created_at: string;
  places: { name: string; slug: string } | null;
};

const FIELD_LABEL: Record<string, string> = { verified_at: "bevestigt gegevens" };
const SOURCE_TONE: Record<string, "green" | "yellow" | "neutral" | "road"> = { eigenaar: "green", "mail (onbevestigd)": "yellow" };

function scoreTone(s: number | null) {
  return s === null ? "neutral" : s >= 70 ? "green" : s >= 40 ? "yellow" : "red";
}

function TriageInbox() {
  const { data, error, loading, reload } = useQuery(
    () =>
      db()
        .from("updates_queue")
        .select("id, field_changed, old_value, new_value, source, submission_id, owner_reply_id, ai_score, ai_advice, created_at, places(name, slug)")
        .eq("status", "pending")
        .order("created_at")
        .limit(200),
    [],
  );
  const updates = (data ?? []) as unknown as Update[];
  const rows = groupUpdates(updates);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function evaluate(id: string) {
    const token = (await db().auth.getSession()).data.session?.access_token;
    const res = await fetch("/api/admin/evaluate-update", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token ?? ""}` },
      body: JSON.stringify({ id }),
    });
    if (!res.ok) throw new Error(((await res.json().catch(() => ({}))) as { error?: string }).error ?? `Fout ${res.status}`);
  }

  async function run(id: string, action: () => PromiseLike<{ error: unknown }> | Promise<void>) {
    setBusy(id);
    setErr(null);
    try {
      const out = await action();
      if (out && out.error) setErr(errorMessage(out.error));
    } catch (e) {
      setErr(errorMessage(e));
    }
    setBusy(null);
    reload();
  }

  async function evaluateAll() {
    setBusy("alle");
    setErr(null);
    for (const r of updates.filter((r) => r.ai_score === null)) {
      try {
        await evaluate(r.id);
      } catch (e) {
        setErr(errorMessage(e));
        break;
      }
    }
    setBusy(null);
    reload();
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <p className="mr-auto text-sm text-ink-2">
          {rows.length} open. Accepteer zet de waarde in de plek met het merkteken van beheer; het AI-advies is alleen een hulpmiddel.
          Bron &quot;mail (onbevestigd)&quot; komt van een ander adres dan dat van de plek: controleer het eerst bij de eigenaar.
        </p>
        <button className={secondary} onClick={evaluateAll} disabled={busy !== null || !updates.some((r) => r.ai_score === null)}>
          {busy === "alle" ? "Bezig…" : "AI-check voor alles zonder score"}
        </button>
        <button className={secondary} onClick={reload}>Vernieuwen</button>
      </div>
      <ErrorNote message={error ?? err} />
      {loading && !rows.length ? (
        <p className="text-muted">Laden…</p>
      ) : !rows.length ? (
        <Empty>Geen openstaande updates.</Empty>
      ) : (
        <div className={wrap}>
          <table className={table}>
            <thead className="border-b border-line">
              <tr>
                <th className={th}>Plek</th><th className={th}>Bron</th><th className={th}>Veld</th><th className={th}>Oud</th><th className={th}>Nieuw</th>
                <th className={th}>AI</th><th className={th}>Advies</th><th className={th}>Binnen</th><th className={th}><span className="sr-only">Acties</span></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-line last:border-0">
                  <td className={td}>
                    {r.places ? <Link href={`/plek/${r.places.slug}`} target="_blank" className="font-semibold text-forest underline">{r.places.name}</Link> : "?"}
                  </td>
                  <td className={td}><Badge tone={SOURCE_TONE[r.source] ?? "neutral"}>{r.source}</Badge></td>
                  <td className={`${td} font-mono`}>{r.fields.map((f) => FIELD_LABEL[f.field_changed] ?? f.field_changed).join(" + ")}</td>
                  <td className={`${td} text-muted`}>{r.fields.map((f) => show(f.old_value)).join(", ")}</td>
                  <td className={`${td} font-semibold`}>{r.fields.map((f) => show(f.new_value)).join(", ")}</td>
                  <td className={td}><Badge tone={scoreTone(r.ai_score)}>{r.ai_score ?? "–"}</Badge></td>
                  <td className={`${td} max-w-xs text-ink-2`}>{r.ai_advice ?? ""}</td>
                  <td className={`${td} whitespace-nowrap text-muted`}>{when(r.created_at)}</td>
                  <td className={`${td} whitespace-nowrap`}>
                    <div className="flex gap-1.5">
                      <button className={`${secondary} h-9 px-3`} disabled={busy !== null} onClick={() => run(r.id, () => evaluate(r.id))}>AI</button>
                      <button className={`${primary} h-9 px-3`} disabled={busy !== null} onClick={() => run(r.id, () => db().rpc("admin_apply_update", { p_id: r.id }))}>Accepteer</button>
                      <button className={`${danger} h-9 px-3`} disabled={busy !== null} onClick={() => run(r.id, () => db().rpc("admin_reject_update", { p_id: r.id }))}>Wijs af</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Logboeken ────────────────────────────────────────────────────────────────────────────────────────────────────────
type Log = {
  id: number;
  ts: string;
  kind: string;
  source: string;
  status: "ok" | "failed" | "warn" | "pending";
  message: string | null;
  http_status: number | null;
  duration_ms: number | null;
};

const STATUS_TONE = { ok: "green", failed: "red", warn: "yellow", pending: "neutral" } as const;
const STATUS_LABEL = { ok: "OK", failed: "Mislukt", warn: "Let op", pending: "Bezig" } as const;

function SystemLogs() {
  const [kind, setKind] = useState("");
  const [onlyFailed, setOnlyFailed] = useState(false);
  const { data, error, reload } = useQuery(() => {
    let q = db().from("admin_logs").select("id, ts, kind, source, status, message, http_status, duration_ms").order("ts", { ascending: false }).limit(300);
    if (kind) q = q.eq("kind", kind);
    if (onlyFailed) q = q.eq("status", "failed");
    return q;
  }, [kind, onlyFailed]);
  const rows = (data ?? []) as Log[];

  // Laatste afgeronde check per API: de stand van nu
  const latest = new Map<string, Log>();
  for (const r of rows) if (r.kind === "api" && r.status !== "pending" && !latest.has(r.source)) latest.set(r.source, r);

  return (
    <div className="space-y-3">
      {latest.size > 0 && (
        <ul className="flex flex-wrap gap-2" aria-label="Stand van de API's">
          {[...latest.values()].map((r) => (
            <li key={r.source}>
              <Badge tone={STATUS_TONE[r.status]}>
                {r.source} {r.status === "ok" ? `${r.duration_ms ?? "?"} ms` : STATUS_LABEL[r.status]}
              </Badge>
            </li>
          ))}
        </ul>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <select className="h-10 rounded-lg border border-line bg-surface px-2 text-sm" value={kind} onChange={(e) => setKind(e.target.value)} aria-label="Soort">
          <option value="">Alles</option>
          <option value="api">API-statussen</option>
          <option value="cron">Cron</option>
          <option value="sync">Synchronisaties (OSM, PDOK)</option>
          <option value="scraper">Scrapers</option>
          <option value="deploy">Updates</option>
        </select>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={onlyFailed} onChange={(e) => setOnlyFailed(e.target.checked)} /> Alleen mislukt
        </label>
        <button className={`${secondary} ml-auto`} onClick={reload}>Vernieuwen</button>
      </div>
      <ErrorNote message={error} />
      {!rows.length ? (
        <Empty>Geen regels. De API-checks draaien elke 10 minuten.</Empty>
      ) : (
        <div className={wrap}>
          <table className={table}>
            <thead className="border-b border-line">
              <tr>
                <th className={th}>Tijd</th><th className={th}>Soort</th><th className={th}>Bron</th><th className={th}>Status</th>
                <th className={th}>HTTP</th><th className={th}>Duur</th><th className={th}>Bericht</th>
              </tr>
            </thead>
            <tbody className="tabular-nums">
              {rows.map((r) => (
                <tr key={r.id} className={`border-b border-line last:border-0 ${r.status === "failed" ? "bg-alert-tint" : ""}`}>
                  <td className={`${td} whitespace-nowrap text-muted`}>{when(r.ts)}</td>
                  <td className={td}>{r.kind}</td>
                  <td className={`${td} font-mono`}>{r.source}</td>
                  <td className={td}><Badge tone={STATUS_TONE[r.status]}>{STATUS_LABEL[r.status]}</Badge></td>
                  <td className={td}>{r.http_status ?? ""}</td>
                  <td className={td}>{r.duration_ms !== null ? `${r.duration_ms} ms` : ""}</td>
                  <td className={`${td} break-words text-ink-2`}>{r.message ?? ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Updates (dependency-radar) ───────────────────────────────────────────────────────────────────────────────────────
type Dep = {
  id: string;
  package_name: string;
  version_from: string | null;
  version_to: string | null;
  update_type: string | null;
  category: "kritiek" | "aanbevolen" | "uitstellen";
  ai_advice: string | null;
  ai_model: string | null;
  status: "auto-merged" | "pending_review" | "rejected";
  pr_url: string | null;
  updated_at: string;
};

const CAT_TONE = { kritiek: "red", aanbevolen: "road", uitstellen: "neutral" } as const;
const DEP_STATUS = { "auto-merged": ["Automatisch samengevoegd", "green"], pending_review: ["Klik nodig", "yellow"], rejected: ["Afgewezen", "neutral"] } as const;

function SystemUpdates() {
  const { data, error, reload } = useQuery(
    () => db().from("dependency_updates").select("*").order("updated_at", { ascending: false }).limit(200),
    [],
  );
  const rows = (data ?? []) as Dep[];
  const open = rows.filter((r) => r.status === "pending_review").length;
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <p className="mr-auto text-sm text-ink-2">
          {open} wacht{open === 1 ? "" : "en"} op een handmatige klik. Kritiek wordt alleen na groene CI automatisch samengevoegd, nooit bij een major-versie.
        </p>
        <button className={secondary} onClick={reload}>Vernieuwen</button>
      </div>
      <ErrorNote message={error} />
      {!rows.length ? (
        <Empty>Nog geen updates gemeld. Ze verschijnen zodra Dependabot een PR opent.</Empty>
      ) : (
        <div className={wrap}>
          <table className={table}>
            <thead className="border-b border-line">
              <tr>
                <th className={th}>Pakket</th><th className={th}>Versie</th><th className={th}>Categorie</th><th className={th}>Status</th>
                <th className={th}>Advies</th><th className={th}>Bijgewerkt</th><th className={th}>PR</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className={`border-b border-line last:border-0 ${r.status === "pending_review" ? "bg-ember-tint" : ""}`}>
                  <td className={`${td} font-mono`}>{r.package_name}</td>
                  <td className={`${td} whitespace-nowrap font-mono`}>
                    {r.version_from ?? "?"} → {r.version_to ?? "?"} {r.update_type && r.update_type !== "onbekend" && <span className="text-muted">({r.update_type})</span>}
                  </td>
                  <td className={td}><Badge tone={CAT_TONE[r.category]}>{r.category}</Badge></td>
                  <td className={td}><Badge tone={DEP_STATUS[r.status][1]}>{DEP_STATUS[r.status][0]}</Badge></td>
                  <td className={`${td} max-w-md text-ink-2`}>
                    {r.ai_advice ?? ""} {r.ai_model && <span className="text-muted">({r.ai_model})</span>}
                  </td>
                  <td className={`${td} whitespace-nowrap text-muted`}>{when(r.updated_at)}</td>
                  <td className={td}>
                    {r.pr_url && (
                      <a href={r.pr_url} target="_blank" rel="noreferrer" className="font-semibold text-forest underline">
                        {r.status === "pending_review" ? "Beoordelen" : "Bekijk"}
                      </a>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
