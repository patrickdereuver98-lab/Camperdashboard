import { ImageResponse } from "next/og";
import { ogFonts } from "@/lib/og-fonts";
import { BRAND_NAME } from "@/lib/brand";
import { FORMATS, slideFor } from "@/lib/marketing/images";
import { factsFromSummaries } from "@/lib/marketing/public-facts";
import { getSummaries } from "@/lib/places";
import { rateLimited } from "@/lib/rate-limit";
import { beeldParams } from "./params";

// Huisstijl (globals.css): zandpapier, bosgroen, inkt
const PAPER = "#f5f0e6";
const FOREST = "#1f4e37";
const ON_FOREST = "#fffcf6";
const INK = "#1f2b24";
const INK_2 = "#46524a";

const CACHE = { "Cache-Control": "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800" };

/**
 * GET /api/marketing/beeld?t=cijfers&f=portrait[&p=Gelderland][&i=2]: beeld voor Instagram, Facebook of TikTok.
 * Openbaar zodat het dashboard het als <img> kan tonen en downloaden; vaste teksten, feiten uit de openbare plekken.
 * Een beeld tekenen kost rekentijd: 20 per minuut per bezoeker (het CDN bewaart elk beeld daarna een dag).
 */
export async function GET(request: Request) {
  const limited = rateLimited(request, 20, "beeld");
  if (limited) return limited;
  const params = beeldParams(new URL(request.url).searchParams);
  if (!params) return new Response("Onbekend sjabloon, formaat of parameter", { status: 400 });
  const { t, f } = params;
  const facts = factsFromSummaries(await getSummaries());
  const slide = slideFor(t, facts, { province: params.province, slide: params.slide });
  if (!slide) return new Response("Te weinig plekken om dit eerlijk te tonen", { status: 404 });
  const { w, h } = FORMATS[f];
  const tall = h / w > 1.5;
  const scale = w / 1080;

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", background: PAPER, color: INK, fontFamily: "Geist", padding: `${(tall ? 140 : 88) * scale}px ${80 * scale}px` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 18 * scale }}>
          <div style={{ display: "flex", width: 56 * scale, height: 56 * scale, borderRadius: 14 * scale, background: FOREST, color: ON_FOREST, alignItems: "center", justifyContent: "center", fontSize: 34 * scale, fontWeight: 600 }}>V</div>
          <div style={{ display: "flex", fontSize: 40 * scale, fontWeight: 600, color: FOREST }}>{BRAND_NAME}</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", marginTop: "auto", marginBottom: "auto" }}>
          {slide.kicker && <div style={{ display: "flex", fontSize: 40 * scale, color: INK_2 }}>{slide.kicker}</div>}
          {slide.big && <div style={{ display: "flex", fontSize: (slide.big.length > 8 ? 120 : 200) * scale, color: FOREST, fontWeight: 600, lineHeight: 1, marginTop: 12 * scale, letterSpacing: -4 * scale }}>{slide.big}</div>}
          <div style={{ display: "flex", fontSize: (slide.big ? 56 : 84) * scale, fontWeight: 600, lineHeight: 1.12, marginTop: 20 * scale, letterSpacing: -1 * scale }}>{slide.title}</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 * scale, marginTop: 44 * scale }}>
            {slide.lines.map((l) => (
              <div key={l} style={{ display: "flex", alignItems: "center", gap: 20 * scale, fontSize: 40 * scale, color: INK_2 }}>
                <div style={{ display: "flex", width: 14 * scale, height: 14 * scale, borderRadius: 7 * scale, background: FOREST, flexShrink: 0 }} />
                <div style={{ display: "flex" }}>{l}</div>
              </div>
            ))}
          </div>
        </div>
        <div style={{ display: "flex", fontSize: 30 * scale, color: INK_2 }}>{slide.footer}</div>
      </div>
    ),
    { width: w, height: h, headers: CACHE, fonts: await ogFonts() },
  );
}
