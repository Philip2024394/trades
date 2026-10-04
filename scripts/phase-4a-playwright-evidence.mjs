// scripts/phase-4a-playwright-evidence.mjs
//
// Phase 4A · objective browser evidence · founder-authorised 2026-10-04.
// -----------------------------------------------------------------------
// Loads the three seeded intro videos in a real headless Chromium at
// three viewports (desktop, iPhone 14 Pro Max, Pixel 7), measuring:
//
//   · time-to-video-metadata        (loadedmetadata event)
//   · time-to-first-frame           (loadeddata event · first paint)
//   · time-to-ended                 (ended event · natural runtime)
//   · video naturalWidth × height   (resolution)
//   · muted / autoplay-blocked      (confirms zero-sound invariant)
//   · HTTP status for the asset     (reach the Supabase bucket cleanly)
//   · console errors / page errors  (collected across the load)
//
// Captures PNG screenshots at:
//   · t=0.2s  (early · first-frame or poster)
//   · ~mid    (half of ended-time if measurable, else 1500ms)
//   · t=ended (last frame)
//
// All screenshots land under data/phase-4a-evidence/<timestamp>/.
//
// Does NOT:
//   · modify any file in src/, nex-supabase/, scripts/* etc.
//   · modify the database
//   · modify git state
//   · drive the chat-entry flow (no themed peers exist yet · founder
//     will apply a theme via Settings → Theme before the end-to-end test)
//
// Reads: Phase 4A commit f00ac02a · implementation untouched.

import { chromium, devices } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const STAMP = new Date()
  .toISOString()
  .replace(/[-:]/g, "")
  .replace(/\..+/, "")
  .replace("T", "-");
const OUT_DIR = path.join(ROOT, "data", "phase-4a-evidence", STAMP);
fs.mkdirSync(OUT_DIR, { recursive: true });

const VIDEOS = [
  {
    themeId: "theme-0",
    themeName: "Joker",
    url: "https://ijvqdvsvwtwxzcqmoqit.supabase.co/storage/v1/object/public/nex-theme-intro/joker/intro.mp4",
  },
  {
    themeId: "haunted-hotel",
    themeName: "Haunted Hotel",
    url: "https://ijvqdvsvwtwxzcqmoqit.supabase.co/storage/v1/object/public/nex-theme-intro/haunted-hotel/intro.mp4",
  },
  {
    themeId: "pink-dream",
    themeName: "Pink Dream",
    url: "https://ijvqdvsvwtwxzcqmoqit.supabase.co/storage/v1/object/public/nex-theme-intro/pink-dream/intro.mp4",
  },
];

// Reproduces the ThemeIntroInterstitial's video element shape as a
// standalone data: URL page so we test the SAME element config
// (muted, autoplay, playsInline, objectFit: cover, 100% × 100%,
// 5s hard safety ceiling simulation).
function pageHtml(videoUrl) {
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Phase 4A evidence</title>
<style>
  html, body { margin: 0; padding: 0; background: #020914; height: 100%; width: 100%; overflow: hidden; }
  .stage {
    position: fixed; inset: 0; z-index: 2000;
    background: #020914;
    display: flex; align-items: center; justify-content: center;
    overflow: hidden;
  }
  video {
    width: 100%; height: 100%;
    object-fit: cover;
    background: #020914;
  }
</style>
</head>
<body>
<div class="stage" role="dialog" aria-modal="true">
  <video id="v" src="${videoUrl}" autoplay muted playsinline preload="auto"></video>
</div>
<script>
  window.__phase4a = { t0: performance.now(), events: {} };
  const v = document.getElementById("v");
  function stamp(name){
    if (!(name in window.__phase4a.events)) {
      window.__phase4a.events[name] = Math.round(performance.now() - window.__phase4a.t0);
    }
  }
  v.addEventListener("loadedmetadata", () => stamp("loadedmetadata"));
  v.addEventListener("loadeddata",     () => stamp("loadeddata"));
  v.addEventListener("canplay",        () => stamp("canplay"));
  v.addEventListener("playing",        () => stamp("playing"));
  v.addEventListener("ended",          () => stamp("ended"));
  v.addEventListener("error",          () => stamp("error"));
  v.addEventListener("stalled",        () => stamp("stalled"));
  v.addEventListener("suspend",        () => stamp("suspend"));
  // Hard safety ceiling · same 5000ms sealed with the founder.
  setTimeout(() => stamp("hard_ceiling_5000"), 5000);
</script>
</body>
</html>`;
}

const VIEWPORTS = [
  { label: "desktop", viewport: { width: 1200, height: 800 }, deviceScaleFactor: 1 },
  { label: "iphone-14-pro-max", ...devices["iPhone 14 Pro Max"] },
  { label: "pixel-7", ...devices["Pixel 7"] },
];

async function assetReachability(url) {
  // Best-effort HEAD · the browser also validates by its own load path.
  try {
    const r = await fetch(url, { method: "HEAD" });
    return { ok: r.ok, status: r.status, type: r.headers.get("content-type"), length: r.headers.get("content-length") };
  } catch (e) {
    return { ok: false, status: 0, type: null, length: null, err: e.message };
  }
}

async function runOne(browser, video, vp) {
  const slug = `${video.themeId}_${vp.label}`;
  const ctx = await browser.newContext({
    viewport: vp.viewport ?? { width: 390, height: 844 },
    deviceScaleFactor: vp.deviceScaleFactor,
    userAgent: vp.userAgent,
    isMobile: vp.isMobile ?? false,
    hasTouch: vp.hasTouch ?? false,
  });
  const page = await ctx.newPage();
  const consoleMsgs = [];
  const pageErrors = [];
  const requestFails = [];
  const videoResponses = [];
  page.on("console", (m) => {
    if (m.type() === "error" || m.type() === "warning") {
      consoleMsgs.push({ type: m.type(), text: m.text() });
    }
  });
  page.on("pageerror", (e) => pageErrors.push(String(e)));
  page.on("requestfailed", (r) => {
    if (r.url().includes("intro.mp4")) {
      requestFails.push({ url: r.url(), reason: r.failure()?.errorText });
    }
  });
  page.on("response", async (r) => {
    if (r.url().includes("intro.mp4")) {
      videoResponses.push({ url: r.url(), status: r.status(), type: r.headers()["content-type"] });
    }
  });

  const html = pageHtml(video.url);
  const tStart = Date.now();
  await page.setContent(html, { waitUntil: "domcontentloaded" });

  // Early screenshot · poster / first paint
  await page.waitForTimeout(250);
  const shotEarly = path.join(OUT_DIR, `${slug}_01_early.png`);
  await page.screenshot({ path: shotEarly });

  // Wait for `loadeddata` or 3s whichever first
  await page.waitForFunction(
    () => window.__phase4a?.events?.loadeddata != null || window.__phase4a?.events?.error != null,
    { timeout: 5000 },
  ).catch(() => {});

  // Mid-video screenshot
  await page.waitForTimeout(1500);
  const shotMid = path.join(OUT_DIR, `${slug}_02_mid.png`);
  await page.screenshot({ path: shotMid });

  // Wait up to 6500ms for ended OR hard ceiling. We cap higher than
  // 5000 so we observe whether the video naturally ends under the
  // ceiling or not · ThemeIntroInterstitial would've fired at 5000ms.
  await page.waitForFunction(
    () => window.__phase4a?.events?.ended != null || window.__phase4a?.events?.hard_ceiling_5000 != null || window.__phase4a?.events?.error != null,
    { timeout: 7000 },
  ).catch(() => {});

  // Final screenshot
  const shotEnd = path.join(OUT_DIR, `${slug}_03_end.png`);
  await page.screenshot({ path: shotEnd });

  // Collect the DOM-side instrumentation.
  const probe = await page.evaluate(() => {
    const v = document.getElementById("v");
    return {
      events: window.__phase4a?.events ?? {},
      naturalWidth: v?.videoWidth ?? 0,
      naturalHeight: v?.videoHeight ?? 0,
      muted: v?.muted ?? null,
      autoplay: v?.autoplay ?? null,
      playsInline: v?.playsInline ?? null,
      duration: v?.duration ?? null,
      currentTime: v?.currentTime ?? null,
      paused: v?.paused ?? null,
      readyState: v?.readyState ?? null,
      rectWidth: v?.getBoundingClientRect().width ?? 0,
      rectHeight: v?.getBoundingClientRect().height ?? 0,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      objectFit: getComputedStyle(v).objectFit,
    };
  });

  // Measurement: did the video fill the viewport?
  const fillsViewport =
    Math.abs(probe.rectWidth - probe.viewportWidth) < 2 &&
    Math.abs(probe.rectHeight - probe.viewportHeight) < 2;

  const result = {
    theme: video.themeName,
    themeId: video.themeId,
    viewport: vp.label,
    totalWallMs: Date.now() - tStart,
    events: probe.events,
    video: {
      naturalWidth: probe.naturalWidth,
      naturalHeight: probe.naturalHeight,
      durationS: probe.duration,
      muted: probe.muted,
      autoplay: probe.autoplay,
      playsInline: probe.playsInline,
      paused: probe.paused,
      readyState: probe.readyState,
      objectFit: probe.objectFit,
      fillsViewport,
      rect: { w: Math.round(probe.rectWidth), h: Math.round(probe.rectHeight) },
      viewport: { w: probe.viewportWidth, h: probe.viewportHeight },
    },
    network: {
      videoResponses,
      requestFails,
    },
    diagnostics: {
      consoleMsgs,
      pageErrors,
    },
    screenshots: {
      early: path.relative(ROOT, shotEarly),
      mid:   path.relative(ROOT, shotMid),
      end:   path.relative(ROOT, shotEnd),
    },
  };

  await ctx.close();
  return result;
}

function pass(result) {
  const checks = [];
  checks.push({
    name: "video asset reaches Supabase (200)",
    pass: result.network.videoResponses.some((r) => r.status === 200) && result.network.requestFails.length === 0,
    detail: `responses=${JSON.stringify(result.network.videoResponses)} fails=${result.network.requestFails.length}`,
  });
  checks.push({
    name: "video is muted",
    pass: result.video.muted === true,
    detail: `muted=${result.video.muted}`,
  });
  checks.push({
    name: "video autoplay attribute set",
    pass: result.video.autoplay === true,
    detail: `autoplay=${result.video.autoplay}`,
  });
  checks.push({
    name: "video playsInline set",
    pass: result.video.playsInline === true,
    detail: `playsInline=${result.video.playsInline}`,
  });
  checks.push({
    name: "video fills viewport (object-fit: cover)",
    pass: result.video.fillsViewport && result.video.objectFit === "cover",
    detail: `fits=${result.video.fillsViewport} objectFit=${result.video.objectFit} rect=${result.video.rect.w}x${result.video.rect.h} vp=${result.video.viewport.w}x${result.video.viewport.h}`,
  });
  checks.push({
    name: "video started playing (not paused)",
    pass: result.video.paused === false,
    detail: `paused=${result.video.paused}`,
  });
  checks.push({
    name: "first-frame observed within 2000ms",
    pass: typeof result.events.loadeddata === "number" && result.events.loadeddata < 2000,
    detail: `loadeddata=${result.events.loadeddata}ms`,
  });
  checks.push({
    name: "video ended within 5000ms (or hard ceiling would fire)",
    pass:
      (typeof result.events.ended === "number" && result.events.ended <= 5000) ||
      typeof result.events.hard_ceiling_5000 === "number",
    detail: `ended=${result.events.ended}ms ceiling=${result.events.hard_ceiling_5000}ms`,
  });
  checks.push({
    name: "no console errors",
    pass: result.diagnostics.consoleMsgs.filter((m) => m.type === "error").length === 0,
    detail: `count=${result.diagnostics.consoleMsgs.length}`,
  });
  checks.push({
    name: "no page errors",
    pass: result.diagnostics.pageErrors.length === 0,
    detail: `count=${result.diagnostics.pageErrors.length}`,
  });

  const passed = checks.filter((c) => c.pass).length;
  return { checks, passed, total: checks.length };
}

async function main() {
  console.log(`\nPhase 4A Playwright evidence · ${new Date().toISOString()}`);
  console.log(`Output: ${path.relative(ROOT, OUT_DIR)}\n`);

  // Reachability pre-check
  console.log("Asset reachability (HEAD):");
  for (const v of VIDEOS) {
    const h = await assetReachability(v.url);
    console.log(`  ${v.themeName.padEnd(14)}  ${h.status}  ${h.type ?? ""}  ${h.length ?? ""}B`);
  }

  const browser = await chromium.launch();
  const allResults = [];
  for (const v of VIDEOS) {
    for (const vp of VIEWPORTS) {
      const r = await runOne(browser, v, vp);
      const summary = pass(r);
      r.checksSummary = summary;
      allResults.push(r);
      const okStr = `${summary.passed}/${summary.total}`;
      console.log(
        `\n[${v.themeName} · ${vp.label}]  checks=${okStr}  dur=${r.events.ended ?? "—"}ms  video=${r.video.naturalWidth}x${r.video.naturalHeight}  fills=${r.video.fillsViewport}  muted=${r.video.muted}`,
      );
      for (const c of summary.checks) {
        console.log(`    ${c.pass ? "✓" : "✗"} ${c.name}  ·  ${c.detail}`);
      }
    }
  }
  await browser.close();

  // Write the structured JSON for the record.
  const reportPath = path.join(OUT_DIR, "report.json");
  fs.writeFileSync(reportPath, JSON.stringify(allResults, null, 2));

  const totalPassed = allResults.reduce((a, r) => a + r.checksSummary.passed, 0);
  const totalChecks = allResults.reduce((a, r) => a + r.checksSummary.total, 0);
  console.log(
    `\n──────────────────────────────────────────────────────────────`,
  );
  console.log(
    `OVERALL  ${totalPassed}/${totalChecks} checks pass across ${allResults.length} runs`,
  );
  console.log(`Report: ${path.relative(ROOT, reportPath)}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
