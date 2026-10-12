"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useSession } from "@/lib/auth";
import { useSharedLink, useTrip } from "@/lib/store";
import { errorMessage, supabase } from "@/lib/supabase-browser";
import { Icon } from "@/components/icons";

/** Samen een reis plannen: één gedeelde reis die bij iedereen tegelijk bijwerkt */
export function SharedCard() {
  const { session, loading } = useSession();
  const [link, setLink] = useSharedLink();
  const trip = useTrip();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [members, setMembers] = useState<string[] | null>(null);
  const userId = session?.user.id;

  useEffect(() => {
    if (!link || !userId) return;
    let alive = true;
    void supabase()
      .from("shared_trip_members")
      .select("user_id, display_name")
      .eq("trip_id", link.id)
      .is("left_at", null)
      .then(({ data }) => {
        if (alive && data) setMembers(data.filter((m) => m.user_id !== userId).map((m) => m.display_name || "Iemand zonder naam"));
      });
    return () => {
      alive = false;
    };
  }, [link, userId]);

  if (loading) return null;
  const inviteUrl = link && typeof window !== "undefined" ? `${location.origin}/samen/${link.code}` : "";

  async function start() {
    setBusy(true);
    setErr(null);
    const { data, error } = await supabase().rpc("create_shared_trip", { p_stops: trip.stops, p_name: "Onze reis" });
    setBusy(false);
    if (error) return setErr(errorMessage(error));
    setLink(data as { id: string; code: string; name: string });
  }

  async function stop() {
    if (!link) return;
    setBusy(true);
    await supabase().rpc("leave_shared_trip", { p_trip: link.id });
    setBusy(false);
    setLink(null);
    setMembers(null);
  }

  async function share() {
    if (navigator.share) await navigator.share({ title: "Plan onze camperreis mee", url: inviteUrl }).catch(() => undefined);
    else {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  }

  return (
    <section aria-labelledby="samen" className="rounded-2xl bg-surface p-5 shadow-low" data-testid="shared-card">
      <h2 id="samen" className="font-display text-xl font-semibold">Samen plannen</h2>
      {!session ? (
        <>
          <p className="mt-2 text-ink-2">Plan je reis samen met je partner of reisgenoten. Wat de een verandert, ziet de ander meteen.</p>
          <Link href="/inloggen?next=/mijn-reis" className="mt-3 inline-flex h-11 items-center rounded-xl border-2 border-line px-4 font-semibold hover:border-forest">
            Log in om samen te plannen
          </Link>
        </>
      ) : !link ? (
        <>
          <p className="mt-2 text-ink-2">Nodig iemand uit. Jullie zien allebei dezelfde reis, en wijzigingen komen direct bij de ander binnen.</p>
          <button type="button" onClick={start} disabled={busy} className="mt-3 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-forest font-semibold text-on-forest disabled:opacity-60">
            <Icon name="user" size={19} /> {busy ? "Even geduld…" : "Samen plannen"}
          </button>
        </>
      ) : (
        <>
          <p className="mt-2 text-ink-2">
            {members === null
              ? "Je plant deze reis samen."
              : members.length
                ? `Je plant deze reis samen met ${members.join(" en ")}.`
                : "Nog niemand heeft je uitnodiging geopend. Stuur de link naar je reisgenoot."}
          </p>
          <button type="button" onClick={share} className="mt-3 flex h-12 w-full items-center justify-center gap-2 rounded-xl border-2 border-line font-semibold hover:border-forest">
            <Icon name={copied ? "check" : "share"} size={19} /> {copied ? "Link gekopieerd" : "Uitnodiging sturen"}
          </button>
          <button type="button" onClick={stop} disabled={busy} className="mt-2 h-11 font-semibold text-ink-2 underline">
            Stoppen met samen plannen
          </button>
        </>
      )}
      {err && <p role="alert" className="mt-2 rounded-lg bg-alert-tint px-3 py-2 text-alert">{err}</p>}
    </section>
  );
}
