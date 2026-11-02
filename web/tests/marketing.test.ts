// SEO-titels, deelafbeelding en AI-marketing: alleen bekende feiten, "inclusief toeslagen" alleen als het klopt.
import { strict as assert } from "node:assert";
import { test } from "node:test";
import { allInPrice, departureFact, labeledName, marketingText, parseMarketing, seoDescription, seoTitle, type MarketingPlace } from "../src/lib/marketing.ts";

const base: MarketingPlace = { slug: "de-proef-ede", name: "De Proef", town: "Ede", province: "Gelderland", kind: "camperplaats" };
const tax = { label: "Toeristenbelasting", amount: 1.35, unit: "per persoon per nacht" };

test("all-in prijs alleen als het totaal vaststaat", () => {
  const full = allInPrice({ ...base, priceEur: 20, priceExtras: [tax] });
  assert.equal(full?.allIn, true);
  assert.match(full!.text, /22,70 per nacht voor 2 personen, inclusief toeslagen/);
  const open = allInPrice({ ...base, priceEur: 20 });
  assert.equal(open?.allIn, false);
  assert.match(open!.text, /toeslagen niet volledig bekend/);
  assert.equal(allInPrice(base), undefined);
  assert.equal(allInPrice({ ...base, priceEur: 0 })?.amount, "Gratis");
});

test("vertrektijd: tijd, geen vaste tijd of weglaten", () => {
  assert.equal(departureFact({ ...base, departure: "vast", checkoutUntil: "12:00" }), "uiterlijk 12:00");
  assert.equal(departureFact({ ...base, departure: "vrij" }), "geen vaste tijd");
  assert.equal(departureFact({ ...base, departure: "vast", checkoutUntil: "middag" }), undefined);
  assert.equal(departureFact({ ...base, departure: "vrij", departureCheck: "afgewezen" }), undefined);
  assert.equal(departureFact(base), undefined);
});

test("naam zonder dubbel soortwoord", () => {
  assert.equal(labeledName(base), "Camperplaats De Proef");
  assert.equal(labeledName({ ...base, name: "Camperplaats Ede" }), "Camperplaats Ede");
});

test("SEO-titel en omschrijving volgen het vaste patroon en laten onbekend weg", () => {
  const p = { ...base, priceEur: 20, priceExtras: [tax], departure: "vast" as const, checkoutUntil: "12:00" };
  assert.match(seoTitle(p), /^Camperplaats De Proef in Ede: €\s?22,70 incl\. toeslagen$/);
  assert.match(seoDescription(p), /^Camperplaats De Proef in Ede \(Gelderland\): €\s?22,70 per nacht voor 2 personen, inclusief toeslagen\. Vertrektijd: uiterlijk 12:00\./);
  assert.equal(seoTitle(base), "Camperplaats De Proef in Ede");
  assert.doesNotMatch(seoDescription(base), /Vertrektijd|€/);
});

test("prompt bevat de vaste opdracht en alleen feiten, geen telefoon of e-mail", () => {
  const t = marketingText({ ...base, power: true, dogs: false }, "https://example.nl/plek/de-proef-ede");
  assert.match(t, /Schrijf 2 Facebook-posts en 2 Google Ads teksten voor camperplaats De Proef/);
  assert.match(t, /Geen emojis/);
  assert.match(t, /- Wel: stroom/);
  assert.match(t, /- Niet: honden welkom/);
  assert.match(t, /- Prijs: onbekend/);
  assert.doesNotMatch(t, /@/);
});

test("parseMarketing: 2 posts en 2 advertenties, emoji eruit, lengtes begrensd", () => {
  const ok = parseMarketing(
    JSON.stringify({
      facebook: ["Post een 🚐", "Post twee"],
      googleAds: [
        { headline: "Kop die veel te lang is voor Google Ads", description: "Omschrijving" },
        { headline: "Kop", description: "x".repeat(200) },
      ],
    }),
  );
  assert.ok(ok);
  assert.equal(ok.facebook[0], "Post een");
  assert.equal(ok.googleAds[0].headline.length, 30);
  assert.equal(ok.googleAds[1].description.length, 90);
  assert.equal(parseMarketing("geen json"), null);
  assert.equal(parseMarketing(JSON.stringify({ facebook: ["een"], googleAds: [] })), null);
});
