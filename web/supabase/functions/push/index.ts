// VrijStaan pushmeldingen (Supabase Edge Function, Deno)
//
//   { "action": "notify", "place_id": "<uuid>" }  → volgers van deze plek melden dat het er rustig is
//   { "action": "keys" }                          → VAPID-sleutels aanmaken als ze er nog niet zijn
//
// Beveiliging: header `x-pipeline-key` moet gelijk zijn aan internal_secrets.pipeline_key (net als `pipeline`).
// De VAPID-sleutels maakt deze functie zelf aan en bewaart ze in de database; de private sleutel verlaat Supabase nooit.

import { createClient } from "npm:@supabase/supabase-js@2.45.4";
import webpush from "npm:web-push@3.6.7";
import { sendAll, type Target, type Vapid } from "./notify.ts";

const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false },
});

async function vapid(): Promise<Vapid> {
  const { data } = await db.rpc("push_vapid_keys");
  if (data?.publicKey && data?.privateKey) return { ...data, subject: "mailto:hallo@vrijstaan.nl" };
  const keys = webpush.generateVAPIDKeys();
  const { error } = await db.rpc("push_set_vapid_keys", { p_public: keys.publicKey, p_private: keys.privateKey });
  if (error) throw error;
  // Bij een gelijktijdige aanroep wint de eerste: altijd opnieuw lezen
  const again = await db.rpc("push_vapid_keys");
  return { ...again.data, subject: "mailto:hallo@vrijstaan.nl" };
}

Deno.serve(async (req) => {
  const key = req.headers.get("x-pipeline-key");
  const { data: secret } = await db.from("internal_secrets").select("value").eq("name", "pipeline_key").single();
  if (!key || !secret || key !== secret.value) return new Response("Forbidden", { status: 403 });

  const body = await req.json().catch(() => ({}));
  try {
    if (body.action === "keys") return Response.json({ publicKey: (await vapid()).publicKey });
    if (body.action === "notify") {
      const { data: targets, error } = await db.rpc("push_take_targets", { p_place_id: String(body.place_id) });
      if (error) throw error;
      const list = (targets ?? []) as (Target & { place_name: string; place_slug: string })[];
      if (!list.length) return Response.json({ sent: 0 });
      const { sent, gone, errors } = await sendAll(webpush, await vapid(), list, {
        title: `${list[0].place_name} is nu rustig`,
        body: "Volgens een camperaar die er nu staat. Tik om de plek te bekijken.",
        url: `/plek/${list[0].place_slug}#drukte`,
      });
      if (gone.length) await db.rpc("push_disable_subscriptions", { p_ids: gone });
      if (errors.length) await db.from("app_logs").insert({ level: "warn", source: "push", message: `${errors.length} pushmeldingen mislukt`, context: { errors } });
      return Response.json({ sent, gone: gone.length });
    }
    return new Response("Onbekende actie", { status: 400 });
  } catch (e) {
    await db.from("app_logs").insert({ level: "error", source: "push", message: String(e).slice(0, 2000) });
    return Response.json({ error: String(e) }, { status: 500 });
  }
});
