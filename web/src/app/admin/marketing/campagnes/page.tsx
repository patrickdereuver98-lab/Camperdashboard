"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import type { Campaign, SocialStat } from "@/lib/marketing/db-types";
import { nl } from "@/lib/marketing/facts";
import { campaignLink, cleanSource } from "@/lib/marketing/links";
import { SITE_URL } from "@/lib/env";
import { errorMessage } from "@/lib/supabase-browser";
import { Badge, Empty, ErrorNote, PageTitle, Segmented, danger, db, input, primary, secondary, useQuery } from "../../ui";
import { Section, notLive } from "../shared";

type Tab = "linkmaker" | "campagnes" | "social";
type Traffic = { per_bron: { bron: string; sessions: number }[]; per_campagne: { bron: string; campagne: string; sessions: number }[] };

/** Kanalen en campagnes (plan §3.6) */
export default function Campagnes() {
  const [tab, setTab] = useState<Tab>("linkmaker");
  return (
    <div className="space-y-4">
      <PageTitle title="Campagnes">
        <Segmented label="Onderdeel" value={tab} onChange={setTab} options={[{ value: "linkmaker", label: "Linkmaker" }, { value: "campagnes", label: "Campagnes" }, { value: "social", label: "Sociale cijfers" }]} />
      </PageTitle>
      {tab === "linkmaker" && <LinkMaker />}
      {tab === "campagnes" && <Campaigns />}
      {tab === "social" && <Social />}
    </div>
  );
}

const PAGES = [
  { path: "/", label: "Startpagina" },
  { path: "/zoeken", label: "Zoeken" },
  { path: "/dichtbij", label: "Dichtbij" },
  { path: "/uitslapers", label: "Uitslapers" },
  { path: "/doe-mee", label: "Doe mee" },
  { path: "/mijn-reis", label: "Mijn reis" },
];

function LinkMaker() {
  const [path, setPath] = useState("/");
  const [bron, setBron] = useState("instagram");
  const [campagne, setCampagne] = useState("");
  const [svg, setSvg] = useState("");
  const [copied, setCopied] = useState(false);
  const link = campaignLink(SITE_URL, path, bron || "onbekend", campagne);

  useEffect(() => {
    let live = true;
    // Foutcorrectie M: blijft leesbaar op een geprinte flyer met een vouw of vlek
    void QRCode.toString(link, { type: "svg", errorCorrectionLevel: "M", margin: 2, color: { dark: "#1f2b24", light: "#ffffff" } }).then((s) => live && setSvg(s));
    return () => {
      live = false;
    };
  }, [link]);

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
      <div className="space-y-3">
        <p className="text-sm text-ink-2">
          Elke link draagt een bron en eventueel een campagne. Bezoekers die statistieken toestaan, tellen dan mee onder die bron in het overzicht. Geen pixel, geen cookie van derden.
        </p>
        <label className="block space-y-1">
          <span className="text-sm font-semibold">Pagina</span>
          <select className={input} value={path} onChange={(e) => setPath(e.target.value)}>
            {PAGES.map((p) => <option key={p.path} value={p.path}>{p.label}</option>)}
          </select>
        </label>
        <label className="block space-y-1">
          <span className="text-sm font-semibold">Bron</span>
          <input className={input} value={bron} onChange={(e) => setBron(e.target.value)} list="bronnen" />
          <datalist id="bronnen">
            {["instagram", "tiktok", "facebook", "facebook-groep", "google-ads", "flyer", "nieuwsbrief"].map((b) => <option key={b} value={b} />)}
          </datalist>
          <span className="block text-sm text-muted">Wordt: {cleanSource(bron) ?? "–"}</span>
        </label>
        <label className="block space-y-1">
          <span className="text-sm font-semibold">Campagne (optioneel)</span>
          <input className={input} value={campagne} onChange={(e) => setCampagne(e.target.value)} placeholder="bijvoorbeeld voorjaar-2027" />
        </label>
        <div className="space-y-2 rounded-lg bg-surface p-3 outline outline-1 outline-line">
          <p className="font-mono text-sm break-all">{link}</p>
          <button
            className={secondary}
            onClick={async () => {
              await navigator.clipboard?.writeText(link);
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            }}
          >
            {copied ? "Gekopieerd" : "Link kopiëren"}
          </button>
        </div>
      </div>
      <div className="space-y-2">
        <div className="rounded-lg bg-white p-2 outline outline-1 outline-line" role="img" aria-label={`QR-code naar ${link}`} dangerouslySetInnerHTML={{ __html: svg }} />
        {svg && (
          <a className={`${secondary} w-full`} href={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`} download={`qr-${cleanSource(bron) ?? "vrijstaan"}${campagne ? `-${cleanSource(campagne)}` : ""}.svg`}>
            QR-code downloaden (SVG, scherp op elk formaat)
          </a>
        )}
        <p className="text-sm text-muted">Voor flyers bij camperplaatsen die meedoen: print minstens 3 × 3 cm.</p>
      </div>
    </div>
  );
}

function Campaigns() {
  const list = useQuery(() => db().from("campaigns").select("*").order("created_at", { ascending: false }), []);
  const traffic = useQuery(() => db().rpc("marketing_traffic", { p_days: 400 }), []);
  const rows = (list.data ?? []) as Campaign[];
  const t = traffic.data as Traffic | null;
  const [form, setForm] = useState({ name: "", channel: "instagram" as Campaign["channel"], bron: "instagram", campagne: "", budget_eur: "", starts_on: "", ends_on: "" });
  const [err, setErr] = useState<string | null>(null);
  const budget = rows.reduce((s, c) => s + Number(c.budget_eur), 0);
  const spent = rows.reduce((s, c) => s + Number(c.spent_eur), 0);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    const bron = cleanSource(form.bron);
    const campagne = cleanSource(form.campagne || form.name);
    if (!bron || !campagne) return setErr("Vul een naam en bron in");
    const { error } = await db().from("campaigns").insert({
      name: form.name,
      channel: form.channel,
      bron,
      campagne,
      budget_eur: Number(form.budget_eur.replace(",", ".")) || 0,
      starts_on: form.starts_on || null,
      ends_on: form.ends_on || null,
    });
    if (error) return setErr(errorMessage(error));
    setForm({ ...form, name: "", campagne: "", budget_eur: "" });
    list.reload();
  }

  return (
    <div className="space-y-6">
      <ErrorNote message={notLive(list.error ?? traffic.error)} />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="rounded-lg bg-surface p-4 outline outline-1 outline-line"><p className="text-sm text-muted">Budget</p><p className="font-display text-2xl font-semibold">€ {nl(budget)}</p></div>
        <div className="rounded-lg bg-surface p-4 outline outline-1 outline-line"><p className="text-sm text-muted">Uitgegeven</p><p className={`font-display text-2xl font-semibold ${spent > budget ? "text-alert" : ""}`}>€ {nl(spent)}</p></div>
        <div className="rounded-lg bg-surface p-4 outline outline-1 outline-line"><p className="text-sm text-muted">Plan</p><p className="font-display text-2xl font-semibold">€ 50 – 100</p></div>
      </div>

      <form onSubmit={add} className="grid gap-3 rounded-lg bg-surface p-4 outline outline-1 outline-line sm:grid-cols-2 lg:grid-cols-4">
        <label className="space-y-1"><span className="block text-sm font-semibold">Naam</span><input required className={input} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Voorjaar cijfers-filmpje" /></label>
        <label className="space-y-1">
          <span className="block text-sm font-semibold">Kanaal</span>
          <select className={input} value={form.channel} onChange={(e) => setForm({ ...form, channel: e.target.value as Campaign["channel"], bron: e.target.value })}>
            {["instagram", "tiktok", "facebook", "google-ads", "flyer", "overig"].map((c) => <option key={c}>{c}</option>)}
          </select>
        </label>
        <label className="space-y-1"><span className="block text-sm font-semibold">Bron in de link</span><input required className={input} value={form.bron} onChange={(e) => setForm({ ...form, bron: e.target.value })} /></label>
        <label className="space-y-1"><span className="block text-sm font-semibold">Campagne in de link</span><input className={input} value={form.campagne} onChange={(e) => setForm({ ...form, campagne: e.target.value })} placeholder={cleanSource(form.name) ?? ""} /></label>
        <label className="space-y-1"><span className="block text-sm font-semibold">Budget (€)</span><input inputMode="decimal" className={input} value={form.budget_eur} onChange={(e) => setForm({ ...form, budget_eur: e.target.value })} /></label>
        <label className="space-y-1"><span className="block text-sm font-semibold">Start</span><input type="date" className={input} value={form.starts_on} onChange={(e) => setForm({ ...form, starts_on: e.target.value })} /></label>
        <label className="space-y-1"><span className="block text-sm font-semibold">Einde</span><input type="date" className={input} value={form.ends_on} onChange={(e) => setForm({ ...form, ends_on: e.target.value })} /></label>
        <button className={`${primary} self-end`}>Campagne toevoegen</button>
        <ErrorNote message={err} />
      </form>

      {!rows.length ? (
        <Empty>Nog geen campagnes.</Empty>
      ) : (
        <ul className="space-y-3">
          {rows.map((c) => {
            const visits = t?.per_campagne.find((x) => x.bron === c.bron && x.campagne === c.campagne)?.sessions ?? 0;
            return <CampaignRow key={c.id} c={c} visits={visits} onChange={list.reload} />;
          })}
        </ul>
      )}

      <Section title="Bezoeken per bron (alles)">
        {!t?.per_bron.length ? <Empty>Nog geen bezoeken met toestemming.</Empty> : (
          <ul className="flex flex-wrap gap-2">{t.per_bron.map((b) => <li key={b.bron}><Badge>{b.bron}: {nl(b.sessions)}</Badge></li>)}</ul>
        )}
      </Section>
    </div>
  );
}

function CampaignRow({ c, visits, onChange }: { c: Campaign; visits: number; onChange: () => void }) {
  const [spent, setSpent] = useState(String(c.spent_eur).replace(".", ","));
  const cost = visits ? Number(c.spent_eur) / visits : null;
  return (
    <li className="space-y-2 rounded-lg bg-surface p-4 outline outline-1 outline-line">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-semibold">{c.name}</span>
        <Badge>{c.channel}</Badge>
        <span className="text-sm text-muted">{c.starts_on ?? "?"} t/m {c.ends_on ?? "?"}</span>
      </div>
      <p className="font-mono text-sm break-all text-muted">{campaignLink(SITE_URL, "/", c.bron, c.campagne)}</p>
      <div className="flex flex-wrap items-end gap-3">
        <label className="space-y-1">
          <span className="block text-sm font-semibold">Uitgegeven (€, uit Meta of Google Ads)</span>
          <input
            inputMode="decimal"
            className={`${input} h-10 w-40`}
            value={spent}
            onChange={(e) => setSpent(e.target.value)}
            onBlur={() => db().from("campaigns").update({ spent_eur: Number(spent.replace(",", ".")) || 0 }).eq("id", c.id).then(onChange)}
          />
        </label>
        <p className="text-sm">
          Budget € {nl(Number(c.budget_eur))} · <strong>{nl(visits)}</strong> bezoeken met toestemming
          {cost !== null && ` · € ${cost.toFixed(2).replace(".", ",")} per bezoek`}
        </p>
        <button className={`${danger} ml-auto h-10`} onClick={() => confirm("Campagne verwijderen?") && db().from("campaigns").delete().eq("id", c.id).then(onChange)}>Verwijderen</button>
      </div>
      <p className="text-sm text-muted">Bezoeken tellen alleen mensen die statistieken toestaan: het echte aantal is hoger.</p>
    </li>
  );
}

function Social() {
  const list = useQuery(() => db().from("social_stats").select("*").order("measured_on", { ascending: false }).limit(200), []);
  const rows = (list.data ?? []) as SocialStat[];
  const [form, setForm] = useState({ platform: "instagram" as SocialStat["platform"], post_url: "", views: "", likes: "", comments: "", shares: "", saves: "" });
  const [err, setErr] = useState<string | null>(null);
  const num = (v: string) => (v.trim() === "" ? null : Math.max(0, Math.round(Number(v.replace(/\./g, "")))) || 0);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    const { error } = await db()
      .from("social_stats")
      .upsert(
        { platform: form.platform, post_url: form.post_url, views: num(form.views), likes: num(form.likes), comments: num(form.comments), shares: num(form.shares), saves: num(form.saves), source: "handmatig" },
        { onConflict: "post_url,measured_on" },
      );
    if (error) return setErr(errorMessage(error));
    setForm({ ...form, post_url: "", views: "", likes: "", comments: "", shares: "", saves: "" });
    list.reload();
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-ink-2">
        Instagram-cijfers komen elke nacht automatisch binnen als IG_ACCESS_TOKEN en IG_USER_ID in GitHub staan (zakelijk account, plan §6 P5). TikTok en Facebook vul je hier zelf in vanuit de app.
      </p>
      <ErrorNote message={notLive(list.error)} />
      <form onSubmit={add} className="grid gap-3 rounded-lg bg-surface p-4 outline outline-1 outline-line sm:grid-cols-3 lg:grid-cols-8">
        <label className="space-y-1">
          <span className="block text-sm font-semibold">Platform</span>
          <select className={input} value={form.platform} onChange={(e) => setForm({ ...form, platform: e.target.value as SocialStat["platform"] })}>
            <option value="instagram">Instagram</option><option value="tiktok">TikTok</option><option value="facebook">Facebook</option>
          </select>
        </label>
        <label className="space-y-1 sm:col-span-2"><span className="block text-sm font-semibold">Link naar de post</span><input required type="url" className={input} value={form.post_url} onChange={(e) => setForm({ ...form, post_url: e.target.value })} /></label>
        {(["views", "likes", "comments", "shares", "saves"] as const).map((k) => (
          <label key={k} className="space-y-1">
            <span className="block text-sm font-semibold">{{ views: "Weergaven", likes: "Likes", comments: "Reacties", shares: "Gedeeld", saves: "Bewaard" }[k]}</span>
            <input inputMode="numeric" className={input} value={form[k]} onChange={(e) => setForm({ ...form, [k]: e.target.value })} />
          </label>
        ))}
        <button className={`${primary} self-end sm:col-span-3 lg:col-span-8 lg:w-48`}>Opslaan (vandaag)</button>
        <ErrorNote message={err} />
      </form>
      {!rows.length ? (
        <Empty>Nog geen cijfers.</Empty>
      ) : (
        <div className="overflow-x-auto rounded-lg bg-surface outline outline-1 outline-line">
          <table className="w-full min-w-[40rem] text-sm">
            <thead className="border-b border-line">
              <tr>{["Datum", "Platform", "Post", "Weergaven", "Bereik", "Likes", "Reacties", "Gedeeld", "Bewaard", "Bron"].map((h) => <th key={h} className="px-3 py-2 text-left font-semibold text-muted">{h}</th>)}</tr>
            </thead>
            <tbody className="tabular-nums">
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-line last:border-0">
                  <td className="px-3 py-2">{r.measured_on}</td>
                  <td className="px-3 py-2">{r.platform}</td>
                  <td className="max-w-xs truncate px-3 py-2"><a href={r.post_url} target="_blank" rel="noreferrer" className="text-forest underline">{r.post_url.replace(/^https?:\/\/(www\.)?/, "")}</a></td>
                  {[r.views, r.reach, r.likes, r.comments, r.shares, r.saves].map((v, i) => <td key={i} className="px-3 py-2">{v === null ? "–" : nl(v)}</td>)}
                  <td className="px-3 py-2">{r.source}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
