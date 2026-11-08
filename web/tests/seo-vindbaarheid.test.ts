// Vindbaarheid (review november 2026, R37 t/m R39): robots, sitemapdatums, titels, foto's in JSON-LD en de hubteksten.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  filterRobots,
  fitTitle,
  hubIntro,
  lastModifiedOf,
  ldImages,
  nl,
  placeTitle,
  provinceLinks,
  siteLd,
  TITLE_MAX,
  TITLE_SUFFIX,
  titleDepartureFact,
} from "../src/lib/seo-pages";
import { PROVINCES, type PlaceSummary } from "../src/lib/types";

let n = 0;
function place(over: Partial<PlaceSummary>): PlaceSummary {
  n++;
  return { id: `id${n}`, slug: `plek-${n}`, name: `Plek ${n}`, lat: 52, lng: 5, town: "Ergens", province: "Utrecht", ratingCount: 0, completeness: 0.5, ...over } as PlaceSummary;
}

const words = (s: string) => s.split(/\s+/).filter(Boolean).length;

test("filterRobots: zonder parameters indexeerbaar, met parameters noindex maar wel volgen", () => {
  assert.equal(filterRobots({}), undefined);
  assert.equal(filterRobots({ waar: undefined }), undefined);
  assert.deepEqual(filterRobots({ waar: "Zeeland" }), { index: false, follow: true });
  assert.deepEqual(filterRobots({ v: ["stroom", "water"] }), { index: false, follow: true });
  assert.deepEqual(filterRobots({ kaart: "" }), { index: false, follow: true });
});

test("lastModifiedOf: de jongste van wijziging, websitecontrole en vertrekcontrole", () => {
  assert.equal(lastModifiedOf({}), undefined);
  assert.equal(lastModifiedOf({ verifiedAt: "2026-10-01T10:00:00Z" }), "2026-10-01T10:00:00Z");
  assert.equal(
    lastModifiedOf({ updatedAt: "2026-10-05T10:00:00Z", verifiedAt: "2026-10-01T10:00:00Z", departureCheckedAt: "2026-11-02T08:00:00Z" }),
    "2026-11-02T08:00:00Z",
  );
  assert.equal(lastModifiedOf({ updatedAt: "2026-10-05", verifiedAt: null, departureCheckedAt: "onzin" }), "2026-10-05");
});

test("fitTitle: de eerste kandidaat die met de merknaam binnen 60 tekens past", () => {
  const max = TITLE_MAX - TITLE_SUFFIX.length;
  assert.equal(fitTitle(["x".repeat(max + 1), "kort"]), "kort");
  assert.equal(fitTitle([undefined, "a".repeat(max)]), "a".repeat(max));
  // Past niets: de kortste
  assert.equal(fitTitle(["x".repeat(80), "y".repeat(70)]), "y".repeat(70));
});

test("placeTitle: vertrekfeit bij zonder vertrektijd, prijs alleen als hij past", () => {
  const max = TITLE_MAX - TITLE_SUFFIX.length;
  const vrij = place({ name: "De Proef", town: "Ede", departure: "vrij" });
  const t = placeTitle(vrij, "Camperplaats De Proef", "Camperplaats De Proef in Ede: € 24,70 incl. toeslagen", "€ 24,70");
  assert.ok(t.includes("geen vaste vertrektijd"), t);
  assert.ok(t.length <= max, t);
  assert.ok(t.includes("Ede"), t);

  const per24 = place({ name: "Jachthaven Het Lange Water", town: "Sint Annaparochie", departure: "per24" });
  const t24 = placeTitle(per24, "Jachthaven Het Lange Water", "Jachthaven Het Lange Water in Sint Annaparochie: Gratis", "Gratis");
  assert.ok(t24.includes("betalen per 24 uur"), t24);
  assert.ok(!t24.includes("Gratis"), "midden in de titel klein geschreven");

  // Betwijfeld of afgewezen: geen vertrekfeit in de titel
  assert.equal(titleDepartureFact(place({ departure: "vrij", departureCheck: "voorwaardelijk" })), undefined);
  assert.equal(titleDepartureFact(place({ departure: "vast", checkoutUntil: "12:00" })), undefined);

  // Vaste tijd: de titel zoals hij was, als die past
  const vast = place({ name: "Hoeve", town: "Ede", departure: "vast", checkoutUntil: "11:00" });
  assert.equal(placeTitle(vast, "Camperplaats Hoeve", "Camperplaats Hoeve in Ede: € 12", "€ 12"), "Camperplaats Hoeve in Ede: € 12");
  // Te lang: korter, maar nooit zonder naam
  const lang = place({ name: "Camperpark De Allerlangste Naam Van Nederland", town: "Oost-Souburg", departure: "vast", checkoutUntil: "11:00" });
  const tl = placeTitle(lang, "Camperpark De Allerlangste Naam Van Nederland", "Camperpark De Allerlangste Naam Van Nederland in Oost-Souburg: € 30 incl. toeslagen", "€ 30");
  assert.ok(tl.includes("De Allerlangste Naam"), tl);
});

test("ldImages: alleen eigen uploads en foto's met toestemming, anders de deelafbeelding", () => {
  const own = "https://x.supabase.co/storage/";
  const og = "https://vrijstaan.nl/api/og?slug=a";
  assert.deepEqual(ldImages([{ url: "https://camping-x.nl/foto.jpg" }, { url: "https://upload.wikimedia.org/a.jpg" }], own, og), [og]);
  assert.deepEqual(ldImages([], own, og), [og]);
  assert.deepEqual(
    ldImages([{ url: "https://camping-x.nl/foto.jpg" }, { url: `${own}v1/object/public/a.jpg` }, { url: "https://b.nl/c.jpg", permission: true }], own, og),
    [`${own}v1/object/public/a.jpg`, "https://b.nl/c.jpg"],
  );
});

test("nl: aantallen met punt als duizendtal", () => {
  assert.equal(nl(1000), "1.000");
  assert.equal(nl(12), "12");
});

test("siteLd: WebSite en Organization met dezelfde site", () => {
  const [site, org] = siteLd("https://vrijstaan.nl", "hallo@vrijstaan.nl");
  assert.equal(site["@type"], "WebSite");
  assert.equal(site.url, "https://vrijstaan.nl");
  assert.equal(org["@type"], "Organization");
  assert.equal((org as { email?: string }).email, "hallo@vrijstaan.nl");
  assert.equal((siteLd("https://vrijstaan.nl")[1] as { email?: string }).email, undefined);
});

const data: PlaceSummary[] = [
  place({ province: "Zeeland", departure: "vrij", priceEur: 0 }),
  place({ province: "Zeeland", departure: "per24", priceEur: 12 }),
  place({ province: "Zeeland", departure: "vrij", departureCheck: "afgewezen" }),
  place({ province: "Friesland", departure: "vrij" }),
  place({ province: "Friesland", departure: "vast", checkoutUntil: "12:00" }),
  place({ province: "Utrecht", departure: "vast", checkoutUntil: "13:00" }),
  place({ province: "Utrecht", departure: "vast", checkoutUntil: "11:00" }),
  place({ province: "Utrecht", departure: "vast", checkoutUntil: "10:00" }),
];

test("provinceLinks: altijd twaalf provincies met het aantal uit de hub", () => {
  const vrij = provinceLinks(data, "vrij");
  assert.equal(vrij.length, PROVINCES.length);
  assert.deepEqual(vrij.find((l) => l.province === "Zeeland"), { province: "Zeeland", href: "/zonder-vertrektijd/zeeland", count: 2 });
  assert.equal(vrij.find((l) => l.province === "Utrecht")?.count, 0);
  assert.equal(provinceLinks(data, "uitslapers").find((l) => l.province === "Utrecht")?.href, "/uitslapers/utrecht");
  const overig = provinceLinks(data, "overig").find((l) => l.province === "Utrecht");
  assert.deepEqual(overig, { province: "Utrecht", href: "/camperplaatsen/utrecht", count: 2 });
  // De afgewezen regel telt als onbekend, dus bij Overige
  assert.equal(provinceLinks(data, "overig").find((l) => l.province === "Zeeland")?.count, 1);
});

test("hubIntro: alleen echte cijfers, 100 tot 150 woorden, zonder verboden stijl", () => {
  const vrij = hubIntro("vrij", data);
  assert.match(vrij.lead, /3 camperplaatsen zonder vaste vertrektijd, verspreid over 2 provincies/);
  assert.match(vrij.lead, /De meeste liggen in Zeeland \(2\)/);
  assert.ok(vrij.more.some((l) => l.includes("Bij 1 plek betaal je per 24 uur, bij de andere 2 plekken")));
  assert.ok(vrij.more.some((l) => l.includes("1 plek daarvan is gratis")));

  const late = hubIntro("uitslapers", data);
  assert.match(late.lead, /2 camperplaatsen waar je pas om 12:00 of later weg hoeft/);
  assert.ok(late.more[0].includes("van 4 camperplaatsen"), late.more[0]);

  const other = hubIntro("overig", data);
  assert.match(other.lead, /3 camperplaatsen: 1 waar je tussen 11:00 en 12:00 weg moet, 1 met een vertrektijd vóór 11:00 en 1 waarvan/);

  for (const h of [vrij, late, other]) {
    const all = [h.lead, ...h.more].join(" ");
    const w = words(all);
    assert.ok(w >= 100 && w <= 150, `${w} woorden: ${all}`);
    assert.doesNotMatch(all, /[—–]|·|→|!|ontdek|ervaar|uniek|perfect/i);
  }

  assert.match(hubIntro("vrij", []).lead, /nog geen/);
  assert.match(hubIntro("overig", []).lead, /nog geen/);
});
