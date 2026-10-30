import { strict as assert } from "node:assert";
import { test } from "node:test";
import { byClusterSize, CLUSTER_RADIUS, clusterColors, clusterTier, popupProps, toGeoJSON, type MapPlace } from "../src/lib/map-data";

const place = (i: number, extra: Partial<MapPlace> = {}): MapPlace => ({
  slug: `plek-${i}`, name: `Plek ${i}`, lat: 52 + i / 1000, lng: 5 + i / 1000, town: "Ergens", priceEur: 15,
  imageUrl: `https://example.org/foto-${i}.jpg`, ...extra,
});

test("stippen dragen alleen slug, kleur, onvolledig en prijs; geen naam, plaats of foto", () => {
  const fc = toGeoJSON([place(1, { departure: "vrij" })], true);
  assert.equal(fc.features.length, 1);
  assert.deepEqual(Object.keys(fc.features[0].properties).sort(), ["group", "incomplete", "price", "slug"]);
  assert.deepEqual(fc.features[0].geometry.coordinates, [5.001, 52.001]);
  assert.equal(fc.features[0].properties.group, "vrij");
});

test("beheer (zonder vertrekgegevens): effen stip, nooit onvolledig", () => {
  const [f] = toGeoJSON([place(1)], false).features;
  assert.equal(f.properties.group, "plain");
  assert.equal(f.properties.incomplete, false);
});

test("pop-up komt uit de plek zelf", () => {
  const p = popupProps(place(7));
  assert.equal(p.slug, "plek-7");
  assert.equal(p.name, "Plek 7");
  assert.equal(p.image, "https://example.org/foto-7.jpg");
  assert.equal(popupProps(place(7, { imageUrl: undefined })).image, "");
});

test("3.000 plekken: kleine GeoJSON en snel", () => {
  const places = Array.from({ length: 3000 }, (_, i) => place(i));
  const t = performance.now();
  const fc = toGeoJSON(places, true);
  assert.ok(performance.now() - t < 200);
  // Vroeger droeg elke stip ook naam, plaats, foto-URL en vertrekregel (de pop-up)
  const old = { ...fc, features: fc.features.map((f, i) => ({ ...f, properties: { ...f.properties, ...popupProps(places[i]) } })) };
  const ratio = JSON.stringify(fc).length / JSON.stringify(old).length;
  assert.ok(ratio < 0.7, `nieuw/oud = ${ratio.toFixed(2)}`);
});

test("clustergrootte: < 10, 10–49, ≥ 50", () => {
  assert.deepEqual([1, 9, 10, 49, 50, 3000].map(clusterTier), [0, 0, 1, 1, 2, 2]);
  assert.deepEqual(byClusterSize(CLUSTER_RADIUS), ["step", ["get", "point_count"], 16, 10, 21, 50, 27]);
});

test("clusterkleuren: drie bosgroene tinten, witte cijfers ≥ 4,5:1", () => {
  const lum = (hex: string) => {
    const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((x) => (x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4));
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  };
  for (const dark of [false, true]) {
    const colors = clusterColors(dark);
    assert.equal(new Set(colors).size, 3);
    for (const c of colors) assert.ok(1.05 / (lum(c) + 0.05) >= 4.5, `${c} in ${dark ? "donker" : "licht"}`);
  }
});
