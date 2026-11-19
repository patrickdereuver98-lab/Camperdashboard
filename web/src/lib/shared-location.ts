/**
 * Delen naar VrijStaan (Android, share target in het manifest): Google Maps, WhatsApp of een andere app geeft een
 * titel, tekst en/of link. Daar halen we een punt uit als dat er letterlijk in staat; anders de plaatsnaam als tekst.
 * We raden nooit een plek: geen punt en geen tekst = niets.
 */

export type SharedLocation = { kind: "point"; lat: number; lng: number; label?: string } | { kind: "text"; text: string } | null;

// Ruim kader om Nederland en de grensstreek
const inArea = (lat: number, lng: number) => lat > 49.5 && lat < 54.5 && lng > 2 && lng < 8.5;

export function parseSharedLocation(input: { title?: string | null; text?: string | null; url?: string | null }): SharedLocation {
  const all = [input.url, input.text, input.title].filter(Boolean).join(" ");
  // @52.1,5.2 (Google Maps), ?q=52.1,5.2 / ll= / daddr= / query=, of losse coördinaten "52.1, 5.2"
  const patterns = [/@(-?\d{1,2}\.\d+),(-?\d{1,3}\.\d+)/, /[?&](?:q|ll|query|daddr|destination|center)=(-?\d{1,2}\.\d+)(?:,|%2C)\s*(-?\d{1,3}\.\d+)/i, /(-?\d{1,2}\.\d{3,}),\s*(-?\d{1,3}\.\d{3,})/];
  for (const re of patterns) {
    const m = re.exec(all);
    if (m) {
      const lat = Number(m[1]);
      const lng = Number(m[2]);
      if (inArea(lat, lng)) return { kind: "point", lat, lng, label: cleanLabel(input.title) };
    }
  }
  // Geen punt: de naam uit de titel of de tekst (zonder links), om op te zoeken
  const text = cleanLabel(input.title) ?? cleanLabel(input.text?.replace(/https?:\/\/\S+/g, ""));
  return text ? { kind: "text", text } : null;
}

function cleanLabel(v?: string | null): string | undefined {
  const t = v?.replace(/https?:\/\/\S+/g, "").replace(/\s+/g, " ").trim();
  return t && t.length >= 2 ? t.slice(0, 80) : undefined;
}
