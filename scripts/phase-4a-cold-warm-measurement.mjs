// scripts/phase-4a-cold-warm-measurement.mjs
//
// Phase 4A · cold-cache vs warm-cache playback measurement.
// ---------------------------------------------------------
// Measures time-to-first-frame for each of the three live intro
// videos on iPhone 14 Pro Max + Pixel 7 viewports, across:
//   · cold cache  (brand-new browser context, nothing cached)
//   · warm cache  (second visit in the SAME context, HTTP cache
//                  gets a chance to serve the asset)
//
// We use `page.setContent()` with the same video element shape as
// the production ThemeIntroInterstitial. On the warm visit the
// browser issues an If-None-Match request (304 revalidation) if the
// Supabase CDN continues to serve `no-cache`, OR serves from disk
// cache without network if a longer max-age is honoured.
//
// Does NOT touch live assets, DB, or git state.

import { chromium, devices } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const STAMP = new Date().toISOString().replace(/[-:]/g, "").replace(/\..+/, "").replace("T", "-");
const OUT_DIR = path.join(ROOT, "data", "phase-4a-cold-warm", STAMP);
fs.mkdirSync(OUT_DIR, { recursive: true });

const VIDEOS = [
  { themeName: "Joker",         url: "https://ijvqdvsvwtwxzcqmoqit.supabase.co/storage/v1/object/public/nex-theme-intro/joker/intro.mp4" },
  { themeName: "Haunted Hotel", url: "https://ijvqdvsvwtwxzcqmoqit.supabase.co/storage/v1/object/public/nex-theme-intro/haunted-hotel/intro.mp4" },
  { themeName: "Pink Dream",    url: "https://ijvqdvsvwtwxzcqmoqit.supabase.co/storage/v1/object/public/nex-theme-intro/pink-dream/intro.mp4" },
];

const VIEWPORTS = [
  { label: "iphone-14-pro-max", ...devices["iPhone 14 Pro Max"] },
  { label: "pixel-7",           ...devices["Pixel 7"] },
];

function pageHtml(videoUrl) {
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/></head>
<body style="margin:0;background:#020914;height:100vh;width:100vw;">
<video id="v" src="${videoUrl}" autoplay muted playsinline preload="auto"
       style="width:100%;height:100%;object-fit:cover;background:#020914;"></video>
<script>
  window.__m = { t0: performance.now(), ev: {} };
  const v = document.getElementById("v");
  function s(n){ if (!(n in window.__m.ev)) window.__m.ev[n] = Math.round(performance.now() - window.__m.t0); }
  v.addEventListener("loadedmetadata", () => s("loadedmetadata"));
  v.addEventListener("loadeddata",     () => s("loadeddata"));
  v.addEventListener("canplay",        () => s("canplay"));
  v.addEventListener("playing",        () => s("playing"));
  v.addEventListener("ended",          () => s("ended"));
  v.addEventListener("error",          () => s("error"));
</script>
</body></html>`;
}

async function visit(ctx, url, label) {
  const page = await ctx.newPage();
  const requests = [];
  page.on("response", async (r) => {
    if (r.url().startsWith(url.split("?")[0])) {
      requests.push({
        status: r.status(),
        fromCache: r.fromServiceWorker() || false,
        requestHeaders: await r.request().allHeaders().catch(() => ({})),
        responseHeaders: r.headers(),
      });
    }
  });
  const html = pageHtml(url);
  const t0 = Date.now();
  await page.setContent(html, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(
    () => window.__m?.ev?.loadeddata != null || window.__m?.ev?.error != null,
    { timeout: 10000 },
  ).catch(() => {});
  const ev = await page.evaluate(() => window.__m?.ev ?? {});
  const wall = Date.now() - t0;
  await page.close();
  return { label, wall, events: ev, requests };
}

async function runCombo(browser, video, vp) {
  // Single context · cold then warm within the SAME context. The
  // browser's HTTP cache persists between page loads in the same
  // context, which is the real-user return-visit scenario.
  const ctx = await browser.newContext({
    viewport: vp.viewport ?? { width: 390, height: 844 },
    deviceScaleFactor: vp.deviceScaleFactor,
    userAgent: vp.userAgent,
    isMobile: vp.isMobile ?? false,
    hasTouch: vp.hasTouch ?? false,
  });

  // Cold visit · fresh context, nothing cached
  const cold = await visit(ctx, video.url, "cold");

  // Warm visit · same context, HTTP cache should intervene
  const warm = await visit(ctx, video.url, "warm");

  await ctx.close();
  return { cold, warm };
}

async function main() {
  console.log(`\nPhase 4A cold vs warm playback measurement`);
  console.log(`Output: ${path.relative(ROOT, OUT_DIR)}\n`);

  const browser = await chromium.launch();
  const results = [];
  for (const vp of VIEWPORTS) {
    console.log(`\n═ Viewport · ${vp.label}`);
    for (const video of VIDEOS) {
      const { cold, warm } = await runCombo(browser, video, vp);
      const coldFF = cold.events.loadeddata ?? "none";
      const warmFF = warm.events.loadeddata ?? "none";
      const speedup = (typeof coldFF === "number" && typeof warmFF === "number")
        ? `${coldFF - warmFF}ms faster  (${(((coldFF - warmFF) / coldFF) * 100).toFixed(0)}%)`
        : "n/a";
      const warmReq = warm.requests[0] ?? null;
      const coldReq = cold.requests[0] ?? null;
      console.log(
        `  ${video.themeName.padEnd(14)}  cold firstFrame=${coldFF}ms  warm firstFrame=${warmFF}ms  Δ=${speedup}`,
      );
      console.log(
        `    cold ${cold.requests.length} req(s) · first status=${coldReq?.status} CF=${coldReq?.responseHeaders?.["cf-cache-status"]}`,
      );
      console.log(
        `    warm ${warm.requests.length} req(s) · first status=${warmReq?.status} CF=${warmReq?.responseHeaders?.["cf-cache-status"]}  ifNoneMatch=${warmReq?.requestHeaders?.["if-none-match"] ? "yes" : "no"}  fromCache=${warmReq?.fromCache}`,
      );
      results.push({
        themeName: video.themeName,
        viewport: vp.label,
        cold: { wall: cold.wall, events: cold.events, requestCount: cold.requests.length, firstRequestStatus: coldReq?.status, firstResponseHeaders: coldReq?.responseHeaders },
        warm: { wall: warm.wall, events: warm.events, requestCount: warm.requests.length, firstRequestStatus: warmReq?.status, firstResponseHeaders: warmReq?.responseHeaders, ifNoneMatchSent: !!warmReq?.requestHeaders?.["if-none-match"] },
      });
    }
  }
  await browser.close();

  const reportPath = path.join(OUT_DIR, "report.json");
  fs.writeFileSync(reportPath, JSON.stringify(results, null, 2));
  console.log(`\nReport: ${path.relative(ROOT, reportPath)}`);

  // Summary table
  console.log(`\n── Summary · first-frame latency ms (lower = faster)`);
  console.log(`theme           viewport              cold    warm    Δ`);
  for (const r of results) {
    const c = r.cold.events.loadeddata ?? "n/a";
    const w = r.warm.events.loadeddata ?? "n/a";
    const d = (typeof c === "number" && typeof w === "number") ? `${c - w}ms` : "n/a";
    console.log(`  ${r.themeName.padEnd(14)} ${r.viewport.padEnd(20)}  ${String(c).padStart(5)}  ${String(w).padStart(5)}  ${d}`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
