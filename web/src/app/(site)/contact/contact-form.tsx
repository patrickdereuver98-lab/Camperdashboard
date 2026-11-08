"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { supabase } from "@/lib/supabase-browser";
import { fieldAria, formError, ticketRules } from "@/lib/form-errors";
import { FieldError, FormAlert, useFormError } from "@/components/form-error";
import { SuccessNote } from "@/components/success-note";
import { Icon } from "@/components/icons";

const CATEGORIES = [
  ["vraag", "Algemene vraag"],
  ["fout-in-gegevens", "Fout in de gegevens van een plek"],
  ["eigenaar", "Ik ben eigenaar van een plek"],
  ["technisch", "Iets werkt niet"],
  ["privacy", "Privacy en mijn gegevens"],
  ["samenwerking", "Samenwerking of pers"],
  ["overig", "Iets anders"],
] as const;

export const field = "h-12 w-full rounded-lg border border-field bg-surface px-3 focus:border-forest focus:outline-none focus:ring-2 focus:ring-forest";

const F = "contact";

export function ContactForm() {
  const params = useSearchParams();
  const preset = params.get("onderwerp");
  const [busy, setBusy] = useState(false);
  const { formRef, error: err, setError: setErr } = useFormError();
  const [done, setDone] = useState<{ number: number; token: string } | null>(null);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    if (f.get("website")) return;
    setBusy(true);
    setErr(null);
    const { data, error } = await (await supabase()).rpc("create_ticket", {
      p_name: String(f.get("name")),
      p_email: String(f.get("email")),
      p_subject: String(f.get("subject")),
      p_category: String(f.get("category")),
      p_body: String(f.get("body")),
      p_place_id: null,
    });
    setBusy(false);
    if (error) return setErr(formError(error, ticketRules()));
    const row = data[0];
    setDone({ number: row.number, token: row.access_token });
  }

  if (done)
    return (
      <SuccessNote className="mt-8 rounded-xl bg-forest-tint p-6">
        <p className="flex items-center gap-2 font-display text-xl font-semibold text-forest">
          <Icon name="check" size={24} /> Bericht ontvangen (#{done.number})
        </p>
        <p className="mt-2 text-ink-2">
          Bewaar de link hieronder. Daar zie je ons antwoord en kun je reageren, zonder account.
        </p>
        <Link href={`/support/${done.token}`} className="mt-4 inline-flex h-12 items-center rounded-lg bg-forest px-5 font-semibold text-on-forest">
          Naar mijn bericht
        </Link>
      </SuccessNote>
    );

  return (
    <form ref={formRef} onSubmit={submit} className="mt-8 space-y-4">
      <label className="block">
        <span className="mb-1.5 block font-semibold">Waar gaat het over?</span>
        <select name="category" defaultValue={CATEGORIES.some(([v]) => v === preset) ? preset! : "vraag"} className={field}>
          {CATEGORIES.map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </select>
      </label>
      <div>
        <label className="block">
          <span className="mb-1.5 block font-semibold">Onderwerp</span>
          <input name="subject" required minLength={3} maxLength={140} className={field} {...fieldAria(err, F, "subject")} />
        </label>
        <FieldError error={err} form={F} field="subject" />
      </div>
      <div>
        <label className="block">
          <span className="mb-1.5 block font-semibold">Je bericht</span>
          <textarea name="body" required minLength={10} maxLength={5000} rows={6} className={`${field} h-auto py-2`} {...fieldAria(err, F, "body")} />
        </label>
        <FieldError error={err} form={F} field="body" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="block">
            <span className="mb-1.5 block font-semibold">Naam</span>
            <input name="name" required minLength={2} maxLength={80} autoComplete="name" className={field} {...fieldAria(err, F, "name")} />
          </label>
          <FieldError error={err} form={F} field="name" />
        </div>
        <div>
          <label className="block">
            <span className="mb-1.5 block font-semibold">E-mailadres</span>
            <input name="email" type="email" required autoComplete="email" className={field} {...fieldAria(err, F, "email")} />
          </label>
          <FieldError error={err} form={F} field="email" />
        </div>
      </div>
      <input name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />
      <p className="text-sm text-muted">
        We gebruiken je gegevens alleen om je vraag te beantwoorden. Zie de{" "}
        <Link href="/privacy" className="underline">privacyverklaring</Link>.
      </p>
      <FormAlert error={err} />
      <button type="submit" disabled={busy} className="h-14 w-full rounded-lg bg-forest hover:bg-forest-deep font-display text-lg font-semibold text-on-forest disabled:opacity-60">
        {busy ? "Versturen…" : "Bericht versturen"}
      </button>
    </form>
  );
}
