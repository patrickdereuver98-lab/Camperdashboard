"use client";

import { useMemo, useState } from "react";
import { nl } from "@/lib/marketing/facts";
import { BRAND, opportunities, sumPeriods, type Opportunity, type QueryRow, type TotalsRow } from "@/lib/marketing/seo";
import type { SeoPage, SeoStatus } from "@/lib/marketing/db-types";
import { ISLANDS } from "@/lib/seo-pages";
import { PROVINCES } from "@/lib/types";
import { Badge, Empty, ErrorNote, PageTitle, Segmented, db, input, useQuery, when } from "../../ui";
import { DayBars } from "../charts";
import { Section, Stat, delta, notLive } from "../shared";

type Range = "28" | "90";
type Tab = "kansen" | "zoekvragen" | "paginas" | "techniek";
type Row = QueryRow & { count: number };

const pct = (n: number) => `${(n * 100).toFixed(1).replace(".", ",")}%`;
const pos = (n: number | null) => (n === null ? "–" : n.toFixed(1).replace(".", ","));
const path = (url: string) => {
  try {
    return new URL(url).pathname || "/";
  } catch {
    return url;
  }
};

/** Vindbaarheid (plan §3.2): Search Console-cijfers uit de nachtelijke run (.github/workflows/marketing.yml) */
export default function Vindbaarheid() {
  const [range, setRange] = useState<Range>("28");
  const [tab, setTab] = useState<Tab>("kansen");
  const days = Number(range);
  const totals = useQuery(
    () => db().from("seo_totals").select("date, device, clicks, impressions, position").eq("device", "alle").order("date", { ascending: false }).limit(days * 2 + 7),
    [days],
  );
  const queries = useQuery(() => db().rpc("marketing_seo_rows", { p_days: days, p_by: "query", p_limit: 1000 }), [days]);
  const pages = useQuery(() => db().rpc("marketing_seo_rows", { p_days: days, p_by: "page", p_limit: 500 }), [days]);
  const status = useQuery(() => db().from("seo_status").select("*"), []);

  const t = (totals.data ?? []) as TotalsRow[];
  const g = sumPeriods(t, days);
  const shown = [...t].sort((a, b) => a.date.localeCompare(b.date)).slice(-days);
  const qRows = useMemo(() => (queries.data ?? []) as Row[], [queries.data]);
  const pRows = (pages.data ?? []) as Row[];
  const st = (status.data ?? []) as SeoStatus[];
  const lastRun = st.find((s) => s.key === "laatste-run");
  const areaNames = useMemo(() => [...PROVINCES, ...ISLANDS.map((i) => i.name)], []);
  const kansen = useMemo(() => opportunities(qRows, areaNames), [qRows, areaNames]);

  return (
    <div className="space-y-6">
      <PageTitle title="Vindbaarheid">
        <Segmented label="Periode" value={range} onChange={setRange} options={[{ value: "28", label: "28 dagen" }, { value: "90", label: "3 maanden" }]} />
      </PageTitle>
      <p className="text-sm text-muted">
        Uit Google Search Console, elke nacht bijgewerkt. Google loopt 2 tot 3 dagen achter.{" "}
        {lastRun ? `Laatste run: ${when(lastRun.checked_at)}.` : "Nog geen run: zet GSC_SERVICE_ACCOUNT_JSON in GitHub (plan §6, P1 en P2)."}
      </p>
      <ErrorNote message={notLive(totals.error ?? queries.error ?? pages.error ?? status.error)} />

      {g.current.days === 0 ? (
        <Empty>Nog geen gegevens uit Search Console.</Empty>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat label="Klikken" value={nl(g.current.clicks)} sub={delta(g.current.clicks, g.previous.clicks).text} tone={delta(g.current.clicks, g.previous.clicks).tone} />
            <Stat label="Vertoningen" value={nl(g.current.impressions)} sub={delta(g.current.impressions, g.previous.impressions).text} tone={delta(g.current.impressions, g.previous.impressions).tone} />
            <Stat label="CTR" value={pct(g.current.ctr)} sub={`vorige periode ${pct(g.previous.ctr)}`} />
            <Stat label="Gem. positie" value={pos(g.current.position)} sub="lager is beter" />
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <DayBars title="Klikken per dag" rows={shown.map((r) => ({ date: r.date, value: r.clicks }))} />
            <DayBars title="Vertoningen per dag" rows={shown.map((r) => ({ date: r.date, value: r.impressions }))} />
          </div>
        </>
      )}

      <Segmented
        label="Onderdeel"
        value={tab}
        onChange={setTab}
        options={[
          { value: "kansen", label: "Kansen", count: kansen.length },
          { value: "zoekvragen", label: "Zoekvragen" },
          { value: "paginas", label: "Pagina's" },
          { value: "techniek", label: "Techniek" },
        ]}
      />
      {tab === "kansen" && <Kansen rows={kansen} />}
      {tab === "zoekvragen" && <Queries rows={qRows} />}
      {tab === "paginas" && <Pages rows={pRows} />}
      {tab === "techniek" && <Techniek status={st} />}
    </div>
  );
}

const KIND = {
  "nieuwe-pagina": { label: "Nieuwe pagina", tone: "road" },
  ctr: { label: "Weinig klikken", tone: "yellow" },
  bijna: { label: "Bijna top 10", tone: "green" },
} as const;

function Kansen({ rows }: { rows: Opportunity[] }) {
  if (!rows.length)
    return <Empty>Geen kansen gevonden. Kansen verschijnen bij zoekvragen met minstens 30 vertoningen (zonder de merknaam).</Empty>;
  return (
    <ul className="space-y-3">
      {rows.slice(0, 60).map((k) => (
        <li key={`${k.kind}-${k.query}`} className="space-y-1 rounded-lg bg-surface p-4 outline outline-1 outline-line">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={KIND[k.kind].tone}>{KIND[k.kind].label}</Badge>
            <span className="font-semibold">&quot;{k.query}&quot;</span>
            <span className="text-sm text-muted">
              {nl(k.impressions)} vertoningen, {nl(k.clicks)} klikken, positie {pos(k.position)}
            </span>
          </div>
          <p className="text-ink-2">{k.advice}</p>
          <a href={k.page} target="_blank" rel="noreferrer" className="text-sm font-semibold break-all text-forest underline">
            {path(k.page)}
          </a>
        </li>
      ))}
    </ul>
  );
}

const th = "px-3 py-2 text-left font-semibold text-muted";
const thr = "px-3 py-2 text-right font-semibold text-muted";
const td = "px-3 py-2 align-top";
const tdr = "px-3 py-2 text-right tabular-nums";

function Queries({ rows }: { rows: Row[] }) {
  const [brand, setBrand] = useState<"alle" | "zonder" | "merk">("zonder");
  const [q, setQ] = useState("");
  const list = rows.filter((r) => (brand === "alle" ? true : brand === "merk" ? BRAND.test(r.query) : !BRAND.test(r.query)) && r.query.toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Segmented label="Merknaam" value={brand} onChange={setBrand} options={[{ value: "zonder", label: "Zonder merknaam" }, { value: "merk", label: "Met merknaam" }, { value: "alle", label: "Alle" }]} />
        <input className={`${input} h-10 max-w-xs`} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Zoek in zoekvragen" aria-label="Zoek in zoekvragen" />
      </div>
      {!list.length ? (
        <Empty>Geen zoekvragen.</Empty>
      ) : (
        <div className="overflow-x-auto rounded-lg bg-surface outline outline-1 outline-line">
          <table className="w-full min-w-[40rem] text-sm">
            <thead className="border-b border-line">
              <tr><th className={th}>Zoekvraag</th><th className={thr}>Klikken</th><th className={thr}>Vertoningen</th><th className={thr}>CTR</th><th className={thr}>Positie</th><th className={th}>Beste pagina</th></tr>
            </thead>
            <tbody>
              {list.slice(0, 300).map((r) => (
                <tr key={r.query} className="border-b border-line last:border-0">
                  <td className={`${td} font-semibold`}>{r.query}</td>
                  <td className={tdr}>{nl(r.clicks)}</td>
                  <td className={tdr}>{nl(r.impressions)}</td>
                  <td className={tdr}>{pct(r.impressions ? r.clicks / r.impressions : 0)}</td>
                  <td className={tdr}>{pos(r.position)}</td>
                  <td className={`${td} max-w-xs truncate text-muted`}>{path(r.page)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Pages({ rows }: { rows: Row[] }) {
  if (!rows.length) return <Empty>Geen pagina&apos;s.</Empty>;
  return (
    <div className="overflow-x-auto rounded-lg bg-surface outline outline-1 outline-line">
      <table className="w-full min-w-[40rem] text-sm">
        <thead className="border-b border-line">
          <tr><th className={th}>Pagina</th><th className={thr}>Klikken</th><th className={thr}>Vertoningen</th><th className={thr}>Positie</th><th className={thr}>Zoekvragen</th><th className={th}>Grootste zoekvraag</th></tr>
        </thead>
        <tbody>
          {rows.slice(0, 300).map((r) => (
            <tr key={r.page} className="border-b border-line last:border-0">
              <td className={td}>
                <a href={r.page} target="_blank" rel="noreferrer" className="font-semibold break-all text-forest underline">{path(r.page)}</a>
              </td>
              <td className={tdr}>{nl(r.clicks)}</td>
              <td className={tdr}>{nl(r.impressions)}</td>
              <td className={tdr}>{pos(r.position)}</td>
              <td className={tdr}>{nl(r.count)}</td>
              <td className={`${td} text-muted`}>{r.query}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

type Sitemap = { path?: string; lastDownloaded?: string; errors?: string; warnings?: string; contents?: { type?: string; submitted?: string; indexed?: string }[] };
type Speed = { path: string; overall: string | null; lcp_ms: number | null; inp_ms: number | null; cls: number | null; score: number | null };

const CWV = { FAST: ["Goed", "green"], AVERAGE: ["Matig", "yellow"], SLOW: ["Slecht", "red"] } as const;

function Techniek({ status }: { status: SeoStatus[] }) {
  const pages = useQuery(() => db().from("seo_pages").select("*").order("indexed", { ascending: true, nullsFirst: true }).limit(300), []);
  const rows = (pages.data ?? []) as SeoPage[];
  const sitemaps = ((status.find((s) => s.key === "sitemaps")?.value as { sitemap?: Sitemap[] } | undefined)?.sitemap ?? []) as Sitemap[];
  const speed = status.filter((s) => s.key.startsWith("pagespeed:")).map((s) => s.value as unknown as Speed);
  const indexed = rows.filter((r) => r.indexed).length;
  return (
    <div className="space-y-6">
      <Section title="Sitemaps">
        {!sitemaps.length ? (
          <Empty>Nog geen sitemap bekend in Search Console. Stuur https://vrijstaan.nl/sitemap.xml in (plan §6, P1).</Empty>
        ) : (
          <ul className="divide-y divide-line rounded-lg bg-surface outline outline-1 outline-line">
            {sitemaps.map((s) => (
              <li key={s.path} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3">
                <span className="font-semibold break-all">{s.path}</span>
                <span className="text-sm text-muted">
                  {s.contents?.[0]?.submitted ?? "?"} ingediend{s.lastDownloaded ? `, gelezen ${when(s.lastDownloaded)}` : ""}
                </span>
                {Number(s.errors) > 0 && <Badge tone="red">{s.errors} fouten</Badge>}
                {Number(s.warnings) > 0 && <Badge tone="yellow">{s.warnings} waarschuwingen</Badge>}
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Snelheid op mobiel (Core Web Vitals)">
        {!speed.length ? (
          <Empty>Nog geen meting.</Empty>
        ) : (
          <div className="grid gap-3 sm:grid-cols-3">
            {speed.map((s) => (
              <div key={s.path} className="space-y-1 rounded-lg bg-surface p-4 outline outline-1 outline-line">
                <p className="font-semibold">{s.path}</p>
                {s.overall && s.overall in CWV ? (
                  <Badge tone={CWV[s.overall as keyof typeof CWV][1]}>{CWV[s.overall as keyof typeof CWV][0]}</Badge>
                ) : (
                  <p className="text-sm text-muted">Nog te weinig bezoekers voor veldgegevens van Chrome.</p>
                )}
                <p className="text-sm text-ink-2">
                  LCP {s.lcp_ms !== null ? `${(s.lcp_ms / 1000).toFixed(1).replace(".", ",")} s` : "–"} · INP {s.inp_ms ?? "–"} ms · CLS {s.cls !== null ? s.cls.toFixed(2).replace(".", ",") : "–"}
                </p>
                {s.score !== null && <p className="text-sm text-muted">Lighthouse {Math.round(s.score * 100)} van 100</p>}
              </div>
            ))}
          </div>
        )}
      </Section>

      <Section title={`Indexering (${indexed} van ${rows.length} gecontroleerde pagina's in Google)`}>
        <ErrorNote message={notLive(pages.error)} />
        {!rows.length ? (
          <Empty>Nog geen pagina&apos;s gecontroleerd.</Empty>
        ) : (
          <ul className="divide-y divide-line rounded-lg bg-surface outline outline-1 outline-line">
            {rows.slice(0, 100).map((r) => (
              <li key={r.url} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5">
                <Badge tone={r.indexed ? "green" : r.indexed === false ? "red" : "neutral"}>{r.indexed ? "In Google" : r.indexed === false ? "Niet in Google" : "Onbekend"}</Badge>
                <a href={r.url} target="_blank" rel="noreferrer" className="min-w-0 flex-1 font-semibold break-all text-forest underline">{path(r.url)}</a>
                <span className="text-sm text-muted">{r.coverage ?? ""}{r.last_crawl ? ` · gecrawld ${when(r.last_crawl)}` : ""}</span>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}
