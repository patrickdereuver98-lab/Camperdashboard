"use client";

import Link from "next/link";
import { useState } from "react";
import { errorMessage } from "@/lib/supabase-browser";
import { Badge, Card, Empty, ErrorNote, PageTitle, Segmented, db, primary, secondary, textarea, useQuery, when } from "../ui";

type Submission = {
  id: string;
  kind: "nieuw" | "correctie" | "eigenaar";
  place_id: string | null;
  payload: Record<string, unknown>;
  contact_name: string | null;
  contact_email: string | null;
  status: "nieuw" | "verwerkt" | "afgewezen";
  admin_note: string | null;
  created_at: string;
  places: { name: string; slug: string } | null;
};

const KIND = { nieuw: "Nieuwe plek", correctie: "Correctie", eigenaar: "Eigenaar" } as const;

export default function Submissions() {
  const [status, setStatus] = useState<Submission["status"]>("nieuw");
  const { data, error, reload } = useQuery(
    () => db().from("submissions").select("*, places(name, slug)").eq("status", status).order("created_at", { ascending: false }).limit(100),
    [status],
  );
  const rows = (data as Submission[] | null) ?? [];

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <PageTitle title="Inzendingen" />
      <p className="text-ink-2">
        Nieuwe plekken, correcties en eigenaarsclaims van bezoekers. Controleer elke inzending tegen een betrouwbare bron (website van de plek, eigen bezoek) voordat je iets aanpast in Plekken.
      </p>
      <Segmented
        label="Status"
        value={status}
        onChange={setStatus}
        options={[
          { value: "nieuw", label: "Te behandelen" },
          { value: "verwerkt", label: "Verwerkt" },
          { value: "afgewezen", label: "Afgewezen" },
        ]}
      />
      <ErrorNote message={error} />
      {rows.length === 0 ? <Empty>Niets in deze lijst.</Empty> : rows.map((s) => <Item key={s.id} s={s} onChange={reload} />)}
    </div>
  );
}

function Item({ s, onChange }: { s: Submission; onChange: () => void }) {
  const [note, setNote] = useState(s.admin_note ?? "");
  const [err, setErr] = useState<string | null>(null);
  async function set(status: Submission["status"]) {
    const { error } = await db().from("submissions").update({ status, admin_note: note || null }).eq("id", s.id);
    if (error) setErr(errorMessage(error));
    else onChange();
  }
  return (
    <Card className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={s.kind === "nieuw" ? "green" : s.kind === "eigenaar" ? "yellow" : "road"}>{KIND[s.kind]}</Badge>
        <span className="text-sm text-muted">{when(s.created_at)}</span>
        {s.places && (
          <Link href={`/plek/${s.places.slug}`} target="_blank" className="text-sm font-semibold text-road underline">
            {s.places.name}
          </Link>
        )}
      </div>
      <dl className="grid grid-cols-[8rem_1fr] gap-x-3 gap-y-1 text-sm">
        {Object.entries(s.payload).filter(([, v]) => v !== null && v !== "").map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="font-semibold text-muted">{k}</dt>
            <dd className="break-words whitespace-pre-line">{typeof v === "object" ? JSON.stringify(v) : String(v)}</dd>
          </div>
        ))}
      </dl>
      {(s.contact_name || s.contact_email) && (
        <p className="text-sm">
          Ingestuurd door {s.contact_name ?? "onbekend"}
          {s.contact_email && (
            <>
              {", "}
              <a className="font-semibold text-road underline" href={`mailto:${s.contact_email}`}>{s.contact_email}</a>
            </>
          )}
        </p>
      )}
      <label className="block">
        <span className="mb-1 block text-sm font-semibold">Notitie</span>
        <textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} className={textarea} />
      </label>
      <ErrorNote message={err} />
      <div className="flex flex-wrap gap-2">
        {s.status !== "verwerkt" && <button className={primary} onClick={() => set("verwerkt")}>Markeer als verwerkt</button>}
        {s.status !== "afgewezen" && <button className={secondary} onClick={() => set("afgewezen")}>Afwijzen</button>}
        {s.status !== "nieuw" && <button className={secondary} onClick={() => set("nieuw")}>Terugzetten</button>}
      </div>
    </Card>
  );
}
