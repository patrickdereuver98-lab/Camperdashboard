"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
// Alleen op pagina's met een kaart (niet meer in de root-layout); eerst maplibre, dan onze aanpassingen
import "maplibre-gl/dist/maplibre-gl.css";
import "./place-map.css";
import type { GeoJSONSource, Map as MlMap, Popup } from "maplibre-gl";
import { distanceKm, type LatLng } from "@/lib/geo";
import { Icon } from "./icons";
import { MAP_LOCALE_NL } from "@/lib/map-locale";
import { byClusterSize, CLUSTER_RADIUS, clusterColors, popupProps, toGeoJSON, type MapPlace, type PinProps, type PopupProps } from "@/lib/map-data";
import { currentTheme } from "@/lib/theme";
import { useDarkTheme } from "@/lib/use-media";
import { SaveButton } from "./place-ui";

export const NL_BOUNDS: [[number, number], [number, number]] = [
  [3.3, 50.75],
  [7.25, 53.55],
];
/**
 * Eigen kaartstijl ("natuur & vrijheid"), gemaakt door scripts/kaartstijl.mjs op de tegels van OpenFreeMap: eigen tint
 * voor bos, heide, zand, gras en water, warme wegen, namen in het Nederlands. Verhoog `v` als de stijl verandert.
 */
export const STYLE_LIGHT = "/kaart/licht.json?v=2";
export const STYLE_DARK = "/kaart/donker.json?v=2";
/** Straal van het onzichtbare tikvlak rond een punt: 22 px = een tikdoel van 44 × 44 px */
const HIT_RADIUS = 22;

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
          {departures && <SaveButton slug={p.slug} name={p.name} variant="plain" />}
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
  whenVisible = false,
  focus,
  locate = false,
  onSearchArea,
  pins,
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
  /** MapLibre (±295 KB gz) pas laden als de kaart bijna in beeld komt, bijvoorbeeld onderaan de plekpagina (R35) */
  whenVisible?: boolean;
  /** Deze plek in beeld schuiven (vorige/volgende in het kaartpaneel op de telefoon) */
  focus?: string | null;
  /** Knop "Mijn locatie" op de kaart (K2): je stip tonen en ernaartoe schuiven, niet continu volgen */
  locate?: boolean;
  /** Na zelf schuiven of zoomen de knop "Zoek in dit gebied" (K2): middelpunt en straal van wat je ziet */
  onSearchArea?: (center: LatLng, radiusKm: number) => void;
  /** Eigen punten (Mijn reis): een gestippelde ruit met nummer, geen popup en geen link; ze tellen mee bij inzoomen */
  pins?: (LatLng & { label: string; number?: number })[];
  className?: string;
}) {
  const el = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MlMap | null>(null);
  const popupRef = useRef<Popup | null>(null);
  // Inhoud van de open popup: React rendert die via een portal in het vak van MapLibre
  const [openPopup, setOpenPopup] = useState<{ node: HTMLElement; props: PopupProps } | null>(null);
  const userMarker = useRef<{ remove(): void } | null>(null);
  const pinMarkers = useRef<{ remove(): void }[]>([]);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [inView, setInView] = useState(!whenVisible);
  // Zelf verschoven of gezoomd (niet door fitBounds of easeTo van de site): dan "Zoek in dit gebied"
  const [moved, setMoved] = useState(false);
  const [located, setLocated] = useState<LatLng | null>(null);
  const [locating, setLocating] = useState<"idle" | "busy" | "denied">("idle");
  const shownUser = user ?? located;
  // Licht of donker wisselt live (systeem bij zonsondergang of de zon/maan-knop): dan wordt de kaart opnieuw opgebouwd
  const dark = useDarkTheme();
  // Kaartbeeld van de vorige opbouw, zodat een themawissel de kaart niet laat verspringen
  const camera = useRef<{ center: [number, number]; zoom: number } | null>(null);
  // fitKey waarop al is ingezoomd; een nieuwe opbouw (thema) zoomt dan niet opnieuw
  const fitted = useRef<{ key?: string } | null>(null);
  const latest = useRef({ places, onSelect, cluster, departures, popup });
  useEffect(() => {
    latest.current = { places, onSelect, cluster, departures, popup };
  });

  // Pas opbouwen als het vak binnen een halve schermhoogte van beeld is; zonder IntersectionObserver meteen
  useEffect(() => {
    if (inView || !el.current) return;
    if (typeof IntersectionObserver === "undefined") {
      void Promise.resolve().then(() => setInView(true));
      return;
    }
    const io = new IntersectionObserver((entries) => entries.some((e) => e.isIntersecting) && setInView(true), { rootMargin: "50% 0px" });
    io.observe(el.current);
    return () => io.disconnect();
  }, [inView]);

  // Kaart opbouwen en opruimen (routes blijven onder <Activity> gemount)
  useEffect(() => {
    if (!inView) return;
    // Tijdens hydratatie is dark nog de waarde van de server; de volgende weergave heeft de echte, bouw dan pas
    if (dark !== (currentTheme() === "dark")) return;
    let cancelled = false;
    let map: MlMap | null = null;
    let loaded = false;
    (async () => {
      const maplibregl = await import("maplibre-gl");
      if (cancelled || !el.current) return;
      // Worker staat in public/ (scripts/copy-maplibre-worker.mjs); de versie in de URL voorkomt een oude cache
      maplibregl.setWorkerUrl(`/maplibre-gl-worker.mjs?v=${maplibregl.getVersion()}`);
      const css = getComputedStyle(document.documentElement);
      // Bosgroen zonder vaste vertrektijd, meerblauw voor uitslapers en de route, avondzon voor de geselecteerde plek
      // In donker bewust donkerder dan de tokens --ember en --forest: witte tekst in clusters blijft dan leesbaar
      const ember = dark ? "#d9783f" : "#b9592a";
      const forest = dark ? "#3f7a5a" : "#1f4e37";
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
        ...(camera.current ?? { bounds: NL_BOUNDS, fitBoundsOptions: { padding: 24 } }),
        attributionControl: { compact: true },
        // Knoppen en meldingen in het Nederlands (R31)
        locale: MAP_LOCALE_NL,
      });
      mapRef.current = map;
      map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
      map.on("error", (e) => {
        if (!map?.isStyleLoaded() && /style|fetch|Failed/i.test(String(e.error?.message ?? ""))) setFailed(true);
      });

      map.on("load", () => {
        // Bronvermelding dicht bij het openen (een tik op (i) klapt hem open): open schoof hij op de telefoon over de kaart
        el.current?.querySelector(".maplibregl-ctrl-attrib")?.classList.remove("maplibregl-compact-show");
        if (!map) return;
        loaded = true;
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
        // Steden en dorpen boven de groepen (kaartronde 26 november): anders dekten de donkere cirkels Amsterdam en
        // Rotterdam af. Onder de getallen in de groep, zodat die bij een botsing voorgaan.
        for (const id of ["label_town", "label_city", "label_city_capital", "place_town", "place_city", "place_city_large"])
          if (map.getLayer(id) && map.getLayer("cluster-count")) map.moveLayer(id, "cluster-count");
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
        // originalEvent bestaat alleen bij een gebaar of muis; fitBounds en easeTo van de site tellen niet
        map.on("moveend", (e) => {
          if ((e as { originalEvent?: Event }).originalEvent) setMoved(true);
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
      if (map && loaded) {
        const c = map.getCenter();
        camera.current = { center: [c.lng, c.lat], zoom: map.getZoom() };
      }
      map?.remove();
      mapRef.current = null;
      setReady(false);
    };
    // De kaart wordt één keer opgebouwd (opnieuw na "Opnieuw proberen" en bij een ander thema); updates lopen via de
    // effecten hieronder.
  }, [attempt, dark, inView]);

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
      ...(pins ?? []).map((p) => [p.lng, p.lat] as [number, number]),
      ...(user ? [[user.lng, user.lat] as [number, number]] : []),
    ];
    if (!pts.length) return;
    // Na een nieuwe opbouw door een themawissel staat het kaartbeeld al goed
    if (fitted.current && fitted.current.key === fitKey) return;
    fitted.current = { key: fitKey };
    setMoved(false);
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
    const pos = shownUser;
    if (!pos) return;
    let alive = true;
    import("maplibre-gl").then((maplibregl) => {
      if (!alive || !mapRef.current) return;
      const dot = document.createElement("div");
      dot.style.cssText =
        "width:20px;height:20px;border-radius:50%;background:#2f6f7e;border:3px solid #fff;box-shadow:0 0 0 8px rgb(47 111 126 / .25)";
      dot.setAttribute("role", "img");
      dot.setAttribute("aria-label", "Jouw locatie");
      userMarker.current = new maplibregl.Marker({ element: dot }).setLngLat([pos.lng, pos.lat]).addTo(mapRef.current);
    });
    return () => {
      alive = false;
    };
  }, [shownUser, ready]);

  // Eigen punten als losse markers: anders dan de stippen van plekken, zonder popup
  const pinsKey = JSON.stringify(pins ?? []);
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    const list = JSON.parse(pinsKey) as NonNullable<typeof pins>;
    let alive = true;
    import("maplibre-gl").then((maplibregl) => {
      if (!alive || !mapRef.current) return;
      pinMarkers.current = list.map((p) => {
        const el = document.createElement("div");
        el.style.cssText =
          "width:26px;height:26px;display:grid;place-items:center;border:2px dashed currentColor;border-radius:6px;transform:rotate(45deg);background:var(--surface);color:var(--ink);font:600 12px/1 var(--font-sans,sans-serif)";
        const n = document.createElement("span");
        n.style.cssText = "transform:rotate(-45deg)";
        n.textContent = p.number !== undefined ? String(p.number) : "";
        el.appendChild(n);
        el.setAttribute("role", "img");
        el.setAttribute("aria-label", `Eigen punt: ${p.label}`);
        return new maplibregl.Marker({ element: el }).setLngLat([p.lng, p.lat]).addTo(mapRef.current!);
      });
    });
    return () => {
      alive = false;
      pinMarkers.current.forEach((m) => m.remove());
      pinMarkers.current = [];
    };
  }, [pinsKey, ready]);

  // Gekozen plek in beeld houden (vorige/volgende); alleen schuiven als hij buiten het midden valt
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map || !focus) return;
    const p = latest.current.places.find((x) => x.slug === focus);
    if (!p) return;
    const pt = map.project([p.lng, p.lat]);
    const { clientWidth: w, clientHeight: h } = map.getContainer();
    // Het paneel bedekt de onderste helft: de stip hoort in het bovenste deel
    if (pt.x < w * 0.15 || pt.x > w * 0.85 || pt.y < h * 0.1 || pt.y > h * 0.5)
      map.easeTo({ center: [p.lng, p.lat], offset: [0, -h * 0.2], duration: 350 });
  }, [focus, ready]);

  function locateMe() {
    if (!("geolocation" in navigator)) return setLocating("denied");
    setLocating("busy");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const here = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setLocated(here);
        setLocating("idle");
        mapRef.current?.easeTo({ center: [here.lng, here.lat], zoom: Math.max(mapRef.current.getZoom(), 11), duration: 500 });
        setMoved(true);
      },
      (err) => setLocating(err.code === err.PERMISSION_DENIED ? "denied" : "idle"),
      { timeout: 12000, maximumAge: 300000 },
    );
  }

  function searchArea() {
    const map = mapRef.current;
    if (!map || !onSearchArea) return;
    const c = map.getCenter();
    const b = map.getBounds();
    const center = { lat: c.lat, lng: c.lng };
    // Halve breedte of hoogte van wat je ziet, wat het grootst is; afgerond op hele km
    const half = Math.max(distanceKm(center, { lat: c.lat, lng: b.getEast() }), distanceKm(center, { lat: b.getNorth(), lng: c.lng }));
    onSearchArea(center, Math.min(150, Math.max(2, Math.ceil(half))));
    setMoved(false);
  }

  return (
    <div className={`relative overflow-hidden bg-sunken ${className}`}>
      {/* Inline: maplibre-gl.css (zonder cascade layer) zet position: relative en wint van utilities */}
      <div ref={el} style={{ position: "absolute", inset: 0 }} />
      {openPopup && createPortal(<PopupCard p={openPopup.props} departures={departures} />, openPopup.node)}
      {!ready && !failed && <div className="absolute inset-0 grid place-items-center text-muted">Kaart laden…</div>}
      {ready && onSearchArea && moved && (
        <button
          type="button"
          onClick={searchArea}
          className="animate-fade-in absolute top-3 left-1/2 z-10 flex h-11 -translate-x-1/2 items-center gap-2 rounded-full bg-surface px-4 font-semibold text-forest shadow-float"
        >
          <Icon name="search" size={17} /> Zoek in dit gebied
        </button>
      )}
      {ready && locate && (
        <button
          type="button"
          onClick={locateMe}
          disabled={locating === "busy"}
          aria-label={locating === "denied" ? "Locatie staat uit in je browser" : "Naar mijn locatie"}
          title={locating === "denied" ? "Locatie staat uit in je browser" : "Naar mijn locatie"}
          className="absolute top-[112px] right-2.5 z-10 grid h-11 w-11 place-items-center rounded-lg border border-line bg-surface text-forest shadow-float disabled:opacity-60"
        >
          <Icon name="locate" size={20} className={locating === "busy" ? "animate-pulse" : undefined} />
        </button>
      )}
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
