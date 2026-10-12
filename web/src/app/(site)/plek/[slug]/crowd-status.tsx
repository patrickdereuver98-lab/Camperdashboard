"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useSession } from "@/lib/auth";
import { CROWD_LABEL, crowdSummary, type CrowdLevel, type CrowdStatus } from "@/lib/crowd";
import { errorMessage, supabase } from "@/lib/supabase-browser";

const LEVELS: CrowdLevel[] = ["rustig", "druk", "vol"];
const DOT: Record<CrowdLevel, string> = { rustig: "bg-forest", druk: "bg-ember", vol: "bg-alert" };

/** Live drukte: wat camperaars de laatste 3 uur meldden. Wordt in de browser opgehaald, dus nooit uit een oude cache. */
export function CrowdStatusCard({ placeId, slug }: { placeId: string; slug: string }) {
  const { session } = useSession();
  const [status, setStatus] = useState<CrowdStatus | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState<CrowdLevel | null>(null);
  const [mine, setMine] = useState<CrowdLevel | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    void supabase()
      .rpc("crowd_status", { p_place_id: placeId })
      .then(({ data }) => {
        if (!alive) return;
        setStatus((data as CrowdStatus) ?? null);
        setLoaded(true);
      });
    return () => {
      alive = false;
    };
  }, [placeId]);

  async function report(level: CrowdLevel) {
    setBusy(level);
    setErr(null);
    const { data, error } = await supabase().rpc("report_crowd", { p_place_id: placeId, p_level: level });
    setBusy(null);
    if (error) return setErr(errorMessage(error));
    setStatus(data as CrowdStatus);
    setMine(level);
  }

  // Pas na het laden (in de browser) uitrekenen: "x minuten geleden" hangt af van de klok
  const summary = loaded ? crowdSummary(status) : null;

  return (
    <section aria-labelledby="drukte" className="mt-3 rounded-2xl bg-surface p-4 shadow-low" data-testid="crowd">
      <h2 id="drukte" className="font-semibold">Hoe druk is het nu?</h2>
      <div className="mt-2 flex min-h-12 items-center gap-3" aria-live="polite">
        {summary ? (
          <>
            <span className={`h-3.5 w-3.5 shrink-0 rounded-full ${summary.level ? DOT[summary.level] : "bg-line"}`} aria-hidden="true" />
            <div>
              <p className={`font-display text-lg leading-tight font-semibold ${summary.level ? "" : "text-muted"}`}>{summary.title}</p>
              <p className="text-sm text-ink-2">{summary.detail}</p>
            </div>
          </>
        ) : (
          <p className="text-sm text-muted">Laden…</p>
        )}
      </div>

      {session ? (
        <div className="mt-3">
          <p className="text-sm text-ink-2">{mine ? "Bedankt voor je melding. Je kunt hem aanpassen." : "Sta je hier? Geef door hoe het is:"}</p>
          <div className="mt-2 grid grid-cols-3 gap-2" role="group" aria-label="Drukte doorgeven">
            {LEVELS.map((l) => (
              <button
                key={l}
                type="button"
                onClick={() => report(l)}
                disabled={busy !== null}
                aria-pressed={mine === l}
                className="flex h-11 items-center justify-center gap-2 rounded-xl border-2 border-line font-semibold transition-colors hover:border-forest disabled:opacity-60 aria-pressed:border-forest aria-pressed:bg-forest-tint aria-pressed:text-forest"
              >
                <span className={`h-2.5 w-2.5 rounded-full ${DOT[l]}`} aria-hidden="true" />
                {busy === l ? "…" : CROWD_LABEL[l]}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <Link
          href={`/inloggen?next=${encodeURIComponent(`/plek/${slug}#drukte`)}`}
          className="mt-3 inline-flex h-11 items-center rounded-xl border-2 border-line px-4 font-semibold hover:border-forest"
        >
          Log in om de drukte door te geven
        </Link>
      )}
      {err && <p role="alert" className="mt-2 rounded-lg bg-alert-tint px-3 py-2 text-alert">{err}</p>}
    </section>
  );
}
