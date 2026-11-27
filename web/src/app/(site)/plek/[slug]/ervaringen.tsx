import { scoreLabel } from "@/lib/format";
import { googleMapsUrl, type GoogleRating } from "@/lib/google-rating";
import { Icon } from "@/components/icons";

/**
 * Het cijfer van Google, naast ons eigen cijfer en nooit erdoor gemengd: andere schaal (1 tot 5), andere mensen.
 * Maximaal 30 dagen oud (oudere cijfers tonen we niet); Google staat er als bron bij, met link naar de plek op Google Maps.
 */
export function GoogleScore({ google }: { google: GoogleRating & { note?: string } }) {
  const text = `${scoreLabel(google.rating)} van 5 uit ${google.count} ${google.count === 1 ? "review" : "reviews"}`;
  return (
    <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-ink-2" data-testid="google-score">
      <Icon name="star" size={18} className="text-ember" />
      <span>
        <span className="font-semibold text-ink">{text}</span> op Google Maps
        {google.note && <span className="text-muted">{`. ${google.note}`}</span>}
      </span>
      <a href={googleMapsUrl(google.placeId)} target="_blank" rel="noopener noreferrer" className="-my-3 inline-block py-3 font-semibold text-forest underline underline-offset-2">
        Bekijk op Google Maps
      </a>
    </p>
  );
}
