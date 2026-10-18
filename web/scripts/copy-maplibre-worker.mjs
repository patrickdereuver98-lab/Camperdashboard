// Kaartbibliotheek 6 laadt zijn worker als los bestand naast de bibliotheek. Na het bundelen staat dat bestand daar
// niet, dus zetten we het vóór elke build en dev-start in public/ (zelfde versie als in node_modules).
import { copyFileSync } from "node:fs";

copyFileSync(
  new URL("../node_modules/maplibre-gl/dist/maplibre-gl-worker.mjs", import.meta.url),
  new URL("../public/maplibre-gl-worker.mjs", import.meta.url),
);
