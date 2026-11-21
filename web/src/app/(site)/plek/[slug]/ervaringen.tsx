import { checkVoorVertrek, type CheckFacts } from "@/lib/check-voor-vertrek";
import { scoreLabel } from "@/lib/format";
import type { GoogleRating } from "@/lib/google-rating";
import { Icon } from "@/components/icons";

/**
 * Check voor vertrek: drie regels vlak voor de reviews, alleen uit feiten die we kennen. Het lijkt op wat Google Maps
 * "Een check voor vertrek" noemt, maar elke regel komt van de plekgegevens en niet van een taalmodel.
 */
export function CheckVoorVertrek({ place }: { place: CheckFacts }) {
  const lines = checkVoorVertrek(place);
  return (
    <section aria-labelledby="check" className="rounded-lg border border-line bg-surface p-4">
      <h3 id="check" className="font-display text-lg font-semibold">Check voor vertrek</h3>
      <ul className="mt-2 space-y-2">
        {lines.map((l) => (
          <li key={l.label} className="flex items-start gap-2">
            <Icon name="check" size={18} className="mt-0.5 shrink-0 text-forest" />
            <span>
              <span className="font-semibold">{l.label}: </span>
              <span className="text-ink-2">{l.text}</span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * Het cijfer van Google, naast ons eigen cijfer en nooit erdoor gemengd: andere schaal (1 tot 5), andere mensen.
 * Live opgehaald en niet bewaard; Google staat er als bron bij, met link naar de plek op Google Maps.
 */
export function GoogleScore({ google }: { google: GoogleRating }) {
  const text = `${scoreLabel(google.rating)} van 5 uit ${google.count} ${google.count === 1 ? "review" : "reviews"}`;
  return (
    <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-ink-2" data-testid="google-score">
      <Icon name="star" size={18} className="text-ember" />
      <span>
        <span className="font-semibold text-ink">{text}</span> op Google Maps
      </span>
      {google.url && (
        <a href={google.url} target="_blank" rel="noopener noreferrer" className="-my-3 inline-block py-3 font-semibold text-forest underline underline-offset-2">
          Bekijk op Google Maps
        </a>
      )}
    </p>
  );
}
