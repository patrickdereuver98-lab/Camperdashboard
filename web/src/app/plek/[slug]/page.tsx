import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getNearby, getPlace, getPlaces } from "@/lib/places";
import { directionsUrl } from "@/lib/geo";
import { searchHref } from "@/lib/filters";
import type { Place } from "@/lib/types";
import { Landscape } from "@/components/landscape";
import { Icon, type IconName } from "@/components/icons";
import { PlaceCard, PriceTag, SaveButton } from "@/components/place-bits";
import { eur, formatPrice } from "@/lib/format";
import { PlaceMap } from "@/components/place-map";

export async function generateStaticParams() {
  const places = await getPlaces();
  return places.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({
  params,
}: PageProps<"/plek/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const place = await getPlace(slug);
  if (!place) return { title: "Plek niet gevonden" };
  return {
    title: `${place.name}, ${place.town}`,
    description: `Camperplaats ${place.name} bij ${place.town} (${place.province}). Bekijk voorzieningen, prijs en route.`,
  };
}

export default async function PlacePage({ params }: PageProps<"/plek/[slug]">) {
  const { slug } = await params;
  const place = await getPlace(slug);
  if (!place) notFound();
  const nearby = await getNearby(place, 4);

  return (
    <main className="mx-auto w-full max-w-6xl px-4 pt-5 pb-16 sm:px-6">
      <nav
        className="mb-4 flex min-w-0 items-center gap-1.5 text-sm text-muted"
        aria-label="Kruimelpad"
      >
        <Link href="/zoeken" className="shrink-0 hover:text-ink">
          Zoeken
        </Link>
        <Icon name="chevronDown" size={14} className="shrink-0 -rotate-90" />
        <Link
          href={searchHref({ province: place.province })}
          className="shrink-0 hover:text-ink"
        >
          {place.province}
        </Link>
        <Icon name="chevronDown" size={14} className="shrink-0 -rotate-90" />
        <span className="truncate text-ink-soft">{place.name}</span>
      </nav>

      <div className="relative overflow-hidden rounded-[1.75rem] shadow-card">
        <Landscape
          seed={place.slug}
          water={place.water}
          van
          wide
          className="h-48 w-full sm:h-72"
        />
      </div>

      <header className="mt-6 flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
        <div className="min-w-0">
          <div className="mb-2 flex items-center gap-2">
            <PriceTag place={place} />
            {place.unnamed && (
              <span className="text-xs text-muted">
                Naam onbekend, vernoemd naar de woonplaats
              </span>
            )}
          </div>
          <h1 className="font-display text-4xl leading-tight font-semibold text-ink sm:text-5xl">
            {place.name}
          </h1>
          <p className="mt-2 flex items-center gap-1.5 text-lg text-ink-soft">
            <Icon name="pin" size={18} /> {place.town}, {place.province}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <SaveButton slug={place.slug} variant="full" />
          <a
            href={directionsUrl(place)}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 rounded-full bg-forest px-5 py-3 text-sm font-semibold text-on-forest transition hover:bg-forest-deep"
          >
            <Icon name="route" size={17} /> Route plannen
          </a>
        </div>
      </header>

      <div className="mt-10 grid grid-cols-1 gap-8 lg:grid-cols-[1.2fr_1fr]">
        <div className="min-w-0 space-y-8">
          <section>
            <h2 className="mb-3 font-display text-2xl font-semibold text-ink">
              Wat je kunt verwachten
            </h2>
            <dl className="grid gap-px overflow-hidden rounded-2xl border border-line bg-line sm:grid-cols-2">
              {facts(place).map((f) => (
                <div
                  key={f.label}
                  className="flex items-start gap-3 bg-surface p-4"
                >
                  <span
                    className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${
                      f.known
                        ? "bg-forest-tint text-forest-deep"
                        : "bg-surface-2 text-muted"
                    }`}
                  >
                    <Icon name={f.icon} size={18} />
                  </span>
                  <div className="min-w-0">
                    <dt className="text-sm text-muted">{f.label}</dt>
                    <dd
                      className={
                        f.known ? "font-medium text-ink" : "text-muted italic"
                      }
                    >
                      {f.value}
                    </dd>
                  </div>
                </div>
              ))}
            </dl>
            <p className="mt-3 flex items-start gap-2 text-sm text-muted">
              <Icon name="info" size={16} className="mt-0.5 shrink-0" />
              Gegevens uit OpenStreetMap en de website van de plek. Check altijd
              even vooraf, zeker in het voor- en naseizoen.
            </p>
          </section>

          {(place.website || place.phone) && (
            <section>
              <h2 className="mb-3 font-display text-2xl font-semibold text-ink">
                Contact
              </h2>
              <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
                {place.website && (
                  <li>
                    <a
                      href={place.website}
                      target="_blank"
                      rel="noopener noreferrer nofollow"
                      className="flex items-center gap-3 p-4 transition hover:bg-surface-2"
                    >
                      <Icon name="globe" size={18} className="text-muted" />
                      <span className="min-w-0 flex-1 truncate font-medium text-ink">
                        {place.website
                          .replace(/^https?:\/\/(www\.)?/, "")
                          .replace(/\/$/, "")}
                      </span>
                      <Icon name="external" size={16} className="text-muted" />
                    </a>
                  </li>
                )}
                {place.phone?.split(/[;,]/).map((tel) => (
                  <li key={tel}>
                    <a
                      href={`tel:${tel.replace(/[^\d+]/g, "")}`}
                      className="flex items-center gap-3 p-4 transition hover:bg-surface-2"
                    >
                      <Icon name="phone" size={18} className="text-muted" />
                      <span className="font-medium text-ink tabular-nums">
                        {tel.trim()}
                      </span>
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        <aside className="min-w-0 space-y-3">
          <h2 className="font-display text-2xl font-semibold text-ink">
            Ligging
          </h2>
          <PlaceMap
            places={[place, ...nearby.map((n) => n.place)]}
            highlight={place.slug}
            fitKey={place.slug}
            className="h-80 rounded-2xl border border-line"
          />
          <p className="text-sm text-muted tabular-nums">
            {place.lat.toFixed(5)}, {place.lng.toFixed(5)}
          </p>
        </aside>
      </div>

      {nearby.length > 0 && (
        <section className="mt-14">
          <h2 className="mb-4 font-display text-2xl font-semibold text-ink">
            Ook in de buurt
          </h2>
          <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {nearby.map(({ place: p, km }) => (
              <li key={p.slug}>
                <PlaceCard place={p} km={km} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}

function facts(
  p: Place,
): { icon: IconName; label: string; value: string; known: boolean }[] {
  return [
    {
      icon: "euro",
      label: "Prijs",
      value:
        p.price === "gratis"
          ? "Gratis"
          : p.priceEur
            ? `${eur(p.priceEur)} per nacht`
            : p.price === "betaald"
              ? "Betaald, bedrag onbekend"
              : p.priceText
                ? formatPrice(p.priceText)
                : "Onbekend",
      known: !!(p.price || p.priceText),
    },
    {
      icon: "parking",
      label: "Aantal plekken",
      value: p.spots ? `${p.spots} camperplekken` : "Onbekend",
      known: !!p.spots,
    },
    {
      icon: "bolt",
      label: "Stroom",
      value: p.power ? "Aanwezig" : "Niet vermeld",
      known: !!p.power,
    },
    {
      icon: "paw",
      label: "Honden",
      value:
        p.dogs === true
          ? "Welkom"
          : p.dogs === false
            ? "Niet toegestaan"
            : "Onbekend",
      known: p.dogs !== undefined,
    },
    {
      icon: "waves",
      label: "Aan het water",
      value: p.water ? "Ja" : "Niet vermeld",
      known: !!p.water,
    },
    {
      icon: "clock",
      label: "Open",
      value: p.hours ?? "Onbekend",
      known: !!p.hours,
    },
  ];
}
