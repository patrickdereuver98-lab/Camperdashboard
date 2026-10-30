import { cardPrice, departureLong, pluralize } from "@/lib/format";
import { departureKind } from "@/lib/search";
import { isIncomplete } from "@/lib/place-status";
import { nightTotal, TOTAL_PERSONS } from "@/lib/trip-extras";
import { eur } from "@/lib/format";
import { GiveDepartureButton } from "@/components/departure-form";
import { Icon } from "@/components/icons";
import { Sign, type SignName } from "@/components/sign";
import type { Place } from "@/lib/types";
import { ReportProblem } from "./client";
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

function Tile({
  sign,
  label,
  known,
  tone = "plain",
  children,
  extra,
}: {
  sign: SignName;
  label: string;
  known: boolean;
  tone?: "plain" | "forest" | "lake";
  children: React.ReactNode;
  extra?: React.ReactNode;
}) {
  const bg = tone === "forest" ? "bg-forest-tint" : tone === "lake" ? "bg-lake-tint" : "bg-surface";
  const head = tone === "forest" ? "text-forest" : tone === "lake" ? "text-lake" : "text-ink-2";
  return (
    <div className={`flex min-h-28 flex-col rounded-xl p-3 shadow-low ${bg}`}>
      <dt className={`flex items-center gap-1.5 text-sm font-semibold ${head}`}>
        <Sign name={sign} size={20} state={known ? "on" : "unknown"} tone={tone === "lake" ? "lake" : "forest"} />
        {label}
      </dt>
      <dd className={`mt-1 font-display text-[1.0625rem] leading-snug font-semibold text-balance ${known ? "text-ink" : "text-muted"}`}>{children}</dd>
      {extra && <dd className="mt-auto pt-1 text-sm">{extra}</dd>}
    </div>
  );
}

/**
 * Beslisblok (redesign 30 oktober 2026, UX-audit): vier tegels die samen de vraag "kan ik hier vannacht staan?"
 * beantwoorden. Vertrekken is het kernfeit en de enige tegel met kleur (bosgroen zonder vaste tijd, meerblauw voor
 * uitslapers). Onbekend staat er eerlijk als "Onbekend", met "Weet jij dit?" om het meteen door te geven.
 */
export function DecisionGrid({ place, visitors = 0 }: { place: Place; visitors?: number }) {
  const kind = departureKind(place);
  const free = kind === "vrij";
  const late = kind === "uitslapers";
  const claimed = place.departure === "vrij" || place.departure === "per24";
  const departureKnown = claimed ? place.departureCheck !== "afgewezen" : !!place.departure;
  const price = cardPrice(place);
  const t = nightTotal(place);
  const total = t.total !== undefined && t.parts.length > 1 ? t.total : undefined;
  const priceSub = price
    ? total !== undefined
      ? `${TOTAL_PERSONS} personen ${t.from ? "vanaf " : ""}${eur(total)}`
      : price.perPerson
        ? price.perNight ? "Per persoon per nacht" : "Per persoon"
        : price.extras || place.touristTaxIncluded === false
          ? "Plus toeslagen"
          : price.perNight
            ? "Per nacht"
            : undefined
    : undefined;
  const arrival = arrivalTile(place);
  const ask = (topic: string, context: string) => (
    <ReportProblem placeId={place.id} placeName={place.name} topic={topic} label="Weet jij dit?" context={context} />
  );

  return (
    <section aria-labelledby="kort">
      <h2 id="kort" className="sr-only">In het kort</h2>
      <dl className="grid grid-cols-2 gap-2">
        <Tile
          sign="clock"
          label={free ? "Zonder vertrektijd" : late ? "Voor uitslapers" : "Vertrekken"}
          known={departureKnown}
          tone={departureKnown ? (late ? "lake" : free ? "forest" : "plain") : "plain"}
          extra={
            departureKnown && visitors > 0 ? (
              <span className="flex items-center gap-1 font-semibold text-ink-2" data-testid="departure-visitors">
                <Icon name="check" size={15} className={late ? "text-lake" : "text-forest"} />
                Volgens {pluralize(visitors, "bezoeker", "bezoekers")}
              </span>
            ) : !departureKnown || isIncomplete(place) ? (
              <GiveDepartureButton placeId={place.id} placeName={place.name} label="Weet jij dit?" />
            ) : undefined
          }
        >
          {departureKnown ? departureLong(place) : "Onbekend"}
        </Tile>
        <Tile sign="euro" label="Prijs" known={!!price} extra={price ? priceSub && <span className="text-ink-2">{priceSub}</span> : ask("prijs", "De prijs doorgeven")}>
          {price ? price.value : "Onbekend"}
        </Tile>
        <Tile
          sign="calendar"
          label="Nu open"
          known={place.openAllYear === true || !!place.season}
          extra={place.openAllYear || place.season ? undefined : ask("seizoen", "De openingsperiode doorgeven")}
        >
          <OpenValue place={place} />
        </Tile>
        <Tile sign="clock" label="Aankomen" known={!!arrival} extra={arrival ? undefined : ask("vertrektijd", "De aankomsttijden doorgeven")}>
          {arrival ?? "Onbekend"}
        </Tile>
      </dl>
    </section>
  );
}
