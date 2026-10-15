"use client";

import Link from "next/link";
import { useState } from "react";
import { errorMessage } from "@/lib/supabase-browser";
import { Badge, Card, Empty, ErrorNote, PageTitle, Segmented, db, danger, primary, secondary, useQuery, when } from "../ui";

type Review = {
  id: string;
  author_name: string;
  author_email: string | null;
  rating: number;
  title: string | null;
  body: string;
  vehicle: string | null;
  visited_month: string | null;
  status: "pending" | "approved" | "rejected";
  created_at: string;
  places: { name: string; slug: string } | null;
};

export default function Reviews() {
  const [status, setStatus] = useState<Review["status"]>("pending");
  const { data, error, loading, reload } = useQuery(
    () => db().from("reviews").select("*, places(name, slug)").eq("status", status).order("created_at", { ascending: false }).limit(100),
    [status],
  );
  // `status` is in de database tekst met een CHECK; hier als vaste keuze
  const rows = (data ?? []) as Review[];
  const [err, setErr] = useState<string | null>(null);

  async function set(id: string, next: Review["status"]) {
    const { error } = await db().from("reviews").update({ status: next }).eq("id", id);
    if (error) setErr(errorMessage(error));
    else reload();
  }
  async function remove(id: string) {
    if (!confirm("Deze review definitief verwijderen?")) return;
    const { error } = await db().from("reviews").delete().eq("id", id);
    if (error) setErr(errorMessage(error));
    else reload();
  }

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <PageTitle title="Reviews" />
      <p className="text-ink-2">Reviews verschijnen pas na goedkeuring. Keur alleen ervaringen goed die over de plek zelf gaan; persoonsgegevens en beledigingen weiger je.</p>
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
      {loading && rows.length === 0 ? (
        <p className="text-muted">Laden…</p>
      ) : rows.length === 0 ? (
        <Empty>Geen reviews in deze lijst.</Empty>
      ) : (
        rows.map((r) => (
          <Card key={r.id} className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="road">{r.rating}/10</Badge>
              {r.places && (
                <Link href={`/plek/${r.places.slug}`} target="_blank" className="font-semibold text-forest underline">{r.places.name}</Link>
              )}
              <span className="text-sm text-muted">{when(r.created_at)}</span>
            </div>
            {r.title && <p className="font-display font-semibold">{r.title}</p>}
            <p className="whitespace-pre-line">{r.body}</p>
            <p className="text-sm text-muted">
              {r.author_name}
              {r.author_email ? `, ${r.author_email}` : ""}
              {r.vehicle ? `, ${r.vehicle}` : ""}
            </p>
            <div className="flex flex-wrap gap-2 pt-1">
              {r.status !== "approved" && <button className={primary} onClick={() => set(r.id, "approved")}>Goedkeuren</button>}
              {r.status !== "rejected" && <button className={secondary} onClick={() => set(r.id, "rejected")}>Afwijzen</button>}
              <button className={danger} onClick={() => remove(r.id)}>Verwijderen</button>
            </div>
          </Card>
        ))
      )}
    </div>
  );
}
