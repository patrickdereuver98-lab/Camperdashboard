/**
 * Instagram Graph API → social_stats (plan §3.6, fase 4). Alleen het eigen zakelijke account; lezen kan met een app
 * in ontwikkelmodus, zonder review. Pure omzetting, het ophalen staat in scripts/marketing/instagram.ts.
 */
export type IgMedia = { id: string; permalink?: string; timestamp?: string; like_count?: number; comments_count?: number };
export type IgInsight = { name: string; values?: { value?: number }[]; total_value?: { value?: number } };

const val = (list: IgInsight[], name: string): number | null => {
  const m = list.find((i) => i.name === name);
  const v = m?.total_value?.value ?? m?.values?.[0]?.value;
  return typeof v === "number" ? v : null;
};

export function statRow(media: IgMedia, insights: IgInsight[], today: string) {
  if (!media.permalink) return null;
  return {
    platform: "instagram" as const,
    post_url: media.permalink,
    measured_on: today,
    views: val(insights, "views"),
    reach: val(insights, "reach"),
    likes: typeof media.like_count === "number" ? media.like_count : null,
    comments: typeof media.comments_count === "number" ? media.comments_count : null,
    shares: val(insights, "shares"),
    saves: val(insights, "saved"),
    source: "api" as const,
  };
}
