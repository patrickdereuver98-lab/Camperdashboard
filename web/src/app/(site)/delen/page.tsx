import type { Metadata } from "next";
import { Suspense } from "react";
import { SharedIn } from "./shared-in";

export const metadata: Metadata = { title: "Gedeeld met VrijStaan", robots: { index: false } };

/** Doel van "Delen" vanuit een andere app (share target in het manifest, alleen Android en computer) */
export default function SharePage() {
  return (
    <div className="mx-auto max-w-md px-4 pt-10 pb-16 sm:px-6">
      <h1 className="font-display text-h1 font-semibold">Plekken in de buurt</h1>
      <Suspense fallback={<p className="mt-3 text-muted">Laden…</p>}>
        <SharedIn />
      </Suspense>
    </div>
  );
}
