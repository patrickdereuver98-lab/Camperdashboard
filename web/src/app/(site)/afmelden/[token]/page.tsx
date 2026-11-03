import type { Metadata } from "next";
import { Suspense } from "react";
import { ProsePage } from "@/components/prose";
import { COMPANY } from "@/lib/company";
import { isToken } from "@/lib/outreach";

export const metadata: Metadata = {
  title: "Afmelden voor mail",
  description: "Geen mail meer van VrijStaan, of liever niet op de site.",
  robots: { index: false, follow: false },
};

export default function UnsubscribePage({ params }: PageProps<"/afmelden/[token]">) {
  return (
    <Suspense fallback={<p className="px-4 pt-12 text-center text-muted">Laden…</p>}>
      <UnsubscribeView params={params} />
    </Suspense>
  );
}

const BUTTON = "inline-flex h-11 items-center rounded-md border border-line px-4 font-semibold hover:border-forest";

async function UnsubscribeView({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return (
    <ProsePage title="Geen mail meer van VrijStaan?">
      <p>
        Ik vroeg je naar de gegevens van je plek, voor een gratis gids voor camperaars. Kies wat je wilt. Je krijgt hierna geen
        mail meer van mij.
      </p>
      {isToken(token) ? (
        <div className="flex flex-col gap-3 sm:flex-row">
          <form method="post" action={`/api/afmelden/${token}?terug=1`}>
            <button type="submit" className={BUTTON}>
              Geen mail meer
            </button>
          </form>
          <form method="post" action={`/api/afmelden/${token}?terug=1&verwijder=1`}>
            <button type="submit" className={BUTTON}>
              Geen mail meer en haal mijn plek van de site
            </button>
          </form>
        </div>
      ) : (
        <p>
          Deze link werkt niet. Mail naar <a href={`mailto:${COMPANY.email}`}>{COMPANY.email}</a>, dan regel ik het.
        </p>
      )}
    </ProsePage>
  );
}
