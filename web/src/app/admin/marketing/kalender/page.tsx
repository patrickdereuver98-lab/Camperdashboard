"use client";

import { useState } from "react";
import { CHANNELS, PILLARS, checkContent, postText } from "@/lib/marketing/content";
import type { ContentItem, ContentStatus, MarketingAsset } from "@/lib/marketing/db-types";
import type { Facts } from "@/lib/marketing/facts";
import { errorMessage } from "@/lib/supabase-browser";
import { Badge, Empty, ErrorNote, PageTitle, Segmented, danger, db, input, secondary, useQuery, when } from "../../ui";
import { notLive, useFacts } from "../shared";

type Tab = "kalender" | "bibliotheek";

const STATUS: { value: ContentStatus; label: string; tone: "neutral" | "yellow" | "road" | "green" }[] = [
  { value: "idee", label: "Idee", tone: "neutral" },
  { value: "in-de-maak", label: "In de maak", tone: "yellow" },
  { value: "klaar", label: "Klaar", tone: "road" },
  { value: "geplaatst", label: "Geplaatst", tone: "green" },
];

const dayLabel = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString("nl-NL", { weekday: "long", day: "numeric", month: "long" });
const today = () => new Date().toISOString().slice(0, 10);

/** Kalender en bibliotheek (plan §3.5) */
export default function Kalender() {
  const [tab, setTab] = useState<Tab>("kalender");
  return (
    <div className="space-y-4">
      <PageTitle title={tab === "kalender" ? "Kalender" : "Bibliotheek"}>
        <Segmented label="Onderdeel" value={tab} onChange={setTab} options={[{ value: "kalender", label: "Kalender" }, { value: "bibliotheek", label: "Bibliotheek" }]} />
      </PageTitle>
      {tab === "kalender" ? <Planning /> : <Library />}
    </div>
  );
}

function Planning() {
  const { facts } = useFacts();
  const [show, setShow] = useState<"open" | "alles">("open");
  const { data, error, reload } = useQuery(() => {
    let q = db().from("content_items").select("*").order("planned_on", { ascending: true, nullsFirst: false }).order("created_at", { ascending: false }).limit(300);
    if (show === "open") q = q.neq("status", "geplaatst");
    return q;
  }, [show]);
  const items = (data ?? []) as ContentItem[];
  const groups = new Map<string, ContentItem[]>();
  for (const i of items) {
    const k = i.planned_on ?? "";
    groups.set(k, [...(groups.get(k) ?? []), i]);
  }
  const keys = [...groups.keys()].sort((a, b) => (a === "" ? 1 : b === "" ? -1 : a.localeCompare(b)));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Segmented label="Tonen" value={show} onChange={setShow} options={[{ value: "open", label: "Nog te doen" }, { value: "alles", label: "Alles" }]} />
        <button className={`${secondary} ml-auto`} onClick={reload}>Vernieuwen</button>
      </div>
      <ErrorNote message={notLive(error)} />
      {!items.length ? (
        <Empty>Nog geen content. Schrijf iets in Content en bewaar het als idee of klaar.</Empty>
      ) : (
        keys.map((k) => (
          <section key={k || "ongepland"} className="space-y-2">
            <h2 className={`font-display text-lg font-semibold ${k && k < today() ? "text-alert" : ""}`}>
              {k ? dayLabel(k) : "Nog niet gepland"}
              {k && k < today() && <span className="ml-2 text-sm font-normal">(verlopen)</span>}
            </h2>
            <ul className="space-y-2">
              {groups.get(k)!.map((i) => <Item key={i.id} item={i} facts={facts} onChange={reload} />)}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}

function Item({ item, facts, onChange }: { item: ContentItem; facts: Facts | null; onChange: () => void }) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState(item.posted_url ?? "");
  const [err, setErr] = useState<string | null>(null);
  const issues = checkContent({ title: item.title, body: item.body, hashtags: item.hashtags }, item.channel, facts);
  const status = STATUS.find((s) => s.value === item.status)!;

  async function update(patch: Partial<ContentItem>) {
    setErr(null);
    const { error } = await db().from("content_items").update(patch).eq("id", item.id);
    if (error) setErr(errorMessage(error));
    else onChange();
  }

  return (
    <li className="space-y-2 rounded-lg bg-surface p-4 outline outline-1 outline-line">
      <div className="flex flex-wrap items-center gap-2">
        <button className="min-w-0 flex-1 text-left font-semibold hover:underline" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
          {item.title}
        </button>
        <Badge>{CHANNELS[item.channel].label}</Badge>
        <Badge tone="neutral">{PILLARS[item.pillar].label}</Badge>
        <Badge tone={status.tone}>{status.label}</Badge>
      </div>
      {open && (
        <div className="space-y-3">
          <p className="whitespace-pre-line text-ink-2">{postText(item, item.channel, item.link)}</p>
          {issues.length > 0 && (
            <ul className="rounded-lg bg-alert-tint px-3 py-2 text-sm text-alert">{issues.map((x, k) => <li key={k}>{x.detail}</li>)}</ul>
          )}
          <div className="flex flex-wrap items-end gap-2">
            <label className="space-y-1">
              <span className="block text-sm font-semibold">Status</span>
              <select
                className={`${input} h-10`}
                value={item.status}
                onChange={(e) => {
                  const s = e.target.value as ContentStatus;
                  if ((s === "klaar" || s === "geplaatst") && issues.length) return setErr("Los eerst de punten van de controle op (in Content) voordat dit op klaar of geplaatst gaat.");
                  void update({ status: s, ...(s === "geplaatst" && !item.posted_at ? { posted_at: new Date().toISOString() } : {}) });
                }}
              >
                {STATUS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </label>
            <label className="space-y-1">
              <span className="block text-sm font-semibold">Gepland op</span>
              <input type="date" className={`${input} h-10`} defaultValue={item.planned_on ?? ""} onChange={(e) => void update({ planned_on: e.target.value || null })} />
            </label>
            <label className="min-w-60 flex-1 space-y-1">
              <span className="block text-sm font-semibold">Link naar de post</span>
              <input className={`${input} h-10`} value={url} onChange={(e) => setUrl(e.target.value)} onBlur={() => url !== (item.posted_url ?? "") && void update({ posted_url: url || null })} placeholder="https://www.instagram.com/p/…" />
            </label>
            <button className={secondary} onClick={() => navigator.clipboard?.writeText(postText(item, item.channel, item.link))}>Kopiëren</button>
            <button className={danger} onClick={() => confirm("Dit item verwijderen?") && db().from("content_items").delete().eq("id", item.id).then(onChange)}>Verwijderen</button>
          </div>
          <p className="text-sm text-muted">Gemaakt {when(item.created_at)}{item.posted_at ? `, geplaatst ${when(item.posted_at)}` : ""}</p>
        </div>
      )}
      <ErrorNote message={err} />
    </li>
  );
}

function Library() {
  const [kind, setKind] = useState<"" | MarketingAsset["kind"]>("");
  const { data, error, reload } = useQuery(() => {
    let q = db().from("marketing_assets").select("*").order("created_at", { ascending: false }).limit(200);
    if (kind) q = q.eq("kind", kind);
    return q;
  }, [kind]);
  const assets = (data ?? []) as MarketingAsset[];
  return (
    <div className="space-y-3">
      <Segmented
        label="Soort"
        value={kind}
        onChange={setKind}
        options={[{ value: "", label: "Alles" }, { value: "video", label: "Filmpjes" }, { value: "schermopname", label: "Schermopnames" }, { value: "afbeelding", label: "Afbeeldingen" }]}
      />
      <ErrorNote message={notLive(error)} />
      {!assets.length ? (
        <Empty>Nog niets in de bibliotheek. Filmpjes en schermopnames komen uit Studio.</Empty>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{assets.map((a) => <AssetCard key={a.id} asset={a} onDeleted={reload} />)}</ul>
      )}
    </div>
  );
}

/** Eén bestand uit de privé bucket, met een tijdelijke link (1 uur) */
export function AssetCard({ asset, onDeleted }: { asset: MarketingAsset; onDeleted?: () => void }) {
  const signed = useQuery(() => db().storage.from("marketing").createSignedUrl(asset.storage_path, 3600), [asset.storage_path]);
  const url = (signed.data as { signedUrl?: string } | null)?.signedUrl;
  const name = asset.storage_path.split("/").pop() ?? "bestand";
  return (
    <li className="space-y-2 rounded-lg bg-surface p-3 outline outline-1 outline-line">
      {url ? (
        asset.kind === "video" ? (
          <video src={url} controls preload="metadata" className="aspect-video w-full rounded bg-sunken object-contain" />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element -- tijdelijke link uit de privé bucket
          <img src={url} alt={asset.title ?? name} className="aspect-video w-full rounded bg-sunken object-contain" />
        )
      ) : (
        <div className="grid aspect-video place-items-center rounded bg-sunken text-sm text-muted">{signed.error ? "Niet te laden" : "Laden…"}</div>
      )}
      <p className="font-semibold">{asset.title ?? name}</p>
      <p className="text-sm text-muted">{[asset.template, asset.format, when(asset.created_at)].filter(Boolean).join(" · ")}</p>
      <div className="flex flex-wrap gap-2">
        {url && <a className={secondary} href={`${url}&download=${encodeURIComponent(name)}`}>Downloaden</a>}
        {onDeleted && (
          <button
            className={danger}
            onClick={async () => {
              if (!confirm("Dit bestand verwijderen?")) return;
              await db().storage.from("marketing").remove([asset.storage_path]);
              await db().from("marketing_assets").delete().eq("id", asset.id);
              onDeleted();
            }}
          >
            Verwijderen
          </button>
        )}
      </div>
    </li>
  );
}
