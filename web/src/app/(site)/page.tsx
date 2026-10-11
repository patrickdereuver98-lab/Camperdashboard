import Link from "next/link";
import { getPlaces, getStats } from "@/lib/places";
import { searchHref } from "@/lib/search";
import { PROVINCES } from "@/lib/types";
import { DestinationSearch } from "@/components/destination-search";
import { Icon } from "@/components/icons";
import { Sign, type SignName } from "@/components/sign";
import { PlaceCard } from "@/components/place-ui";
import { toSummary } from "@/lib/places";

const nf = new Intl.NumberFormat("nl-NL");

export default async function Home() {
  const [stats, places] = await Promise.all([getStats(), getPlaces()]);

  // Uitgelicht: plekken met foto, de meeste informatie en (indien aanwezig) de beste score
  const featured = places
    .filter((p) => p.imageUrl)
    .sort((a, b) => (b.ratingAvg ?? 0) - (a.ratingAvg ?? 0) || b.completeness - a.completeness)
    .slice(0, 6)
    .map(toSummary);

  const quick: { href: string; sign: SignName; label: string; count: number }[] = [
    { href: searchHref({ free: true }), sign: "euro", label: "Gratis staan", count: stats.free },
    { href: searchHref({ facilities: ["power"] }), sign: "power", label: "Met stroom", count: stats.power },
    { href: searchHref({ facilities: ["dumpStation"] }), sign: "dump", label: "Lozen mogelijk", count: stats.dump },
    { href: searchHref({ facilities: ["dogs"] }), sign: "dog", label: "Honden welkom", count: stats.dogs },
  ];

  return (
    <>
      {/* Het bord */}
      <section className="mx-auto max-w-6xl px-3 pt-4 sm:px-6 sm:pt-8">
        <div className="sign-panel animate-sign-in relative px-5 pt-7 pb-6 sm:px-10 sm:pt-10 sm:pb-10">
          <div className="grid gap-8 lg:grid-cols-[1fr_0.9fr] lg:items-end">
            <div>
              <h1 className="font-sign text-[2.1rem] leading-[1.08] font-extrabold sm:text-5xl lg:text-[3.4rem]">
                Camperplaatsen in Nederland
              </h1>
              <p className="mt-3 max-w-xl text-lg text-on-road/90 sm:text-xl">
                {nf.format(stats.total)} plekken met gecontroleerde prijs, voorzieningen en route. Kies waar je wilt staan.
              </p>
            </div>
            <div className="lg:pb-1">
              <DestinationSearch />
            </div>
          </div>
        </div>
      </section>

      {/* Snelle ingangen */}
      <section aria-label="Snel zoeken" className="mx-auto max-w-6xl px-3 pt-4 sm:px-6">
        <ul className="no-scrollbar -mx-3 flex gap-2 overflow-x-auto px-3 pb-1 sm:mx-0 sm:grid sm:grid-cols-4 sm:px-0">
          {quick.map((q) => (
            <li key={q.label} className="shrink-0">
              <Link
                href={q.href}
                className="flex h-16 items-center gap-3 rounded-2xl bg-surface pr-5 pl-3 outline-1 outline-line outline transition-colors hover:outline-road"
              >
                <Sign name={q.sign} size={38} />
                <span>
                  <span className="block font-semibold leading-tight">{q.label}</span>
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
            <h2 className="font-sign text-2xl font-bold sm:text-3xl">Volledig gecontroleerd</h2>
            <Link href="/zoeken" className="flex h-11 items-center gap-1 font-semibold text-road hover:underline">
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
        <h2 className="font-sign text-2xl font-bold sm:text-3xl">Per provincie</h2>
        <ul className="mt-4 grid grid-cols-1 overflow-hidden rounded-2xl bg-surface outline-1 outline-line outline sm:grid-cols-2 lg:grid-cols-3">
          {[...PROVINCES]
            .sort((a, b) => (stats.byProvince[b] ?? 0) - (stats.byProvince[a] ?? 0))
            .map((prov) => (
              <li key={prov} className="border-b border-line sm:odd:border-r lg:border-r lg:[&:nth-child(3n)]:border-r-0">
                <Link href={`/camperplaatsen/${prov.toLowerCase()}`} className="flex h-16 items-center justify-between gap-3 px-5 hover:bg-road-tint">
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
              sign: "reserve" as SignName,
              title: "Alleen complete plekken",
              text: "We tonen een plek pas als minstens 80% van de belangrijke informatie bekend is: prijs, voorzieningen, seizoen, contact en een foto.",
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
              <h3 className="mt-4 font-sign text-xl font-bold">{b.title}</h3>
              <p className="mt-2 text-ink-2">{b.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Eigenaren */}
      <section className="mx-auto max-w-6xl px-3 pt-12 sm:px-6">
        <div className="flex flex-col gap-4 rounded-2xl bg-road-tint p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8">
          <div>
            <h2 className="font-sign text-2xl font-bold text-road">Heb je een camperplaats?</h2>
            <p className="mt-1 max-w-xl text-ink-2">
              Meld je plek aan of vul de gegevens aan. Een vermelding is gratis, en complete plekken worden vaker gevonden.
            </p>
          </div>
          <Link
            href="/plek-aanmelden?soort=eigenaar"
            className="flex h-12 shrink-0 items-center justify-center rounded-xl bg-road px-6 font-semibold text-on-road hover:bg-road-deep"
          >
            Plek aanmelden
          </Link>
        </div>
      </section>
    </>
  );
}
