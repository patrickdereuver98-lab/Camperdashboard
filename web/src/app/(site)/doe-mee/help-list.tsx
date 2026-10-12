"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { departureKind } from "@/lib/search";
import { usePlaces } from "@/lib/store";
import { errorMessage, supabase } from "@/lib/supabase-browser";
import { PROVINCES, type PlaceSummary } from "@/lib/types";
import { Icon } from "@/components/icons";
import { Sheet } from "@/components/sheet";

const field = "h-12 w-full rounded-lg border border-line bg-surface px-3 focus:border-forest focus:outline-none";
const PAGE = 20;

/** Gepubliceerde plekken waarvan de vertrektijd nog onbekend is, per provincie, met een snel invulformulier */
export function HelpList() {
  const { data: places, error } = usePlaces();
  const [province, setProvince] = useState("");
  const [shown, setShown] = useState(PAGE);
  const [picked, setPicked] = useState<PlaceSummary | null>(null);
  const [sent, setSent] = useState<string[]>([]);

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
              <li key={p.id} className="flex items-center gap-3 px-4 py-2.5">
                <div className="min-w-0 flex-1">
                  <Link href={`/plek/${p.slug}`} className="block truncate font-semibold hover:text-forest hover:underline">
                    {p.name}
                  </Link>
                  <span className="block truncate text-sm text-muted">{p.town}</span>
                </div>
                {sent.includes(p.id) ? (
                  <span className="flex h-11 shrink-0 items-center gap-1.5 text-sm font-semibold text-forest">
                    <Icon name="check" size={18} /> Bedankt
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => setPicked(p)}
                    className="h-11 shrink-0 rounded-lg border border-line px-4 font-semibold text-forest transition-colors hover:border-forest"
                  >
                    Ik weet het
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

      <DepartureForm
        place={picked}
        onClose={() => setPicked(null)}
        onSent={(id) => {
          setSent((s) => [...s, id]);
          setPicked(null);
        }}
      />
    </div>
  );
}

function DepartureForm({ place, onClose, onSent }: { place: PlaceSummary | null; onClose: () => void; onSent: (id: string) => void }) {
  const [kind, setKind] = useState<"vrij" | "per24" | "vast" | "">("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!place) return;
    const f = new FormData(e.currentTarget);
    if (f.get("website")) return;
    if (!kind) return setErr("Kies hoe laat je weg moet.");
    setBusy(true);
    setErr(null);
    const { error } = await supabase().rpc("submit_place", {
      p_kind: "correctie",
      p_place_id: place.id,
      p_payload: {
        onderwerp: "vertrektijd",
        plek: place.name,
        vertrek: kind,
        vertrek_uiterlijk: kind === "vast" ? f.get("checkout") : null,
        hoe_weet_je_het: f.get("how"),
        toelichting: f.get("notes") || null,
      },
      p_contact_name: String(f.get("name") || ""),
      p_contact_email: String(f.get("email") || ""),
    });
    setBusy(false);
    if (error) return setErr(errorMessage(error));
    setKind("");
    onSent(place.id);
  }

  return (
    <Sheet open={!!place} onClose={onClose} title={place ? place.name : ""}>
      <form onSubmit={submit} className="space-y-5 pb-4">
        <div role="radiogroup" aria-labelledby="dm-vertrek">
          <span id="dm-vertrek" className="mb-1.5 block font-semibold">
            Hoe laat moet je hier weg?
          </span>
          <div className="grid gap-2">
            {(
              [
                ["vrij", "Geen vaste tijd, je vertrekt wanneer je wilt"],
                ["per24", "24 uur na aankomst"],
                ["vast", "Op een vaste tijd"],
              ] as const
            ).map(([v, l]) => (
              <button
                key={v}
                type="button"
                role="radio"
                aria-checked={kind === v}
                onClick={() => setKind(v)}
                className="min-h-12 rounded-lg border border-line px-4 py-2 text-left font-semibold aria-checked:border-forest aria-checked:bg-forest-tint aria-checked:text-forest"
              >
                {l}
              </button>
            ))}
          </div>
          {kind === "vast" && (
            <label className="mt-3 block">
              <span className="mb-1.5 block font-semibold">Uiterlijk weg om</span>
              <input name="checkout" type="time" step={900} defaultValue="11:00" required className={`${field} max-w-40`} />
            </label>
          )}
        </div>
        <label className="block">
          <span className="mb-1.5 block font-semibold">Hoe weet je dit?</span>
          <select name="how" className={field} defaultValue="zelf gestaan">
            <option value="zelf gestaan">Ik heb er zelf gestaan</option>
            <option value="bord ter plekke">Het staat op een bord bij de plek</option>
            <option value="gebeld">Ik heb het gevraagd of gebeld</option>
            <option value="website">Het staat op hun website</option>
            <option value="eigenaar">Ik ben de eigenaar</option>
          </select>
        </label>
        <label className="block">
          <span className="mb-1.5 block font-semibold">Iets toevoegen? (optioneel)</span>
          <textarea name="notes" rows={2} className={`${field} h-auto py-2`} />
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1.5 block font-semibold">Naam (optioneel)</span>
            <input name="name" className={field} autoComplete="name" />
          </label>
          <label className="block">
            <span className="mb-1.5 block font-semibold">E-mail (optioneel)</span>
            <input name="email" type="email" className={field} autoComplete="email" />
          </label>
        </div>
        <input name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />
        {err && (
          <p role="alert" className="rounded-lg bg-alert-tint px-3 py-2 text-alert">
            {err}
          </p>
        )}
        <button type="submit" disabled={busy} className="h-12 w-full rounded-lg bg-forest font-display text-lg font-semibold text-on-forest disabled:opacity-60">
          {busy ? "Versturen…" : "Versturen"}
        </button>
      </form>
    </Sheet>
  );
}
