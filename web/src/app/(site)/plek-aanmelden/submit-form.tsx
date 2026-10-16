"use client";

import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { errorMessage, formValue, supabase } from "@/lib/supabase-browser";
import { FACILITIES } from "@/lib/search";
import { PROVINCES } from "@/lib/types";
import { Icon } from "@/components/icons";
import { Sign, type SignName } from "@/components/sign";

const field = "h-12 w-full rounded-lg border border-line bg-surface px-3 focus:border-forest focus:outline-none";

export function SubmitForm() {
  const params = useSearchParams();
  const [owner, setOwner] = useState(params.get("soort") === "eigenaar");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [checked, setChecked] = useState<string[]>([]);
  const [departure, setDeparture] = useState<"" | "vrij" | "per24" | "vast">("");

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    if (formValue(f, "website_hp")) return;
    const facilities: Record<string, boolean> = {};
    for (const fac of FACILITIES) if (formValue(f, `v_${fac.key}`)) facilities[fac.key] = true;
    setBusy(true);
    setErr(null);
    const { error } = await supabase().rpc("submit_place", {
      p_kind: owner ? "eigenaar" : "nieuw",
      p_place_id: null,
      p_payload: {
        naam: formValue(f, "name"),
        plaats: formValue(f, "town"),
        provincie: formValue(f, "province"),
        adres: formValue(f, "address"),
        website: (() => {
          // "www.camping.nl" is ook goed: we zetten er zelf https:// voor
          const w = String(formValue(f, "website") ?? "").trim();
          return w && !/^https?:\/\//i.test(w) ? `https://${w}` : w;
        })(),
        telefoon: formValue(f, "phone"),
        prijs_per_nacht: formValue(f, "price"),
        aantal_plekken: formValue(f, "capacity"),
        seizoen: formValue(f, "season"),
        vertrek: departure || null,
        vertrek_uiterlijk: departure === "vast" ? formValue(f, "checkout") || null : null,
        max_lengte_m: formValue(f, "max_length") || null,
        voorzieningen: facilities,
        toelichting: formValue(f, "notes"),
      },
      p_contact_name: String(formValue(f, "contact_name") || ""),
      p_contact_email: String(formValue(f, "contact_email") || ""),
    });
    setBusy(false);
    if (error) return setErr(errorMessage(error));
    setDone(true);
  }

  if (done)
    return (
      <div className="mt-8 rounded-xl bg-forest-tint p-6">
        <p className="flex items-center gap-2 font-display text-xl font-semibold text-forest">
          <Icon name="check" size={24} /> Bedankt voor je aanmelding
        </p>
        <p className="mt-2 text-ink-2">We controleren de gegevens en zetten de plek online als alles klopt. Dat duurt meestal een paar werkdagen.</p>
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
            className="h-12 rounded-lg border border-line font-semibold aria-checked:border-forest aria-checked:bg-forest-tint aria-checked:text-forest"
          >
            {l as string}
          </button>
        ))}
      </div>

      <fieldset className="space-y-4">
        <legend className="mb-2 font-display text-xl font-semibold">De plek</legend>
        <p className="text-sm text-muted">Velden met <span className="text-alert">*</span> zijn verplicht.</p>
        <label className="block">
          <span className="mb-1.5 block font-semibold">Naam van de plek <span className="text-alert" aria-hidden="true">*</span></span>
          <input name="name" required minLength={2} className={field} />
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1.5 block font-semibold">Plaats <span className="text-alert" aria-hidden="true">*</span></span>
            <input name="town" required className={field} />
          </label>
          <label className="block">
            <span className="mb-1.5 block font-semibold">Provincie <span className="text-alert" aria-hidden="true">*</span></span>
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
            <input name="website" type="text" inputMode="url" autoCapitalize="off" placeholder="www.voorbeeld.nl" className={field} />
          </label>
          <label className="block">
            <span className="mb-1.5 block font-semibold">Telefoon</span>
            <input name="phone" type="tel" className={field} />
          </label>
        </div>
      </fieldset>

      <fieldset className="space-y-4">
        <legend className="mb-2 font-display text-xl font-semibold">Wat je zeker weet</legend>
        <div role="radiogroup" aria-labelledby="vertrek-label">
          <span id="vertrek-label" className="mb-1.5 block font-semibold">
            Hoe laat moet je weg?
          </span>
          <div className="grid grid-cols-2 gap-2">
            {(
              [
                ["", "Weet ik niet"],
                ["vrij", "Geen vaste tijd"],
                ["per24", "24 uur na aankomst"],
                ["vast", "Op een vaste tijd"],
              ] as const
            ).map(([v, l]) => (
              <button
                key={v || "onbekend"}
                type="button"
                role="radio"
                aria-checked={departure === v}
                onClick={() => setDeparture(v)}
                className="min-h-12 rounded-lg border border-line px-3 text-left font-semibold aria-checked:border-forest aria-checked:bg-forest-tint aria-checked:text-forest"
              >
                {l}
              </button>
            ))}
          </div>
          {departure === "vast" && (
            <label className="mt-3 block">
              <span className="mb-1.5 block font-semibold">Uiterlijk weg om</span>
              <input name="checkout" type="time" step={900} defaultValue="11:00" className={`${field} max-w-40`} />
            </label>
          )}
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
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
            <input name="season" placeholder="bijv. april t/m oktober" className={field} />
          </label>
          <label className="block">
            <span className="mb-1.5 block font-semibold">Langste camper (m)</span>
            <input name="max_length" inputMode="decimal" placeholder="bijv. 8" className={field} />
          </label>
        </div>
        <p className="text-sm text-muted">Tik aan wat er zeker is. Wat je niet aantikt, laten we op onbekend staan.</p>
        <div className="grid grid-cols-2 gap-2">
          {FACILITIES.map((fac) => {
            const on = checked.includes(fac.key);
            return (
              <label
                key={fac.key}
                className="relative flex min-h-12 cursor-pointer items-center gap-2.5 rounded-lg border border-line px-3 font-semibold has-[:checked]:border-forest has-[:checked]:bg-forest-tint has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ink"
              >
                <input
                  type="checkbox"
                  name={`v_${fac.key}`}
                  checked={on}
                  onChange={() => setChecked((c) => (on ? c.filter((k) => k !== fac.key) : [...c, fac.key]))}
                  className="sr-only"
                />
                <Sign name={fac.icon as SignName} size={28} state={on ? "on" : "unknown"} />
                <span className="flex-1">{fac.label}</span>
                {on && <Icon name="check" size={18} className="shrink-0 text-forest" />}
              </label>
            );
          })}
        </div>
        <label className="block">
          <span className="mb-1.5 block font-semibold">Toelichting (optioneel)</span>
          <textarea name="notes" rows={3} className={`${field} h-auto py-2`} />
        </label>
      </fieldset>

      <fieldset className="space-y-4">
        <legend className="mb-2 font-display text-xl font-semibold">Jouw gegevens</legend>
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
        <p className="text-sm text-muted">We gebruiken dit alleen als we een vraag hebben over je aanmelding. Het staat niet op de site.</p>
      </fieldset>

      <input name="website_hp" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />
      {err && <p role="alert" className="rounded-lg bg-alert-tint px-3 py-2 text-alert">{err}</p>}
      <button type="submit" disabled={busy} className="h-14 w-full rounded-lg bg-forest hover:bg-forest-deep font-display text-lg font-semibold text-on-forest disabled:opacity-60">
        {busy ? "Versturen…" : "Plek aanmelden"}
      </button>
    </form>
  );
}
