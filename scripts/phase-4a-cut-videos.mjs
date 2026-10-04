// scripts/phase-4a-cut-videos.mjs
//
// Phase 4A · trim theme intro videos to fit the sealed 5-second ceiling.
// Founder-authorised 2026-10-04.
//
// Uses the ffmpeg-static + ffprobe-static binaries that already ship in
// node_modules · no system installs required.
//
// Inputs (originals, from your Downloads folder):
//   Joker          · joker vid.mp4
//   Haunted Hotel  · Man_walking_down_stairs_20261004154239.mp4
//   Pink Dream     · Teddy_bear_climbing_and_waving_20261004175841.mp4
//
// Outputs (to data/phase-4a-video-cuts/<timestamp>/):
//   · <theme>_intro_5s.mp4   · the trimmed candidate, h264 + no audio
//   · <theme>_grid.jpg       · 12-frame thumbnail montage (HH + PD only)
//   · report.json            · durations + resolutions + sizes
//
// Does NOT upload. Does NOT touch the live Supabase bucket. Does NOT
// modify the DB. The founder reviews the candidate files before any
// re-upload is authorised.
//
// Trim defaults:
//   Joker          · 0.00s – 4.90s   (saves 0.28s · keeps nearly all)
//   Haunted Hotel  · 0.00s – 5.00s   (first 5s · founder re-cuts if needed)
//   Pink Dream     · 0.00s – 5.00s   (first 5s · founder re-cuts if needed)
//
// Re-encode settings (quality > file size · WOW matters):
//   · video: libx264 crf 20 preset slow (visually transparent · low banding)
//   · scale: original resolution preserved
//   · audio: stripped (-an · videos play muted anyway)
//   · pix_fmt: yuv420p for max player compatibility
//   · faststart: moov box up front · faster first-frame on streaming

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const FFMPEG  = path.join(ROOT, "node_modules/ffmpeg-static/ffmpeg.exe");
const FFPROBE = path.join(ROOT, "node_modules/ffprobe-static/bin/win32/x64/ffprobe.exe");

const STAMP = new Date().toISOString().replace(/[-:]/g, "").replace(/\..+/, "").replace("T", "-");
const OUT_DIR = path.join(ROOT, "data", "phase-4a-video-cuts", STAMP);
fs.mkdirSync(OUT_DIR, { recursive: true });

const JOBS = [
  {
    themeId: "theme-0",
    themeName: "Joker",
    src: "C:/Users/Victus/Downloads/joker vid.mp4",
    start: 0,
    duration: 4.9,
    needsGrid: false, // 5.18s original · nothing meaningful to pick
  },
  {
    themeId: "haunted-hotel",
    themeName: "Haunted Hotel",
    src: "C:/Users/Victus/Downloads/Man_walking_down_stairs_20261004154239.mp4",
    start: 0,
    duration: 5.0,
    needsGrid: true, // 8s original · founder may want a different window
  },
  {
    themeId: "pink-dream",
    themeName: "Pink Dream",
    src: "C:/Users/Victus/Downloads/Teddy_bear_climbing_and_waving_20261004175841.mp4",
    start: 0,
    duration: 5.0,
    needsGrid: true, // 10s original · founder may want a different window
  },
];

function ffprobeInspect(file) {
  const r = spawnSync(
    FFPROBE,
    [
      "-v", "error",
      "-print_format", "json",
      "-show_format",
      "-show_streams",
      file,
    ],
    { encoding: "utf8" },
  );
  if (r.status !== 0) throw new Error(`ffprobe failed on ${file}: ${r.stderr}`);
  const j = JSON.parse(r.stdout);
  const v = (j.streams || []).find((s) => s.codec_type === "video");
  return {
    durationS: Number(j.format?.duration ?? 0),
    sizeBytes: Number(j.format?.size ?? 0),
    width: Number(v?.width ?? 0),
    height: Number(v?.height ?? 0),
    codec: v?.codec_name ?? "?",
    pixFmt: v?.pix_fmt ?? "?",
    frameRate: v?.avg_frame_rate ?? "?",
  };
}

function trim(job) {
  const outPath = path.join(OUT_DIR, `${job.themeId}_intro_5s.mp4`);
  const args = [
    "-y",
    "-ss", String(job.start),
    "-i", job.src,
    "-t", String(job.duration),
    "-c:v", "libx264",
    "-crf", "20",
    "-preset", "slow",
    "-pix_fmt", "yuv420p",
    "-movflags", "+faststart",
    "-an",
    outPath,
  ];
  const r = spawnSync(FFMPEG, args, { encoding: "utf8" });
  if (r.status !== 0) throw new Error(`ffmpeg trim failed for ${job.themeId}: ${r.stderr?.slice(-800)}`);
  return outPath;
}

function thumbnailGrid(job) {
  // 12 evenly-spaced frames across the ORIGINAL (pre-trim) video so
  // the founder can see what moment lives at every second and decide
  // whether 0-5s is the right window or they want a different cut.
  const probe = ffprobeInspect(job.src);
  const n = 12;
  const outPath = path.join(OUT_DIR, `${job.themeId}_grid.jpg`);
  // tile=4x3 · each frame scaled to 320px wide · fps selects n evenly
  // spaced frames across the clip.
  const fps = n / probe.durationS;
  const args = [
    "-y",
    "-i", job.src,
    "-vf", `fps=${fps.toFixed(4)},scale=320:-1,tile=4x3`,
    "-frames:v", "1",
    "-q:v", "3",
    outPath,
  ];
  const r = spawnSync(FFMPEG, args, { encoding: "utf8" });
  if (r.status !== 0) throw new Error(`ffmpeg grid failed for ${job.themeId}: ${r.stderr?.slice(-800)}`);
  // Also emit a per-second label mapping · tells the founder "frame N is
  // at approx time T" so they can pick a precise in-point.
  const labels = Array.from({ length: n }, (_, i) => {
    const t = (i / (n - 1)) * probe.durationS;
    return { frame: i + 1, approxTimeS: Number(t.toFixed(2)) };
  });
  return { outPath, labels, originalDuration: probe.durationS };
}

const results = [];
console.log(`\nPhase 4A video cuts · ${new Date().toISOString()}`);
console.log(`Output: ${path.relative(ROOT, OUT_DIR)}\n`);

for (const job of JOBS) {
  console.log(`── ${job.themeName} ──`);
  if (!fs.existsSync(job.src)) {
    console.error(`  SKIP · source missing: ${job.src}`);
    results.push({ ...job, ok: false, err: "source missing" });
    continue;
  }
  const srcProbe = ffprobeInspect(job.src);
  console.log(`  source  · ${srcProbe.durationS.toFixed(2)}s · ${srcProbe.width}x${srcProbe.height} · ${(srcProbe.sizeBytes / 1024 / 1024).toFixed(2)} MB · ${srcProbe.codec}`);

  const outPath = trim(job);
  const outProbe = ffprobeInspect(outPath);
  console.log(`  cut     · ${outProbe.durationS.toFixed(2)}s · ${outProbe.width}x${outProbe.height} · ${(outProbe.sizeBytes / 1024 / 1024).toFixed(2)} MB · window ${job.start.toFixed(2)}-${(job.start + job.duration).toFixed(2)}s`);
  console.log(`  → ${path.relative(ROOT, outPath)}`);

  let grid = null;
  if (job.needsGrid) {
    grid = thumbnailGrid(job);
    console.log(`  grid    · ${path.relative(ROOT, grid.outPath)} · 12 frames (1 per ~${(grid.originalDuration / 11).toFixed(2)}s)`);
  }

  results.push({
    themeId: job.themeId,
    themeName: job.themeName,
    source: {
      path: job.src,
      duration: srcProbe.durationS,
      resolution: `${srcProbe.width}x${srcProbe.height}`,
      sizeMB: Number((srcProbe.sizeBytes / 1024 / 1024).toFixed(2)),
    },
    cut: {
      path: path.relative(ROOT, outPath),
      duration: outProbe.durationS,
      resolution: `${outProbe.width}x${outProbe.height}`,
      sizeMB: Number((outProbe.sizeBytes / 1024 / 1024).toFixed(2)),
      window: `${job.start.toFixed(2)}s – ${(job.start + job.duration).toFixed(2)}s`,
      underCeiling: outProbe.durationS <= 5.0,
    },
    thumbnailGrid: grid
      ? { path: path.relative(ROOT, grid.outPath), labels: grid.labels }
      : null,
  });
  console.log("");
}

fs.writeFileSync(path.join(OUT_DIR, "report.json"), JSON.stringify(results, null, 2));
console.log(`Report: ${path.relative(ROOT, path.join(OUT_DIR, "report.json"))}`);
console.log(`\nAll under-ceiling: ${results.every((r) => r.cut?.underCeiling)}`);
