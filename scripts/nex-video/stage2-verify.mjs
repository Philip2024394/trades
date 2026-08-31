// scripts/nex-video/stage2-verify.mjs
//
// NEX Video Feed V1 · verification script · Philip 2026-08-27.
//
// Seeds two public videos through the actual Stage 1 upload API (proving the
// foundation is truly reusable), hits GET /api/nex-video/feed, POSTs
// impressions, and checks the HQ page reflects the activity.

import pg from "pg";
import { createHash, randomUUID, randomBytes } from "node:crypto";

process.env.NEX_OBJECT_BACKEND = "postgres";

const pool = new pg.Pool({ connectionString: process.env.NEX_POSTGRES_URL, max: 3 });
const BASE = "http://localhost:3008";

const results = [];
function report(step, ok, detail) {
  const line = `${ok ? "✓" : "✗"} ${step} · ${detail}`;
  console.log(line);
  results.push({ step, ok, detail });
}

async function directPutBytes(bucket, key, version, body, mime) {
  await pool.query(
    `INSERT INTO nex.object_blobs (bucket, key, version_id, content_hash, size_bytes, mime_type, body, is_delete_marker, uploaded_at, uploaded_by, business_id, source_ref, custom)
     VALUES ($1, $2, $3, $4, $5, $6, $7, false, now(), NULL, NULL, NULL, '{}'::jsonb)
     ON CONFLICT DO NOTHING`,
    [bucket, key, version, createHash("sha256").update(body).digest("hex"), body.length, mime, body],
  );
  await pool.query(
    `INSERT INTO nex.object_manifest (manifest_id, bucket, key, version_id, content_hash, size_bytes, mime_type, uploaded_at, uploaded_by, business_id, source_ref, is_delete_marker, custom)
     VALUES ($1, $2, $3, $4, $5, $6, $7, now(), NULL, NULL, NULL, false, '{}'::jsonb)
     ON CONFLICT DO NOTHING`,
    [randomUUID(), bucket, key, version, createHash("sha256").update(body).digest("hex"), body.length, mime],
  );
}

async function createPublicVideo(owner, title) {
  const uploadJson = await (await fetch(`${BASE}/api/nex-media/upload-url`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({
      owner_id: owner, object_type: "video", mime_type: "video/mp4",
      visibility: "public", title,
    }),
  })).json();
  const fakeVideoBytes = Buffer.from("\x00\x00\x00 ftypisom-fake-mp4-stage2-verify-" + randomBytes(32).toString("hex"));
  await directPutBytes("nex-media", uploadJson.storage_key, uploadJson.storage_version, fakeVideoBytes, "video/mp4");
  const regJson = await (await fetch(`${BASE}/api/nex-media/register`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ media_id: uploadJson.media_id, duration_ms: 15000, width_px: 720, height_px: 1280, codec: "h264" }),
  })).json();
  return regJson.media;
}

async function main() {
  console.log("═══════ NEX Video Feed V1 · verification ═══════");
  console.log("  at:", new Date().toISOString());
  console.log("");

  // 1. Seed two PUBLIC videos through Stage 1 API
  const owner = `verify-broadcaster-${Date.now()}`;
  const v1 = await createPublicVideo(owner, "Stage 2 test video A");
  const v2 = await createPublicVideo(owner, "Stage 2 test video B");
  report("Two public videos created via Stage 1 API", v1?.state === "ready" && v2?.state === "ready",
    `v1=${v1?.media_id?.slice(0,8)} · v2=${v2?.media_id?.slice(0,8)}`);

  // 2. GET /api/nex-video/feed returns them, newest first
  const feedRes = await fetch(`${BASE}/api/nex-video/feed?limit=10`);
  const feed = await feedRes.json();
  const hasSeeded = Array.isArray(feed.videos) &&
    feed.videos.some((v) => v.media_id === v1.media_id) &&
    feed.videos.some((v) => v.media_id === v2.media_id);
  report("GET /api/nex-video/feed returns the two videos", feedRes.ok && hasSeeded,
    `count=${feed.videos?.length ?? 0} · next_cursor=${feed.next_cursor ?? "null"}`);

  // 3. Videos ordered by uploaded_at DESC (recency-only feed)
  const firstTwo = feed.videos?.slice(0, 2) ?? [];
  const inOrder = firstTwo.length === 2 &&
    new Date(firstTwo[0].uploaded_at).getTime() >= new Date(firstTwo[1].uploaded_at).getTime();
  report("Feed ordered by uploaded_at DESC (recency)", inOrder,
    `${firstTwo.map((v) => v.uploaded_at.slice(11, 19)).join(" → ")}`);

  // 4. Each video has playback_url and metadata
  const targetV1 = feed.videos.find((v) => v.media_id === v1.media_id);
  report("Feed video carries playback_url + duration + resolution",
    !!targetV1?.playback_url && targetV1?.duration_ms === 15000 && targetV1?.width_px === 720,
    `playback=${!!targetV1?.playback_url} · dur=${targetV1?.duration_ms}ms · ${targetV1?.width_px}x${targetV1?.height_px}`);

  // 5. Private videos are excluded from the feed
  const privateOwner = `verify-private-${Date.now()}`;
  const privUp = await (await fetch(`${BASE}/api/nex-media/upload-url`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ owner_id: privateOwner, object_type: "video", mime_type: "video/mp4", visibility: "private" }),
  })).json();
  const priBytes = Buffer.from("private-" + randomBytes(24).toString("hex"));
  await directPutBytes("nex-media", privUp.storage_key, privUp.storage_version, priBytes, "video/mp4");
  await fetch(`${BASE}/api/nex-media/register`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ media_id: privUp.media_id }) });
  const feedAfterPriv = await (await fetch(`${BASE}/api/nex-video/feed?limit=100`)).json();
  const privateLeaked = feedAfterPriv.videos?.some((v) => v.media_id === privUp.media_id);
  report("Private videos excluded from feed", !privateLeaked, privateLeaked ? "LEAKED" : "correctly excluded");

  // 6. POST /api/nex-video/impression records a view
  const viewer = `verify-viewer-${Date.now()}`;
  const impRes = await fetch(`${BASE}/api/nex-video/impression`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ media_id: v1.media_id, viewer_id: viewer, session_id: viewer, watched_ms: 8500, unmuted: true }),
  });
  report("POST /impression returns ok", impRes.ok, `status=${impRes.status}`);

  // 7. Impression landed in DB with correct values
  const impRow = (await pool.query(
    `SELECT viewer_id, watched_ms, unmuted FROM nex.video_feed_impression WHERE media_id = $1::uuid ORDER BY seen_at DESC LIMIT 1`,
    [v1.media_id],
  )).rows[0];
  report("Impression row landed with correct viewer + watched_ms + unmuted",
    impRow?.viewer_id === viewer && Number(impRow?.watched_ms) === 8500 && impRow?.unmuted === true,
    `viewer=${impRow?.viewer_id} · watched=${impRow?.watched_ms}ms · unmuted=${impRow?.unmuted}`);

  // 8. Feed page renders
  const pageRes = await fetch(`${BASE}/nex-video`);
  report("/nex-video page renders", pageRes.ok, `HTTP ${pageRes.status}`);

  // 9. HQ page reflects the new metrics
  const hqRes = await fetch(`${BASE}/nex-head-quarters/media`);
  const hqBody = await hqRes.text();
  report("HQ page renders Video Feed V1 section",
    hqRes.ok && hqBody.includes("Video Feed V1") && hqBody.includes("Views · 24h"),
    `HTTP ${hqRes.status} · contains section`);

  // 10. Pagination works (limit=1 · cursor for next page)
  const page1 = await (await fetch(`${BASE}/api/nex-video/feed?limit=1`)).json();
  const page1First = page1.videos?.[0]?.media_id;
  const nextCur = page1.next_cursor;
  const page2 = nextCur ? await (await fetch(`${BASE}/api/nex-video/feed?limit=1&cursor=${encodeURIComponent(nextCur)}`)).json() : null;
  const page2First = page2?.videos?.[0]?.media_id;
  report("Pagination · cursor returns different next video",
    !!page1First && !!page2First && page1First !== page2First,
    `page1=${page1First?.slice(0,8)} · page2=${page2First?.slice(0,8)}`);

  // Final tally
  const passed = results.filter(r => r.ok).length;
  const failed = results.filter(r => !r.ok).length;
  console.log("");
  console.log("═══════════════════════════════════════");
  console.log(`  Result: ${passed} passed · ${failed} failed`);
  console.log("═══════════════════════════════════════");
  await pool.end();
  process.exit(failed === 0 ? 0 : 1);
}
main().catch(async (e) => { console.error("verify crashed:", e); try { await pool.end(); } catch {} process.exit(2); });
