import { assertEquals } from "jsr:@std/assert@1";
import webpush from "npm:web-push@3.6.7";
import { sendAll } from "./notify.ts";

// Echte versleuteling met web-push, naar een lokale nep-pushdienst over HTTPS (zoals echte pushdiensten).
// Draaien: PUSH_TEST_CERT=… PUSH_TEST_KEY=… deno test --unsafely-ignore-certificate-errors=localhost --allow-all
const cert = Deno.env.get("PUSH_TEST_CERT");
const key = Deno.env.get("PUSH_TEST_KEY");

Deno.test({ name: "sendAll versleutelt en verstuurt, en meldt verlopen abonnementen", ignore: !cert || !key }, async () => {
  const hits: { path: string; encoding: string | null; auth: string | null; len: number }[] = [];
  const server = Deno.serve({ port: 0, onListen() {}, cert: Deno.readTextFileSync(cert!), key: Deno.readTextFileSync(key!) }, async (req) => {
    const path = new URL(req.url).pathname;
    hits.push({ path, encoding: req.headers.get("content-encoding"), auth: req.headers.get("authorization"), len: (await req.arrayBuffer()).byteLength });
    return new Response(null, { status: path === "/weg" ? 410 : 201 });
  });
  const base = `https://localhost:${server.addr.port}`;
  // Geldige ontvangersleutels (zoals een browser ze maakt)
  const recv = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
  const raw = new Uint8Array(await crypto.subtle.exportKey("raw", recv.publicKey));
  const b64 = (u: Uint8Array) => btoa(String.fromCharCode(...u)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const p256dh = b64(raw);
  const auth = b64(crypto.getRandomValues(new Uint8Array(16)));
  const keys = webpush.generateVAPIDKeys();

  const res = await sendAll(webpush, { ...keys, subject: "mailto:test@example.com" }, [
    { subscription_id: "a", endpoint: `${base}/ok`, p256dh, auth },
    { subscription_id: "b", endpoint: `${base}/weg`, p256dh, auth },
  ], { title: "t", body: "b", url: "/" });
  await server.shutdown();

  assertEquals(res, { sent: 1, gone: ["b"], errors: [] });
  assertEquals(hits.length, 2);
  for (const h of hits) {
    assertEquals(h.encoding, "aes128gcm");
    assertEquals(h.auth?.startsWith("vapid t="), true);
    assertEquals(h.len > 0, true);
  }
});
