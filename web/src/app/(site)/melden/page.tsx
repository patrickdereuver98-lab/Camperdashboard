import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ReportForm } from "./report-form";

export const metadata: Metadata = {
  title: "Meld inhoud",
  description: "Meld illegale of onjuiste inhoud op VrijStaan, zoals een review, foto of gegevens van een plek.",
};

export default function ReportPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 pt-8 sm:px-6">
      <h1 className="font-display text-3xl font-semibold sm:text-4xl">Meld illegale of onjuiste inhoud</h1>
      <p className="mt-3 text-lg text-ink-2">
        Zie je op VrijStaan een review, foto of tekst die volgens jou illegaal is, inbreuk maakt op je rechten of niet klopt,
        meld het dan hier. We bekijken elke melding.
      </p>
      <ul className="mt-4 list-disc space-y-1 pl-5 text-ink-2">
        <li>
          Klopt alleen een prijs, voorziening of openingstijd niet, gebruik dan de knop &quot;Klopt er iets niet?&quot; op de
          pagina van de plek. Dat gaat sneller.
        </li>
        <li>
          In de <Link href="/privacy" className="font-semibold text-forest underline">privacyverklaring</Link> lees je hoe je
          je eigen gegevens inziet of laat verwijderen.
        </li>
        <li>
          Hoe we reviews controleren, lees je op{" "}
          <Link href="/reviews-en-ranking" className="font-semibold text-forest underline">Reviews en ranking</Link>.
        </li>
      </ul>
      <Suspense>
        <ReportForm />
      </Suspense>
      <p className="mt-6 text-sm text-muted">
        Laatste update: 11 oktober 2026. Meer over hoe we met meldingen omgaan staat in de{" "}
        <Link href="/voorwaarden" className="underline">gebruiksvoorwaarden</Link>.
      </p>
    </div>
  );
}
