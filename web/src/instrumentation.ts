import type { Instrumentation } from "next";
import { OFFLINE_BUILD, SUPABASE_ANON_KEY, SUPABASE_URL } from "@/lib/env";

/**
 * Serverfouten (rendering, route handlers) komen in `app_logs`, net als fouten uit de browser. Zonder headers, IP of
 * querystring; supportlinks worden ingekort tot /support/[token], want het token geeft toegang tot een ticket.
 */
export const onRequestError: Instrumentation.onRequestError = async (err, request, context) => {
  if (OFFLINE_BUILD) return;
  const message = err instanceof Error ? err.message : String(err);
  const digest = typeof err === "object" && err !== null && "digest" in err ? String(err.digest) : undefined;
  const path = request.path.split("?")[0].replace(/^\/support\/[^/]+/, "/support/[token]");
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/rpc/report_client_error`, {
      method: "POST",
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        p_message: `[server] ${message}`.slice(0, 500),
        p_context: { path, digest, method: request.method, route: context.routePath, type: context.routeType },
      }),
      signal: AbortSignal.timeout(3000),
    });
  } catch {
    // Loggen mag de pagina nooit verder laten mislukken
  }
};
