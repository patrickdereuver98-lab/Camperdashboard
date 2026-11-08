"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./supabase-browser";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "./env";
import { AUTH_STORAGE_KEY } from "./auth-storage";
import { changesPublicData } from "./admin-refresh";

let client: SupabaseClient<Database> | null = null;

let refreshTimer: ReturnType<typeof setTimeout> | undefined;

/**
 * Na een wijziging in beheer de caches van de publieke site laten verversen (R36, /api/admin/revalidate), één keer
 * per reeks wijzigingen. Met het token van de beheerder; voor een gewone bezoeker weigert de server.
 */
function refreshSiteSoon(authorization: string) {
  clearTimeout(refreshTimer);
  refreshTimer = setTimeout(() => {
    void fetch("/api/admin/revalidate", { method: "POST", headers: { Authorization: authorization } }).catch(() => undefined);
  }, 1500);
}

const fetchWithRefresh: typeof fetch = async (input, init) => {
  const res = await fetch(input, init);
  try {
    if (res.ok && window.location.pathname.startsWith("/admin")) {
      const req = input instanceof Request ? input : null;
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      const method = (init?.method ?? req?.method ?? "GET").toUpperCase();
      const auth = new Headers(init?.headers ?? req?.headers).get("authorization");
      if (auth && changesPublicData(SUPABASE_URL, url, method)) refreshSiteSoon(auth);
    }
  } catch {
    /* verversen is een extraatje: de wijziging zelf is gelukt */
  }
  return res;
};

/**
 * De Supabase-client zelf. Alleen dit bestand laadt supabase-js (±62 KB gz); de publieke site haalt het via
 * `supabase()` in supabase-browser.ts pas op als het nodig is (R34). De beheeromgeving importeert dit direct.
 */
export function supabaseClient(): SupabaseClient<Database> {
  client ??= createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
    // PKCE: OAuth en magic links komen terug met ?code= dat de client zelf (één keer) inwisselt
    auth: { persistSession: true, storageKey: AUTH_STORAGE_KEY, autoRefreshToken: true, flowType: "pkce", detectSessionInUrl: true },
    global: { fetch: fetchWithRefresh },
  });
  return client;
}
