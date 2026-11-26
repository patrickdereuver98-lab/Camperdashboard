import type { Filters } from "./search";

export type QuickChipKey = "vrij" | "uitslapers" | "open" | "voorzieningen";
export type QuickChip = { key: QuickChipKey; label: string; on: boolean; toggle: () => Filters };

/**
 * Snelle filters op de zoekpagina. Sinds 26 november 2026 (UI/UX-plan, T13, besluit eigenaar) hoogstens vier: de
 * twee vertrekgroepen, Nu open en Voorzieningen (opent de filtersheet). Gratis, 8+, Stroom en Lozen staan in de
 * filtersheet; Dichtbij in de tabbalk. Geen eigen kleur: een chip is uit (rand) of aan (bosgroen), review R49.
 */
export function quickChips(f: Filters): QuickChip[] {
  const group = (g: "vrij" | "uitslapers") => ({ ...f, departure: f.departure === g ? undefined : g });
  return [
    { key: "vrij", label: "Zonder vertrektijd", on: f.departure === "vrij", toggle: () => group("vrij") },
    { key: "uitslapers", label: "Vertrek 12:00 of later", on: f.departure === "uitslapers", toggle: () => group("uitslapers") },
    { key: "open", label: "Nu open", on: f.openNow, toggle: () => ({ ...f, openNow: !f.openNow }) },
    // Geen schakelaar: opent de filtersheet (in QuickChips); "aan" zodra er een voorziening gekozen is
    { key: "voorzieningen", label: "Voorzieningen", on: f.facilities.length > 0, toggle: () => f },
  ];
}
