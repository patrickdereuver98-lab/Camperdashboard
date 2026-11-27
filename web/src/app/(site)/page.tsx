import Link from "next/link";
import { getStats, getSummaries } from "@/lib/places";
import { departureKind, searchHref } from "@/lib/search";
import { pluralize } from "@/lib/format";
import { PROVINCES, type PlaceSummary } from "@/lib/types";
import { HomeSearch } from "@/components/home-search";
import { Icon } from "@/components/icons";
import { Sign, type SignName } from "@/components/sign";
import { CreditedPhoto, PlaceCard } from "@/components/place-ui";
import { CARD_CELL, CARD_GRID } from "@/lib/card-grid";
import { looksLikeGraphic } from "@/lib/photos";
import { Onboarding } from "@/components/deferred";
import { InstallTip } from "@/components/install-tip";

const nf = new Intl.NumberFormat("nl-NL");
// Vaste donkere bostint voor tekst op het landschap, in licht én donker thema
const TONE_TEXT = { forest: "text-forest", lake: "text-lake", neutral: "text-ink" } as const;

export default async function Home() {
  const [stats, places] = await Promise.all([getStats(), getSummaries()]);

  // Uitgelicht: eerst plekken zonder vaste vertrektijd, dan foto, score en de meeste informatie
  const free = (p: PlaceSummary) => (departureKind(p) === "vrij" ? 1 : 0);
  const featured = [...places]
    .sort(
      (a, b) =>
        free(b) - free(a) ||
        Number(!!b.imageUrl) - Number(!!a.imageUrl) ||
        (b.ratingAvg ?? 0) - (a.ratingAvg ?? 0) ||
        b.completeness - a.completeness,
    )
    .slice(0, 6);

  // Populaire bestemmingen: provincies met de meeste plekken, met een echte foto van een plek daar
  // Drie kandidaten per provincie: laadt de eerste niet, dan de volgende. Niet de foto's van "Uitgelicht" hieronder, zodat
  // dezelfde foto niet twee keer op de start staat (design-audit 26 november 2026).
  const featuredPhotos = new Set(featured.map((p) => p.imageUrl));
  const coversOf = (prov: string) =>
    places
      .filter((p) => p.province === prov && p.imageUrl && !looksLikeGraphic(p.imageUrl) && !featuredPhotos.has(p.imageUrl))
      .sort((a, b) => b.completeness - a.completeness || (b.ratingAvg ?? 0) - (a.ratingAvg ?? 0))
      .slice(0, 3)
      .map((p) => ({ src: p.imageUrl!, credit: p.imageCredit }));
  const provinces = [...PROVINCES].sort((a, b) => (stats.byProvince[b] ?? 0) - (stats.byProvince[a] ?? 0));
  const destinations = provinces.slice(0, 6).map((prov) => ({ prov, count: stats.byProvince[prov] ?? 0, covers: coversOf(prov) }));

  // Kleur betekent iets (stijlgids §3, review R53): groen = geen vaste vertrektijd, blauw = uitslapers, "Alle" is neutraal
  const ways: { href: string; title: string; text: string; count: number; sign: SignName; tone: "forest" | "lake" | "neutral" }[] = [
    {
      href: searchHref({ departure: "vrij" }),
      title: "Zonder vertrektijd",
      text: "Blijf zolang je wilt, of betaal per 24 uur.",
      count: stats.freeDeparture,
      sign: "clock",
      tone: "forest",
    },
    {
      href: searchHref({ departure: "uitslapers" }),
      title: "Voor uitslapers",
      text: "Vertrek om 12:00 of later.",
      count: stats.lateCheckout,
      sign: "clock",
      tone: "lake",
    },
    {
      href: "/zoeken",
      title: "Alle camperplaatsen",
      text: "Ook plekken waarvan we de vertrektijd nog niet weten.",
      count: stats.total,
      sign: "camper",
      tone: "neutral",
    },
  ];

  const facilities: { href: string; sign: SignName; label: string; count: number }[] = [
    { href: searchHref({ openNow: true }), sign: "calendar", label: "Nu open", count: stats.openNow },
    { href: searchHref({ facilities: ["power"] }), sign: "power", label: "Met stroom", count: stats.power },
    { href: searchHref({ facilities: ["dumpStation"] }), sign: "dump", label: "Lozen mogelijk", count: stats.dump },
    { href: searchHref({ facilities: ["dogs"] }), sign: "dog", label: "Honden welkom", count: stats.dogs },
  ];

  return (
    <>
      <Onboarding />
      {/* Kop: één vraag, daaronder de hoofdactie (dichtbij) en het zoekveld (docs/specs/04-ui-ux-brief.md) */}
      <section className="mx-auto w-full max-w-6xl px-4 pt-6 sm:px-6 sm:pt-10">
        <h1 className="animate-rise font-display text-h1 font-semibold text-ink">
          Waar sta je vannacht?
        </h1>
        {/* UI/UX-plan T2 (26 november 2026): de belofte in één zin; de aantallen staan bij "Hoe wil je staan?" */}
        {/* Op één regel vanaf sm (Patrick, 27 november 2026): "moet vertrekken" niet los op een tweede regel */}
        <p className="animate-rise mt-2 text-pretty text-ink-2 [animation-delay:60ms] sm:text-lg">
          Zoek een camperplaats voor vannacht. Zie meteen wanneer je moet vertrekken.
        </p>
        {/* relative z-20: de animatie maakt een eigen stapellaag; zonder z-index lag alles eronder over de uitklaplijst */}
        <div className="animate-rise relative z-20 mt-4 [animation-delay:120ms] sm:mt-6">
          <HomeSearch />
        </div>
      </section>
      <InstallTip />

      {/* Hoe wil je staan: het antwoord op de vraag in de kop, direct eronder (concept "Eén vraag") */}
      <section aria-labelledby="hoe" className="mx-auto w-full max-w-6xl px-4 pt-8 sm:px-6 sm:pt-12">
        <h2 id="hoe" className="font-display text-h2 font-semibold">Hoe wil je staan?</h2>
        <ul className="mt-3 divide-y divide-line overflow-hidden rounded-lg border border-line bg-surface sm:grid sm:grid-cols-3 sm:divide-x sm:divide-y-0">
          {ways.map((w) => (
            <li key={w.title}>
              <Link href={w.href} className="group flex h-full min-h-19 items-center gap-3.5 px-3.5 py-3 hover:bg-sunken/50 sm:flex-col sm:items-start sm:gap-2 sm:px-5 sm:py-4">
                {/* Lijnicoon zonder vlak (stijlgids §2). Telefoon: links in de rij; vanaf sm klein rechts naast de titel, zodat
                    het blok lager wordt (Patrick, 27 november 2026). Geen absolute positie: die legde de blokken over de
                    uitklaplijst van het zoekvak */}
                <Sign name={w.sign} size={24} bare className={`sm:hidden ${TONE_TEXT[w.tone]}`} />
                <span className="min-w-0 flex-1 sm:w-full">
                  <span className="flex items-start justify-between gap-2">
                    <span className="block font-semibold">{w.title}</span>
                    <Sign name={w.sign} size={22} bare className={`mt-0.5 hidden sm:block ${TONE_TEXT[w.tone]}`} />
                  </span>
                  <span className="mt-0.5 block text-sm text-ink-2">{w.text}</span>
                </span>
                <span className={`shrink-0 font-semibold tabular-nums sm:hidden ${TONE_TEXT[w.tone]}`}>{nf.format(w.count)}</span>
                <span className={`hidden text-sm font-semibold tabular-nums sm:block ${TONE_TEXT[w.tone]}`}>
                  {pluralize(w.count, "plek", "plekken")}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {/* Populaire bestemmingen met echte foto's */}
      <section className="mx-auto max-w-6xl px-4 pt-8 sm:px-6 sm:pt-12">
        <h2 className="font-display text-h2 font-semibold">Populaire bestemmingen</h2>
        <p className="mt-0.5 text-ink-2">Hier staan de meeste plekken.</p>
        <ul className="mt-3 grid grid-cols-2 gap-2.5 sm:mt-4 sm:gap-3 lg:grid-cols-12">
          {destinations.map((d, i) => (
            <li key={d.prov} className={i < 2 ? "col-span-2 sm:col-span-1 lg:col-span-6" : "lg:col-span-3"}>
              <Link
                href={`/camperplaatsen/${d.prov.toLowerCase()}`}
                className={`group relative block overflow-hidden rounded-lg border border-line bg-sunken ${i < 2 ? "h-36 sm:h-56 lg:h-64" : "h-28 sm:h-44"}`}
              >
                <CreditedPhoto
                  photos={d.covers}
                  alt={`Camperplaatsen in ${d.prov}`}
                  title={d.prov}
                  subtitle={`${nf.format(d.count)} plekken`}
                  className="absolute inset-0 h-full w-full transition-transform duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-[1.03]"
                />
              </Link>
            </li>
          ))}
        </ul>
        <ul className="mt-3 flex flex-wrap gap-2">
          {provinces.slice(6).map((prov) => (
            <li key={prov}>
              <Link
                href={`/camperplaatsen/${prov.toLowerCase()}`}
                className="flex h-11 items-center gap-1.5 rounded-md border border-line bg-surface px-3.5 font-semibold hover:border-forest"
              >
                {prov} <span className="font-normal text-muted">{nf.format(stats.byProvince[prov] ?? 0)}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {/* Uitgelicht */}
      {featured.length > 0 && (
        <section className="mx-auto max-w-6xl px-4 pt-8 sm:px-6 sm:pt-12">
          <div className="mb-3 flex flex-wrap items-end justify-between gap-x-4">
            <h2 className="font-display text-h2 font-semibold">
              {stats.freeDeparture > 0 ? "Vertrekken wanneer je wilt" : "Meest complete informatie"}
            </h2>
            <Link href={stats.freeDeparture > 0 ? searchHref({ departure: "vrij" }) : "/zoeken"} className="flex h-11 shrink-0 items-center gap-1 font-semibold whitespace-nowrap text-forest hover:underline">
              Bekijk alle <Icon name="chevronRight" size={18} />
            </Link>
          </div>
          <ul className={`${CARD_GRID} -mx-3 scroll-px-3 px-3 sm:mx-0 sm:px-0`}>
            {featured.map((p) => (
              <li key={p.id} className={CARD_CELL}>
                <PlaceCard place={p} layout="stack" />
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Zoeken op voorziening */}
      <section className="mx-auto max-w-6xl px-4 pt-8 sm:px-6 sm:pt-12">
        <h2 className="font-display text-h2 font-semibold">Zoek op wat je nodig hebt</h2>
        <ul className="mt-3 grid grid-cols-2 gap-2.5 sm:mt-4 sm:gap-3 lg:grid-cols-4">
          {facilities
            .filter((f) => f.count > 0)
            .map((f) => (
              <li key={f.label}>
                <Link
                  href={f.href}
                  className="flex h-full min-h-16 items-center gap-2.5 rounded-lg border border-line bg-surface p-3 hover:border-forest sm:min-h-20 sm:gap-3 sm:p-4"
                >
                  <Sign name={f.sign} size={30} bare className="text-forest" />
                  <span className="min-w-0">
                    <span className="block font-semibold leading-tight">{f.label}</span>
                    <span className="block text-sm text-muted">{nf.format(f.count)} plekken</span>
                  </span>
                </Link>
              </li>
            ))}
        </ul>
      </section>

      {/* Zo werkt het */}
      <section className="mx-auto max-w-6xl px-4 pt-8 sm:px-6 sm:pt-12">
        <h2 className="font-display text-h2 font-semibold">Zo werkt VrijStaan</h2>
        <ol className="mt-3 grid gap-4 md:mt-5 md:grid-cols-3 md:gap-8">
          {([
            {
              sign: "pin",
              title: "Zoek een plek",
              text: "Typ een plaats, streek of eiland. Of kijk wat er bij jou in de buurt is.",
            },
            {
              sign: "clock",
              title: "Kijk wanneer je weg moet",
              text: "Bij elke plek zie je of we de vertrektijd kennen en welke, wat een nacht kost met de toeslagen die we kennen, en wat er aan voorzieningen is.",
            },
            {
              sign: "camper",
              title: "Rij erheen",
              text: "Je ziet hoe lang je nog moet rijden. Met één tik open je de route in je eigen navigatie.",
            },
          ] satisfies { sign: SignName; title: string; text: string }[]).map((s, i) => (
            <li key={s.title} className="flex gap-3 border-t border-line pt-4 md:flex-col md:gap-3 md:pt-5">
              <Sign name={s.sign} size={28} bare className="text-forest" />
              <div>
                <h3 className="font-display text-h3 font-semibold">
                  <span className="mr-1.5 text-muted tabular-nums">{i + 1}.</span>
                  {s.title}
                </h3>
                <p className="mt-0.5 text-ink-2">{s.text}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {/* Eigenaren */}
      <section className="mx-auto max-w-6xl px-4 pt-8 sm:px-6 sm:pt-12">
        <div className="relative overflow-hidden rounded-lg border border-line bg-surface">
          <div className="relative flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:p-8">
            <div>
              <h2 className="font-display text-h2 font-semibold">Heb je een camperplaats?</h2>
              <p className="mt-1 max-w-xl text-ink-2">
                Meld je plek aan of vul de gegevens aan, zoals je vertrektijd en tarieven. Aanmelden is gratis.
              </p>
            </div>
            <div className="flex shrink-0 flex-col gap-1 sm:items-end">
              <Link
                href="/plek-aanmelden?soort=eigenaar"
                className="flex h-12 items-center justify-center rounded-md bg-forest px-6 font-semibold text-on-forest hover:bg-forest-deep"
              >
                Plek aanmelden
              </Link>
              <Link href="/doe-mee" className="flex h-11 items-center justify-center font-semibold text-forest hover:underline">
                Weet je een vertrektijd? Doe mee
              </Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
