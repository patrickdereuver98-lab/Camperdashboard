// VrijStaan: websites zoeken voor plekken zonder website (Supabase Edge Function, Deno).
//
// Los van de functie `pipeline`, zodat beide onafhankelijk kunnen worden uitgerold.
//   { "n": 6 }  → volgende batch plekken (public.next_discover_batch) proberen; resultaat via public.apply_discovery
//
// Beveiliging: header `x-pipeline-key` moet gelijk zijn aan internal_secrets.pipeline_key.

import { createClient } from "npm:@supabase/supabase-js@2.45.4";
import { type Candidate, domains, matches } from "../pipeline/discover.ts";

const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false },
});

const UA = "VrijStaanBot/1.0 (+https://vrijstaan.nl/bot; camperplaatsengids)";

/** Mag de bot deze homepage lezen volgens robots.txt? */
async function allowed(url: URL): Promise<boolean> {
  try {
    const res = await fetch(`${url.origin}/robots.txt`, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(4000) });
    if (!res.ok) return true;
    let applies = false;
    for (const raw of (await res.text()).split(/\r?\n/)) {
      const line = raw.split("#")[0].trim();
      const [k, ...rest] = line.split(":");
      const v = rest.join(":").trim();
      if (/^user-agent$/i.test(k)) applies = v === "*" || /vrijstaan/i.test(v);
      else if (applies && /^disallow$/i.test(k) && (v === "/" || url.pathname.startsWith(v)) && v) return false;
    }
    return true;
  } catch {
    return true;
  }
}

async function homepage(u: string): Promise<string | null> {
  const url = new URL(u);
  const res = await fetch(url, {
    headers: { "User-Agent": UA, Accept: "text/html", "Accept-Language": "nl,en;q=0.5" },
    redirect: "follow",
    signal: AbortSignal.timeout(6000),
  });
  if (!res.ok || !(res.headers.get("content-type") ?? "").includes("html")) return null;
  if (!(await allowed(new URL(res.url)))) return null;
  return (await res.text()).slice(0, 800_000);
}

async function discoverOne(c: Candidate): Promise<string | null> {
  for (const d of domains(c.name, c.town)) {
    // www en zonder www tegelijk; de eerste die past wint
    const tries = await Promise.all(
      [`https://www.${d}/`, `https://${d}/`].map(async (u) => {
        try {
          const html = await homepage(u);
          return html && matches(c, html) ? u : null;
        } catch {
          return null;
        }
      }),
    );
    const hit = tries.find(Boolean);
    if (hit) return hit;
  }
  return null;
}

Deno.serve(async (req) => {
  const key = req.headers.get("x-pipeline-key");
  const { data: secret } = await db.from("internal_secrets").select("value").eq("name", "pipeline_key").single();
  if (!key || !secret || key !== secret.value) return new Response("Forbidden", { status: 403 });

  const body = await req.json().catch(() => ({}));
  const n = Math.min(8, Number(body.n) || 4);
  try {
    const { data: batch, error } = await db.rpc("next_discover_batch", { p_limit: n });
    if (error) throw error;
    const results = await Promise.all(
      (batch ?? []).map(async (c: Candidate) => {
        const url = await discoverOne(c).catch(() => null);
        await db.rpc("apply_discovery", { p_id: c.id, p_url: url });
        return { id: c.id, name: c.name, url };
      }),
    );
    const found = results.filter((r) => r.url);
    if (found.length)
      await db.from("app_logs").insert({
        level: "info",
        source: "discover",
        message: `Websites gevonden: ${found.map((r) => `${r.name} → ${r.url}`).join("; ")}`.slice(0, 2000),
        context: {},
      });
    return Response.json({ processed: results.length, found: found.length, results });
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
});
