"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { use, useState } from "react";
import { useSession } from "@/lib/auth";
import { useSharedLink, useTrip } from "@/lib/store";
import { errorMessage, supabase } from "@/lib/supabase-browser";
import { mergeTrips } from "@/lib/trip-merge";

export function JoinTrip({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params);
  const { session, loading } = useSession();
  const trip = useTrip();
  const [, setLink] = useSharedLink();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const valid = /^[0-9a-f]{18}$/.test(code);

  if (!valid) return <p role="alert" className="mt-3 text-alert">Deze uitnodiging klopt niet. Vraag om een nieuwe link.</p>;
  if (loading) return <p className="mt-3 text-muted">Laden…</p>;
  if (!session)
    return (
      <>
        <p className="mt-3 text-lg text-ink-2">Je bent uitgenodigd om samen een camperreis te plannen. Log eerst in, dan doe je meteen mee.</p>
        <Link href={`/inloggen?next=${encodeURIComponent(`/samen/${code}`)}`} className="mt-6 inline-flex h-12 items-center rounded-xl bg-forest px-5 font-semibold text-on-forest">
          Inloggen en meedoen
        </Link>
      </>
    );

  async function join() {
    setBusy(true);
    setErr(null);
    const { data, error } = await supabase().rpc("join_shared_trip", { p_code: code });
    setBusy(false);
    if (error) return setErr(errorMessage(error));
    const d = data as { id: string; name: string; stops: unknown };
    trip.replace(mergeTrips([], d.stops));
    setLink({ id: d.id, name: d.name, code });
    router.replace("/mijn-reis");
  }

  return (
    <>
      <p className="mt-3 text-lg text-ink-2">Je bent uitgenodigd om samen een camperreis te plannen. Wijzigingen zien jullie allebei meteen.</p>
      {trip.stops.length > 0 && (
        <p className="mt-3 rounded-xl bg-sunken px-4 py-3 text-ink-2">
          Je eigen reis op dit toestel ({trip.stops.length} {trip.stops.length === 1 ? "plek" : "plekken"}) wordt vervangen door de gedeelde reis.
        </p>
      )}
      <button type="button" onClick={join} disabled={busy} className="mt-6 h-14 w-full rounded-xl bg-forest font-display text-lg font-semibold text-on-forest disabled:opacity-60">
        {busy ? "Even geduld…" : "Meedoen"}
      </button>
      {err && <p role="alert" className="mt-3 rounded-lg bg-alert-tint px-3 py-2 text-alert">{err}</p>}
    </>
  );
}
