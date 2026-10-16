// Pushmeldingen versturen (los van Deno.serve, zodat het te testen is)

export type Target = { subscription_id: string; endpoint: string; p256dh: string; auth: string };
export type Vapid = { publicKey: string; privateKey: string; subject: string };
type WebPush = {
  setVapidDetails(subject: string, pub: string, priv: string): void;
  sendNotification(sub: { endpoint: string; keys: { p256dh: string; auth: string } }, payload: string, opts?: { TTL?: number }): Promise<unknown>;
};

/** Stuurt de melding naar alle doelen; geeft terug welke abonnementen verlopen zijn (404/410) */
export async function sendAll(webpush: WebPush, vapid: Vapid, targets: Target[], payload: { title: string; body: string; url: string }) {
  webpush.setVapidDetails(vapid.subject, vapid.publicKey, vapid.privateKey);
  const gone: string[] = [];
  const errors: string[] = [];
  let sent = 0;
  await Promise.all(
    targets.map(async (t) => {
      try {
        await webpush.sendNotification({ endpoint: t.endpoint, keys: { p256dh: t.p256dh, auth: t.auth } }, JSON.stringify(payload), { TTL: 3600 });
        sent++;
      } catch (e) {
        const status = (e as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) gone.push(t.subscription_id);
        else errors.push(String((e as Error).message ?? e).slice(0, 200));
      }
    }),
  );
  return { sent, gone, errors };
}
