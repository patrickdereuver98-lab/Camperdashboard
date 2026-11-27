import type { Metadata } from "next";
import Link from "next/link";
import { OPEN_GRAPH } from "@/lib/meta";
import { getStats } from "@/lib/places";
import { Icon } from "@/components/icons";
import { HelpList } from "./help-list";

export const metadata: Metadata = {
  title: "Doe mee",
  description: "Weet jij hoe laat je ergens weg moet, of ken je een camperplaats die nog ontbreekt? Vul het in, dan klopt de gids voor iedereen.",
  alternates: { canonical: "/doe-mee" },
  openGraph: {
    ...OPEN_GRAPH,
    title: "Weet jij hoe laat je hier weg moet?",
    description: "Help andere camperaars: vul de vertrektijd in van plekken waar je bent geweest, of meld een plek die nog ontbreekt.",
  },
};

const nf = new Intl.NumberFormat("nl-NL");

export default async function HelpPage() {
  const stats = await getStats();
  return (
    <div className="mx-auto max-w-3xl px-4 pt-6 pb-16 sm:px-6 sm:pt-10">
      <h1 className="font-display text-h1 font-semibold">Ken je een plek of weet je iets dat niet klopt?</h1>
      <p className="mt-2 max-w-prose text-ink-2">
        Dan help je andere camperaars. We kijken alles na voordat het online komt. Je naam en e-mail zijn niet nodig.
      </p>

      {/* G2 (27 november 2026): één primaire actie (plek zoeken, want de meeste plekken staan er al) en één secundaire */}
      <section aria-labelledby="verbeteren" className="mt-6 rounded-lg border border-line bg-surface p-4 sm:p-5">
        <h2 id="verbeteren" className="font-display text-h2 font-semibold">Een plek verbeteren</h2>
        <p className="mt-1 text-ink-2">Zoek de plek op, open hem en kies onderaan &ldquo;Gegevens corrigeren of aanvullen&rdquo;.</p>
        <Link href="/zoeken" className="mt-4 flex h-12 items-center justify-center gap-2 rounded-lg bg-forest font-semibold text-on-forest hover:bg-forest-deep sm:inline-flex sm:px-6">
          <Icon name="search" size={18} /> Plek zoeken
        </Link>
      </section>

      <p className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-1 text-ink-2">
        Staat de plek er niet bij?
        <Link href="/plek-aanmelden" className="inline-flex h-11 items-center gap-1.5 font-semibold text-forest underline underline-offset-2">
          <Icon name="plus" size={18} /> Plek aanmelden
        </Link>
      </p>

      <section id="vertrektijden" className="mt-8 scroll-mt-24 sm:mt-12">
        <h2 className="font-display text-h2 font-semibold">Weet je een vertrektijd?</h2>
        <p className="mt-1 text-ink-2">
          Van {nf.format(stats.unknownDeparture)} plekken weten we nog niet hoe laat je weg moet. Kies je provincie en tik op een plek waar
          je bent geweest.
        </p>
        <HelpList />
      </section>

      <section aria-labelledby="eigenaar" className="mt-8 border-t border-line pt-6 sm:mt-12">
        <h2 id="eigenaar" className="font-display text-h2 font-semibold">Heb je zelf een camperplaats of camping?</h2>
        <p className="mt-1 text-ink-2">
          Meld je plek aan, of zoek hem op en tik daar op de knop voor eigenaren. Dan vul je de vertrektijd, de prijs en de rest zelf in.
        </p>
        <Link href="/plek-aanmelden?soort=eigenaar" className="mt-2 inline-flex h-11 items-center gap-2 font-semibold text-forest underline underline-offset-2">
          <Icon name="plus" size={18} /> Meld je plek als eigenaar
        </Link>
      </section>
    </div>
  );
}
