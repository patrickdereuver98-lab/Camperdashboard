// Landingspagina's voor zoekmachines: slugs, de drempel tegen dunne pagina's, eilanden en de tekst uit cijfers.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  areaIntro,
  areaPath,
  areasIn,
  breadcrumbLd,
  countsOf,
  departureIntro,
  departurePath,
  findArea,
  indexable,
  inGroup,
  itemListLd,
  ldJson,
  MIN_PLACES,
  provinceFromSlug,
  provinceSlug,
  rankForLanding,
  slugify,
} from "../src/lib/seo-pages";
import { PROVINCES, type PlaceSummary } from "../src/lib/types";

let n = 0;
function place(over: Partial<PlaceSummary>): PlaceSummary {
  n++;
  return { id: `id${n}`, slug: `plek-${n}`, name: `Plek ${n}`, lat: 52, lng: 5, town: "Ergens", province: "Utrecht", ratingCount: 0, completeness: 0.5, ...over } as PlaceSummary;
}

test("slugify: kleine letters, zonder accenten, apostrof of spaties", () => {
  assert.equal(slugify("Den Burg"), "den-burg");
  assert.equal(slugify("West-Terschelling"), "west-terschelling");
  assert.equal(slugify("'s-Hertogenbosch"), "s-hertogenbosch");
  assert.equal(slugify("Ee (Fr)"), "ee-fr");
  assert.equal(slugify("Wâlterswâld"), "walterswald");
  assert.equal(slugify("  Sint  Oedenrode "), "sint-oedenrode");
  assert.equal(slugify(""), "");
});

test("provincieslugs gaan heen en terug, ook met een koppelteken", () => {
  for (const p of PROVINCES) assert.equal(provinceFromSlug(provinceSlug(p)), p);
  assert.equal(provinceSlug("Noord-Holland"), "noord-holland");
  assert.equal(provinceFromSlug("atlantis"), undefined);
  assert.equal(areaPath("Noord-Holland", "texel"), "/camperplaatsen/noord-holland/texel");
  assert.equal(departurePath("vrij", "Zeeland"), "/zonder-vertrektijd/zeeland");
  assert.equal(departurePath("uitslapers", "Zuid-Holland"), "/uitslapers/zuid-holland");
});

test("drempel: pas vanaf MIN_PLACES (3) een indexeerbare pagina", () => {
  assert.equal(MIN_PLACES, 3);
  assert.equal(indexable(0), false);
  assert.equal(indexable(2), false);
  assert.equal(indexable(3), true);
  assert.equal(indexable(40), true);
});

test("plaatsen: gegroepeerd op slug binnen de provincie, met de meest gebruikte schrijfwijze", () => {
  const places = [
    place({ town: "Den Burg", province: "Zeeland", lat: 51.5, lng: 3.6 }),
    place({ town: "Den Burg", province: "Zeeland", lat: 51.5, lng: 3.6 }),
    place({ town: "den burg", province: "Zeeland", lat: 51.5, lng: 3.6 }),
    place({ town: "Veere", province: "Zeeland", lat: 51.5, lng: 3.6 }),
    place({ town: "Den Burg", province: "Utrecht" }),
  ];
  const areas = areasIn(places, "Zeeland");
  assert.deepEqual(areas.map((a) => [a.slug, a.name, a.places.length]), [["den-burg", "Den Burg", 3], ["veere", "Veere", 1]]);
  assert.equal(findArea(places, "Utrecht", "den-burg")?.places.length, 1);
  assert.equal(findArea(places, "Zeeland", "bestaat-niet"), undefined);
});

test("eilanden: op ligging, niet op plaatsnaam; de vaste wal (Den Helder) hoort er niet bij", () => {
  const places = [
    place({ town: "Den Burg", province: "Noord-Holland", lat: 53.05, lng: 4.8 }),
    place({ town: "De Cocksdorp", province: "Noord-Holland", lat: 53.16, lng: 4.86 }),
    place({ town: "Den Hoorn", province: "Noord-Holland", lat: 53.03, lng: 4.75 }),
    place({ town: "Den Helder", province: "Noord-Holland", lat: 52.95, lng: 4.76 }),
  ];
  const texel = findArea(places, "Noord-Holland", "texel");
  assert.equal(texel?.kind, "eiland");
  assert.equal(texel?.prep, "op");
  assert.deepEqual(texel?.places.map((p) => p.town), ["Den Burg", "De Cocksdorp", "Den Hoorn"]);
  // De plaatsen op het eiland houden hun eigen pagina
  assert.equal(findArea(places, "Noord-Holland", "den-burg")?.kind, "plaats");
  // Texel ligt niet in Friesland, ook niet als de coördinaten kloppen
  assert.equal(findArea(places.map((p) => ({ ...p, province: "Friesland" })), "Friesland", "texel"), undefined);
  // Geen plekken op een eiland: geen pagina
  assert.equal(findArea(places, "Friesland", "ameland"), undefined);
});

test("kerncijfers en vertrekgroepen", () => {
  const places = [
    place({ departure: "vrij", priceEur: 0 }),
    place({ departure: "per24", departureCheck: "bevestigd", priceEur: 12 }),
    place({ departure: "vrij", departureCheck: "voorwaardelijk" }),
    place({ departure: "vast", checkoutUntil: "12:00" }),
    place({ departure: "vast", checkoutUntil: "10:00" }),
  ];
  assert.deepEqual(countsOf(places), { total: 5, free: 1, vrij: 2, uitslapers: 1, unknownDeparture: 1 });
  assert.equal(inGroup(places, "vrij").length, 2);
  assert.equal(inGroup(places, "uitslapers").length, 1);
});

test("inleiding zegt alleen wat de cijfers zeggen", () => {
  assert.deepEqual(areaIntro("op Texel", { total: 10, free: 2, vrij: 3, uitslapers: 1, unknownDeparture: 4 }), [
    "Er staan 10 camperplaatsen op Texel in de gids, waarvan 2 gratis.",
    "Bij 3 plekken vertrek je wanneer je wilt of betaal je per 24 uur, en bij 1 plek hoef je pas om 12:00 of later weg.",
    "Van 4 plekken weten we de vertrektijd nog niet.",
  ]);
  // Niets bekend over vertrekken: geen zin daarover
  assert.deepEqual(areaIntro("in Veere", { total: 1, free: 0, vrij: 0, uitslapers: 0, unknownDeparture: 0 }), ["Er staat 1 camperplaats in Veere in de gids."]);
  assert.deepEqual(areaIntro("in Veere", { total: 0, free: 0, vrij: 0, uitslapers: 0, unknownDeparture: 0 }), ["Er staan nog geen camperplaatsen in Veere in de gids."]);
  assert.equal(
    departureIntro("vrij", "Zeeland", 14, 3),
    "Er zijn 14 camperplaatsen in Zeeland waar je vertrekt wanneer je wilt of per 24 uur betaalt vanaf aankomst. 3 daarvan zijn gratis.",
  );
  assert.equal(departureIntro("uitslapers", "Utrecht", 1, 0), "Er is 1 camperplaats in Utrecht waar je pas om 12:00 of later weg hoeft.");
  assert.match(departureIntro("vrij", "Flevoland", 0, 0), /nog geen camperplaatsen/);
});

test("volgorde: volledigheid, dan foto, dan score met reviews, dan naam", () => {
  const a = place({ name: "B", completeness: 0.9 });
  const b = place({ name: "A", completeness: 0.9 });
  const c = place({ name: "C", completeness: 0.9, imageUrl: "https://x/y.jpg" });
  const d = place({ name: "D", completeness: 1 });
  const e = place({ name: "E", completeness: 0.9, ratingAvg: 9, ratingCount: 0 });
  assert.deepEqual(rankForLanding([a, b, c, d, e]).map((p) => p.name), ["D", "C", "A", "B", "E"]);
});

test("structured data: BreadcrumbList en ItemList met volledige adressen, veilig in een script", () => {
  const crumbs = breadcrumbLd("https://vrijstaan.nl", [{ name: "Start", path: "/" }, { name: "Zeeland", path: "/camperplaatsen/zeeland" }]);
  assert.deepEqual(crumbs.itemListElement[1], { "@type": "ListItem", position: 2, name: "Zeeland", item: "https://vrijstaan.nl/camperplaatsen/zeeland" });
  const list = itemListLd("https://vrijstaan.nl", "Camperplaatsen op Texel", [{ slug: "de-koog", name: "De Koog" }]);
  assert.equal(list.numberOfItems, 1);
  assert.equal(list.itemListElement[0].url, "https://vrijstaan.nl/plek/de-koog");
  assert.ok(!ldJson({ name: "</script><script>" }).includes("</script>"));
});
