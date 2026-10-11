"use client";

import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { errorMessage, supabase } from "@/lib/supabase-browser";
import { FACILITIES } from "@/lib/search";
import { PROVINCES } from "@/lib/types";
import { Icon } from "@/components/icons";
import { Sign, type SignName } from "@/components/sign";

const field = "h-12 w-full rounded-xl border-2 border-line bg-surface px-3 focus:border-road focus:outline-none";

export function SubmitForm() {
  const params = useSearchParams();
  const [owner, setOwner] = useState(params.get("soort") === "eigenaar");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    if (f.get("website_hp")) return;
    const facilities: Record<string, boolean> = {};
    for (const fac of FACILITIES) if (f.get(`v_${fac.key}`)) facilities[fac.key] = true;
    setBusy(true);
    setErr(null);
    const { error } = await supabase().rpc("submit_place", {
      p_kind: owner ? "eigenaar" : "nieuw",
      p_place_id: null,
      p_payload: {
        naam: f.get("name"),
        plaats: f.get("town"),
        provincie: f.get("province"),
        adres: f.get("address"),
        website: f.get("website"),
        telefoon: f.get("phone"),
        prijs_per_nacht: f.get("price"),
        aantal_plekken: f.get("capacity"),
        seizoen: f.get("season"),
        voorzieningen: facilities,
        toelichting: f.get("notes"),
      },
      p_contact_name: String(f.get("contact_name") || ""),
      p_contact_email: String(f.get("contact_email") || ""),
    });
    setBusy(false);
    if (error) return setErr(errorMessage(error));
    setDone(true);
  }

  if (done)
    return (
      <div className="mt-8 rounded-2xl bg-polder-tint p-6">
        <p className="flex items-center gap-2 font-sign text-xl font-bold text-polder">
          <Icon name="check" size={24} /> Bedankt voor je aanmelding
        </p>
        <p className="mt-2 text-ink-2">We controleren de gegevens en zetten de plek online zodra alles klopt. Dat duurt meestal een paar werkdagen.</p>
      </div>
    );

  return (
    <form onSubmit={submit} className="mt-8 space-y-6">
      <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Wie ben je?">
        {[
          [false, "Ik ken een plek"],
          [true, "Ik ben eigenaar"],
        ].map(([v, l]) => (
          <button
            key={String(v)}
            type="button"
            role="radio"
            aria-checked={owner === v}
            onClick={() => setOwner(v as boolean)}
            className="h-12 rounded-xl border-2 border-line font-semibold aria-checked:border-road aria-checked:bg-road-tint aria-checked:text-road"
          >
            {l as string}
          </button>
        ))}
      </div>

      <fieldset className="space-y-4">
        <legend className="mb-2 font-sign text-xl font-bold">De plek</legend>
        <label className="block">
          <span className="mb-1.5 block font-semibold">Naam van de plek</span>
          <input name="name" required minLength={2} className={field} />
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1.5 block font-semibold">Plaats</span>
            <input name="town" required className={field} />
          </label>
          <label className="block">
            <span className="mb-1.5 block font-semibold">Provincie</span>
            <select name="province" required className={field} defaultValue="">
              <option value="" disabled>Kies…</option>
              {PROVINCES.map((p) => (
                <option key={p}>{p}</option>
              ))}
            </select>
          </label>
        </div>
        <label className="block">
          <span className="mb-1.5 block font-semibold">Adres (optioneel)</span>
          <input name="address" className={field} autoComplete="street-address" />
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1.5 block font-semibold">Website</span>
            <input name="website" type="url" placeholder="https://" className={field} />
          </label>
          <label className="block">
            <span className="mb-1.5 block font-semibold">Telefoon</span>
            <input name="phone" type="tel" className={field} />
          </label>
        </div>
      </fieldset>

      <fieldset className="space-y-4">
        <legend className="mb-2 font-sign text-xl font-bold">Wat je zeker weet</legend>
        <div className="grid gap-4 sm:grid-cols-3">
          <label className="block">
            <span className="mb-1.5 block font-semibold">Prijs per nacht (€)</span>
            <input name="price" inputMode="decimal" className={field} />
          </label>
          <label className="block">
            <span className="mb-1.5 block font-semibold">Aantal plekken</span>
            <input name="capacity" inputMode="numeric" className={field} />
          </label>
          <label className="block">
            <span className="mb-1.5 block font-semibold">Open</span>
            <input name="season" placeholder="bijv. april – oktober" className={field} />
          </label>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {FACILITIES.map((fac) => (
            <label key={fac.key} className="flex min-h-12 items-center gap-2.5 rounded-xl border-2 border-line px-3 font-semibold has-[:checked]:border-road has-[:checked]:bg-road-tint">
              <input type="checkbox" name={`v_${fac.key}`} className="sr-only" />
              <Sign name={fac.icon as SignName} size={28} />
              {fac.label}
            </label>
          ))}
        </div>
        <label className="block">
          <span className="mb-1.5 block font-semibold">Toelichting (optioneel)</span>
          <textarea name="notes" rows={3} className={`${field} h-auto py-2`} />
        </label>
      </fieldset>

      <fieldset className="space-y-4">
        <legend className="mb-2 font-sign text-xl font-bold">Jouw gegevens</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1.5 block font-semibold">Naam</span>
            <input name="contact_name" required={owner} className={field} autoComplete="name" />
          </label>
          <label className="block">
            <span className="mb-1.5 block font-semibold">E-mail</span>
            <input name="contact_email" type="email" required={owner} className={field} autoComplete="email" />
          </label>
        </div>
        <p className="text-sm text-muted">Alleen voor vragen over je aanmelding. Niet zichtbaar op de site.</p>
      </fieldset>

      <input name="website_hp" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />
      {err && <p role="alert" className="rounded-lg bg-alert-tint px-3 py-2 text-alert">{err}</p>}
      <button type="submit" disabled={busy} className="h-14 w-full rounded-xl bg-road font-sign text-lg font-bold text-on-road disabled:opacity-60">
        {busy ? "Versturen…" : "Plek aanmelden"}
      </button>
    </form>
  );
}
