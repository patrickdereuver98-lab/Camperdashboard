import { ImageResponse } from "next/og";
import { ogFonts } from "@/lib/og-fonts";
import { BRAND_DOMAIN, BRAND_NAME } from "@/lib/brand";
import { allInPrice, departureFact, labeledName } from "@/lib/place-seo";
import { getPlace } from "@/lib/places";
import { rateLimited } from "@/lib/rate-limit";

// Kleuren uit het thema "natuur & vrijheid" (globals.css): zandpapier, bosgroen, inkt
const PAPER = "#f5f0e6";
const SURFACE = "#fffcf6";
const FOREST = "#1f4e37";
const INK = "#1f2b24";
const INK_2 = "#46524a";
const LINE = "#e0d7c5";

const SLUG = /^[a-z0-9-]{1,120}$/;
const CACHE = { "Cache-Control": "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800" };

/**
 * GET /api/og?slug=...: deelafbeelding (1200 × 630) voor een plek, met naam, plaats, all-in prijs en vertrektijd in
 * grote letters (leesbaar voor ouderen, ook als klein voorbeeld in een tijdlijn). Onbekende feiten laten we weg.
 * Gebruikt als og:image op de plekpagina en als download in Mission Control (tab Marketing).
 */
export async function GET(request: Request) {
  // Elke afbeelding kost rekentijd: een simpele lus remmen we af (SEC-12)
  const limited = rateLimited(request, 60);
  if (limited) return limited;
  const slug = new URL(request.url).searchParams.get("slug") ?? "";
  if (!SLUG.test(slug)) return new Response("Geef een geldige slug", { status: 400 });
  const place = await getPlace(slug);
  if (!place) return new Response("Plek niet gevonden", { status: 404 });

  const price = allInPrice(place);
  const dep = departureFact(place);
  const facts = [
    price && {
      // "Alles inbegrepen" alleen als elke bekende toeslag meetelt en stroom bekend is of er niet is (R22, lib/place-seo.ts)
      label: price.allIn && place.priceEur !== 0 ? "Prijs, alles inbegrepen" : "Prijs per nacht",
      value: price.amount,
      // Vanaf-prijs: het laagste tarief, toeslagen komen erbij
      note:
        price.allIn && place.priceEur !== 0
          ? "voor 2 personen"
          : price.withTax
            ? "2 personen, met toeristenbelasting"
            : place.priceFrom
              ? "plus toeslagen"
              : undefined,
    },
    dep && { label: "Vertrektijd", value: dep[0].toUpperCase() + dep.slice(1), note: undefined },
  ].filter(Boolean) as { label: string; value: string; note?: string }[];
  const name = labeledName(place);

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", background: PAPER, color: INK, fontFamily: "Geist", padding: "56px 64px" }}>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", fontSize: name.length > 34 ? 56 : 68, fontWeight: 600, lineHeight: 1.1, letterSpacing: -1 }}>{name}</div>
          <div style={{ display: "flex", fontSize: 40, color: INK_2, marginTop: 12 }}>
            {place.town}, {place.province}
          </div>
        </div>
        <div style={{ display: "flex", gap: 28, marginTop: "auto" }}>
          {facts.map((f) => (
            <div
              key={f.label}
              style={{ display: "flex", flexDirection: "column", flex: 1, background: SURFACE, border: `3px solid ${LINE}`, borderRadius: 20, padding: "24px 32px" }}
            >
              <div style={{ display: "flex", fontSize: 30, color: INK_2 }}>{f.label}</div>
              <div style={{ display: "flex", fontSize: f.value.length > 18 ? 48 : 64, fontWeight: 600, color: FOREST, marginTop: 6, lineHeight: 1.1 }}>{f.value}</div>
              {f.note && <div style={{ display: "flex", fontSize: 28, color: INK_2, marginTop: 6 }}>{f.note}</div>}
            </div>
          ))}
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 32, fontSize: 32 }}>
          <div style={{ display: "flex", fontWeight: 600, color: FOREST }}>{BRAND_NAME}</div>
          <div style={{ display: "flex", color: INK_2 }}>{BRAND_DOMAIN}</div>
        </div>
      </div>
    ),
    { width: 1200, height: 630, headers: CACHE, fonts: await ogFonts() },
  );
}
