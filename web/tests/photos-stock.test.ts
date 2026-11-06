// Stockfoto's weg en geen plattegrond of banner als eerste foto (R44).
import { strict as assert } from "node:assert";
import { test } from "node:test";
import { isStockPhoto, photoScore, rankPhotos, unfitAsCover } from "../src/lib/photos.ts";

test("stockfoto's: op host en bestandsnaam", () => {
  for (const url of [
    "https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=800&q=80",
    "https://primary.jwwb.nl/unsplash/-m0eMUtqXww.jpg?width=1200",
    "https://campingbesten.nl/wp-content/uploads/2021/09/dino-reichmuth-5Rhl-kSRydQ-unsplash.jpg",
    "https://www.campingalkmaar.nl/media/pexels-korvin-mckernek-4336739.jpg",
    "https://cpkesseleik.nl/wp-content/uploads/2020/12/istockphoto-691333546-612x612-1-16x10.jpg",
    "https://cdn.pixabay.com/photo/2017/08/camper.jpg",
    "https://www.shutterstock.com/image-photo/camper-260nw-1.jpg",
  ]) {
    assert.equal(isStockPhoto(url), true, url);
    assert.equal(photoScore(url), null, url);
  }
  assert.equal(isStockPhoto("https://www.camping-de-proef.nl/wp-content/uploads/2024/05/veld.jpg"), false);
});

test("niet als eerste foto: tekening, plattegrond, banner", () => {
  assert.equal(unfitAsCover("https://site.nl/img/plattegrond-2024.jpg"), true);
  assert.equal(unfitAsCover("https://site.nl/img/camping-map.jpg"), true);
  assert.equal(unfitAsCover("https://site.nl/img/banner_telefoon.jpg"), true);
  assert.equal(unfitAsCover("https://site.nl/img/logo.png"), true);
  assert.equal(unfitAsCover("https://site.nl/img/sfeer-veld.jpg"), false);
  assert.equal(unfitAsCover("https://site.nl/img/bitmap-veld.jpg"), false);
});

test("rankPhotos: echte foto vóór een grote plattegrond of banner, die blijven wel staan", () => {
  const photos = [
    { url: "https://site.nl/media/plattegrond.jpg?width=1600" },
    { url: "https://site.nl/media/banner-bel-ons.jpg?width=1600" },
    { url: "https://site.nl/media/veld.jpg?width=500" },
    { url: "https://images.unsplash.com/photo-1?w=1600" },
  ];
  const ranked = rankPhotos(photos).map((p) => p.url);
  assert.equal(ranked[0], "https://site.nl/media/veld.jpg?width=500");
  assert.equal(ranked.length, 3);
  assert.ok(!ranked.some((u) => u.includes("unsplash")));
});
