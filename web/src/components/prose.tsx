import type { ReactNode } from "react";

/** Leesbare tekstpagina (juridisch, over ons, hulp) */
export function ProsePage({ title, intro, updated, children }: { title: string; intro?: string; updated?: string; children: ReactNode }) {
  return (
    <article className="mx-auto max-w-2xl px-4 pt-8 pb-4 sm:px-6">
      <h1 className="font-display text-3xl font-semibold sm:text-4xl">{title}</h1>
      {intro && <p className="mt-3 text-lg text-ink-2">{intro}</p>}
      {updated && <p className="mt-2 text-sm text-muted">Laatste update: {updated}</p>}
      <div className="prose-vs mt-8 space-y-6">{children}</div>
    </article>
  );
}

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="font-display text-xl font-semibold">{title}</h2>
      <div className="space-y-3 text-ink-2 [&_a]:font-semibold [&_a]:text-forest [&_a]:underline [&_li]:ml-5 [&_li]:list-disc [&_ul]:space-y-1">
        {children}
      </div>
    </section>
  );
}
