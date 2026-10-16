"use client";

import Link from "next/link";
import { useEffect } from "react";
import { Icon } from "@/components/icons";
import { reportError } from "@/lib/track";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    reportError(error.message, { digest: error.digest, path: location.pathname });
  }, [error]);

  return (
    <main className="mx-auto w-full max-w-md px-4 pt-10 pb-16">
      <div className="rounded-xl bg-alert-tint p-6">
        <Icon name="alert" size={28} className="text-alert" />
        <h1 className="mt-3 font-display text-2xl font-semibold">Er ging iets mis</h1>
        <p className="mt-2 text-ink-2">
          Deze pagina laadde niet. We krijgen automatisch een melding van de fout. Probeer het nog een keer.
        </p>
      </div>
      <div className="mt-6 grid gap-3">
        <button onClick={reset} className="flex h-14 items-center justify-center gap-2 rounded-lg bg-forest font-semibold text-on-forest">
          <Icon name="refresh" size={20} /> Opnieuw proberen
        </button>
        <Link href="/" className="flex h-14 items-center justify-center rounded-lg border border-line bg-surface font-semibold">
          Naar de startpagina
        </Link>
      </div>
    </main>
  );
}
