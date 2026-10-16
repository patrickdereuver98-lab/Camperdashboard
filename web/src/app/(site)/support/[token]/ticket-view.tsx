"use client";

import { use, useEffect, useState } from "react";
import { formatDate } from "@/lib/format";
import { errorMessage, supabase } from "@/lib/supabase-browser";

type Ticket = {
  number: number;
  subject: string;
  status: string;
  name: string;
  created_at: string;
  messages: { author: "klant" | "support"; body: string; created_at: string }[];
};

const STATUS: Record<string, string> = {
  open: "Ontvangen",
  "in-behandeling": "In behandeling",
  "wacht-op-klant": "Wacht op jouw reactie",
  opgelost: "Opgelost",
  gesloten: "Gesloten",
};

export function TicketView({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const [ticket, setTicket] = useState<Ticket | null | undefined>(undefined);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [version, setVersion] = useState(0);
  const load = () => setVersion((v) => v + 1);

  useEffect(() => {
    let live = true;
    supabase()
      .rpc("get_ticket", { p_token: token })
      .then(({ data, error }) => {
        if (!live) return;
        // Geen verbinding is iets anders dan een onbekende link
        if (error) setLoadError(errorMessage(error));
        else {
          setLoadError(null);
          setTicket((data as Ticket | null) ?? null);
        }
      });
    return () => {
      live = false;
    };
  }, [token, version]);

  async function reply(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const body = String(new FormData(form).get("body"));
    setBusy(true);
    setErr(null);
    const { error } = await supabase().rpc("reply_ticket", { p_token: token, p_body: body });
    setBusy(false);
    if (error) return setErr(errorMessage(error));
    form.reset();
    load();
  }

  if (loadError && ticket === undefined)
    return (
      <div className="mx-auto max-w-xl px-4 pt-12 text-center">
        <h1 className="font-display text-2xl font-semibold">We konden je bericht niet laden</h1>
        <p className="mt-2 text-ink-2">{loadError}</p>
        <button type="button" onClick={load} className="mt-6 h-12 rounded-lg bg-forest px-6 font-semibold text-on-forest">
          Opnieuw proberen
        </button>
      </div>
    );
  if (ticket === undefined) return <p className="px-4 pt-12 text-center text-muted">Bericht laden…</p>;
  if (ticket === null)
    return (
      <div className="mx-auto max-w-xl px-4 pt-12 text-center">
        <h1 className="font-display text-2xl font-semibold">Bericht niet gevonden</h1>
        <p className="mt-2 text-ink-2">Kijk of je de hele link hebt gebruikt. Plak hem anders opnieuw in je browser.</p>
      </div>
    );

  return (
    <div className="mx-auto max-w-2xl px-4 pt-8 sm:px-6">
      <p className="text-sm text-muted">Bericht #{ticket.number}</p>
      <h1 className="font-display text-2xl font-semibold sm:text-3xl">{ticket.subject}</h1>
      <p className="mt-2 inline-flex rounded-full bg-forest-tint px-3 py-1 text-sm font-semibold text-forest">{STATUS[ticket.status] ?? ticket.status}</p>
      <ol className="mt-6 space-y-3">
        {ticket.messages.map((m, i) => (
          <li key={i} className={`rounded-xl p-4 ${m.author === "support" ? "bg-forest-tint" : "bg-surface outline-1 outline-line outline"}`}>
            <p className="text-sm font-semibold">{m.author === "support" ? "VrijStaan support" : ticket.name}</p>
            <p className="text-sm text-muted">{formatDate(m.created_at)}</p>
            <p className="mt-2 whitespace-pre-line">{m.body}</p>
          </li>
        ))}
      </ol>
      {ticket.status !== "gesloten" && (
        <form onSubmit={reply} className="mt-6 space-y-3">
          <label className="block">
            <span className="mb-1.5 block font-semibold">Reageren</span>
            <textarea name="body" required minLength={1} maxLength={5000} rows={4} className="w-full rounded-lg border border-line bg-surface px-3 py-2 focus:border-forest focus:outline-none" />
          </label>
          {err && <p role="alert" className="rounded-lg bg-alert-tint px-3 py-2 text-alert">{err}</p>}
          <button type="submit" disabled={busy} className="h-12 rounded-lg bg-forest px-6 font-semibold text-on-forest disabled:opacity-60">
            {busy ? "Versturen…" : "Reactie versturen"}
          </button>
        </form>
      )}
    </div>
  );
}
