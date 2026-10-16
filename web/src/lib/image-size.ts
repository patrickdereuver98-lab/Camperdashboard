/** Langste zijde van een geüploade foto: scherp genoeg voor de galerij, klein genoeg voor mobiel bereik */
export const MAX_PHOTO_SIDE = 1600;
export const MIN_PHOTO_SIDE = 400;

/** Afmetingen binnen `max` met behoud van verhouding; nooit vergroten */
export function fitWithin(width: number, height: number, max = MAX_PHOTO_SIDE): { width: number; height: number } {
  if (!(width > 0 && height > 0)) throw new Error("Ongeldige afmetingen");
  const scale = Math.min(1, max / Math.max(width, height));
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}

/** Reden om een foto te weigeren, of null als hij bruikbaar is */
export function photoProblem(file: { type: string; size: number }, width?: number, height?: number): string | null {
  if (!/^image\/(jpeg|png|webp|heic|heif)$/i.test(file.type)) return "Kies een foto (JPG, PNG, WebP of HEIC).";
  if (file.size > 25 * 1024 * 1024) return "Deze foto is te groot (meer dan 25 MB).";
  if (width !== undefined && height !== undefined && Math.min(width, height) < MIN_PHOTO_SIDE)
    return `Deze foto is te klein. Kies een foto van minstens ${MIN_PHOTO_SIDE} pixels breed en hoog.`;
  return null;
}
