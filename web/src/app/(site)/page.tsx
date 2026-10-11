import Link from "next/link";
import { getPlaces, getStats } from "@/lib/places";
import { searchHref } from "@/lib/search";
import { PROVINCES } from "@/lib/types";
import { DestinationSearch } from "@/components/destination-search";
import { Icon } from "@/components/icons";
import { Landscape } from "@/components/landscape";
import { Sign, type SignName } from "@/components/sign";
import { PlaceCard } from "@/components/place-ui";
import { toSummary } from "@/lib/places";

const nf = new Intl.NumberFormat("nl-NL");

export default async function Home() {
  const [stats, places] = await Promise.all([getStats(), getPlaces()]);

  // Uitgelicht: eerst plekken zonder vaste vertrektijd, dan foto, score en de meeste informatie
  const free = (p: (typeof places)[number]) => (p.departure === "vrij" || p.departure === "per24" ? 1 : 0);
  const featured = [...places]
    .sort(
      (a, b) =>
        free(b) - free(a) ||
        Number(!!b.imageUrl) - Number(!!a.imageUrl) ||
        (b.ratingAvg ?? 0) - (a.ratingAvg ?? 0) ||
        b.completeness - a.completeness,
    )
    .slice(0, 6)
    .map(toSummary);

  const quick: { href: string; sign: SignName; label: string; count: number }[] = [
    { href: searchHref({ noFixedDeparture: true }), sign: "clock", label: "Geen vaste vertrektijd", count: stats.freeDeparture },
    { href: searchHref({ openNow: true }), sign: "calendar", label: "Nu open", count: stats.openNow },
    { href: searchHref({ facilities: ["power"] }), sign: "power", label: "Met stroom", count: stats.power },
    { href: searchHref({ facilities: ["dumpStation"] }), sign: "dump", label: "Lozen mogelijk", count: stats.dump },
    { href: searchHref({ facilities: ["dogs"] }), sign: "dog", label: "Honden welkom", count: stats.dogs },
  ];
  const quickShown = quick.filter((q) => q.count > 0);

  return (
    <>
      {/* Kop met landschap */}
      <section className="mx-auto max-w-6xl px-3 pt-3 sm:px-6 sm:pt-8">
        <div className="animate-rise overflow-hidden rounded-[1.75rem] bg-surface shadow-lift outline-1 outline-line outline lg:grid lg:grid-cols-[1.1fr_1fr]">
          <div className="relative h-32 sm:h-48 lg:order-2 lg:h-auto">
            <Landscape seed="vrijstaan-avond" variant={2} water van wide className="absolute inset-0 h-full w-full" />
          </div>
          <div className="grain p-5 sm:p-8 lg:p-10">
            <h1 className="font-display text-[2.3rem] leading-[1.04] font-semibold sm:text-5xl lg:text-[3.6rem]">
              Waar sta je <span className="text-forest italic">vannacht?</span>
            </h1>
            <p className="mt-2 max-w-xl text-ink-2 sm:mt-3 sm:text-lg">
              {nf.format(stats.total)} camperplaatsen in Nederland, alleen met echte gegevens.
            </p>
            <div className="mt-5">
              <DestinationSearch />
              <Link
                href="/dichtbij"
                className="mt-3 flex h-12 items-center justify-center gap-2 rounded-xl border-2 border-line font-semibold text-forest transition-colors hover:border-forest"
              >
                <Icon name="locate" size={20} /> Plekken dichtbij mij
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Snelle ingangen */}
      <section aria-label="Snel zoeken" className="mx-auto max-w-6xl px-3 pt-4 sm:px-6">
        <ul className="no-scrollbar -mx-3 flex gap-2 overflow-x-auto px-3 pb-1 sm:mx-0 sm:grid sm:grid-cols-3 sm:px-0 lg:grid-cols-5">
          {quickShown.map((q) => (
            <li key={q.label} className="shrink-0">
              <Link
                href={q.href}
                className="flex h-16 items-center gap-3 rounded-2xl bg-surface pr-5 pl-3 outline-1 outline-line outline transition-colors hover:outline-forest"
              >
                <Sign name={q.sign} size={38} />
                <span>
                  <span className="block font-semibold leading-tight whitespace-nowrap">{q.label}</span>
                  <span className="block text-sm text-muted">{nf.format(q.count)} plekken</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {/* Uitgelicht */}
      {featured.length > 0 && (
        <section className="mx-auto max-w-6xl px-3 pt-12 sm:px-6">
          <div className="mb-4 flex items-end justify-between gap-4">
            <h2 className="font-display text-2xl font-semibold sm:text-3xl">
              {stats.freeDeparture > 0 ? "Vertrekken wanneer je wilt" : "Meest complete informatie"}
            </h2>
            <Link href={stats.freeDeparture > 0 ? searchHref({ noFixedDeparture: true }) : "/zoeken"} className="flex h-11 shrink-0 items-center gap-1 font-semibold whitespace-nowrap text-forest hover:underline">
              Alle plekken <Icon name="chevronRight" size={18} />
            </Link>
          </div>
          <ul className="no-scrollbar -mx-3 flex snap-x snap-mandatory gap-3 overflow-x-auto px-3 pb-2 sm:mx-0 sm:grid sm:grid-cols-2 sm:px-0 lg:grid-cols-3">
            {featured.map((p) => (
              <li key={p.id} className="w-[82vw] max-w-sm shrink-0 snap-start sm:w-auto sm:max-w-none">
                <PlaceCard place={p} layout="stack" />
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Provincies */}
      <section className="mx-auto max-w-6xl px-3 pt-12 sm:px-6">
        <h2 className="font-display text-2xl font-semibold sm:text-3xl">Per provincie</h2>
        <ul className="mt-4 grid grid-cols-1 overflow-hidden rounded-2xl bg-surface outline-1 outline-line outline sm:grid-cols-2 lg:grid-cols-3">
          {[...PROVINCES]
            .sort((a, b) => (stats.byProvince[b] ?? 0) - (stats.byProvince[a] ?? 0))
            .map((prov) => (
              <li key={prov} className="border-b border-line sm:odd:border-r lg:border-r lg:[&:nth-child(3n)]:border-r-0">
                <Link href={`/camperplaatsen/${prov.toLowerCase()}`} className="flex h-16 items-center justify-between gap-3 px-5 hover:bg-forest-tint">
                  <span className="font-semibold">{prov}</span>
                  <span className="flex items-center gap-2 text-muted">
                    {nf.format(stats.byProvince[prov] ?? 0)}
                    <Icon name="chevronRight" size={18} />
                  </span>
                </Link>
              </li>
            ))}
        </ul>
      </section>

      {/* Waarom */}
      <section className="mx-auto max-w-6xl px-3 pt-12 sm:px-6">
        <div className="grid gap-px overflow-hidden rounded-2xl bg-line outline-1 outline-line outline md:grid-cols-3">
          {[
            {
              sign: "clock" as SignName,
              title: "Weten wanneer je weg moet",
              text: "Bij elke plek staat of je kunt vertrekken wanneer je wilt, met de zin van de website als bewijs. Prijzen tonen we met alle extra kosten. Wat we niet weten, zetten we er eerlijk bij.",
            },
            {
              sign: "length" as SignName,
              title: "Echte rijtijden",
              text: "Afstanden en reistijden berekenen we over de weg, niet in een rechte lijn. Zo weet je hoe lang je nog moet rijden.",
            },
            {
              sign: "camper" as SignName,
              title: "Gemaakt voor onderweg",
              text: "Grote knoppen, duidelijke tekst en je bewaarde reis werkt ook zonder bereik. Zet VrijStaan op je beginscherm.",
            },
          ].map((b) => (
            <div key={b.title} className="bg-surface p-6">
              <Sign name={b.sign} size={44} />
              <h3 className="mt-4 font-display text-xl font-semibold">{b.title}</h3>
              <p className="mt-2 text-ink-2">{b.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Eigenaren */}
      <section className="mx-auto max-w-6xl px-3 pt-12 sm:px-6">
        <div className="flex flex-col gap-4 rounded-2xl bg-forest-tint p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8">
          <div>
            <h2 className="font-display text-2xl font-semibold text-forest">Heb je een camperplaats?</h2>
            <p className="mt-1 max-w-xl text-ink-2">
              Meld je plek aan of vul de gegevens aan. Een vermelding is gratis, en complete plekken worden vaker gevonden.
            </p>
          </div>
          <Link
            href="/plek-aanmelden?soort=eigenaar"
            className="flex h-12 shrink-0 items-center justify-center rounded-xl bg-forest px-6 font-semibold text-on-forest hover:bg-forest-deep"
          >
            Plek aanmelden
          </Link>
        </div>
      </section>
    </>
  );
}
