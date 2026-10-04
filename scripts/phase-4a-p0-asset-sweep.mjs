// scripts/phase-4a-p0-asset-sweep.mjs
//
// Phase 4A · P0 asset optimization · controlled preparation.
// -----------------------------------------------------------
// Founder-authorised 2026-10-04. Does NOT touch live assets, DB, or
// routes. Produces evidence files only · stops before any upload or
// row update.
//
// Outputs: data/phase-4a-p0-preparation/<timestamp>/
//   · <theme>_optimized.mp4
//   · <theme>_poster.jpg
//   · <theme>_compare_<ts>_orig.jpg      (full-size frame from original)
//   · <theme>_compare_<ts>_opt.jpg       (same-timestamp frame from optimized)
//   · <theme>_grid_original.jpg          (12-frame survey for poster-pick)
//   · cache_headers.json                 (cold + repeat + range + ETag probe)
//   · report.json                        (full structured report)
//
// Preserves originals · uses only ffmpeg-static + ffprobe-static from
// node_modules · no system installs.

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const FFMPEG  = path.join(ROOT, "node_modules/ffmpeg-static/ffmpeg.exe");
const FFPROBE = path.join(ROOT, "node_modules/ffprobe-static/bin/win32/x64/ffprobe.exe");

const STAMP = new Date().toISOString().replace(/[-:]/g, "").replace(/\..+/, "").replace("T", "-");
const OUT_DIR = path.join(ROOT, "data", "phase-4a-p0-preparation", STAMP);
fs.mkdirSync(OUT_DIR, { recursive: true });

const THEMES = [
  {
    themeId: "theme-0",
    themeName: "Joker",
    src: "C:/Users/Victus/Downloads/joker vid.mp4",
    liveUrl: "https://ijvqdvsvwtwxzcqmoqit.supabase.co/storage/v1/object/public/nex-theme-intro/joker/intro.mp4",
    posterPickHint: "early establishing · pre-reveal", // used only for inline docs
  },
  {
    themeId: "haunted-hotel",
    themeName: "Haunted Hotel",
    src: "C:/Users/Victus/Downloads/Man_walking_down_stairs_20261004154239.mp4",
    liveUrl: "https://ijvqdvsvwtwxzcqmoqit.supabase.co/storage/v1/object/public/nex-theme-intro/haunted-hotel/intro.mp4",
    posterPickHint: "sparks mid-hallway · atmospheric, no face-reveal spoiler",
  },
  {
    themeId: "pink-dream",
    themeName: "Pink Dream",
    src: "C:/Users/Victus/Downloads/Teddy_bear_climbing_and_waving_20261004175841.mp4",
    liveUrl: "https://ijvqdvsvwtwxzcqmoqit.supabase.co/storage/v1/object/public/nex-theme-intro/pink-dream/intro.mp4",
    posterPickHint: "sunset bedroom with bear · establishes identity · pre-tada",
  },
];

/* ─── ffprobe probe ─────────────────────────────────────────────── */
function ffprobe(file) {
  const r = spawnSync(
    FFPROBE,
    ["-v", "error", "-print_format", "json", "-show_format", "-show_streams", file],
    { encoding: "utf8" },
  );
  if (r.status !== 0) throw new Error(`ffprobe ${file}: ${r.stderr}`);
  const j = JSON.parse(r.stdout);
  const v = (j.streams || []).find((s) => s.codec_type === "video");
  const a = (j.streams || []).find((s) => s.codec_type === "audio");
  return {
    durationS: Number(j.format?.duration ?? 0),
    sizeBytes: Number(j.format?.size ?? 0),
    bitRate: Number(j.format?.bit_rate ?? 0),
    width: Number(v?.width ?? 0),
    height: Number(v?.height ?? 0),
    videoCodec: v?.codec_name ?? null,
    pixFmt: v?.pix_fmt ?? null,
    frameRate: v?.avg_frame_rate ?? null,
    audioCodec: a?.codec_name ?? null,
    hasAudio: !!a,
  };
}

/* ─── faststart check (moov position in first 1MB) ─────────────── */
function faststart(file) {
  const fh = fs.openSync(file, "r");
  const buf = Buffer.alloc(1024 * 1024);
  const n = fs.readSync(fh, buf, 0, buf.length, 0);
  fs.closeSync(fh);
  const slice = buf.subarray(0, n);
  const moov = slice.indexOf(Buffer.from("moov"));
  const mdat = slice.indexOf(Buffer.from("mdat"));
  if (moov === -1) return { faststart: false, moov: -1, mdat };
  if (mdat === -1) return { faststart: true, moov, mdat: -1 };
  return { faststart: moov < mdat, moov, mdat };
}

/* ─── Re-encode: preserve duration + resolution, strip audio ───── */
function reencode(job) {
  const outPath = path.join(OUT_DIR, `${job.themeId}_optimized.mp4`);
  const args = [
    "-y",
    "-i", job.src,
    "-c:v", "libx264",
    "-crf", "23",
    "-preset", "slow",
    "-pix_fmt", "yuv420p",
    "-movflags", "+faststart",
    "-an",
    outPath,
  ];
  const r = spawnSync(FFMPEG, args, { encoding: "utf8" });
  if (r.status !== 0) throw new Error(`ffmpeg encode ${job.themeId}: ${r.stderr?.slice(-900)}`);
  return outPath;
}

/* ─── Grid of 12 frames across the full source · poster picker ──── */
function thumbnailGrid(job) {
  const probe = ffprobe(job.src);
  const n = 12;
  const outPath = path.join(OUT_DIR, `${job.themeId}_grid_original.jpg`);
  const fps = n / probe.durationS;
  const r = spawnSync(
    FFMPEG,
    [
      "-y",
      "-i", job.src,
      "-vf", `fps=${fps.toFixed(4)},scale=320:-1,tile=4x3`,
      "-frames:v", "1",
      "-q:v", "3",
      outPath,
    ],
    { encoding: "utf8" },
  );
  if (r.status !== 0) throw new Error(`ffmpeg grid ${job.themeId}: ${r.stderr?.slice(-900)}`);
  return {
    path: outPath,
    frameTimestamps: Array.from({ length: n }, (_, i) => Number(((i / (n - 1)) * probe.durationS).toFixed(2))),
  };
}

/* ─── Poster: extract 1 JPEG from a specific timestamp ─────────── */
function poster(job, atSeconds) {
  const outPath = path.join(OUT_DIR, `${job.themeId}_poster.jpg`);
  const r = spawnSync(
    FFMPEG,
    [
      "-y",
      "-ss", String(atSeconds),
      "-i", job.src,
      "-frames:v", "1",
      "-q:v", "4", // high JPEG quality
      outPath,
    ],
    { encoding: "utf8" },
  );
  if (r.status !== 0) throw new Error(`ffmpeg poster ${job.themeId}: ${r.stderr?.slice(-900)}`);
  const st = fs.statSync(outPath);
  // probe to get resolution
  const r2 = spawnSync(
    FFPROBE,
    ["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height", "-of", "default=noprint_wrappers=1", outPath],
    { encoding: "utf8" },
  );
  const wM = /width=(\d+)/.exec(r2.stdout);
  const hM = /height=(\d+)/.exec(r2.stdout);
  return {
    path: outPath,
    sizeBytes: st.size,
    width: wM ? Number(wM[1]) : 0,
    height: hM ? Number(hM[1]) : 0,
    atSeconds,
  };
}

/* ─── Same-timestamp side-by-side frames · visual quality check ── */
function compareFrame(job, atSeconds, optimizedPath) {
  const origOut = path.join(OUT_DIR, `${job.themeId}_compare_${atSeconds.toFixed(1)}_orig.jpg`);
  const optOut  = path.join(OUT_DIR, `${job.themeId}_compare_${atSeconds.toFixed(1)}_opt.jpg`);
  for (const [src, out] of [[job.src, origOut], [optimizedPath, optOut]]) {
    const r = spawnSync(
      FFMPEG,
      ["-y", "-ss", String(atSeconds), "-i", src, "-frames:v", "1", "-q:v", "2", out],
      { encoding: "utf8" },
    );
    if (r.status !== 0) throw new Error(`ffmpeg compare ${src}: ${r.stderr?.slice(-900)}`);
  }
  return {
    atSeconds,
    original: { path: origOut, sizeBytes: fs.statSync(origOut).size },
    optimized: { path: optOut, sizeBytes: fs.statSync(optOut).size },
  };
}

/* ─── Cache-header probe · cold + repeat ──────────────────────── */
async function cacheHeaderProbe(url) {
  const headerRow = (res) => ({
    status: res.status,
    cacheControl: res.headers.get("cache-control"),
    cfCacheStatus: res.headers.get("cf-cache-status"),
    age: res.headers.get("age"),
    etag: res.headers.get("etag"),
    contentLength: res.headers.get("content-length"),
    contentType: res.headers.get("content-type"),
    acceptRanges: res.headers.get("accept-ranges"),
    vary: res.headers.get("vary"),
    cacheTag: res.headers.get("cache-tag"),
    lastModified: res.headers.get("last-modified"),
    expires: res.headers.get("expires"),
    xCacheHits: res.headers.get("x-cache"),
    cf: res.headers.get("cf-ray"),
  });
  const results = { url };
  // Cold: force cache busting on the client side
  const bustUrl = `${url}?__cb=${Date.now()}`;
  const t1 = Date.now();
  const r1 = await fetch(bustUrl, { method: "HEAD" });
  results.coldHead = { ms: Date.now() - t1, ...headerRow(r1) };
  // Repeat without buster (CDN warm)
  const t2 = Date.now();
  const r2 = await fetch(url, { method: "HEAD" });
  results.warmHead = { ms: Date.now() - t2, ...headerRow(r2) };
  // Third request to see Age increase
  const t3 = Date.now();
  const r3 = await fetch(url, { method: "HEAD" });
  results.warmHead2 = { ms: Date.now() - t3, ...headerRow(r3) };
  // GET with ETag conditional
  if (r2.headers.get("etag")) {
    const t4 = Date.now();
    const r4 = await fetch(url, {
      method: "GET",
      headers: { "If-None-Match": r2.headers.get("etag") },
    });
    results.ifNoneMatch = {
      ms: Date.now() - t4,
      status: r4.status,
      // 304 would prove ETag conditional revalidation works
      cfCacheStatus: r4.headers.get("cf-cache-status"),
    };
  }
  // Range request to verify 206 Partial Content
  const t5 = Date.now();
  const r5 = await fetch(url, {
    method: "GET",
    headers: { Range: "bytes=0-1023" },
  });
  results.rangeFirstKB = {
    ms: Date.now() - t5,
    status: r5.status,
    contentRange: r5.headers.get("content-range"),
    contentLength: r5.headers.get("content-length"),
  };
  return results;
}

/* ─── Main sweep ─────────────────────────────────────────────── */
async function main() {
  console.log(`\nPhase 4A P0 asset sweep · ${new Date().toISOString()}`);
  console.log(`Output: ${path.relative(ROOT, OUT_DIR)}\n`);

  const results = [];
  for (const job of THEMES) {
    console.log(`── ${job.themeName} ──`);
    if (!fs.existsSync(job.src)) {
      console.error(`  SKIP · source missing: ${job.src}`);
      continue;
    }

    const origProbe = ffprobe(job.src);
    const origFast = faststart(job.src);
    console.log(
      `  original  · ${origProbe.durationS.toFixed(2)}s · ${origProbe.width}x${origProbe.height} · ${(origProbe.sizeBytes / 1024 / 1024).toFixed(2)} MB · ${origProbe.videoCodec} · bitrate ${Math.round(origProbe.bitRate / 1000)}k · audio:${origProbe.audioCodec ?? "none"} · faststart:${origFast.faststart}`,
    );

    const optimizedPath = reencode(job);
    const optProbe = ffprobe(optimizedPath);
    const optFast = faststart(optimizedPath);
    console.log(
      `  optimized · ${optProbe.durationS.toFixed(2)}s · ${optProbe.width}x${optProbe.height} · ${(optProbe.sizeBytes / 1024 / 1024).toFixed(2)} MB · ${optProbe.videoCodec} · bitrate ${Math.round(optProbe.bitRate / 1000)}k · audio:${optProbe.audioCodec ?? "none"} · faststart:${optFast.faststart}`,
    );
    const sizeDelta = (((optProbe.sizeBytes - origProbe.sizeBytes) / origProbe.sizeBytes) * 100).toFixed(1);
    console.log(`  size Δ    · ${sizeDelta}%`);

    // Thumbnail grid of the ORIGINAL for poster-pick + visual QA
    const grid = thumbnailGrid(job);
    console.log(`  grid      · ${path.relative(ROOT, grid.path)} · 12 frames at ${grid.frameTimestamps.join("s, ")}s`);

    // Pick poster timestamp per hint. For now: 20% through the video
    // (early establishing shot · see posterPickHint).
    // The founder will review the grid and tell us if a different
    // timestamp is preferred before this becomes a live asset.
    const posterTs = Number((origProbe.durationS * 0.20).toFixed(2));
    const posterFile = poster(job, posterTs);
    console.log(
      `  poster    · ${path.relative(ROOT, posterFile.path)} · ${posterFile.width}x${posterFile.height} · ${(posterFile.sizeBytes / 1024).toFixed(1)} KB · at ${posterTs}s · hint: "${job.posterPickHint}"`,
    );

    // Visual quality comparison · same-timestamp frames from original
    // and optimized at 20%, 50%, 80% of the video.
    const compareFrames = [];
    for (const pct of [0.20, 0.50, 0.80]) {
      const ts = Number((origProbe.durationS * pct).toFixed(2));
      const cf = compareFrame(job, ts, optimizedPath);
      compareFrames.push(cf);
    }
    console.log(`  compare   · 3 × same-ts frames (orig vs optimized) at ${compareFrames.map((c) => c.atSeconds + "s").join(", ")}`);

    // Cache-header probe · live URL
    const cacheProbe = await cacheHeaderProbe(job.liveUrl);
    console.log(
      `  cache HEAD · cold Cache-Control="${cacheProbe.coldHead.cacheControl}" cf="${cacheProbe.coldHead.cfCacheStatus}" age="${cacheProbe.coldHead.age}" / warm cf="${cacheProbe.warmHead.cfCacheStatus}" age="${cacheProbe.warmHead.age}" / 304test=${cacheProbe.ifNoneMatch?.status}`,
    );

    results.push({
      themeId: job.themeId,
      themeName: job.themeName,
      srcPath: job.src,
      liveUrl: job.liveUrl,
      original: { ...origProbe, faststart: origFast.faststart, moovOffset: origFast.moov, mdatOffset: origFast.mdat },
      optimized: {
        path: path.relative(ROOT, optimizedPath),
        ...optProbe,
        faststart: optFast.faststart,
        moovOffset: optFast.moov,
        mdatOffset: optFast.mdat,
        sizeDeltaPct: Number(sizeDelta),
      },
      poster: {
        ...posterFile,
        path: path.relative(ROOT, posterFile.path),
      },
      grid: {
        path: path.relative(ROOT, grid.path),
        frameTimestamps: grid.frameTimestamps,
      },
      compareFrames: compareFrames.map((c) => ({
        atSeconds: c.atSeconds,
        original: { path: path.relative(ROOT, c.original.path), sizeBytes: c.original.sizeBytes },
        optimized: { path: path.relative(ROOT, c.optimized.path), sizeBytes: c.optimized.sizeBytes },
      })),
      cacheHeaders: cacheProbe,
    });
    console.log("");
  }

  fs.writeFileSync(path.join(OUT_DIR, "report.json"), JSON.stringify(results, null, 2));
  console.log(`\nReport: ${path.relative(ROOT, path.join(OUT_DIR, "report.json"))}`);
  console.log(`\nTotal size: original ${(results.reduce((a, r) => a + r.original.sizeBytes, 0) / 1024 / 1024).toFixed(2)} MB → optimized ${(results.reduce((a, r) => a + r.optimized.sizeBytes, 0) / 1024 / 1024).toFixed(2)} MB`);
  console.log(`\nSTOP · live assets, DB rows, and git state unchanged.`);
  console.log(`Next step requires founder authorization to upload optimized assets and set intro_poster_url.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
