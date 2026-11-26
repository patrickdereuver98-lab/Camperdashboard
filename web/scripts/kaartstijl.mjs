#!/usr/bin/env node
// Eigen kaartstijl van VrijStaan ("natuur & vrijheid"), licht en donker, op dezelfde vectortegels van OpenFreeMap als
// voorheen (geen nieuwe dienst, geen sleutel, geen tracking). Schrijft public/kaart/licht.json en public/kaart/donker.json.
//   node scripts/kaartstijl.mjs
// Verschil met Positron + tint(): bos, heide, duin en zand, akker, wetland en gras elk een eigen tint; wegen in een
// warme rangorde; zacht reliëf (Natural Earth, al bij OpenFreeMap) op lage zoom; plaatsnamen in het Nederlands.
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const OUT = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "kaart");

const PALET = {
  licht: {
    land: "#f1ebdf",
    akker: "#ede6d3",
    woon: "#e8e0d0",
    industrie: "#e4dfd6",
    gras: "#dfe8d2",
    park: "#d9e6cc",
    bos: "#c9dcbf",
    heide: "#e7dcc6",
    zand: "#f0e3c3",
    wetland: "#d5e4da",
    water: "#c3dde0",
    waterlijn: "#a7cbd1",
    gebouw: "#e2d9c8",
    gebouwRand: "#d6ccb8",
    snelweg: "#f2d3a8",
    snelwegRand: "#d6ae7c",
    hoofdweg: "#fbf3e2",
    hoofdwegRand: "#d3c4a6",
    weg: "#fffcf6",
    wegRand: "#ddd2bd",
    pad: "#c8b99c",
    spoor: "#bdb3a2",
    grens: "#9f927a",
    grensProv: "#c7b9a0",
    tekst: "#3a463e",
    tekstZacht: "#69736b",
    waterTekst: "#3f7884",
    halo: "#fffcf6",
    relief: 0.22,
  },
  donker: {
    // Nacht, geen camouflage: land bijna neutraal, terrein alleen in lichtheid (bos donkerder), zodat groen voor de
    // stippen en clusters blijft. Water duidelijk dieper blauw, wegen lichter dan het land.
    land: "#171d1a",
    akker: "#171d1a",
    woon: "#1d2320",
    industrie: "#1f2422",
    gras: "#181f1b",
    park: "#17201b",
    bos: "#121815",
    heide: "#1b201c",
    zand: "#20221e",
    wetland: "#141f22",
    water: "#0e2430",
    waterlijn: "#1c3f4d",
    gebouw: "#232a26",
    gebouwRand: "#2c3430",
    snelweg: "#695842",
    snelwegRand: "#2a2520",
    hoofdweg: "#3d4641",
    hoofdwegRand: "#1a201d",
    weg: "#2e3632",
    wegRand: "#1a201d",
    pad: "#3a443e",
    spoor: "#39413c",
    grens: "#7d877e",
    grensProv: "#3c4640",
    tekst: "#ddd8cb",
    tekstZacht: "#98a198",
    waterTekst: "#82bcc8",
    halo: "#111713",
    relief: 0.3,
  },
};

const NAAM = ["coalesce", ["get", "name:nl"], ["get", "name"]];
const REGULAR = ["Noto Sans Regular"];
const BOLD = ["Noto Sans Bold"];
const ITALIC = ["Noto Sans Italic"];
const POLY = ["match", ["geometry-type"], ["MultiPolygon", "Polygon"], true, false];
const geenBrug = ["match", ["get", "brunnel"], ["bridge", "tunnel"], false, true];
const z = (...stops) => ["interpolate", ["exponential", 1.5], ["zoom"], ...stops];

function stijl(naam, c) {
  const fill = (id, sourceLayer, filter, color, extra = {}) => ({
    id,
    type: "fill",
    source: "openmaptiles",
    "source-layer": sourceLayer,
    ...(filter ? { filter } : {}),
    ...extra.layer,
    paint: { "fill-color": color, "fill-antialias": true, ...extra.paint },
  });

  // Wegen: [klassen, rand, vulling, breedte-stops, minzoom]
  const wegen = [
    ["pad", ["path", "track"], null, c.pad, [13, 0.6, 18, 2], 13, [2, 2]],
    ["weg_klein", ["minor", "service", "street", "street_limited"], c.wegRand, c.weg, [12, 0.6, 14, 2.5, 18, 14], 12],
    ["weg_secundair", ["secondary", "tertiary"], c.hoofdwegRand, c.hoofdweg, [8, 0.6, 12, 2.4, 14, 4.5, 18, 20], 8],
    ["weg_primair", ["primary", "trunk"], c.hoofdwegRand, c.hoofdweg, [6, 0.6, 10, 2, 14, 6, 18, 24], 6],
    ["snelweg", ["motorway"], c.snelwegRand, c.snelweg, [5, 0.6, 10, 2.4, 14, 7, 18, 28], 5],
  ];
  const wegLagen = [];
  for (const [id, klassen, rand, vulling, breedte, minzoom, dash] of wegen) {
    const filter = ["all", geenBrug, ["match", ["get", "class"], klassen, true, false], ["!=", ["get", "brunnel"], "tunnel"]];
    if (rand)
      wegLagen.push({
        id: `${id}_rand`,
        type: "line",
        source: "openmaptiles",
        "source-layer": "transportation",
        minzoom: Math.max(minzoom, 9),
        filter,
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": rand, "line-width": z(...breedte.map((v, i) => (i % 2 ? v + 1.6 : v))) },
      });
    wegLagen.push({
      id,
      type: "line",
      source: "openmaptiles",
      "source-layer": "transportation",
      minzoom,
      filter,
      layout: { "line-cap": "round", "line-join": "round" },
      paint: { "line-color": vulling, "line-width": z(...breedte), ...(dash ? { "line-dasharray": dash } : {}) },
    });
  }

  const label = (id, filter, size, font, color, extra = {}) => ({
    id,
    type: "symbol",
    source: "openmaptiles",
    "source-layer": "place",
    filter,
    ...extra.layer,
    layout: {
      "text-field": NAAM,
      "text-font": font,
      "text-size": size,
      "text-max-width": 8,
      ...extra.layout,
    },
    paint: { "text-color": color, "text-halo-color": c.halo, "text-halo-width": 1.6, "text-halo-blur": 0.4, ...extra.paint },
  });

  return {
    version: 8,
    name: `VrijStaan ${naam}`,
    metadata: { bron: "web/scripts/kaartstijl.mjs" },
    sources: {
      openmaptiles: { type: "vector", url: "https://tiles.openfreemap.org/planet" },
      reliëf: {
        type: "raster",
        tiles: ["https://tiles.openfreemap.org/natural_earth/ne2sr/{z}/{x}/{y}.png"],
        tileSize: 256,
        maxzoom: 6,
      },
    },
    glyphs: "https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf",
    layers: [
      { id: "achtergrond", type: "background", paint: { "background-color": c.land } },
      {
        id: "reliëf",
        type: "raster",
        source: "reliëf",
        maxzoom: 9,
        paint: {
          "raster-opacity": ["interpolate", ["linear"], ["zoom"], 4, c.relief, 8, 0],
          "raster-saturation": -1,
          "raster-contrast": naam === "donker" ? -0.2 : 0,
          "raster-brightness-min": naam === "donker" ? 0 : 0.35,
          "raster-brightness-max": naam === "donker" ? 0.25 : 1,
        },
      },
      fill("akker", "landcover", ["==", ["get", "class"], "farmland"], c.akker, { layer: { minzoom: 8 } }),
      fill("woon", "landuse", ["match", ["get", "class"], ["residential", "suburb", "neighbourhood"], true, false], c.woon, {
        paint: { "fill-opacity": ["interpolate", ["linear"], ["zoom"], 6, 0.5, 12, 1] },
      }),
      fill("industrie", "landuse", ["match", ["get", "class"], ["industrial", "commercial", "retail", "railway"], true, false], c.industrie, {
        layer: { minzoom: 10 },
      }),
      fill("gras", "landcover", ["all", ["==", ["get", "class"], "grass"], ["!=", ["get", "subclass"], "heath"]], c.gras),
      fill("heide", "landcover", ["==", ["get", "subclass"], "heath"], c.heide),
      fill("park", "park", POLY, c.park, { paint: { "fill-opacity": 0.7 } }),
      fill("bos", "landcover", ["==", ["get", "class"], "wood"], c.bos, {
        paint: { "fill-opacity": ["interpolate", ["linear"], ["zoom"], 5, 0.7, 10, 1] },
      }),
      fill("wetland", "landcover", ["==", ["get", "class"], "wetland"], c.wetland),
      fill("zand", "landcover", ["match", ["get", "class"], ["sand"], true, false], c.zand),
      fill("strand", "landuse", ["==", ["get", "class"], "beach"], c.zand),
      {
        id: "waterlijn",
        type: "line",
        source: "openmaptiles",
        "source-layer": "waterway",
        filter: ["!=", ["get", "brunnel"], "tunnel"],
        minzoom: 8,
        layout: { "line-cap": "round" },
        paint: {
          "line-color": c.waterlijn,
          // Zoom moet buitenaan staan (MapLibre): per stop rivier breder dan sloot of beek
          "line-width": z(
            ...[8, 11, 14, 18].flatMap((zoom, i) => [
              zoom,
              ["match", ["get", "class"], "river", [0.8, 1.6, 3, 12][i], [0, 0.4, 1, 4][i]],
            ]),
          ),
        },
      },
      fill("water", "water", ["all", POLY, ["!=", ["get", "brunnel"], "tunnel"]], c.water),
      {
        id: "water_oever",
        type: "line",
        source: "openmaptiles",
        "source-layer": "water",
        minzoom: 11,
        filter: POLY,
        paint: { "line-color": c.waterlijn, "line-width": 0.6, "line-opacity": 0.7 },
      },
      fill("gebouw", "building", null, c.gebouw, {
        layer: { minzoom: 13 },
        paint: {
          "fill-outline-color": c.gebouwRand,
          "fill-opacity": ["interpolate", ["linear"], ["zoom"], 13, 0, 14.5, 1],
        },
      }),
      {
        id: "spoor",
        type: "line",
        source: "openmaptiles",
        "source-layer": "transportation",
        minzoom: 10,
        filter: ["all", ["==", ["get", "class"], "rail"], ["!=", ["get", "brunnel"], "tunnel"]],
        paint: { "line-color": c.spoor, "line-width": z(10, 0.6, 16, 2), "line-dasharray": [3, 2] },
      },
      ...wegLagen,
      {
        id: "brug_snelweg",
        type: "line",
        source: "openmaptiles",
        "source-layer": "transportation",
        minzoom: 11,
        filter: ["all", ["==", ["get", "brunnel"], "bridge"], ["match", ["get", "class"], ["motorway", "trunk", "primary"], true, false]],
        layout: { "line-cap": "butt", "line-join": "round" },
        paint: { "line-color": c.snelweg, "line-width": z(11, 3, 14, 7, 18, 28) },
      },
      {
        id: "grens_provincie",
        type: "line",
        source: "openmaptiles",
        "source-layer": "boundary",
        minzoom: 6,
        filter: ["all", ["==", ["get", "admin_level"], 4], ["!=", ["get", "maritime"], 1]],
        paint: { "line-color": c.grensProv, "line-width": z(6, 0.6, 12, 1.4), "line-dasharray": [4, 3] },
      },
      {
        id: "grens_land",
        type: "line",
        source: "openmaptiles",
        "source-layer": "boundary",
        filter: ["all", ["==", ["get", "admin_level"], 2], ["!=", ["get", "maritime"], 1], ["!=", ["get", "disputed"], 1]],
        layout: { "line-join": "round" },
        paint: { "line-color": c.grens, "line-width": z(3, 0.6, 10, 1.6, 14, 2.4), "line-dasharray": [5, 2, 1, 2] },
      },
      {
        id: "water_naam",
        type: "symbol",
        source: "openmaptiles",
        "source-layer": "water_name",
        filter: ["match", ["geometry-type"], ["MultiPoint", "Point"], true, false],
        layout: { "text-field": NAAM, "text-font": ITALIC, "text-size": z(5, 11, 12, 14), "text-letter-spacing": 0.08, "text-max-width": 8 },
        paint: { "text-color": c.waterTekst, "text-halo-color": c.halo, "text-halo-width": 1.2 },
      },
      {
        id: "rivier_naam",
        type: "symbol",
        source: "openmaptiles",
        "source-layer": "waterway",
        minzoom: 12,
        filter: ["==", ["get", "class"], "river"],
        layout: { "text-field": NAAM, "text-font": ITALIC, "text-size": 12, "symbol-placement": "line", "text-letter-spacing": 0.1 },
        paint: { "text-color": c.waterTekst, "text-halo-color": c.halo, "text-halo-width": 1.2 },
      },
      {
        id: "weg_naam",
        type: "symbol",
        source: "openmaptiles",
        "source-layer": "transportation_name",
        minzoom: 14,
        filter: ["match", ["get", "class"], ["primary", "secondary", "tertiary", "minor", "street"], true, false],
        layout: { "text-field": NAAM, "text-font": REGULAR, "text-size": 12, "symbol-placement": "line" },
        paint: { "text-color": c.tekstZacht, "text-halo-color": c.halo, "text-halo-width": 1.4 },
      },
      label("dorp", ["match", ["get", "class"], ["village", "hamlet"], true, false], z(10, 11, 15, 14), REGULAR, c.tekstZacht, {
        layer: { minzoom: 10 },
      }),
      label("stad", ["==", ["get", "class"], "town"], z(8, 12, 14, 16), REGULAR, c.tekst, { layer: { minzoom: 7 } }),
      label("grote_stad", ["==", ["get", "class"], "city"], z(5, 12, 12, 19), BOLD, c.tekst, {
        layout: { "symbol-sort-key": ["get", "rank"] },
      }),
      label("provincie", ["==", ["get", "class"], "state"], z(5, 11, 8, 13), REGULAR, c.tekstZacht, {
        layer: { minzoom: 5, maxzoom: 8 },
        layout: { "text-transform": "uppercase", "text-letter-spacing": 0.15 },
      }),
      label("land", ["==", ["get", "class"], "country"], z(3, 12, 7, 16), BOLD, c.tekstZacht, {
        layer: { maxzoom: 9 },
        layout: { "text-transform": "uppercase", "text-letter-spacing": 0.12 },
      }),
    ],
  };
}

mkdirSync(OUT, { recursive: true });
for (const [naam, palet] of Object.entries(PALET)) {
  writeFileSync(join(OUT, `${naam}.json`), JSON.stringify(stijl(naam, palet)) + "\n");
  console.log(`public/kaart/${naam}.json`);
}
