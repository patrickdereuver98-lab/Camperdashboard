"use client";

import { useEffect, useRef, useState } from "react";
import type { GeoJSONSource, Map as MlMap, Popup } from "maplibre-gl";
import type { Place } from "@/lib/types";
import type { LatLng } from "@/lib/geo";

const NL_BOUNDS: [[number, number], [number, number]] = [
  [3.3, 50.75],
  [7.25, 53.55],
];

const STYLE_LIGHT = "https://tiles.openfreemap.org/styles/positron";
const STYLE_DARK = "https://tiles.openfreemap.org/styles/dark";

function cssVar(name: string) {
  return getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim();
}

function toGeoJSON(places: Place[]) {
  return {
    type: "FeatureCollection" as const,
    features: places.map((p) => ({
      type: "Feature" as const,
      geometry: { type: "Point" as const, coordinates: [p.lng, p.lat] },
      properties: {
        slug: p.slug,
        name: p.name,
        town: p.town,
        free: p.price === "gratis",
      },
    })),
  };
}

/** Kleur de basiskaart bij in de VrijStaan-tinten (zand, mos, meer). */
function tintBaseMap(map: MlMap, dark: boolean) {
  const paper = dark ? "#141b16" : "#efe9dc";
  const water = dark ? "#1c3640" : "#c5dcdc";
  const green = dark ? "#1a2a20" : "#dde6d2";
  for (const layer of map.getStyle().layers ?? []) {
    try {
      if (layer.type === "background")
        map.setPaintProperty(layer.id, "background-color", paper);
      else if (layer.type === "fill" && /water/.test(layer.id))
        map.setPaintProperty(layer.id, "fill-color", water);
      else if (
        layer.type === "fill" &&
        /wood|forest|park|grass|landcover/.test(layer.id)
      )
        map.setPaintProperty(layer.id, "fill-color", green);
    } catch {
      /* laag ondersteunt deze eigenschap niet */
    }
  }
}

export function PlaceMap({
  places,
  highlight,
  onSelect,
  fitKey,
  route,
  user,
  className = "",
  interactive = true,
}: {
  places: Place[];
  highlight?: string | null;
  onSelect?: (slug: string) => void;
  /** Verandert deze waarde, dan zoomt de kaart naar de huidige plekken. */
  fitKey?: string;
  /** Teken een lijn langs de plekken in volgorde. */
  route?: boolean;
  user?: LatLng | null;
  className?: string;
  interactive?: boolean;
}) {
  const el = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MlMap | null>(null);
  const popupRef = useRef<Popup | null>(null);
  const userMarker = useRef<{ remove(): void } | null>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const latest = useRef({ places, onSelect });
  useEffect(() => {
    latest.current = { places, onSelect };
  });

  // Kaart opbouwen (en weer opruimen: routes blijven onder <Activity> gemount)
  useEffect(() => {
    let cancelled = false;
    let map: MlMap | null = null;

    (async () => {
      const maplibregl = (await import("maplibre-gl")).default;
      if (cancelled || !el.current) return;
      const dark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      const forest = cssVar("--forest") || "#2d5a43";
      const ember = cssVar("--ember") || "#b9592a";
      const surface = cssVar("--surface") || "#fffcf6";
      const onForest = cssVar("--on-forest") || "#fffcf6";

      map = new maplibregl.Map({
        container: el.current,
        style: dark ? STYLE_DARK : STYLE_LIGHT,
        bounds: NL_BOUNDS,
        fitBoundsOptions: { padding: 24 },
        attributionControl: { compact: true },
        interactive,
        cooperativeGestures: false,
      });
      mapRef.current = map;
      if (interactive)
        map.addControl(
          new maplibregl.NavigationControl({ showCompass: false }),
          "top-right",
        );
      map.on("error", (e) => {
        if (
          !map?.isStyleLoaded() &&
          String(e.error?.message ?? "").match(/style|fetch/i)
        )
          setFailed(true);
      });

      map.on("load", () => {
        if (!map) return;
        tintBaseMap(map, dark);
        map.addSource("places", {
          type: "geojson",
          data: toGeoJSON(latest.current.places),
          cluster: !route,
          clusterRadius: 44,
          clusterMaxZoom: 11,
        });
        map.addSource("route", {
          type: "geojson",
          data: { type: "FeatureCollection", features: [] },
        });
        map.addLayer({
          id: "route",
          type: "line",
          source: "route",
          paint: {
            "line-color": ember,
            "line-width": 3,
            "line-dasharray": [2, 1.5],
          },
          layout: { "line-cap": "round", "line-join": "round" },
        });
        map.addLayer({
          id: "clusters",
          type: "circle",
          source: "places",
          filter: ["has", "point_count"],
          paint: {
            "circle-color": forest,
            "circle-opacity": 0.92,
            "circle-radius": [
              "step",
              ["get", "point_count"],
              15,
              20,
              19,
              100,
              25,
              300,
              31,
            ],
            "circle-stroke-width": 3,
            "circle-stroke-color": surface,
          },
        });
        map.addLayer({
          id: "cluster-count",
          type: "symbol",
          source: "places",
          filter: ["has", "point_count"],
          layout: {
            "text-field": ["get", "point_count_abbreviated"],
            "text-size": 12,
            "text-font": ["Noto Sans Bold"],
          },
          paint: { "text-color": onForest },
        });
        map.addLayer({
          id: "points",
          type: "circle",
          source: "places",
          filter: ["!", ["has", "point_count"]],
          paint: {
            "circle-color": ["case", ["get", "free"], ember, forest],
            "circle-radius": ["interpolate", ["linear"], ["zoom"], 7, 5, 13, 8],
            "circle-stroke-width": 2,
            "circle-stroke-color": surface,
          },
        });
        map.addLayer({
          id: "points-active",
          type: "circle",
          source: "places",
          filter: ["==", ["get", "slug"], ""],
          paint: {
            "circle-color": ember,
            "circle-radius": 11,
            "circle-stroke-width": 3,
            "circle-stroke-color": surface,
          },
        });

        map.on("click", "clusters", async (e) => {
          const f = e.features?.[0];
          if (!f || !map) return;
          const src = map.getSource("places") as GeoJSONSource;
          const zoom = await src.getClusterExpansionZoom(
            f.properties.cluster_id,
          );
          map.easeTo({
            center: (f.geometry as GeoJSON.Point).coordinates as [
              number,
              number,
            ],
            zoom,
          });
        });
        map.on("click", "points", (e) => {
          const f = e.features?.[0];
          if (!f || !map) return;
          const { slug, name, town } = f.properties as {
            slug: string;
            name: string;
            town: string;
          };
          latest.current.onSelect?.(slug);
          const box = document.createElement("div");
          const a = document.createElement("a");
          a.href = `/plek/${slug}`;
          a.textContent = name;
          a.style.cssText =
            "font-weight:600;font-size:15px;color:var(--ink);text-decoration:none;display:block;padding-right:14px";
          const sub = document.createElement("div");
          sub.textContent = town;
          sub.style.cssText =
            "font-size:13px;color:var(--muted);margin-top:2px";
          const more = document.createElement("a");
          more.href = `/plek/${slug}`;
          more.textContent = "Bekijk plek →";
          more.style.cssText =
            "display:inline-block;margin-top:8px;font-size:13px;font-weight:600;color:var(--forest)";
          box.append(a, sub, more);
          popupRef.current?.remove();
          popupRef.current = new maplibregl.Popup({
            offset: 12,
            maxWidth: "240px",
          })
            .setLngLat(
              (f.geometry as GeoJSON.Point).coordinates as [number, number],
            )
            .setDOMContent(box)
            .addTo(map);
        });
        for (const id of ["clusters", "points"]) {
          map.on(
            "mouseenter",
            id,
            () => map && (map.getCanvas().style.cursor = "pointer"),
          );
          map.on(
            "mouseleave",
            id,
            () => map && (map.getCanvas().style.cursor = ""),
          );
        }
        setReady(true);
      });
    })().catch(() => setFailed(true));

    return () => {
      cancelled = true;
      popupRef.current?.remove();
      userMarker.current?.remove();
      userMarker.current = null;
      map?.remove();
      mapRef.current = null;
      setReady(false);
    };
    // De kaart wordt één keer opgebouwd; updates lopen via de effecten hieronder.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Data bijwerken
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    (map.getSource("places") as GeoJSONSource | undefined)?.setData(
      toGeoJSON(places),
    );
    if (route) {
      (map.getSource("route") as GeoJSONSource | undefined)?.setData({
        type: "Feature",
        properties: {},
        geometry: {
          type: "LineString",
          coordinates: places.map((p) => [p.lng, p.lat]),
        },
      });
    }
  }, [places, ready, route]);

  // Inzoomen op de resultaten
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    const pts = [
      ...places.map((p) => [p.lng, p.lat] as [number, number]),
      ...(user ? [[user.lng, user.lat] as [number, number]] : []),
    ];
    if (!pts.length) return;
    if (pts.length === 1) {
      map.easeTo({ center: pts[0], zoom: 11, duration: 600 });
      return;
    }
    const lngs = pts.map((p) => p[0]);
    const lats = pts.map((p) => p[1]);
    map.fitBounds(
      [
        [Math.min(...lngs), Math.min(...lats)],
        [Math.max(...lngs), Math.max(...lats)],
      ],
      { padding: 48, maxZoom: 12, duration: 600 },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitKey, ready]);

  // Markering bij hover in de lijst
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    map.setFilter("points-active", ["==", ["get", "slug"], highlight ?? ""]);
  }, [highlight, ready]);

  // Eigen locatie
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    userMarker.current?.remove();
    userMarker.current = null;
    if (!user) return;
    let alive = true;
    import("maplibre-gl").then(({ default: maplibregl }) => {
      if (!alive || !mapRef.current) return;
      const dot = document.createElement("div");
      dot.style.cssText =
        "width:18px;height:18px;border-radius:50%;background:#3b82c4;border:3px solid white;box-shadow:0 0 0 6px rgb(59 130 196 / .25)";
      dot.setAttribute("aria-label", "Jouw locatie");
      userMarker.current = new maplibregl.Marker({ element: dot })
        .setLngLat([user.lng, user.lat])
        .addTo(mapRef.current);
    });
    return () => {
      alive = false;
    };
  }, [user, ready]);

  return (
    <div className={`relative overflow-hidden bg-surface-2 ${className}`}>
      {/* Inline: maplibre-gl.css (zonder layer) zet position: relative en wint van utilities */}
      <div ref={el} style={{ position: "absolute", inset: 0 }} />
      {!ready && !failed && (
        <div className="absolute inset-0 grid place-items-center text-sm text-muted">
          Kaart laden…
        </div>
      )}
      {failed && (
        <div className="absolute inset-0 grid place-items-center p-6 text-center text-sm text-muted">
          De kaart kon niet worden geladen. Controleer je verbinding.
        </div>
      )}
    </div>
  );
}
