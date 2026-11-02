"use client";

import { useState } from "react";
import { CHANNELS, PILLARS, checkContent, postText, type Issue, type Variant } from "@/lib/marketing/content";
import type { Channel, Pillar } from "@/lib/marketing/db-types";
import { factDate, type Facts } from "@/lib/marketing/facts";
import { CHANNEL_SOURCE, campaignLink } from "@/lib/marketing/links";
import { SITE_URL } from "@/lib/env";
import { errorMessage } from "@/lib/supabase-browser";
import { toJson } from "@/lib/supabase-browser";
import { Badge, ErrorNote, PageTitle, db, input, primary, secondary, textarea } from "../../ui";
import { useFacts } from "../shared";

type Draft = Variant & { planned_on: string };

/** Contentstudio (plan §3.3): Gemini schrijft 3 varianten, de code controleert, Patrick kiest en bewaart */
export default function Content() {
  const { facts, error: factsError } = useFacts();
  const [pillar, setPillar] = useState<Pillar>("app");
  const [channel, setChannel] = useState<Channel>("instagram");
  const [note, setNote] = useState("");
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [model, setModel] = useState<string | null>(null);

  async function write() {
    setBusy(true);
    setErr(null);
    try {
      const token = (await db().auth.getSession()).data.session?.access_token;
      const res = await fetch("/api/admin/marketing/write", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token ?? ""}` },
        body: JSON.stringify({ mode: "content", pillar, channel, note }),
      });
      const out = (await res.json().catch(() => ({}))) as { variants?: Variant[]; model?: string; error?: string };
      if (!res.ok || !out.variants) throw new Error(out.error ?? `Fout ${res.status}`);
      setDrafts(out.variants.map((v) => ({ title: v.title, body: v.body, hashtags: v.hashtags, overlay: v.overlay, planned_on: "" })));
      setModel(out.model ?? null);
    } catch (e) {
      setErr(errorMessage(e));
    }
    setBusy(false);
  }

  return (
    <div className="space-y-6">
      <PageTitle title="Content" />
      <p className="text-sm text-ink-2">
        Teksten over VrijStaan voor Instagram, TikTok, Facebook en Google Ads. Gemini schrijft 3 varianten; de controle eronder kijkt naar getallen (alleen uit de feitenbank), emoji, uitroeptekens,
        superlatieven, de u-vorm en de lengte. Pas aan tot alles groen is, dan kan het op &quot;klaar&quot;.
      </p>
      <ErrorNote message={factsError} />
      <div className="grid gap-3 rounded-lg bg-surface p-4 outline outline-1 outline-line md:grid-cols-[1fr_1fr_2fr_auto] md:items-end">
        <label className="space-y-1">
          <span className="block text-sm font-semibold">Onderwerp</span>
          <select className={input} value={pillar} onChange={(e) => setPillar(e.target.value as Pillar)}>
            {Object.entries(PILLARS).map(([k, p]) => <option key={k} value={k}>{p.label}</option>)}
          </select>
        </label>
        <label className="space-y-1">
          <span className="block text-sm font-semibold">Kanaal</span>
          <select className={input} value={channel} onChange={(e) => setChannel(e.target.value as Channel)}>
            {Object.entries(CHANNELS).map(([k, c]) => <option key={k} value={k}>{c.label}</option>)}
          </select>
        </label>
        <label className="space-y-1">
          <span className="block text-sm font-semibold">Extra wens (optioneel)</span>
          <input className={input} value={note} maxLength={300} onChange={(e) => setNote(e.target.value)} placeholder="Bijvoorbeeld: richt je op Zeeland in het voorjaar" />
        </label>
        <button className={primary} onClick={write} disabled={busy || !facts}>{busy ? "Bezig met schrijven…" : drafts.length ? "Opnieuw schrijven" : "Schrijf 3 varianten"}</button>
      </div>
      <p className="text-sm text-muted">{PILLARS[pillar].brief}</p>
      <ErrorNote message={err} />

      {drafts.length > 0 && (
        <div className="grid gap-4 xl:grid-cols-3">
          {drafts.map((d, i) => (
            <DraftCard
              key={i}
              draft={d}
              channel={channel}
              pillar={pillar}
              facts={facts}
              onChange={(next) => setDrafts((all) => all.map((x, j) => (j === i ? next : x)))}
            />
          ))}
        </div>
      )}
      {model && <p className="text-sm text-muted">Geschreven door {model}. Lees alles na: de controle vangt veel, maar niet alles.</p>}
    </div>
  );
}

function DraftCard({ draft, channel, pillar, facts, onChange }: { draft: Draft; channel: Channel; pillar: Pillar; facts: Facts | null; onChange: (d: Draft) => void }) {
  const [saved, setSaved] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const issues: Issue[] = checkContent(draft, channel, facts);
  const link = campaignLink(SITE_URL, "/", CHANNEL_SOURCE[channel]);
  const isAds = channel === "google-ads";

  async function save(status: "idee" | "klaar") {
    setErr(null);
    const { error } = await db()
      .from("content_items")
      .insert({
        pillar,
        channel,
        title: draft.title,
        body: draft.body,
        hashtags: draft.hashtags,
        link,
        status,
        planned_on: draft.planned_on || null,
        facts_snapshot: facts ? toJson(facts) : null,
      });
    if (error) setErr(errorMessage(error));
    else setSaved(status === "klaar" ? "Bewaard als klaar" : "Bewaard als idee");
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(postText(draft, channel, link));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setErr("Kopiëren lukte niet. Selecteer de tekst en kopieer hem zelf.");
    }
  }

  return (
    <article className="space-y-3 rounded-lg bg-surface p-4 outline outline-1 outline-line">
      <label className="block space-y-1">
        <span className="text-sm font-semibold">{isAds ? `Kop (${draft.title.length}/30)` : "Titel (intern)"}</span>
        <input className={input} value={draft.title} onChange={(e) => onChange({ ...draft, title: e.target.value })} />
      </label>
      <label className="block space-y-1">
        <span className="text-sm font-semibold">{isAds ? `Omschrijving (${draft.body.length}/90)` : `Tekst (${draft.body.length} tekens)`}</span>
        <textarea className={`${textarea} min-h-40`} value={draft.body} onChange={(e) => onChange({ ...draft, body: e.target.value })} />
      </label>
      {channel === "tiktok" && (
        <label className="block space-y-1">
          <span className="text-sm font-semibold">Tekst in beeld</span>
          <input className={input} value={draft.overlay ?? ""} onChange={(e) => onChange({ ...draft, overlay: e.target.value })} />
        </label>
      )}
      {!isAds && (
        <label className="block space-y-1">
          <span className="text-sm font-semibold">Hashtags (gescheiden door spaties)</span>
          <input
            className={input}
            value={draft.hashtags.join(" ")}
            onChange={(e) => onChange({ ...draft, hashtags: e.target.value.split(/\s+/).map((h) => h.replace(/^#/, "").toLowerCase()).filter(Boolean) })}
          />
        </label>
      )}
      <label className="block space-y-1">
        <span className="text-sm font-semibold">Plannen op (optioneel)</span>
        <input type="date" className={input} value={draft.planned_on} onChange={(e) => onChange({ ...draft, planned_on: e.target.value })} />
      </label>

      {issues.length === 0 ? (
        <p className="flex items-center gap-2 text-sm font-semibold text-forest"><Badge tone="green">Controle</Badge> Alles in orde</p>
      ) : (
        <ul className="space-y-1 rounded-lg bg-alert-tint px-3 py-2 text-sm text-alert" aria-label="Controle">
          {issues.map((i, k) => <li key={k}>{i.detail}</li>)}
        </ul>
      )}
      {facts && <p className="text-sm text-muted">Feiten: stand {factDate(facts.measured_at)}. Link: {link}</p>}

      <div className="flex flex-wrap gap-2">
        <button className={secondary} onClick={copy}>{copied ? "Gekopieerd" : "Kopiëren"}</button>
        <button className={secondary} onClick={() => save("idee")} disabled={!!saved}>Bewaar als idee</button>
        <button className={primary} onClick={() => save("klaar")} disabled={!!saved || issues.length > 0} title={issues.length ? "Los eerst de punten van de controle op" : undefined}>
          Bewaar als klaar
        </button>
      </div>
      {saved && <p className="text-sm font-semibold text-forest">{saved}. Zie Kalender.</p>}
      <ErrorNote message={err} />
    </article>
  );
}
