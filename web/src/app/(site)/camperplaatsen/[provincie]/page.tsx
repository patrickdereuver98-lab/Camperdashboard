import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getLastUpdate, getSummaries } from "@/lib/places";
import { searchHref } from "@/lib/search";
import { PROVINCES } from "@/lib/types";
import { eur, formatDate } from "@/lib/format";
import { SITE_URL } from "@/lib/env";
import {
  areaIntro,
  areaPath,
  areasIn,
  countsOf,
  departurePath,
  DEPARTURE_SEO,
  indexable,
  inGroup,
  itemListLd,
  provinceFromSlug,
  provinceSlug,
  rankForLanding,
  type SeoDeparture,
} from "@/lib/seo-pages";
import { ActionLink, Breadcrumbs, JsonLd, LinkChips, PageHead, PlaceList } from "@/components/seo-ui";
import { Icon } from "@/components/icons";

const SHOWN = 24;

export function generateStaticParams() {
  return PROVINCES.map((p) => ({ provincie: provinceSlug(p) }));
}

export async function generateMetadata({ params }: PageProps<"/camperplaatsen/[provincie]">): Promise<Metadata> {
  const prov = provinceFromSlug((await params).provincie);
  if (!prov) return {};
  const c = countsOf((await getSummaries()).filter((p) => p.province === prov));
  return {
    title: `Camperplaatsen in ${prov}`,
    description: c.total
      ? `${c.total} camperplaatsen in ${prov} met vertrektijd, prijs, voorzieningen en route.${c.vrij ? ` ${c.vrij} zonder vaste vertrektijd.` : ""}${c.free ? ` ${c.free} gratis.` : ""}`
      : `Camperplaatsen in ${prov} met vertrektijd, prijs, voorzieningen en route.`,
    alternates: { canonical: `/camperplaatsen/${provinceSlug(prov)}` },
  };
}

export default async function ProvincePage({ params }: PageProps<"/camperplaatsen/[provincie]">) {
  const prov = provinceFromSlug((await params).provincie);
  if (!prov) notFound();
  const [all, updatedAt] = await Promise.all([getSummaries(), getLastUpdate()]);
  const places = all.filter((p) => p.province === prov);
  const c = countsOf(places);
  const priced = places.filter((p) => p.priceEur !== undefined && p.priceEur > 0).map((p) => p.priceEur!);
  const avg = priced.length ? priced.reduce((a, b) => a + b, 0) / priced.length : null;
  const ranked = rankForLanding(places);
  const shown = ranked.slice(0, SHOWN);
  const areas = areasIn(all, prov);
  const islands = areas.filter((a) => a.kind === "eiland" && indexable(a.places.length));
  const towns = areas.filter((a) => a.kind === "plaats").sort((a, b) => a.name.localeCompare(b.name, "nl"));
  const groups = (Object.keys(DEPARTURE_SEO) as SeoDeparture[]).filter((g) => inGroup(places, g).length > 0);
  const intro = areaIntro(`in ${prov}`, c);
  if (avg) intro.push(`Een nacht kost gemiddeld ${eur(avg)}, zonder toeslagen. Die staan per plek.`);

  return (
    <div className="mx-auto max-w-6xl px-4 pt-6 pb-10 sm:px-6">
      <JsonLd data={itemListLd(SITE_URL, `Camperplaatsen in ${prov}`, shown)} />
      <Breadcrumbs crumbs={[{ name: "Start", path: "/" }, { name: prov, path: `/camperplaatsen/${provinceSlug(prov)}` }]} />
      <PageHead title={`Camperplaatsen in ${prov}`} intro={intro} updated={updatedAt ? formatDate(updatedAt) : undefined} />
      <div className="mt-5 flex flex-wrap gap-2">
        <ActionLink primary href={`${searchHref({ province: prov, where: prov })}&kaart=1`}>
          <Icon name="map" size={19} /> Bekijk op de kaart
        </ActionLink>
        {groups.map((g) => (
          <ActionLink key={g} href={departurePath(g, prov)}>
            {DEPARTURE_SEO[g].short} ({inGroup(places, g).length})
          </ActionLink>
        ))}
        {c.free > 0 && <ActionLink href={searchHref({ province: prov, where: prov, free: true })}>Gratis plekken ({c.free})</ActionLink>}
      </div>

      <PlaceList
        title={ranked.length > SHOWN ? `Uitgelicht in ${prov}` : `Alle plekken in ${prov}`}
        places={shown}
        more={ranked.length > SHOWN ? { href: searchHref({ province: prov, where: prov }), label: `Alle ${ranked.length} plekken in ${prov} bekijken` } : undefined}
      />

      <LinkChips title="Eilanden" links={islands.map((a) => ({ href: areaPath(prov, a.slug), label: `${a.name} (${a.places.length})` }))} />

      {/* Plaatsen met genoeg plekken hebben een eigen pagina; de rest opent het zoekscherm rond die plaats */}
      <LinkChips
        title="Op plaatsnaam"
        links={towns.map((a) => {
          if (indexable(a.places.length)) return { href: areaPath(prov, a.slug), label: `${a.name} (${a.places.length})` };
          const p = a.places[0];
          return { href: searchHref({ where: a.name, center: { lat: p.lat, lng: p.lng }, radiusKm: 10 }), label: a.name };
        })}
      />
    </div>
  );
}
