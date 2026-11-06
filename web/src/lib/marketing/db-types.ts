// Types voor migratie 20261102132558_marketing_dashboard.sql. Met de hand, omdat de migratie pas live gaat na het
// samenvoegen; weg zodra database.types.ts opnieuw gegenereerd is (zie supabase-browser.ts).
import type { Json } from "../database.types";

type Table<Row, Required extends keyof Row = never> = {
  Row: Row;
  Insert: Partial<Row> & Pick<Row, Required>;
  Update: Partial<Row>;
  Relationships: [];
};

export type Pillar = "app" | "cijfers" | "hoe" | "regio" | "doe-mee" | "nieuw";
export type Channel = "instagram" | "tiktok" | "facebook" | "google-ads";
export type ContentStatus = "idee" | "in-de-maak" | "klaar" | "geplaatst";
export type JobStatus = "wacht" | "bezig" | "klaar" | "fout";
export type VideoFormat = "vertical" | "square" | "portrait" | "landscape";

export type SeoDaily = { date: string; query: string; page: string; clicks: number; impressions: number; position: number | null };
export type SeoTotal = { date: string; device: "alle" | "mobile" | "desktop" | "tablet"; clicks: number; impressions: number; position: number | null };
export type SeoPage = { url: string; indexed: boolean | null; verdict: string | null; coverage: string | null; last_crawl: string | null; checked_at: string };
export type SeoStatus = { key: string; value: Json; checked_at: string };
export type ContentItem = {
  id: string;
  pillar: Pillar;
  channel: Channel;
  title: string;
  body: string;
  hashtags: string[];
  link: string | null;
  status: ContentStatus;
  planned_on: string | null;
  posted_url: string | null;
  posted_at: string | null;
  facts_snapshot: Json | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};
export type MarketingJob = {
  id: string;
  kind: "video" | "schermopnames";
  template: string | null;
  format: VideoFormat | null;
  props: Json;
  status: JobStatus;
  error: string | null;
  created_by: string | null;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
};
export type MarketingAsset = {
  id: string;
  kind: "video" | "afbeelding" | "schermopname";
  template: string | null;
  format: string | null;
  title: string | null;
  storage_path: string;
  job_id: string | null;
  content_item_id: string | null;
  facts_snapshot: Json | null;
  created_at: string;
};
export type Campaign = {
  id: string;
  name: string;
  channel: Channel | "flyer" | "overig";
  bron: string;
  campagne: string;
  budget_eur: number;
  spent_eur: number;
  starts_on: string | null;
  ends_on: string | null;
  notes: string | null;
  created_at: string;
};
export type SocialStat = {
  id: string;
  platform: "instagram" | "tiktok" | "facebook";
  post_url: string;
  content_item_id: string | null;
  measured_on: string;
  views: number | null;
  reach: number | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
  saves: number | null;
  source: "handmatig" | "api";
};

export type MarketingTables = {
  seo_daily: Table<SeoDaily, "date" | "query" | "page">;
  seo_totals: Table<SeoTotal, "date">;
  seo_pages: Table<SeoPage, "url">;
  seo_status: Table<SeoStatus, "key">;
  content_items: Table<ContentItem, "pillar" | "channel" | "title">;
  marketing_jobs: Table<MarketingJob, "kind">;
  marketing_assets: Table<MarketingAsset, "kind" | "storage_path">;
  campaigns: Table<Campaign, "name" | "channel" | "bron" | "campagne">;
  social_stats: Table<SocialStat, "platform" | "post_url">;
};

export type MarketingFunctions = {
  marketing_facts: { Args: never; Returns: Json };
  marketing_traffic: { Args: { p_days?: number }; Returns: Json };
  marketing_seo_rows: { Args: { p_days?: number; p_by?: "query" | "page"; p_limit?: number }; Returns: Json };
};
