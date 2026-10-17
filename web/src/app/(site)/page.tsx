import Link from "next/link";
import { getStats, getSummaries } from "@/lib/places";
import { departureKind, searchHref } from "@/lib/search";
import { PROVINCES, type PlaceSummary } from "@/lib/types";
import { HomeSearch } from "@/components/home-search";
import { Icon } from "@/components/icons";
import { Sign, type SignName } from "@/components/sign";
import { CreditedPhoto, PlaceCard } from "@/components/place-ui";
import { looksLikeGraphic } from "@/lib/photos";

const nf = new Intl.NumberFormat("nl-NL");
// Vaste donkere bostint voor tekst op het landschap, in licht én donker thema
const SCRIM = "from-[#14281d]/80 via-[#14281d]/20 to-transparent";

export default async function Home() {
  const [stats, places] = await Promise.all([getStats(), getSummaries()]);
  const withDeparture = places.filter((p) => p.departure).length;

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
  const coverOf = (prov: string) =>
    places
      .filter((p) => p.province === prov && p.imageUrl && !looksLikeGraphic(p.imageUrl))
      .sort((a, b) => b.completeness - a.completeness || (b.ratingAvg ?? 0) - (a.ratingAvg ?? 0))[0];
  const provinces = [...PROVINCES].sort((a, b) => (stats.byProvince[b] ?? 0) - (stats.byProvince[a] ?? 0));
  const destinations = provinces.slice(0, 6).map((prov) => ({ prov, count: stats.byProvince[prov] ?? 0, cover: coverOf(prov) }));

  const ways: { href: string; title: string; text: string; count: number; sign: SignName; tone: "forest" | "lake" }[] = [
    {
      href: searchHref({ departure: "vrij" }),
      title: "Zonder vertrektijd",
      text: "Je vertrekt wanneer je wilt, of je betaalt per 24 uur vanaf aankomst.",
      count: stats.freeDeparture,
      sign: "clock",
      tone: "forest",
    },
    {
      href: searchHref({ departure: "uitslapers" }),
      title: "Voor uitslapers",
      text: "Je hoeft pas om 12:00 of later weg.",
      count: stats.lateCheckout,
      sign: "clock",
      tone: "lake",
    },
    {
      href: "/zoeken",
      title: "Alle camperplaatsen",
      text: "Alle plekken in de gids, ook die waarvan we de vertrektijd nog niet weten.",
      count: stats.total,
      sign: "camper",
      tone: "forest",
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
      {/* Kop: rustig en zakelijk, de zoekkaart is het belangrijkste (docs/stijlgids.md) */}
      <section className="mx-auto w-full max-w-6xl px-3 pt-5 sm:px-6 sm:pt-10">
        <h1 className="animate-rise font-display text-[1.75rem] leading-[1.1] font-semibold tracking-tight text-ink sm:text-5xl">
          Waar sta je vannacht?
        </h1>
        <p className="animate-rise mt-1.5 max-w-xl text-[0.9375rem] text-ink-2 [animation-delay:60ms] sm:mt-2 sm:text-lg">
          {nf.format(stats.total)} camperplaatsen in Nederland, met vertrektijd en prijs.
        </p>
        <div className="animate-rise mt-4 [animation-delay:120ms] sm:mt-6">
          <HomeSearch />
        </div>
      </section>

      {/* Vertrouwen: wat je hier zeker weet */}
      <section aria-label="Waarom VrijStaan" className="mx-auto w-full max-w-6xl px-3 pt-4 sm:px-6">
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

      {/* Hoe wil je staan: de drie vertrekpagina's, als rustige lijst */}
      <section className="mx-auto w-full max-w-6xl px-3 pt-9 sm:px-6 sm:pt-12">
        <h2 className="font-display text-lg font-semibold sm:text-2xl">Hoe wil je staan?</h2>
        <p className="mt-0.5 text-[0.9375rem] text-ink-2 sm:text-base">Voor camperaars is de vertrektijd vaak belangrijker dan de prijs.</p>
        <ul className="mt-3 divide-y divide-line overflow-hidden rounded-xl bg-surface shadow-low sm:grid sm:grid-cols-3 sm:divide-x sm:divide-y-0">
          {ways.map((w) => (
            <li key={w.title}>
              <Link href={w.href} className="group flex h-full items-start gap-3 p-3.5 hover:bg-sunken/50 sm:flex-col sm:gap-2 sm:p-5">
                <Sign name={w.sign} size={32} tone={w.tone} />
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline justify-between gap-2">
                    <span className="font-semibold">{w.title}</span>
                    <span className="text-sm text-muted tabular-nums">{nf.format(w.count)}</span>
                  </span>
                  <span className="mt-0.5 block text-sm text-ink-2">{w.text}</span>
                </span>
                <Icon name="chevronRight" size={18} className="mt-1 shrink-0 text-muted transition-transform group-hover:translate-x-0.5 sm:hidden" />
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {/* Populaire bestemmingen met echte foto's */}
      <section className="mx-auto max-w-6xl px-3 pt-9 sm:px-6 sm:pt-12">
        <h2 className="font-display text-lg font-semibold sm:text-2xl">Populaire bestemmingen</h2>
        <p className="mt-0.5 text-[0.9375rem] text-ink-2 sm:text-base">Hier staan de meeste plekken.</p>
        <ul className="mt-3 grid grid-cols-2 gap-2.5 sm:mt-4 sm:gap-3 lg:grid-cols-12">
          {destinations.map((d, i) => (
            <li key={d.prov} className={i < 2 ? "col-span-2 sm:col-span-1 lg:col-span-6" : "lg:col-span-3"}>
              <Link
                href={`/camperplaatsen/${d.prov.toLowerCase()}`}
                className={`group relative block overflow-hidden bg-sunken shadow-low ${i < 2 ? "h-36 rounded-xl sm:h-56 lg:h-64" : "h-28 rounded-xl sm:h-44"}`}
              >
                <CreditedPhoto
                  src={d.cover?.imageUrl}
                  alt={`Camperplaatsen in ${d.prov}`}
                  credit={d.cover?.imageCredit}
                  className="absolute inset-0 h-full w-full transition-transform duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-[1.03]"
                />
                <div className={`absolute inset-0 bg-gradient-to-t ${SCRIM}`} />
                <div className="absolute inset-x-0 bottom-0 p-3 sm:p-4">
                  <h3 className={`font-display font-semibold text-[#fffcf6] ${i < 2 ? "text-lg sm:text-2xl" : "text-base sm:text-lg"}`}>{d.prov}</h3>
                  <p className="text-sm font-semibold text-[#efe9dc]">{nf.format(d.count)} plekken</p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
        <ul className="mt-3 flex flex-wrap gap-2">
          {provinces.slice(6).map((prov) => (
            <li key={prov}>
              <Link
                href={`/camperplaatsen/${prov.toLowerCase()}`}
                className="flex h-11 items-center gap-1.5 rounded-full bg-surface px-3.5 text-[0.9375rem] font-semibold shadow-low transition-shadow hover:shadow-raised"
              >
                {prov} <span className="font-normal text-muted">{nf.format(stats.byProvince[prov] ?? 0)}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {/* Uitgelicht */}
      {featured.length > 0 && (
        <section className="mx-auto max-w-6xl px-3 pt-9 sm:px-6 sm:pt-12">
          <div className="mb-3 flex items-end justify-between gap-4">
            <h2 className="font-display text-lg font-semibold sm:text-2xl">
              {stats.freeDeparture > 0 ? "Vertrekken wanneer je wilt" : "Meest complete informatie"}
            </h2>
            <Link href={stats.freeDeparture > 0 ? searchHref({ departure: "vrij" }) : "/zoeken"} className="flex h-11 shrink-0 items-center gap-1 font-semibold whitespace-nowrap text-forest hover:underline">
              Bekijk alle <Icon name="chevronRight" size={18} />
            </Link>
          </div>
          <ul className="no-scrollbar -mx-3 flex snap-x snap-mandatory gap-3 overflow-x-auto px-3 pb-2 sm:mx-0 sm:grid sm:grid-cols-2 sm:px-0 lg:grid-cols-3">
            {featured.map((p) => (
              <li key={p.id} className="w-[78vw] max-w-sm shrink-0 snap-start sm:w-auto sm:max-w-none">
                <PlaceCard place={p} layout="stack" />
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Zoeken op voorziening */}
      <section className="mx-auto max-w-6xl px-3 pt-9 sm:px-6 sm:pt-12">
        <h2 className="font-display text-lg font-semibold sm:text-2xl">Zoek op wat je nodig hebt</h2>
        <ul className="mt-3 grid grid-cols-2 gap-2.5 sm:mt-4 sm:gap-3 lg:grid-cols-4">
          {facilities
            .filter((f) => f.count > 0)
            .map((f) => (
              <li key={f.label}>
                <Link
                  href={f.href}
                  className="flex h-full min-h-16 items-center gap-2.5 rounded-xl bg-surface p-3 shadow-low transition-shadow hover:shadow-raised sm:min-h-20 sm:gap-3 sm:p-4"
                >
                  <Sign name={f.sign} size={34} />
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
      <section className="mx-auto max-w-6xl px-3 pt-9 sm:px-6 sm:pt-12">
        <h2 className="font-display text-lg font-semibold sm:text-2xl">Zo werkt VrijStaan</h2>
        <ol className="mt-3 grid gap-4 md:mt-5 md:grid-cols-3 md:gap-8">
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
            <li key={s.title} className="flex gap-3 border-t border-line pt-4 md:flex-col md:gap-3 md:pt-5">
              <Sign name={s.sign} size={32} />
              <div>
                <h3 className="font-display text-base font-semibold sm:text-lg">
                  <span className="mr-1.5 text-muted tabular-nums">{i + 1}.</span>
                  {s.title}
                </h3>
                <p className="mt-0.5 text-[0.9375rem] text-ink-2 sm:text-base">{s.text}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {/* Eigenaren */}
      <section className="mx-auto max-w-6xl px-3 pt-9 sm:px-6 sm:pt-12">
        <div className="relative overflow-hidden rounded-xl bg-forest-tint">
          <div className="relative flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:p-8">
            <div>
              <h2 className="font-display text-xl font-semibold text-forest sm:text-2xl">Heb je een camperplaats?</h2>
              <p className="mt-1 max-w-xl text-ink-2">
                Meld je plek aan of vul de gegevens aan, zoals je vertrektijd en tarieven. Aanmelden is gratis.
              </p>
            </div>
            <div className="flex shrink-0 flex-col gap-1 sm:items-end">
              <Link
                href="/plek-aanmelden?soort=eigenaar"
                className="flex h-12 items-center justify-center rounded-lg bg-forest px-6 font-semibold text-on-forest hover:bg-forest-deep"
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
