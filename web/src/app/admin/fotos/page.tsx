"use client";

import Link from "next/link";
import { useState } from "react";
import { SUPABASE_URL } from "@/lib/env";
import { errorMessage } from "@/lib/supabase-browser";
import { Card, Empty, ErrorNote, PageTitle, Segmented, db, primary, secondary, useQuery, when } from "../ui";

type Photo = {
  id: string;
  storage_path: string;
  width: number | null;
  height: number | null;
  caption: string | null;
  credit: string | null;
  status: "pending" | "approved" | "rejected";
  created_at: string;
  places: { name: string; slug: string } | null;
};

const photoUrl = (path: string) => `${SUPABASE_URL}/storage/v1/object/public/place-photos/${path}`;

export default function Photos() {
  const [status, setStatus] = useState<Photo["status"]>("pending");
  const { data, error, reload } = useQuery(
    () =>
      db()
        .from("place_photos")
        .select("id, storage_path, width, height, caption, credit, status, created_at, places(name, slug)")
        .eq("status", status)
        .order("created_at", { ascending: status === "pending" })
        .limit(60),
    [status],
  );
  const rows = (data as Photo[] | null) ?? [];
  const [err, setErr] = useState<string | null>(null);

  async function set(id: string, next: Photo["status"]) {
    const { error } = await db().from("place_photos").update({ status: next }).eq("id", id);
    if (error) setErr(errorMessage(error));
    else reload();
  }

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <PageTitle title="Foto's" />
      <p className="text-ink-2">
        Foto&apos;s van bezoekers verschijnen pas na goedkeuring. Weiger foto&apos;s met herkenbare mensen of kentekens, foto&apos;s
        die niet bij de plek horen en reclame.
      </p>
      <Segmented
        label="Status"
        value={status}
        onChange={setStatus}
        options={[
          { value: "pending", label: "Te keuren" },
          { value: "approved", label: "Goedgekeurd" },
          { value: "rejected", label: "Afgewezen" },
        ]}
      />
      <ErrorNote message={error ?? err} />
      {rows.length === 0 ? (
        <Empty>Geen foto&apos;s in deze lijst.</Empty>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((p) => (
            <Card key={p.id} className="space-y-2">
              <a href={photoUrl(p.storage_path)} target="_blank" rel="noreferrer">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={photoUrl(p.storage_path)} alt={p.caption ?? ""} loading="lazy" className="aspect-[4/3] w-full rounded-xl bg-sunken object-cover" />
              </a>
              {p.places && (
                <Link href={`/plek/${p.places.slug}`} target="_blank" className="block font-semibold text-forest underline">{p.places.name}</Link>
              )}
              {p.caption && <p>{p.caption}</p>}
              <p className="text-sm text-muted">
                {p.credit ?? "Geen naam"} · {when(p.created_at)}
                {p.width && p.height ? ` · ${p.width}×${p.height}` : ""}
              </p>
              <div className="flex flex-wrap gap-2 pt-1">
                {p.status !== "approved" && <button className={primary} onClick={() => set(p.id, "approved")}>Goedkeuren</button>}
                {p.status !== "rejected" && <button className={secondary} onClick={() => set(p.id, "rejected")}>Afwijzen</button>}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
