import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { getDepartureVisitors, getNearby, getPlace, getRedirect, getReviews, getTopPlaceSlugs } from "@/lib/places";
import { departureKind } from "@/lib/search";
import { nightTotal, TOTAL_PERSONS } from "@/lib/trip-extras";
import { cardPrice, RESERVATION_TEXT, reservationRuleOf, eur, extraLabel, formatDate, pluralize, scoreLabel, websiteLabel } from "@/lib/format";
import { knownFacts } from "@/lib/place-facts";
import { isIncomplete, lastChecked } from "@/lib/place-status";
import { NavigateButton } from "@/components/navigate";
import { SITE_URL } from "@/lib/env";
import { upgradePhotoUrl } from "@/lib/photos";
import { OPEN_GRAPH } from "@/lib/meta";
import { inBbox } from "@/lib/bbox";
import { areaPath, breadcrumbLd, ISLANDS, ldJson, provinceSlug } from "@/lib/seo-pages";
import { KIND_LABEL, type Place, type PlaceSummary } from "@/lib/types";
import { Icon } from "@/components/icons";
import { KIND_SIGN, Sign, type SignName } from "@/components/sign";
import { PlaceCard, SaveButton, ScoreBadge } from "@/components/place-ui";
import { PlaceMap } from "@/components/place-map";
import { pickFacilities } from "@/lib/facility-update";
import { Legend } from "@/components/legend";
import { Gallery, OutdatedNote, ReportProblem, ReviewList, ReviewSummary, RouteCard, ShareButton, TrackView, WriteReview } from "./client";
import { OwnerUpdate } from "./owner-update";
import { ownerValues } from "@/lib/owner-update";
import { PhotoUpload } from "./photo-upload";
import { CrowdStatusCard } from "./crowd-status";
import { DecisionGrid } from "./decision-grid";
import { FacilityGrid } from "./facility-grid";
import { DistanceFromMe } from "./live-facts";

// Alleen de top-100 tijdens de build: alle plekken prerenderen liep op Vercel stuk (RangeError). De rest wordt bij het
// eerste bezoek gerenderd ("blocking": params worden buiten <Suspense> afgewacht) en daarna uit de cache geserveerd.
export async function generateStaticParams() {
  return (await getTopPlaceSlugs()).map((slug) => ({ slug }));
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
    openGraph: { ...OPEN_GRAPH, images: place.imageUrl ? [{ url: upgradePhotoUrl(place.imageUrl) }] : OPEN_GRAPH.images },
  };
}

const FACILITY_ROWS: { key: keyof Place; sign: SignName; label: string; yes: string; no: string }[] = [
  { key: "power", sign: "power", label: "stroom", yes: "Stroom", no: "Geen stroom" },
  { key: "water", sign: "water", label: "water", yes: "Water innemen", no: "Geen water" },
  { key: "dumpStation", sign: "dump", label: "lozen", yes: "Lozen", no: "Niet lozen" },
  { key: "toilet", sign: "toilet", label: "toilet", yes: "Toilet", no: "Geen toilet" },
  { key: "shower", sign: "shower", label: "douche", yes: "Douche", no: "Geen douche" },
  { key: "wifi", sign: "wifi", label: "wifi", yes: "Wifi", no: "Geen wifi" },
  { key: "dogs", sign: "dog", label: "honden", yes: "Honden welkom", no: "Geen honden" },
];

/** "vanaf € 22,00 per nacht; hoogste genoemde tarief € 25,00": het "vanaf" staat al bij de prijs */
function priceNoteText(note: string) {
  const top = /hoogste genoemde tarief (€\s?[\d.,]+)/i.exec(note)?.[1];
  if (top) return `Duurste tarief ${top.replace(/,00$/, "")} per nacht.`;
  return `${note[0].toUpperCase()}${note.slice(1)}.`;
}

/** "a, b en c" */
const listNl = (xs: string[]) => (xs.length < 2 ? xs.join("") : `${xs.slice(0, -1).join(", ")} en ${xs[xs.length - 1]}`);

export default async function PlacePage({ params }: PageProps<"/plek/[slug]">) {
  const { slug } = await params;
  const place = await getPlace(slug);
  if (!place) {
    // Samengevoegde plek: oude links en zoekmachines naar de plek die is blijven staan
    const target = await getRedirect(slug);
    if (target) permanentRedirect(`/plek/${target}`);
    notFound();
  }
  const [reviews, nearby, visitors] = await Promise.all([getReviews(place.id), getNearby(place, 6), getDepartureVisitors(place.id)]);

  // Al gesorteerd en gefilterd in places.ts: de beste foto van de plek zelf staat vooraan
  const photos = place.photos;
  const address = [place.street, [place.postcode, place.town].filter(Boolean).join(" ")].filter(Boolean).join(", ");
  const tel = place.phone?.split(/[;,]/)[0]?.trim();

  const provPath = `/camperplaatsen/${provinceSlug(place.province)}`;
  const island = ISLANDS.find((i) => i.province === place.province && inBbox(place, i.bbox));

  // Alleen velden die we kennen; onbekend blijft weg (JSON.stringify laat undefined vallen)
  const amenities = FACILITY_ROWS.filter((f) => typeof place[f.key] === "boolean").map((f) => ({
    "@type": "LocationFeatureSpecification",
    name: f.yes,
    value: place[f.key] as boolean,
  }));
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Campground",
    name: place.name,
    url: `${SITE_URL}/plek/${place.slug}`,
    image: photos.length ? photos.map((p) => upgradePhotoUrl(p.url)) : undefined,
    description: place.description,
    address: { "@type": "PostalAddress", streetAddress: place.street, postalCode: place.postcode, addressLocality: place.town, addressRegion: place.province, addressCountry: "NL" },
    geo: { "@type": "GeoCoordinates", latitude: place.lat, longitude: place.lng },
    telephone: tel,
    petsAllowed: place.dogs,
    amenityFeature: amenities.length ? amenities : undefined,
    ...(place.ratingAvg && place.ratingCount
      ? { aggregateRating: { "@type": "AggregateRating", ratingValue: place.ratingAvg, bestRating: 10, worstRating: 1, ratingCount: place.ratingCount } }
      : {}),
  };
  const crumbs = breadcrumbLd(SITE_URL, [
    { name: "Start", path: "/" },
    { name: place.province, path: provPath },
    ...(island ? [{ name: island.name, path: areaPath(island.province, island.slug) }] : []),
    { name: place.name, path: `/plek/${place.slug}` },
  ]);

  const price = cardPrice(place);
  const rule = reservationRuleOf(place);
  // Laatste controle (website of vertrekcontrole); zonder die datum de laatste wijziging, maar dan geen "verouderd"
  const lastUpdate = lastChecked(place) ?? place.updatedAt;
  const reserveLabel = rule === "verplicht" || rule === "mogelijk" ? "Reserveren via de website" : "Naar de website";

  return (
    <article className="pb-24 md:pb-8">
      <TrackView slug={place.slug} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: ldJson(jsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: ldJson(crumbs) }} />

      <div className="mx-auto max-w-6xl sm:px-6 sm:pt-4">
        <nav aria-label="Kruimelpad" className="hidden items-center gap-1 pb-3 text-sm text-muted sm:flex">
          <Link href="/zoeken" className="-my-3 inline-block py-3 hover:text-forest hover:underline">Zoeken</Link>
          <Icon name="chevronRight" size={14} />
          <Link href={provPath} className="-my-3 inline-block py-3 hover:text-forest hover:underline">
            {place.province}
          </Link>
          <Icon name="chevronRight" size={14} />
          <span className="truncate text-ink-2">{place.name}</span>
        </nav>
        <Gallery slug={place.slug} name={place.name} photos={photos} kind={place.kind} town={place.town} />
      </div>

      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        {/* Kop (redesign 30 oktober 2026): naam, plaats, score en afstand in één blik; de rest staat in het beslisblok */}
        <header className="flex flex-col gap-2 pt-3 md:flex-row md:items-start md:justify-between md:pt-6">
          <div className="min-w-0">
            <h1 className="font-display text-[1.625rem] leading-tight font-semibold text-balance sm:text-4xl">{place.name}</h1>
            <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-ink-2">
              <Sign name={KIND_SIGN[place.kind ?? "camperplaats"]} size={20} />
              {place.kind ? KIND_LABEL[place.kind] : "Camperplaats"} in {address || place.town}, {place.province}
              <a href="#ligging" className="-mx-1 -my-3 inline-block px-1 py-3 font-semibold whitespace-nowrap text-forest underline underline-offset-2">
                Kaart
              </a>
            </p>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1">
              {place.ratingCount > 0 && place.ratingAvg ? (
                <a href="#reviews" className="-my-2 inline-flex items-center gap-2 py-2">
                  <span className="rounded-md rounded-bl-none bg-forest px-2 py-0.5 font-display font-semibold text-on-forest">{scoreLabel(place.ratingAvg)}</span>
                  <span className="text-sm font-semibold text-ink-2 underline-offset-2 hover:underline">
                    uit {pluralize(place.ratingCount, "review", "reviews")}
                  </span>
                </a>
              ) : (
                <a href="#reviews" className="-my-3 inline-block py-3 text-sm text-muted underline-offset-2 hover:underline">Nog geen reviews</a>
              )}
              <DistanceFromMe place={place} />
              {/* Op dezelfde regel als score en afstand: een compacte kop, het beslisblok komt eerder in beeld */}
              {lastUpdate && (
                <p className="text-sm text-muted">
                  Laatste update: {formatDate(lastUpdate)}
                  <OutdatedNote verifiedAt={place.verifiedAt} departureCheckedAt={place.departureCheckedAt} />
                </p>
              )}
            </div>
          </div>
          <div className="hidden shrink-0 gap-2 md:flex">
            <SaveButton slug={place.slug} variant="full" />
            <ShareButton title={place.name} />
          </div>
        </header>

        {/* Mobiel: beslissen, voorzieningen, beschrijving, ligging, ervaringen, praktisch. Groot scherm: zijkolom. */}
        <div className="mt-5 flex flex-col gap-8 lg:mt-6 lg:grid lg:grid-cols-[1.4fr_1fr] lg:grid-rows-[min-content_1fr] lg:gap-x-10">
          <div className="min-w-0 space-y-8 lg:col-start-1 lg:row-start-1">
            <DecisionGrid place={place} visitors={visitors} />
            <DecisionDetails place={place} />
            {/* Foto toevoegen staat onder het kernblok: eerst beslissen, dan bijdragen */}
            <div className="-mt-4 min-h-11">
              <PhotoUpload placeId={place.id} slug={place.slug} placeName={place.name} />
            </div>
            <CrowdStatusCard placeId={place.id} slug={place.slug} />

            {/* Voorzieningen */}
            <section aria-labelledby="voorzieningen">
              <div className="flex flex-wrap items-baseline justify-between gap-x-4">
                <h2 id="voorzieningen" className="font-display text-xl font-semibold sm:text-2xl">Voorzieningen</h2>
                <Legend />
              </div>
              <FacilityGrid placeId={place.id} placeName={place.name} values={pickFacilities(place)} />
            </section>

            {/* Over deze plek: alleen hele zinnen uit de eigen tekst van de plek (zie lib/description.ts) */}
            {place.description && (
              <section aria-labelledby="over">
                <h2 id="over" className="font-display text-xl font-semibold sm:text-2xl">Over deze plek</h2>
                <p className="mt-2 max-w-prose text-ink-2">{place.description}</p>
                <p className="mt-2 text-sm text-muted">Zo beschrijft de plek zichzelf op de eigen website.</p>
              </section>
            )}
          </div>

          {/* Zijkolom: op mobiel na de beschrijving */}
          <aside className="min-w-0 space-y-4 lg:sticky lg:top-20 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:self-start">
            <SideColumn place={place} tel={tel} nearby={nearby.map((n) => n.place)} reserveLabel={reserveLabel} />
          </aside>

          <div className="min-w-0 space-y-8 lg:col-start-1 lg:row-start-2">
            {/* Reviews */}
            <section aria-labelledby="reviews">
              <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                <h2 id="reviews" className="font-display text-xl font-semibold sm:text-2xl">Ervaringen</h2>
                <WriteReview placeId={place.id} placeName={place.name} slug={place.slug} />
              </div>
              {reviews.length > 0 ? (
                <div className="mt-4 space-y-6">
                  <ScoreBadge avg={place.ratingAvg} count={place.ratingCount} size="lg" />
                  <ReviewSummary reviews={reviews} />
                  <ReviewList reviews={reviews} />
                </div>
              ) : (
                <p className="mt-1 text-ink-2">Nog geen ervaringen van camperaars. Ben je hier geweest? Dan help je anderen met een review.</p>
              )}
            </section>

            <Practical place={place} address={address} tel={tel} reserveLabel={reserveLabel} />
          </div>
        </div>

        {nearby.length > 0 && (
          <section className="mt-10" aria-labelledby="buurt">
            <h2 id="buurt" className="font-display text-xl font-semibold sm:text-2xl">In de buurt</h2>
            <ul className="no-scrollbar -mx-4 mt-3 flex snap-x gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:grid sm:grid-cols-2 sm:px-0 lg:grid-cols-3">
              {nearby.map(({ place: p, km }) => (
                <li key={p.id} className="w-[75vw] max-w-xs shrink-0 snap-start sm:w-auto sm:max-w-none">
                  <PlaceCard place={p} km={km} layout="stack" />
                </li>
              ))}
            </ul>
          </section>
        )}
        <p className="mt-6 flex flex-wrap gap-x-5 gap-y-1">
          {island && (
            <Link href={areaPath(island.province, island.slug)} className="-my-3 inline-block py-3 font-semibold text-forest underline underline-offset-2">
              Alle camperplaatsen op {island.name}
            </Link>
          )}
          <Link href={provPath} className="-my-3 inline-block py-3 font-semibold text-forest underline underline-offset-2">
            Alle camperplaatsen in {place.province}
          </Link>
        </p>
      </div>

      {/* Vaste actiebalk op mobiel: altijd binnen één tik bellen, website of route */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 px-4 pt-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] backdrop-blur md:hidden">
        <div className="flex items-center gap-2">
          <div className="min-w-0 flex-1">
            <p className={`font-display leading-none font-semibold ${price ? "text-lg" : "text-sm text-muted"}`}>{price?.value ?? "Prijs onbekend"}</p>
            {price?.perNight && <p className="mt-0.5 truncate text-sm leading-tight text-muted">per nacht{price.extras ? " + extra's" : ""}</p>}
          </div>
          <SaveButton slug={place.slug} variant="bar" />
          {tel && (
            <a href={`tel:${tel.replace(/[^\d+]/g, "")}`} aria-label={`Bel ${place.name}`} className="grid h-11 w-11 place-items-center rounded-lg border border-line bg-surface">
              <Icon name="phone" size={19} />
            </a>
          )}
          {place.website && (
            <a href={place.website} target="_blank" rel="noopener noreferrer nofollow" aria-label={`${reserveLabel}: ${place.name}`} className="grid h-11 w-11 place-items-center rounded-lg border border-line bg-surface">
              <Icon name="globe" size={19} />
            </a>
          )}
          <NavigateButton to={place} name={place.name} className="flex h-11 items-center gap-2 rounded-lg bg-forest px-4 font-semibold text-on-forest hover:bg-forest-deep">
            <Icon name="route" size={18} /> Route
          </NavigateButton>
        </div>
      </div>
    </article>
  );
}

function SideColumn({ place, tel, nearby, reserveLabel }: { place: Place; tel?: string; nearby: PlaceSummary[]; reserveLabel: string }) {
  const facts = knownFacts(place);
  const missing = facts.filter((f) => !f.known).map((f) => f.label);
  return (
    <>
      <div className="hidden rounded-lg border border-line bg-surface p-5 md:block">
        <p className="font-display text-3xl font-semibold">
          {cardPrice(place)?.value ?? "Prijs onbekend"}
          {cardPrice(place)?.perNight ? <span className="ml-1 text-base font-semibold text-muted">per nacht</span> : null}
        </p>
        <div className="mt-4 grid gap-2">
          {place.website && (
            <a href={place.website} target="_blank" rel="noopener noreferrer nofollow" className="flex h-12 items-center justify-center gap-2 rounded-lg bg-forest font-semibold text-on-forest hover:bg-forest-deep">
              <Icon name="globe" size={19} /> {reserveLabel}
            </a>
          )}
          {tel && (
            <a href={`tel:${tel.replace(/[^\d+]/g, "")}`} className="flex h-12 items-center justify-center gap-2 rounded-lg border border-line font-semibold hover:border-forest">
              <Icon name="phone" size={19} /> {tel}
            </a>
          )}
          {place.email && (
            <a href={`mailto:${place.email}`} className="flex h-12 items-center justify-center gap-2 rounded-lg border border-line font-semibold hover:border-forest">
              <Icon name="mail" size={19} /> E-mail sturen
            </a>
          )}
        </div>
        {place.website && <p className="mt-3 text-center text-sm text-muted">{websiteLabel(place.website)}</p>}
      </div>

      <section id="ligging" aria-labelledby="ligging-kop" className="scroll-mt-20 space-y-3">
        <h2 id="ligging-kop" className="font-display text-xl font-semibold sm:text-2xl lg:sr-only">Ligging en route</h2>
        <PlaceMap
          places={[place, ...nearby]}
          highlight={place.slug}
          fitKey={place.slug}
          cluster={false}
          className="h-52 overflow-hidden rounded-lg border border-line lg:h-72"
        />
        <RouteCard to={{ lat: place.lat, lng: place.lng }} name={place.name} />
      </section>

      <div className="rounded-lg bg-sunken/60 p-4 text-sm text-ink-2">
        <p className="flex items-center gap-2 font-semibold text-ink">
          <Icon name="shield" size={17} className="text-forest" /> {facts.filter((f) => f.known).length} van {facts.length} gegevens bekend
        </p>
        {missing.length > 0 && (
          <p className="mt-1">Nog onbekend: {missing.join(", ")}. Weet jij dit? Laat het weten, dan vullen we het aan.</p>
        )}
        {missing.length === 0 && <p className="mt-1">Zie je iets dat niet klopt? Laat het weten, dan passen we het aan.</p>}
        <div className="mt-1 flex flex-wrap gap-x-5">
          <ReportProblem placeId={place.id} placeName={place.name} facilities={pickFacilities(place)} />
          <OwnerUpdate placeId={place.id} placeName={place.name} initial={ownerValues(place)} />
        </div>
      </div>
    </>
  );
}

/**
 * Het beslisblok: de vier dingen die een camperaar eerst wil weten, als rustige lijst. Vertrekken staat bovenaan
 * en is het enige dat mag opvallen (bosgroen bij geen vaste vertrektijd, meerblauw bij uitslapers).
 */
/**
 * Wat niet in de tegels van het beslisblok past: voorwaarden bij de vertrektijd, de andere tijden, de prijs in detail
 * (totaal voor 2 personen, toeristenbelasting, extra kosten) en de maximale lengte. Alleen wat we weten.
 */
function DecisionDetails({ place }: { place: Place }) {
  const claimed = place.departure === "vrij" || place.departure === "per24";
  // De bronzin staat alleen in beheer, niet op de site (besluit eigenaar 23 oktober 2026)
  const note =
    claimed && place.departureCheck === "voorwaardelijk"
      ? "Soms geldt er toch een vertrektijd, bijvoorbeeld als het druk is. Vraag het even na."
      : departureKind(place) === "vrij" && place.departureCheck === "bevestigd" && place.departureCheckedAt
          ? `Vertrektijd gecontroleerd ${place.departureCheckedBy === "eigenaar" ? "bij de eigenaar" : "door ons"} op ${formatDate(place.departureCheckedAt)}.`
          : undefined;
  // Later vertrekken tegen betaling hoort bij de vertrektijd, niet tussen de extra kosten
  const lateOption = place.priceExtras?.find((x) => x.label.startsWith("Later vertrekken"));
  const times = [
    lateOption && `${lateOption.label} kan voor ${eur(lateOption.amount)}`,
    place.accessHours && place.checkinFrom && `Slagboom of poort open ${place.accessHours}`,
    place.maxStayNights && `Maximaal ${pluralize(place.maxStayNights, "nacht", "nachten")}`,
    reservationRuleOf(place) && RESERVATION_TEXT[reservationRuleOf(place)!],
  ].filter(Boolean) as string[];
  const price = cardPrice(place);
  const extras = (place.priceExtras ?? []).filter((x) => x !== lateOption);
  const priceDetails = !!price && (place.priceNote || place.touristTaxIncluded !== undefined || extras.length > 0 || nightTotal(place).total !== undefined);
  const known = !departureKind(place) || isIncomplete(place);
  return (
    <section aria-label="Details over tijden en prijs" className="divide-y divide-line overflow-hidden rounded-lg border border-line bg-surface">
      {(note || times.length > 0 || known) && (
        <div className="space-y-1 px-4 py-3 text-ink-2">
          {note && <p className="text-sm">{note}</p>}
          {times.length > 0 && <p>{times.join(". ")}.</p>}
          {/* Eigenaren vullen het zelf in: we mailen ze niet (besluit eigenaar 18 en 24 oktober 2026) */}
          {known && <OwnerUpdate placeId={place.id} placeName={place.name} initial={ownerValues(place)} label="Eigenaar? Vul de tijden in" />}
        </div>
      )}
      {priceDetails && (
        <div className="space-y-1 px-4 py-3 text-sm text-ink-2">
          <NightTotalLine place={place} />
          {place.priceNote && <p>{priceNoteText(place.priceNote)}</p>}
          {place.touristTaxIncluded !== undefined && !onlyTaxOpen(place) && (
            <p>Toeristenbelasting {place.touristTaxIncluded ? "zit in de prijs" : "komt erbij"}.</p>
          )}
          {extras.length > 0 && (
            <details className="group">
              <summary className="-my-2 flex h-11 cursor-pointer list-none items-center gap-1 font-semibold text-forest [&::-webkit-details-marker]:hidden">
                Extra kosten ({extras.length})
                <Icon name="chevronDown" size={16} className="transition-transform group-open:rotate-180" />
              </summary>
              <ul className="divide-y divide-line">
                {extras.map((x) => (
                  <li key={x.label} className="flex justify-between gap-4 py-1.5">
                    <span>{x.label}</span>
                    <span className="text-right font-semibold text-ink">{extraLabel(x)}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-1 text-muted">Prijzen kunnen per seizoen verschillen.</p>
            </details>
          )}
        </div>
      )}
      <div className="flex items-center gap-3 px-4 py-3">
        <Sign name="length" size={26} state={place.maxLengthM ? "on" : "unknown"} />
        <span className="text-ink-2">Max. lengte</span>
        <span className={`ml-auto font-display font-semibold ${place.maxLengthM ? "" : "text-muted"}`}>
          {place.maxLengthM ? `${String(place.maxLengthM).replace(".", ",")} m` : "Onbekend"}
        </span>
      </div>
    </section>
  );
}

/**
 * Wat een nacht voor 2 personen kost, met toeristenbelasting en stroom. Alleen een bedrag als elk onderdeel vaststaat;
 * anders staat er wat ontbreekt. Zo ziet de bezoeker nooit een totaal dat volledig lijkt maar het niet is.
 */
const OPEN_REASON: Record<string, string> = {
  toeristenbelasting: "de toeristenbelasting is onbekend",
  "stroom (per kWh)": "stroom kost per kWh",
  stroom: "de stroomprijs per nacht is onbekend",
  "of de prijs per persoon erbij komt": "het is niet duidelijk of de prijs per persoon erbij komt",
};

/** Ontbreekt voor het totaal alleen het bedrag van de toeristenbelasting? Dan zegt één zin genoeg. */
function onlyTaxOpen(place: Place): boolean {
  const t = nightTotal(place);
  return t.total === undefined && t.open.length === 1 && t.open[0] === "toeristenbelasting";
}

function NightTotalLine({ place }: { place: Place }) {
  const t = nightTotal(place);
  if (t.open.includes("prijs per nacht")) return null;
  if (onlyTaxOpen(place)) {
    // Veruit het vaakst: de prijs staat er, alleen het bedrag van de toeristenbelasting niet
    return <p>Toeristenbelasting komt er {place.touristTaxIncluded === false ? "" : "mogelijk "}bij. De website noemt geen bedrag.</p>;
  }
  if (t.total === undefined) {
    const why = t.open.map((o) => OPEN_REASON[o] ?? o);
    const list = why.length > 1 ? `${why.slice(0, -1).join(", ")} en ${why.at(-1)}` : why[0];
    return <p>Een totaal voor {TOTAL_PERSONS} personen geven we nog niet, want {list}.</p>;
  }
  const noPower = !place.priceExtras?.some((x) => x.label === "Stroom");
  return (
    <p>
      Voor {TOTAL_PERSONS} personen {t.from ? "vanaf " : ""}
      <strong className="font-semibold text-ink">{eur(t.total)}</strong> per nacht
      {t.parts.length > 1 && ` (${t.parts.map((x) => `${x.label.toLowerCase()} ${eur(x.amount)}`).join(", ")})`}.
      {noPower && " Geen stroomtoeslag genoemd."}
    </p>
  );
}

/** Praktisch en contact: alleen wat we weten, de rest samen in één regel */
function Practical({ place, address, tel, reserveLabel }: { place: Place; address: string; tel?: string; reserveLabel: string }) {
  const rows: { label: string; value: React.ReactNode }[] = [];
  const unknown: string[] = [];
  const add = (label: string, value: React.ReactNode | undefined, missing: string) => (value === undefined ? unknown.push(missing) : rows.push({ label, value }));
  add("Aantal plekken", place.capacity ? String(place.capacity) : undefined, "aantal plekken");
  add("Ondergrond", place.surface ? place.surface[0].toUpperCase() + place.surface.slice(1) : undefined, "ondergrond");
  add("Maximaal verblijf", place.maxStayNights ? pluralize(place.maxStayNights, "nacht", "nachten") : undefined, "maximaal verblijf");
  rows.push({ label: "Adres", value: address ? `${address}, ${place.province}` : `${place.town}, ${place.province}` });
  if (tel)
    rows.push({
      label: "Telefoon",
      value: (
        <a href={`tel:${tel.replace(/[^\d+]/g, "")}`} className="-my-3 inline-block py-3 font-semibold text-forest underline underline-offset-2">
          {tel}
        </a>
      ),
    });
  if (place.website)
    rows.push({
      label: "Website",
      value: (
        <a
          href={place.website}
          target="_blank"
          rel="noopener noreferrer nofollow"
          aria-label={`${reserveLabel}: ${websiteLabel(place.website)}`}
          className="-my-3 inline-block py-3 font-semibold break-all text-forest underline underline-offset-2"
        >
          {websiteLabel(place.website)}
        </a>
      ),
    });
  if (place.email)
    rows.push({
      label: "E-mail",
      value: (
        <a href={`mailto:${place.email}`} className="-my-3 inline-block py-3 font-semibold break-all text-forest underline underline-offset-2">
          {place.email}
        </a>
      ),
    });
  return (
    <section aria-labelledby="praktisch">
      <h2 id="praktisch" className="font-display text-xl font-semibold sm:text-2xl">Praktisch en contact</h2>
      <dl className="mt-3 divide-y divide-line rounded-lg border border-line bg-surface">
        {rows.map((r) => (
          <div key={r.label} className="flex justify-between gap-4 px-4 py-2.5">
            <dt className="shrink-0 text-ink-2">{r.label}</dt>
            <dd className="min-w-0 text-right font-semibold">{r.value}</dd>
          </div>
        ))}
      </dl>
      {unknown.length > 0 && <p className="mt-2 text-sm text-muted">Nog onbekend: {listNl(unknown)}.</p>}
    </section>
  );
}
