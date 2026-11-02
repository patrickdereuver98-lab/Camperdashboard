import type { Metadata } from "next";
import { Suspense } from "react";
import { ProsePage } from "@/components/prose";
import { COMPANY } from "@/lib/company";
import { isToken } from "@/lib/outreach";

export const metadata: Metadata = {
  title: "Afmelden voor mail",
  description: "Geen mail meer van VrijStaan.",
  robots: { index: false, follow: false },
};

export default function UnsubscribePage({ params }: PageProps<"/afmelden/[token]">) {
  return (
    <Suspense fallback={<p className="px-4 pt-12 text-center text-muted">Laden…</p>}>
      <UnsubscribeView params={params} />
    </Suspense>
  );
}

async function UnsubscribeView({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return (
    <ProsePage title="Geen mail meer van VrijStaan?">
      <p>We vroegen je naar de aankomst- en vertrektijd van je plek. Met de knop hieronder sturen we dit e-mailadres niets meer.</p>
      {isToken(token) ? (
        <form method="post" action={`/api/afmelden/${token}?terug=1`}>
          <button
            type="submit"
            className="inline-flex h-11 items-center rounded-md border border-line px-4 font-semibold hover:border-forest"
          >
            Geen mail meer
          </button>
        </form>
      ) : (
        <p>
          Deze link werkt niet. Mail naar <a href={`mailto:${COMPANY.email}`}>{COMPANY.email}</a>, dan melden wij je af.
        </p>
      )}
    </ProsePage>
  );
}
