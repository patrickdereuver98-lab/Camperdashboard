"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { duplicateConfidence, pickKeep, type DupSide } from "@/lib/duplicates";
import { errorMessage } from "@/lib/supabase-browser";
import { PlaceMap } from "@/components/place-map";
import { Badge, Card, Empty, ErrorNote, PageTitle, Segmented, db, primary, secondary, useQuery } from "../ui";

type Row = {
  a_id: string; a_slug: string; a_name: string; a_status: string; a_lat: number; a_lng: number; a_osm: boolean; a_completeness: number;
  b_id: string; b_slug: string; b_name: string; b_status: string; b_lat: number; b_lng: number; b_osm: boolean; b_completeness: number;
  distance_m: number; name_similarity: number;
};
type Side = DupSide & { lat: number; lng: number };
type Pair = { key: string; a: Side; b: Side; distance: number; similarity: number; confidence: ReturnType<typeof duplicateConfidence> };

const side = (r: Row, s: "a" | "b"): Side => ({
  id: r[`${s}_id`], slug: r[`${s}_slug`], name: r[`${s}_name`], status: r[`${s}_status`],
  osm: r[`${s}_osm`], completeness: Number(r[`${s}_completeness`]), lat: r[`${s}_lat`], lng: r[`${s}_lng`],
});

const TONE = { hoog: "red", middel: "yellow", laag: "neutral" } as const;

export default function Duplicates() {
  const [meters, setMeters] = useState<"50" | "150" | "500">("150");
  const { data, error, reload } = useQuery(() => db().rpc("admin_duplicate_candidates", { p_meters: Number(meters), p_limit: 500 }), [meters]);
  const pairs = useMemo<Pair[]>(
    () =>
      ((data as Row[] | null) ?? []).map((r) => ({
        key: `${r.a_id}:${r.b_id}`,
        a: side(r, "a"),
        b: side(r, "b"),
        distance: r.distance_m,
        similarity: Number(r.name_similarity),
        confidence: duplicateConfidence(r.distance_m, Number(r.name_similarity)),
      })),
    [data],
  );
  // Per paar welke plek blijft (standaard volgens pickKeep, aan te passen met de radioknop)
  const [keepChoice, setKeepChoice] = useState<Record<string, string>>({});
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [focus, setFocus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const keepOf = (p: Pair) => {
    const chosen = keepChoice[p.key];
    if (chosen === p.a.id) return { keep: p.a, remove: p.b };
    if (chosen === p.b.id) return { keep: p.b, remove: p.a };
    return pickKeep(p.a, p.b);
  };

  const mapPlaces = useMemo(
    () =>
      pairs.flatMap((p) => [p.a, p.b]).map((s) => ({ slug: s.slug, name: s.name, lat: s.lat, lng: s.lng, town: s.status === "published" ? "online" : s.status })),
    [pairs],
  );

  async function merge(list: Pair[]) {
    setBusy(true);
    setErr(null);
    setDone(null);
    let ok = 0;
    for (const p of list) {
      const { keep, remove } = keepOf(p);
      const { error } = await db().rpc("admin_merge_places", { p_keep: keep.id, p_remove: remove.id });
      if (error) {
        setErr(`${keep.name} + ${remove.name}: ${errorMessage(error)}`);
        break;
      }
      ok++;
    }
    setBusy(false);
    setSelected(new Set());
    setDone(`${ok} ${ok === 1 ? "paar" : "paren"} samengevoegd.`);
    reload();
  }

  async function dismiss(list: Pair[]) {
    setBusy(true);
    setErr(null);
    const { error } = await db().from("duplicate_dismissals").insert(list.map((p) => ({ a: p.a.id, b: p.b.id })));
    setBusy(false);
    if (error) return setErr(errorMessage(error));
    setSelected(new Set());
    setDone(`${list.length} ${list.length === 1 ? "paar" : "paren"} gemarkeerd als geen dubbel.`);
    reload();
  }

  const chosen = pairs.filter((p) => selected.has(p.key));
  const toggle = (key: string) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(key)) n.delete(key);
      else n.add(key);
      return n;
    });

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <PageTitle title="Dubbele plekken" />
      <p className="text-ink-2">
        Plekken die vlak bij elkaar liggen, bijvoorbeeld uit OpenStreetMap én een inzending. Bij samenvoegen vult de plek die
        blijft zijn lege velden aan met die van de ander; reviews en foto&apos;s verhuizen mee en de oude link stuurt door.
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <Segmented
          label="Afstand"
          value={meters}
          onChange={setMeters}
          options={[
            { value: "50", label: "≤ 50 m" },
            { value: "150", label: "≤ 150 m" },
            { value: "500", label: "≤ 500 m" },
          ]}
        />
        <button className={secondary} onClick={() => setSelected(new Set(pairs.filter((p) => p.confidence === "hoog").map((p) => p.key)))}>
          Selecteer alle &quot;hoog&quot;
        </button>
        <button className={primary} disabled={!chosen.length || busy} onClick={() => merge(chosen)}>
          {chosen.length} samenvoegen
        </button>
        <button className={secondary} disabled={!chosen.length || busy} onClick={() => dismiss(chosen)}>
          Geen dubbel
        </button>
      </div>
      <ErrorNote message={error ? errorMessage(error) : err} />
      {done && <p role="status" className="rounded-lg bg-forest-tint px-3 py-2 font-semibold text-forest">{done}</p>}

      {pairs.length === 0 ? (
        <Empty>Geen mogelijke dubbelen binnen deze afstand.</Empty>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[1fr_1.1fr]">
          <div className="h-[420px] overflow-hidden rounded-2xl lg:sticky lg:top-4 lg:h-[calc(100vh-8rem)]">
            <PlaceMap
              places={mapPlaces}
              highlight={focus}
              cluster={false}
              fitKey={meters + ":" + pairs.length}
              onSelect={(slug) => {
                const p = pairs.find((x) => x.a.slug === slug || x.b.slug === slug);
                if (p) document.getElementById(`paar-${p.key}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
                setFocus(slug);
              }}
              className="h-full w-full"
            />
          </div>
          <ul className="space-y-3">
            {pairs.map((p) => {
              const { keep } = keepOf(p);
              return (
                <li key={p.key} id={`paar-${p.key}`}>
                  <Card className={`space-y-3 ${selected.has(p.key) ? "outline-2 outline-forest" : ""}`}>
                    <div className="flex flex-wrap items-center gap-2">
                      <label className="flex items-center gap-2 font-semibold">
                        <input type="checkbox" className="h-5 w-5 accent-forest" checked={selected.has(p.key)} onChange={() => toggle(p.key)} />
                        Selecteren
                      </label>
                      <Badge tone={TONE[p.confidence]}>zekerheid {p.confidence}</Badge>
                      <Badge>{p.distance} m</Badge>
                      <Badge>naam {Math.round(p.similarity * 100)}%</Badge>
                    </div>
                    {[p.a, p.b].map((s) => (
                      <label
                        key={s.id}
                        className="flex cursor-pointer items-start gap-3 rounded-xl p-2 hover:bg-sunken"
                        onMouseEnter={() => setFocus(s.slug)}
                      >
                        <input
                          type="radio"
                          name={`keep-${p.key}`}
                          className="mt-1 h-5 w-5 accent-forest"
                          checked={keep.id === s.id}
                          onChange={() => setKeepChoice((c) => ({ ...c, [p.key]: s.id }))}
                        />
                        <span className="min-w-0 flex-1">
                          <span className="flex flex-wrap items-center gap-2">
                            <span className="font-semibold">{s.name}</span>
                            {keep.id === s.id ? <Badge tone="green">blijft</Badge> : <Badge tone="red">gaat op in de ander</Badge>}
                          </span>
                          <span className="block text-sm text-muted">
                            {s.status === "published" ? "Online" : "Concept"}, uit {s.osm ? "OpenStreetMap" : "een inzending"}, {Math.round(s.completeness * 100)}% compleet.{" "}
                            <Link href={`/plek/${s.slug}`} target="_blank" className="underline">bekijken</Link>
                          </span>
                        </span>
                      </label>
                    ))}
                    <div className="flex flex-wrap gap-2">
                      <button className={primary} disabled={busy} onClick={() => merge([p])}>Samenvoegen</button>
                      <button className={secondary} disabled={busy} onClick={() => dismiss([p])}>Geen dubbel</button>
                    </div>
                  </Card>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
