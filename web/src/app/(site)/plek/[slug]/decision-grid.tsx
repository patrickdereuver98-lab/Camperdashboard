import { cardPrice, departureLong, pluralize, reservationRuleOf } from "@/lib/format";
import { departureKind } from "@/lib/search";
import { isIncomplete } from "@/lib/place-status";
import { nightTotal, TOTAL_PERSONS } from "@/lib/trip-extras";
import { eur } from "@/lib/format";
import { Icon } from "@/components/icons";
import { Sign } from "@/components/sign";
import { GiveDepartureButton } from "@/components/departure-form";
import type { Place } from "@/lib/types";
import { OpenValue } from "./live-facts";

/** Aankomst in een paar woorden voor een tegel; alleen wat de bron noemt */
export function arrivalTile(p: Pick<Place, "checkinFrom" | "checkinUntil" | "access24h" | "accessHours">): string | undefined {
  if (p.checkinFrom && p.checkinUntil) return `${p.checkinFrom} tot ${p.checkinUntil}`;
  if (p.checkinUntil) return `Tot ${p.checkinUntil}`;
  if (p.checkinFrom) return `Vanaf ${p.checkinFrom}`;
  if (p.access24h) return "Dag en nacht";
  if (p.accessHours) return `Poort open ${p.accessHours}`;
  return undefined;
}

/**
 * Vragen we om de vertrektijd? Als er geen bruikbare vertrekregel is: geen regel, een afgewezen of voorwaardelijke
 * regel, of een vaste tijd die we niet kunnen lezen (zelfde definitie als "onvolledig").
 */
export function needsDeparture(place: Place): boolean {
  const claimed = place.departure === "vrij" || place.departure === "per24";
  const known = claimed ? place.departureCheck !== "afgewezen" : !!place.departure;
  return !known || isIncomplete(place);
}

/** Eén zin onder de vertrektijd: wat de regel voor jou betekent. Alleen wat we weten. */
function departureNote(place: Place, known: boolean): string | undefined {
  if (!known) return "We weten nog niet hoe laat je hier moet vertrekken.";
  const claimed = place.departure === "vrij" || place.departure === "per24";
  if (claimed && place.departureCheck === "voorwaardelijk") return "Soms geldt er toch een vertrektijd, bijvoorbeeld als het druk is. Vraag het even na.";
  if (place.departure === "vrij") return "Je kunt hier vertrekken wanneer het jou uitkomt.";
  if (place.departure === "per24") return "Je verblijf loopt per 24 uur.";
  return undefined;
}

/** Korte waarde voor de regel Reserveren in het beslisblok */
const RESERVATION_SHORT = { verplicht: "Verplicht", mogelijk: "Kan, niet verplicht", niet_nodig: "Niet nodig" } as const;

/**
 * Beslisblok (UX-audit 27 november 2026, besluit V1, vervangt het raster van 2×2): eerst de vertrektijd, groot en over
 * de hele breedte, met één zin wat dat voor je betekent; dan de prijs; dan drie korte regels Aankomst, Open en
 * Reserveren. Vertrekken is het enige met kleur (bosgroen zonder vaste tijd, meerblauw voor uitslapers). Onbekend
 * staat er rustig als "Onbekend"; alleen bij een onbekende vertrektijd, het kernfeit, staat er één knop om hem door te
 * geven. Alle andere correcties gaan via "Klopt er iets niet?" onderaan.
 */
export function DecisionSummary({ place, visitors = 0 }: { place: Place; visitors?: number }) {
  const kind = departureKind(place);
  const free = kind === "vrij";
  const late = kind === "uitslapers";
  const claimed = place.departure === "vrij" || place.departure === "per24";
  const departureKnown = claimed ? place.departureCheck !== "afgewezen" : !!place.departure;
  const askDeparture = needsDeparture(place);
  const note = departureNote(place, departureKnown);
  const price = cardPrice(place);
  const t = nightTotal(place);
  const total = t.total !== undefined && t.parts.length > 1 ? t.total : undefined;
  const priceSub = price
    ? price.perPerson
      ? price.perNight ? "per persoon per nacht" : "per persoon"
      : price.extras || place.touristTaxIncluded === false
        ? "per nacht + toeslagen"
        : price.perNight
          ? "per nacht"
          : undefined
    : undefined;
  const arrival = arrivalTile(place);
  const reservation = reservationRuleOf(place);
  const tone = departureKnown && free ? "forest" : departureKnown && late ? "lake" : "plain";
  const bg = tone === "forest" ? "bg-forest-tint" : tone === "lake" ? "bg-lake-tint" : "bg-surface";
  const head = tone === "forest" ? "text-forest" : tone === "lake" ? "text-lake" : "text-ink-2";
  const row = "flex items-baseline justify-between gap-4 px-4 py-2.5";

  return (
    <section aria-labelledby="kort" data-testid="decision-summary">
      <h2 id="kort" className="sr-only">In het kort</h2>
      <div className="divide-y divide-line overflow-hidden rounded-lg border border-line bg-surface">
        {/* 1. Vertrekken: de kernbelofte, het grootst */}
        <div className={`px-4 py-3.5 ${bg}`} data-testid="decision-departure">
          <p className={`flex items-center gap-1.5 text-sm font-semibold ${head}`}>
            <Sign name="clock" size={18} state={departureKnown ? "on" : "unknown"} tone={tone === "lake" ? "lake" : "forest"} />
            {free && departureKnown ? "Zonder vertrektijd" : late && departureKnown ? "Voor uitslapers" : "Vertrekken"}
          </p>
          <p className={`mt-1 font-display text-h1 leading-tight font-semibold text-balance tabular-nums ${departureKnown ? "text-ink" : "text-ink-2"}`}>
            {departureKnown ? departureLong(place) : "Vertrektijd onbekend"}
          </p>
          {note && <p className="mt-1 text-ink-2">{note}</p>}
          {askDeparture ? (
            <div className="mt-2">
              <GiveDepartureButton placeId={place.id} placeName={place.name} />
            </div>
          ) : visitors > 0 ? (
            <p className="mt-1.5 flex items-center gap-1 text-sm font-semibold text-ink-2" data-testid="departure-visitors">
              <Icon name="check" size={15} className={late ? "text-lake" : "text-forest"} />
              Volgens {pluralize(visitors, "bezoeker", "bezoekers")}
            </p>
          ) : null}
        </div>
        {/* 2. Prijs: tweede waarde; het totaal voor 2 personen alleen als elk onderdeel bekend is */}
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 px-4 py-3" data-testid="decision-price">
          <span className="sr-only">Prijs: </span>
          <span className={`font-display font-semibold tabular-nums ${price ? "text-h2 text-ink" : "text-lg text-ink-2"}`}>{price ? price.value : "Prijs onbekend"}</span>
          {priceSub && <span className="text-ink-2">{priceSub}</span>}
          {total !== undefined && (
            <span className="basis-full text-sm text-ink-2">
              {TOTAL_PERSONS} personen {t.from ? "vanaf " : ""}
              {eur(total)} per nacht
            </span>
          )}
        </div>
        {/* 3. Aankomst, open en reserveren: kort, even zwaar, onbekend gedempt */}
        <dl className="divide-y divide-line">
          <div className={row}>
            <dt className="text-ink-2">Aankomst</dt>
            <dd className={`text-right font-semibold ${arrival ? "text-ink" : "text-muted"}`}>{arrival ?? "Onbekend"}</dd>
          </div>
          <div className={row}>
            <dt className="text-ink-2">Open</dt>
            <dd className="text-right font-semibold">
              <OpenValue place={place} />
            </dd>
          </div>
          <div className={row}>
            <dt className="text-ink-2">Reserveren</dt>
            <dd className={`text-right font-semibold ${reservation ? "text-ink" : "text-muted"}`}>{reservation ? RESERVATION_SHORT[reservation] : "Onbekend"}</dd>
          </div>
        </dl>
      </div>
    </section>
  );
}
