"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database as Generated, Json } from "./database.types";
import type { MarketingFunctions, MarketingTables } from "./marketing/db-types";

// De generator maakt functieargumenten nooit nullable, maar de formulieren sturen `null` voor lege velden en
// Postgres accepteert dat. Daarom mag elk argument hier ook `null` zijn.
type NullableArgs<F> = {
  [K in keyof F]: F[K] extends { Args: infer A } ? Omit<F[K], "Args"> & { Args: { [P in keyof A]: A[P] | null } } : F[K];
};
// Staat in migrations/20261012_user_accounts.sql maar nog niet live (besluit B5); weg zodra de types opnieuw gegenereerd zijn
// Marketingdashboard: migratie 20261102180000, live na samenvoegen (lib/marketing/db-types.ts)
type NotYetLive = { delete_my_account: { Args: { p_confirm: string }; Returns: undefined } } & MarketingFunctions;
type PublicSchema = Generated["public"];
export type Database = Omit<Generated, "public"> & {
  public: Omit<PublicSchema, "Functions" | "Tables"> & {
    Tables: PublicSchema["Tables"] & MarketingTables;
    Functions: NullableArgs<PublicSchema["Functions"] & NotYetLive>;
  };
};

/** Eigen types (reis, camper, uitgaven) als JSON-kolom opslaan; de generator kent alleen `Json` */
export function toJson<T>(value: T): Json {
  return value as unknown as Json;
}

let loading: Promise<SupabaseClient<Database>> | null = null;
let loaded: SupabaseClient<Database> | null = null;
const readyListeners = new Set<() => void>();

/**
 * Supabase in de browser: publieke formulieren, account en statistiek (beveiligd met RLS). supabase-js wordt pas
 * geladen bij de eerste aanroep (R34), niet op elke pagina vooraf. Eén client voor de hele site.
 */
export function supabase(): Promise<SupabaseClient<Database>> {
  loading ??= import("./supabase-client").then(
    (m) => {
      loaded = m.supabaseClient();
      for (const fn of readyListeners) fn();
      readyListeners.clear();
      return loaded;
    },
    (err: unknown) => {
      // Chunk niet binnengekomen (geen bereik): de volgende aanroep probeert het opnieuw
      loading = null;
      throw err;
    },
  );
  return loading;
}

/** Of de client al geladen is (bijvoorbeeld door een formulier of de statistiek) */
export const supabaseLoaded = () => loaded !== null;

/** Eén keer seintje zodra de client geladen is; geeft een functie terug om af te melden */
export function onSupabaseReady(fn: () => void): () => void {
  if (loaded) {
    fn();
    return () => undefined;
  }
  readyListeners.add(fn);
  return () => readyListeners.delete(fn);
}

/** Tekst uit een formulierveld; `null` als het veld ontbreekt (of een bestand is) */
export function formValue(form: FormData, name: string): string | null {
  const v = form.get(name);
  return typeof v === "string" ? v : null;
}

/** Leesbare foutmelding uit een Supabase/Postgres-fout (staat in form-errors, zodat de tests hem kunnen laden) */
export { errorMessage } from "./form-errors";
