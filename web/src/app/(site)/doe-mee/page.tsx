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
      <h1 className="font-display text-h1 font-semibold">Doe mee</h1>
      <p className="mt-2 max-w-prose text-ink-2">
        VrijStaan wordt beter met wat camperaars zelf weten. We kijken alles na voordat het online komt.
      </p>

      {/* UI/UX-plan T34 (26 november 2026): eerst de twee acties als één lijst, dan de plekken, dan eigenaren */}
      <ul className="mt-5 divide-y divide-line overflow-hidden rounded-lg border border-line bg-surface">
        <li>
          <a href="#vertrektijden" className="flex min-h-16 items-center gap-3 px-4 py-3 hover:bg-sunken/50">
            <Icon name="clock" size={22} className="shrink-0 text-forest" />
            <span className="min-w-0 flex-1">
              <span className="block font-semibold text-ink">Vertrektijd doorgeven</span>
              <span className="block text-sm text-muted">Van {nf.format(stats.unknownDeparture)} plekken weten we het nog niet</span>
            </span>
            <Icon name="chevronRight" size={20} className="shrink-0 text-muted" />
          </a>
        </li>
        <li>
          <Link href="/plek-aanmelden" className="flex min-h-16 items-center gap-3 px-4 py-3 hover:bg-sunken/50">
            <Icon name="plus" size={22} className="shrink-0 text-forest" />
            <span className="min-w-0 flex-1">
              <span className="block font-semibold text-ink">Plek aanmelden</span>
              <span className="block text-sm text-muted">Een camperplaats of camping die nog ontbreekt</span>
            </span>
            <Icon name="chevronRight" size={20} className="shrink-0 text-muted" />
          </Link>
        </li>
      </ul>

      <section id="vertrektijden" className="mt-8 scroll-mt-24 sm:mt-12">
        <h2 className="font-display text-h2 font-semibold">Waar kun je mee helpen?</h2>
        <p className="mt-1 text-ink-2">Kies je provincie en tik op een plek waar je bent geweest.</p>
        <HelpList />
      </section>

      <section aria-labelledby="eigenaar" className="mt-8 border-t border-line pt-6 sm:mt-12">
        <h2 id="eigenaar" className="font-display text-h2 font-semibold">Heb je zelf een camperplaats of camping?</h2>
        <p className="mt-1 text-ink-2">
          Zoek je plek op en tik daar op de knop voor eigenaren. Dan vul je de vertrektijd, de prijs en de rest zelf in. We
          kijken het na en zetten het daarna op de site.
        </p>
        <Link href="/zoeken" className="mt-2 inline-flex h-11 items-center gap-2 font-semibold text-forest underline underline-offset-2">
          <Icon name="search" size={18} /> Zoek je plek
        </Link>
      </section>

      <p className="mt-10 flex items-start gap-2 text-sm text-muted">
        <Icon name="info" size={17} className="mt-0.5 shrink-0" />
        Wat je invult, lezen we eerst na. Pas als het klopt, passen we de plek aan. Je naam en e-mail zijn niet nodig.
      </p>
    </div>
  );
}
