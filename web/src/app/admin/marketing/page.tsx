"use client";

import Link from "next/link";
import { factDate, factLines, nl } from "@/lib/marketing/facts";
import { sumPeriods, type TotalsRow } from "@/lib/marketing/seo";
import type { Campaign, ContentItem } from "@/lib/marketing/db-types";
import { Badge, Empty, ErrorNote, PageTitle, db, secondary, useQuery } from "../ui";
import { Section, Stat, delta, notLive, useFacts } from "./shared";

type Traffic = { sessions: number; per_bron: { bron: string; sessions: number }[] };

const iso = (d: Date) => d.toISOString().slice(0, 10);
const daysAgo = (n: number) => iso(new Date(Date.now() - n * 864e5));

/** Overzicht (plan §3.1): Google, eigen bezoekers per bron, content van deze week, budget en de feitenbank */
export default function MarketingOverview() {
  const { facts, error: factsError } = useFacts();
  const totals = useQuery(
    () => db().from("seo_totals").select("date, device, clicks, impressions, position").eq("device", "alle").gte("date", daysAgo(60)).order("date"),
    [],
  );
  const traffic = useQuery(() => db().rpc("marketing_traffic", { p_days: 28 }), []);
  const week = useQuery(
    () => db().from("content_items").select("*").gte("planned_on", daysAgo(0)).lte("planned_on", iso(new Date(Date.now() + 7 * 864e5))).order("planned_on"),
    [],
  );
  const campaigns = useQuery(() => db().from("campaigns").select("*"), []);

  const g = sumPeriods((totals.data ?? []) as TotalsRow[], 28);
  const t = traffic.data as Traffic | null;
  const items = (week.data ?? []) as ContentItem[];
  const camp = (campaigns.data ?? []) as Campaign[];
  const budget = camp.reduce((s, c) => s + Number(c.budget_eur), 0);
  const spent = camp.reduce((s, c) => s + Number(c.spent_eur), 0);
  const appSessions = t?.per_bron.find((b) => b.bron === "app")?.sessions ?? 0;

  return (
    <div className="space-y-8">
      <PageTitle title="Marketing" />
      <ErrorNote message={notLive(totals.error ?? traffic.error ?? week.error ?? campaigns.error)} />

      <Section title="Google, laatste 28 dagen" action={<Link href="/admin/marketing/vindbaarheid" className="font-semibold text-forest underline">Vindbaarheid</Link>}>
        {g.current.days === 0 ? (
          <Empty>Nog geen gegevens uit Search Console. Ze komen binnen na de eerste nachtelijke run (zie Vindbaarheid).</Empty>
        ) : (
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat label="Klikken" value={nl(g.current.clicks)} {...subOf(delta(g.current.clicks, g.previous.clicks))} />
            <Stat label="Vertoningen" value={nl(g.current.impressions)} {...subOf(delta(g.current.impressions, g.previous.impressions))} />
            <Stat label="CTR" value={`${(g.current.ctr * 100).toFixed(1).replace(".", ",")}%`} />
            <Stat label="Gem. positie" value={g.current.position ? g.current.position.toFixed(1).replace(".", ",") : "–"} sub="lager is beter" />
          </div>
        )}
      </Section>

      <Section title="Bezoekers per bron, laatste 28 dagen">
        <p className="text-sm text-muted">
          Alleen bezoekers die statistieken toestaan. De bron komt uit links met <code>?bron=</code> (Campagnes → Linkmaker); &quot;app&quot; = geopend vanaf het beginscherm.
        </p>
        {!t || t.sessions === 0 ? (
          <Empty>Nog geen bezoeken met toestemming in deze periode.</Empty>
        ) : (
          <div className="grid gap-3 lg:grid-cols-[1fr_2fr]">
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-1">
              <Stat label="Bezoeken" value={nl(t.sessions)} />
              <Stat label="Vanaf het beginscherm" value={nl(appSessions)} />
            </div>
            <ul className="divide-y divide-line rounded-lg bg-surface outline outline-1 outline-line">
              {t.per_bron.slice(0, 8).map((b) => (
                <li key={b.bron} className="flex items-center gap-3 px-4 py-2.5">
                  <span className="w-28 shrink-0 font-semibold">{b.bron}</span>
                  <span className="h-2 flex-1 overflow-hidden rounded-full bg-sunken" aria-hidden>
                    <span className="block h-full bg-forest" style={{ width: `${Math.max(2, (b.sessions / t.sessions) * 100)}%` }} />
                  </span>
                  <span className="w-14 text-right tabular-nums">{nl(b.sessions)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Section>

      <div className="grid gap-8 lg:grid-cols-2">
        <Section title="Content deze week" action={<Link href="/admin/marketing/kalender" className="font-semibold text-forest underline">Kalender</Link>}>
          {items.length === 0 ? (
            <Empty>Niets gepland voor de komende 7 dagen.</Empty>
          ) : (
            <ul className="divide-y divide-line rounded-lg bg-surface outline outline-1 outline-line">
              {items.map((c) => (
                <li key={c.id} className="flex flex-wrap items-center gap-2 px-4 py-2.5">
                  <span className="w-24 text-sm text-muted">{c.planned_on && new Date(c.planned_on).toLocaleDateString("nl-NL", { weekday: "short", day: "numeric", month: "short" })}</span>
                  <span className="min-w-0 flex-1 truncate font-semibold">{c.title}</span>
                  <Badge>{c.channel}</Badge>
                  <Badge tone={c.status === "geplaatst" ? "green" : c.status === "klaar" ? "road" : "neutral"}>{c.status}</Badge>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title="Budget" action={<Link href="/admin/marketing/campagnes" className="font-semibold text-forest underline">Campagnes</Link>}>
          {camp.length === 0 ? (
            <Empty>Nog geen campagnes. Het plan gaat uit van € 50 tot € 100.</Empty>
          ) : (
            <div className="space-y-2 rounded-lg bg-surface p-4 outline outline-1 outline-line">
              <p className="font-display text-2xl font-semibold tabular-nums">
                € {nl(spent)} <span className="text-base font-normal text-muted">van € {nl(budget)} uitgegeven</span>
              </p>
              <div className="h-3 overflow-hidden rounded-full bg-sunken" role="progressbar" aria-valuenow={spent} aria-valuemin={0} aria-valuemax={budget} aria-label="Budget">
                <div className={`h-full ${spent > budget ? "bg-alert" : "bg-forest"}`} style={{ width: `${budget ? Math.min(100, (spent / budget) * 100) : 0}%` }} />
              </div>
            </div>
          )}
        </Section>
      </div>

      <Section title="Feitenbank">
        <ErrorNote message={factsError} />
        {facts && (
          <>
            <p className="text-sm text-muted">
              Stand {factDate(facts.measured_at)}. Alleen deze cijfers mogen in teksten en filmpjes. Grijs = te klein om publiek te noemen (onder 50): noem dan de functie, niet het aantal.
            </p>
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {factLines(facts).map((l) => (
                <li key={l.key} className={`rounded-lg p-3 outline outline-1 outline-line ${l.public ? "bg-surface" : "bg-sunken text-muted"}`}>
                  <p className="text-sm">{l.label}</p>
                  <p className="font-display text-xl font-semibold tabular-nums">{nl(l.value)}</p>
                </li>
              ))}
            </ul>
            <button className={secondary} onClick={() => navigator.clipboard?.writeText(factLines(facts).filter((l) => l.public).map((l) => l.text).join("\n"))}>
              Publieke feiten kopiëren
            </button>
          </>
        )}
      </Section>
    </div>
  );
}

function subOf(d: { text: string; tone?: "up" | "down" }) {
  return { sub: d.text || undefined, tone: d.tone };
}
