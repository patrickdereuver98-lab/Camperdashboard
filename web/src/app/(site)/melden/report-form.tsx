"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { errorMessage, supabase } from "@/lib/supabase-browser";
import { SITE_URL } from "@/lib/env";
import { Icon } from "@/components/icons";

// Reden → korte naam in het onderwerp en de categorie van het supportticket
const REASONS = [
  { value: "illegaal", label: "Illegale inhoud", short: "illegale inhoud", category: "overig" },
  { value: "auteursrecht", label: "Auteursrecht of foto", short: "auteursrecht", category: "overig" },
  { value: "privacy", label: "Privacy of persoonsgegevens", short: "privacy", category: "privacy" },
  { value: "onjuist", label: "Onjuiste informatie", short: "onjuiste informatie", category: "fout-in-gegevens" },
  { value: "anders", label: "Iets anders", short: "anders", category: "overig" },
] as const;

const field = "h-12 w-full rounded-xl border-2 border-line bg-surface px-3 focus:border-forest focus:outline-none";

/** Een pad als "/plek/x" wordt een volledig adres op vrijstaan.nl */
function fullUrl(raw: string): string {
  const v = raw.trim();
  return v.startsWith("/") ? `${SITE_URL}${v}` : v;
}

export function ReportForm() {
  const params = useSearchParams();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState<{ number: number; token: string } | null>(null);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    if (f.get("website")) return; // honeypot
    const reason = REASONS.find((r) => r.value === f.get("reason")) ?? REASONS[4];
    const url = fullUrl(String(f.get("url") ?? ""));
    const explanation = String(f.get("explanation") ?? "").trim();
    const subject = `Melding over ${reason.short}: ${url}`;
    const body = [
      "Melding van illegale of onjuiste inhoud (art. 16 DSA)",
      `Reden: ${reason.label}`,
      `Adres: ${url}`,
      "",
      explanation,
      "",
      "De melder verklaart te goeder trouw dat de informatie en beweringen in deze melding juist en volledig zijn.",
    ].join("\n");
    setBusy(true);
    setErr(null);
    const { data, error } = await supabase().rpc("create_ticket", {
      p_name: String(f.get("name")),
      p_email: String(f.get("email")),
      p_subject: subject.length > 140 ? `${subject.slice(0, 139)}…` : subject,
      p_category: reason.category,
      p_body: body,
      p_place_id: null,
    });
    setBusy(false);
    if (error) return setErr(errorMessage(error));
    const row = (data as { number: number; access_token: string }[])[0];
    setDone({ number: row.number, token: row.access_token });
  }

  if (done)
    return (
      <div className="mt-8 rounded-2xl bg-forest-tint p-6">
        <p className="flex items-center gap-2 font-display text-xl font-semibold text-forest">
          <Icon name="check" size={24} /> Melding ontvangen (#{done.number})
        </p>
        <p className="mt-2 text-ink-2">Dank je wel. Dit gebeurt er nu:</p>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-ink-2">
          <li>Iemand van ons bekijkt je melding. Daar gebruiken we geen automatische systemen voor.</li>
          <li>We reageren zo snel mogelijk, uiterlijk binnen 5 werkdagen.</li>
          <li>Je hoort wat we besluiten en waarom. Ben je het er niet mee eens, dan lees je ook hoe je bezwaar maakt.</li>
        </ul>
        <p className="mt-3 text-ink-2">
          Bewaar de link hieronder. Daar zie je hoe het ervoor staat en wat we antwoorden. Je kunt er ook reageren, zonder
          account.
        </p>
        <Link href={`/support/${done.token}`} className="mt-4 inline-flex h-12 items-center rounded-xl bg-forest px-5 font-semibold text-on-forest">
          Naar mijn melding
        </Link>
      </div>
    );

  return (
    <form onSubmit={submit} className="mt-8 space-y-4">
      <label className="block">
        <span className="mb-1.5 block font-semibold">Waar gaat je melding over?</span>
        <select name="reason" required defaultValue="" className={field}>
          <option value="" disabled>
            Kies een reden
          </option>
          {REASONS.map((r) => (
            <option key={r.value} value={r.value}>{r.label}</option>
          ))}
        </select>
      </label>
      <label className="block">
        <span className="mb-1.5 block font-semibold">Adres (URL) van de inhoud</span>
        <input
          name="url"
          required
          minLength={2}
          maxLength={500}
          inputMode="url"
          autoCapitalize="off"
          defaultValue={params.get("url") ?? ""}
          placeholder="https://vrijstaan.nl/plek/…"
          className={field}
        />
        <span className="mt-1 block text-sm text-muted">Het precieze adres van de pagina. Gaat het om één review of foto, schrijf dan in je uitleg welke.</span>
      </label>
      <label className="block">
        <span className="mb-1.5 block font-semibold">Uitleg</span>
        <textarea
          name="explanation"
          required
          minLength={20}
          maxLength={4000}
          rows={6}
          className={`${field} h-auto py-2`}
          placeholder="Leg uit waarom deze inhoud volgens jou illegaal of onjuist is. Gaat het om auteursrecht, noem dan ook wie de rechthebbende is."
        />
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1.5 block font-semibold">Naam</span>
          <input name="name" required minLength={2} maxLength={80} autoComplete="name" className={field} />
        </label>
        <label className="block">
          <span className="mb-1.5 block font-semibold">E-mailadres</span>
          <input name="email" type="email" required autoComplete="email" className={field} />
        </label>
      </div>
      <p className="text-sm text-muted">
        De wet (art. 16 Digital Services Act) vraagt bij een melding je naam en e-mailadres. We gebruiken ze alleen om je
        melding te behandelen en je te laten weten wat we besluiten. Gaat het om seksueel misbruik van kinderen, dan hoef je
        je naam niet te geven. Vul dan &quot;Anoniem&quot; in. Je e-mailadres hebben we nodig om je te kunnen antwoorden. Zie de{" "}
        <Link href="/privacy" className="underline">privacyverklaring</Link>.
      </p>
      <label className="flex items-start gap-3">
        <input type="checkbox" name="good_faith" required className="mt-1 h-5 w-5 shrink-0 accent-[var(--forest)]" />
        <span>Ik verklaar te goeder trouw dat de informatie en beweringen in deze melding juist en volledig zijn.</span>
      </label>
      <input name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />
      {err && <p role="alert" className="rounded-lg bg-alert-tint px-3 py-2 text-alert">{err}</p>}
      <button type="submit" disabled={busy} className="h-14 w-full rounded-xl bg-forest font-semibold text-on-forest hover:bg-forest-deep disabled:opacity-60">
        {busy ? "Versturen…" : "Melding versturen"}
      </button>
    </form>
  );
}
