"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/components/icons";
import { errorMessage } from "@/lib/supabase-browser";
import { Badge, Empty, ErrorNote, PageTitle, Segmented, db, input, primary, secondary, textarea, useQuery, when } from "../ui";

type Ticket = {
  id: string;
  number: number;
  access_token: string;
  name: string;
  email: string;
  subject: string;
  category: string;
  status: string;
  priority: string;
  place_id: string | null;
  created_at: string;
  updated_at: string;
};
type Message = { id: string; author: "klant" | "support"; body: string; internal: boolean; created_at: string };

const STATUS: Record<string, string> = {
  open: "Open",
  "in-behandeling": "In behandeling",
  "wacht-op-klant": "Wacht op klant",
  opgelost: "Opgelost",
  gesloten: "Gesloten",
};
const CATEGORY: Record<string, string> = {
  vraag: "Vraag",
  "fout-in-gegevens": "Fout in gegevens",
  technisch: "Technisch",
  privacy: "Privacy",
  eigenaar: "Eigenaar",
  samenwerking: "Samenwerking",
  overig: "Overig",
};
const TEMPLATES = [
  ["Bedankt, aangepast", "Bedankt voor je melding. We hebben de gegevens gecontroleerd en aangepast op de site."],
  ["Meer info nodig", "Bedankt voor je bericht. Kun je ons iets meer vertellen, bijvoorbeeld de naam van de plek en wat er precies niet klopt?"],
  ["Privacyverzoek", "We hebben je privacyverzoek ontvangen en handelen dit binnen 30 dagen af, zoals de AVG voorschrijft. Je hoort van ons zodra het is afgerond."],
] as const;

export default function SupportAdmin() {
  const [filter, setFilter] = useState<"actief" | "alle" | "opgelost">("actief");
  const [openId, setOpenId] = useState<string | null>(null);
  const { data, error, reload } = useQuery(() => {
    let q = db().from("tickets").select("*").order("updated_at", { ascending: false }).limit(200);
    if (filter === "actief") q = q.in("status", ["open", "in-behandeling", "wacht-op-klant"]);
    if (filter === "opgelost") q = q.in("status", ["opgelost", "gesloten"]);
    return q;
  }, [filter]);
  const tickets = (data as Ticket[] | null) ?? [];
  const current = tickets.find((t) => t.id === openId);

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <PageTitle title="Support" />
      <Segmented
        label="Filter"
        value={filter}
        onChange={(v) => (setFilter(v), setOpenId(null))}
        options={[
          { value: "actief", label: "Actief" },
          { value: "opgelost", label: "Afgerond" },
          { value: "alle", label: "Alle" },
        ]}
      />
      <ErrorNote message={error} />
      <div className="grid gap-4 lg:grid-cols-[22rem_1fr]">
        <div className={current ? "hidden lg:block" : ""}>
          {tickets.length === 0 ? (
            <Empty>Geen berichten in deze lijst.</Empty>
          ) : (
            <ul className="divide-y divide-line overflow-hidden rounded-2xl bg-surface outline-1 outline-line outline">
              {tickets.map((t) => (
                <li key={t.id}>
                  <button
                    onClick={() => setOpenId(t.id)}
                    aria-current={t.id === openId ? "true" : undefined}
                    className="block w-full px-4 py-3 text-left hover:bg-sunken aria-[current=true]:bg-road-tint"
                  >
                    <span className="flex items-center justify-between gap-2 text-sm text-muted">
                      <span>#{t.number} {CATEGORY[t.category] ?? t.category}</span>
                      <span>{when(t.updated_at)}</span>
                    </span>
                    <span className="mt-0.5 block truncate font-semibold">{t.subject}</span>
                    <span className="mt-1 flex items-center gap-2">
                      <Badge tone={t.status === "open" ? "yellow" : t.status === "opgelost" || t.status === "gesloten" ? "green" : "road"}>{STATUS[t.status]}</Badge>
                      {t.priority === "hoog" && <Badge tone="red">Hoge prioriteit</Badge>}
                      <span className="truncate text-sm text-muted">{t.name}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        {current ? (
          <TicketDetail key={current.id} ticket={current} onBack={() => setOpenId(null)} onChange={reload} />
        ) : (
          <div className="hidden lg:block">
            <Empty>Kies een bericht om te beantwoorden.</Empty>
          </div>
        )}
      </div>
    </div>
  );
}

function TicketDetail({ ticket, onBack, onChange }: { ticket: Ticket; onBack: () => void; onChange: () => void }) {
  const [messages, setMessages] = useState<Message[] | null>(null);
  const [body, setBody] = useState("");
  const [internal, setInternal] = useState(false);
  const [nextStatus, setNextStatus] = useState("wacht-op-klant");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [version, setVersion] = useState(0);
  const load = () => setVersion((v) => v + 1);
  useEffect(() => {
    let live = true;
    db()
      .from("ticket_messages")
      .select("*")
      .eq("ticket_id", ticket.id)
      .order("created_at")
      .then(({ data, error }) => {
        if (!live) return;
        if (error) setErr(errorMessage(error));
        else setMessages(data as Message[]);
      });
    return () => {
      live = false;
    };
  }, [ticket.id, version]);

  async function update(fields: Partial<Ticket>) {
    const { error } = await db().from("tickets").update(fields).eq("id", ticket.id);
    if (error) setErr(errorMessage(error));
    else onChange();
  }

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;
    setBusy(true);
    setErr(null);
    const { data: u } = await db().auth.getUser();
    const { error } = await db().from("ticket_messages").insert({ ticket_id: ticket.id, author: "support", admin_id: u.user?.id, body: body.trim(), internal });
    if (!error && !internal) await db().from("tickets").update({ status: nextStatus }).eq("id", ticket.id);
    setBusy(false);
    if (error) return setErr(errorMessage(error));
    setBody("");
    load();
    onChange();
  }

  const link = typeof window === "undefined" ? "" : `${location.origin}/support/${ticket.access_token}`;
  const mail = `mailto:${ticket.email}?subject=${encodeURIComponent(`Re: ${ticket.subject} [#${ticket.number}]`)}&body=${encodeURIComponent(`Hoi ${ticket.name},\n\nJe kunt ons antwoord lezen en reageren via:\n${link}\n\nGroet,\nVrijStaan`)}`;

  return (
    <section className="space-y-4">
      <button onClick={onBack} className="flex items-center gap-1 font-semibold text-road lg:hidden">
        <Icon name="chevronLeft" size={18} /> Alle berichten
      </button>
      <div className="rounded-2xl bg-surface p-4 outline-1 outline-line outline">
        <p className="text-sm text-muted">#{ticket.number}, {CATEGORY[ticket.category]}, {when(ticket.created_at)}</p>
        <h2 className="mt-1 font-sign text-xl font-bold">{ticket.subject}</h2>
        <p className="mt-1 text-sm">
          {ticket.name}, <a className="font-semibold text-road underline" href={`mailto:${ticket.email}`}>{ticket.email}</a>
        </p>
        {ticket.place_id && <p className="mt-1 text-sm text-muted">Gaat over plek {ticket.place_id}</p>}
        <div className="mt-4 grid grid-cols-2 gap-2">
          <select className={input} value={ticket.status} onChange={(e) => update({ status: e.target.value })} aria-label="Status">
            {Object.entries(STATUS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
          <select className={input} value={ticket.priority} onChange={(e) => update({ priority: e.target.value })} aria-label="Prioriteit">
            <option value="laag">Lage prioriteit</option>
            <option value="normaal">Normale prioriteit</option>
            <option value="hoog">Hoge prioriteit</option>
          </select>
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          <a href={mail} className={secondary}><Icon name="mail" size={18} /> Mail de klant</a>
          <button className={secondary} onClick={() => navigator.clipboard.writeText(link)}><Icon name="share" size={18} /> Kopieer klantlink</button>
        </div>
      </div>

      <ol className="space-y-3">
        {(messages ?? []).map((m) => (
          <li
            key={m.id}
            className={`rounded-2xl p-4 ${m.internal ? "border-2 border-dashed border-signal bg-surface" : m.author === "support" ? "bg-road-tint" : "bg-surface outline-1 outline-line outline"}`}
          >
            <p className="text-sm font-semibold">
              {m.internal ? "Interne notitie" : m.author === "support" ? "Support" : ticket.name}
              <span className="ml-2 font-normal text-muted">{when(m.created_at)}</span>
            </p>
            <p className="mt-1.5 whitespace-pre-line">{m.body}</p>
          </li>
        ))}
      </ol>

      <form onSubmit={send} className="space-y-3 rounded-2xl bg-surface p-4 outline-1 outline-line outline">
        <div className="flex flex-wrap gap-2">
          {TEMPLATES.map(([label, text]) => (
            <button type="button" key={label} onClick={() => setBody(text)} className="h-9 rounded-full bg-sunken px-3 text-sm font-semibold hover:bg-road-tint">
              {label}
            </button>
          ))}
        </div>
        <label className="block">
          <span className="sr-only">Antwoord</span>
          <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={5} maxLength={5000} className={textarea} placeholder={internal ? "Notitie, alleen zichtbaar voor beheerders" : "Je antwoord aan de klant"} />
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={internal} onChange={(e) => setInternal(e.target.checked)} className="h-5 w-5 accent-[var(--road)]" />
          Interne notitie (niet zichtbaar voor de klant)
        </label>
        {!internal && (
          <label className="flex items-center gap-2 text-sm">
            Status na versturen
            <select value={nextStatus} onChange={(e) => setNextStatus(e.target.value)} className={`${input} h-10 w-auto`}>
              <option value="wacht-op-klant">Wacht op klant</option>
              <option value="in-behandeling">In behandeling</option>
              <option value="opgelost">Opgelost</option>
            </select>
          </label>
        )}
        <ErrorNote message={err} />
        <button disabled={busy || !body.trim()} className={`${primary} w-full`}>{busy ? "Versturen…" : internal ? "Notitie opslaan" : "Antwoord versturen"}</button>
        {!internal && <p className="text-sm text-muted">De klant leest je antwoord via de persoonlijke link. Stuur die link mee met &quot;Mail de klant&quot;.</p>}
      </form>
    </section>
  );
}
