const eurFmt = new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR" });
const eurRound = new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });

export function eur(n: number, round = false): string {
  if (round || Number.isInteger(n)) return eurRound.format(n);
  return eurFmt.format(n);
}

export function priceLabel(priceEur?: number, from?: boolean): string {
  if (priceEur === undefined) return "Prijs onbekend";
  if (priceEur === 0) return "Gratis";
  return from ? `vanaf ${eur(priceEur)}` : eur(priceEur);
}

/** Booking-achtige woordlabels bij een score op 10 */
export function scoreWord(score: number): string {
  if (score >= 9) return "Uitzonderlijk";
  if (score >= 8.5) return "Fantastisch";
  if (score >= 8) return "Heel goed";
  if (score >= 7) return "Goed";
  if (score >= 6) return "Redelijk";
  return "Matig";
}

export function scoreLabel(n: number) {
  return n.toFixed(1).replace(".", ",");
}

const dateFmt = new Intl.DateTimeFormat("nl-NL", { day: "numeric", month: "long", year: "numeric" });
const monthFmt = new Intl.DateTimeFormat("nl-NL", { month: "long", year: "numeric" });

export function formatDate(iso: string) {
  return dateFmt.format(new Date(iso));
}

export function formatMonth(iso: string) {
  return monthFmt.format(new Date(iso));
}

export function formatDuration(seconds: number): string {
  const m = Math.round(seconds / 60);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const rest = m % 60;
  return rest ? `${h} u ${rest} min` : `${h} uur`;
}

export function pluralize(n: number, one: string, many: string) {
  return `${new Intl.NumberFormat("nl-NL").format(n)} ${n === 1 ? one : many}`;
}

export function websiteLabel(url: string) {
  return url.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "");
}
