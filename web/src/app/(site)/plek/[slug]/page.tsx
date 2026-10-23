import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { getNearby, getPlace, getRedirect, getReviews, getTopPlaceSlugs } from "@/lib/places";
import { departureKind, searchHref } from "@/lib/search";
import { nightTotal, TOTAL_PERSONS } from "@/lib/trip-extras";
import { arrivalText, cardPrice, departureLong, RESERVATION_TEXT, reservationRuleOf, eur, extraLabel, formatDate, pluralize, timesSourceLine, websiteLabel } from "@/lib/format";
import { knownFacts } from "@/lib/place-facts";
import { isIncomplete, lastChecked } from "@/lib/place-status";
import { GiveDepartureButton } from "@/components/departure-form";
import { NavigateButton } from "@/components/navigate";
import { SITE_URL } from "@/lib/env";
import { upgradePhotoUrl } from "@/lib/photos";
import { OPEN_GRAPH } from "@/lib/meta";
import { KIND_LABEL, type Place, type PlaceSummary } from "@/lib/types";
import { Icon } from "@/components/icons";
import { KIND_SIGN, Sign, type SignName } from "@/components/sign";
import { OpenChip, PlaceCard, SaveButton, ScoreBadge } from "@/components/place-ui";
import { PlaceMap } from "@/components/place-map";
import { Legend } from "@/components/legend";
import { Gallery, OutdatedNote, ReportProblem, ReviewList, ReviewSummary, RouteCard, ShareButton, TrackView, WriteReview } from "./client";
import { OwnerUpdate } from "./owner-update";
import { ownerValues } from "@/lib/owner-update";
import { PhotoUpload } from "./photo-upload";
import { CrowdStatusCard } from "./crowd-status";

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

type Row = { sign: SignName; label: string; value: string; known: boolean; tone?: "free" | "late" };

function facilityText(f: (typeof FACILITY_ROWS)[number], v: boolean) {
  return v ? f.yes : f.no;
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
  const [reviews, nearby] = await Promise.all([getReviews(place.id), getNearby(place, 6)]);

  // Al gesorteerd en gefilterd in places.ts: de beste foto van de plek zelf staat vooraan
  const photos = place.photos;
  const address = [place.street, [place.postcode, place.town].filter(Boolean).join(" ")].filter(Boolean).join(", ");
  const tel = place.phone?.split(/[;,]/)[0]?.trim();

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Campground",
    name: place.name,
    url: `${SITE_URL}/plek/${place.slug}`,
    image: photos.map((p) => upgradePhotoUrl(p.url)),
    address: { "@type": "PostalAddress", streetAddress: place.street, postalCode: place.postcode, addressLocality: place.town, addressRegion: place.province, addressCountry: "NL" },
    geo: { "@type": "GeoCoordinates", latitude: place.lat, longitude: place.lng },
    telephone: tel,
    petsAllowed: place.dogs,
    ...(place.ratingAvg && place.ratingCount
      ? { aggregateRating: { "@type": "AggregateRating", ratingValue: place.ratingAvg, bestRating: 10, worstRating: 1, ratingCount: place.ratingCount } }
      : {}),
  };

  const price = cardPrice(place);
  const rule = reservationRuleOf(place);
  // Laatste controle (website of vertrekcontrole); zonder die datum de laatste wijziging, maar dan geen "verouderd"
  const lastUpdate = lastChecked(place) ?? place.updatedAt;
  const reserveLabel = rule === "verplicht" || rule === "mogelijk" ? "Reserveren via de website" : "Naar de website";

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
      <div className="mx-auto min-h-14 max-w-6xl px-4 pt-3 sm:px-6">
        <PhotoUpload placeId={place.id} slug={place.slug} placeName={place.name} />
      </div>

      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        {/* Kop: wat en waar, in één blik */}
        <header className="flex flex-col gap-3 pt-4 md:flex-row md:items-start md:justify-between md:pt-6">
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 text-sm text-ink-2">
              <Sign name={KIND_SIGN[place.kind ?? "camperplaats"]} size={20} />
              {place.kind ? KIND_LABEL[place.kind] : "Camperplaats"}
            </p>
            <h1 className="mt-1 font-display text-[1.625rem] leading-tight font-semibold text-balance sm:text-4xl">{place.name}</h1>
            <p className="mt-1 text-[0.9375rem] text-ink-2 sm:text-base">
              {address || place.town}, {place.province}{" "}
              <a href="#ligging" className="-my-3 inline-block py-3 font-semibold whitespace-nowrap text-forest underline underline-offset-2">
                Kaart
              </a>
            </p>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1">
              <OpenChip place={place} />
              {place.ratingCount > 0 && <ScoreBadge avg={place.ratingAvg} count={place.ratingCount} />}
              {lastUpdate && (
                <span className="text-sm text-muted">
                  Laatste update: {formatDate(lastUpdate)}
                  <OutdatedNote verifiedAt={place.verifiedAt} departureCheckedAt={place.departureCheckedAt} />
                </span>
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
            <Decision place={place} />
            <CrowdStatusCard placeId={place.id} slug={place.slug} />

            {/* Voorzieningen */}
            <section aria-labelledby="voorzieningen">
              <div className="flex flex-wrap items-baseline justify-between gap-x-4">
                <h2 id="voorzieningen" className="font-display text-xl font-semibold sm:text-2xl">Voorzieningen</h2>
                <Legend />
              </div>
              <Facilities place={place} />
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
      </div>

      {/* Vaste actiebalk op mobiel: altijd binnen één tik bellen, website of route */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 px-4 pt-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] backdrop-blur md:hidden">
        <div className="flex items-center gap-2">
          <div className="min-w-0 flex-1">
            <p className={`font-display leading-none font-semibold ${price ? "text-lg" : "text-sm text-muted"}`}>{price?.value ?? "Prijs onbekend"}</p>
            {price?.perNight && <p className="mt-0.5 truncate text-sm leading-tight text-muted">per nacht{price.extras ? " + extra's" : ""}</p>}
          </div>
          <SaveButton slug={place.slug} />
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
      <div className="hidden rounded-xl bg-surface p-5 shadow-low md:block">
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
          className="h-52 rounded-xl shadow-low lg:h-72"
        />
        <RouteCard to={{ lat: place.lat, lng: place.lng }} name={place.name} />
      </section>

      <div className="rounded-xl bg-sunken/60 p-4 text-sm text-ink-2">
        <p className="flex items-center gap-2 font-semibold text-ink">
          <Icon name="shield" size={17} className="text-forest" /> {facts.filter((f) => f.known).length} van {facts.length} gegevens bekend
        </p>
        {missing.length > 0 && (
          <p className="mt-1">Nog onbekend: {missing.join(", ")}. Weet jij dit? Laat het weten, dan vullen we het aan.</p>
        )}
        {missing.length === 0 && <p className="mt-1">Zie je iets dat niet klopt? Laat het weten, dan passen we het aan.</p>}
        <div className="mt-1 flex flex-wrap gap-x-5">
          <ReportProblem placeId={place.id} placeName={place.name} />
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
function Decision({ place }: { place: Place }) {
  const kind = departureKind(place);
  // Groen bij geen vaste vertrektijd: een bron is genoeg (besluit eigenaar 18 oktober 2026). Met voorwaarde of
  // afgewezen door beheer is het geen "vrij" meer.
  const free = kind === "vrij";
  const late = kind === "uitslapers";
  const claimed = place.departure === "vrij" || place.departure === "per24";
  const known = claimed ? place.departureCheck !== "afgewezen" : !!place.departure;
  const departure = departureLong(place);
  const incomplete = isIncomplete(place);
  // De letterlijke bronzin mag blijven, maar klein (besluit eigenaar 19 oktober 2026). Alleen als de vertrekregel
  // ook getoond wordt; bij "Onbekend" zou het citaat het tegenspreken.
  const source = known ? timesSourceLine(place.timesNote) : undefined;
  const note =
    claimed && place.departureCheck === "voorwaardelijk"
      ? "Soms geldt er toch een vertrektijd, bijvoorbeeld als het druk is. Vraag het even na."
      : free && place.departureCheck === "bevestigd" && place.departureCheckedAt
          ? `Gecontroleerd ${place.departureCheckedBy === "eigenaar" ? "bij de eigenaar" : "door ons"} op ${formatDate(place.departureCheckedAt)}.`
          : undefined;
  const times = [
    arrivalText(place),
    place.accessHours && `Slagboom of poort open ${place.accessHours}`,
    place.access24h && !place.accessHours && "24 uur per dag toegankelijk",
    place.maxStayNights && `Maximaal ${pluralize(place.maxStayNights, "nacht", "nachten")}`,
    reservationRuleOf(place) && RESERVATION_TEXT[reservationRuleOf(place)!],
  ].filter(Boolean) as string[];
  const price = cardPrice(place);
  const extras = place.priceExtras ?? [];
  const rows: Row[] = [
    {
      sign: "euro",
      label: price?.perPerson ? (price.perNight ? "Per persoon per nacht" : "Per persoon") : "Per nacht",
      value: price?.value ?? "Onbekend",
      known: !!price,
    },
    {
      sign: "calendar",
      label: "Open",
      value: place.openAllYear ? "Hele jaar" : (place.season?.replace(" – ", " t/m ") ?? "Onbekend"),
      known: place.openAllYear === true || !!place.season,
    },
    {
      sign: "length",
      label: "Max. lengte",
      value: place.maxLengthM ? `${String(place.maxLengthM).replace(".", ",")} m` : "Onbekend",
      known: !!place.maxLengthM,
    },
  ];
  return (
    <section aria-labelledby="kort" className="overflow-hidden rounded-xl bg-surface shadow-low">
      <h2 id="kort" className="sr-only">In het kort</h2>
      <dl className="divide-y divide-line">
        {/* Vertrekken: het kernfeit */}
        <div className="px-4 py-3">
          <div className="flex items-center gap-3">
            <Sign name="clock" size={28} state={free || (known && !claimed) ? "on" : "unknown"} tone={late ? "lake" : "forest"} />
            <dt className="text-ink-2">Vertrekken</dt>
            <dd
              className={`ml-auto text-right font-display text-[1.0625rem] leading-snug font-semibold ${
                free ? "text-forest" : late ? "text-lake" : known ? "" : "text-muted"
              }`}
            >
              {departure}
            </dd>
          </div>
          {source && <dd className="mt-1 pl-10 text-sm leading-snug text-muted break-words">{source}</dd>}
          {note && <dd className="mt-1 pl-10 text-sm text-ink-2">{note}</dd>}
          {times.length > 0 && <dd className="mt-1 pl-10 text-sm text-ink-2">{times.join(". ")}.</dd>}
          {incomplete && (
            <dd className="mt-2 pl-10">
              <p className="text-sm text-ink-2">
                We weten de vertrektijd van deze plek nog niet. Heb je er gestaan of gebeld, geef het dan door. Zo weten
                andere camperaars hoe laat ze weg moeten.
              </p>
              <div className="mt-2">
                <GiveDepartureButton placeId={place.id} placeName={place.name} />
              </div>
            </dd>
          )}
          {!known && !incomplete && (
            <dd className="mt-1 pl-10 text-sm text-ink-2">
              Bel even voor je gaat.
              <ReportProblem placeId={place.id} placeName={place.name} topic="vertrektijd" label="Weet jij de vertrektijd?" />
            </dd>
          )}
        </div>

        {rows.map((r) => (
          <div key={r.label} className="px-4 py-3">
            <div className="flex items-center gap-3">
              <Sign name={r.sign} size={28} state={r.known ? "on" : "unknown"} />
              <dt className="text-ink-2">{r.label}</dt>
              <dd className={`ml-auto text-right font-display text-[1.0625rem] leading-snug font-semibold ${r.known ? "" : "text-muted"}`}>{r.value}</dd>
            </div>
            {r.sign === "euro" && (price || place.priceNote || place.touristTaxIncluded !== undefined || extras.length > 0) && (
              <dd className="mt-1 pl-10 text-sm text-ink-2">
                <NightTotalLine place={place} />
                {place.priceNote && <p>{priceNoteText(place.priceNote)}</p>}
                {place.touristTaxIncluded !== undefined && <p>Toeristenbelasting {place.touristTaxIncluded ? "zit in de prijs" : "komt erbij"}.</p>}
                {extras.length > 0 && (
                  <details className="group mt-1">
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
              </dd>
            )}
          </div>
        ))}
      </dl>
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

function NightTotalLine({ place }: { place: Place }) {
  const t = nightTotal(place);
  if (t.open.includes("prijs per nacht")) return null;
  if (t.total === undefined) {
    const why = t.open.map((o) => OPEN_REASON[o] ?? o);
    const list = why.length > 1 ? `${why.slice(0, -1).join(", ")} en ${why.at(-1)}` : why[0];
    return <p>Geen totaal voor {TOTAL_PERSONS} personen: {list}.</p>;
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

/** Voorzieningen als labels: aanwezig en niet aanwezig zichtbaar, onbekend samen in één regel */
function Facilities({ place }: { place: Place }) {
  const known = FACILITY_ROWS.filter((f) => place[f.key] !== undefined);
  const unknown = FACILITY_ROWS.filter((f) => place[f.key] === undefined);
  if (!known.length) return <p className="mt-2 text-ink-2">We weten nog niet welke voorzieningen er zijn.</p>;
  return (
    <>
      <ul className="mt-3 flex flex-wrap gap-2">
        {known.map((f) => {
          const v = place[f.key] as boolean;
          return (
            <li
              key={f.key}
              className={`inline-flex items-center gap-2 rounded-full py-1 pr-3.5 pl-1 text-sm font-semibold ${v ? "bg-forest-tint text-forest" : "bg-sunken text-ink-2"}`}
            >
              <Sign name={f.sign} size={24} state={v ? "on" : "off"} />
              {facilityText(f, v)}
            </li>
          );
        })}
      </ul>
      {unknown.length > 0 && (
        <p className="mt-2 text-sm text-muted">
          Nog onbekend: {listNl(unknown.map((f) => f.label))}.
        </p>
      )}
    </>
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
      <dl className="mt-3 divide-y divide-line rounded-xl bg-surface shadow-low">
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
