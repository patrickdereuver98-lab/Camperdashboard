// Bouwstenen voor de landingspagina's (provincie, plaats of eiland, vertrekgroep per provincie). Server-componenten:
// de lijst staat in de HTML, zodat zoekmachines en trage telefoons hem meteen hebben.
import Link from "next/link";
import { SITE_URL } from "@/lib/env";
import { breadcrumbLd, ldJson } from "@/lib/seo-pages";
import { cardPrice, departureShort } from "@/lib/format";
import { isIncomplete } from "@/lib/place-status";
import { KIND_LABEL, type PlaceSummary } from "@/lib/types";
import { DepartureChip } from "./place-ui";
import { Icon } from "./icons";

export function JsonLd({ data }: { data: unknown }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: ldJson(data) }} />;
}

/** Kruimelpad, zichtbaar en als BreadcrumbList. De laatste stap is de pagina zelf (geen link). */
export function Breadcrumbs({ crumbs }: { crumbs: { name: string; path: string }[] }) {
  return (
    <>
      <JsonLd data={breadcrumbLd(SITE_URL, crumbs)} />
      <nav aria-label="Kruimelpad" className="flex flex-wrap items-center gap-1 text-sm text-muted">
        {crumbs.map((c, i) =>
          i < crumbs.length - 1 ? (
            <span key={c.path} className="flex items-center gap-1">
              <Link href={c.path} className="-mx-2 -my-3 inline-block px-2 py-3 hover:text-forest hover:underline">
                {c.name}
              </Link>
              <Icon name="chevronRight" size={14} />
            </span>
          ) : (
            <span key={c.path} aria-current="page" className="text-ink-2">
              {c.name}
            </span>
          ),
        )}
      </nav>
    </>
  );
}

export function PageHead({
  title,
  intro,
  updated,
  facts,
}: {
  title: string;
  intro: string[];
  updated?: string;
  facts?: { value: string; label: string }[];
}) {
  return (
    <>
      <h1 className="mt-3 font-display text-2xl font-semibold tracking-tight text-balance sm:text-4xl">{title}</h1>
      {updated && <p className="mt-1 text-sm text-muted">Laatste update: {updated}</p>}
      <div className="mt-3 max-w-prose space-y-2 text-ink-2 sm:text-[1.0625rem]">
        {intro.map((line) => (
          <p key={line}>{line}</p>
        ))}
      </div>
      {/* De cijfers als korte regels met het getal vooraan: op de telefoon twee kolommen (verbeterplan D8) */}
      {facts && facts.length > 0 && (
        <dl className="mt-3 grid max-w-3xl grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3">
          {facts.map((f) => (
            <div key={f.label} className="flex flex-col">
              <dt className="sr-only">{f.label}</dt>
              <dd className="font-display text-lg leading-tight font-semibold tabular-nums">{f.value}</dd>
              <dd className="text-sm leading-snug text-ink-2">{f.label}</dd>
            </div>
          ))}
        </dl>
      )}
    </>
  );
}

export function ActionLink({ href, children, primary }: { href: string; children: React.ReactNode; primary?: boolean }) {
  return (
    <Link
      href={href}
      className={
        primary
          ? "flex h-11 items-center gap-2 rounded-lg bg-forest px-4 font-semibold text-on-forest"
          : "flex h-11 items-center gap-2 rounded-lg border border-line bg-surface px-4 font-semibold hover:border-forest"
      }
    >
      {children}
    </Link>
  );
}

/**
 * Plekken als vergelijkingstabel (concept "Reisgids", 29 oktober 2026): per rij naam, vertrek en nachtprijs, zonder
 * foto's, zodat je op een telefoon veel plekken naast elkaar ziet. Op de telefoon staat de vertrekregel onder de naam,
 * vanaf `sm` in een eigen kolom. Onbekend staat er gewoon als onbekend.
 */
export function PlaceList({ title, places, more }: { title: string; places: PlaceSummary[]; more?: { href: string; label: string } }) {
  if (!places.length) return null;
  return (
    <section className="mt-8 sm:mt-12" aria-labelledby="lijst">
      <h2 id="lijst" className="font-display text-lg font-semibold tracking-tight sm:text-[1.375rem]">
        {title}
      </h2>
      <div className="mt-3 overflow-hidden rounded-xl bg-surface shadow-low">
        <table className="w-full border-collapse text-left">
          <caption className="sr-only">{title}, met vertrektijd en prijs per nacht</caption>
          <thead>
            <tr className="border-b border-line text-sm text-muted">
              <th scope="col" className="px-3.5 py-2.5 font-normal sm:px-5">Plek</th>
              <th scope="col" className="hidden px-2 py-2.5 font-normal sm:table-cell">Vertrek</th>
              <th scope="col" className="px-3.5 py-2.5 text-right font-normal sm:px-5">Per nacht</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {places.map((p) => (
              <tr key={p.id} className="align-top transition-colors hover:bg-sunken/40">
                <td className="px-3.5 py-3 sm:px-5">
                  <Link href={`/plek/${p.slug}`} prefetch={false} className="-my-3 block py-3 leading-snug font-semibold text-ink hover:text-forest hover:underline">
                    {p.name}
                  </Link>
                  <span className="block text-sm text-ink-2">
                    {p.kind ? KIND_LABEL[p.kind] : "Camperplaats"} in {p.town}
                    {p.maxLengthM ? `, tot ${String(p.maxLengthM).replace(".", ",")} m` : ""}
                  </span>
                  <span className="mt-1.5 block sm:hidden">
                    <Departure place={p} />
                  </span>
                </td>
                <td className="hidden px-2 py-3 sm:table-cell">
                  <Departure place={p} />
                </td>
                <td className="px-3.5 py-3 text-right whitespace-nowrap sm:px-5">
                  <Price place={p} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {more && (
        <p className="mt-4">
          <Link href={more.href} className="-my-3 inline-block py-3 font-semibold text-forest underline underline-offset-2">
            {more.label}
          </Link>
        </p>
      )}
    </section>
  );
}

function Departure({ place }: { place: PlaceSummary }) {
  // DepartureChip toont niets bij een regel die beheer afwees; dan zeggen we gewoon dat het onbekend is
  if (!departureShort(place) && !isIncomplete(place)) return <span className="text-sm text-muted">Onbekend</span>;
  return <DepartureChip place={place} />;
}

function Price({ place }: { place: PlaceSummary }) {
  const price = cardPrice(place);
  if (!price) return <span className="text-sm text-muted">Onbekend</span>;
  return (
    <>
      <span className="block font-semibold text-ink tabular-nums">{price.value}</span>
      {(price.extras || place.touristTaxIncluded === false) && <span className="block text-sm text-muted">+ toeslagen</span>}
    </>
  );
}

export function LinkChips({ title, links }: { title: string; links: { href: string; label: string }[] }) {
  if (!links.length) return null;
  return (
    <section className="mt-8 sm:mt-12">
      <h2 className="font-display text-lg font-semibold tracking-tight sm:text-[1.375rem]">{title}</h2>
      <ul className="mt-3 flex flex-wrap gap-2">
        {links.map((l) => (
          <li key={l.href}>
            <Link href={l.href} className="inline-flex h-11 items-center rounded-full bg-surface px-4 shadow-low hover:shadow-raised">
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
