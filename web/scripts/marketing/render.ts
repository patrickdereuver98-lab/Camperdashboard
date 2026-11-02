// Filmpjes en schermopnames maken met Chromium (Playwright, zit al in het project) en ffmpeg (staat op de
// GitHub-runner). Gebruikt door scripts/marketing/jobs.ts.
import { spawn } from "node:child_process";
import { chromium, type Browser } from "playwright";
import { SHOTS, type ShotKey } from "@/lib/marketing/video";

/**
 * HTML met window.__video (lib/marketing/video.ts) frame voor frame vastleggen en als H.264-MP4 opslaan
 * (yuv420p, +faststart: speelt overal af, ook in Instagram en WhatsApp).
 */
export async function renderVideo(opts: { html: string; duration: number; fps: number; width: number; height: number; out: string; browser?: Browser }) {
  const browser = opts.browser ?? (await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}));
  try {
    const page = await browser.newPage({ viewport: { width: opts.width, height: opts.height }, deviceScaleFactor: 1 });
    await page.setContent(opts.html, { waitUntil: "load" });
    await page.evaluate(() => document.fonts.ready);
    const ffmpeg = spawn("ffmpeg", [
      "-y", "-loglevel", "error",
      "-f", "image2pipe", "-framerate", String(opts.fps), "-c:v", "mjpeg", "-i", "-",
      "-c:v", "libx264", "-pix_fmt", "yuv420p", "-preset", "medium", "-crf", "20", "-movflags", "+faststart",
      "-r", String(opts.fps), opts.out,
    ], { stdio: ["pipe", "inherit", "inherit"] });
    const done = new Promise<void>((resolve, reject) => {
      ffmpeg.on("error", reject);
      ffmpeg.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg stopte met code ${code}`))));
    });
    const frames = Math.round(opts.duration * opts.fps);
    for (let i = 0; i < frames; i++) {
      await page.evaluate((t) => (window as unknown as { __video: { seek: (t: number) => void } }).__video.seek(t), i / opts.fps);
      const jpg = await page.screenshot({ type: "jpeg", quality: 92 });
      if (!ffmpeg.stdin.write(jpg)) await new Promise((r) => ffmpeg.stdin.once("drain", r));
    }
    ffmpeg.stdin.end();
    await done;
    await page.close();
  } finally {
    if (!opts.browser) await browser.close();
  }
}

/**
 * Schermopnames van de live site op telefoonformaat (390 × 844, 3×). Cookiekeuze en welkomstscherm staan vooraf
 * "gezien", zodat ze niet in beeld komen. Geen account: Mijn reis toont de lege staat, nooit echte gegevens.
 */
export async function captureShots(siteUrl: string, plekSlug: string | null, browser: Browser): Promise<{ key: ShotKey; png: Buffer }[]> {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, locale: "nl-NL", colorScheme: "light" });
  // Sleutels en versies uit lib/store.ts (WELCOME_VERSION, CONSENT_VERSION); niet geïmporteerd omdat store.ts React laadt
  await ctx.addInitScript(() => {
    try {
      localStorage.setItem("vrijstaan:welkom", JSON.stringify("2026-11"));
      localStorage.setItem("vrijstaan:toestemming", JSON.stringify({ id: "schermopname", analytics: false, version: "2026-10", at: new Date().toISOString() }));
    } catch {
      // geen opslag: dan maar met banner
    }
  });
  const out: { key: ShotKey; png: Buffer }[] = [];
  for (const s of SHOTS) {
    const path = s.path === "plek" ? (plekSlug ? `/plek/${plekSlug}` : null) : s.path;
    if (!path) continue;
    const page = await ctx.newPage();
    try {
      await page.goto(`${siteUrl.replace(/\/$/, "")}${path}${path.includes("?") ? "&" : "?"}bron=schermopname`, { waitUntil: "networkidle", timeout: 45_000 });
      await page.waitForTimeout(1500); // kaarttegels en foto's
      out.push({ key: s.key, png: await page.screenshot({ type: "png" }) });
    } catch (e) {
      console.warn(`Schermopname ${path} mislukt:`, e instanceof Error ? e.message : e);
    } finally {
      await page.close();
    }
  }
  await ctx.close();
  return out;
}
