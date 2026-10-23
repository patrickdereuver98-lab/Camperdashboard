"use client";

import Link from "next/link";
import { useState } from "react";
import { departureLong } from "@/lib/format";
import { departureFromSubmission, type DepartureChange } from "@/lib/submissions";
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
  places: { name: string; slug: string; departure: string | null; checkout_until: string | null } | null;
};

const KIND = { nieuw: "Nieuwe plek", correctie: "Correctie", eigenaar: "Eigenaar" } as const;

export default function Submissions() {
  const [status, setStatus] = useState<Submission["status"]>("nieuw");
  const { data, error, loading, reload } = useQuery(
    () => db().from("submissions").select("*, places(name, slug, departure, checkout_until)").eq("status", status).order("created_at", { ascending: false }).limit(100),
    [status],
  );
  // `kind` en `status` zijn in de database tekst met een CHECK; hier als vaste keuzes
  const rows = (data ?? []) as Submission[];

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
      {loading && rows.length === 0 ? <p className="text-muted">Laden…</p> : rows.length === 0 ? <Empty>Niets in deze lijst.</Empty> : rows.map((s) => <Item key={s.id} s={s} onChange={reload} />)}
    </div>
  );
}

type Change = { was: string | null; nieuw: string | null };

/** Eigenaarsformulier: per veld de oude en de nieuwe waarde */
function Changes({ changes }: { changes: Record<string, Change> }) {
  return Object.entries(changes).map(([k, c]) => (
    <div key={k} className="contents">
      <dt className="font-semibold text-muted">{k}</dt>
      <dd className="break-words whitespace-pre-line">
        {c.was !== null && <span className="text-muted line-through">{c.was}</span>}
        {c.was !== null && " "}
        {c.nieuw === null ? <em>leeggemaakt</em> : <strong>{c.nieuw}</strong>}
      </dd>
    </div>
  ));
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
          <Link href={`/plek/${s.places.slug}`} target="_blank" className="text-sm font-semibold text-forest underline">
            {s.places.name}
          </Link>
        )}
      </div>
      <dl className="grid grid-cols-[8rem_1fr] gap-x-3 gap-y-1 text-sm">
        {Object.entries(s.payload).filter(([, v]) => v !== null && v !== "").map(([k, v]) =>
          k === "wijzigingen" && v && typeof v === "object" ? (
            <Changes key={k} changes={v as Record<string, Change>} />
          ) : (
            <div key={k} className="contents">
              <dt className="font-semibold text-muted">{k}</dt>
              <dd className="break-words whitespace-pre-line">{typeof v === "object" ? JSON.stringify(v) : String(v)}</dd>
            </div>
          ),
        )}
      </dl>
      {(s.contact_name || s.contact_email) && (
        <p className="text-sm">
          Ingestuurd door {s.contact_name ?? "onbekend"}
          {s.contact_email && (
            <>
              {", "}
              <a className="font-semibold text-forest underline" href={`mailto:${s.contact_email}`}>{s.contact_email}</a>
            </>
          )}
        </p>
      )}
      {s.status === "nieuw" && s.place_id && s.places && <DepartureTakeover s={s} note={note} onDone={onChange} />}
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

const describe = (d: { departure: string | null; checkout_until: string | null }) =>
  departureLong({ departure: (d.departure ?? undefined) as DepartureChange["departure"] | undefined, checkoutUntil: d.checkout_until ?? undefined });

/**
 * Een vertrektijd van een bezoeker met één klik op de plek zetten. Het veld krijgt het merkteken van beheer, zodat de
 * scraper het niet terugdraait; de oude waarde komt in de notitie. Een nieuwe "geen vaste tijd" of "per 24 uur" staat
 * daarna bij Vertrektijden om te bevestigen, net als elke andere wijziging van de vertrekregel.
 */
function DepartureTakeover({ s, note, onDone }: { s: Submission; note: string; onDone: () => void }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const change = departureFromSubmission(s.payload);
  if (!change || !s.place_id || !s.places) return null;
  const place = s.places;
  const placeId = s.place_id;
  if ("reason" in change) {
    return (
      <p className="rounded-lg bg-sunken px-4 py-3 text-sm text-ink-2">
        Vertrektijd niet met één klik over te nemen: {change.reason.toLowerCase()}. Pas de plek zo nodig aan in Plekken.
      </p>
    );
  }
  const target: DepartureChange = change;
  const now = describe(place);
  const next = describe(target);
  const same = place.departure === target.departure && (target.departure !== "vast" || place.checkout_until === target.checkout_until);

  async function takeOver() {
    setBusy(true);
    setErr(null);
    const mark = await db().rpc("admin_mark_beheer", { p_place_id: placeId, p_fields: ["departure", "checkout_until"] });
    const upd = mark.error ? mark : await db().from("places").update(target).eq("id", placeId);
    const done = upd.error
      ? upd
      : await db()
          .from("submissions")
          .update({ status: "verwerkt", admin_note: [note.trim(), `Vertrektijd overgenomen (was: ${now}).`].filter(Boolean).join("\n") })
          .eq("id", s.id);
    setBusy(false);
    if (done.error) setErr(errorMessage(done.error));
    else onDone();
  }

  return (
    <div className="space-y-2 rounded-lg bg-sunken px-4 py-3">
      <p className="text-sm">
        <span className="text-muted">Nu op de site:</span> <strong>{now}</strong>
        <br />
        <span className="text-muted">Volgens deze inzending:</span> <strong>{next}</strong>
      </p>
      {same ? (
        <p className="text-sm text-muted">Dit staat al zo op de site.</p>
      ) : (
        <button className={primary} disabled={busy} onClick={takeOver}>
          {busy ? "Overnemen…" : "Vertrektijd overnemen"}
        </button>
      )}
      <ErrorNote message={err} />
    </div>
  );
}
