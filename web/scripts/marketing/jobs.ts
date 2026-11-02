// Opdrachten uit het marketingdashboard uitvoeren (Studio → "Maak MP4" of "Nieuwe schermopnames").
// Draait in .github/workflows/marketing.yml (elke 10 minuten en op verzoek):
//   cd web && node --import ./tests/register.mjs scripts/marketing/jobs.ts
// Oppakken en afmelden via SUPABASE_DB_URL (private.marketing_claim_job / marketing_finish_job). Uploaden met de
// publishable key: de opslagregel staat alleen uploads toe naar jobs/<id>/ van een job die nu "bezig" is.
import { readFileSync } from "node:fs";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { execFileSync } from "node:child_process";
import { chromium } from "playwright";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "@/lib/env";
import { parseFacts } from "@/lib/marketing/facts";
import { buildVideo, FPS, SHOTS, VIDEO_FORMATS, VIDEO_TEMPLATES, type FeatureKey, type ShotKey, type VideoFormatKey, type VideoTemplate } from "@/lib/marketing/video";
import { json, logRun, sql, sqlJson } from "./db";
import { captureShots, renderVideo } from "./render";

const SITE_URL = (process.env.SITE_URL || "https://vrijstaan.nl").replace(/\/$/, "");
const MAX_JOBS = 3;

type Job = { id: string; kind: "video" | "schermopnames"; template: string | null; format: VideoFormatKey | null; props: Record<string, unknown> };
type Asset = { kind: "video" | "afbeelding" | "schermopname"; path: string; title: string; format?: string };

async function upload(path: string, body: Buffer, type: string) {
  // Proefdraaien zonder Supabase Storage: MARKETING_UPLOAD_DIR=/een/map
  if (process.env.MARKETING_UPLOAD_DIR) {
    const file = join(process.env.MARKETING_UPLOAD_DIR, path);
    await mkdir(dirname(file), { recursive: true });
    await writeFile(file, body);
    return;
  }
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/marketing/${path}`, {
    method: "POST",
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}`, "Content-Type": type, "x-upsert": "false" },
    body: new Uint8Array(body),
  });
  if (!res.ok) throw new Error(`Upload ${path} mislukt: ${res.status} ${(await res.text()).slice(0, 200)}`);
}

/** Plek voor de schermopname: met vertrektijd, prijs en foto, zodat de plekpagina laat zien wat de app kan */
const topSlug = () =>
  sql(`select slug from public.places where status = 'published' and slug is not null
       order by (departure = 'vast' and checkout_until is not null) desc, (price_eur is not null) desc, (image_url is not null) desc,
                rating_count desc nulls last, completeness desc nulls last limit 1`) || null;

async function runJob(job: Job, browser: Awaited<ReturnType<typeof chromium.launch>>): Promise<Asset[]> {
  const assets: Asset[] = [];
  if (job.kind === "schermopnames") {
    for (const s of await captureShots(SITE_URL, topSlug(), browser)) {
      const path = `jobs/${job.id}/${s.key}.png`;
      await upload(path, s.png, "image/png");
      assets.push({ kind: "schermopname", path, title: `Schermopname ${SHOTS.find((x) => x.key === s.key)?.label ?? s.key}` });
    }
    if (!assets.length) throw new Error("Geen enkele schermopname gelukt");
    return assets;
  }

  const template = job.template as VideoTemplate;
  const format = (job.format ?? "vertical") as VideoFormatKey;
  if (!(template in VIDEO_TEMPLATES) || !(format in VIDEO_FORMATS)) throw new Error(`Onbekend sjabloon of formaat: ${job.template} ${job.format}`);
  const facts = parseFacts(job.props.facts);
  if (!facts) throw new Error("De job heeft geen feiten (props.facts)");

  // Verse schermopnames voor sjablonen die de app laten zien, als data-URL in het document
  const shots: Partial<Record<ShotKey, string>> = {};
  if (VIDEO_TEMPLATES[template].shots.length) {
    for (const s of await captureShots(SITE_URL, topSlug(), browser)) shots[s.key] = `data:image/png;base64,${s.png.toString("base64")}`;
  }
  const fontUrl = `data:font/woff2;base64,${readFileSync(join(process.cwd(), "public/fonts/Geist-Variable.woff2")).toString("base64")}`;
  const { html, duration } = buildVideo(template, format, facts, {
    render: true,
    fontUrl,
    shots,
    province: typeof job.props.province === "string" ? job.props.province : undefined,
    feature: typeof job.props.feature === "string" ? (job.props.feature as FeatureKey) : undefined,
  });
  const dir = await mkdtemp(join(tmpdir(), "vrijstaan-video-"));
  const mp4 = join(dir, "video.mp4");
  await renderVideo({ html, duration, fps: FPS, width: VIDEO_FORMATS[format].w, height: VIDEO_FORMATS[format].h, out: mp4, browser });
  const base = `jobs/${job.id}/vrijstaan-${template}-${format}`;
  await upload(`${base}.mp4`, await readFile(mp4), "video/mp4");
  assets.push({ kind: "video", path: `${base}.mp4`, title: `${VIDEO_TEMPLATES[template].label} (${VIDEO_FORMATS[format].label.split(" (")[0]})`, format });

  // Omslagbeeld: het begin van de eindscène (logo en adres staan dan in beeld)
  const poster = join(dir, "poster.jpg");
  execFileSync("ffmpeg", ["-v", "error", "-y", "-ss", String(Math.max(0, duration - 2)), "-i", mp4, "-frames:v", "1", "-q:v", "3", poster]);
  await upload(`${base}.jpg`, await readFile(poster), "image/jpeg");
  assets.push({ kind: "afbeelding", path: `${base}.jpg`, title: `Omslag ${VIDEO_TEMPLATES[template].label}`, format });
  return assets;
}

async function main() {
  const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  try {
    for (let n = 0; n < MAX_JOBS; n++) {
      const job = sqlJson<Job>("select to_jsonb(j) from private.marketing_claim_job() j where j.id is not null");
      if (!job) {
        if (n === 0) console.log("Geen opdrachten.");
        break;
      }
      const started = Date.now();
      console.log(`Job ${job.id}: ${job.kind} ${job.template ?? ""} ${job.format ?? ""}`);
      try {
        const assets = await runJob(job, browser);
        sql(`select private.marketing_finish_job('${job.id}'::uuid, ${json(assets)})`);
        logRun("marketing-studio", "ok", `${job.kind} ${job.template ?? ""}: ${assets.length} bestanden`, Date.now() - started);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error(msg);
        sql(`select private.marketing_finish_job('${job.id}'::uuid, null, ${json(msg)} #>> '{}')`);
        logRun("marketing-studio", "failed", `${job.kind} ${job.template ?? ""}: ${msg}`, Date.now() - started);
      }
    }
  } finally {
    await browser.close();
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
