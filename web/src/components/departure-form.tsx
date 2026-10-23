"use client";

import { useState } from "react";
import { errorMessage, formValue, supabase } from "@/lib/supabase-browser";
import type { PlaceSummary } from "@/lib/types";
import { Icon } from "./icons";
import { Sheet } from "./sheet";
import { DepartureRadios, type DepartureAnswer } from "./departure-radios";

const field = "h-12 w-full rounded-lg border border-line bg-surface px-3 focus:border-forest focus:outline-none";

/**
 * Vertrektijd doorgeven als inzending voor beheer (soort "correctie", onderwerp "vertrektijd"). Gebruikt bij Doe mee
 * en op de plekpagina van een onvolledige plek; beheer zet het om naar een vertrekregel.
 */
export function DepartureForm({
  place,
  onClose,
  onSent,
}: {
  place: Pick<PlaceSummary, "id" | "name"> | null;
  onClose: () => void;
  onSent: (id: string) => void;
}) {
  const [kind, setKind] = useState<DepartureAnswer>("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!place) return;
    const f = new FormData(e.currentTarget);
    if (formValue(f, "website")) return;
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
        vertrek_uiterlijk: kind === "vast" ? formValue(f, "checkout") : null,
        hoe_weet_je_het: formValue(f, "how"),
        toelichting: formValue(f, "notes") || null,
      },
      p_contact_name: String(formValue(f, "name") || ""),
      p_contact_email: String(formValue(f, "email") || ""),
    });
    setBusy(false);
    if (error) return setErr(errorMessage(error));
    setKind("");
    onSent(place.id);
  }

  return (
    <Sheet open={!!place} onClose={onClose} title={place ? place.name : ""}>
      <form onSubmit={submit} className="space-y-5 pb-4">
        <DepartureRadios id="dm-vertrek" label="Hoe laat moet je hier weg?" value={kind} onChange={setKind} fieldClass={field} />
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
        <button type="submit" disabled={busy} className="h-12 w-full rounded-lg bg-forest hover:bg-forest-deep font-display text-lg font-semibold text-on-forest disabled:opacity-60">
          {busy ? "Versturen…" : "Versturen"}
        </button>
      </form>
    </Sheet>
  );
}

/** Knop op de plekpagina van een onvolledige plek: opent het formulier van Doe mee voor deze ene plek */
export function GiveDepartureButton({ placeId, placeName }: { placeId: string; placeName: string }) {
  const [open, setOpen] = useState(false);
  const [sent, setSent] = useState(false);
  if (sent)
    return (
      <p role="status" className="flex min-h-11 items-center gap-1.5 font-semibold text-forest">
        <Icon name="check" size={18} /> Bedankt. We controleren het en zetten het daarna op de site.
      </p>
    );
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-11 items-center gap-2 rounded-lg border border-line bg-surface px-4 font-semibold text-forest transition-colors hover:border-forest"
      >
        <Icon name="clock" size={18} /> Vertrektijd doorgeven
      </button>
      <DepartureForm
        place={open ? { id: placeId, name: placeName } : null}
        onClose={() => setOpen(false)}
        onSent={() => {
          setOpen(false);
          setSent(true);
        }}
      />
    </>
  );
}
