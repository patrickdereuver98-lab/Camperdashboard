// Instagram-cijfers van de laatste 25 posts naar social_stats (één meting per post per dag).
// Geheimen: IG_ACCESS_TOKEN (langlevend token, 60 dagen geldig) en IG_USER_ID. Zonder: overslaan.
import { statRow, type IgInsight, type IgMedia } from "@/lib/marketing/instagram";
import { json, logRun, sql } from "./db";
import { getJson } from "./google";

const GRAPH = "https://graph.facebook.com/v23.0";

export async function instagram() {
  const token = process.env.IG_ACCESS_TOKEN;
  const user = process.env.IG_USER_ID;
  if (!token || !user) {
    console.log("::notice::IG_ACCESS_TOKEN of IG_USER_ID ontbreekt: Instagram overgeslagen (plan §6, P5).");
    return;
  }
  const started = Date.now();
  const q = (path: string) => `${GRAPH}/${path}${path.includes("?") ? "&" : "?"}access_token=${encodeURIComponent(token)}`;
  try {
    const media = await getJson<{ data?: IgMedia[] }>(q(`${encodeURIComponent(user)}/media?fields=id,permalink,timestamp,like_count,comments_count&limit=25`));
    const today = new Date().toISOString().slice(0, 10);
    const rows = [];
    for (const m of media.data ?? []) {
      // "views" is nieuw (2025); oudere API-versies kennen alleen reach, saved en shares
      const insights = await getJson<{ data?: IgInsight[] }>(q(`${m.id}/insights?metric=reach,views,saved,shares`)).catch(() =>
        getJson<{ data?: IgInsight[] }>(q(`${m.id}/insights?metric=reach,saved,shares`)).catch(() => ({ data: [] as IgInsight[] })),
      );
      const row = statRow(m, insights.data ?? [], today);
      if (row) rows.push(row);
    }
    if (rows.length)
      sql(`insert into public.social_stats (platform, post_url, measured_on, views, reach, likes, comments, shares, saves, source)
           select platform, post_url, measured_on, views, reach, likes, comments, shares, saves, source from jsonb_to_recordset(${json(rows)})
             as r(platform text, post_url text, measured_on date, views int, reach int, likes int, comments int, shares int, saves int, source text)
           on conflict (post_url, measured_on) do update set views = excluded.views, reach = excluded.reach, likes = excluded.likes,
             comments = excluded.comments, shares = excluded.shares, saves = excluded.saves, source = excluded.source`);
    logRun("instagram", "ok", `${rows.length} posts bijgewerkt`, Date.now() - started);
  } catch (e) {
    // Token verlopen of ingetrokken: melden, maar de rest van de nachtrun gaat door
    const msg = e instanceof Error ? e.message.replace(token, "[token]") : String(e);
    console.warn("Instagram mislukt:", msg);
    logRun("instagram", "failed", msg, Date.now() - started);
  }
}
