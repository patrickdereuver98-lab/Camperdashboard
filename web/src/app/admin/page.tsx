"use client";

import Link from "next/link";
import { Icon, type IconName } from "@/components/icons";
import { ErrorNote, db, secondary, useQuery } from "./ui";

/**
 * Beheerdashboard (opdracht Patrick, 26 november 2026): wat er binnenkomt, wat er klaarligt en of alles draait, in één
 * scherm. Eén aanroep: public.admin_dashboard() (migratie 20261126100000). Het oude overzicht met bezoek en dekking
 * staat onder Datakwaliteit.
 */

type Queue = { key: string; count: number; oldest: string | null };
type Api = { source: string; status: "ok" | "failed"; at: string; http: number | null; ms: number | null; message: string | null; failed_24h: number; total_24h: number };
type Job = { name: string; active: boolean; schedule: string; last: string | null; last_status: string | null; failed_24h: number };
type Incoming = { kind: string; at: string; title: string | null; detail: string | null; source: string | null };
type Activity = { at: string; action: string; entity: string; who: string | null; place: string | null; field: string | null; note: string | null };
type Update = { package: string; from: string | null; to: string | null; type: string | null; status: string; advice: string | null; pr: number | null; url: string | null };
type Dashboard = {
  generated_at: string;
  core: { published: number; departure: number; free: number; price: number; goal: number };
  drafts: number;
  queues: Queue[];
  triage_sources: Record<string, number>;
  incoming: Incoming[];
  apis: Api[];
  jobs: Job[];
  errors: { by_source: { source: string; level: string; count: number }[]; latest: { at: string; level: string; source: string; message: string }[] };
  decided_24h: { approved: number; rejected: number };
  activity: Activity[];
  updates: Update[];
};

const QUEUES: Record<string, { label: string; hint: string; href: string; icon: IconName }> = {
  triage: { label: "Voorstellen", hint: "Triage Inbox: wijzigingen van lezers, Google en eigenaren", href: "/admin/mission-control", icon: "inbox" },
  vertrektijden: { label: "Vertrektijden", hint: "Zonder vertrektijd, nog niet bevestigd", href: "/admin/vertrektijden", icon: "clock" },
  inzendingen: { label: "Inzendingen", hint: "Nieuwe plekken, correcties en claims", href: "/admin/inzendingen", icon: "plus" },
  support: { label: "Support", hint: "Open vragen van bezoekers", href: "/admin/support", icon: "mail" },
  reviews: { label: "Reviews", hint: "Wachten op moderatie", href: "/admin/reviews", icon: "star" },
  fotos: { label: "Foto's", hint: "Wachten op moderatie", href: "/admin/fotos", icon: "eye" },
  kandidaten: { label: "Kandidaten", hint: "Mogelijke nieuwe plekken uit bronnen", href: "/admin/mission-control", icon: "pin" },
};

const API_LABEL: Record<string, [string, string]> = {
  site: ["VrijStaan-site", "Is de site publiek bereikbaar?"],
  pdok: ["PDOK", "Adressen zoeken"],
  osrm: ["OSRM", "Rijtijden en routes"],
  openfreemap: ["OpenFreeMap", "Kaarttegels"],
  wsrv: ["wsrv", "Foto's verkleinen"],
  overpass: ["Overpass", "Import uit OpenStreetMap"],
  "inbound-email": ["Inkomende mail", "Antwoorden van eigenaren"],
  pg_net: ["pg_net", "Uitgaande aanroepen van de database"],
};

// Taken die bewust uit staan, met de reden (implementatieplan en LANCERING)
const JOB_OFF_REASON: Record<string, string> = {
  scrape: "Gepauzeerd door de herlees-rem (parser 47, 20 november)",
  "scrape-refresh": "Gepauzeerd door de herlees-rem (20 november)",
  "stealth-enqueue": "Gepauzeerd door de herlees-rem (20 november)",
  "ai-lezer": "Uit tot er een budget op de Gemini-sleutel staat (22 november)",
  "review-lezer": "Uit, besluit Patrick 26 november",
};

const nf = new Intl.NumberFormat("nl-NL");
const pct = (n: number, d: number) => (d ? (100 * n) / d : 0);

/** "3 min geleden", "2 uur geleden", "4 dagen geleden" */
function ago(ts: string | null, now: number): string {
  if (!ts) return "nooit";
  const s = Math.max(0, (now - new Date(ts).getTime()) / 1000);
  if (s < 90) return "zojuist";
  if (s < 3600) return `${Math.round(s / 60)} min geleden`;
  if (s < 86400 * 2) return `${Math.round(s / 3600)} uur geleden`;
  return `${Math.round(s / 86400)} dagen geleden`;
}

function Panel({ title, action, children, className = "" }: { title: string; action?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={`flex min-w-0 flex-col rounded-lg border border-line bg-surface ${className}`}>
      <header className="flex min-h-12 items-center justify-between gap-3 border-b border-line px-4 py-2">
        <h2 className="font-display text-h3 font-semibold">{title}</h2>
        {action}
      </header>
      <div className="min-w-0 flex-1">{children}</div>
    </section>
  );
}

function Dot({ tone }: { tone: "ok" | "warn" | "bad" | "off" }) {
  const c = { ok: "bg-forest", warn: "bg-ember", bad: "bg-alert", off: "bg-line" }[tone];
  return <span aria-hidden="true" className={`inline-block h-2.5 w-2.5 shrink-0 rounded-full ${c}`} />;
}

export default function Overzicht() {
  const { data, error, loading, reload } = useQuery(() => db().rpc("admin_dashboard"), []);
  const d = data as Dashboard | null;
  const now = d ? new Date(d.generated_at).getTime() : 0;

  // Een meting ouder dan een dag zegt niets meer over nu: dan "geen recente meting", geen storing
  const stale = (a: Api) => !a.total_24h;
  const failingApis = d?.apis.filter((a) => a.status === "failed" && !stale(a)) ?? [];
  const failingJobs = d?.jobs.filter((j) => j.active && j.failed_24h > 0) ?? [];
  const errors24 = d?.errors.by_source.filter((e) => e.level === "error").reduce((a, e) => a + e.count, 0) ?? 0;
  const issues = failingApis.length + failingJobs.length;
  const openWork = d?.queues.reduce((a, q) => a + q.count, 0) ?? 0;

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-h1 font-semibold">Overzicht</h1>
          <p className="text-sm text-muted">
            {d ? `Bijgewerkt ${new Date(d.generated_at).toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit" })}` : loading ? "Laden…" : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {d && (
            <span
              className={`inline-flex h-11 items-center gap-2 rounded-md border px-3 text-sm font-semibold ${
                issues ? "border-alert/40 bg-alert-tint text-alert" : "border-forest/30 bg-forest-tint text-forest"
              }`}
              role="status"
            >
              <Dot tone={issues ? "bad" : "ok"} />
              {issues ? `${issues} ${issues === 1 ? "storing" : "storingen"}` : "Alles draait"}
            </span>
          )}
          <button onClick={reload} className={secondary} disabled={loading}>
            <Icon name="refresh" size={18} /> {loading ? "Bezig…" : "Vernieuwen"}
          </button>
        </div>
      </div>

      <ErrorNote message={error && /admin_dashboard/.test(error) ? "Het dashboard is nog niet live in de database (migratie 20261126100000)." : error} />

      {d && (
        <>
          {/* Kerncijfers */}
          <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-line bg-line lg:grid-cols-5">
            <Kpi label="Vertrekregel bekend" value={`${pct(d.core.departure, d.core.published).toFixed(1).replace(".", ",")}%`} sub={`${nf.format(d.core.departure)} van ${nf.format(d.core.published)} · doel 90%`}>
              <Progress value={d.core.departure / d.core.published} goal={d.core.goal} />
            </Kpi>
            <Kpi label="Zonder vertrektijd" value={nf.format(d.core.free)} sub="vrij of per 24 uur" tone="forest" />
            <Kpi label="Prijs bekend" value={`${Math.round(pct(d.core.price, d.core.published))}%`} sub={`${nf.format(d.core.price)} plekken`} />
            <Kpi label="Open werk" value={nf.format(openWork)} sub={`${nf.format(d.decided_24h.approved + d.decided_24h.rejected)} besluiten in 24 uur`} />
            <Kpi label="Gepubliceerd" value={nf.format(d.core.published)} sub={`${nf.format(d.drafts)} concepten`} />
          </div>

          <div className="grid gap-5 lg:grid-cols-12">
            {/* Werkvoorraad */}
            <Panel title="Werkvoorraad" className="lg:col-span-7">
              <ul className="divide-y divide-line">
                {[...d.queues].sort((a, b) => b.count - a.count).map((q) => {
                  const meta = QUEUES[q.key];
                  if (!meta) return null;
                  return (
                    <li key={q.key}>
                      <Link href={meta.href} className="flex min-h-14 items-center gap-3 px-4 py-2.5 hover:bg-sunken/60">
                        <span className={`hidden h-9 w-9 shrink-0 place-items-center rounded-md sm:grid ${q.count ? "bg-forest-tint text-forest" : "bg-sunken text-muted"}`}>
                          <Icon name={meta.icon} size={18} />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block font-semibold">{meta.label}</span>
                          <span className="block truncate text-sm text-muted">
                            {meta.hint}
                            {q.key === "triage" && q.count > 0 && Object.keys(d.triage_sources).length > 0 &&
                              ` · ${Object.entries(d.triage_sources).map(([s, n]) => `${s} ${n}`).join(", ")}`}
                          </span>
                        </span>
                        <span className="shrink-0 text-right">
                          <span className={`block font-display text-h3 font-semibold tabular-nums ${q.count ? "" : "text-muted"}`}>{nf.format(q.count)}</span>
                          <span className="hidden text-sm text-muted sm:block">{q.count ? `oudste ${ago(q.oldest, now)}` : "leeg"}</span>
                        </span>
                        <Icon name="chevronRight" size={18} className="shrink-0 text-muted" />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </Panel>

            {/* Binnenkomend */}
            <Panel title="Binnenkomend" className="lg:col-span-5">
              {d.incoming.length ? (
                <ul className="divide-y divide-line">
                  {d.incoming.slice(0, 10).map((i, n) => (
                    <li key={n}>
                      <Link href={QUEUES[i.kind]?.href ?? "/admin"} className="flex items-start gap-3 px-4 py-2.5 hover:bg-sunken/60">
                        <Icon name={QUEUES[i.kind]?.icon ?? "inbox"} size={18} className="mt-0.5 shrink-0 text-forest" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-semibold">{i.title ?? "Onbekend"}</span>
                          <span className="block truncate text-sm text-muted">
                            {QUEUES[i.kind]?.label} · {i.detail} · {i.source}
                          </span>
                        </span>
                        <span className="shrink-0 text-sm text-muted">{ago(i.at, now)}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="flex items-center gap-2 px-4 py-8 text-muted">
                  <Icon name="check" size={18} className="text-forest" /> Niets nieuws binnengekomen. Alle wachtrijen zijn leeg.
                </p>
              )}
            </Panel>
          </div>

          {/* Status van de diensten */}
          <Panel title="Diensten en API's" action={<span className="text-sm text-muted">Gemeten elke 10 minuten</span>}>
            <ul className="grid gap-px bg-line sm:grid-cols-2 xl:grid-cols-4">
              {d.apis.map((a) => {
                const [name, what] = API_LABEL[a.source] ?? [a.source, ""];
                const up = a.total_24h ? 100 - pct(a.failed_24h, a.total_24h) : null;
                const tone = stale(a) ? "off" : a.status === "failed" ? "bad" : a.failed_24h ? "warn" : "ok";
                return (
                  <li key={a.source} className="bg-surface px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Dot tone={tone} />
                      <span className="font-semibold">{name}</span>
                      <span className={`ml-auto text-sm font-semibold ${tone === "bad" ? "text-alert" : tone === "warn" ? "text-ember" : tone === "off" ? "text-muted" : "text-forest"}`}>
                        {tone === "off" ? "Niet gemeten" : a.status === "failed" ? "Storing" : tone === "warn" ? "Wisselend" : "Werkt"}
                      </span>
                    </div>
                    <p className="mt-0.5 text-sm text-muted">{what}</p>
                    <p className="mt-1 text-sm text-ink-2 tabular-nums">
                      {up !== null ? `${up.toFixed(up === 100 ? 0 : 1).replace(".", ",")}% in 24 uur` : "Geen metingen in 24 uur"}
                      {a.ms !== null && a.status === "ok" ? ` · ${nf.format(a.ms)} ms` : ""}
                    </p>
                    {a.status === "failed" && a.message && !stale(a) && <p className="mt-1 line-clamp-2 text-sm text-alert" title={a.message}>{a.message}</p>}
                    <p className="text-sm text-muted">{stale(a) ? `Laatste meting ${ago(a.at, now)}` : ago(a.at, now)}</p>
                  </li>
                );
              })}
            </ul>
          </Panel>

          <div className="grid gap-5 lg:grid-cols-12">
            {/* Geplande taken */}
            <Panel title="Geplande taken" className="lg:col-span-7" action={<span className="text-sm text-muted">{d.jobs.filter((j) => j.active).length} van {d.jobs.length} aan</span>}>
              <div className="max-h-[28rem] overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-surface text-left text-muted">
                    <tr className="border-b border-line">
                      <th className="px-4 py-2 font-semibold">Taak</th>
                      <th className="hidden px-2 py-2 font-semibold sm:table-cell">Laatste run</th>
                      <th className="px-4 py-2 text-right font-semibold whitespace-nowrap">Fouten 24u</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {[...d.jobs].sort((a, b) => Number(a.active) - Number(b.active) || b.failed_24h - a.failed_24h || a.name.localeCompare(b.name)).map((j) => (
                      <tr key={j.name} className={j.active ? "" : "bg-sunken/40"}>
                        <td className="px-4 py-2">
                          <span className="flex items-center gap-2">
                            <Dot tone={!j.active ? "off" : j.failed_24h ? "bad" : "ok"} />
                            <span className="font-mono font-semibold">{j.name}</span>
                            {!j.active && <span className="rounded-sm bg-sunken px-1.5 text-muted">uit</span>}
                          </span>
                          {!j.active && JOB_OFF_REASON[j.name] && <span className="mt-0.5 block pl-4.5 text-muted">{JOB_OFF_REASON[j.name]}</span>}
                          <span className="block pl-4.5 text-muted sm:hidden">Laatste run {ago(j.last, now)}</span>
                        </td>
                        <td className="hidden px-2 py-2 whitespace-nowrap text-ink-2 sm:table-cell">{ago(j.last, now)}</td>
                        <td className={`px-4 py-2 text-right tabular-nums ${j.failed_24h ? "font-semibold text-alert" : "text-muted"}`}>{j.failed_24h}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Panel>

            {/* Fouten */}
            <Panel title="Fouten en waarschuwingen" className="lg:col-span-5" action={<Link href="/admin/logs" className="text-sm font-semibold text-forest underline">Alle logs</Link>}>
              <div className="flex flex-wrap gap-2 border-b border-line px-4 py-3">
                <span className={`rounded-md px-2 py-1 text-sm font-semibold ${errors24 ? "bg-alert-tint text-alert" : "bg-forest-tint text-forest"}`}>{errors24} fouten in 24 uur</span>
                {d.errors.by_source.map((e) => (
                  <span key={e.source + e.level} className="rounded-md bg-sunken px-2 py-1 text-sm text-ink-2">
                    {e.source}: {e.count} {e.level === "error" ? "fout" : "waarsch."}
                  </span>
                ))}
              </div>
              {d.errors.latest.length ? (
                <ul className="divide-y divide-line">
                  {d.errors.latest.map((e, n) => (
                    <li key={n} className="px-4 py-2.5 text-sm">
                      <span className="flex items-center gap-2">
                        <Dot tone={e.level === "error" ? "bad" : "warn"} />
                        <span className="font-semibold">{e.source}</span>
                        <span className="ml-auto text-muted">{ago(e.at, now)}</span>
                      </span>
                      <span className="mt-0.5 block text-ink-2">{e.message}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="px-4 py-8 text-muted">Geen fouten of waarschuwingen in de laatste 24 uur.</p>
              )}
            </Panel>
          </div>

          <div className="grid gap-5 lg:grid-cols-12">
            {/* Updates van de app */}
            <Panel title="Updates van de app" className="lg:col-span-5">
              {d.updates.length ? (
                <ul className="divide-y divide-line">
                  {d.updates.map((u) => (
                    <li key={u.package + u.to} className="px-4 py-2.5 text-sm">
                      <span className="flex items-center gap-2">
                        <span className="font-mono font-semibold">{u.package}</span>
                        <span className="text-muted">{u.from} → {u.to}</span>
                        <span className="ml-auto rounded-sm bg-sunken px-1.5 text-ink-2">{u.status}</span>
                      </span>
                      {u.advice && <span className="mt-0.5 block text-ink-2">{u.advice}</span>}
                      {u.url && (
                        <a href={u.url} target="_blank" rel="noopener noreferrer" className="mt-0.5 inline-block font-semibold text-forest underline">
                          PR #{u.pr}
                        </a>
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="px-4 py-8 text-muted">Geen openstaande updates gemeld door Dependabot.</p>
              )}
            </Panel>

            {/* Recente besluiten */}
            <Panel
              title="Recente besluiten"
              className="lg:col-span-7"
              action={<span className="text-sm text-muted">24 uur: {nf.format(d.decided_24h.approved)} geaccepteerd, {nf.format(d.decided_24h.rejected)} afgewezen</span>}
            >
              <ul className="divide-y divide-line">
                {groupActivity(d.activity).map((a, n) => (
                  <li key={n} className="flex items-start gap-3 px-4 py-2.5 text-sm">
                    <Icon name={/reject|hidden|verborgen|cleared/.test(a.action) ? "x" : "check"} size={16} className={`mt-0.5 shrink-0 ${/reject|hidden|verborgen|cleared/.test(a.action) ? "text-alert" : "text-forest"}`} />
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold">
                        {ACTION_LABEL[a.action] ?? a.action}
                        {a.field ? `: ${a.field}` : ""}
                        {a.count > 1 ? ` (${a.count}×)` : ""}
                      </span>
                      {a.place && <span className="block truncate text-ink-2">{a.count > 1 ? `o.a. ${a.place}` : a.place}</span>}
                      {a.note && <span className="block truncate text-muted">{a.note}</span>}
                    </span>
                    <span className="shrink-0 text-muted">{ago(a.at, now)}</span>
                  </li>
                ))}
              </ul>
            </Panel>
          </div>

          <p className="flex flex-wrap gap-x-5 text-sm">
            <Link href="/admin/datakwaliteit" className="-my-3 py-3 font-semibold text-forest underline">Datakwaliteit en dekking</Link>
            <Link href="/admin/statistieken" className="-my-3 py-3 font-semibold text-forest underline">Bezoek en zoekopdrachten</Link>
          </p>
        </>
      )}
    </div>
  );
}

const ACTION_LABEL: Record<string, string> = {
  update_rejected: "Voorstel afgewezen",
  update_accepted: "Voorstel geaccepteerd",
  update_applied: "Voorstel geaccepteerd",
  departure_checked: "Vertrektijd bevestigd",
  departure_cleared: "Vertrektijd gewist",
  place_hidden: "Plek verborgen",
  verborgen: "Plek verborgen",
  a4_vertrekregel: "Vertrekregel bijgewerkt",
  a5_kernfeit: "Kernfeit bijgewerkt",
};

function Kpi({ label, value, sub, tone, children }: { label: string; value: string; sub: string; tone?: "forest"; children?: React.ReactNode }) {
  return (
    <div className="bg-surface px-4 py-3.5">
      <p className="text-sm font-semibold text-muted">{label}</p>
      <p className={`mt-0.5 font-display text-h1 leading-none font-semibold tabular-nums ${tone === "forest" ? "text-forest" : ""}`}>{value}</p>
      <p className="mt-1 text-sm text-ink-2">{sub}</p>
      {children}
    </div>
  );
}

/** Voortgang naar het doel, met een streep op het doel */
function Progress({ value, goal }: { value: number; goal: number }) {
  return (
    <div className="relative mt-2 h-2 rounded-full bg-sunken" role="img" aria-label={`${Math.round(value * 100)}% van het doel ${Math.round(goal * 100)}%`}>
      <div className="h-2 rounded-full bg-forest" style={{ width: `${Math.min(100, value * 100)}%` }} />
      <div className="absolute -top-1 h-4 w-0.5 bg-ink" style={{ left: `${goal * 100}%` }} />
    </div>
  );
}

/** Besluiten van dezelfde soort en hetzelfde veld als één regel met het aantal, in de volgorde van de nieuwste */
function groupActivity(list: Activity[]): (Activity & { count: number })[] {
  const out = new Map<string, Activity & { count: number }>();
  for (const a of list) {
    const k = `${a.action}|${a.field ?? ""}`;
    const g = out.get(k);
    if (g) g.count++;
    else out.set(k, { ...a, count: 1 });
  }
  return [...out.values()];
}
