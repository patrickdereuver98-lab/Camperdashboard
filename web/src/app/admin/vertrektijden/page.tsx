"use client";

import Link from "next/link";
import { useState } from "react";
import { Icon } from "@/components/icons";
import { errorMessage } from "@/lib/supabase-browser";
import { KIND_LABEL } from "@/lib/types";
import { Badge, Card, Empty, ErrorNote, PageTitle, Segmented, db, danger, primary, secondary, useQuery, when } from "../ui";

type Check = "bevestigd" | "voorwaardelijk" | "afgewezen";
type Tab = "open" | Check;

type Row = {
  id: string;
  slug: string;
  name: string;
  town: string | null;
  kind: string;
  status: "draft" | "published" | "hidden";
  departure: "vrij" | "per24";
  times_note: string | null;
  website: string | null;
  phone: string | null;
  email: string | null;
  departure_check: Check | null;
  departure_checked_at: string | null;
  departure_checked_by: "beheer" | "eigenaar" | null;
};

const COLUMNS =
  "id,slug,name,town,kind,status,departure,times_note,website,phone,email,departure_check,departure_checked_at,departure_checked_by";

/**
 * De controlelijst voor de kernbelofte. Een plek staat pas op Zonder vertrektijd als hier iemand de bron heeft
 * gecontroleerd of de eigenaar het heeft bevestigd. Twijfel je, kies dan "Met voorwaarde" of "Klopt niet".
 */
export default function Departures() {
  const [tab, setTab] = useState<Tab>("open");
  const { data, error, reload } = useQuery(() => {
    const q = db().from("places").select(COLUMNS).in("departure", ["vrij", "per24"]).neq("status", "hidden");
    return (tab === "open" ? q.is("departure_check", null) : q.eq("departure_check", tab)).order("name").limit(500);
  }, [tab]);
  const rows = (data as Row[] | null) ?? [];
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  async function set(id: string, check: Check | null, by: "beheer" | "eigenaar" = "beheer") {
    setBusy(id);
    const { error } = await db().rpc("check_departure", { p_id: id, p_check: check, p_by: by });
    setBusy(null);
    if (error) setErr(errorMessage(error));
    else reload();
  }

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <PageTitle title="Vertrektijden controleren" />
      <div className="space-y-2 text-ink-2">
        <p>
          Hier staan plekken waarvan de website zegt dat er geen vaste vertrektijd is. Ze komen pas op de pagina Zonder
          vertrektijd als jij het hebt bevestigd.
        </p>
        <p>
          Open de bron en lees de hele pagina. Staat er ergens toch een tijd, ook bij drukte of alleen in het seizoen? Kies
          dan Met voorwaarde. Bel of mail bij twijfel de eigenaar. Een bevestiging geldt een jaar, en vervalt als de website
          iets anders gaat zeggen.
        </p>
      </div>
      <Segmented
        label="Lijst"
        value={tab}
        onChange={setTab}
        options={[
          { value: "open", label: "Te controleren" },
          { value: "bevestigd", label: "Bevestigd" },
          { value: "voorwaardelijk", label: "Met voorwaarde" },
          { value: "afgewezen", label: "Klopt niet" },
        ]}
      />
      <ErrorNote message={error ?? err} />
      {rows.length === 0 ? (
        <Empty>{tab === "open" ? "Niets te controleren. Alle kandidaten zijn bekeken." : "Geen plekken in deze lijst."}</Empty>
      ) : (
        <>
          <p className="text-sm text-muted">{rows.length === 1 ? "1 plek" : `${rows.length} plekken`}</p>
          {rows.map((r) => (
            <Card key={r.id} className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <Link href={`/plek/${r.slug}`} target="_blank" className="font-semibold text-forest underline">
                  {r.name}
                </Link>
                <span className="text-sm text-muted">
                  {[KIND_LABEL[r.kind as keyof typeof KIND_LABEL] ?? r.kind, r.town].filter(Boolean).join(", ")}
                </span>
                <Badge tone={r.departure === "per24" ? "road" : "green"}>{r.departure === "per24" ? "Per 24 uur" : "Geen vaste tijd"}</Badge>
                {r.status === "draft" && <Badge>Concept</Badge>}
              </div>
              {r.times_note ? (
                <blockquote className="rounded-xl bg-sunken px-4 py-3 whitespace-pre-line text-ink-2">
                  {r.times_note.split(" · ").join("\n")}
                </blockquote>
              ) : (
                <p className="text-sm text-muted">Geen bronzin bewaard. Controleer bij de eigenaar.</p>
              )}
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
                {r.website && (
                  <a href={r.website} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-semibold text-forest underline">
                    <Icon name="external" size={16} /> Bron openen
                  </a>
                )}
                {r.phone && <a href={`tel:${r.phone}`} className="font-semibold text-forest underline">{r.phone}</a>}
                {r.email && <a href={`mailto:${r.email}`} className="font-semibold text-forest underline">{r.email}</a>}
              </div>
              {r.departure_checked_at && (
                <p className="text-sm text-muted">
                  {r.departure_checked_by === "eigenaar" ? "Bevestigd door de eigenaar" : "Gecontroleerd door beheer"} op {when(r.departure_checked_at)}
                </p>
              )}
              <div className="flex flex-wrap gap-2">
                {tab !== "bevestigd" && (
                  <>
                    <button className={primary} disabled={busy === r.id} onClick={() => set(r.id, "bevestigd")}>
                      Bevestigd, bron klopt
                    </button>
                    <button className={secondary} disabled={busy === r.id} onClick={() => set(r.id, "bevestigd", "eigenaar")}>
                      Eigenaar bevestigde het
                    </button>
                  </>
                )}
                {tab !== "voorwaardelijk" && (
                  <button className={secondary} disabled={busy === r.id} onClick={() => set(r.id, "voorwaardelijk")}>
                    Met voorwaarde
                  </button>
                )}
                {tab !== "afgewezen" && (
                  <button className={danger} disabled={busy === r.id} onClick={() => set(r.id, "afgewezen")}>
                    Klopt niet
                  </button>
                )}
                {tab !== "open" && (
                  <button className={secondary} disabled={busy === r.id} onClick={() => set(r.id, null)}>
                    Opnieuw controleren
                  </button>
                )}
              </div>
            </Card>
          ))}
        </>
      )}
    </div>
  );
}
