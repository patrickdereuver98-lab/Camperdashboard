"use client";

import { RadioCards } from "@/components/radio-cards";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { formValue, supabase } from "@/lib/supabase-browser";
import { fieldAria, fieldError, formError } from "@/lib/form-errors";
import { FieldError, FormAlert, useFormError } from "@/components/form-error";
import { CHECK_TERM } from "@/lib/place-status";
import { FACILITIES } from "@/lib/search";
import { PROVINCES } from "@/lib/types";
import { SuccessNote } from "@/components/success-note";
import { Icon } from "@/components/icons";
import { Sign, type SignName } from "@/components/sign";

const F = "aanmelden";
const STEPS = ["Welke plek wil je aanmelden?", "Waar ligt de plek?", "Wat weet je al?", "Contact"] as const;
const EMAIL = /^\S+@\S+\.\S+$/;

const field = "h-11 w-full rounded-lg border border-field bg-surface px-3 focus:border-forest focus:outline-none focus:ring-2 focus:ring-forest";

export function SubmitForm() {
  const params = useSearchParams();
  const [owner, setOwner] = useState(params.get("soort") === "eigenaar");
  const [busy, setBusy] = useState(false);
  const { formRef, error: err, setError: setErr } = useFormError();
  const [step, setStep] = useState(0);
  const heading = useRef<HTMLHeadingElement>(null);
  const moved = useRef(false);
  const [done, setDone] = useState(false);
  const [checked, setChecked] = useState<string[]>([]);
  const [departure, setDeparture] = useState<"" | "vrij" | "per24" | "vast">("");

  // Focus naar de kop van de nieuwe stap, zodat een schermlezer "Stap 2 van 4" en de vraag voorleest
  useEffect(() => {
    if (moved.current) heading.current?.focus();
  }, [step]);

  /** Controleert één stap; geeft de eerste fout terug, bij het veld waar hij over gaat */
  function check(n: number) {
    const el = (name: string) => formRef.current?.elements.namedItem(name) as HTMLInputElement | null;
    const val = (name: string) => (el(name)?.value ?? "").trim();
    if (n === 0 && val("name").length < 2) return fieldError("name", "Vul de naam van de plek in, minstens 2 tekens.");
    if (n === 1) {
      if (!val("town")) return fieldError("town", "Vul de plaats in.");
      if (!val("province")) return fieldError("province", "Kies de provincie.");
    }
    if (n === 3) {
      if (owner && !val("contact_name")) return fieldError("contact_name", "Vul je naam in, dan weten we wie de eigenaar is.");
      if ((owner || val("contact_email")) && !EMAIL.test(val("contact_email")))
        return fieldError("contact_email", "Vul een geldig e-mailadres in, bijvoorbeeld naam@voorbeeld.nl.");
    }
    return null;
  }

  function go(to: number) {
    moved.current = true;
    setErr(null);
    setStep(to);
  }

  function next() {
    const problem = check(step);
    if (problem) return setErr(problem);
    go(step + 1);
  }

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    // Enter in een eerdere stap gaat naar de volgende stap, niet naar verzenden
    if (step < STEPS.length - 1) return next();
    const problem = check(step);
    if (problem) return setErr(problem);
    const f = new FormData(e.currentTarget);
    if (formValue(f, "website_hp")) return;
    const facilities: Record<string, boolean> = {};
    for (const fac of FACILITIES) if (formValue(f, `v_${fac.key}`)) facilities[fac.key] = true;
    setBusy(true);
    setErr(null);
    const { error } = await (await supabase()).rpc("submit_place", {
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
    if (error) return setErr(formError(error));
    setDone(true);
  }

  if (done)
    return (
      <SuccessNote className="mt-8 rounded-lg bg-forest-tint p-6">
        <p className="flex items-center gap-2 font-display text-h2 font-semibold text-forest">
          <Icon name="check" size={24} /> Bedankt voor je aanmelding
        </p>
        <p className="mt-2 text-ink-2">We controleren de gegevens en zetten de plek online als alles klopt. Dat doen we {CHECK_TERM}. Je hoeft verder niets te doen.</p>
      </SuccessNote>
    );

  const last = STEPS.length - 1;
  // Alle stappen staan in het formulier (de andere zijn verborgen), zodat invoer bij terug bewaard blijft en de
  // payload hetzelfde blijft; de controle per stap doen we zelf (noValidate).
  const pane = (n: number) => ({ hidden: step !== n, "aria-labelledby": `${F}-kop-${n}` });
  const title = (n: number) => (
    <h2
      id={`${F}-kop-${n}`}
      ref={step === n ? heading : undefined}
      tabIndex={-1}
      className="mb-4 font-display text-h2 font-semibold focus:outline-none"
    >
      <span className="block text-sm font-normal text-muted">Stap {n + 1} van {STEPS.length}</span>
      {STEPS[n]}
    </h2>
  );

  return (
    <form ref={formRef} onSubmit={submit} noValidate className="mt-8">
      <div className="mb-6 flex gap-1.5" aria-hidden="true">
        {STEPS.map((_, i) => (
          <span key={i} className={`h-1.5 flex-1 rounded-full ${i <= step ? "bg-forest" : "bg-sunken"}`} />
        ))}
      </div>

      <section {...pane(0)} className="space-y-4">
        {title(0)}
        <label className="block">
          <span className="mb-1.5 block font-semibold">Naam van de plek <span className="text-alert" aria-hidden="true">*</span></span>
          <input name="name" required minLength={2} autoComplete="off" className={field} {...fieldAria(err, F, "name")} />
          <FieldError error={err} form={F} field="name" />
        </label>
        <RadioCards
          label="Wie ben je?"
          options={[
            ["kenner", "Ik ken een plek"],
            ["eigenaar", "Ik ben eigenaar"],
          ]}
          value={owner ? "eigenaar" : "kenner"}
          onChange={(v) => setOwner(v === "eigenaar")}
          className="grid grid-cols-2 gap-2"
          cardClassName="min-h-12 justify-center px-2 py-1.5 text-center"
        />
        <p className="text-sm text-muted">Velden met <span className="text-alert">*</span> zijn verplicht. De rest mag je leeg laten.</p>
      </section>

      <section {...pane(1)} className="space-y-4">
        {title(1)}
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1.5 block font-semibold">Plaats <span className="text-alert" aria-hidden="true">*</span></span>
            <input name="town" required className={field} {...fieldAria(err, F, "town")} />
            <FieldError error={err} form={F} field="town" />
          </label>
          <label className="block">
            <span className="mb-1.5 block font-semibold">Provincie <span className="text-alert" aria-hidden="true">*</span></span>
            <select name="province" required className={field} defaultValue="" {...fieldAria(err, F, "province")}>
              <option value="" disabled>Kies…</option>
              {PROVINCES.map((p) => (
                <option key={p}>{p}</option>
              ))}
            </select>
            <FieldError error={err} form={F} field="province" />
          </label>
        </div>
        <label className="block">
          <span className="mb-1.5 block font-semibold">Adres (optioneel)</span>
          <input name="address" className={field} autoComplete="street-address" />
        </label>
      </section>

      <section {...pane(2)} className="space-y-4">
        {title(2)}
        <p className="text-sm text-muted">Vul in wat je zeker weet. Wat je niet weet, laat je leeg.</p>
        <div>
          <RadioCards
            label="Hoe laat moet je weg?"
            labelId="vertrek-label"
            options={
              [
                ["", "Weet ik niet"],
                ["vrij", "Geen vaste tijd"],
                ["per24", "24 uur na aankomst"],
                ["vast", "Op een vaste tijd"],
              ] as const
            }
            value={departure}
            onChange={(v) => setDeparture(v)}
            className="grid grid-cols-2 gap-2"
            cardClassName="min-h-12 px-3"
          />
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
          <label className="block">
            <span className="mb-1.5 block font-semibold">Website</span>
            <input name="website" type="text" inputMode="url" autoCapitalize="off" placeholder="www.voorbeeld.nl" className={field} />
          </label>
          <label className="block">
            <span className="mb-1.5 block font-semibold">Telefoon</span>
            <input name="phone" type="tel" className={field} />
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
      </section>

      <section {...pane(3)} className="space-y-4">
        {title(3)}
        <p className="text-sm text-muted">
          {owner ? "Als eigenaar laat je je naam en e-mail achter, zodat we weten wie je bent." : "Naam en e-mail zijn niet nodig."} We gebruiken dit
          alleen als we een vraag hebben over je aanmelding. Het staat niet op de site.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1.5 block font-semibold">Naam{owner && <> <span className="text-alert" aria-hidden="true">*</span></>}</span>
            <input name="contact_name" required={owner} className={field} autoComplete="name" {...fieldAria(err, F, "contact_name")} />
            <FieldError error={err} form={F} field="contact_name" />
          </label>
          <label className="block">
            <span className="mb-1.5 block font-semibold">E-mail{owner && <> <span className="text-alert" aria-hidden="true">*</span></>}</span>
            <input name="contact_email" type="email" required={owner} className={field} autoComplete="email" {...fieldAria(err, F, "contact_email")} />
            <FieldError error={err} form={F} field="contact_email" />
          </label>
        </div>
      </section>

      <input name="website_hp" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />
      <div className="mt-6">
        <FormAlert error={err} />
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3">
        {step > 0 ? (
          <button key="back" type="button" onClick={() => go(step - 1)} className="h-12 rounded-lg border border-line font-semibold hover:border-forest">
            Vorige
          </button>
        ) : (
          <span />
        )}
        {step < last ? (
          <button key="next" type="button" onClick={next} className="h-12 rounded-lg bg-forest font-semibold text-on-forest hover:bg-forest-deep">
            Volgende
          </button>
        ) : (
          <button key="send" type="submit" disabled={busy} className="h-12 rounded-lg bg-forest font-semibold text-on-forest hover:bg-forest-deep disabled:opacity-60">
            {busy ? "Versturen…" : "Plek aanmelden"}
          </button>
        )}
      </div>
    </form>
  );
}
