// Vertrekgroep per provincie: /zonder-vertrektijd/<provincie> en /uitslapers/<provincie>. Server-gerenderde lijst,
// het volledige zoekscherm (filters, kaart) staat één tik verder op /zonder-vertrektijd?provincie=…
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getLastUpdate, getSummaries } from "@/lib/places";
import { searchHref } from "@/lib/search";
import { PROVINCES } from "@/lib/types";
import { formatDate } from "@/lib/format";
import { SITE_URL } from "@/lib/env";
import {
  areaPath,
  areasIn,
  departureIntro,
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
import { ActionLink, Breadcrumbs, JsonLd, LinkChips, PageHead, PlaceList } from "./seo-ui";
import { Icon } from "./icons";

const SHOWN = 40;

export const departureParams = () => PROVINCES.map((p) => ({ provincie: provinceSlug(p) }));

export async function departureMetadata(g: SeoDeparture, slug: string): Promise<Metadata> {
  const prov = provinceFromSlug(slug);
  if (!prov) return {};
  const list = inGroup((await getSummaries()).filter((p) => p.province === prov), g);
  const d = DEPARTURE_SEO[g];
  return {
    title: d.title(prov),
    description: list.length
      ? `${list.length === 1 ? "1 camperplaats" : `${list.length} camperplaatsen`} in ${prov} waar ${d.rule}. Met prijs, voorzieningen en route.`
      : `Camperplaatsen in ${prov} waar ${d.rule}.`,
    alternates: { canonical: departurePath(g, prov) },
    ...(indexable(list.length) ? {} : { robots: { index: false, follow: true } }),
  };
}

export async function DepartureProvincePage({ group: g, slug }: { group: SeoDeparture; slug: string }) {
  const prov = provinceFromSlug(slug);
  if (!prov) notFound();
  const [all, updatedAt] = await Promise.all([getSummaries(), getLastUpdate()]);
  const inProv = all.filter((p) => p.province === prov);
  const list = rankForLanding(inGroup(inProv, g));
  const shown = list.slice(0, SHOWN);
  const d = DEPARTURE_SEO[g];
  const title = d.title(prov);
  const free = list.filter((p) => p.priceEur === 0).length;
  const search = searchHref({ departure: g, province: prov, where: prov });
  // Plaatsen en eilanden met minstens één plek uit deze groep, met een eigen (indexeerbare) pagina
  const areas = areasIn(all, prov).filter((a) => indexable(a.places.length) && inGroup(a.places, g).length > 0);
  const otherProvinces = PROVINCES.filter((p) => p !== prov && indexable(inGroup(all.filter((x) => x.province === p), g).length));
  const other = (Object.keys(DEPARTURE_SEO) as SeoDeparture[]).filter((x) => x !== g && inGroup(inProv, x).length > 0);

  return (
    <div className="mx-auto max-w-6xl px-4 pt-6 pb-10 sm:px-6">
      <JsonLd data={itemListLd(SITE_URL, title, shown)} />
      <Breadcrumbs
        crumbs={[
          { name: "Start", path: "/" },
          { name: d.short, path: d.base },
          { name: prov, path: departurePath(g, prov) },
        ]}
      />
      <PageHead title={title} intro={[departureIntro(g, prov, list.length, free)]} updated={updatedAt ? formatDate(updatedAt) : undefined} />
      <div className="mt-5 flex flex-wrap gap-2">
        <ActionLink primary href={`${search}&kaart=1`}>
          <Icon name="map" size={19} /> Bekijk op de kaart
        </ActionLink>
        <ActionLink href={search}>Filters en sorteren</ActionLink>
      </div>

      <PlaceList
        title={list.length > SHOWN ? "Uitgelicht" : list.length === 1 ? "De plek" : `Alle ${list.length} plekken`}
        places={shown}
        more={list.length > SHOWN ? { href: search, label: `Alle ${list.length} plekken bekijken` } : undefined}
      />

      <LinkChips title={`Plaatsen in ${prov}`} links={areas.map((a) => ({ href: areaPath(prov, a.slug), label: `${a.name} (${inGroup(a.places, g).length})` }))} />
      <LinkChips
        title="Verder zoeken"
        links={[
          { href: `/camperplaatsen/${provinceSlug(prov)}`, label: `Alle camperplaatsen in ${prov}` },
          ...other.map((x) => ({ href: departurePath(x, prov), label: DEPARTURE_SEO[x].title(prov) })),
          ...otherProvinces.map((p) => ({ href: departurePath(g, p), label: `${d.short} in ${p}` })),
        ]}
      />
    </div>
  );
}
