"use client";

import Link from "next/link";
import { Badge, Card, ErrorNote, PageTitle, db, secondary, useQuery, when } from "./ui";

type Overview = {
  places: {
    total: number;
    published: number;
    draft: number;
    hidden: number;
    locked: number;
    near: number;
    with_website: number;
    blocked_contact: number;
    blocked_facts: number;
    blocked_score: number;
  };
  buckets: { from: number; count: number }[];
  coverage: Record<string, number>;
  kinds: Record<string, number> | null;
  provinces: Record<string, number> | null;
  scrape: { queued: number; done: number; failed: number; last: string | null };
  osm: { code: string; name: string; last_run_at: string | null; busy: boolean }[];
  support: { open_tickets: number; pending_reviews: number; new_submissions: number; errors_24h: number };
  traffic: { day: string; views: number; sessions: number; searches: number; outbound: number }[];
  top_pages: { path: string; views: number }[];
  consent: { total: number; analytics: number; marketing: number; last_30d: number };
};

const FIELDS: Record<string, string> = {
  price: "Prijs",
  power: "Stroom",
  water: "Water",
  dump_station: "Afvalwater",
  toilet: "Toilet",
  shower: "Douche",
  wifi: "Wifi",
  dogs: "Honden",
  capacity: "Aantal plekken",
  season: "Seizoen",
  photos: "Foto",
  description: "Beschrijving",
  phone: "Telefoon",
};

export default function Dashboard() {
  const { data, error, reload } = useQuery(() => db().rpc("admin_overview"), []);
  const o = data as Overview | null;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageTitle title="Overzicht">
        <button onClick={reload} className={secondary}>Vernieuwen</button>
      </PageTitle>
      <ErrorNote message={error} />
      {!o ? (
        !error && <p className="text-muted">Cijfers laden…</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat label="Gepubliceerd" value={o.places.published} sub={`van ${o.places.total.toLocaleString("nl-NL")} in de database`} />
            <Stat label="Bijna online" value={o.places.near} sub="score 60%+, nog niet gepubliceerd" />
            <Stat label="Open tickets" value={o.support.open_tickets} href="/admin/support" alert={o.support.open_tickets > 0} />
            <Stat label="Reviews te keuren" value={o.support.pending_reviews} href="/admin/reviews" alert={o.support.pending_reviews > 0} />
            <Stat label="Nieuwe inzendingen" value={o.support.new_submissions} href="/admin/inzendingen" alert={o.support.new_submissions > 0} />
            <Stat label="Fouten (24 uur)" value={o.support.errors_24h} href="/admin/logs" alert={o.support.errors_24h > 0} />
            <Stat label="Websites in wachtrij" value={o.scrape.queued} sub={o.scrape.last ? `laatst ${when(o.scrape.last)}` : undefined} />
            <Stat label="Toestemmingen" value={o.consent.total} sub={`${o.consent.analytics} analytisch, ${o.consent.marketing} marketing`} />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <h2 className="font-display text-lg font-semibold">Volledigheid van de data</h2>
              <p className="text-sm text-muted">Gewogen score; een plek gaat online vanaf de drempel in Instellingen en als de harde eisen kloppen.</p>
              <dl className="mt-3 grid grid-cols-3 gap-2 text-center text-sm">
                <div className="rounded-xl bg-sunken p-2"><dt className="text-muted">Geen contact</dt><dd className="font-display text-lg font-semibold">{o.places.blocked_contact}</dd></div>
                <div className="rounded-xl bg-sunken p-2"><dt className="text-muted">Mist beslisfeiten</dt><dd className="font-display text-lg font-semibold">{o.places.blocked_facts}</dd></div>
                <div className="rounded-xl bg-sunken p-2"><dt className="text-muted">Score te laag</dt><dd className="font-display text-lg font-semibold">{o.places.blocked_score}</dd></div>
              </dl>
              <ul className="mt-4 space-y-2">
                {[...o.buckets].reverse().map((b) => (
                  <Bar key={b.from} label={`${Math.round(b.from * 100)}%+`} value={b.count} max={o.places.total} tone={b.from >= 0.7 ? "green" : b.from >= 0.6 ? "yellow" : "muted"} />
                ))}
              </ul>
            </Card>
            <Card>
              <h2 className="font-display text-lg font-semibold">Welke velden zijn bekend</h2>
              <p className="text-sm text-muted">Over alle {o.coverage.total.toLocaleString("nl-NL")} plekken, alleen uit echte bronnen.</p>
              <ul className="mt-4 space-y-2">
                {Object.entries(FIELDS).map(([k, label]) => (
                  <Bar key={k} label={label} value={o.coverage[k] ?? 0} max={o.coverage.total} percent />
                ))}
              </ul>
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                <h2 className="font-display text-lg font-semibold">Bezoek, laatste 14 dagen</h2>
                <Link href="/admin/statistieken" className="text-sm font-semibold text-forest hover:underline">Alle statistieken</Link>
              </div>
              <p className="text-sm text-muted">Alleen bezoekers die analytische cookies accepteerden.</p>
              {o.traffic.length === 0 ? (
                <p className="mt-4 text-muted">Nog geen metingen.</p>
              ) : (
                <table className="mt-3 w-full text-sm">
                  <thead className="text-left text-muted">
                    <tr><th className="py-1 font-semibold">Dag</th><th className="font-semibold">Weergaven</th><th className="font-semibold">Sessies</th><th className="font-semibold">Zoekacties</th><th className="font-semibold">Doorkliks</th></tr>
                  </thead>
                  <tbody className="tabular-nums">
                    {o.traffic.map((t) => (
                      <tr key={t.day} className="border-t border-line">
                        <td className="py-1.5">{new Date(t.day).toLocaleDateString("nl-NL", { weekday: "short", day: "numeric", month: "short" })}</td>
                        <td>{t.views}</td><td>{t.sessions}</td><td>{t.searches}</td><td>{t.outbound}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Card>
            <Card>
              <h2 className="font-display text-lg font-semibold">Meest bekeken pagina&apos;s (30 dagen)</h2>
              {o.top_pages.length === 0 ? (
                <p className="mt-4 text-muted">Nog geen metingen.</p>
              ) : (
                <ol className="mt-3 space-y-1.5 text-sm">
                  {o.top_pages.map((p) => (
                    <li key={p.path} className="flex justify-between gap-3">
                      <span className="truncate">{p.path}</span>
                      <span className="tabular-nums text-muted">{p.views}</span>
                    </li>
                  ))}
                </ol>
              )}
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <h2 className="font-display text-lg font-semibold">Gepubliceerd per provincie</h2>
              <ul className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1.5 text-sm">
                {Object.entries(o.provinces ?? {}).sort((a, b) => b[1] - a[1]).map(([p, c]) => (
                  <li key={p} className="flex justify-between"><span>{p}</span><span className="tabular-nums text-muted">{c}</span></li>
                ))}
              </ul>
            </Card>
            <Card>
              <h2 className="font-display text-lg font-semibold">OpenStreetMap-import per provincie</h2>
              <p className="text-sm text-muted">Elke provincie wordt wekelijks automatisch ververst.</p>
              <ul className="mt-3 space-y-1.5 text-sm">
                {o.osm.map((r) => (
                  <li key={r.code} className="flex justify-between gap-3">
                    <span>{r.name}</span>
                    <span className="text-muted">{r.busy ? <Badge tone="road">bezig</Badge> : r.last_run_at ? when(r.last_run_at) : "nog niet"}</span>
                  </li>
                ))}
              </ul>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}

function Stat({ label, value, sub, href, alert }: { label: string; value: number; sub?: string; href?: string; alert?: boolean }) {
  const body = (
    <>
      <p className="text-sm font-semibold text-muted">{label}</p>
      <p className={`mt-1 font-display text-3xl font-semibold tabular-nums ${alert ? "text-forest" : ""}`}>{value.toLocaleString("nl-NL")}</p>
      {sub && <p className="mt-0.5 text-sm text-muted">{sub}</p>}
    </>
  );
  const cls = "block rounded-2xl bg-surface p-4 outline-1 outline-line outline";
  return href ? <Link href={href} className={`${cls} hover:outline-forest`}>{body}</Link> : <div className={cls}>{body}</div>;
}

function Bar({ label, value, max, tone = "road", percent }: { label: string; value: number; max: number; tone?: "road" | "green" | "yellow" | "muted"; percent?: boolean }) {
  const pct = max ? (value / max) * 100 : 0;
  const color = { road: "bg-forest", green: "bg-forest", yellow: "bg-ember", muted: "bg-line" }[tone];
  return (
    <li className="grid grid-cols-[7.5rem_1fr_4rem] items-center gap-3 text-sm">
      <span className="truncate">{label}</span>
      <span className="h-2.5 overflow-hidden rounded-full bg-sunken">
        <span className={`block h-full rounded-full ${color}`} style={{ width: `${Math.max(pct, value ? 1 : 0)}%` }} />
      </span>
      <span className="text-right tabular-nums text-muted">{percent ? `${Math.round(pct)}%` : value.toLocaleString("nl-NL")}</span>
    </li>
  );
}
