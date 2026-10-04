// scripts/phase-4a-live-replacement.mjs
//
// Phase 4A · controlled live asset replacement.
// Founder-authorised 2026-10-04.
//
// Sequence:
//   1. Download current live videos to a rollback backup.
//   2. Extract the Joker 2.60s poster from the original source.
//   3. Upload the three optimized MP4s to their EXISTING paths
//      (upsert · URLs do not change · intro_video_url rows stay).
//   4. Upload the three posters to nex-theme-intro/<theme>/poster.jpg
//      (new objects · adjacent to intro.mp4).
//   5. UPDATE nex_chat_theme.intro_poster_url for exactly 3 rows.
//      intro_video_url + intro_duration_ms untouched.
//   6. Verify: HEAD headers, byte-range probe, download + ffprobe,
//      DB row state, playback via Playwright, owner-bypass regression.
//
// Hard boundaries (sealed · do not relax):
//   · No schema migration · no new columns · no new tables
//   · No change to 5s ceiling, owner bypass, seen-state, or chat-entry
//   · No code change in src/ · no commit · no push
//   · Do not delete the originals in Downloads/
//   · If any step fails, STOP and report · do NOT attempt rollback
//     without explicit authorization
//
// All non-DB outputs land under data/phase-4a-live-replacement/<ts>/

import { spawnSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const FFMPEG  = path.join(ROOT, "node_modules/ffmpeg-static/ffmpeg.exe");
const FFPROBE = path.join(ROOT, "node_modules/ffprobe-static/bin/win32/x64/ffprobe.exe");

function loadEnv() {
  const raw = fs.readFileSync(path.join(ROOT, ".env.local"), "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const m = /^([A-Z0-9_]+)=(.*)$/.exec(line);
    if (m) process.env[m[1]] ??= m[2];
  }
}
loadEnv();

const SB_URL = process.env.NEXT_PUBLIC_NEX_SUPABASE_URL;
const SB_KEY = process.env.NEX_SUPABASE_SERVICE_ROLE_KEY;
if (!SB_URL || !SB_KEY) throw new Error("Missing NEX Supabase env");

const sb = createClient(SB_URL, SB_KEY, { auth: { persistSession: false } });

const BUCKET = "nex-theme-intro";
const STAMP = new Date().toISOString().replace(/[-:]/g, "").replace(/\..+/, "").replace("T", "-");
const OUT_DIR = path.join(ROOT, "data", "phase-4a-live-replacement", STAMP);
const BACKUP_DIR = path.join(OUT_DIR, "backup");
fs.mkdirSync(BACKUP_DIR, { recursive: true });

// Preparation dir where the P0 optimized MP4s + posters live.
const PREP = path.join(ROOT, "data", "phase-4a-p0-preparation", "20261004-124847");

const JOBS = [
  {
    themeId: "theme-0",
    themeName: "Joker",
    storageSlug: "joker",
    videoLocal: path.join(PREP, "theme-0_optimized.mp4"),
    // Joker poster: founder picked 2.60s · must be newly extracted
    // because the P0 sweep produced 1.04s only.
    posterLocal: null, // extracted below
    posterExtractFrom: "C:/Users/Victus/Downloads/joker vid.mp4",
    posterAtSeconds: 2.60,
  },
  {
    themeId: "haunted-hotel",
    themeName: "Haunted Hotel",
    storageSlug: "haunted-hotel",
    videoLocal: path.join(PREP, "haunted-hotel_optimized.mp4"),
    // Founder confirmed the 1.60s poster from P0 sweep.
    posterLocal: path.join(PREP, "haunted-hotel_poster.jpg"),
  },
  {
    themeId: "pink-dream",
    themeName: "Pink Dream",
    storageSlug: "pink-dream",
    videoLocal: path.join(PREP, "pink-dream_optimized.mp4"),
    // Founder confirmed the 2.00s poster from P0 sweep.
    posterLocal: path.join(PREP, "pink-dream_poster.jpg"),
  },
];

/* ─── Helpers ────────────────────────────────────────────────── */
function run(args) {
  const r = spawnSync(FFMPEG, args, { encoding: "utf8" });
  if (r.status !== 0) throw new Error(`ffmpeg failed: ${r.stderr?.slice(-800)}`);
  return r;
}
function ffprobeJson(file) {
  const r = spawnSync(FFPROBE, ["-v", "error", "-print_format", "json", "-show_format", "-show_streams", file], { encoding: "utf8" });
  if (r.status !== 0) throw new Error(`ffprobe: ${r.stderr}`);
  return JSON.parse(r.stdout);
}
function sha256(buf) { return crypto.createHash("sha256").update(buf).digest("hex"); }

async function downloadBytes(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`download ${url}: ${r.status}`);
  return Buffer.from(await r.arrayBuffer());
}

async function uploadObject(remote, bytes, contentType, cacheControl) {
  // Supabase storage REST API supports x-upsert for in-place replacement.
  // We send the cache-control we want persisted (even though CF overrides
  // the served header, the object metadata is honoured if Supabase ever
  // changes its CDN rules).
  const r = await fetch(
    `${SB_URL}/storage/v1/object/${BUCKET}/${remote}?upsert=true`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${SB_KEY}`,
        apikey: SB_KEY,
        "Content-Type": contentType,
        "cache-control": cacheControl,
        "x-upsert": "true",
      },
      body: bytes,
    },
  );
  if (!r.ok) throw new Error(`upload ${remote}: ${r.status} ${await r.text()}`);
  return `${SB_URL}/storage/v1/object/public/${BUCKET}/${remote}`;
}

/* ─── Step 1 · backup current live videos ──────────────────────── */
async function backupLive() {
  console.log("── Step 1 · backup current live videos ──");
  const backups = [];
  for (const j of JOBS) {
    const liveUrl = `${SB_URL}/storage/v1/object/public/${BUCKET}/${j.storageSlug}/intro.mp4`;
    const bytes = await downloadBytes(liveUrl);
    const outPath = path.join(BACKUP_DIR, `${j.storageSlug}_pre_replacement.mp4`);
    fs.writeFileSync(outPath, bytes);
    const probe = ffprobeJson(outPath);
    const vStream = (probe.streams || []).find((s) => s.codec_type === "video");
    const aStream = (probe.streams || []).find((s) => s.codec_type === "audio");
    const info = {
      themeName: j.themeName,
      slug: j.storageSlug,
      url: liveUrl,
      backupPath: path.relative(ROOT, outPath),
      sizeBytes: bytes.length,
      sha256: sha256(bytes),
      durationS: Number(probe.format?.duration ?? 0),
      bitRate: Number(probe.format?.bit_rate ?? 0),
      width: vStream?.width,
      height: vStream?.height,
      hasAudio: !!aStream,
    };
    backups.push(info);
    console.log(`  ${j.themeName.padEnd(14)}  ${(info.sizeBytes / 1024 / 1024).toFixed(2)} MB  dur=${info.durationS.toFixed(2)}s  audio=${info.hasAudio}  sha256=${info.sha256.slice(0, 12)}…`);
  }
  fs.writeFileSync(path.join(BACKUP_DIR, "manifest.json"), JSON.stringify(backups, null, 2));
  return backups;
}

/* ─── Step 2 · extract Joker 2.60s poster ────────────────────── */
function extractJokerPoster() {
  console.log("\n── Step 2 · extract Joker 2.60s poster ──");
  const joker = JOBS[0];
  const outPath = path.join(OUT_DIR, "theme-0_poster_2.60s.jpg");
  run([
    "-y",
    "-ss", String(joker.posterAtSeconds),
    "-i", joker.posterExtractFrom,
    "-frames:v", "1",
    "-q:v", "4",
    outPath,
  ]);
  joker.posterLocal = outPath;
  const st = fs.statSync(outPath);
  console.log(`  Joker poster · ${path.relative(ROOT, outPath)} · ${(st.size / 1024).toFixed(1)} KB  at ${joker.posterAtSeconds}s`);
  return outPath;
}

/* ─── Step 3 · upload 3 optimized MP4s to EXISTING paths ──────── */
async function uploadVideos() {
  console.log("\n── Step 3 · upload 3 optimized MP4s (in-place, upsert) ──");
  const uploads = [];
  for (const j of JOBS) {
    const bytes = fs.readFileSync(j.videoLocal);
    const remote = `${j.storageSlug}/intro.mp4`;
    const url = await uploadObject(remote, bytes, "video/mp4", "public, max-age=86400, must-revalidate");
    uploads.push({
      themeName: j.themeName,
      remote,
      url,
      bytes: bytes.length,
      sha256: sha256(bytes),
    });
    console.log(`  ${j.themeName.padEnd(14)}  → ${remote}  (${(bytes.length / 1024 / 1024).toFixed(2)} MB)`);
  }
  return uploads;
}

/* ─── Step 4 · upload 3 posters to new paths ──────────────────── */
async function uploadPosters() {
  console.log("\n── Step 4 · upload 3 posters ──");
  const uploads = [];
  for (const j of JOBS) {
    const bytes = fs.readFileSync(j.posterLocal);
    const remote = `${j.storageSlug}/poster.jpg`;
    const url = await uploadObject(remote, bytes, "image/jpeg", "public, max-age=86400, must-revalidate");
    uploads.push({
      themeName: j.themeName,
      themeId: j.themeId,
      remote,
      url,
      bytes: bytes.length,
      sha256: sha256(bytes),
    });
    console.log(`  ${j.themeName.padEnd(14)}  → ${remote}  (${(bytes.length / 1024).toFixed(1)} KB)  ${url}`);
  }
  return uploads;
}

/* ─── Step 5 · UPDATE intro_poster_url · 3 rows only ──────────── */
async function updateRows(posterUploads) {
  console.log("\n── Step 5 · UPDATE nex_chat_theme.intro_poster_url · 3 rows ──");
  const changes = [];
  for (const p of posterUploads) {
    const { data: before, error: e1 } = await sb
      .from("nex_chat_theme")
      .select("id, name, intro_video_url, intro_duration_ms, intro_poster_url")
      .eq("id", p.themeId)
      .single();
    if (e1) throw new Error(`SELECT before ${p.themeId}: ${e1.message}`);
    const { data: after, error: e2 } = await sb
      .from("nex_chat_theme")
      .update({ intro_poster_url: p.url })
      .eq("id", p.themeId)
      .select("id, name, intro_video_url, intro_duration_ms, intro_poster_url")
      .single();
    if (e2) throw new Error(`UPDATE ${p.themeId}: ${e2.message}`);
    // Hard assertion: nothing OTHER than intro_poster_url changed.
    const invariantsOk =
      before.intro_video_url === after.intro_video_url &&
      before.intro_duration_ms === after.intro_duration_ms &&
      after.intro_poster_url === p.url;
    changes.push({ themeId: p.themeId, name: after.name, before, after, invariantsOk });
    console.log(`  ${after.name.padEnd(14)}  intro_poster_url: ${before.intro_poster_url ?? "NULL"} → ${after.intro_poster_url}  invariants=${invariantsOk}`);
    if (!invariantsOk) throw new Error(`invariant violation for ${p.themeId}`);
  }
  return changes;
}

/* ─── Step 6 · verify after replacement ──────────────────────── */
async function verifyAfter() {
  console.log("\n── Step 6 · verify served assets ──");
  const findings = [];
  for (const j of JOBS) {
    const videoUrl  = `${SB_URL}/storage/v1/object/public/${BUCKET}/${j.storageSlug}/intro.mp4`;
    const posterUrl = `${SB_URL}/storage/v1/object/public/${BUCKET}/${j.storageSlug}/poster.jpg`;

    // Give CF edge a moment to pick up the new content.
    // We purge by appending a cache-bust query, which the Supabase/CF
    // tier treats as a new URL for cache but serves the same object.
    const vHead = await fetch(`${videoUrl}?__bust=${Date.now()}`, { method: "HEAD" });
    const pHead = await fetch(`${posterUrl}?__bust=${Date.now()}`, { method: "HEAD" });

    // Download served bytes, ffprobe to confirm optimized state.
    const servedVideo = await downloadBytes(`${videoUrl}?__bust2=${Date.now()}`);
    const tmp = path.join(OUT_DIR, `_served_${j.storageSlug}.mp4`);
    fs.writeFileSync(tmp, servedVideo);
    const probe = ffprobeJson(tmp);
    const vStream = (probe.streams || []).find((s) => s.codec_type === "video");
    const aStream = (probe.streams || []).find((s) => s.codec_type === "audio");

    // Faststart check on the served bytes
    const first1MB = servedVideo.subarray(0, Math.min(servedVideo.length, 1024 * 1024));
    const moov = first1MB.indexOf(Buffer.from("moov"));
    const mdat = first1MB.indexOf(Buffer.from("mdat"));
    const faststart = moov !== -1 && (mdat === -1 || moov < mdat);

    // Range request
    const rangeRes = await fetch(videoUrl, { headers: { Range: "bytes=0-1023" } });

    findings.push({
      themeName: j.themeName,
      slug: j.storageSlug,
      videoUrl,
      posterUrl,
      videoHead: {
        status: vHead.status,
        contentType: vHead.headers.get("content-type"),
        contentLength: vHead.headers.get("content-length"),
        cacheControl: vHead.headers.get("cache-control"),
        cfCacheStatus: vHead.headers.get("cf-cache-status"),
        etag: vHead.headers.get("etag"),
      },
      posterHead: {
        status: pHead.status,
        contentType: pHead.headers.get("content-type"),
        contentLength: pHead.headers.get("content-length"),
        cacheControl: pHead.headers.get("cache-control"),
        cfCacheStatus: pHead.headers.get("cf-cache-status"),
      },
      servedVideo: {
        sizeBytes: servedVideo.length,
        durationS: Number(probe.format?.duration ?? 0),
        bitRate: Number(probe.format?.bit_rate ?? 0),
        width: vStream?.width,
        height: vStream?.height,
        codec: vStream?.codec_name,
        hasAudio: !!aStream,
        faststart,
        sha256: sha256(servedVideo),
      },
      rangeRequest: {
        status: rangeRes.status,
        contentRange: rangeRes.headers.get("content-range"),
        contentLength: rangeRes.headers.get("content-length"),
      },
    });

    fs.unlinkSync(tmp);
    console.log(
      `  ${j.themeName.padEnd(14)}  video:${vHead.status}(${vHead.headers.get("content-type")}, ${(Number(vHead.headers.get("content-length")) / 1024 / 1024).toFixed(2)} MB, faststart=${faststart})  poster:${pHead.status}(${pHead.headers.get("content-type")})  range:${rangeRes.status}`,
    );
  }
  return findings;
}

/* ─── Step 7 · regression · owner-bypass + playback ────────── */
async function regressionOwnerBypass() {
  console.log("\n── Step 7a · owner-bypass regression (9 founder cases) ──");
  const r = spawnSync("node", ["scripts/verify-phase-4a-owner-bypass.mjs"], {
    cwd: ROOT,
    encoding: "utf8",
  });
  const summaryMatch = /(\d+)\/9 cases pass/.exec(r.stdout);
  const passed = summaryMatch ? Number(summaryMatch[1]) : null;
  console.log(`  owner-bypass regression: ${passed}/9 pass`);
  if (passed !== 9) {
    console.log("  stderr:", r.stderr?.slice(-800));
    console.log("  stdout tail:", r.stdout?.slice(-800));
  }
  return { passed, total: 9, stdout: r.stdout, exitCode: r.status };
}

async function regressionPlayback() {
  console.log("\n── Step 7b · Playwright playback regression ──");
  const r = spawnSync("node", ["scripts/phase-4a-playwright-evidence.mjs"], {
    cwd: ROOT,
    encoding: "utf8",
    maxBuffer: 10 * 1024 * 1024,
  });
  const summaryMatch = /OVERALL\s+(\d+)\/(\d+)\s+checks pass/.exec(r.stdout);
  const passed = summaryMatch ? Number(summaryMatch[1]) : null;
  const total  = summaryMatch ? Number(summaryMatch[2]) : null;
  console.log(`  playback regression: ${passed}/${total} checks pass`);
  return { passed, total, exitCode: r.status };
}

/* ─── Main ──────────────────────────────────────────────────── */
async function main() {
  console.log(`\nPhase 4A controlled live replacement · ${new Date().toISOString()}`);
  console.log(`Output: ${path.relative(ROOT, OUT_DIR)}\n`);

  const report = {
    startedAt: new Date().toISOString(),
    stamp: STAMP,
    outDir: path.relative(ROOT, OUT_DIR),
  };

  report.backups      = await backupLive();
  extractJokerPoster();
  report.videoUploads = await uploadVideos();
  report.posterUploads = await uploadPosters();
  report.dbChanges    = await updateRows(report.posterUploads);
  report.verification = await verifyAfter();
  report.ownerBypass  = await regressionOwnerBypass();
  report.playback     = await regressionPlayback();
  report.finishedAt   = new Date().toISOString();

  const reportPath = path.join(OUT_DIR, "report.json");
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`\nReport: ${path.relative(ROOT, reportPath)}`);
  console.log(`Backup: ${path.relative(ROOT, BACKUP_DIR)}`);
  console.log(`\nSTOP · no commit, no push. Awaiting founder review before commit authorization.`);
}

main().catch((e) => {
  console.error("\nFATAL:", e.message);
  console.error(e.stack);
  process.exit(1);
});
