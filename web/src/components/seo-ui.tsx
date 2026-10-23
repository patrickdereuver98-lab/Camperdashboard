// Bouwstenen voor de landingspagina's (provincie, plaats of eiland, vertrekgroep per provincie). Server-componenten:
// de lijst staat in de HTML, zodat zoekmachines en trage telefoons hem meteen hebben.
import Link from "next/link";
import { SITE_URL } from "@/lib/env";
import { breadcrumbLd, ldJson } from "@/lib/seo-pages";
import type { PlaceSummary } from "@/lib/types";
import { PlaceCard } from "./place-ui";
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
              <Link href={c.path} className="-my-3 inline-block py-3 hover:text-forest hover:underline">
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

export function PageHead({ title, intro, updated }: { title: string; intro: string[]; updated?: string }) {
  return (
    <>
      <h1 className="mt-3 font-display text-2xl font-semibold tracking-tight text-balance sm:text-4xl">{title}</h1>
      {updated && <p className="mt-1 text-sm text-muted">Laatste update: {updated}</p>}
      <div className="mt-3 max-w-prose space-y-2 text-ink-2 sm:text-[1.0625rem]">
        {intro.map((line) => (
          <p key={line}>{line}</p>
        ))}
      </div>
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

export function PlaceList({ title, places, more }: { title: string; places: PlaceSummary[]; more?: { href: string; label: string } }) {
  if (!places.length) return null;
  return (
    <section className="mt-8 sm:mt-12" aria-labelledby="lijst">
      <h2 id="lijst" className="font-display text-lg font-semibold tracking-tight sm:text-[1.375rem]">
        {title}
      </h2>
      <ul className="mt-3 grid gap-3 lg:grid-cols-2">
        {places.map((p) => (
          <li key={p.id}>
            <PlaceCard place={p} />
          </li>
        ))}
      </ul>
      {more && (
        <p className="mt-4">
          <Link href={more.href} className="font-semibold text-forest underline underline-offset-2">
            {more.label}
          </Link>
        </p>
      )}
    </section>
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
