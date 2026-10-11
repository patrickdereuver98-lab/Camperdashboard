import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getNearby, getPlace, getPlaces, getReviews } from "@/lib/places";
import { searchHref } from "@/lib/search";
import { cardPrice, departureShort, eur, extraLabel, formatDate, pluralize, websiteLabel } from "@/lib/format";
import { directionsUrl } from "@/lib/geo";
import { SITE_URL } from "@/lib/env";
import { KIND_LABEL, type Place, type PlaceSummary } from "@/lib/types";
import { Icon } from "@/components/icons";
import { KIND_SIGN, Sign, type SignName } from "@/components/sign";
import { OpenChip, PlaceCard, SaveButton, ScoreBadge } from "@/components/place-ui";
import { PlaceMap } from "@/components/place-map";
import { Gallery, ReportProblem, ReviewList, ReviewSummary, RouteCard, ShareButton, TrackView, WriteReview } from "./client";

export async function generateStaticParams() {
  const places = await getPlaces();
  return places.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: PageProps<"/plek/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const place = await getPlace(slug);
  if (!place) return { title: "Plek niet gevonden" };
  const price = place.priceEur === undefined ? "" : place.priceEur === 0 ? "Gratis. " : `${place.priceFrom ? "Vanaf " : ""}${eur(place.priceEur)} per nacht. `;
  return {
    title: `${place.name}, ${place.town}`,
    description: `${place.kind ? KIND_LABEL[place.kind] : "Camperplaats"} in ${place.town} (${place.province}). ${price}Bekijk voorzieningen, foto's, reviews en de route.`,
    alternates: { canonical: `/plek/${place.slug}` },
    openGraph: { images: place.imageUrl ? [{ url: place.imageUrl }] : undefined },
  };
}

type Fact = { sign: SignName; label: string; value: string; known: boolean };

function keyFacts(p: Place): Fact[] {
  const price = cardPrice(p);
  return [
    {
      sign: "euro",
      label: p.priceEur === undefined && price ? "Per persoon" : "Per nacht",
      value: price?.value ?? "Onbekend",
      known: !!price,
    },
    { sign: "clock", label: "Vertrekken", value: departureShort(p) ?? "Onbekend", known: !!p.departure },
    {
      sign: "calendar",
      label: "Open",
      value: p.openAllYear ? "Hele jaar" : (p.season ?? "Onbekend"),
      known: p.openAllYear === true || !!p.season,
    },
    {
      sign: "length",
      label: "Max. lengte",
      value: p.maxLengthM ? `${String(p.maxLengthM).replace(".", ",")} m` : "Onbekend",
      known: !!p.maxLengthM,
    },
  ];
}

const FACILITY_ROWS: { key: keyof Place; sign: SignName; label: string; yes: string; no: string }[] = [
  { key: "power", sign: "power", label: "Stroom", yes: "Aanwezig", no: "Niet aanwezig" },
  { key: "water", sign: "water", label: "Water innemen", yes: "Mogelijk", no: "Niet mogelijk" },
  { key: "dumpStation", sign: "dump", label: "Lozen", yes: "Mogelijk", no: "Niet mogelijk" },
  { key: "toilet", sign: "toilet", label: "Toilet", yes: "Aanwezig", no: "Niet aanwezig" },
  { key: "shower", sign: "shower", label: "Douche", yes: "Aanwezig", no: "Niet aanwezig" },
  { key: "wifi", sign: "wifi", label: "Wifi", yes: "Aanwezig", no: "Niet aanwezig" },
  { key: "dogs", sign: "dog", label: "Honden", yes: "Welkom", no: "Niet toegestaan" },
];

export default async function PlacePage({ params }: PageProps<"/plek/[slug]">) {
  const { slug } = await params;
  const place = await getPlace(slug);
  if (!place) notFound();
  const [reviews, nearby] = await Promise.all([getReviews(place.id), getNearby(place, 6)]);

  const photos = [...(place.photos ?? [])];
  if (place.imageUrl && !photos.some((p) => p.url === place.imageUrl)) photos.unshift({ url: place.imageUrl, credit: place.imageCredit });
  const address = [place.street, [place.postcode, place.town].filter(Boolean).join(" ")].filter(Boolean).join(", ");
  const tel = place.phone?.split(/[;,]/)[0]?.trim();

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Campground",
    name: place.name,
    url: `${SITE_URL}/plek/${place.slug}`,
    image: photos.map((p) => p.url),
    address: { "@type": "PostalAddress", streetAddress: place.street, postalCode: place.postcode, addressLocality: place.town, addressRegion: place.province, addressCountry: "NL" },
    geo: { "@type": "GeoCoordinates", latitude: place.lat, longitude: place.lng },
    telephone: tel,
    petsAllowed: place.dogs,
    ...(place.ratingAvg && place.ratingCount
      ? { aggregateRating: { "@type": "AggregateRating", ratingValue: place.ratingAvg, bestRating: 10, worstRating: 1, ratingCount: place.ratingCount } }
      : {}),
  };

  return (
    <article className="pb-24 md:pb-8">
      <TrackView slug={place.slug} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />

      <div className="mx-auto max-w-6xl sm:px-6 sm:pt-4">
        <nav aria-label="Kruimelpad" className="hidden items-center gap-1 pb-3 text-sm text-muted sm:flex">
          <Link href="/zoeken" className="hover:text-forest hover:underline">Zoeken</Link>
          <Icon name="chevronRight" size={14} />
          <Link href={searchHref({ province: place.province, where: place.province })} className="hover:text-forest hover:underline">
            {place.province}
          </Link>
          <Icon name="chevronRight" size={14} />
          <span className="truncate text-ink-2">{place.name}</span>
        </nav>
        <Gallery slug={place.slug} name={place.name} photos={photos} kind={place.kind} town={place.town} />
      </div>

      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        {/* Kop */}
        <header className="flex flex-col gap-4 pt-5 md:flex-row md:items-start md:justify-between">
          <div className="min-w-0">
            <p className="flex items-center gap-2 text-ink-2">
              <Sign name={KIND_SIGN[place.kind ?? "camperplaats"]} size={26} />
              {place.kind ? KIND_LABEL[place.kind] : "Camperplaats"}
            </p>
            <h1 className="mt-2 font-display text-3xl leading-tight font-semibold sm:text-4xl">{place.name}</h1>
            <p className="mt-2 flex items-start gap-1.5 text-ink-2">
              <Icon name="pin" size={18} className="mt-1 shrink-0 text-muted" />
              <span>
                {address || place.town}, {place.province}{" "}
                <a href="#ligging" className="-my-2 inline-block py-2 font-semibold text-forest underline">
                  Toon op kaart
                </a>
              </span>
            </p>
            <div className="mt-2">
              <OpenChip place={place} />
            </div>
          </div>
          {place.ratingCount > 0 && (
            <div className="flex shrink-0 items-center gap-4">
              <ScoreBadge avg={place.ratingAvg} count={place.ratingCount} size="lg" />
            </div>
          )}
        </header>

        <div className="mt-4 hidden gap-2 md:flex">
          <SaveButton slug={place.slug} variant="full" />
          <ShareButton title={place.name} />
        </div>

        {/* Kerngegevens */}
        <dl className="mt-6 grid grid-cols-2 gap-px overflow-hidden rounded-2xl bg-line outline-1 outline-line outline md:grid-cols-4">
          {keyFacts(place).map((f) => (
            <div key={f.label} className="flex items-center gap-3 bg-surface p-4">
              <Sign name={f.sign} size={34} state={f.known ? "on" : "unknown"} />
              <div className="min-w-0">
                <dt className="text-sm text-muted">{f.label}</dt>
                <dd className={`font-display text-lg leading-tight font-semibold ${f.known ? "" : "text-muted"}`}>{f.value}</dd>
              </div>
            </div>
          ))}
        </dl>
        <Departure place={place} />
        <PriceDetails place={place} />

        {/* Contact op mobiel (op grotere schermen in de zijkolom) */}
        {(place.website || tel || place.email) && (
          <div className="mt-4 grid grid-cols-2 gap-2 md:hidden">
            {place.website && (
              <a href={place.website} target="_blank" rel="noopener noreferrer nofollow" className="col-span-2 flex h-12 items-center justify-center gap-2 rounded-xl border-2 border-line bg-surface font-semibold">
                <Icon name="globe" size={19} /> {place.reservation ? "Reserveren op de website" : "Naar de website"}
              </a>
            )}
            {tel && (
              <a href={`tel:${tel.replace(/[^\d+]/g, "")}`} className="flex h-12 items-center justify-center gap-2 rounded-xl border-2 border-line bg-surface font-semibold">
                <Icon name="phone" size={19} /> Bellen
              </a>
            )}
            {place.email && (
              <a href={`mailto:${place.email}`} className="flex h-12 items-center justify-center gap-2 rounded-xl border-2 border-line bg-surface font-semibold">
                <Icon name="mail" size={19} /> E-mail
              </a>
            )}
            <ShareButton title={place.name} className={(tel ? 1 : 0) + (place.email ? 1 : 0) === 1 ? "" : "col-span-2"} />
          </div>
        )}

        {/* Mobiel: voorzieningen, dan route en kaart, dan de rest. Groot scherm: twee kolommen met zijkolom. */}
        <div className="mt-8 flex flex-col gap-10 lg:grid lg:grid-cols-[1.4fr_1fr] lg:grid-rows-[min-content_1fr] lg:gap-x-10">
          <div className="min-w-0 space-y-10 lg:col-start-1 lg:row-start-1">
            {/* Voorzieningen */}
            <section aria-labelledby="voorzieningen">
              <h2 id="voorzieningen" className="font-display text-2xl font-semibold">Voorzieningen</h2>
              <ul className="mt-4 grid grid-cols-2 gap-2">
                {FACILITY_ROWS.map((f) => {
                  const v = place[f.key] as boolean | undefined;
                  return (
                    <li key={f.label} className="flex items-center gap-2.5 rounded-xl bg-surface p-2.5 outline-1 outline-line outline sm:gap-3 sm:p-3">
                      <Sign name={f.sign} size={32} state={v === true ? "on" : v === false ? "off" : "unknown"} />
                      <span className="min-w-0">
                        <span className="block leading-tight font-semibold">{f.label}</span>
                        <span className={`block text-sm leading-tight ${v === undefined ? "text-muted" : "text-ink-2"}`}>
                          {v === true ? f.yes : v === false ? f.no : "Onbekend"}
                        </span>
                      </span>
                    </li>
                  );
                })}
              </ul>
            </section>

            {/* Over deze plek */}
            {place.description && (
              <section aria-labelledby="over">
                <h2 id="over" className="font-display text-2xl font-semibold">Over deze plek</h2>
                <blockquote className="mt-3 border-l-4 border-forest pl-4 text-lg text-ink-2">{place.description}</blockquote>
                <p className="mt-2 text-sm text-muted">
                  {place.descriptionSource === "website" ? "Volgens de website van de plek" : "Uit OpenStreetMap"}
                </p>
              </section>
            )}

          </div>

          {/* Zijkolom: op mobiel tussen de voorzieningen en de praktische info */}
          <aside className="min-w-0 space-y-4 lg:sticky lg:top-20 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:self-start">
            <SideColumn place={place} tel={tel} nearby={nearby.map((n) => n.place)} />
          </aside>

          <div className="min-w-0 space-y-10 lg:col-start-1 lg:row-start-2">
            {/* Praktisch */}
            <section aria-labelledby="praktisch">
              <h2 id="praktisch" className="font-display text-2xl font-semibold">Praktisch</h2>
              <dl className="mt-3 divide-y divide-line rounded-2xl bg-surface outline-1 outline-line outline">
                {[
                  ["Reserveren", place.reservation === undefined ? "Onbekend" : place.reservation ? "Ja" : "Nee"],
                  ["Aantal plekken", place.capacity ? String(place.capacity) : "Onbekend"],
                  ["Toeristenbelasting", place.touristTaxIncluded === undefined ? "Onbekend" : place.touristTaxIncluded ? "Inbegrepen in de prijs" : "Komt bij de prijs"],
                  ["Ondergrond", place.surface ? place.surface[0].toUpperCase() + place.surface.slice(1) : "Onbekend"],
                  ["Maximaal verblijf", place.maxStayNights ? pluralize(place.maxStayNights, "nacht", "nachten") : "Onbekend"],
                  ["Adres", address ? `${address}, ${place.province}` : `${place.town}, ${place.province}`],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-4 px-4 py-3">
                    <dt className="text-ink-2">{k}</dt>
                    <dd className={`text-right ${v === "Onbekend" ? "text-muted" : "font-semibold"}`}>{v}</dd>
                  </div>
                ))}
              </dl>
            </section>

            {/* Reviews */}
            <section aria-labelledby="reviews">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h2 id="reviews" className="font-display text-2xl font-semibold">Ervaringen van camperaars</h2>
                  {place.ratingCount > 0 && (
                    <div className="mt-2">
                      <ScoreBadge avg={place.ratingAvg} count={place.ratingCount} size="lg" />
                    </div>
                  )}
                </div>
                <WriteReview placeId={place.id} placeName={place.name} />
              </div>
              {reviews.length > 0 ? (
                <div className="mt-6 space-y-6">
                  <ReviewSummary reviews={reviews} />
                  <ReviewList reviews={reviews} />
                </div>
              ) : (
                <p className="mt-4 rounded-2xl bg-surface p-5 text-ink-2 outline-1 outline-line outline">
                  Nog geen reviews. Ben je hier geweest? Help andere camperaars met je ervaring.
                </p>
              )}
            </section>
          </div>

        </div>

        {nearby.length > 0 && (
          <section className="mt-12" aria-labelledby="buurt">
            <h2 id="buurt" className="font-display text-2xl font-semibold">In de buurt</h2>
            <ul className="no-scrollbar -mx-4 mt-4 flex snap-x gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:grid sm:grid-cols-2 sm:px-0 lg:grid-cols-3">
              {nearby.map(({ place: p, km }) => (
                <li key={p.id} className="w-[80vw] max-w-sm shrink-0 snap-start sm:w-auto sm:max-w-none">
                  <PlaceCard place={p} km={km} layout="stack" />
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>

      {/* Vaste actiebalk op mobiel */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] md:hidden">
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className={`font-display leading-none font-semibold ${cardPrice(place) ? "text-xl" : "text-base text-muted"}`}>
              {cardPrice(place)?.value ?? "Prijs onbekend"}
            </p>
            {!!place.priceEur && <p className="text-sm text-muted">per nacht{place.priceExtras?.length ? " + extra's" : ""}</p>}
          </div>
          <SaveButton slug={place.slug} />
          {tel && (
            <a href={`tel:${tel.replace(/[^\d+]/g, "")}`} aria-label={`Bel ${place.name}`} className="grid h-12 w-12 place-items-center rounded-xl border-2 border-line">
              <Icon name="phone" size={20} />
            </a>
          )}
          {place.website && (
            <a href={place.website} target="_blank" rel="noopener noreferrer nofollow" aria-label={`Website van ${place.name}`} className="grid h-12 w-12 place-items-center rounded-xl border-2 border-line">
              <Icon name="globe" size={20} />
            </a>
          )}
          <a href={directionsUrl(place)} target="_blank" rel="noopener noreferrer" className="flex h-12 items-center gap-2 rounded-xl bg-forest px-4 font-semibold text-on-forest">
            <Icon name="route" size={19} /> Route
          </a>
        </div>
      </div>
    </article>
  );
}

function SideColumn({ place, tel, nearby }: { place: Place; tel?: string; nearby: PlaceSummary[] }) {
  return (
    <>
      <div className="hidden rounded-2xl bg-surface p-5 outline-1 outline-line outline md:block">
        <p className="font-display text-3xl font-semibold">
          {cardPrice(place)?.value ?? "Prijs onbekend"}
          {place.priceEur ? <span className="ml-1 text-base font-semibold text-muted">per nacht</span> : null}
        </p>
        <div className="mt-4 grid gap-2">
          {place.website && (
            <a href={place.website} target="_blank" rel="noopener noreferrer nofollow" className="flex h-12 items-center justify-center gap-2 rounded-xl bg-forest font-semibold text-on-forest hover:bg-forest-deep">
              <Icon name="globe" size={19} /> {place.reservation ? "Reserveren op de website" : "Naar de website"}
            </a>
          )}
          {tel && (
            <a href={`tel:${tel.replace(/[^\d+]/g, "")}`} className="flex h-12 items-center justify-center gap-2 rounded-xl border-2 border-line font-semibold hover:border-forest">
              <Icon name="phone" size={19} /> {tel}
            </a>
          )}
          {place.email && (
            <a href={`mailto:${place.email}`} className="flex h-12 items-center justify-center gap-2 rounded-xl border-2 border-line font-semibold hover:border-forest">
              <Icon name="mail" size={19} /> E-mail sturen
            </a>
          )}
        </div>
        {place.website && <p className="mt-3 text-center text-sm text-muted">{websiteLabel(place.website)}</p>}
      </div>

      <RouteCard to={{ lat: place.lat, lng: place.lng }} name={place.name} />

      <section id="ligging" aria-label="Ligging" className="scroll-mt-24">
        <PlaceMap
          places={[place, ...nearby]}
          highlight={place.slug}
          fitKey={place.slug}
          cluster={false}
          className="h-72 rounded-2xl outline-1 outline-line outline"
        />
      </section>

      <div className="rounded-2xl bg-surface p-5 text-sm text-ink-2 outline-1 outline-line outline">
        <p className="flex items-center gap-2 font-semibold text-ink">
          <Icon name="shield" size={18} className="text-forest" /> {Math.round(place.completeness * 100)}% van de gegevens bekend
        </p>
        <p className="mt-1">
          Bronnen: OpenStreetMap{place.verifiedAt ? " en de website van de plek" : ""}.
          {place.verifiedAt ? ` Gegevens bijgewerkt op ${formatDate(place.verifiedAt)}.` : ""} Onbekende gegevens laten we leeg in plaats van te gokken.
        </p>
        <div className="mt-2">
          <ReportProblem placeId={place.id} placeName={place.name} />
        </div>
      </div>
    </>
  );
}

/** De kernbelofte: kun je vertrekken wanneer je wilt? Met de letterlijke bron als bewijs. */
function Departure({ place }: { place: Place }) {
  const free = place.departure === "vrij" || place.departure === "per24";
  const title =
    place.departure === "vrij"
      ? "Geen vaste vertrektijd"
      : place.departure === "per24"
        ? "Geen vaste vertrektijd: je betaalt per 24 uur"
        : place.departure === "vast"
          ? place.checkoutUntil
            ? `Vertrekken vóór ${place.checkoutUntil}`
            : "Vaste vertrektijd"
          : "Vertrektijd nog onbekend";
  const lines = [
    place.checkinFrom && `Aankomst vanaf ${place.checkinFrom}`,
    place.accessHours && `Slagboom of poort open ${place.accessHours}`,
    place.access24h && !place.accessHours && "24 uur per dag toegankelijk",
    place.maxStayNights && `Maximaal ${pluralize(place.maxStayNights, "nacht", "nachten")}`,
  ].filter(Boolean) as string[];
  const fromOsm = place.timesNote === "Volgens OpenStreetMap";
  return (
    <section
      aria-labelledby="vertrek"
      className={`mt-4 rounded-2xl p-4 outline-1 outline ${free ? "bg-forest-tint outline-forest/40" : "bg-surface outline-line"}`}
    >
      <div className="flex items-center gap-3">
        <Sign name="clock" size={34} state={place.departure ? "on" : "unknown"} />
        <div className="min-w-0">
          <p className="text-sm text-muted">Aankomen en vertrekken</p>
          <h2 id="vertrek" className={`font-display text-lg leading-tight font-semibold ${place.departure ? (free ? "text-forest" : "") : "text-muted"}`}>
            {title}
          </h2>
        </div>
      </div>
      {lines.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-ink-2">
          {lines.map((l) => (
            <li key={l}>{l}</li>
          ))}
        </ul>
      )}
      {place.timesNote && !fromOsm && (
        <p className="mt-3 border-l-4 border-line pl-3 text-sm text-ink-2">
          Volgens de website{place.verifiedAt ? ` (gelezen ${formatDate(place.verifiedAt)})` : ""}: &ldquo;{place.timesNote}&rdquo;
        </p>
      )}
      {fromOsm && <p className="mt-3 text-sm text-muted">Volgens OpenStreetMap.</p>}
      {!place.departure && (
        <div className="mt-2 text-sm">
          <p className="text-ink-2">De website noemt geen aankomst- of vertrektijden. Bel bij twijfel even, of laat het ons weten als je het weet.</p>
          <ReportProblem placeId={place.id} placeName={place.name} topic="vertrektijd" label="Weet jij de vertrektijd? Laat het weten" />
        </div>
      )}
    </section>
  );
}

/** Prijs zo transparant mogelijk: basistarief, bandbreedte en alle losse toeslagen die de website noemt */
function PriceDetails({ place }: { place: Place }) {
  const extras = place.priceExtras ?? [];
  if (!place.priceNote && !extras.length && place.touristTaxIncluded === undefined) return null;
  return (
    <section aria-labelledby="prijs" className="mt-3 rounded-2xl bg-surface p-4 outline-1 outline-line outline">
      <h2 id="prijs" className="font-semibold">Prijs en extra kosten</h2>
      {place.priceNote && <p className="mt-1 text-ink-2">{place.priceNote[0].toUpperCase() + place.priceNote.slice(1)}.</p>}
      {place.touristTaxIncluded !== undefined && (
        <p className="mt-1 text-ink-2">Toeristenbelasting {place.touristTaxIncluded ? "zit in de prijs" : "komt bij de prijs"}.</p>
      )}
      {extras.length > 0 && (
        <dl className="mt-2 divide-y divide-line">
          {extras.map((x) => (
            <div key={x.label} className="flex justify-between gap-4 py-2">
              <dt className="text-ink-2">{x.label}</dt>
              <dd className="text-right font-semibold">{extraLabel(x)}</dd>
            </div>
          ))}
        </dl>
      )}
      <p className="mt-2 text-sm text-muted">
        Zoals de website van de plek het noemt{place.verifiedAt ? `, gelezen op ${formatDate(place.verifiedAt)}` : ""}. Prijzen kunnen per seizoen
        verschillen.
      </p>
    </section>
  );
}
