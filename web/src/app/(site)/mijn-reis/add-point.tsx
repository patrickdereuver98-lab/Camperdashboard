"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { Map as MlMap } from "maplibre-gl";
import type { LatLng } from "@/lib/geo";
import { MAP_LOCALE_NL } from "@/lib/map-locale";
import { MAX_POINT_NAME, type TripPoint } from "@/lib/trip-merge";
import { useDarkTheme } from "@/lib/use-media";
import { Icon } from "@/components/icons";
import { NL_BOUNDS, STYLE_DARK, STYLE_LIGHT, tint } from "@/components/place-map";
import { AddressSearch } from "./endpoint-card";

/**
 * Punt op de kaart kiezen: schuif de kaart tot het kruisje op de goede plek staat, en tik op "Dit punt kiezen". Zo hoef
 * je op een telefoon niet precies op een klein punt te tikken.
 */
function PointPicker({ near, onPick, onCancel }: { near?: LatLng; onPick: (p: LatLng) => void; onCancel: () => void }) {
  const el = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MlMap | null>(null);
  const dark = useDarkTheme();
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let map: MlMap | null = null;
    (async () => {
      const maplibregl = await import("maplibre-gl").catch(() => null);
      if (cancelled || !el.current) return;
      if (!maplibregl) return setFailed(true);
      maplibregl.setWorkerUrl(`/maplibre-gl-worker.mjs?v=${maplibregl.getVersion()}`);
      map = new maplibregl.Map({
        container: el.current,
        style: dark ? STYLE_DARK : STYLE_LIGHT,
        ...(near ? { center: [near.lng, near.lat] as [number, number], zoom: 10 } : { bounds: NL_BOUNDS, fitBoundsOptions: { padding: 16 } }),
        attributionControl: { compact: true },
        locale: MAP_LOCALE_NL,
      });
      mapRef.current = map;
      map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
      map.on("load", () => map && tint(map, dark));
      map.on("error", (e) => {
        if (!map?.isStyleLoaded() && /style|fetch|Failed/i.test(String(e.error?.message ?? ""))) setFailed(true);
      });
    })();
    return () => {
      cancelled = true;
      map?.remove();
      mapRef.current = null;
    };
    // Eén keer opbouwen; `near` is alleen het beginbeeld
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dark]);

  return (
    <div className="mt-3" data-testid="point-picker">
      <p className="text-sm text-ink-2">Schuif de kaart tot het kruisje op de goede plek staat.</p>
      <div className="relative mt-2 h-72 overflow-hidden rounded-lg border border-line">
        <div ref={el} className="h-full w-full" aria-label="Kaart om een punt te kiezen" role="application" />
        <span className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-ink" aria-hidden="true">
          <Icon name="plus" size={36} strokeWidth={2.5} />
        </span>
        {failed && (
          <p role="alert" className="absolute inset-x-3 bottom-3 rounded-lg bg-alert-tint px-3 py-2 text-sm text-alert">
            De kaart laadt nu niet. Zoek het punt op adres.
          </p>
        )}
      </div>
      <div className="mt-2 flex gap-2">
        <button
          type="button"
          disabled={failed}
          onClick={() => {
            const c = mapRef.current?.getCenter();
            if (c) onPick({ lat: c.lat, lng: c.lng });
          }}
          className="h-11 rounded-md bg-forest px-4 font-semibold text-on-forest disabled:opacity-60"
        >
          Dit punt kiezen
        </button>
        <button type="button" onClick={onCancel} className="h-11 px-3 font-semibold text-forest underline">
          Annuleren
        </button>
      </div>
    </div>
  );
}

/** Kort label uit een adres van PDOK: "Dorpsstraat 1, 1234 AB Ergens" wordt "Dorpsstraat 1" */
export const shortLabel = (label: string) => label.split(",")[0].trim().slice(0, MAX_POINT_NAME);

/**
 * Eigen punt toevoegen aan de reis: een adres of een punt op de kaart, met je eigen naam. Geen VrijStaan-plek en
 * zonder plekgegevens (geen prijs, vertrektijd of seizoen).
 */
export function AddPoint({ near, onAdd, onClose }: { near?: LatLng; onAdd: (p: TripPoint) => void; onClose: () => void }) {
  const nameId = useId();
  const [mode, setMode] = useState<"kies" | "adres" | "kaart">("kies");
  const [spot, setSpot] = useState<(LatLng & { kind: TripPoint["kind"]; label?: string }) | null>(null);
  const [name, setName] = useState("");

  return (
    <section className="mt-3 rounded-lg border border-line bg-surface p-4" aria-labelledby={`${nameId}-kop`} data-testid="add-point">
      <div className="flex items-start justify-between gap-2">
        <h2 id={`${nameId}-kop`} className="font-display text-h3 font-semibold">
          Eigen punt toevoegen
        </h2>
        <button type="button" onClick={onClose} aria-label="Eigen punt sluiten" className="-mt-2 -mr-2 grid h-11 w-11 shrink-0 place-items-center">
          <Icon name="x" size={18} />
        </button>
      </div>
      <p className="mt-1 text-sm text-ink-2">
        Bijvoorbeeld familie, een winkel of een uitzichtpunt. Een eigen punt is geen plek uit VrijStaan: we weten er geen prijs, vertrektijd of seizoen van.
      </p>

      {!spot && mode === "kies" && (
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" onClick={() => setMode("adres")} className="flex h-11 items-center gap-1.5 rounded-md border border-line px-3 font-semibold hover:border-forest">
            <Icon name="search" size={18} /> Adres zoeken
          </button>
          <button type="button" onClick={() => setMode("kaart")} className="flex h-11 items-center gap-1.5 rounded-md border border-line px-3 font-semibold hover:border-forest">
            <Icon name="map" size={18} /> Op de kaart
          </button>
        </div>
      )}
      {!spot && mode === "adres" && (
        <AddressSearch
          onPick={(e) => {
            setSpot({ lat: e.lat, lng: e.lng, kind: "adres", label: e.label });
            setName((n) => n || shortLabel(e.label));
          }}
          onCancel={() => setMode("kies")}
        />
      )}
      {!spot && mode === "kaart" && <PointPicker near={near} onPick={(p) => setSpot({ ...p, kind: "kaart" })} onCancel={() => setMode("kies")} />}

      {spot && (
        <form
          className="mt-3"
          onSubmit={(e) => {
            e.preventDefault();
            const n = name.trim();
            if (!n) return;
            onAdd({ name: n.slice(0, MAX_POINT_NAME), lat: spot.lat, lng: spot.lng, kind: spot.kind });
          }}
        >
          <p className="flex items-center gap-2 text-sm text-ink-2" data-testid="point-spot">
            <Icon name="pin" size={17} />
            {spot.kind === "adres" && spot.label ? spot.label : "Punt op de kaart gekozen"}
            <button type="button" onClick={() => setSpot(null)} className="h-11 px-2 font-semibold text-forest underline">
              Ander punt
            </button>
          </p>
          <label htmlFor={nameId} className="mt-1 block text-sm font-semibold">
            Naam
          </label>
          <input
            id={nameId}
            autoFocus
            value={name}
            maxLength={MAX_POINT_NAME}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 h-11 w-full rounded-lg border border-field bg-surface px-3 text-base focus:ring-2 focus:ring-forest focus:outline-none"
          />
          <p className="mt-1 text-sm text-muted">Het punt komt achteraan je reis, als tussenstop. Plan je samen, dan zien je reisgenoten het ook.</p>
          <button type="submit" disabled={!name.trim()} className="mt-2 h-11 rounded-md bg-forest px-4 font-semibold text-on-forest disabled:opacity-60">
            Toevoegen aan je reis
          </button>
        </form>
      )}
    </section>
  );
}
