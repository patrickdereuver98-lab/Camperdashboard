import Link from "next/link";
import { getStats, getSummaries } from "@/lib/places";
import { searchHref } from "@/lib/search";
import { PROVINCES, type PlaceSummary } from "@/lib/types";
import { HomeSearch } from "@/components/home-search";
import { Icon } from "@/components/icons";
import { Landscape } from "@/components/landscape";
import { Sign, type SignName } from "@/components/sign";
import { CreditedPhoto, PlaceCard } from "@/components/place-ui";

const nf = new Intl.NumberFormat("nl-NL");
// Vaste donkere bostint voor tekst op het landschap, in licht én donker thema
const SCRIM = "from-[#14281d]/90 via-[#14281d]/40 to-transparent";

export default async function Home() {
  const [stats, places] = await Promise.all([getStats(), getSummaries()]);
  const withDeparture = places.filter((p) => p.departure).length;

  // Uitgelicht: eerst plekken zonder vaste vertrektijd, dan foto, score en de meeste informatie
  const free = (p: PlaceSummary) => (p.departure === "vrij" || p.departure === "per24" ? 1 : 0);
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
  const coverOf = (prov: string) =>
    places
      .filter((p) => p.province === prov && p.imageUrl)
      .sort((a, b) => b.completeness - a.completeness || (b.ratingAvg ?? 0) - (a.ratingAvg ?? 0))[0];
  const provinces = [...PROVINCES].sort((a, b) => (stats.byProvince[b] ?? 0) - (stats.byProvince[a] ?? 0));
  const destinations = provinces.slice(0, 6).map((prov) => ({ prov, count: stats.byProvince[prov] ?? 0, cover: coverOf(prov) }));

  const ways: { href: string; title: string; text: string; count: number; variant: 0 | 1 | 2 | 3; tone: string }[] = [
    {
      href: searchHref({ departure: "vrij" }),
      title: "Zonder vertrektijd",
      text: "Je vertrekt wanneer je wilt, of je betaalt per 24 uur vanaf aankomst.",
      count: stats.freeDeparture,
      variant: 0,
      tone: "bg-forest text-on-forest",
    },
    {
      href: searchHref({ departure: "uitslapers" }),
      title: "Voor uitslapers",
      text: "Je hoeft pas om 12:00 of later weg.",
      count: stats.lateCheckout,
      variant: 1,
      tone: "bg-lake text-on-forest",
    },
    {
      href: "/zoeken",
      title: "Alle camperplaatsen",
      text: "Alle plekken in de gids, ook die waarvan we de vertrektijd nog niet weten.",
      count: stats.total,
      variant: 3,
      tone: "bg-ink text-paper",
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
      {/* Kop: landschap over de volle breedte, zoekkaart eroverheen */}
      <section className="relative">
        <div className="relative h-[17.5rem] overflow-hidden sm:h-[22rem] lg:h-[27rem]">
          <Landscape seed="vrijstaan-avond" variant={2} water wide className="absolute inset-0 h-full w-full" />
          <div className={`absolute inset-0 bg-gradient-to-t ${SCRIM}`} />
          <div className="relative mx-auto flex h-full max-w-6xl flex-col justify-end px-4 pb-20 sm:px-6 sm:pb-24 lg:pb-28">
            <h1 className="animate-rise max-w-3xl font-display text-[2.4rem] leading-[1.02] font-semibold text-[#fffcf6] [text-shadow:0_2px_24px_rgb(10_24_16/0.45)] sm:text-5xl lg:text-[4rem]">
              Waar sta je vannacht?
            </h1>
            <p className="animate-rise mt-2 max-w-xl text-[#efe9dc] [animation-delay:80ms] sm:text-lg">
              {nf.format(stats.total)} camperplaatsen in Nederland, met vertrektijd en prijs.
            </p>
          </div>
        </div>
        <div className="relative z-10 mx-auto -mt-16 max-w-6xl px-3 sm:-mt-20 sm:px-6">
          <HomeSearch />
        </div>
      </section>

      {/* Vertrouwen: wat je hier zeker weet */}
      <section aria-label="Waarom VrijStaan" className="mx-auto max-w-6xl px-3 pt-5 sm:px-6">
        <ul className="grid gap-x-6 gap-y-2 text-ink-2 sm:grid-cols-3">
          {[
            `Van ${nf.format(withDeparture)} plekken weten we hoe laat je weg moet`,
            "Prijzen met toeristenbelasting, stroom en andere bijkomende kosten",
            "Gratis te gebruiken, je hebt geen account nodig",
          ].map((t) => (
            <li key={t} className="flex items-start gap-2.5">
              <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-forest-tint text-forest">
                <Icon name="check" size={16} />
              </span>
              <span className="text-[15px] leading-snug sm:text-base">{t}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* Hoe wil je staan: de drie vertrekpagina's */}
      <section className="mx-auto max-w-6xl px-3 pt-12 sm:px-6">
        <h2 className="font-display text-2xl font-semibold sm:text-3xl">Hoe wil je staan?</h2>
        <p className="mt-1 text-ink-2">Voor camperaars is de vertrektijd vaak belangrijker dan de prijs.</p>
        <ul className="no-scrollbar -mx-3 mt-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-3 pb-2 sm:mx-0 sm:grid sm:grid-cols-3 sm:px-0">
          {ways.map((w) => (
            <li key={w.title} className="w-[78vw] max-w-sm shrink-0 snap-start sm:w-auto sm:max-w-none">
              <Link
                href={w.href}
                className="group flex h-full flex-col overflow-hidden rounded-[1.25rem] bg-surface shadow-low transition-shadow duration-200 hover:shadow-raised"
              >
                <div className="relative h-32 overflow-hidden">
                  <Landscape seed={`soort-${w.title}`} variant={w.variant} water={w.variant === 1} className="absolute inset-0 h-full w-full transition-transform duration-500 group-hover:scale-105" />
                  <span className={`absolute top-3 left-3 rounded-full px-3 py-1 text-sm font-semibold ${w.tone}`}>
                    {nf.format(w.count)} plekken
                  </span>
                </div>
                <div className="flex flex-1 flex-col p-4">
                  <h3 className="font-display text-xl font-semibold">{w.title}</h3>
                  <p className="mt-1 flex-1 text-ink-2">{w.text}</p>
                  <span className="mt-3 flex items-center gap-1 font-semibold text-forest">
                    Bekijk plekken <Icon name="chevronRight" size={18} />
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {/* Populaire bestemmingen met echte foto's */}
      <section className="mx-auto max-w-6xl px-3 pt-12 sm:px-6">
        <h2 className="font-display text-2xl font-semibold sm:text-3xl">Populaire bestemmingen</h2>
        <p className="mt-1 text-ink-2">Hier staan de meeste plekken.</p>
        <ul className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-12">
          {destinations.map((d, i) => (
            <li key={d.prov} className={i < 2 ? "col-span-2 sm:col-span-1 lg:col-span-6" : "lg:col-span-3"}>
              <Link
                href={`/camperplaatsen/${d.prov.toLowerCase()}`}
                className={`group relative block overflow-hidden bg-sunken shadow-raised ${i < 2 ? "h-48 rounded-[1.5rem] sm:h-56 lg:h-64" : "h-36 rounded-[1.25rem] sm:h-44"}`}
              >
                <CreditedPhoto
                  src={d.cover?.imageUrl}
                  alt={`Camperplaatsen in ${d.prov}`}
                  credit={d.cover?.imageCredit}
                  className="absolute inset-0 h-full w-full transition-transform duration-500 group-hover:scale-105"
                />
                <div className={`absolute inset-0 bg-gradient-to-t ${SCRIM}`} />
                <div className="absolute inset-x-0 bottom-0 p-3 sm:p-4">
                  <h3 className={`font-display font-semibold text-[#fffcf6] ${i < 2 ? "text-2xl sm:text-3xl" : "text-xl"}`}>{d.prov}</h3>
                  <p className="text-sm font-semibold text-[#efe9dc]">{nf.format(d.count)} plekken</p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
        <ul className="mt-4 flex flex-wrap gap-2">
          {provinces.slice(6).map((prov) => (
            <li key={prov}>
              <Link
                href={`/camperplaatsen/${prov.toLowerCase()}`}
                className="flex h-11 items-center gap-2 rounded-full bg-surface px-4 font-semibold shadow-low transition-shadow hover:shadow-raised"
              >
                {prov} <span className="font-normal text-muted">{nf.format(stats.byProvince[prov] ?? 0)}</span>
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
            <Link href={stats.freeDeparture > 0 ? searchHref({ departure: "vrij" }) : "/zoeken"} className="flex h-11 shrink-0 items-center gap-1 font-semibold whitespace-nowrap text-forest hover:underline">
              Bekijk alle <Icon name="chevronRight" size={18} />
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

      {/* Zoeken op voorziening */}
      <section className="mx-auto max-w-6xl px-3 pt-12 sm:px-6">
        <h2 className="font-display text-2xl font-semibold sm:text-3xl">Zoek op wat je nodig hebt</h2>
        <ul className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {facilities
            .filter((f) => f.count > 0)
            .map((f) => (
              <li key={f.label}>
                <Link
                  href={f.href}
                  className="flex h-full min-h-20 items-center gap-3 rounded-2xl bg-surface p-3 shadow-low transition-shadow hover:shadow-raised sm:p-4"
                >
                  <Sign name={f.sign} size={40} />
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
      <section className="mx-auto max-w-6xl px-3 pt-12 sm:px-6">
        <h2 className="font-display text-2xl font-semibold sm:text-3xl">Zo werkt VrijStaan</h2>
        <ol className="mt-5 grid gap-6 md:grid-cols-3 md:gap-8">
          {[
            {
              sign: "pin" as SignName,
              title: "Zoek een plek",
              text: "Typ een plaats, streek of eiland. Of kijk wat er bij jou in de buurt is.",
            },
            {
              sign: "clock" as SignName,
              title: "Kijk wanneer je weg moet",
              text: "Bij elke plek zie je de vertrektijd, wat een nacht kost met alle bijkomende kosten, en wat er aan voorzieningen is.",
            },
            {
              sign: "camper" as SignName,
              title: "Rij erheen",
              text: "Je ziet hoe lang je nog moet rijden. Met één tik open je de route in je eigen navigatie.",
            },
          ].map((s, i) => (
            <li key={s.title} className="flex gap-4 border-t-2 border-line pt-5 md:flex-col">
              <div className="relative shrink-0">
                <Sign name={s.sign} size={48} />
                <span className="absolute -top-2 -right-2 grid h-6 w-6 place-items-center rounded-full bg-ember text-sm font-bold text-on-ember">{i + 1}</span>
              </div>
              <div>
                <h3 className="font-display text-xl font-semibold">{s.title}</h3>
                <p className="mt-1 text-ink-2">{s.text}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {/* Eigenaren */}
      <section className="mx-auto max-w-6xl px-3 pt-12 sm:px-6">
        <div className="relative overflow-hidden rounded-2xl bg-forest-tint">
          <div className="relative flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8">
            <div>
              <h2 className="font-display text-2xl font-semibold text-forest">Heb je een camperplaats?</h2>
              <p className="mt-1 max-w-xl text-ink-2">
                Meld je plek aan of vul de gegevens aan, zoals je vertrektijd en tarieven. Aanmelden is gratis.
              </p>
            </div>
            <div className="flex shrink-0 flex-col gap-1 sm:items-end">
              <Link
                href="/plek-aanmelden?soort=eigenaar"
                className="flex h-12 items-center justify-center rounded-xl bg-forest px-6 font-semibold text-on-forest hover:bg-forest-deep"
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
