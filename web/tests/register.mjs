// Laat `node --test` TypeScript-bestanden laden zoals de app ze schrijft: relatieve imports zonder extensie
// en het alias "@/". Node haalt de types zelf weg (type stripping).
import { registerHooks } from "node:module";

const SRC = new URL("../src/", import.meta.url);

registerHooks({
  resolve(specifier, context, next) {
    if (specifier.startsWith("@/")) specifier = new URL(specifier.slice(2), SRC).href;
    if ((specifier.startsWith(".") || specifier.startsWith("file:")) && !/\.[cm]?[jt]sx?$|\.json$/.test(specifier)) {
      try {
        return next(`${specifier}.ts`, context);
      } catch {
        // Geen .ts: gewoon doorgeven
      }
    }
    return next(specifier, context);
  },
});
