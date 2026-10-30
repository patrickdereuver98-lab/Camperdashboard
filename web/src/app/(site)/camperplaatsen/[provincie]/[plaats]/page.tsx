import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getLastUpdate, getSummaries } from "@/lib/places";
import { searchHref } from "@/lib/search";
import { PROVINCES } from "@/lib/types";
import { formatDate } from "@/lib/format";
import { SITE_URL } from "@/lib/env";
import {
  areaFacts,
  areaIntro,
  areaPath,
  areasIn,
  areaTitle,
  countsOf,
  departurePath,
  DEPARTURE_SEO,
  findArea,
  indexable,
  inGroup,
  itemListLd,
  provinceFromSlug,
  provinceSlug,
  rankForLanding,
  type Area,
  type SeoDeparture,
} from "@/lib/seo-pages";
import { ActionLink, Breadcrumbs, JsonLd, LinkChips, PageHead, PlaceList } from "@/components/seo-ui";
import { Icon } from "@/components/icons";

const SHOWN = 40;

/** Alleen plaatsen en eilanden met genoeg plekken worden vooraf gebouwd; de rest bij het eerste bezoek */
export async function generateStaticParams() {
  const all = await getSummaries();
  const params = PROVINCES.flatMap((prov) =>
    areasIn(all, prov)
      .filter((a) => indexable(a.places.length))
      .map((a) => ({ provincie: provinceSlug(prov), plaats: a.slug })),
  );
  // Cache Components wil minstens één pad; een lege lijst kan alleen bij een lege database
  return params.length ? params : [{ provincie: "zeeland", plaats: "middelburg" }];
}

async function load(params: PageProps<"/camperplaatsen/[provincie]/[plaats]">["params"]) {
  const { provincie, plaats } = await params;
  const prov = provinceFromSlug(provincie);
  if (!prov) return undefined;
  const all = await getSummaries();
  const area = findArea(all, prov, plaats);
  return area ? { prov, area, all } : undefined;
}

function mapHref(a: Area) {
  if (a.island) return searchHref({ where: a.name, center: a.island.center, radiusKm: a.island.radiusKm });
  // Middelpunt van de plekken zelf; straal zoals de plaatsnaamlinks op de provinciepagina
  const lat = a.places.reduce((s, p) => s + p.lat, 0) / a.places.length;
  const lng = a.places.reduce((s, p) => s + p.lng, 0) / a.places.length;
  return searchHref({ where: a.name, center: { lat, lng }, radiusKm: 10 });
}

export async function generateMetadata({ params }: PageProps<"/camperplaatsen/[provincie]/[plaats]">): Promise<Metadata> {
  const found = await load(params);
  if (!found) return { title: "Plaats niet gevonden" };
  const { prov, area } = found;
  const c = countsOf(area.places);
  const where = area.kind === "eiland" ? area.name : `${area.name}, ${prov}`;
  return {
    title: area.kind === "eiland" ? areaTitle(area) : `${areaTitle(area)} (${prov})`,
    description:
      `${c.total === 1 ? "1 camperplaats" : `${c.total} camperplaatsen`} ${area.prep} ${where} met vertrektijd, prijs, voorzieningen en route.` +
      (c.vrij ? ` ${c.vrij} zonder vaste vertrektijd.` : "") +
      (c.free ? ` ${c.free} gratis.` : ""),
    alternates: { canonical: areaPath(prov, area.slug) },
    // Te weinig plekken voor een eigen pagina in de zoekresultaten: wel bereikbaar, niet geïndexeerd
    ...(indexable(c.total) ? {} : { robots: { index: false, follow: true } }),
  };
}

export default async function AreaPage({ params }: PageProps<"/camperplaatsen/[provincie]/[plaats]">) {
  const found = await load(params);
  if (!found) notFound();
  const { prov, area, all } = found;
  const updatedAt = await getLastUpdate();
  const c = countsOf(area.places);
  const ranked = rankForLanding(area.places);
  const shown = ranked.slice(0, SHOWN);
  const title = areaTitle(area);
  const provPath = `/camperplaatsen/${provinceSlug(prov)}`;
  const inProv = all.filter((p) => p.province === prov);
  const groups = (Object.keys(DEPARTURE_SEO) as SeoDeparture[]).filter((g) => inGroup(inProv, g).length > 0);
  const others = areasIn(all, prov).filter((a) => a.slug !== area.slug && indexable(a.places.length));
  // Plaatsen op dit eiland met een eigen pagina
  const onIsland = area.island ? others.filter((a) => a.kind === "plaats" && a.places.every((p) => area.places.includes(p))) : [];
  const nearby = others.filter((a) => !onIsland.includes(a));

  return (
    <div className="mx-auto max-w-6xl px-4 pt-6 pb-10 sm:px-6">
      <JsonLd data={itemListLd(SITE_URL, title, shown)} />
      <Breadcrumbs
        crumbs={[
          { name: "Start", path: "/" },
          { name: prov, path: provPath },
          { name: area.name, path: areaPath(prov, area.slug) },
        ]}
      />
      <PageHead title={title} intro={areaIntro(`${area.prep} ${area.name}`, c).slice(0, 1)} facts={areaFacts(c)} updated={updatedAt ? formatDate(updatedAt) : undefined} />
      <div className="mt-5 flex flex-wrap gap-2">
        <ActionLink primary href={`${mapHref(area)}&kaart=1`}>
          <Icon name="map" size={19} /> Bekijk op de kaart
        </ActionLink>
        {c.unknownDeparture > 0 && <ActionLink href="/doe-mee">Weet jij een vertrektijd?</ActionLink>}
      </div>

      <PlaceList
        title={ranked.length > SHOWN ? `Uitgelicht ${area.prep} ${area.name}` : `Alle plekken ${area.prep} ${area.name}`}
        places={shown}
        more={ranked.length > SHOWN ? { href: mapHref(area), label: `Alle ${ranked.length} plekken ${area.prep} ${area.name} bekijken` } : undefined}
      />

      <LinkChips title={`Plaatsen op ${area.name}`} links={onIsland.map((a) => ({ href: areaPath(prov, a.slug), label: `${a.name} (${a.places.length})` }))} />
      <LinkChips
        title={`Meer in ${prov}`}
        links={[
          { href: provPath, label: `Alle camperplaatsen in ${prov}` },
          ...groups.map((g) => ({ href: departurePath(g, prov), label: DEPARTURE_SEO[g].title(prov) })),
          ...nearby.slice(0, 16).map((a) => ({ href: areaPath(prov, a.slug), label: `${a.name} (${a.places.length})` })),
        ]}
      />
    </div>
  );
}
