"use client";

import { useState } from "react";
import { DepartureRadios, type DepartureAnswer } from "@/components/departure-radios";
import { Icon } from "@/components/icons";
import { Sheet } from "@/components/sheet";
import { ownerChanges, OWNER_FIELDS, type OwnerValues } from "@/lib/owner-update";
import { errorMessage, formValue, supabase } from "@/lib/supabase-browser";

const input = "h-12 w-full rounded-lg border border-line bg-surface px-3 focus:border-forest focus:outline-none";

const RESERVE: [string, string][] = [
  ["verplicht", "Verplicht"],
  ["mogelijk", "Kan, hoeft niet"],
  ["niet_nodig", "Niet nodig"],
];

const TAX: [string, string][] = [
  ["inbegrepen", "Zit in de prijs"],
  ["erbij", "Komt erbij"],
];

/** Keuze uit een paar knoppen; nog een keer tikken haalt de keuze weg. De waarde gaat mee via een verborgen veld. */
function Choice({ id, name, label, options, value, onChange }: {
  id: string;
  name: string;
  label: string;
  options: [string, string][];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div role="radiogroup" aria-labelledby={id}>
      <span id={id} className="mb-1.5 block font-semibold">{label}</span>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {options.map(([v, l]) => (
          <button
            key={v}
            type="button"
            role="radio"
            aria-checked={value === v}
            onClick={() => onChange(value === v ? "" : v)}
            className="min-h-12 rounded-lg border border-line px-3 text-left font-semibold aria-checked:border-forest aria-checked:bg-forest-tint aria-checked:text-forest"
          >
            {l}
          </button>
        ))}
      </div>
      <input type="hidden" name={name} value={value} />
    </div>
  );
}

/**
 * "Ben je de eigenaar? Vul je gegevens aan": een formulier met wat we al weten. Er gaat alleen mee wat de eigenaar
 * veranderde; beheer controleert het en zet het daarna pas op de site.
 */
export function OwnerUpdate({ placeId, placeName, initial }: { placeId: string; placeName: string; initial: OwnerValues }) {
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [departure, setDeparture] = useState<DepartureAnswer>(initial.vertrek as DepartureAnswer);
  const [reserve, setReserve] = useState(initial.reserveren);
  const [tax, setTax] = useState(initial.toeristenbelasting);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    if (formValue(f, "website_hp")) return;
    const after: Partial<OwnerValues> = {};
    for (const k of OWNER_FIELDS) after[k] = String(formValue(f, k) ?? "");
    after.vertrek = departure;
    after.vertrek_uiterlijk = departure === "vast" ? String(formValue(f, "checkout") ?? "") : "";
    const changes = ownerChanges(initial, after);
    const note = String(formValue(f, "notes") ?? "").trim();
    if (!Object.keys(changes).length && !note) {
      setErr("Je hebt nog niets aangepast. Verander een gegeven of schrijf een toelichting.");
      return;
    }
    setBusy(true);
    setErr(null);
    const { error } = await supabase().rpc("submit_place", {
      p_kind: "eigenaar",
      p_place_id: placeId,
      p_payload: { plek: placeName, wijzigingen: changes, toelichting: note },
      p_contact_name: String(formValue(f, "contact_name") || ""),
      p_contact_email: String(formValue(f, "contact_email") || ""),
    });
    setBusy(false);
    if (error) setErr(errorMessage(error));
    else setDone(true);
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="flex h-11 items-center gap-2 font-semibold text-forest underline">
        <Icon name="edit" size={18} /> Ben je de eigenaar? Vul je gegevens aan
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title={done ? "Bedankt" : "Gegevens aanvullen"}>
        {done ? (
          <div className="pb-4">
            <p className="text-lg">We controleren je gegevens en zetten ze daarna op de site. Bij een vraag mailen we je.</p>
            <button type="button" onClick={() => setOpen(false)} className="mt-6 h-12 w-full rounded-lg bg-forest font-semibold text-on-forest">
              Sluiten
            </button>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-5 pb-4">
            <p className="text-ink-2">
              Hieronder staat wat we nu over {placeName} weten. Pas aan wat niet klopt en vul aan wat leeg is. Weet je iets niet zeker, laat het dan leeg.
            </p>

            <DepartureRadios
              id="eig-vertrek"
              label="Hoe laat moeten gasten weg?"
              value={departure}
              onChange={setDeparture}
              fieldClass={input}
              checkoutDefault={initial.vertrek_uiterlijk || "11:00"}
            />
            <label className="block">
              <span className="mb-1.5 block font-semibold">Aankomst vanaf</span>
              <input name="aankomst_vanaf" type="time" step={900} defaultValue={initial.aankomst_vanaf} className={`${input} max-w-40`} />
            </label>
            <Choice id="eig-reserveren" name="reserveren" label="Reserveren" options={RESERVE} value={reserve} onChange={setReserve} />

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1.5 block font-semibold">Prijs per nacht (€)</span>
                <input name="prijs_per_nacht" inputMode="decimal" defaultValue={initial.prijs_per_nacht} className={input} />
              </label>
              <label className="block">
                <span className="mb-1.5 block font-semibold">Open</span>
                <input name="open" placeholder="bijv. april t/m oktober" defaultValue={initial.open} className={input} />
              </label>
            </div>
            <Choice id="eig-toeristenbelasting" name="toeristenbelasting" label="Toeristenbelasting" options={TAX} value={tax} onChange={setTax} />
            <label className="block">
              <span className="mb-1.5 block font-semibold">Extra kosten</span>
              <span className="mb-1.5 block text-sm text-muted">Eén per regel, met het bedrag en waarvoor: per nacht, per persoon of per kWh.</span>
              <textarea
                name="extra_kosten"
                rows={4}
                defaultValue={initial.extra_kosten}
                placeholder={"Stroom: € 3,50 per nacht\nToeristenbelasting: € 1,50 per persoon per nacht"}
                className={`${input} h-auto py-2`}
              />
            </label>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1.5 block font-semibold">Aantal plekken</span>
                <input name="aantal_plekken" inputMode="numeric" defaultValue={initial.aantal_plekken} className={input} />
              </label>
              <label className="block">
                <span className="mb-1.5 block font-semibold">Langste camper (m)</span>
                <input name="langste_camper_m" inputMode="decimal" defaultValue={initial.langste_camper_m} className={input} />
              </label>
              <label className="block">
                <span className="mb-1.5 block font-semibold">Telefoon</span>
                <input name="telefoon" type="tel" defaultValue={initial.telefoon} className={input} />
              </label>
              <label className="block">
                <span className="mb-1.5 block font-semibold">Website</span>
                <input name="website" inputMode="url" autoCapitalize="off" defaultValue={initial.website} className={input} />
              </label>
            </div>
            <label className="block">
              <span className="mb-1.5 block font-semibold">Toelichting (optioneel)</span>
              <textarea name="notes" rows={3} className={`${input} h-auto py-2`} />
            </label>

            <fieldset className="space-y-3">
              <legend className="mb-1.5 font-semibold">Jouw gegevens</legend>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-1.5 block text-sm">Naam</span>
                  <input name="contact_name" required className={input} autoComplete="name" />
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-sm">E-mail</span>
                  <input name="contact_email" type="email" required className={input} autoComplete="email" />
                </label>
              </div>
              <p className="text-sm text-muted">Alleen voor een vraag over je gegevens. Het staat niet op de site.</p>
            </fieldset>

            <input name="website_hp" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />
            {err && <p role="alert" className="rounded-lg bg-alert-tint px-3 py-2 text-alert">{err}</p>}
            <button type="submit" disabled={busy} className="h-12 w-full rounded-lg bg-forest hover:bg-forest-deep font-display text-lg font-semibold text-on-forest disabled:opacity-60">
              {busy ? "Versturen…" : "Gegevens versturen"}
            </button>
          </form>
        )}
      </Sheet>
    </>
  );
}
