// Review november 2026, golf 1 (agent B): R9, R11, R12, R14, R15, R26. Code-tests plus vaste regels in de migraties.
import { strict as assert } from "node:assert";
import { createHmac } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { test } from "node:test";
import { beeldParams } from "../src/app/api/marketing/beeld/params.ts";
import { POST as inboundEmail } from "../src/app/api/webhooks/inbound-email/route.ts";
import { GeminiError, geminiJson, isTemporaryAiError, isTemporaryStatus } from "../src/lib/gemini.ts";
import { rateLimited } from "../src/lib/rate-limit.ts";
import { groupUpdates } from "../src/lib/update-triage.ts";
import { sameSecret } from "../supabase/functions/push/notify.ts";

const MIGRATIONS = new URL("../supabase/migrations/", import.meta.url);
const migration = (prefix: string) => {
  const name = readdirSync(MIGRATIONS).find((f) => f.startsWith(prefix));
  assert.ok(name, `migratie ${prefix} bestaat`);
  return readFileSync(new URL(name, MIGRATIONS), "utf8");
};
/** Een functie in een migratie: van "create or replace function <naam>(" tot de afsluitende "$$;" */
const fn = (sql: string, name: string) => {
  const start = sql.indexOf(`create or replace function ${name}(`);
  assert.ok(start >= 0, `${name} staat in de migratie`);
  return sql.slice(start, sql.indexOf("$$;", start) + 3);
};

// ── R9: e-mailadres van reviewers ────────────────────────────────────────────────────────────────────────────────
test("R9: anon en authenticated lezen alleen openbare kolommen van reviews", () => {
  const sql = migration("20261106100000");
  assert.match(sql, /revoke select, insert, update on public\.reviews from anon, authenticated;/);
  const grant = sql.match(/grant select \(([^)]*)\)\s+on public\.reviews to anon, authenticated;/);
  assert.ok(grant, "kolomrechten voor select");
  for (const secret of ["author_email", "admin_note", "user_id"]) assert.ok(!grant[1].includes(secret), `${secret} niet openbaar`);
  assert.match(sql, /grant update \(status, admin_note\) on public\.reviews to authenticated;/);
});

test("R9: admin_reviews is security definer met lege search_path en controleert is_admin()", () => {
  const sql = migration("20261106100000");
  const body = fn(sql, "public.admin_reviews");
  assert.match(body, /security definer set search_path to ''/);
  assert.match(body, /if not public\.is_admin\(\) then raise exception/);
  assert.match(sql, /revoke all on function public\.admin_reviews\(text, integer\) from public, anon;/);
});

test("B19: de oude submit_review met p_author_email verdwijnt", () => {
  assert.match(
    migration("20261106100000"),
    /drop function if exists public\.submit_review\(uuid, text, text, integer, integer, integer, integer, integer, text, text, text, date\);/,
  );
});

test("R9: geen code buiten beheer leest author_email, admin_note of user_id van reviews, en niemand doet select(*) op reviews", () => {
  const files: string[] = [];
  const walk = (dir: URL) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      if (e.isDirectory()) walk(new URL(`${e.name}/`, dir));
      else if (/\.(ts|tsx|mjs)$/.test(e.name) && e.name !== "database.types.ts") files.push(new URL(e.name, dir).pathname);
    }
  };
  walk(new URL("../src/", import.meta.url));
  walk(new URL("../scripts/", import.meta.url));
  for (const f of files) {
    const src = readFileSync(f, "utf8");
    assert.doesNotMatch(src, /from\("reviews"\)\.select\("\*/, `${f} leest alle kolommen van reviews`);
    assert.doesNotMatch(src, /reviews\?select=[^`"]*(author_email|admin_note|user_id)/, `${f} leest privékolommen van reviews`);
    if (src.includes("author_email") && !f.includes("/app/admin/reviews/")) assert.fail(`${f} gebruikt author_email`);
  }
});

// ── R14 ─────────────────────────────────────────────────────────────────────────────────────────────────────────
test("R14: is_admin() alleen voor rol admin, rechten voor anon blijven (RLS-policies)", () => {
  const sql = migration("20261106100100");
  assert.match(sql, /from public\.admins where user_id = \(select auth\.uid\(\)\) and role = 'admin'/);
  assert.doesNotMatch(sql, /revoke all on function public\.is_admin\(\) from public, anon/);
});

// ── R12: inbox ──────────────────────────────────────────────────────────────────────────────────────────────────
test("R12: log_owner_reply zet verified_at niet zelf en noemt een vreemd adres 'mail (onbevestigd)'", () => {
  const sql = migration("20261106100200");
  const body = fn(sql, "public.log_owner_reply");
  assert.doesNotMatch(body, /update public\.places set verified_at/);
  assert.match(body, /v_source := case when v_sender then 'eigenaar' else 'mail \(onbevestigd\)' end;/);
  assert.doesNotMatch(body, /, 'eigenaar', v_reply\)/, "bron komt uit v_source, niet vast 'eigenaar'");
  assert.match(body, /'verified_at', to_jsonb\(v_place\.verified_at\)/, "bevestiging als voorstel in de inbox");
  assert.match(sql, /check \(source in \([^)]*'mail \(onbevestigd\)'\)\)/);
});

test("R26 / DATA-14: accepteren zet een controledatum en neemt regel en tijd samen", () => {
  const sql = migration("20261106100200");
  const apply = fn(sql, "public.admin_apply_update");
  assert.match(apply, /private\.queue_group\(u\)/);
  assert.match(apply, /private\.mark_departure_checked/);
  assert.match(fn(sql, "private.mark_departure_checked"), /departure_checked_at = now\(\)/);
  assert.match(fn(sql, "public.admin_reject_update"), /private\.queue_group\(u\)/);
});

test("R26: Inzendingen neemt over in één functie en handelt de wachtrij af", () => {
  const sql = migration("20261106100300");
  const take = fn(sql, "public.admin_take_submission");
  assert.match(take, /if not public\.is_admin\(\) then raise exception/);
  assert.match(take, /update public\.updates_queue set status = 'approved'/);
  assert.match(take, /update public\.updates_queue set status = 'rejected'/);
  assert.match(take, /private\.mark_departure_checked/);
  assert.match(fn(sql, "public.admin_set_submission"), /update public\.updates_queue set status = 'rejected'/);
  const page = readFileSync(new URL("../src/app/admin/inzendingen/page.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(page, /from\("places"\)\.update/, "geen losse updates van places meer vanuit de browser");
  assert.match(page, /admin_take_submission/);
});

// ── R11 ─────────────────────────────────────────────────────────────────────────────────────────────────────────
test("R11: vertrektijden hebben een eigen, ruimere limiet", () => {
  const body = fn(migration("20261106100400"), "public.submit_place");
  assert.match(body, /rate_take\('submit:vertrek:uur', 200, interval '1 hour'\)/);
  assert.match(body, /rate_take\('submit:uur', 60, interval '1 hour'\)/);
});

test("R11: voorzieningen-raster bundelt antwoorden in één inzending", () => {
  const src = readFileSync(new URL("../src/app/(site)/plek/[slug]/facility-grid.tsx", import.meta.url), "utf8");
  assert.equal(src.match(/rpc\("submit_place"/g)?.length, 1);
  assert.match(src, /BUNDLE_MS/);
  assert.match(src, /visibilitychange/);
});

// ── SEC-13 ───────────────────────────────────────────────────────────────────────────────────────────────────────
test("SEC-13: push_subscribe alleen voor bekende pushdiensten", () => {
  const body = fn(migration("20261106100500"), "public.push_subscribe");
  const re = new RegExp(body.match(/p_endpoint !~ '([^']+)'/)![1]);
  for (const ok of [
    "https://fcm.googleapis.com/fcm/send/abc",
    "https://updates.push.services.mozilla.com/wpush/v2/x",
    "https://web.push.apple.com/QW",
    "https://wns2-par02p.notify.windows.com/w/?token=1",
  ])
    assert.ok(re.test(ok), ok);
  for (const bad of ["https://evil.example/x", "https://web.push.apple.com.evil.nl/x", "http://fcm.googleapis.com/x", "https://169.254.169.254/"])
    assert.ok(!re.test(bad), bad);
});

// ── SEC-12 ───────────────────────────────────────────────────────────────────────────────────────────────────────
test("SEC-12: sameSecret vergelijkt sleutels, leeg is nooit gelijk", async () => {
  assert.equal(await sameSecret("abc", "abc"), true);
  assert.equal(await sameSecret("abc", "abd"), false);
  assert.equal(await sameSecret("abc", "abcd"), false);
  assert.equal(await sameSecret("", ""), false);
  assert.equal(await sameSecret(null, "abc"), false);
  assert.equal(await sameSecret("abc", undefined), false);
  const index = readFileSync(new URL("../supabase/functions/push/index.ts", import.meta.url), "utf8");
  assert.doesNotMatch(index, /key !== secret/);
});

// ── TS-10 ────────────────────────────────────────────────────────────────────────────────────────────────────────
test("TS-10: beeldParams kent alleen eigen sjablonen en begrensde parameters", () => {
  const p = (q: string) => beeldParams(new URLSearchParams(q));
  assert.deepEqual(p("t=cijfers"), { t: "cijfers", f: "portrait", province: undefined, slide: 1 });
  assert.equal(p("t=constructor"), null);
  assert.equal(p("t=toString"), null);
  assert.equal(p("t=cijfers&f=__proto__"), null);
  assert.equal(p("t=cijfers&i=0"), null);
  assert.equal(p("t=cijfers&i=21"), null);
  assert.equal(p("t=cijfers&i=1.5"), null);
  assert.equal(p(`t=cijfers&p=${"a".repeat(41)}`), null);
  assert.equal(p("t=cijfers&p=<script>"), null);
  assert.equal(p("t=cijfers&p=Noord-Holland&i=2")?.province, "Noord-Holland");
});

test("rateLimited: met scope telt een route apart", () => {
  const req = () => new Request("https://x.nl/", { headers: { "x-forwarded-for": "203.0.113.77" } });
  for (let i = 0; i < 2; i++) assert.equal(rateLimited(req(), 2, "test-a"), null);
  assert.equal(rateLimited(req(), 2, "test-a")?.status, 429);
  assert.equal(rateLimited(req(), 2, "test-b"), null, "andere scope, eigen teller");
});

// ── Gemini-fouten ────────────────────────────────────────────────────────────────────────────────────────────────
test("isTemporaryStatus en isTemporaryAiError", () => {
  for (const s of [408, 425, 429, 500, 503]) assert.ok(isTemporaryStatus(s), String(s));
  for (const s of [400, 401, 403, 404]) assert.ok(!isTemporaryStatus(s), String(s));
  assert.ok(isTemporaryAiError(new GeminiError("x", true)));
  assert.ok(!isTemporaryAiError(new GeminiError("x", false, 400)));
  assert.ok(isTemporaryAiError(new Error("onbekend")));
});

async function withFetch<T>(impl: typeof fetch, run: () => Promise<T>): Promise<T> {
  const original = globalThis.fetch;
  globalThis.fetch = impl;
  try {
    return await run();
  } finally {
    globalThis.fetch = original;
  }
}

test("geminiJson: 429 is tijdelijk, 400 niet, netwerkfout tijdelijk, geblokkeerd geeft lege tekst", async () => {
  const call = () => geminiJson("k", "m", "t", { schema: {} });
  await assert.rejects(withFetch(async () => new Response("", { status: 429 }), call), (e) => e instanceof GeminiError && e.temporary);
  await assert.rejects(withFetch(async () => new Response("", { status: 400 }), call), (e) => e instanceof GeminiError && !e.temporary);
  await assert.rejects(
    withFetch(async () => {
      throw new TypeError("fetch failed");
    }, call),
    (e) => e instanceof GeminiError && e.temporary,
  );
  assert.equal(await withFetch(async () => Response.json({ promptFeedback: { blockReason: "SAFETY" } }), call), "");
});

// ── Webhook: Content-Length en opslaan bij een onleesbare mail ──────────────────────────────────────────────────
const KEY = Buffer.from("geheim-voor-de-test-1234567890ab");
function signedRequest(body: string, extra: Record<string, string> = {}) {
  const ts = Math.floor(Date.now() / 1000);
  const sig = createHmac("sha256", KEY).update(`msg_1.${ts}.${body}`).digest("base64");
  return new Request("https://x.nl/api/webhooks/inbound-email", {
    method: "POST",
    body,
    headers: { "svix-id": "msg_1", "svix-timestamp": String(ts), "svix-signature": `v1,${sig}`, "x-forwarded-for": "198.51.100.9", ...extra },
  });
}

async function withEnv<T>(run: () => Promise<T>): Promise<T> {
  const keys = { RESEND_WEBHOOK_SECRET: `whsec_${KEY.toString("base64")}`, OWNER_INBOX_KEY: "inbox", GEMINI_API_KEY: "g" };
  const before = Object.fromEntries(Object.keys(keys).map((k) => [k, process.env[k]]));
  Object.assign(process.env, keys);
  try {
    return await run();
  } finally {
    for (const [k, v] of Object.entries(before)) if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
}

const MAIL = JSON.stringify({
  type: "email.received",
  data: { email_id: "e1", from: "Eigenaar <info@deproef.nl>", subject: "Re: Klopt dit nog?", text: "De prijs is nu 18 euro." },
});

test("webhook: te grote Content-Length wordt geweigerd vóór het lezen", async () => {
  const res = await withEnv(() => inboundEmail(signedRequest("{}", { "content-length": "600000" })));
  assert.equal(res.status, 413);
});

test("webhook: Gemini weigert (400) of geeft geen JSON → mail toch opgeslagen als unknown, 200", async () => {
  for (const gemini of [() => new Response("", { status: 400 }), () => Response.json({ candidates: [{ content: { parts: [{ text: "geen json" }] } }] })]) {
    let saved: { p_reply: { intent: string; price: unknown } } | null = null;
    const res = await withEnv(() =>
      withFetch(async (input, init) => {
        const url = String(input);
        if (url.includes("generativelanguage")) return gemini();
        if (url.includes("/rpc/log_owner_reply")) {
          saved = JSON.parse(String(init?.body));
          return Response.json({ id: "r1", outcome: "logged" });
        }
        throw new Error(`onverwacht: ${url}`);
      }, () => inboundEmail(signedRequest(MAIL))),
    );
    assert.equal(res.status, 200);
    assert.equal(saved!.p_reply.intent, "unknown");
    assert.equal(saved!.p_reply.price, null);
  }
});

test("webhook: tijdelijke Gemini-storing (503) → 502, niets opgeslagen", async () => {
  let saved = false;
  const res = await withEnv(() =>
    withFetch(async (input) => {
      if (String(input).includes("/rpc/log_owner_reply")) saved = true;
      return new Response("", { status: 503 });
    }, () => inboundEmail(signedRequest(MAIL))),
  );
  assert.equal(res.status, 502);
  assert.equal(saved, false);
});

test("webhook: prijs die niet in de mail staat gaat niet mee", async () => {
  let saved: { p_reply: { intent: string; price: unknown } } | null = null;
  const reply = { intent: "update", price: 25, departure_time: null, summary: "Nieuwe prijs." };
  await withEnv(() =>
    withFetch(async (input, init) => {
      if (String(input).includes("generativelanguage")) return Response.json({ candidates: [{ content: { parts: [{ text: JSON.stringify(reply) }] } }] });
      saved = JSON.parse(String(init?.body));
      return Response.json({ id: "r1" });
    }, () => inboundEmail(signedRequest(MAIL))),
  );
  assert.equal(saved!.p_reply.price, null);
  assert.equal(saved!.p_reply.intent, "unknown");
});

// ── Triage Inbox ─────────────────────────────────────────────────────────────────────────────────────────────────
test("groupUpdates: regel en tijd van dezelfde inzending of mail worden één rij, regel eerst", () => {
  const row = (id: string, field_changed: string, submission_id: string | null, owner_reply_id: string | null = null) => ({
    id,
    field_changed,
    submission_id,
    owner_reply_id,
  });
  const out = groupUpdates([
    row("1", "checkout_until", "s1"),
    row("2", "power", "s2"),
    row("3", "departure", "s1"),
    row("4", "departure", null, "m1"),
    row("5", "checkout_until", null, "m1"),
    row("6", "price_eur", null, "m1"),
    row("7", "departure", "s3"),
  ]);
  assert.deepEqual(
    out.map((r) => [r.id, r.fields.map((f) => f.field_changed)]),
    [
      ["1", ["departure", "checkout_until"]],
      ["2", ["power"]],
      ["4", ["departure", "checkout_until"]],
      ["6", ["price_eur"]],
      ["7", ["departure"]],
    ],
  );
});
