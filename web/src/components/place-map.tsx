"use client";

import { useEffect, useRef, useState } from "react";
import type { GeoJSONSource, Map as MlMap, Popup } from "maplibre-gl";
import type { Bbox } from "@/lib/bbox";
import type { LatLng } from "@/lib/geo";
import { departureShort, markerPrice } from "@/lib/format";
import type { PlaceSummary } from "@/lib/types";

const NL_BOUNDS: [[number, number], [number, number]] = [
  [3.3, 50.75],
  [7.25, 53.55],
];
const STYLE_LIGHT = "https://tiles.openfreemap.org/styles/positron";
const STYLE_DARK = "https://tiles.openfreemap.org/styles/dark";

type MapPlace = Pick<PlaceSummary, "slug" | "name" | "lat" | "lng" | "town" | "priceEur" | "priceFrom" | "imageUrl"> &
  Partial<Pick<PlaceSummary, "priceExtras" | "departure" | "checkoutUntil" | "departureCheck">>;

function toGeoJSON(places: MapPlace[]) {
  return {
    type: "FeatureCollection" as const,
    features: places.map((p) => ({
      type: "Feature" as const,
      geometry: { type: "Point" as const, coordinates: [p.lng, p.lat] },
      properties: {
        slug: p.slug,
        name: p.name,
        town: p.town,
        free: p.priceEur === 0,
        price: markerPrice(p),
        // Vertrekregel zoals op de kaart in de lijst; leeg = onbekend
        departure: departureShort(p) ?? "",
        image: p.imageUrl ?? "",
      },
    })),
  };
}

/** Basiskaart in de tinten van de site: koel wit, zacht groen, meerblauw */
function tint(map: MlMap, dark: boolean) {
  const colors = dark
    ? { bg: "#141b16", water: "#17303a", green: "#1a2a20" }
    : { bg: "#f1ebdf", water: "#cfe3e4", green: "#dde7d6" };
  for (const layer of map.getStyle().layers ?? []) {
    try {
      if (layer.type === "background") map.setPaintProperty(layer.id, "background-color", colors.bg);
      else if (layer.type === "fill" && /water/.test(layer.id)) map.setPaintProperty(layer.id, "fill-color", colors.water);
      else if (layer.type === "fill" && /wood|forest|park|grass|landcover/.test(layer.id))
        map.setPaintProperty(layer.id, "fill-color", colors.green);
    } catch {
      /* niet elke laag ondersteunt deze eigenschap */
    }
  }
}

type PopupProps = { slug: string; name: string; town: string; price: string; departure: string; image: string };

function popupNode(p: PopupProps) {
  const a = document.createElement("a");
  a.href = `/plek/${p.slug}`;
  a.style.cssText = "display:block;width:240px;color:var(--ink);text-decoration:none";
  if (p.image) {
    const img = document.createElement("img");
    img.src = p.image;
    img.alt = "";
    img.referrerPolicy = "no-referrer";
    img.style.cssText = "width:100%;height:120px;object-fit:cover;display:block;background:var(--sunken)";
    img.onerror = () => img.remove();
    a.append(img);
  }
  const body = document.createElement("div");
  body.style.cssText = "padding:10px 12px 12px";
  const name = document.createElement("div");
  name.textContent = p.name;
  name.style.cssText = "font-family:var(--font-display);font-weight:700;font-size:16px;line-height:1.25;padding-right:24px";
  const meta = document.createElement("div");
  meta.textContent = p.price ? `${p.town}, ${p.price}` : p.town;
  meta.style.cssText = "margin-top:4px;font-size:14px;color:var(--muted)";
  // Vertrekken is het kernfeit: altijd een regel, ook als we het niet weten
  const dep = document.createElement("div");
  dep.textContent = p.departure || "Vertrektijd onbekend";
  dep.style.cssText = `margin-top:4px;font-size:14px;font-weight:600;color:${p.departure ? "var(--ink)" : "var(--muted)"}`;
  const cta = document.createElement("div");
  cta.textContent = "Bekijk plek";
  cta.style.cssText = "margin-top:8px;font-weight:700;color:var(--forest);font-size:14px;text-decoration:underline";
  body.append(name, meta, dep, cta);
  a.append(body);
  return a;
}

export function PlaceMap({
  places,
  fitPlaces,
  highlight,
  onSelect,
  onViewportChange,
  fitKey,
  route,
  user,
  cluster = true,
  onShowList,
  className = "",
}: {
  places: MapPlace[];
  /** Plekken om naartoe te zoomen bij een nieuwe fitKey (standaard `places`) */
  fitPlaces?: Pick<MapPlace, "lat" | "lng">[];
  highlight?: string | null;
  onSelect?: (slug: string) => void;
  /** Zichtbaar gebied na elke verplaatsing of zoom (voor laden per bounding box) */
  onViewportChange?: (bbox: Bbox) => void;
  /** Verandert deze waarde, dan zoomt de kaart naar de huidige plekken. */
  fitKey?: string;
  /** Lijn over de weg (lng/lat), bijvoorbeeld van de routeplanner */
  route?: [number, number][] | null;
  user?: LatLng | null;
  cluster?: boolean;
  /** Knop "Toon lijst" bij een kaartfout (alleen waar een lijst naast de kaart bestaat) */
  onShowList?: () => void;
  className?: string;
}) {
  const el = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MlMap | null>(null);
  const popupRef = useRef<Popup | null>(null);
  const userMarker = useRef<{ remove(): void } | null>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const latest = useRef({ places, onSelect, onViewportChange, cluster });
  useEffect(() => {
    latest.current = { places, onSelect, onViewportChange, cluster };
  });

  // Kaart opbouwen en opruimen (routes blijven onder <Activity> gemount)
  useEffect(() => {
    let cancelled = false;
    let map: MlMap | null = null;
    (async () => {
      const maplibregl = await import("maplibre-gl");
      if (cancelled || !el.current) return;
      // Worker staat in public/ (scripts/copy-maplibre-worker.mjs); de versie in de URL voorkomt een oude cache
      maplibregl.setWorkerUrl(`/maplibre-gl-worker.mjs?v=${maplibregl.getVersion()}`);
      const dark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      const css = getComputedStyle(document.documentElement);
      // Bosgroen voor plekken, avondzon voor gratis plekken en de geselecteerde plek, meerblauw voor de route
      // In donker bewust donkerder dan de tokens --ember en --forest: witte tekst in clusters blijft dan leesbaar
      const ember = dark ? "#d9783f" : "#b9592a";
      const forest = dark ? "#3f7a5a" : "#2d5a43";
      const lake = dark ? "#82bcc8" : "#2f6f7e";
      const surface = css.getPropertyValue("--surface").trim() || "#fffcf6";
      const ink = css.getPropertyValue("--ink").trim() || "#1f2b24";

      map = new maplibregl.Map({
        container: el.current,
        style: dark ? STYLE_DARK : STYLE_LIGHT,
        bounds: NL_BOUNDS,
        fitBoundsOptions: { padding: 24 },
        attributionControl: { compact: true },
      });
      mapRef.current = map;
      map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
      map.on("error", (e) => {
        if (!map?.isStyleLoaded() && /style|fetch|Failed/i.test(String(e.error?.message ?? ""))) setFailed(true);
      });

      map.on("load", () => {
        if (!map) return;
        tint(map, dark);
        map.addSource("places", {
          type: "geojson",
          data: toGeoJSON(latest.current.places),
          cluster: latest.current.cluster,
          clusterRadius: 46,
          clusterMaxZoom: 10,
        });
        map.addSource("route", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
        map.addLayer({
          id: "route-casing",
          type: "line",
          source: "route",
          paint: { "line-color": surface, "line-width": 8 },
          layout: { "line-cap": "round", "line-join": "round" },
        });
        map.addLayer({
          id: "route",
          type: "line",
          source: "route",
          paint: { "line-color": lake, "line-width": 4.5 },
          layout: { "line-cap": "round", "line-join": "round" },
        });
        map.addLayer({
          id: "clusters",
          type: "circle",
          source: "places",
          filter: ["has", "point_count"],
          paint: {
            "circle-color": forest,
            "circle-radius": ["step", ["get", "point_count"], 16, 20, 20, 100, 26],
            "circle-stroke-width": 3,
            "circle-stroke-color": surface,
          },
        });
        map.addLayer({
          id: "cluster-count",
          type: "symbol",
          source: "places",
          filter: ["has", "point_count"],
          layout: { "text-field": ["get", "point_count_abbreviated"], "text-size": 13, "text-font": ["Noto Sans Bold"] },
          paint: { "text-color": "#ffffff" },
        });
        map.addLayer({
          id: "points",
          type: "circle",
          source: "places",
          filter: ["!", ["has", "point_count"]],
          paint: {
            "circle-color": ["case", ["get", "free"], ember, forest],
            "circle-radius": ["interpolate", ["linear"], ["zoom"], 7, 6, 13, 9],
            "circle-stroke-width": 2.5,
            "circle-stroke-color": surface,
          },
        });
        map.addLayer({
          id: "point-price",
          type: "symbol",
          source: "places",
          minzoom: 10,
          filter: ["all", ["!", ["has", "point_count"]], ["!=", ["get", "price"], ""]],
          layout: {
            "text-field": ["get", "price"],
            "text-size": 12,
            "text-font": ["Noto Sans Bold"],
            "text-offset": [0, 1.5],
            "text-anchor": "top",
          },
          paint: { "text-color": ink, "text-halo-color": surface, "text-halo-width": 2 },
        });
        map.addLayer({
          id: "points-active",
          type: "circle",
          source: "places",
          filter: ["==", ["get", "slug"], ""],
          paint: { "circle-color": ember, "circle-radius": 13, "circle-stroke-width": 4, "circle-stroke-color": surface },
        });

        map.on("click", "clusters", async (e) => {
          const f = e.features?.[0];
          if (!f || !map) return;
          const zoom = await (map.getSource("places") as GeoJSONSource).getClusterExpansionZoom(f.properties.cluster_id);
          map.easeTo({ center: (f.geometry as GeoJSON.Point).coordinates as [number, number], zoom });
        });
        map.on("click", "points", (e) => {
          const f = e.features?.[0];
          if (!f || !map) return;
          const props = f.properties as PopupProps;
          latest.current.onSelect?.(props.slug);
          popupRef.current?.remove();
          popupRef.current = new maplibregl.Popup({ offset: 14, maxWidth: "260px" })
            .setLngLat((f.geometry as GeoJSON.Point).coordinates as [number, number])
            .setDOMContent(popupNode(props))
            .addTo(map);
        });
        const reportViewport = () => {
          if (!map) return;
          const b = map.getBounds();
          latest.current.onViewportChange?.([b.getWest(), b.getSouth(), b.getEast(), b.getNorth()]);
        };
        map.on("moveend", reportViewport);
        reportViewport();
        for (const id of ["clusters", "points"]) {
          map.on("mouseenter", id, () => map && (map.getCanvas().style.cursor = "pointer"));
          map.on("mouseleave", id, () => map && (map.getCanvas().style.cursor = ""));
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
    // De kaart wordt één keer opgebouwd (opnieuw na "Opnieuw proberen"); updates lopen via de effecten hieronder.
  }, [attempt]);

  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    (map.getSource("places") as GeoJSONSource | undefined)?.setData(toGeoJSON(places));
  }, [places, ready]);

  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    (map.getSource("route") as GeoJSONSource | undefined)?.setData(
      route && route.length > 1
        ? { type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: route } }
        : { type: "FeatureCollection", features: [] },
    );
  }, [route, ready]);

  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    const pts: [number, number][] = [
      ...(fitPlaces ?? places).map((p) => [p.lng, p.lat] as [number, number]),
      ...(user ? [[user.lng, user.lat] as [number, number]] : []),
    ];
    if (!pts.length) return;
    if (pts.length === 1) {
      map.easeTo({ center: pts[0], zoom: 12, duration: 500 });
      return;
    }
    const lngs = pts.map((p) => p[0]);
    const lats = pts.map((p) => p[1]);
    map.fitBounds(
      [
        [Math.min(...lngs), Math.min(...lats)],
        [Math.max(...lngs), Math.max(...lats)],
      ],
      { padding: 56, maxZoom: 12.5, duration: 500 },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitKey, ready]);

  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    map.setFilter("points-active", ["==", ["get", "slug"], highlight ?? ""]);
  }, [highlight, ready]);

  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    userMarker.current?.remove();
    userMarker.current = null;
    if (!user) return;
    let alive = true;
    import("maplibre-gl").then((maplibregl) => {
      if (!alive || !mapRef.current) return;
      const dot = document.createElement("div");
      dot.style.cssText =
        "width:20px;height:20px;border-radius:50%;background:#2f6f7e;border:3px solid #fff;box-shadow:0 0 0 8px rgb(47 111 126 / .25)";
      dot.setAttribute("aria-label", "Jouw locatie");
      userMarker.current = new maplibregl.Marker({ element: dot }).setLngLat([user.lng, user.lat]).addTo(mapRef.current);
    });
    return () => {
      alive = false;
    };
  }, [user, ready]);

  return (
    <div className={`relative overflow-hidden bg-sunken ${className}`}>
      {/* Inline: maplibre-gl.css (zonder cascade layer) zet position: relative en wint van utilities */}
      <div ref={el} style={{ position: "absolute", inset: 0 }} />
      {!ready && !failed && <div className="absolute inset-0 grid place-items-center text-muted">Kaart laden…</div>}
      {failed && (
        <div role="alert" className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center text-ink-2">
          <p>De kaart kon niet worden geladen. Controleer je verbinding.</p>
          <div className="flex flex-wrap justify-center gap-2">
            <button
              type="button"
              onClick={() => {
                setFailed(false);
                setAttempt((a) => a + 1);
              }}
              className="min-h-11 rounded-lg bg-forest px-4 font-semibold text-on-forest hover:bg-forest-deep"
            >
              Opnieuw proberen
            </button>
            {onShowList && (
              <button type="button" onClick={onShowList} className="min-h-11 rounded-lg border border-line bg-surface px-4 font-semibold text-ink">
                Toon lijst
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
