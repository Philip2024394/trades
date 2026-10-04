// scripts/phase-4a-live-replacement-resume.mjs
//
// Resumes phase-4a-live-replacement from Step 4 after the bucket
// mime-type widening unblocked poster uploads. Videos were already
// uploaded successfully in the first run. Only remaining steps:
//
//   4. Upload the three posters
//   5. UPDATE intro_poster_url on the three theme rows
//   6. Verify served assets (headers, ffprobe, byte-range)
//   7. Owner-bypass + playback regression
//
// Writes to the SAME output directory as the first run.

import { spawnSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
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
const sb = createClient(SB_URL, SB_KEY, { auth: { persistSession: false } });

const BUCKET = "nex-theme-intro";
const OUT_DIR = path.join(ROOT, "data", "phase-4a-live-replacement", "20261004-133752");
if (!fs.existsSync(OUT_DIR)) throw new Error(`OUT_DIR missing: ${OUT_DIR}`);

const PREP = path.join(ROOT, "data", "phase-4a-p0-preparation", "20261004-124847");

const JOBS = [
  { themeId: "theme-0",       themeName: "Joker",         storageSlug: "joker",         posterLocal: path.join(OUT_DIR, "theme-0_poster_2.60s.jpg") },
  { themeId: "haunted-hotel", themeName: "Haunted Hotel", storageSlug: "haunted-hotel", posterLocal: path.join(PREP, "haunted-hotel_poster.jpg") },
  { themeId: "pink-dream",    themeName: "Pink Dream",    storageSlug: "pink-dream",    posterLocal: path.join(PREP, "pink-dream_poster.jpg") },
];

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

async function uploadPosters() {
  console.log("── Step 4 · upload 3 posters ──");
  const uploads = [];
  for (const j of JOBS) {
    const bytes = fs.readFileSync(j.posterLocal);
    const remote = `${j.storageSlug}/poster.jpg`;
    const url = await uploadObject(remote, bytes, "image/jpeg", "public, max-age=86400, must-revalidate");
    uploads.push({ themeName: j.themeName, themeId: j.themeId, remote, url, bytes: bytes.length, sha256: sha256(bytes) });
    console.log(`  ${j.themeName.padEnd(14)}  → ${remote}  (${(bytes.length / 1024).toFixed(1)} KB)  ${url}`);
  }
  return uploads;
}

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
    const invariantsOk =
      before.intro_video_url === after.intro_video_url &&
      before.intro_duration_ms === after.intro_duration_ms &&
      after.intro_poster_url === p.url;
    changes.push({ themeId: p.themeId, name: after.name, before, after, invariantsOk });
    console.log(`  ${after.name.padEnd(14)}  intro_poster_url: ${before.intro_poster_url ?? "NULL"} → ${after.intro_poster_url}`);
    console.log(`    invariants (video_url + duration unchanged, poster set to new URL): ${invariantsOk}`);
    if (!invariantsOk) throw new Error(`invariant violation for ${p.themeId}`);
  }
  return changes;
}

async function verifyAfter() {
  console.log("\n── Step 6 · verify served assets ──");
  const findings = [];
  for (const j of JOBS) {
    const videoUrl  = `${SB_URL}/storage/v1/object/public/${BUCKET}/${j.storageSlug}/intro.mp4`;
    const posterUrl = `${SB_URL}/storage/v1/object/public/${BUCKET}/${j.storageSlug}/poster.jpg`;
    const vHead = await fetch(`${videoUrl}?__bust=${Date.now()}`, { method: "HEAD" });
    const pHead = await fetch(`${posterUrl}?__bust=${Date.now()}`, { method: "HEAD" });
    const servedVideo = await downloadBytes(`${videoUrl}?__bust2=${Date.now()}`);
    const tmp = path.join(OUT_DIR, `_served_${j.storageSlug}.mp4`);
    fs.writeFileSync(tmp, servedVideo);
    const probe = ffprobeJson(tmp);
    const vStream = (probe.streams || []).find((s) => s.codec_type === "video");
    const aStream = (probe.streams || []).find((s) => s.codec_type === "audio");
    const first1MB = servedVideo.subarray(0, Math.min(servedVideo.length, 1024 * 1024));
    const moov = first1MB.indexOf(Buffer.from("moov"));
    const mdat = first1MB.indexOf(Buffer.from("mdat"));
    const faststart = moov !== -1 && (mdat === -1 || moov < mdat);
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
      `  ${j.themeName.padEnd(14)}  video:${vHead.status}(${vHead.headers.get("content-type")}, ${(Number(vHead.headers.get("content-length")) / 1024 / 1024).toFixed(2)} MB, faststart=${faststart}, audio=${!!aStream})  poster:${pHead.status}(${pHead.headers.get("content-type")}, ${(Number(pHead.headers.get("content-length")) / 1024).toFixed(1)} KB)  range:${rangeRes.status}`,
    );
  }
  return findings;
}

async function regressionOwnerBypass() {
  console.log("\n── Step 7a · owner-bypass regression (9 founder cases) ──");
  const r = spawnSync("node", ["scripts/verify-phase-4a-owner-bypass.mjs"], { cwd: ROOT, encoding: "utf8" });
  const summaryMatch = /(\d+)\/9 cases pass/.exec(r.stdout);
  const passed = summaryMatch ? Number(summaryMatch[1]) : null;
  console.log(`  owner-bypass: ${passed}/9`);
  return { passed, total: 9, exitCode: r.status };
}

async function regressionPlayback() {
  console.log("\n── Step 7b · Playwright playback regression ──");
  const r = spawnSync("node", ["scripts/phase-4a-playwright-evidence.mjs"], { cwd: ROOT, encoding: "utf8", maxBuffer: 10 * 1024 * 1024 });
  const summaryMatch = /OVERALL\s+(\d+)\/(\d+)\s+checks pass/.exec(r.stdout);
  const passed = summaryMatch ? Number(summaryMatch[1]) : null;
  const total  = summaryMatch ? Number(summaryMatch[2]) : null;
  console.log(`  playback: ${passed}/${total}`);
  return { passed, total, exitCode: r.status };
}

async function main() {
  console.log(`\nPhase 4A controlled live replacement · RESUME · ${new Date().toISOString()}`);
  console.log(`Output: ${path.relative(ROOT, OUT_DIR)}\n`);
  const report = { startedAt: new Date().toISOString() };
  report.posterUploads = await uploadPosters();
  report.dbChanges     = await updateRows(report.posterUploads);
  report.verification  = await verifyAfter();
  report.ownerBypass   = await regressionOwnerBypass();
  report.playback      = await regressionPlayback();
  report.finishedAt    = new Date().toISOString();
  fs.writeFileSync(path.join(OUT_DIR, "report-resume.json"), JSON.stringify(report, null, 2));
  console.log(`\nReport: ${path.relative(ROOT, path.join(OUT_DIR, "report-resume.json"))}`);
  console.log(`\nSTOP · no commit, no push.`);
}

main().catch((e) => {
  console.error("\nFATAL:", e.message);
  console.error(e.stack);
  process.exit(1);
});
