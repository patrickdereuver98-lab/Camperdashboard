"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { departureKind } from "@/lib/search";
import { usePlaces } from "@/lib/store";
import { PROVINCES } from "@/lib/types";
import { errorMessage, placeIdBySlug } from "@/lib/supabase-browser";
import { Icon } from "@/components/icons";
import { DepartureForm } from "@/components/departure-form";

const field = "h-12 w-full rounded-lg border border-line bg-surface px-3 focus:border-forest focus:outline-none focus:ring-2 focus:ring-forest";
const PAGE = 20;

/** Gepubliceerde plekken waarvan de vertrektijd nog onbekend is, per provincie, met een snel invulformulier */
export function HelpList() {
  const { data: places, error } = usePlaces();
  const [province, setProvince] = useState("");
  const [shown, setShown] = useState(PAGE);
  const [picked, setPicked] = useState<{ id: string; name: string; slug: string } | null>(null);
  // Slugs van plekken waarvoor iemand hier al iets instuurde
  const [sent, setSent] = useState<string[]>([]);
  const [opening, setOpening] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  // De lijst komt zonder ids (audit 1 november 2026): pas bij "Ik weet het" het id van die ene plek opzoeken
  async function pick(p: { slug: string; name: string }) {
    setOpening(p.slug);
    setErr(null);
    try {
      const id = await placeIdBySlug(p.slug);
      if (id) setPicked({ id, name: p.name, slug: p.slug });
      else setErr("Deze plek staat niet meer op de site.");
    } catch (e) {
      setErr(errorMessage(e));
    } finally {
      setOpening(null);
    }
  }

  const list = useMemo(
    () =>
      (places ?? [])
        .filter((p) => departureKind(p) === "onbekend" && (!province || p.province === province))
        .sort((a, b) => a.town.localeCompare(b.town, "nl") || a.name.localeCompare(b.name, "nl")),
    [places, province],
  );

  if (error) return <p className="mt-4 rounded-xl bg-alert-tint p-4 text-alert">De plekken konden niet worden geladen. Ververs de pagina.</p>;

  return (
    <div className="mt-4">
      <label className="block max-w-xs">
        <span className="sr-only">Provincie</span>
        <select
          value={province}
          onChange={(e) => {
            setProvince(e.target.value);
            setShown(PAGE);
          }}
          className={field}
        >
          <option value="">Alle provincies</option>
          {PROVINCES.map((p) => (
            <option key={p}>{p}</option>
          ))}
        </select>
      </label>

      {!places ? (
        <p className="mt-4 text-muted">Plekken laden…</p>
      ) : (
        <>
          <p className="mt-3 text-sm text-muted">{list.length.toLocaleString("nl-NL")} plekken</p>
          <ul className="mt-2 divide-y divide-line overflow-hidden rounded-xl bg-surface shadow-low">
            {list.slice(0, shown).map((p) => (
              <li key={p.slug} className="flex items-center gap-3 px-4 py-2.5">
                <div className="min-w-0 flex-1">
                  <Link href={`/plek/${p.slug}`} className="block truncate font-semibold hover:text-forest hover:underline">
                    {p.name}
                  </Link>
                  <span className="block truncate text-sm text-muted">{p.town}</span>
                </div>
                {sent.includes(p.slug) ? (
                  <span className="flex h-11 shrink-0 items-center gap-1.5 text-sm font-semibold text-forest">
                    <Icon name="check" size={18} /> Bedankt
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => pick(p)}
                    disabled={opening !== null}
                    className="h-11 shrink-0 rounded-lg border border-line px-4 font-semibold text-forest transition-colors hover:border-forest disabled:opacity-60"
                  >
                    {opening === p.slug ? "Even geduld…" : "Ik weet het"}
                  </button>
                )}
              </li>
            ))}
          </ul>
          {shown < list.length && (
            <button type="button" onClick={() => setShown((n) => n + PAGE)} className="mt-3 h-12 w-full rounded-lg border border-line font-semibold hover:border-forest">
              Meer plekken
            </button>
          )}
        </>
      )}

      {err && (
        <p role="alert" className="mt-3 rounded-lg border border-alert/40 bg-alert-tint px-3 py-2 text-sm text-alert">
          {err}
        </p>
      )}

      <DepartureForm
        place={picked}
        onClose={() => setPicked(null)}
        onSent={() => {
          if (picked) setSent((s) => [...s, picked.slug]);
          setPicked(null);
        }}
      />
    </div>
  );
}
