// Eenvoudige limiet per bezoeker voor de API-routes die een externe dienst aanspreken of veel rekenen.
// Het IP-adres staat alleen kort in het geheugen van deze serverinstantie en wordt nergens opgeslagen.
// Elke instantie telt apart; dit remt een simpele lus af. Voor zwaarder misbruik: de firewall van Vercel.

const WINDOW_MS = 60_000;
const hits = new Map<string, { n: number; reset: number }>();

/**
 * `max` verzoeken per minuut per IP-adres. Met `scope` telt een route apart (bv. "beeld"), zodat een zware route een
 * eigen, lagere limiet heeft die niet meetelt bij de andere routes. Zonder scope: de gedeelde teller.
 */
export function rateLimited(request: Request, max: number, scope = ""): Response | null {
  const addr = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "onbekend";
  const ip = scope ? `${scope}:${addr}` : addr;
  const now = Date.now();
  if (hits.size > 5000) for (const [k, v] of hits) if (v.reset < now) hits.delete(k);
  const entry = hits.get(ip);
  if (!entry || entry.reset < now) {
    hits.set(ip, { n: 1, reset: now + WINDOW_MS });
    return null;
  }
  entry.n += 1;
  if (entry.n <= max) return null;
  return Response.json(
    { error: "Te veel verzoeken. Probeer het over een minuut opnieuw." },
    { status: 429, headers: { "Retry-After": String(Math.ceil((entry.reset - now) / 1000)) } },
  );
}
