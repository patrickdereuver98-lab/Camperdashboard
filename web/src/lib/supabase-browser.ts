"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "./env";

let client: SupabaseClient | null = null;

/** Supabase in de browser: publieke formulieren en de beheeromgeving (beveiligd met RLS). */
export function supabase(): SupabaseClient {
  client ??= createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    // PKCE: OAuth en magic links komen terug met ?code= dat de client zelf (één keer) inwisselt
    auth: { persistSession: true, storageKey: "vrijstaan-auth", autoRefreshToken: true, flowType: "pkce", detectSessionInUrl: true },
  });
  return client;
}

/** Leesbare foutmelding uit een Supabase/Postgres-fout */
export function errorMessage(err: unknown): string {
  const msg = (err as { message?: string })?.message ?? String(err);
  if (/fetch|network|Failed to fetch/i.test(msg)) return "Geen verbinding. Controleer je internet en probeer het opnieuw.";
  if (/check constraint|violates/i.test(msg)) return "Niet alle velden zijn goed ingevuld.";
  return msg.replace(/^.*?ERROR:\s*/i, "");
}
