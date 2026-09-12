#!/usr/bin/env node
// scripts/seed-nex-live-mock-content.mjs
//
// NEX LIVE · Master Experience · Mock content seed
// Philip 2026-09-06 · FOUNDER CEREMONIAL AUTHORIZATION · Master Build
//
// Reads MOCK_FIXTURES from src/lib/nex/live/mock-fixtures.ts and installs
// the fixtures into the dev environment:
//   1. For each fixture with media_asset="seed_wav_silence:<ms>":
//      generate a silent WAV of the specified duration and insert it
//      into nex.media_object via insertUploadingRow + ObjectStorage.put
//      + completeUpload (the same primitives the real upload path uses).
//   2. For each fixture with media_asset="existing_sample_video":
//      reuse the existing 23ddb66f... row.
//   3. Write NEX Live rights declarations under data/nex-live/declarations.jsonl
//      using the same persistence primitives the real upload path uses.
//   4. Write a fixture-timing sidecar under data/nex-live/mock-timing.json
//      so /api/nex-live/tonight can derive LIVE_NOW/STARTING_SOON.
//
// Idempotent: re-running skips fixtures already present.
//
// §17 immutable: every fixture is marked is_mock_fixture=true in extras.
// §55 §22 §21: fixtures pass the SAME rights + lifecycle gates real
// user content does.

import { spawn } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";
import fs from "node:fs";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "..");
const entryFile = fileURLToPath(import.meta.url);

if (!process.env.NEX_SEED_INNER) {
  const envArgs = fs.existsSync(path.join(repoRoot, ".env.local"))
    ? ["--env-file=.env.local"]
    : [];
  const child = spawn(
    "npx",
    ["tsx", ...envArgs, entryFile, ...process.argv.slice(2)],
    { stdio: "inherit", cwd: repoRoot, shell: true, env: { ...process.env, NEX_SEED_INNER: "1" } },
  );
  child.on("exit", (c) => process.exit(c ?? 1));
} else {
  await inner();
}

// ── Silent WAV generator · zero copyright · zero dependencies ─────
function silentWavBytes(durationMs) {
  const sampleRate = 44100;
  const numChannels = 1;
  const bitsPerSample = 16;
  const numSamples = Math.max(1, Math.floor(sampleRate * (durationMs / 1000)));
  const dataSize = numSamples * numChannels * (bitsPerSample / 8);
  const buffer = Buffer.alloc(44 + dataSize);
  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write("WAVE", 8);
  buffer.write("fmt ", 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);              // PCM
  buffer.writeUInt16LE(numChannels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * numChannels * (bitsPerSample / 8), 28);
  buffer.writeUInt16LE(numChannels * (bitsPerSample / 8), 32);
  buffer.writeUInt16LE(bitsPerSample, 34);
  buffer.write("data", 36);
  buffer.writeUInt32LE(dataSize, 40);
  // Body already zero-filled by Buffer.alloc — that IS silence.
  return buffer;
}

async function inner() {
  console.log("=== NEX LIVE · Master Experience · Mock content seed ===\n");
  const { randomBytes, createHash } = await import("node:crypto");

  // Dynamic imports · Windows requires file:// URLs
  const mockUrl = pathToFileURL(path.join(repoRoot, "src/lib/nex/live/mock-fixtures.ts")).href;
  const declStoreUrl = pathToFileURL(path.join(repoRoot, "src/lib/nex/live/media-declaration-store.ts")).href;
  const declModUrl = pathToFileURL(path.join(repoRoot, "src/lib/nex/live/rights-declaration.ts")).href;
  const mediaObjUrl = pathToFileURL(path.join(repoRoot, "src/lib/nex-media/media-object.ts")).href;
  const objectRegUrl = pathToFileURL(path.join(repoRoot, "src/lib/nex/storage/object-registry.ts")).href;

  const { MOCK_FIXTURES, IS_MOCK_FIXTURE_MARKER } = await import(mockUrl);
  const { saveDeclaration, readActiveDeclaration } = await import(declStoreUrl);
  const { newDeclaration } = await import(declModUrl);
  const { getMediaPool, insertUploadingRow, completeUpload } = await import(mediaObjUrl);
  const { getObjectStorage } = await import(objectRegUrl);

  const pool = getMediaPool();
  const store = getObjectStorage();

  // Get the existing sample video's real media_id
  const feedResp = await fetch("http://localhost:3008/api/nex-video/feed?limit=1");
  const feed = await feedResp.json();
  const existingSampleMediaId = feed.videos?.[0]?.media_id;
  if (!existingSampleMediaId) {
    console.error("FATAL · could not resolve existing sample video from /api/nex-video/feed");
    process.exit(2);
  }
  console.log(`Existing sample video: ${existingSampleMediaId}\n`);

  // ── Mode-index sidecar for discovery ────────────────────────────
  const modeIdxPath = path.join(repoRoot, "data/nex-live/media-mode-index.json");
  let modeIdx = { version: 1, index: {} };
  if (fs.existsSync(modeIdxPath)) modeIdx = JSON.parse(fs.readFileSync(modeIdxPath, "utf8"));

  // ── Timing + entity sidecar · read by /api/nex-live/tonight ─────
  const timingPath = path.join(repoRoot, "data/nex-live/mock-timing.json");
  const timing = {
    version: 1,
    now_at_seed_iso: new Date().toISOString(),
    fixtures: {},
  };

  let created = 0;
  let reused = 0;
  let skipped = 0;
  const now = Date.now();

  for (const fx of MOCK_FIXTURES) {
    console.log(`[${fx.fixture_id}] ${fx.title}`);

    // Idempotency · skip if a declaration for this fixture_id already exists
    // (we key by a synthetic media_id when the asset is WAV so subsequent
    //  runs don't create duplicates)
    const stableWavKey = `mock/${fx.fixture_id}.wav`;

    let media_id;
    if (fx.media_asset === "existing_sample_video") {
      media_id = existingSampleMediaId;
      reused++;
      console.log(`  · reusing existing sample video ${media_id.slice(0, 8)}...`);
    } else {
      // seed_wav_silence:<ms>
      const durationMs = Number(fx.media_asset.split(":")[1]);
      if (!Number.isFinite(durationMs) || durationMs <= 0) {
        console.error(`  · SKIP · invalid media_asset spec ${fx.media_asset}`);
        skipped++;
        continue;
      }
      // Try to find an existing row for this fixture's stable storage key.
      let existingRow;
      try {
        const r = await pool.query(
          `SELECT media_id FROM nex.media_object WHERE storage_key = $1 LIMIT 1`,
          [stableWavKey],
        );
        existingRow = r.rows[0];
      } catch (err) {
        console.error(`  · FATAL · db unreachable: ${err.message.slice(0, 80)}`);
        process.exit(3);
      }

      if (existingRow?.media_id) {
        media_id = String(existingRow.media_id);
        reused++;
        console.log(`  · reusing prior WAV row ${media_id.slice(0, 8)}...`);
      } else {
        // Generate + insert + put + complete
        const bytes = silentWavBytes(durationMs);
        const uploaded = await insertUploadingRow(pool, {
          object_type: "audio",
          owner_id: fx.creator_id,
          visibility: "public",
          storage_key: stableWavKey,
          storage_version: `mock-${Date.now().toString(36)}-${randomBytes(4).toString("hex")}`,
          mime_type: "audio/wav",
          context_type: "feed",
          context_ref: fx.entity_id,
          uploaded_via: "scripts/seed-nex-live-mock-content.mjs",
          uploaded_from_user_agent: "nex-live-mock-seed",
          title: fx.title,
          description: fx.description,
        });
        let putRes;
        try {
          putRes = await store.put("nex-media", stableWavKey, {
            body: bytes,
            mime_type: "audio/wav",
            uploaded_by: fx.creator_id,
            business_id: null,
            source_ref: `mock-fixture:${fx.fixture_id}`,
          });
        } catch (err) {
          console.error(`  · storage put failed: ${err.message.slice(0, 80)}`);
          await pool.query(`UPDATE nex.media_object SET state='failed' WHERE media_id=$1`, [uploaded.media_id]);
          skipped++;
          continue;
        }
        await pool.query(
          `UPDATE nex.media_object SET storage_version=$2 WHERE media_id=$1`,
          [uploaded.media_id, putRes.version_id],
        );
        const ready = await completeUpload(pool, {
          media_id: uploaded.media_id,
          size_bytes: putRes.size_bytes,
          content_hash: putRes.content_hash || createHash("sha256").update(bytes).digest("hex"),
          duration_ms: durationMs,
          width_px: null,
          height_px: null,
          codec: "pcm_s16le",
        });
        if (!ready) {
          console.error(`  · completeUpload race`);
          skipped++;
          continue;
        }
        media_id = ready.media_id;
        created++;
        console.log(`  · created WAV row ${media_id.slice(0, 8)}... (${bytes.length} bytes)`);
      }
    }

    // Write NEX Live declaration (idempotent · check existing first)
    const existingDecl = readActiveDeclaration(media_id);
    if (existingDecl && existingDecl.uploader_user_id === fx.creator_id) {
      console.log(`  · declaration already present`);
    } else {
      const decl = newDeclaration({
        declaration_id: `mock-${fx.fixture_id}-${Date.now().toString(36)}`,
        media_id,
        uploader_user_id: fx.creator_id,
        declared_kind: fx.rights_kind,
        declared_statement: fx.rights_statement,
      });
      saveDeclaration(decl);
      console.log(`  · declaration saved · kind=${fx.rights_kind}`);
    }

    // Update mode index
    modeIdx.index[media_id] = {
      mode: fx.mode,
      owner_user_id: fx.creator_id,
      registered_at_iso: new Date().toISOString(),
      is_mock_fixture: true,
      fixture_id: fx.fixture_id,
    };

    // Write timing sidecar for THIS media_id
    const startedAt = new Date(now + fx.started_at_offset_min * 60_000).toISOString();
    const endedAt = fx.end_at_offset_min !== null
      ? new Date(now + fx.end_at_offset_min * 60_000).toISOString()
      : null;
    // "TONIGHT" fixtures: pin to today 20:00 local rather than raw offset
    let pinnedStarted = startedAt;
    if (fx.started_at_offset_min >= 240) {
      const t = new Date();
      t.setHours(20, 0, 0, 0);
      pinnedStarted = t.toISOString();
    }
    // Key by fixture_id so multiple fixtures can share one media_id
    // (e.g. 3 hotel Live cards playing the sample video).
    timing.fixtures[fx.fixture_id] = {
      fixture_id: fx.fixture_id,
      media_id,
      entity_id: fx.entity_id,
      entity_name: fx.entity_name,
      creator_id: fx.creator_id,
      category: fx.category,
      city_slug: fx.city_slug,
      province_code: fx.province_code,
      started_at_iso: pinnedStarted,
      end_at_iso: endedAt,
      last_heartbeat_iso: fx.content_state === "LIVE" ? new Date().toISOString() : null,
      content_state: fx.content_state,
      is_mock_fixture: true,
      title: fx.title,
      description: fx.description,
      mode: fx.mode,
    };
  }

  // Persist sidecars
  const dataDir = path.join(repoRoot, "data/nex-live");
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  fs.writeFileSync(modeIdxPath, JSON.stringify(modeIdx, null, 2));
  fs.writeFileSync(timingPath, JSON.stringify(timing, null, 2));

  console.log(`\n=== SEED SUMMARY ===`);
  console.log(`  created new media rows : ${created}`);
  console.log(`  reused existing rows   : ${reused}`);
  console.log(`  skipped                : ${skipped}`);
  console.log(`  total fixtures         : ${MOCK_FIXTURES.length}`);
  console.log(`  timing sidecar         : ${timingPath}`);
  console.log(`  mode index             : ${modeIdxPath}`);
  console.log(`\nAll fixtures marked is_mock_fixture=true · not real user content.`);
  process.exit(0);
}
