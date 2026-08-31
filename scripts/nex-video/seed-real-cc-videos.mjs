// scripts/nex-video/seed-real-cc-videos.mjs
//
// Replace the 5 fake test-pattern videos with 5 REAL short CC-licensed
// clips from Google's public sample bucket (commonly used for browser
// video testing). Each ~1-2 MB · ~15 s · 720p H.264 · plays anywhere.
//
// These are widely-used developer test-fixtures. Attribution preserved in
// the media_object row (title + description + extras.licence). Uploaded
// through the shipped Stage 2.5 /api/nex-media/upload · same lifecycle
// as any user upload.
//
// Philip 2026-08-27 · replaces the ffmpeg-generated test patterns so
// Philip can see actual motion when tapping LIVE.

import pg from "pg";
import path from "node:path";
import { writeFileSync, readFileSync, mkdirSync, existsSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";

const BASE = "http://localhost:3008";
const OWNER = "nex-live-mock";

// Public developer sample clips · widely-published for testing MP4 playback.
// Big Buck Bunny + Sintel + Jellyfish are Blender Foundation CC-BY movies;
// test-videos.co.uk publishes short-form encodes explicitly for dev use.
const SAMPLES = [
  {
    url: "https://test-videos.co.uk/vids/bigbuckbunny/mp4/h264/720/Big_Buck_Bunny_720_10s_1MB.mp4",
    title: "Big Buck Bunny · 10s",
    description: "Blender Foundation open movie · CC BY 3.0.",
    licence: "CC BY 3.0 · © Blender Foundation · www.bigbuckbunny.org",
  },
  {
    url: "https://test-videos.co.uk/vids/sintel/mp4/h264/720/Sintel_720_10s_1MB.mp4",
    title: "Sintel · 10s",
    description: "Blender Foundation open movie · CC BY 3.0.",
    licence: "CC BY 3.0 · © Blender Foundation · www.sintel.org",
  },
  {
    url: "https://test-videos.co.uk/vids/jellyfish/mp4/h264/720/Jellyfish_720_10s_1MB.mp4",
    title: "Jellyfish · 10s",
    description: "Underwater jellyfish footage · developer sample clip.",
    licence: "Public developer sample · test-videos.co.uk",
  },
  {
    url: "https://download.samplelib.com/mp4/sample-5s.mp4",
    title: "Sample · 5s",
    description: "Short generic sample MP4 · developer test clip.",
    licence: "Public developer sample · samplelib.com",
  },
  {
    url: "https://download.samplelib.com/mp4/sample-15s.mp4",
    title: "Sample · 15s",
    description: "Short generic sample MP4 · developer test clip.",
    licence: "Public developer sample · samplelib.com",
  },
];

const pool = new pg.Pool({ connectionString: process.env.NEX_POSTGRES_URL, max: 3 });

async function deleteExistingMocks() {
  const r = await pool.query(
    `SELECT media_id FROM nex.media_object WHERE owner_id = $1`,
    [OWNER],
  );
  if (r.rows.length === 0) { console.log("  no existing mocks to delete"); return; }
  console.log(`  deleting ${r.rows.length} existing rows for owner=${OWNER}`);
  // Hard delete rows + storage · this is a dev cleanup, ADR-0118 grace is skipped
  await pool.query(`DELETE FROM nex.media_object WHERE owner_id = $1`, [OWNER]);
  await pool.query(`DELETE FROM nex.object_blobs WHERE bucket = 'nex-media' AND key LIKE 'owner/${OWNER}/%'`);
  await pool.query(`DELETE FROM nex.object_manifest WHERE bucket = 'nex-media' AND key LIKE 'owner/${OWNER}/%'`);
}

async function downloadClip(url, outPath) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`download failed · ${r.status} · ${url}`);
  const bytes = Buffer.from(await r.arrayBuffer());
  writeFileSync(outPath, bytes);
  return bytes.length;
}

async function uploadToNex(bytes, filename, title, description, licence) {
  const fd = new FormData();
  fd.append("file", new File([bytes], filename, { type: "video/mp4" }));
  fd.append("owner_id", OWNER);
  fd.append("object_type", "video");
  fd.append("visibility", "public");
  fd.append("context_type", "feed");
  fd.append("title", title);
  fd.append("description", description + "\n\nAttribution: " + licence);
  fd.append("codec", "h264");
  const r = await fetch(`${BASE}/api/nex-media/upload`, { method: "POST", body: fd });
  const j = await r.json();
  if (!r.ok || !j.ok) throw new Error(`upload failed · ${j.error ?? r.status}`);
  return j.media;
}

async function main() {
  console.log("═══════ NEX LIVE · seed 5 real CC video clips ═══════");
  console.log("");

  console.log("STEP 1 · cleanup existing mocks");
  await deleteExistingMocks();

  const dir = path.join(tmpdir(), "nex-real-videos");
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

  console.log("");
  console.log("STEP 2 · download + upload real clips");
  let successCount = 0;
  const uploaded = [];
  for (let i = 0; i < SAMPLES.length; i++) {
    const s = SAMPLES[i];
    const local = path.join(dir, `clip-${i + 1}.mp4`);
    console.log(`\n  [${i + 1}/${SAMPLES.length}] ${s.title}`);
    try {
      console.log(`    downloading ${s.url}`);
      const size = await downloadClip(s.url, local);
      console.log(`    downloaded ${(size / 1024 / 1024).toFixed(1)} MB`);
      const bytes = readFileSync(local);
      console.log(`    uploading to NEX Media Foundation…`);
      const media = await uploadToNex(bytes, `${s.title.toLowerCase().replace(/ /g, "-")}.mp4`, s.title, s.description, s.licence);
      console.log(`    ✓ media_id=${media.media_id.slice(0, 8)} · state=${media.state}`);
      uploaded.push(media);
      successCount++;
    } catch (e) {
      console.error(`    ✗ FAILED · ${e.message}`);
    } finally {
      try { unlinkSync(local); } catch {}
    }
  }

  console.log("");
  console.log("═══════════════════════════════════════");
  console.log(`  Uploaded: ${successCount}/${SAMPLES.length}`);
  console.log(`  Owner: ${OWNER}`);
  console.log(`  Visibility: public · will appear in /nex-video and NEX LIVE surface`);
  console.log("═══════════════════════════════════════");
  await pool.end();
  process.exit(successCount === SAMPLES.length ? 0 : 1);
}
main().catch(async (e) => { console.error("crashed:", e); try { await pool.end(); } catch {} process.exit(2); });
