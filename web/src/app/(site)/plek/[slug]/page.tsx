import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { getDepartureVisitors, getGoogleRating, getNearby, getPlace, getRedirect, getReviews, getTopPlaceSlugs } from "@/lib/places";
import { departureKind } from "@/lib/search";
import { nightTotal, TOTAL_PERSONS } from "@/lib/trip-extras";
import { cardPrice, RESERVATION_TEXT, reservationRuleOf, eur, extraLabel, formatDate, pluralize, scoreLabel, timeToMinutes, websiteLabel } from "@/lib/format";
import { isIncomplete, lastChecked } from "@/lib/place-status";
import { NavigateButton } from "@/components/navigate";
import { ContactLink } from "@/components/contact-link";
import { SITE_URL, SUPABASE_URL } from "@/lib/env";
import { upgradePhotoUrl } from "@/lib/photos";
import { OPEN_GRAPH } from "@/lib/meta";
import { allInPrice, labeledName, ogImagePath, seoDescription, seoTitle } from "@/lib/place-seo";
import { inBbox } from "@/lib/bbox";
import { areaPath, breadcrumbLd, ISLANDS, ldImages, ldJson, placeTitle, provinceSlug } from "@/lib/seo-pages";
import { KIND_LABEL, type Place } from "@/lib/types";
import { Icon } from "@/components/icons";
import { KIND_SIGN, Sign, type SignName } from "@/components/sign";
import { PlaceCard, SaveButton, ScoreBadge } from "@/components/place-ui";
import { CARD_CELL, CARD_GRID } from "@/lib/card-grid";
import { PlaceMap } from "@/components/place-map";
import { pickFacilities } from "@/lib/facility-update";
import { Legend } from "@/components/legend";
import { GoogleScore } from "./ervaringen";
import { Gallery, OutdatedNote, ReportProblem, ReviewList, ReviewSummary, RouteCard, ShareButton, TrackView, WriteReview } from "./client";
import { OwnerUpdate } from "./owner-update";
import { ownerValues } from "@/lib/owner-update";
import { PhotoUpload } from "./photo-upload";
import { DecisionSummary } from "./decision-grid";
import { FacilityGrid } from "./facility-grid";
import { ArrivalTodayNote, CopyButton, DistanceFromMe, ResultsNav, StickyRouteBar } from "./live-facts";
import { PlaceHeaderActions } from "@/components/place-header";
import { departureShort } from "@/lib/format";
import { PlekpulsVraag } from "@/components/plekpuls";
import { departureQuestion, PLEKPULS_ACTIEF } from "@/lib/plekpuls";

// Alleen de top-100 tijdens de build: alle plekken prerenderen liep op Vercel stuk (RangeError). De rest wordt bij het
// eerste bezoek gerenderd ("blocking": params worden buiten <Suspense> afgewacht) en daarna uit de cache geserveerd.
export async function generateStaticParams() {
  return (await getTopPlaceSlugs()).map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: PageProps<"/plek/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const place = await getPlace(slug);
  // Onbekend adres: de pagina geeft 404, maar zeg het ook expliciet tegen zoekmachines
  if (!place) return { title: "Plek niet gevonden", robots: { index: false } };
  // Binnen ±60 tekens; bij "zonder vertrektijd" staat dat in de titel (kernfeit), de prijs als die nog past.
  // De omschrijving: "Camperplaats [naam] in [plaats]: [prijs] inclusief toeslagen. Vertrektijd: [tijd]." Onbekend laten we weg.
  const title = placeTitle(place, labeledName(place), seoTitle(place), allInPrice(place)?.amount);
  const description = seoDescription(place);
  const image = { url: ogImagePath(place.slug), width: 1200, height: 630, alt: `${place.name} in ${place.town}: prijs en vertrektijd` };
  return {
    title,
    description,
    alternates: { canonical: `/plek/${place.slug}` },
    // Grijze plek (vertrekregel onbekend): wel te vinden in zoeken en op de kaart, niet in zoekmachines tot het
    // kernfeit bekend is; de links blijven gevolgd (dataplan november 2026 §7, besluit Patrick 20 november)
    ...(isIncomplete(place) ? { robots: { index: false, follow: true } } : {}),
    openGraph: { ...OPEN_GRAPH, title, description, url: `/plek/${place.slug}`, images: [image] },
    twitter: { card: "summary_large_image", title, description, images: [image.url] },
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

export default async function PlacePage({ params }: PageProps<"/plek/[slug]">) {
  const { slug } = await params;
  const place = await getPlace(slug);
  if (!place) {
    // Samengevoegde plek: oude links en zoekmachines naar de plek die is blijven staan
    const target = await getRedirect(slug);
    if (target) permanentRedirect(`/plek/${target}`);
    notFound();
  }
  const [reviews, nearby, visitors, google] = await Promise.all([
    getReviews(place.id),
    getNearby(place, 6),
    getDepartureVisitors(place.id),
    getGoogleRating(place.id),
  ]);

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
    // Alleen eigen uploads en foto's met toestemming; anders de deelafbeelding (geen foto's van derden doorgeven)
    image: ldImages(photos, `${SUPABASE_URL}/storage/`, `${SITE_URL}${ogImagePath(place.slug)}`).map(upgradePhotoUrl),
    description: place.description,
    address: { "@type": "PostalAddress", streetAddress: place.street, postalCode: place.postcode, addressLocality: place.town, addressRegion: place.province, addressCountry: "NL" },
    geo: { "@type": "GeoCoordinates", latitude: place.lat, longitude: place.lng },
    telephone: tel,
    petsAllowed: place.dogs,
    // Alleen een vaste, leesbare vertrektijd; "geen vaste vertrektijd" heeft geen Schema.org-veld
    checkoutTime: place.departure === "vast" && timeToMinutes(place.checkoutUntil) !== undefined ? place.checkoutUntil : undefined,
    checkinTime: timeToMinutes(place.checkinFrom) !== undefined ? place.checkinFrom : undefined,
    // Alleen het bedrag ("€ 24,70", "vanaf € 18", "Gratis"); de uitleg staat op de pagina
    priceRange: allInPrice(place)?.amount,
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
  // Laatste controle (website of vertrekcontrole); zonder die datum de laatste wijziging, maar dan geen "verouderd"
  const lastUpdate = lastChecked(place) ?? place.updatedAt;
  // Plekpuls staat uit tot de koppeling met de bronnenlaag er is (lib/plekpuls.ts)
  const pulse = PLEKPULS_ACTIEF ? departureQuestion(place) : undefined;
  // Delen met de feiten die we kennen (U3): "Geen vaste vertrektijd · € 15 per nacht + toeslagen". Onbekend laten we weg.
  const shareFacts = [
    departureShort(place),
    price ? `${price.value}${price.extras || place.touristTaxIncluded === false ? " + toeslagen" : price.perNight ? " per nacht" : ""}` : undefined,
  ].filter(Boolean);
  const shareText = `${place.name} in ${place.town}${shareFacts.length ? `: ${shareFacts.join(" · ")}` : ""}`;
  return (
    <article className="pb-24 md:pb-8" data-share-title={place.name} data-share-text={shareText}>
      <TrackView slug={place.slug} name={place.name} town={place.town} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: ldJson(jsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: ldJson(crumbs) }} />
      {/* Telefoon: Bewaren en de naam (bij scrollen) in de kop; Delen staat in het menu ⋯ (UX-audit 27 november, V3) */}
      <PlaceHeaderActions slug={place.slug} name={place.name} />

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
        {/* Vorige en volgende uit je zoekresultaten: één dunne regel boven de foto, secundair */}
        <ResultsNav slug={place.slug} />
        <Gallery slug={place.slug} name={place.name} photos={photos} kind={place.kind} town={place.town} />
      </div>

      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        {/* Kop: naam, soort en plaats, en laatste update. Score alleen als er reviews zijn: reviews staan verderop */}
        <header className="flex flex-col gap-2 pt-3 md:flex-row md:items-start md:justify-between md:pt-5">
          <div className="min-w-0">
            <h1 id="plek-naam" className="font-display text-h1 font-semibold">{place.name}</h1>
            <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-ink-2">
              <Sign name={KIND_SIGN[place.kind ?? "camperplaats"]} size={20} />
              {place.kind ? KIND_LABEL[place.kind] : "Camperplaats"} in {place.town}, {place.province}
            </p>
            <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
              {place.ratingCount > 0 && place.ratingAvg ? (
                <a href="#reviews" className="-my-2 inline-flex items-center gap-1.5 py-2 font-semibold text-ink-2 underline-offset-2 hover:underline">
                  <span className="rounded-md rounded-bl-none bg-forest px-1.5 py-0.5 font-display text-on-forest">{scoreLabel(place.ratingAvg)}</span>
                  uit {pluralize(place.ratingCount, "review", "reviews")}
                </a>
              ) : null}
              <DistanceFromMe place={place} />
              {lastUpdate && (
                <p className="text-muted">
                  Laatste update: {formatDate(lastUpdate)}
                  <OutdatedNote verifiedAt={place.verifiedAt} departureCheckedAt={place.departureCheckedAt} />
                </p>
              )}
            </div>
          </div>
          <div className="hidden shrink-0 gap-2 md:flex">
            <SaveButton slug={place.slug} name={place.name} variant="full" />
            <ShareButton title={place.name} text={shareText} />
          </div>
        </header>

        {/* Telefoon: beslissen, goed om te weten, voorzieningen, ligging, over, ervaringen, contact. Groot scherm: zijkolom
            met Route openen en contact, plus de kaart */}
        <div className="mt-4 flex flex-col gap-8 lg:mt-6 lg:grid lg:grid-cols-[1.4fr_1fr] lg:grid-rows-[min-content_1fr] lg:gap-x-10">
          <div id="overzicht" className="min-w-0 space-y-8 lg:col-start-1 lg:row-start-1">
            <div className="space-y-3">
              <DecisionSummary place={place} visitors={visitors} />
              <ArrivalTodayNote place={place} />
            </div>
            {/* Tablet: geen vaste balk en nog geen zijkolom, dus Route openen en contact hier */}
            <PlaceActions place={place} tel={tel} className="hidden md:grid lg:hidden" />
            <DecisionDetails place={place} tel={tel} />
            {pulse && (
              <div className="-mt-4 rounded-lg border border-line bg-surface px-4 py-3">
                <PlekpulsVraag question={pulse} />
              </div>
            )}

            <section aria-labelledby="voorzieningen" className="space-y-4">
              <div className="flex flex-wrap items-baseline justify-between gap-x-4">
                <h2 id="voorzieningen" className="font-display text-h2 font-semibold">Voorzieningen</h2>
                <Legend />
              </div>
              <FacilityGrid placeId={place.id} placeName={place.name} values={pickFacilities(place)} ask={false} />
              <CamperFit place={place} />
            </section>
          </div>

          {/* Zijkolom: op de telefoon na de voorzieningen */}
          <aside className="min-w-0 space-y-4 lg:sticky lg:top-20 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:self-start">
            <PlaceActions place={place} tel={tel} className="hidden lg:grid" />
            <section id="ligging" aria-labelledby="ligging-kop" className="space-y-3">
              <h2 id="ligging-kop" className="font-display text-h2 font-semibold lg:sr-only">Ligging en route</h2>
              <PlaceMap
                places={[place, ...nearby.map((n) => n.place)]}
                highlight={place.slug}
                fitKey={place.slug}
                cluster={false}
                whenVisible
                className="h-52 overflow-hidden rounded-lg border border-line lg:h-72"
              />
              <p className="flex flex-wrap items-center gap-x-2 text-ink-2">
                {address ? `${address}, ${place.province}` : `${place.town}, ${place.province}`}
                <CopyButton text={address ? `${address}, ${place.province}` : `${place.town}, ${place.province}`} label="Adres kopiëren" />
              </p>
              <RouteCard to={{ lat: place.lat, lng: place.lng }} />
            </section>
          </aside>

          <div className="min-w-0 space-y-8 lg:col-start-1 lg:row-start-2">
            {/* Over deze plek: alleen hele zinnen uit de eigen tekst van de plek (zie lib/description.ts) */}
            {place.description && (
              <section aria-labelledby="over">
                <h2 id="over" className="font-display text-h2 font-semibold">Over deze plek</h2>
                <p className="mt-2 max-w-prose text-ink-2">{place.description}</p>
                <p className="mt-2 text-sm text-muted">Zo beschrijft de plek zichzelf op de eigen website.</p>
              </section>
            )}

            <section aria-labelledby="reviews">
              <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                <h2 id="reviews" className="scroll-mt-4 font-display text-h2 font-semibold">Ervaringen</h2>
                <WriteReview placeId={place.id} placeName={place.name} slug={place.slug} />
              </div>
              {google && (
                <div className="mt-4">
                  <GoogleScore google={google} />
                </div>
              )}
              {reviews.length > 0 ? (
                <div className="mt-4 space-y-6">
                  <ScoreBadge avg={place.ratingAvg} count={place.ratingCount} size="lg" />
                  <ReviewSummary reviews={reviews} />
                  <ReviewList reviews={reviews} />
                </div>
              ) : (
                <p className="mt-4 text-ink-2">Nog geen ervaringen van camperaars.</p>
              )}
            </section>

            <Contact place={place} tel={tel} />
          </div>
        </div>

        {nearby.length > 0 && (
          <section className="mt-10" aria-labelledby="buurt">
            <h2 id="buurt" className="font-display text-h2 font-semibold">In de buurt</h2>
            <ul className={`${CARD_GRID} -mx-4 mt-3 scroll-px-4 px-4 sm:mx-0 sm:px-0`}>
              {nearby.map(({ place: p, km }) => (
                <li key={p.id} className={CARD_CELL}>
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
        <Contribution place={place} />
      </div>

      {/* Vaste balk op de telefoon: altijd Route openen; de prijs schuift er pas in als het beslisblok uit beeld is,
          zodat hij niet dubbel in beeld staat (UX-audit 27 november, K4) */}
      <StickyRouteBar
        price={price?.value ?? "Prijs onbekend"}
        priceSub={price && (price.extras || place.touristTaxIncluded === false) ? "+ toeslagen" : price?.perNight ? "per nacht" : undefined}
        known={!!price}
      >
        <NavigateButton to={place} slug={place.slug} className="flex h-12 min-w-0 flex-1 items-center justify-center gap-2 rounded-lg bg-forest px-4 font-semibold text-on-forest hover:bg-forest-deep active:scale-[0.98]">
          <Icon name="route" size={19} /> Route openen
        </NavigateButton>
      </StickyRouteBar>
    </article>
  );
}

/**
 * Acties naast de inhoud (tablet en groot scherm): Route openen is de hoofdactie, de website en bellen zijn
 * ondergeschikt (UX-audit 27 november, D5). De prijs staat al in het beslisblok ernaast, dus hier niet nog eens.
 */
function PlaceActions({ place, tel, className }: { place: Place; tel?: string; className: string }) {
  return (
    <div className={`gap-2 rounded-lg border border-line bg-surface p-4 ${className}`} data-testid="place-actions">
      <NavigateButton to={place} slug={place.slug} className="flex h-12 items-center justify-center gap-2 rounded-lg bg-forest px-4 font-semibold text-on-forest hover:bg-forest-deep">
        <Icon name="route" size={19} /> Route openen
      </NavigateButton>
      {place.website && (
        <ContactLink soort="website" slug={place.slug} href={place.website} target="_blank" rel="noopener noreferrer nofollow" className="flex min-h-12 flex-col items-center justify-center rounded-lg border border-line px-3 py-1.5 font-semibold hover:border-forest">
          <span className="flex items-center gap-2">
            <Icon name="globe" size={19} /> Naar de website
          </span>
          <span className="text-sm font-normal text-ink-2">{websiteLabel(place.website)}</span>
        </ContactLink>
      )}
      {tel && (
        <ContactLink soort="telefoon" slug={place.slug} href={`tel:${tel.replace(/[^\d+]/g, "")}`} className="flex h-12 items-center justify-center gap-2 rounded-lg border border-line font-semibold hover:border-forest">
          <Icon name="phone" size={19} /> Bellen <span className="font-normal text-ink-2">{tel}</span>
        </ContactLink>
      )}
      {place.email && (
        <a href={`mailto:${place.email}`} className="flex h-12 items-center justify-center gap-2 rounded-lg border border-line font-semibold hover:border-forest">
          <Icon name="mail" size={19} /> E-mail sturen
        </a>
      )}
    </div>
  );
}

/**
 * "Goed om te weten" (UX-audit 27 november): eerst wat bij de vertrektijd en aankomst hoort, dan reserveren met de
 * uitleg vóór de externe link, dan de prijs in detail. Alleen wat we weten; zonder iets te melden geen blok.
 */
function DecisionDetails({ place, tel }: { place: Place; tel?: string }) {
  const checked =
    departureKind(place) === "vrij" && place.departureCheck === "bevestigd" && place.departureCheckedAt
      ? `Vertrektijd gecontroleerd ${place.departureCheckedBy === "eigenaar" ? "bij de eigenaar" : "door ons"} op ${formatDate(place.departureCheckedAt)}.`
      : undefined;
  // Later vertrekken tegen betaling hoort bij de vertrektijd, niet tussen de extra kosten
  const lateOption = place.priceExtras?.find((x) => x.label.startsWith("Later vertrekken"));
  const times = [
    lateOption && `${lateOption.label} kan voor ${eur(lateOption.amount)}`,
    place.accessHours && place.checkinFrom && `Slagboom of poort open ${place.accessHours}`,
    place.maxStayNights && `Maximaal ${pluralize(place.maxStayNights, "nacht", "nachten")}`,
  ].filter(Boolean) as string[];
  const reservation = reservationRuleOf(place);
  const price = cardPrice(place);
  const extras = (place.priceExtras ?? []).filter((x) => x !== lateOption);
  const priceDetails =
    !!price && (place.priceNote || place.touristTaxIncluded !== undefined || extras.length > 0 || nightTotal(place).total !== undefined || !!place.payment?.length);
  const reserveText = reservation
    ? `${RESERVATION_TEXT[reservation]}.${(reservation === "verplicht" || reservation === "mogelijk") && place.website ? " Dat gaat via de website van de plek." : ""}`
    : place.website || tel
      ? "We weten niet of je vooraf moet reserveren. Vraag het na bij de plek."
      : undefined;
  if (!checked && !times.length && !priceDetails && !reserveText) return null;
  const link = "-my-2 inline-flex min-h-11 items-center gap-1.5 font-semibold text-forest underline underline-offset-2";
  return (
    <section aria-labelledby="goed-om-te-weten">
      <h2 id="goed-om-te-weten" className="font-display text-h2 font-semibold">Goed om te weten</h2>
      <div className="mt-3 divide-y divide-line overflow-hidden rounded-lg border border-line bg-surface">
        {(checked || times.length > 0) && (
          <div className="space-y-1 px-4 py-3 text-ink-2">
            {times.length > 0 && <p>{times.join(". ")}.</p>}
            {checked && <p className="text-sm">{checked}</p>}
          </div>
        )}
        {reserveText && (
          <div className="px-4 py-3" data-testid="reservation">
            <h3 className="font-semibold">Reserveren</h3>
            <p className="mt-0.5 text-ink-2">{reserveText}</p>
            <div className="mt-1 flex flex-wrap gap-x-5 md:hidden">
              {place.website && (
                <ContactLink soort="website" slug={place.slug} href={place.website} target="_blank" rel="noopener noreferrer nofollow" className={link} aria-label={`Naar de website: ${websiteLabel(place.website)}`}>
                  <Icon name="globe" size={18} /> Naar de website
                </ContactLink>
              )}
              {tel && (
                <ContactLink soort="telefoon" slug={place.slug} href={`tel:${tel.replace(/[^\d+]/g, "")}`} className={link} aria-label={`Bellen naar ${place.name}`}>
                  <Icon name="phone" size={18} /> Bellen
                </ContactLink>
              )}
            </div>
          </div>
        )}
        {priceDetails && (
          <div className="space-y-1 px-4 py-3 text-sm text-ink-2">
            <h3 className="text-base font-semibold text-ink">Prijs en voorwaarden</h3>
            <NightTotalLine place={place} />
            {place.priceNote && <p>{priceNoteText(place.priceNote)}</p>}
            {place.touristTaxIncluded !== undefined && !onlyTaxOpen(place) && (
              <p>Toeristenbelasting {place.touristTaxIncluded ? "zit in de prijs" : "komt erbij"}.</p>
            )}
            {place.payment?.length ? <p>Betalen: {PAYMENT_TEXT(place.payment).toLowerCase()}.</p> : null}
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
      </div>
    </section>
  );
}

/** Past je camper? Lengte, hoogte, gewicht, ondergrond en aantal plekken, onder de voorzieningen. Onbekend blijft weg. */
function CamperFit({ place }: { place: Place }) {
  const unit = (n: number, u: string) => `${String(n).replace(".", ",")} ${u}`;
  const rows = [
    ["Maximale lengte", place.maxLengthM ? unit(place.maxLengthM, "m") : undefined],
    ["Maximale hoogte", place.maxHeightM ? unit(place.maxHeightM, "m") : undefined],
    ["Maximaal gewicht", place.maxWeightT ? unit(place.maxWeightT, "ton") : undefined],
    ["Ondergrond", place.surface ? place.surface[0].toUpperCase() + place.surface.slice(1) : undefined],
    ["Aantal plekken", place.capacity ? String(place.capacity) : undefined],
  ].filter((r): r is [string, string] => r[1] !== undefined);
  if (!rows.length) return null;
  // "Past je camper?" alleen als er een maat bij staat; anders gaat het over de plaatsen zelf
  const fit = !!(place.maxLengthM || place.maxHeightM || place.maxWeightT);
  return (
    <div data-testid="camper-fit">
      <h3 className="font-semibold">{fit ? "Past je camper?" : "De plaatsen"}</h3>
      <dl className="mt-2 divide-y divide-line rounded-lg border border-line bg-surface">
        {rows.map(([label, value]) => (
          <div key={label} className="flex justify-between gap-4 px-4 py-2.5">
            <dt className="text-ink-2">{label}</dt>
            <dd className="text-right font-semibold">{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

/**
 * Onderaan, één keer (UX-audit 27 november, besluit V4): één knop voor alle correcties en aanvullingen, een kleine
 * link voor een foto, en apart de route voor eigenaren. Drukte doorgeven is weg (besluit Patrick, 27 november 2026). Geen teller van bekende gegevens: de bezoeker hoeft
 * de database niet te begrijpen. Een onbekende vertrektijd vragen we al in het beslisblok.
 */
function Contribution({ place }: { place: Place }) {
  return (
    <div className="mt-10 space-y-8 border-t border-line pt-6">
      <section id="help" aria-labelledby="help-kop" className="scroll-mt-20">
        <h2 id="help-kop" className="font-display text-h2 font-semibold">Klopt er iets niet?</h2>
        <p className="mt-1 max-w-prose text-ink-2">
          Zie je een fout of ontbreekt er informatie? Geef het aan ons door. We bekijken je melding en werken de plek bij
          als het klopt.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2">
          <ReportProblem placeId={place.id} placeName={place.name} facilities={pickFacilities(place)} label="Gegevens corrigeren of aanvullen" />
          <PhotoUpload placeId={place.id} slug={place.slug} placeName={place.name} />
        </div>
      </section>
      <section aria-labelledby="eigenaar-kop">
        <h2 id="eigenaar-kop" className="font-display text-h3 font-semibold">Eigenaar van deze plek?</h2>
        <p className="mt-1 max-w-prose text-ink-2">Kloppen de gegevens niet of wil je informatie aanvullen? Dan pas je ze hier aan.</p>
        <div className="mt-2">
          <OwnerUpdate placeId={place.id} placeName={place.name} initial={ownerValues(place)} label="Gegevens aanpassen" />
        </div>
      </section>
    </div>
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

const PAYMENT_WORD: Record<string, string> = { contant: "contant", pin: "pinnen", creditcard: "creditcard", contactloos: "contactloos", app: "met een app" };
/** ["contant", "pin"] → "Contant of pinnen" */
function PAYMENT_TEXT(list: string[]): string {
  const words = list.map((w) => PAYMENT_WORD[w] ?? w);
  const text = words.length > 1 ? `${words.slice(0, -1).join(", ")} of ${words.at(-1)}` : words[0];
  return text[0].toUpperCase() + text.slice(1);
}

/** Contact: telefoon, website en e-mail. Vanaf lg staan ze al in de zijkolom met Route openen. */
function Contact({ place, tel }: { place: Place; tel?: string }) {
  const rows: { label: string; value: React.ReactNode }[] = [];
  const cls = "-my-3 inline-block py-3 font-semibold break-all text-forest underline underline-offset-2";
  if (tel)
    rows.push({
      label: "Telefoon",
      value: (
        <ContactLink soort="telefoon" slug={place.slug} href={`tel:${tel.replace(/[^\d+]/g, "")}`} className={cls}>
          {tel}
        </ContactLink>
      ),
    });
  if (place.website)
    rows.push({
      label: "Website",
      value: (
        <ContactLink soort="website" slug={place.slug} href={place.website} target="_blank" rel="noopener noreferrer nofollow" aria-label={`Naar de website: ${websiteLabel(place.website)}`} className={cls}>
          {websiteLabel(place.website)}
        </ContactLink>
      ),
    });
  if (place.email)
    rows.push({
      label: "E-mail",
      value: (
        <a href={`mailto:${place.email}`} className={cls}>
          {place.email}
        </a>
      ),
    });
  if (!rows.length) return null;
  return (
    <section aria-labelledby="contact" className="lg:hidden">
      <h2 id="contact" className="font-display text-h2 font-semibold">Contact</h2>
      <dl className="mt-3 divide-y divide-line rounded-lg border border-line bg-surface">
        {rows.map((r) => (
          <div key={r.label} className="flex justify-between gap-4 px-4 py-2.5">
            <dt className="shrink-0 text-ink-2">{r.label}</dt>
            <dd className="min-w-0 text-right">{r.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
