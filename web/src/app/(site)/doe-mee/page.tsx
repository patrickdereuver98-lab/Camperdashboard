import type { Metadata } from "next";
import Link from "next/link";
import { OPEN_GRAPH } from "@/lib/meta";
import { getStats } from "@/lib/places";
import { Icon } from "@/components/icons";
import { Sign } from "@/components/sign";
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
      <h1 className="font-display text-3xl leading-tight font-semibold sm:text-4xl">Doe mee</h1>
      <p className="mt-3 max-w-prose text-lg text-ink-2">
        VrijStaan wordt beter met wat camperaars zelf weten. Ben je ergens geweest, of ken je een plek die hier nog niet staat?
        Vul het in. We kijken alles na voordat het online komt.
      </p>

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <a href="#vertrektijden" className="flex items-center gap-4 rounded-xl bg-surface p-4 shadow-low transition-shadow hover:shadow-raised">
          <Sign name="clock" size={44} />
          <span>
            <span className="block font-display text-lg font-semibold">Vertrektijd invullen</span>
            <span className="block text-sm text-muted">Van {nf.format(stats.unknownDeparture)} plekken weten we het nog niet</span>
          </span>
        </a>
        <Link href="/plek-aanmelden" className="flex items-center gap-4 rounded-xl bg-surface p-4 shadow-low transition-shadow hover:shadow-raised">
          <Sign name="camper" size={44} />
          <span>
            <span className="block font-display text-lg font-semibold">Plek aanmelden</span>
            <span className="block text-sm text-muted">Een camperplaats of camping die nog ontbreekt</span>
          </span>
        </Link>
      </div>

      <section id="vertrektijden" className="mt-12 scroll-mt-24">
        <h2 className="font-display text-2xl font-semibold">Weet jij hoe laat je hier weg moet?</h2>
        <p className="mt-1 text-ink-2">Kies je provincie en tik op een plek waar je bent geweest.</p>
        <HelpList />
      </section>

      <p className="mt-10 flex items-start gap-2 text-sm text-muted">
        <Icon name="info" size={17} className="mt-0.5 shrink-0" />
        Wat je invult, lezen we eerst na. Pas als het klopt, passen we de plek aan. Je naam en e-mail zijn niet nodig.
      </p>
    </div>
  );
}
