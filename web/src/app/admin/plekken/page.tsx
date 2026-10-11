"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/components/icons";
import { Sheet } from "@/components/sheet";
import { KIND_LABEL, PROVINCES } from "@/lib/types";
import { errorMessage } from "@/lib/supabase-browser";
import { Badge, Empty, ErrorNote, PageTitle, Segmented, db, input, primary, secondary, textarea, useQuery, when } from "../ui";

type Row = {
  id: string;
  slug: string;
  name: string;
  town: string | null;
  province: string | null;
  kind: string;
  completeness: number;
  status: "draft" | "published" | "hidden";
  status_locked: boolean;
  website: string | null;
  updated_at: string;
};

type Full = Row & Record<string, unknown>;

const PAGE = 40;
const STATUS_LABEL = { published: "Online", draft: "Concept", hidden: "Verborgen" } as const;
const BOOLS = [
  ["power", "Stroom"],
  ["water", "Drinkwater"],
  ["dump_station", "Afvalwater lozen"],
  ["toilet", "Toilet"],
  ["shower", "Douche"],
  ["wifi", "Wifi"],
  ["dogs", "Honden toegestaan"],
  ["open_all_year", "Hele jaar open"],
  ["reservation", "Reserveren mogelijk"],
  ["tourist_tax_included", "Toeristenbelasting inbegrepen"],
] as const;

export default function PlacesAdmin() {
  const [q, setQ] = useState("");
  const [term, setTerm] = useState("");
  const [status, setStatus] = useState<"alle" | Row["status"]>("alle");
  const [province, setProvince] = useState("");
  const [page, setPage] = useState(0);
  const [editing, setEditing] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => {
      setTerm(q.trim());
      setPage(0);
    }, 300);
    return () => clearTimeout(t);
  }, [q]);

  const { data, error, loading, reload } = useQuery(() => {
    let query = db()
      .from("places")
      .select("id,slug,name,town,province,kind,completeness,status,status_locked,website,updated_at", { count: "exact" })
      .order("completeness", { ascending: false })
      .order("name")
      .range(page * PAGE, page * PAGE + PAGE - 1);
    if (term) query = query.or(`name.ilike.%${term.replace(/[%,()]/g, " ")}%,town.ilike.%${term.replace(/[%,()]/g, " ")}%`);
    if (status !== "alle") query = query.eq("status", status);
    if (province) query = query.eq("province", province);
    return query.then((r) => ({ data: { rows: r.data as Row[] | null, count: r.count ?? 0 }, error: r.error }));
  }, [term, status, province, page]);

  const rows = data?.rows ?? [];
  const count = data?.count ?? 0;

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <PageTitle title="Plekken" />
      <div className="grid gap-3 sm:grid-cols-[1fr_14rem]">
        <label className="flex h-12 items-center gap-2 rounded-xl border-2 border-line bg-surface px-3 focus-within:border-road">
          <Icon name="search" size={20} className="text-muted" />
          <span className="sr-only">Zoek op naam of plaats</span>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Zoek op naam of plaats" className="h-full flex-1 bg-transparent focus:outline-none" />
        </label>
        <select value={province} onChange={(e) => (setProvince(e.target.value), setPage(0))} className={input} aria-label="Provincie">
          <option value="">Alle provincies</option>
          {PROVINCES.map((p) => <option key={p}>{p}</option>)}
        </select>
      </div>
      <Segmented
        label="Status"
        value={status}
        onChange={(v) => (setStatus(v), setPage(0))}
        options={[
          { value: "alle", label: "Alle" },
          { value: "published", label: "Online" },
          { value: "draft", label: "Concept" },
          { value: "hidden", label: "Verborgen" },
        ]}
      />
      <ErrorNote message={error} />
      <p className="text-sm text-muted">{loading ? "Laden…" : `${count.toLocaleString("nl-NL")} plekken`}</p>
      {!loading && rows.length === 0 ? (
        <Empty>Geen plekken gevonden.</Empty>
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-2xl bg-surface outline-1 outline-line outline">
          {rows.map((r) => (
            <li key={r.id}>
              <button onClick={() => setEditing(r.id)} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-sunken">
                <Meter value={r.completeness} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{r.name}</span>
                  <span className="block truncate text-sm text-muted">
                    {KIND_LABEL[r.kind as keyof typeof KIND_LABEL] ?? r.kind}, {r.town ?? "plaats onbekend"}
                    {r.province ? ` (${r.province})` : ""}
                  </span>
                </span>
                <span className="flex shrink-0 flex-col items-end gap-1">
                  <Badge tone={r.status === "published" ? "green" : r.status === "hidden" ? "red" : "neutral"}>{STATUS_LABEL[r.status]}</Badge>
                  {r.status_locked && <span className="text-xs text-muted">handmatig vast</span>}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex items-center justify-between">
        <button className={secondary} disabled={page === 0} onClick={() => setPage((p) => p - 1)}>Vorige</button>
        <span className="text-sm text-muted">Pagina {page + 1} van {Math.max(1, Math.ceil(count / PAGE))}</span>
        <button className={secondary} disabled={(page + 1) * PAGE >= count} onClick={() => setPage((p) => p + 1)}>Volgende</button>
      </div>
      {editing && <Editor id={editing} onClose={() => setEditing(null)} onSaved={reload} />}
    </div>
  );
}

function Meter({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  const color = value >= 0.8 ? "text-polder" : value >= 0.7 ? "text-road" : "text-muted";
  return (
    <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-full bg-sunken font-sign text-sm font-bold tabular-nums ${color}`} title={`${pct}% compleet`}>
      {pct}
    </span>
  );
}

function Editor({ id, onClose, onSaved }: { id: string; onClose: () => void; onSaved: () => void }) {
  const [place, setPlace] = useState<Full | null>(null);
  const [draft, setDraft] = useState<Record<string, unknown>>({});
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    db().from("places").select("*").eq("id", id).single().then(({ data, error }) => {
      if (error) setErr(errorMessage(error));
      else setPlace(data as Full);
    });
  }, [id]);

  const v = (k: string) => (k in draft ? draft[k] : place?.[k]);
  const set = (k: string, value: unknown) => setDraft((d) => ({ ...d, [k]: value }));
  const text = (k: string) => (v(k) as string | number | null) ?? "";
  const num = (s: string) => (s.trim() === "" ? null : Number(s.replace(",", ".")));

  async function save() {
    if (!Object.keys(draft).length) return onClose();
    setBusy(true);
    setErr(null);
    // Handmatig ingevulde velden markeren: de pipeline overschrijft ze dan nooit
    const sources = { ...((place?.sources as Record<string, unknown>) ?? {}) };
    const data = Object.keys(draft).filter((k) => !["status", "status_locked"].includes(k));
    sources.beheer = [...new Set([...((sources.beheer as string[] | undefined) ?? []), ...data])];
    const { error } = await db().from("places").update({ ...draft, sources }).eq("id", id);
    setBusy(false);
    if (error) return setErr(errorMessage(error));
    onSaved();
    onClose();
  }

  return (
    <Sheet
      open
      onClose={onClose}
      title={place?.name ?? "Plek"}
      footer={
        <div className="flex gap-2">
          <button className={`${secondary} flex-1`} onClick={onClose}>Annuleren</button>
          <button className={`${primary} flex-1`} onClick={save} disabled={busy || !place}>{busy ? "Opslaan…" : "Opslaan"}</button>
        </div>
      }
    >
      {!place ? (
        <ErrorNote message={err} />
      ) : (
        <div className="space-y-5 pb-4">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <Badge tone="road">{Math.round(place.completeness * 100)}% compleet</Badge>
            <span className="text-muted">bijgewerkt {when(place.updated_at)}</span>
            <a href={`/plek/${place.slug}`} target="_blank" rel="noreferrer" className="font-semibold text-road underline">Bekijk op de site</a>
          </div>

          <fieldset className="space-y-3 rounded-2xl bg-sunken p-4">
            <legend className="sr-only">Publicatie</legend>
            <label className="flex items-center justify-between gap-3">
              <span className="font-semibold">Status</span>
              <select className={`${input} w-44`} value={String(v("status"))} onChange={(e) => (set("status", e.target.value), set("status_locked", true))}>
                <option value="published">Online</option>
                <option value="draft">Concept</option>
                <option value="hidden">Verborgen</option>
              </select>
            </label>
            <label className="flex items-start gap-3">
              <input type="checkbox" className="mt-1 h-5 w-5 accent-[var(--road)]" checked={Boolean(v("status_locked"))} onChange={(e) => set("status_locked", e.target.checked)} />
              <span>
                <span className="font-semibold">Status handmatig vastzetten</span>
                <span className="block text-sm text-muted">Uit: de plek gaat automatisch online zodra de data compleet genoeg is.</span>
              </span>
            </label>
          </fieldset>

          <Field label="Naam"><input className={input} value={text("name")} onChange={(e) => set("name", e.target.value)} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Soort">
              <select className={input} value={String(v("kind"))} onChange={(e) => set("kind", e.target.value)}>
                {Object.entries(KIND_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
              </select>
            </Field>
            <Field label="Plaats"><input className={input} value={text("town")} onChange={(e) => set("town", e.target.value || null)} /></Field>
          </div>
          <Field label="Beschrijving">
            <textarea className={textarea} rows={4} value={text("description")} onChange={(e) => set("description", e.target.value || null)} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Prijs per nacht (€)"><input inputMode="decimal" className={input} value={text("price_eur")} onChange={(e) => set("price_eur", num(e.target.value))} /></Field>
            <Field label="Aantal plekken"><input inputMode="numeric" className={input} value={text("capacity")} onChange={(e) => set("capacity", num(e.target.value))} /></Field>
            <Field label="Max. lengte (m)"><input inputMode="decimal" className={input} value={text("max_length_m")} onChange={(e) => set("max_length_m", num(e.target.value))} /></Field>
            <Field label="Max. nachten"><input inputMode="numeric" className={input} value={text("max_stay_nights")} onChange={(e) => set("max_stay_nights", num(e.target.value))} /></Field>
          </div>
          <Field label="Toelichting prijs"><input className={input} value={text("price_note")} onChange={(e) => set("price_note", e.target.value || null)} /></Field>
          <Field label="Seizoen"><input className={input} placeholder="bijv. 1 april t/m 31 oktober" value={text("season")} onChange={(e) => set("season", e.target.value || null)} /></Field>
          <Field label="Ondergrond">
            <select className={input} value={String(v("surface") ?? "")} onChange={(e) => set("surface", e.target.value || null)}>
              <option value="">Onbekend</option>
              <option value="verhard">Verhard</option>
              <option value="grind">Grind</option>
              <option value="gras">Gras</option>
              <option value="gemengd">Gemengd</option>
            </select>
          </Field>

          <div>
            <p className="mb-2 font-semibold">Voorzieningen</p>
            <p className="mb-3 text-sm text-muted">Vul alleen in wat zeker is. Onbekend telt niet mee en wordt niet getoond.</p>
            <ul className="divide-y divide-line rounded-2xl bg-surface outline-1 outline-line outline">
              {BOOLS.map(([k, label]) => (
                <li key={k} className="flex items-center justify-between gap-3 px-3 py-2">
                  <span>{label}</span>
                  <TriState value={v(k) as boolean | null} onChange={(x) => set(k, x)} />
                </li>
              ))}
            </ul>
          </div>

          <Field label="Website"><input type="url" className={input} value={text("website")} onChange={(e) => set("website", e.target.value || null)} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Telefoon"><input type="tel" className={input} value={text("phone")} onChange={(e) => set("phone", e.target.value || null)} /></Field>
            <Field label="E-mail"><input type="email" className={input} value={text("email")} onChange={(e) => set("email", e.target.value || null)} /></Field>
          </div>
          <Field label="Hoofdfoto (URL)"><input type="url" className={input} value={text("image_url")} onChange={(e) => set("image_url", e.target.value || null)} /></Field>

          <details className="rounded-2xl bg-sunken p-4 text-sm">
            <summary className="cursor-pointer font-semibold">Bronnen per veld</summary>
            <pre className="mt-3 overflow-x-auto whitespace-pre-wrap text-xs">{JSON.stringify(place.sources, null, 2)}</pre>
          </details>
          <ErrorNote message={err} />
        </div>
      )}
    </Sheet>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-semibold">{label}</span>
      {children}
    </label>
  );
}

function TriState({ value, onChange }: { value: boolean | null; onChange: (v: boolean | null) => void }) {
  const opts: [boolean | null, string][] = [[true, "Ja"], [false, "Nee"], [null, "?"]];
  return (
    <span className="flex overflow-hidden rounded-lg border-2 border-line">
      {opts.map(([o, l]) => (
        <button
          key={l}
          type="button"
          aria-pressed={value === o}
          onClick={() => onChange(o)}
          className="h-9 w-11 text-sm font-semibold aria-pressed:bg-road aria-pressed:text-on-road"
        >
          {l}
        </button>
      ))}
    </span>
  );
}
