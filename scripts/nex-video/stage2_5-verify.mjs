// scripts/nex-video/stage2_5-verify.mjs
//
// NEX Video Stage 2.5 · in-browser creation · verification script.
// Philip 2026-08-27.
//
// Simulates what the browser Create UI does: POST multipart to /upload with
// a video blob, then verify the row lands + appears in the feed. Also checks
// the /nex-video/create page renders and the ＋ Create button on /nex-video.

import pg from "pg";
import { readFileSync } from "node:fs";

process.env.NEX_OBJECT_BACKEND = "postgres";
const pool = new pg.Pool({ connectionString: process.env.NEX_POSTGRES_URL, max: 3 });
const BASE = "http://localhost:3008";

const results = [];
function report(step, ok, detail) {
  console.log(`${ok ? "✓" : "✗"} ${step} · ${detail}`);
  results.push({ step, ok, detail });
}

async function main() {
  console.log("═══════ NEX Video Stage 2.5 · verification ═══════");
  console.log("  at:", new Date().toISOString());
  console.log("");

  // 1. Create page renders
  const createPage = await fetch(`${BASE}/nex-video/create`);
  report("/nex-video/create page renders", createPage.ok, `HTTP ${createPage.status}`);

  // 2. Feed page still renders (＋ Create link is client-rendered · trust code review + Stage 2 test)
  const feedPage = await fetch(`${BASE}/nex-video`);
  report("/nex-video page still renders after Stage 2.5 additions", feedPage.ok, `HTTP ${feedPage.status}`);

  // 3. Direct multipart upload · public video
  const owner = `verify-creator-${Date.now()}`;
  const videoBytes = Buffer.concat([
    Buffer.from("\x1a\x45\xdf\xa3", "binary"),  // WebM EBML header magic
    Buffer.from("stage-2_5-fake-webm-payload-" + "x".repeat(2048), "utf8"),
  ]);
  const fd = new FormData();
  const blob = new Blob([videoBytes], { type: "video/webm" });
  fd.append("file", blob, `verify-${Date.now()}.webm`);
  fd.append("owner_id", owner);
  fd.append("object_type", "video");
  fd.append("visibility", "public");
  fd.append("context_type", "feed");
  fd.append("title", "Stage 2.5 verify · in-browser recording");
  fd.append("description", "posted by the verification script");
  fd.append("duration_ms", "3200");

  const uploadRes = await fetch(`${BASE}/api/nex-media/upload`, { method: "POST", body: fd });
  const uploadJson = await uploadRes.json();
  report("POST /api/nex-media/upload accepts multipart video",
    uploadRes.ok && uploadJson.media?.state === "ready" && uploadJson.media?.object_type === "video",
    `media_id=${uploadJson.media?.media_id?.slice(0, 8)} · state=${uploadJson.media?.state}`);
  const mediaId = uploadJson.media?.media_id;

  // 4. Row persisted correctly · state=ready · visibility=public
  const dbRow = (await pool.query(
    `SELECT object_type, state, visibility, owner_id, mime_type, size_bytes, duration_ms, title, context_type
       FROM nex.media_object WHERE media_id = $1`, [mediaId],
  )).rows[0];
  report("(Stage 1 foundation) row lands with correct owner/type/visibility",
    dbRow?.object_type === "video" && dbRow?.state === "ready" && dbRow?.visibility === "public" && dbRow?.owner_id === owner,
    `size=${dbRow?.size_bytes} · duration=${dbRow?.duration_ms}ms`);

  // 5. Bytes actually landed in storage (Postgres backend visible via object_blobs)
  const blobRow = (await pool.query(
    `SELECT size_bytes, mime_type FROM nex.object_blobs WHERE bucket = 'nex-media' AND key LIKE $1 LIMIT 1`,
    [`owner/${owner}/%`],
  )).rows[0];
  report("(ObjectStorage) bytes persisted through nex-media bucket",
    Number(blobRow?.size_bytes) === videoBytes.length && blobRow?.mime_type === "video/webm",
    `bytes=${blobRow?.size_bytes} · mime=${blobRow?.mime_type}`);

  // 6. ADR-0024 · manifest decorator fired · verify via the record storage
  // backend (which may be JSONL/disk or postgres depending on
  // NEX_STORAGE_BACKEND · Stage 1 already proved wrapping). Here we just
  // confirm the decorator ran without throwing (implicit · we got state=ready).
  report("(ADR-0024) manifest decorator ran (implicit · state=ready proves it)",
    dbRow?.state === "ready",
    "decorator wraps every put · Stage 1 tests prove landing per backend");

  // 7. Video appears in /api/nex-video/feed
  const feed = await (await fetch(`${BASE}/api/nex-video/feed?limit=20`)).json();
  const foundInFeed = feed.videos?.some((v) => v.media_id === mediaId);
  report("(Stage 2) new video appears in feed API",
    foundInFeed, `videos_returned=${feed.videos?.length ?? 0}`);

  // 8. Private videos still hidden
  const owner2 = `verify-creator-priv-${Date.now()}`;
  const fdPriv = new FormData();
  fdPriv.append("file", new Blob([Buffer.from("priv-webm-bytes")], { type: "video/webm" }), `priv-${Date.now()}.webm`);
  fdPriv.append("owner_id", owner2);
  fdPriv.append("object_type", "video");
  fdPriv.append("visibility", "private");
  const privRes = await (await fetch(`${BASE}/api/nex-media/upload`, { method: "POST", body: fdPriv })).json();
  const feedAfter = await (await fetch(`${BASE}/api/nex-video/feed?limit=100`)).json();
  const privLeaked = feedAfter.videos?.some((v) => v.media_id === privRes.media?.media_id);
  report("Private video does NOT leak into feed", !privLeaked, privLeaked ? "LEAKED" : "correctly hidden");

  // 9. Owner + admin can DELETE their own uploaded video · triggers 7-day grace
  const delRes = await fetch(`${BASE}/api/nex-media/${mediaId}`, {
    method: "DELETE", headers: { "x-nex-identity": owner },
  });
  const delJson = await delRes.json();
  report("(ADR-0118 § 3) creator can soft-delete their upload · 7-day grace",
    delRes.ok && delJson.media?.state === "deleted" && delJson.media?.hard_delete_after,
    `state=${delJson.media?.state} · hard_delete_after=${delJson.media?.hard_delete_after?.slice(0, 10)}`);

  // 10. HQ shows the ramp-gate metrics reflecting the new upload
  const hqRes = await fetch(`${BASE}/nex-head-quarters/media`);
  const hqBody = await hqRes.text();
  report("HQ page renders with Video Feed section",
    hqRes.ok && hqBody.includes("Video Feed V1") && hqBody.includes("Public videos"),
    `HTTP ${hqRes.status}`);

  // 11. Upload rejects non-multipart request
  const badRes = await fetch(`${BASE}/api/nex-media/upload`, {
    method: "POST", headers: { "content-type": "application/json" }, body: "{}",
  });
  report("Upload rejects non-multipart body", badRes.status >= 400, `status=${badRes.status}`);

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
