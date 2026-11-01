"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
// Alleen op pagina's met een kaart (niet meer in de root-layout); eerst maplibre, dan onze aanpassingen
import "maplibre-gl/dist/maplibre-gl.css";
import "./place-map.css";
import type { GeoJSONSource, Map as MlMap, Popup } from "maplibre-gl";
import type { LatLng } from "@/lib/geo";
import { byClusterSize, CLUSTER_RADIUS, clusterColors, popupProps, toGeoJSON, type MapPlace, type PinProps, type PopupProps } from "@/lib/map-data";
import { SaveButton } from "./place-ui";

const NL_BOUNDS: [[number, number], [number, number]] = [
  [3.3, 50.75],
  [7.25, 53.55],
];
const STYLE_LIGHT = "https://tiles.openfreemap.org/styles/positron";
const STYLE_DARK = "https://tiles.openfreemap.org/styles/dark";
/** Straal van het onzichtbare tikvlak rond een punt: 22 px = een tikdoel van 44 × 44 px */
const HIT_RADIUS = 22;

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

/**
 * Popup van een plek, als React-inhoud in het DOM-vak van MapLibre (portal). Zo werkt het hartje (SaveButton) zoals
 * overal: bewaren in Mijn reis en de stand blijft gelijk met de lijst. Vertrekken is het kernfeit: altijd een regel,
 * ook als we het niet weten, behalve in beheer (daar komen de plekken zonder vertrekgegevens).
 */
function PopupCard({ p, departures }: { p: PopupProps; departures: boolean }) {
  const [imageOk, setImageOk] = useState(Boolean(p.image));
  return (
    <div className="relative w-60 text-ink">
      {imageOk && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={p.image} alt="" referrerPolicy="no-referrer" onError={() => setImageOk(false)} className="block h-30 w-full bg-sunken object-cover" />
      )}
      <div className="px-3 pt-2.5 pb-1">
        <p className="pr-8 font-display text-base leading-snug font-semibold">{p.name}</p>
        <p className="mt-1 text-sm text-muted">{p.price ? `${p.town}, ${p.price}` : p.town}</p>
        {departures && <p className={`mt-1 text-sm font-semibold ${p.departure ? "text-ink" : "text-muted"}`}>{p.departure || "Vertrektijd onbekend"}</p>}
        <div className="mt-1 flex items-center justify-between gap-2">
          <a href={`/plek/${p.slug}`} className="-my-1 inline-flex h-11 items-center text-sm font-semibold text-forest underline underline-offset-2">
            Bekijk plek
          </a>
          {departures && <SaveButton slug={p.slug} variant="plain" />}
        </div>
      </div>
    </div>
  );
}

export function PlaceMap({
  places,
  highlight,
  onSelect,
  fitKey,
  route,
  user,
  cluster = true,
  departures = true,
  onShowList,
  popup = true,
  className = "",
}: {
  places: MapPlace[];
  highlight?: string | null;
  onSelect?: (slug: string) => void;
  /** Verandert deze waarde, dan zoomt de kaart naar de huidige plekken. */
  fitKey?: string;
  /** Lijn over de weg (lng/lat), bijvoorbeeld van de routeplanner */
  route?: [number, number][] | null;
  user?: LatLng | null;
  cluster?: boolean;
  /** Vertrekregel in de popup; uit waar de plekken geen vertrekgegevens meekrijgen (beheer) */
  departures?: boolean;
  /** Knop "Toon lijst" bij een kaartfout (alleen waar een lijst naast de kaart bestaat) */
  onShowList?: () => void;
  /** Uit als de pagina zelf een paneel met de gekozen plek toont (MapPick op de telefoon) */
  popup?: boolean;
  className?: string;
}) {
  const el = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MlMap | null>(null);
  const popupRef = useRef<Popup | null>(null);
  // Inhoud van de open popup: React rendert die via een portal in het vak van MapLibre
  const [openPopup, setOpenPopup] = useState<{ node: HTMLElement; props: PopupProps } | null>(null);
  const userMarker = useRef<{ remove(): void } | null>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const latest = useRef({ places, onSelect, cluster, departures, popup });
  useEffect(() => {
    latest.current = { places, onSelect, cluster, departures, popup };
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
      // Bosgroen zonder vaste vertrektijd, meerblauw voor uitslapers en de route, avondzon voor de geselecteerde plek
      // In donker bewust donkerder dan de tokens --ember en --forest: witte tekst in clusters blijft dan leesbaar
      const ember = dark ? "#d9783f" : "#b9592a";
      const forest = dark ? "#3f7a5a" : "#2d5a43";
      const lake = dark ? "#82bcc8" : "#2f6f7e";
      const surface = css.getPropertyValue("--surface").trim() || "#fffcf6";
      // Grijs voor onvolledige plekken: de token --muted (contrast met de kaartgrond minstens 5:1)
      const muted = css.getPropertyValue("--muted").trim() || (dark ? "#9aa39b" : "#5c665e");
      const ink = css.getPropertyValue("--ink").trim() || "#1f2b24";
      // Vaste vertrektijd vóór 12:00: neutraal donker, duidelijk anders dan de holle grijze stip van "onbekend"
      const ink2 = css.getPropertyValue("--ink-2").trim() || (dark ? "#c7c2b6" : "#46524a");
      const lakePoint = dark ? "#4f95a4" : lake;
      // Clusters: groter en donkerder groen naarmate er meer plekken in zitten (map-data.ts). In donker draagt een
      // lichtgroene rand het verschil bij de grotere groepen.
      const clusterFill = clusterColors(dark);
      const ringLight = css.getPropertyValue("--forest").trim() || "#8dbf9f";
      const clusterRing = dark ? byClusterSize([surface, ringLight, ringLight]) : surface;

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
          data: toGeoJSON(latest.current.places, latest.current.departures),
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
            "circle-color": byClusterSize(clusterFill),
            "circle-radius": byClusterSize(CLUSTER_RADIUS),
            "circle-stroke-width": 3,
            "circle-stroke-color": clusterRing,
          },
        });
        map.addLayer({
          id: "cluster-count",
          type: "symbol",
          source: "places",
          filter: ["has", "point_count"],
          layout: {
            "text-field": ["get", "point_count_abbreviated"],
            "text-size": byClusterSize([14, 15, 16]),
            "text-font": ["Noto Sans Bold"],
            "text-allow-overlap": true,
          },
          paint: { "text-color": "#ffffff" },
        });
        map.addLayer({
          id: "points",
          type: "circle",
          source: "places",
          filter: ["!", ["has", "point_count"]],
          layout: { "circle-sort-key": ["case", ["get", "incomplete"], 0, 1] },
          paint: {
            // Onvolledig: holle grijze ring (vorm én kleur, niet alleen kleur)
            "circle-color": [
              "case",
              ["get", "incomplete"],
              surface,
              ["match", ["get", "group"], "vrij", forest, "uitslapers", lakePoint, "overig", ink2, forest],
            ],
            "circle-radius": ["interpolate", ["linear"], ["zoom"], 7, 6, 13, 9],
            "circle-stroke-width": ["case", ["get", "incomplete"], 3, 2.5],
            "circle-stroke-color": ["case", ["get", "incomplete"], muted, surface],
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
            "text-size": 14,
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
        // Onzichtbaar tikvlak van 44 × 44 px rond elk punt en elke groep (WCAG, docs/stijlgids.md §5). De zichtbare
        // punten blijven klein, zodat de kaart niet volloopt; een tik net naast een punt telt toch.
        const hit = { "circle-color": "#000000", "circle-opacity": 0 };
        map.addLayer({
          id: "clusters-hit",
          type: "circle",
          source: "places",
          filter: ["has", "point_count"],
          // De grootste groepen (27 px) zijn al groter dan het tikvlak
          paint: { ...hit, "circle-radius": byClusterSize([HIT_RADIUS, HIT_RADIUS, CLUSTER_RADIUS[2]]) },
        });
        map.addLayer({
          id: "points-hit",
          type: "circle",
          source: "places",
          filter: ["!", ["has", "point_count"]],
          paint: { ...hit, "circle-radius": HIT_RADIUS },
        });
        map.on("click", "clusters-hit", async (e) => {
          const f = e.features?.[0];
          if (!f || !map) return;
          const zoom = await (map.getSource("places") as GeoJSONSource).getClusterExpansionZoom(f.properties.cluster_id);
          map.easeTo({ center: (f.geometry as GeoJSON.Point).coordinates as [number, number], zoom });
        });
        map.on("click", "points-hit", (e) => {
          const f = e.features?.[0];
          if (!f || !map) return;
          const { slug } = f.properties as PinProps;
          latest.current.onSelect?.(slug);
          popupRef.current?.remove();
          // De stip draagt alleen de slug; de rest van de pop-up komt uit de plekken zelf
          const place = latest.current.places.find((p) => p.slug === slug);
          if (!latest.current.popup || !place) return;
          const props = popupProps(place);
          const node = document.createElement("div");
          const next = new maplibregl.Popup({ offset: 14, maxWidth: "260px" })
            .setLngLat((f.geometry as GeoJSON.Point).coordinates as [number, number])
            .setDOMContent(node)
            .addTo(map);
          next.on("close", () => setOpenPopup((cur) => (cur?.node === node ? null : cur)));
          popupRef.current = next;
          setOpenPopup({ node, props });
        });
        for (const id of ["clusters-hit", "points-hit"]) {
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
    (map.getSource("places") as GeoJSONSource | undefined)?.setData(toGeoJSON(places, departures));
  }, [places, departures, ready]);

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
      ...places.map((p) => [p.lng, p.lat] as [number, number]),
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
      dot.setAttribute("role", "img");
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
      {openPopup && createPortal(<PopupCard p={openPopup.props} departures={departures} />, openPopup.node)}
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
