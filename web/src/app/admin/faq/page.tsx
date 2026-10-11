"use client";

import { useState } from "react";
import { errorMessage } from "@/lib/supabase-browser";
import { Badge, Card, ErrorNote, PageTitle, db, danger, input, primary, secondary, textarea, useQuery } from "../ui";

type Faq = { id: string; category: string; question: string; answer: string; position: number; published: boolean };
const EMPTY: Omit<Faq, "id"> = { category: "Algemeen", question: "", answer: "", position: 100, published: true };

export default function FaqAdmin() {
  const { data, error, reload } = useQuery(() => db().from("faq").select("*").order("category").order("position"), []);
  const rows = (data as Faq[] | null) ?? [];
  const [editing, setEditing] = useState<Partial<Faq> | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const categories = [...new Set(rows.map((r) => r.category))];

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!editing) return;
    const { id, ...fields } = editing;
    const { error } = id ? await db().from("faq").update(fields).eq("id", id) : await db().from("faq").insert(fields);
    if (error) return setErr(errorMessage(error));
    setEditing(null);
    setErr(null);
    reload();
  }
  async function remove(id: string) {
    if (!confirm("Deze vraag verwijderen?")) return;
    const { error } = await db().from("faq").delete().eq("id", id);
    if (error) setErr(errorMessage(error));
    else reload();
  }

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <PageTitle title="Veelgestelde vragen">
        <button className={primary} onClick={() => setEditing({ ...EMPTY })}>Nieuwe vraag</button>
      </PageTitle>
      <ErrorNote message={error ?? err} />
      {editing && (
        <Card>
          <form onSubmit={save} className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-[1fr_7rem]">
              <label className="block">
                <span className="mb-1 block text-sm font-semibold">Categorie</span>
                <input list="faq-cats" required className={input} value={editing.category ?? ""} onChange={(e) => setEditing({ ...editing, category: e.target.value })} />
                <datalist id="faq-cats">{categories.map((c) => <option key={c} value={c} />)}</datalist>
              </label>
              <label className="block">
                <span className="mb-1 block text-sm font-semibold">Volgorde</span>
                <input type="number" className={input} value={editing.position ?? 100} onChange={(e) => setEditing({ ...editing, position: Number(e.target.value) })} />
              </label>
            </div>
            <label className="block">
              <span className="mb-1 block text-sm font-semibold">Vraag</span>
              <input required className={input} value={editing.question ?? ""} onChange={(e) => setEditing({ ...editing, question: e.target.value })} />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-semibold">Antwoord</span>
              <textarea required rows={5} className={textarea} value={editing.answer ?? ""} onChange={(e) => setEditing({ ...editing, answer: e.target.value })} />
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" className="h-5 w-5 accent-[var(--forest)]" checked={editing.published ?? true} onChange={(e) => setEditing({ ...editing, published: e.target.checked })} />
              Zichtbaar op de site
            </label>
            <div className="flex gap-2">
              <button className={primary}>Opslaan</button>
              <button type="button" className={secondary} onClick={() => setEditing(null)}>Annuleren</button>
            </div>
          </form>
        </Card>
      )}
      {categories.map((c) => (
        <section key={c} className="space-y-2">
          <h2 className="font-display text-lg font-semibold">{c}</h2>
          <ul className="divide-y divide-line overflow-hidden rounded-2xl bg-surface outline-1 outline-line outline">
            {rows.filter((r) => r.category === c).map((r) => (
              <li key={r.id} className="flex items-start gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{r.question}</p>
                  <p className="line-clamp-2 text-sm text-muted">{r.answer}</p>
                  {!r.published && <Badge>Verborgen</Badge>}
                </div>
                <button className={secondary} onClick={() => setEditing(r)}>Bewerken</button>
                <button className={danger} aria-label="Verwijderen" onClick={() => remove(r.id)}>✕</button>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
