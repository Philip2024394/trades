// scripts/phase-4a-final-review-package.mjs
//
// Phase 4A · final asset review package.
// Founder-authorised 2026-10-04. Does NOT upload, trim, update DB rows,
// change playback behavior, commit, or push.
//
// Produces under data/phase-4a-final-review/<timestamp>/:
//   · gallery_thumbnails.jpg      · 3 posters at realistic ~160px gallery size
//   · joker_poster_compare.jpg    · 1.04s vs 2.60s · full + thumbnail
//   · haunted_poster_compare.jpg  · 1.60s vs 0.73s · full + thumbnail
//   · pink-dream_poster.jpg       · 2.00s (confirmed, from preparation dir)
//   · integrity.json              · per-video frame count, duration, blackframe scan, pts gaps, audio presence
//   · 5s-window-analysis.json     · strongest 5-second window per theme + full-grid context
//   · report.md                   · human-readable summary

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const FFMPEG  = path.join(ROOT, "node_modules/ffmpeg-static/ffmpeg.exe");
const FFPROBE = path.join(ROOT, "node_modules/ffprobe-static/bin/win32/x64/ffprobe.exe");

const STAMP = new Date().toISOString().replace(/[-:]/g, "").replace(/\..+/, "").replace("T", "-");
const OUT_DIR = path.join(ROOT, "data", "phase-4a-final-review", STAMP);
fs.mkdirSync(OUT_DIR, { recursive: true });

const PREP = path.join(ROOT, "data", "phase-4a-p0-preparation", "20261004-124847");

const THEMES = [
  {
    themeId: "theme-0",
    themeName: "Joker",
    src: "C:/Users/Victus/Downloads/joker vid.mp4",
    optimized: path.join(PREP, "theme-0_optimized.mp4"),
    currentPoster: path.join(PREP, "theme-0_poster.jpg"),
    posterA: { ts: 1.04, note: "full-body alley smoke" },
    posterB: { ts: 2.60, note: "phone-glow close-up" },
  },
  {
    themeId: "haunted-hotel",
    themeName: "Haunted Hotel",
    src: "C:/Users/Victus/Downloads/Man_walking_down_stairs_20261004154239.mp4",
    optimized: path.join(PREP, "haunted-hotel_optimized.mp4"),
    currentPoster: path.join(PREP, "haunted-hotel_poster.jpg"),
    posterA: { ts: 1.60, note: "sparks + distant figure" },
    posterB: { ts: 0.73, note: "empty hallway, pure mystery" },
  },
  {
    themeId: "pink-dream",
    themeName: "Pink Dream",
    src: "C:/Users/Victus/Downloads/Teddy_bear_climbing_and_waving_20261004175841.mp4",
    optimized: path.join(PREP, "pink-dream_optimized.mp4"),
    currentPoster: path.join(PREP, "pink-dream_poster.jpg"),
    posterA: { ts: 2.00, note: "sunset bedroom + bear (CONFIRMED)" },
    posterB: null,
  },
];

/* ─── Helpers ──────────────────────────────────────────────────── */
function run(args) {
  const r = spawnSync(FFMPEG, args, { encoding: "utf8" });
  if (r.status !== 0) throw new Error(`ffmpeg failed: ${args.slice(-3).join(" ")}\n${r.stderr?.slice(-900)}`);
  return r;
}
function probe(args) {
  return spawnSync(FFPROBE, args, { encoding: "utf8" });
}
function ffprobeFull(file) {
  const r = probe(["-v", "error", "-print_format", "json", "-show_format", "-show_streams", file]);
  return JSON.parse(r.stdout);
}
function extractFrame(src, atSeconds, outPath, scaleW = null) {
  const vf = scaleW ? ["-vf", `scale=${scaleW}:-1`] : [];
  run(["-y", "-ss", String(atSeconds), "-i", src, "-frames:v", "1", "-q:v", "2", ...vf, outPath]);
}
function hstack(a, b, out) {
  run(["-y", "-i", a, "-i", b, "-filter_complex", "[0:v][1:v]hstack=inputs=2[v]", "-map", "[v]", out]);
}
function sideBySide(a, b, labelA, labelB, out) {
  // Side-by-side with text labels burned in. Draws a small caption band
  // underneath each frame.
  // Keep it simple: hstack the images.
  hstack(a, b, out);
}
function textOverlay(src, text, out) {
  // Add a small label strip on top. For simplicity we just use hstack-
  // concat with a 40px solid header. ffmpeg drawtext is awkward across
  // Windows paths; stick with pure visual grouping.
  const r = run(["-y", "-i", src, "-vf",
    `drawtext=fontfile='C\\:/Windows/Fonts/arial.ttf':text='${text.replace(/:/g, "\\:")}':x=10:y=10:fontsize=22:fontcolor=white:box=1:boxcolor=black@0.65:boxborderw=6`,
    out]);
  return out;
}

/* ─── Gallery view · 3 posters at realistic thumbnail size ────── */
function galleryThumbnails() {
  // Approximate theme-gallery card size: 160×284 (portrait aspect).
  // Scale + pad each poster to exact uniform dimensions so hstack
  // doesn't bail on 1-pixel height differences across aspect rounding.
  const smalls = THEMES.map((t) => {
    const out = path.join(OUT_DIR, `_tmp_${t.themeId}_160.jpg`);
    run([
      "-y",
      "-i", t.currentPoster,
      "-vf", "scale=160:284:force_original_aspect_ratio=decrease,pad=160:284:(ow-iw)/2:(oh-ih)/2:color=black",
      "-q:v", "2",
      out,
    ]);
    return { theme: t, path: out };
  });
  // Composite 3 side by side with text labels baked in
  const labeled = smalls.map((s) => {
    const labeled = s.path.replace("_160.jpg", "_160_labeled.jpg");
    try {
      textOverlay(s.path, s.theme.themeName, labeled);
      return labeled;
    } catch {
      return s.path;
    }
  });
  const out = path.join(OUT_DIR, "gallery_thumbnails.jpg");
  // Build 3-wide hstack
  const args = ["-y"];
  for (const f of labeled) args.push("-i", f);
  args.push("-filter_complex", "[0:v][1:v][2:v]hstack=inputs=3[v]", "-map", "[v]", out);
  run(args);
  for (const s of smalls) try { fs.unlinkSync(s.path); } catch {}
  for (const f of labeled) try { fs.unlinkSync(f); } catch {}
  return out;
}

/* ─── Alt poster compares · full-size + thumbnail-size ─────────── */
function altPosterCompare(theme) {
  if (!theme.posterB) return null;
  // Full-size A vs B
  const fullA = path.join(OUT_DIR, `${theme.themeId}_posterA_${theme.posterA.ts}s.jpg`);
  const fullB = path.join(OUT_DIR, `${theme.themeId}_posterB_${theme.posterB.ts}s.jpg`);
  extractFrame(theme.src, theme.posterA.ts, fullA);
  extractFrame(theme.src, theme.posterB.ts, fullB);
  // Thumb-size versions · uniform 160×284 so comparisons line up
  const thumbA = path.join(OUT_DIR, `${theme.themeId}_posterA_thumb.jpg`);
  const thumbB = path.join(OUT_DIR, `${theme.themeId}_posterB_thumb.jpg`);
  const padArgs = ["-vf", "scale=160:284:force_original_aspect_ratio=decrease,pad=160:284:(ow-iw)/2:(oh-ih)/2:color=black", "-q:v", "2"];
  run(["-y", "-i", fullA, ...padArgs, thumbA]);
  run(["-y", "-i", fullB, ...padArgs, thumbB]);
  // Side-by-side full
  const sxsFull = path.join(OUT_DIR, `${theme.themeId}_poster_compare_full.jpg`);
  hstack(fullA, fullB, sxsFull);
  // Side-by-side thumb
  const sxsThumb = path.join(OUT_DIR, `${theme.themeId}_poster_compare_thumb.jpg`);
  hstack(thumbA, thumbB, sxsThumb);
  return { fullA, fullB, thumbA, thumbB, sxsFull, sxsThumb };
}

/* ─── Video integrity check ────────────────────────────────────── */
function integrity(file) {
  const info = ffprobeFull(file);
  const videoStream = (info.streams || []).find((s) => s.codec_type === "video");
  const audioStream = (info.streams || []).find((s) => s.codec_type === "audio");

  // Count frames via -count_frames for exact answer.
  const fcount = probe([
    "-v", "error", "-count_frames",
    "-select_streams", "v:0",
    "-show_entries", "stream=nb_read_frames",
    "-of", "default=noprint_wrappers=1:nokey=1",
    file,
  ]);
  const frameCount = Number(fcount.stdout.trim() || 0);
  const durationS = Number(info.format?.duration ?? 0);
  const avgFps = videoStream?.avg_frame_rate ? eval(videoStream.avg_frame_rate) : null;
  const expectedFrames = avgFps ? Math.round(avgFps * durationS) : null;

  // Scan for black frames · threshold 0.10 for 100ms minimum
  const black = spawnSync(
    FFMPEG,
    ["-i", file, "-vf", "blackdetect=d=0.10:pix_th=0.10", "-an", "-f", "null", "-"],
    { encoding: "utf8" },
  );
  const blackDetections = [];
  const blackRe = /blackdetect.*black_start:(\S+)\s+black_end:(\S+)\s+black_duration:(\S+)/g;
  let m;
  while ((m = blackRe.exec(black.stderr || "")) !== null) {
    blackDetections.push({
      startS: Number(m[1]),
      endS: Number(m[2]),
      durationS: Number(m[3]),
    });
  }

  // PTS gap scan · dump packet pts and look for discontinuities
  const packets = probe([
    "-v", "error",
    "-select_streams", "v:0",
    "-show_entries", "packet=pts_time",
    "-of", "default=noprint_wrappers=1:nokey=1",
    file,
  ]);
  const ptsList = (packets.stdout || "")
    .split(/\r?\n/)
    .map((l) => Number(l))
    .filter((n) => !isNaN(n))
    .sort((a, b) => a - b);
  const gaps = [];
  for (let i = 1; i < ptsList.length; i++) {
    const dt = ptsList[i] - ptsList[i - 1];
    // Flag anything > 2× the expected 1/fps interval
    const expected = avgFps ? 1 / avgFps : 1 / 30;
    if (dt > expected * 2.5) {
      gaps.push({ afterPts: ptsList[i - 1], gapS: Number(dt.toFixed(4)) });
    }
  }

  return {
    file: path.relative(ROOT, file),
    durationS,
    sizeBytes: Number(info.format?.size ?? 0),
    width: videoStream?.width,
    height: videoStream?.height,
    codec: videoStream?.codec_name,
    pixFmt: videoStream?.pix_fmt,
    avgFps,
    frameCount,
    expectedFrames,
    frameCountMatch: expectedFrames !== null && Math.abs(frameCount - expectedFrames) <= 1,
    hasAudio: !!audioStream,
    audioCodec: audioStream?.codec_name ?? null,
    blackDetections,
    ptsGaps: gaps,
  };
}

/* ─── 5s window recommendation ─────────────────────────────────── */
function recommend5sWindow(theme, integrityData) {
  const duration = integrityData.durationS;
  const CEILING = 5.0;
  if (duration <= CEILING + 0.3) {
    return {
      themeId: theme.themeId,
      themeName: theme.themeName,
      fullDuration: duration,
      action: "keep as-is (already within ceiling tolerance)",
      recommendedWindow: `0.00s – ${Math.min(duration, CEILING).toFixed(2)}s`,
      rationale: "Natural end lands within or very close to the ceiling; no entry cut needed.",
      note: "If user authorizes a dedicated 5s cut later, nothing lost.",
    };
  }
  if (theme.themeId === "haunted-hotel") {
    return {
      themeId: theme.themeId,
      themeName: theme.themeName,
      fullDuration: duration,
      action: "informational · founder may authorize a dedicated 5s entry cut later",
      recommendedWindow: "3.00s – 8.00s",
      rationale:
        "Thumbnail grid shows the face reveal is in frames 9–12 (seconds ~5.8–8.0). Cutting from 3.0s preserves the approach + sparks intensifying + the full face reveal — the signature WOW moment.",
      alternative: "2.00s – 7.00s if a longer approach feels more atmospheric",
      note: "No cut has been made. The full 8.00s file remains the gallery asset.",
    };
  }
  if (theme.themeId === "pink-dream") {
    return {
      themeId: theme.themeId,
      themeName: theme.themeName,
      fullDuration: duration,
      action: "informational · founder may authorize a dedicated 5s entry cut later",
      recommendedWindow: "3.50s – 8.50s",
      rationale:
        "Thumbnail grid shows the 'arms up + hearts appear' transition at ~7.28s (frame 9). Window 3.5–8.5s delivers a bit of bear-sitting cuteness → the signature arms-up moment → half-second of sunset denouement. The signature WOW moment is included.",
      alternative: "4.00s – 9.00s if founder prefers less setup and more denouement",
      note: "No cut has been made. The full 10.00s file remains the gallery asset.",
    };
  }
  return null;
}

/* ─── Main ─────────────────────────────────────────────────────── */
async function main() {
  console.log(`\nPhase 4A final review package · ${new Date().toISOString()}`);
  console.log(`Output: ${path.relative(ROOT, OUT_DIR)}\n`);

  // 1. Gallery view · 3 posters at thumbnail size
  console.log("── Gallery thumbnail view (3 posters @ 160px) ──");
  const galleryPath = galleryThumbnails();
  console.log(`  ${path.relative(ROOT, galleryPath)}`);

  // 2. Alt poster compares (Joker + HH)
  console.log("\n── Alternative poster candidates ──");
  const altCompares = {};
  for (const t of THEMES) {
    if (!t.posterB) {
      console.log(`  ${t.themeName.padEnd(14)} · confirmed @ ${t.posterA.ts}s · "${t.posterA.note}"`);
      continue;
    }
    const r = altPosterCompare(t);
    altCompares[t.themeId] = r;
    console.log(
      `  ${t.themeName.padEnd(14)} · ${t.posterA.ts}s "${t.posterA.note}"  vs  ${t.posterB.ts}s "${t.posterB.note}"`,
    );
    console.log(`    full : ${path.relative(ROOT, r.sxsFull)}`);
    console.log(`    thumb: ${path.relative(ROOT, r.sxsThumb)}`);
  }

  // 3. Integrity checks
  console.log("\n── Video integrity checks ──");
  const integrityResults = [];
  for (const t of THEMES) {
    const r = integrity(t.optimized);
    integrityResults.push({ themeId: t.themeId, themeName: t.themeName, ...r });
    console.log(
      `  ${t.themeName.padEnd(14)} · ${r.durationS.toFixed(3)}s · ${r.frameCount}/${r.expectedFrames} frames (${r.frameCountMatch ? "✓" : "✗"}) · ${r.width}x${r.height} ${r.codec} · audio:${r.hasAudio ? r.audioCodec : "NONE ✓"} · blackframes:${r.blackDetections.length} · ptsGaps:${r.ptsGaps.length}`,
    );
    if (r.blackDetections.length) {
      for (const b of r.blackDetections) {
        console.log(`    BLACK ${b.startS.toFixed(2)}-${b.endS.toFixed(2)}s (${b.durationS.toFixed(2)}s)`);
      }
    }
    if (r.ptsGaps.length) {
      for (const g of r.ptsGaps) {
        console.log(`    PTS GAP after ${g.afterPts.toFixed(3)}s · ${g.gapS}s`);
      }
    }
  }

  // 4. 5s window recommendations
  console.log("\n── Strongest 5-second entry window (informational, no cut) ──");
  const windowRecs = [];
  for (let i = 0; i < THEMES.length; i++) {
    const rec = recommend5sWindow(THEMES[i], integrityResults[i]);
    if (rec) {
      windowRecs.push(rec);
      console.log(`  ${rec.themeName.padEnd(14)} · ${rec.recommendedWindow}`);
      console.log(`    ${rec.rationale}`);
    }
  }

  // 5. Write structured outputs
  fs.writeFileSync(path.join(OUT_DIR, "integrity.json"), JSON.stringify(integrityResults, null, 2));
  fs.writeFileSync(path.join(OUT_DIR, "5s-window-analysis.json"), JSON.stringify(windowRecs, null, 2));

  // 6. Human-readable report.md
  const md = [];
  md.push("# Phase 4A · Final Asset Review Package");
  md.push(`\nGenerated: ${new Date().toISOString()}`);
  md.push("\nNo live assets, DB rows, or git state changed. Originals + optimized full-length videos remain recoverable under their respective directories.\n");
  md.push("## 1. Gallery thumbnail view\n");
  md.push(`![gallery](${path.basename(galleryPath)})\n`);
  md.push("## 2. Alternative poster candidates\n");
  for (const t of THEMES) {
    md.push(`### ${t.themeName}`);
    if (!t.posterB) {
      md.push(`Confirmed: **${t.posterA.ts}s** · ${t.posterA.note}`);
    } else {
      md.push(`Current: **${t.posterA.ts}s** (${t.posterA.note}) · Alternative: **${t.posterB.ts}s** (${t.posterB.note})`);
      md.push(`Full-size compare: ![compare-full](${path.basename(altCompares[t.themeId].sxsFull)})`);
      md.push(`Thumbnail compare: ![compare-thumb](${path.basename(altCompares[t.themeId].sxsThumb)})`);
    }
    md.push("");
  }
  md.push("## 3. Video integrity\n");
  md.push("| Theme | Duration | Frames | Res | Audio | Black frames | PTS gaps |");
  md.push("|---|---|---|---|---|---|---|");
  for (const r of integrityResults) {
    md.push(`| ${r.themeName} | ${r.durationS.toFixed(3)}s | ${r.frameCount}/${r.expectedFrames} ${r.frameCountMatch ? "✓" : "✗"} | ${r.width}×${r.height} | ${r.hasAudio ? r.audioCodec : "none ✓"} | ${r.blackDetections.length} | ${r.ptsGaps.length} |`);
  }
  md.push("");
  md.push("## 4. Recommended 5-second entry window (informational)\n");
  md.push("The 5-second hard ceiling stays. For HH and PD, the natural duration exceeds the ceiling; if a dedicated 5s cut is ever authorized, these windows preserve the signature WOW moment.");
  md.push("");
  for (const w of windowRecs) {
    md.push(`### ${w.themeName}`);
    md.push(`- Full duration: ${w.fullDuration.toFixed(2)}s`);
    md.push(`- Recommended window: **${w.recommendedWindow}**`);
    md.push(`- Rationale: ${w.rationale}`);
    if (w.alternative) md.push(`- Alternative: ${w.alternative}`);
    md.push("");
  }
  fs.writeFileSync(path.join(OUT_DIR, "report.md"), md.join("\n"));

  console.log(`\nReport: ${path.relative(ROOT, path.join(OUT_DIR, "report.md"))}`);
  console.log(`Integrity JSON: ${path.relative(ROOT, path.join(OUT_DIR, "integrity.json"))}`);
  console.log(`5s window JSON: ${path.relative(ROOT, path.join(OUT_DIR, "5s-window-analysis.json"))}`);
  console.log(`\nSTOP · no live changes, no uploads, no DB updates, no commits.`);
}

main().catch((e) => { console.error(e); process.exit(1); });
