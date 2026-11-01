"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database as Generated, Json } from "./database.types";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "./env";

// De generator maakt functieargumenten nooit nullable, maar de formulieren sturen `null` voor lege velden en
// Postgres accepteert dat. Daarom mag elk argument hier ook `null` zijn.
type NullableArgs<F> = {
  [K in keyof F]: F[K] extends { Args: infer A } ? Omit<F[K], "Args"> & { Args: { [P in keyof A]: A[P] | null } } : F[K];
};
// Staat in migrations/20261012_user_accounts.sql maar nog niet live (besluit B5); weg zodra de types opnieuw gegenereerd zijn
type NotYetLive = { delete_my_account: { Args: { p_confirm: string }; Returns: undefined } };
type PublicSchema = Generated["public"];
export type Database = Omit<Generated, "public"> & {
  public: Omit<PublicSchema, "Functions"> & { Functions: NullableArgs<PublicSchema["Functions"] & NotYetLive> };
};

/** Eigen types (reis, camper, uitgaven) als JSON-kolom opslaan; de generator kent alleen `Json` */
export function toJson<T>(value: T): Json {
  return value as unknown as Json;
}

let client: SupabaseClient<Database> | null = null;

/** Supabase in de browser: publieke formulieren en de beheeromgeving (beveiligd met RLS). */
export function supabase(): SupabaseClient<Database> {
  client ??= createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
    // PKCE: OAuth en magic links komen terug met ?code= dat de client zelf (één keer) inwisselt
    auth: { persistSession: true, storageKey: "vrijstaan-auth", autoRefreshToken: true, flowType: "pkce", detectSessionInUrl: true },
  });
  return client;
}

/** Tekst uit een formulierveld; `null` als het veld ontbreekt (of een bestand is) */
export function formValue(form: FormData, name: string): string | null {
  const v = form.get(name);
  return typeof v === "string" ? v : null;
}

/** Leesbare foutmelding uit een Supabase/Postgres-fout */
export function errorMessage(err: unknown): string {
  const msg = (err as { message?: string })?.message ?? String(err);
  if (/fetch|network|Failed to fetch/i.test(msg)) return "Geen verbinding. Controleer je internet en probeer het opnieuw.";
  if (/check constraint|violates/i.test(msg)) return "Niet alle velden zijn goed ingevuld.";
  return msg.replace(/^.*?ERROR:\s*/i, "");
}

/**
 * Id van één plek bij de slug. `/api/places` stuurt geen ids mee (audit 1 november 2026); wie iets over een plek
 * instuurt (submit_place), zoekt het hier op. Null als de plek niet (meer) gepubliceerd is.
 */
export async function placeIdBySlug(slug: string): Promise<string | null> {
  const { data, error } = await supabase().from("places").select("id").eq("slug", slug).maybeSingle();
  if (error) throw error;
  return data?.id ?? null;
}
