// Eén kolomlijst voor plekken (ARCH-09): de snapshot leest PLACE_COLUMNS rechtstreeks uit src/lib/places.ts, zodat
// een nieuwe kolom op de site ook in de snapshot (de terugval en de offline build) komt.
import { readFileSync } from "node:fs";

/** Haalt de kolommen uit de broncode van places.ts (`const PLACE_COLUMNS = "a,b," + "c";`) */
export function parsePlaceColumns(source) {
  const m = /const PLACE_COLUMNS\s*=\s*([^;]+);/.exec(source);
  if (!m) throw new Error("PLACE_COLUMNS niet gevonden in src/lib/places.ts");
  const parts = [...m[1].matchAll(/"([^"]*)"/g)].map((p) => p[1]);
  const rest = m[1].replace(/"[^"]*"/g, "").replace(/[\s+]/g, "");
  if (!parts.length || rest !== "") throw new Error("PLACE_COLUMNS is geen samengevoegde tekst meer; pas scripts/place-columns.mjs aan");
  const columns = parts.join("").split(",").map((c) => c.trim()).filter(Boolean);
  for (const c of columns) if (!/^[a-z_][a-z0-9_]*$/.test(c)) throw new Error(`Onverwachte kolom in PLACE_COLUMNS: ${c}`);
  return columns.join(",");
}

export function readPlaceColumns() {
  return parsePlaceColumns(readFileSync(new URL("../src/lib/places.ts", import.meta.url), "utf8"));
}
