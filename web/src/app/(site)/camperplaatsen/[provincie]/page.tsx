import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getSummaries } from "@/lib/places";
import { searchHref } from "@/lib/search";
import { PROVINCES } from "@/lib/types";
import { eur, pluralize } from "@/lib/format";
import { PlaceCard } from "@/components/place-ui";
import { Icon } from "@/components/icons";

const bySlug = (s: string) => PROVINCES.find((p) => p.toLowerCase() === s);

export function generateStaticParams() {
  return PROVINCES.map((p) => ({ provincie: p.toLowerCase() }));
}

export async function generateMetadata({ params }: PageProps<"/camperplaatsen/[provincie]">): Promise<Metadata> {
  const prov = bySlug((await params).provincie);
  if (!prov) return {};
  return {
    title: `Camperplaatsen in ${prov}`,
    description: `Camperplaatsen in ${prov} met vertrektijd, prijs, voorzieningen en route.`,
    alternates: { canonical: `/camperplaatsen/${prov.toLowerCase()}` },
  };
}

export default async function ProvincePage({ params }: PageProps<"/camperplaatsen/[provincie]">) {
  const prov = bySlug((await params).provincie);
  if (!prov) notFound();
  const places = (await getSummaries()).filter((p) => p.province === prov);
  const priced = places.filter((p) => p.priceEur !== undefined && p.priceEur > 0).map((p) => p.priceEur!);
  const avg = priced.length ? priced.reduce((a, b) => a + b, 0) / priced.length : null;
  const free = places.filter((p) => p.priceEur === 0).length;
  const towns = [...new Set(places.map((p) => p.town))].sort((a, b) => a.localeCompare(b, "nl"));
  const top = [...places].sort((a, b) => b.completeness - a.completeness || Number(!!b.imageUrl) - Number(!!a.imageUrl) || (b.ratingAvg ?? 0) - (a.ratingAvg ?? 0)).slice(0, 12);

  return (
    <div className="mx-auto max-w-6xl px-3 pt-6 sm:px-6">
      <nav aria-label="Kruimelpad" className="flex items-center gap-1 text-sm text-muted">
        <Link href="/" className="-mx-2 -my-3 inline-block px-2 py-3 hover:text-forest hover:underline">Start</Link>
        <Icon name="chevronRight" size={14} />
        <span>{prov}</span>
      </nav>
      <h1 className="mt-3 font-display text-3xl font-semibold sm:text-4xl">Camperplaatsen in {prov}</h1>
      <p className="mt-3 max-w-2xl text-lg text-ink-2">
        {places.length
          ? `${pluralize(places.length, "plek", "plekken")} in ${prov}${free ? `, waarvan ${free} gratis` : ""}.${avg ? ` Een nacht kost gemiddeld ${eur(avg)}.` : ""}`
          : `Er staan nog geen plekken in ${prov} in de gids.`}
      </p>
      <div className="mt-5 flex flex-wrap gap-2">
        <Link href={`${searchHref({ province: prov, where: prov })}&kaart=1`} className="flex h-12 items-center gap-2 rounded-lg bg-forest px-5 font-semibold text-on-forest">
          <Icon name="map" size={19} /> Bekijk op de kaart
        </Link>
        {free > 0 ? (
          <Link href={searchHref({ province: prov, where: prov, free: true })} className="flex h-12 items-center rounded-lg border border-line bg-surface px-5 font-semibold hover:border-forest">
            Gratis plekken ({free})
          </Link>
        ) : (
          <Link href={searchHref({ province: prov, where: prov, sort: "prijs" })} className="flex h-12 items-center rounded-lg border border-line bg-surface px-5 font-semibold hover:border-forest">
            Goedkoopste eerst
          </Link>
        )}
      </div>

      {top.length > 0 && (
        <section className="mt-10">
          <h2 className="font-display text-2xl font-semibold">Uitgelicht in {prov}</h2>
          <ul className="mt-4 grid gap-3 lg:grid-cols-2">
            {top.map((p) => (
              <li key={p.id}>
                <PlaceCard place={p} />
              </li>
            ))}
          </ul>
        </section>
      )}

      {towns.length > 0 && (
        <section className="mt-10">
          <h2 className="font-display text-2xl font-semibold">Op plaatsnaam</h2>
          <ul className="mt-4 flex flex-wrap gap-2">
            {towns.map((t) => {
              const p = places.find((x) => x.town === t)!;
              return (
                <li key={t}>
                  <Link
                    href={searchHref({ where: t, center: { lat: p.lat, lng: p.lng }, radiusKm: 10 })}
                    className="inline-flex h-11 items-center rounded-full bg-surface px-4 shadow-low transition-shadow hover:shadow-raised"
                  >
                    {t}
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}
