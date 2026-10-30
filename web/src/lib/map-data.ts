// Gegevens en clusterregels voor de kaart (place-map.tsx), los van MapLibre zodat ze te testen zijn.
//
// De kaart krijgt per plek alleen wat de stip nodig heeft: slug, plek (in de geometrie), stipkleur en prijslabel.
// Naam, plaats, foto en vertrekregel voor de pop-up zoekt place-map.tsx op bij een tik (popupProps). Zo blijft de
// GeoJSON die bij elke filterwijziging naar de kaart-worker gaat klein, ook met duizenden plekken.

import type { ExpressionSpecification } from "maplibre-gl";
import { departureShort, markerPrice } from "./format";
import { isIncomplete } from "./place-status";
import { departureKind } from "./search";
import type { PlaceSummary } from "./types";

export type MapPlace = Pick<PlaceSummary, "slug" | "name" | "lat" | "lng" | "town" | "priceEur" | "priceFrom" | "imageUrl"> &
  Partial<Pick<PlaceSummary, "priceExtras" | "departure" | "checkoutUntil" | "departureCheck">>;

/** Eigenschappen van één stip: alleen wat de lagen van de kaart lezen */
export type PinProps = {
  slug: string;
  /** Kleur van de stip = vertrekregel; `plain` waar er geen vertrekgegevens zijn (beheer) */
  group: "vrij" | "uitslapers" | "overig" | "plain";
  /** Geen vertrekregel: holle grijze ring, onder de gekleurde plekken */
  incomplete: boolean;
  /** Prijslabel vanaf zoom 10; leeg = geen label */
  price: string;
};

export type PopupProps = { slug: string; name: string; town: string; price: string; departure: string; image: string };

export function pinGroup(p: MapPlace, departures: boolean): PinProps["group"] {
  if (!departures) return "plain";
  const kind = departureKind(p);
  return kind === "vrij" ? "vrij" : kind === "uitslapers" ? "uitslapers" : "overig";
}

/** `departures`: de plekken hebben vertrekgegevens (in beheer niet; dan is niets "onvolledig") */
export function toGeoJSON(places: MapPlace[], departures: boolean): GeoJSON.FeatureCollection<GeoJSON.Point, PinProps> {
  return {
    type: "FeatureCollection",
    features: places.map((p) => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: [p.lng, p.lat] },
      properties: { slug: p.slug, group: pinGroup(p, departures), incomplete: departures && isIncomplete(p), price: markerPrice(p) },
    })),
  };
}

/** Inhoud van de pop-up, pas berekend bij een tik */
export function popupProps(p: MapPlace): PopupProps {
  return { slug: p.slug, name: p.name, town: p.town, price: markerPrice(p), departure: departureShort(p) ?? "", image: p.imageUrl ?? "" };
}

// ── Clusters ─────────────────────────────────────────────────────────────────

/** Grenzen van de clustergroottes: < 10, 10–49, ≥ 50 plekken */
export const CLUSTER_STEPS = [10, 50] as const;
/** Straal per grootte in px; de grootste is groter dan het tikvlak van 22 px */
export const CLUSTER_RADIUS = [16, 21, 27] as const;

/**
 * Vulkleur per grootte, alle drie bosgroen (stijlgids: avondzon is voor de geselecteerde plek, kleur is betekenis).
 * Licht: van licht naar donker. Witte cijfers halen op elk ≥ 4,5:1 (5,1 / 7,9 / 12,4).
 * Donker: de lichtste tint zou op de donkere kaart wegvallen, dus daar loopt het van #3f7a5a naar #2d5a43 en draagt
 * een lichtgroene rand (de token --forest in donker) het verschil.
 */
export function clusterColors(dark: boolean): [string, string, string] {
  return dark ? ["#3f7a5a", "#336b4e", "#2d5a43"] : ["#3f7a5a", "#2d5a43", "#1c3a2b"];
}

/** ["step", point_count, a, 10, b, 50, c] */
export function byClusterSize<T extends string | number>(values: readonly [T, T, T]): ExpressionSpecification {
  return ["step", ["get", "point_count"], values[0], CLUSTER_STEPS[0], values[1], CLUSTER_STEPS[1], values[2]] as ExpressionSpecification;
}

/** Index van de grootte (0, 1 of 2) voor een aantal plekken: zelfde grenzen als byClusterSize */
export function clusterTier(count: number): 0 | 1 | 2 {
  return count >= CLUSTER_STEPS[1] ? 2 : count >= CLUSTER_STEPS[0] ? 1 : 0;
}
