export function eur(n: number): string {
  return new Intl.NumberFormat("nl-NL", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: Number.isInteger(n) ? 0 : 2,
  }).format(n);
}

/** "38 EUR" → "€ 38" */
export function formatPrice(text: string): string {
  const m = text.match(/^(\d+(?:[.,]\d+)?)\s*(eur|euro|€)?$/i);
  return m ? `€ ${m[1].replace(".", ",")}` : text;
}
