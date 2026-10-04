// scripts/upload-theme-intro-videos.mjs
//
// NEX Phase 4A · premium theme intro-video seeding.
// Founder-authorised 2026-10-04.
//
// Does three things:
//   1. Ensures bucket `nex-theme-intro` exists (public read).
//   2. Uploads the three authorised intro videos:
//        - haunted-hotel   ← Man_walking_down_stairs_20261004154239.mp4
//        - pink-dream      ← Teddy_bear_climbing_and_waving_20261004175841.mp4
//        - joker           ← joker vid.mp4
//      Objects land at nex-theme-intro/<theme-id>/intro.mp4.
//   3. UPDATEs nex_chat_theme.intro_video_url for each of the three
//      theme ids with the resulting public URL. Leaves
//      intro_duration_ms NULL (the client uses the real `onended`
//      event · the hard 5s safety ceiling governs anything longer).
//
// Pinned to the canonical NEX Supabase project
// (NEXT_PUBLIC_NEX_SUPABASE_URL · ij...).
//
// Rerun-safe: upload uses upsert=true, UPDATE is idempotent, bucket
// check is a no-op after first run.

import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

function loadEnv() {
  const raw = fs.readFileSync(path.join(ROOT, ".env.local"), "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const m = /^([A-Z0-9_]+)=(.*)$/.exec(line);
    if (m) process.env[m[1]] ??= m[2];
  }
}
loadEnv();

const URL = process.env.NEXT_PUBLIC_NEX_SUPABASE_URL;
const KEY = process.env.NEX_SUPABASE_SERVICE_ROLE_KEY;
if (!URL || !KEY) {
  throw new Error(
    "Missing NEX Supabase env (NEXT_PUBLIC_NEX_SUPABASE_URL / NEX_SUPABASE_SERVICE_ROLE_KEY)",
  );
}

const BUCKET = "nex-theme-intro";

const JOBS = [
  {
    themeId: "haunted-hotel",
    srcPath: "C:/Users/Victus/Downloads/Man_walking_down_stairs_20261004154239.mp4",
  },
  {
    themeId: "pink-dream",
    srcPath: "C:/Users/Victus/Downloads/Teddy_bear_climbing_and_waving_20261004175841.mp4",
  },
  {
    // Joker's row id is "theme-0" (legacy · it was the first catalogue
    // row before the slug convention was adopted). Keep the storage
    // path human-readable as "joker/" though · bucket paths and DB
    // row ids need not match.
    themeId: "theme-0",
    storageSlug: "joker",
    srcPath: "C:/Users/Victus/Downloads/joker vid.mp4",
  },
];

const sb = createClient(URL, KEY, { auth: { persistSession: false } });

async function ensureBucket() {
  const { data: existing, error: listErr } = await sb.storage.listBuckets();
  if (listErr) throw new Error(`listBuckets: ${listErr.message}`);
  const found = existing.find((b) => b.name === BUCKET);
  if (found) {
    console.log(`  bucket ok · ${BUCKET} · public=${found.public}`);
    if (!found.public) {
      console.warn(`  WARN · ${BUCKET} is private · intros load via <video src> and need public read`);
    }
    return;
  }
  const { error } = await sb.storage.createBucket(BUCKET, {
    public: true,
    fileSizeLimit: null,
    allowedMimeTypes: ["video/mp4"],
  });
  if (error) throw new Error(`createBucket ${BUCKET}: ${error.message}`);
  console.log(`  bucket created · ${BUCKET} · public=true · mime=video/mp4`);
}

async function uploadOne(job) {
  if (!fs.existsSync(job.srcPath)) {
    return { ...job, ok: false, err: `source missing: ${job.srcPath}` };
  }
  const bytes = fs.readFileSync(job.srcPath);
  const remote = `${job.storageSlug ?? job.themeId}/intro.mp4`;
  const putRes = await fetch(
    `${URL}/storage/v1/object/${BUCKET}/${remote}?upsert=true`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${KEY}`,
        apikey: KEY,
        "Content-Type": "video/mp4",
        "cache-control": "public, max-age=86400, must-revalidate",
        "x-upsert": "true",
      },
      body: bytes,
    },
  );
  if (!putRes.ok) {
    return {
      ...job,
      ok: false,
      err: `storage ${putRes.status} ${await putRes.text()}`,
    };
  }
  const publicUrl = `${URL}/storage/v1/object/public/${BUCKET}/${remote}`;
  return { ...job, ok: true, bytes: bytes.length, publicUrl };
}

async function seedRow(themeId, publicUrl) {
  const { data, error } = await sb
    .from("nex_chat_theme")
    .update({ intro_video_url: publicUrl })
    .eq("id", themeId)
    .select("id, name, intro_video_url, intro_duration_ms, intro_poster_url")
    .single();
  if (error) return { themeId, ok: false, err: error.message };
  return { themeId, ok: true, row: data };
}

async function main() {
  console.log(`\nPhase 4A · uploading 3 theme intro videos to ${BUCKET}/`);
  await ensureBucket();

  const uploadResults = [];
  for (const job of JOBS) {
    const r = await uploadOne(job);
    uploadResults.push(r);
    if (r.ok) {
      console.log(
        `  OK   ${r.themeId.padEnd(14)}  ${(r.bytes / 1024 / 1024).toFixed(2)} MB  ${r.publicUrl}`,
      );
    } else {
      console.error(`  FAIL ${r.themeId}  ${r.err}`);
    }
  }
  const uploadedCount = uploadResults.filter((r) => r.ok).length;
  if (uploadedCount !== JOBS.length) {
    console.error(`\nAborting · only ${uploadedCount}/${JOBS.length} uploads succeeded`);
    process.exit(1);
  }

  console.log(`\nSeeding nex_chat_theme.intro_video_url for 3 rows ...`);
  for (const r of uploadResults) {
    const s = await seedRow(r.themeId, r.publicUrl);
    if (s.ok) {
      console.log(
        `  OK   ${s.row.id.padEnd(14)}  "${s.row.name}"  intro_video_url=${s.row.intro_video_url ? "SET" : "NULL"}  intro_duration_ms=${s.row.intro_duration_ms}`,
      );
    } else {
      console.error(`  FAIL ${s.themeId}  ${s.err}`);
    }
  }

  // Verify the three rows end-to-end.
  const { data: rows, error } = await sb
    .from("nex_chat_theme")
    .select("id, name, intro_video_url, intro_duration_ms, intro_poster_url")
    .in("id", JOBS.map((j) => j.themeId))
    .order("id");
  if (error) {
    console.error(`\nVerify FAIL: ${error.message}`);
    process.exit(1);
  }
  console.log(`\nVerification · ${rows.length} rows:`);
  for (const row of rows) {
    const ok = !!row.intro_video_url;
    console.log(
      `  ${ok ? "✓" : "✗"} ${row.id.padEnd(14)}  "${row.name}"  intro_video_url=${row.intro_video_url ?? "NULL"}`,
    );
  }
  const allOk =
    rows.length === JOBS.length && rows.every((r) => !!r.intro_video_url);
  if (!allOk) {
    console.error(
      `\nIncomplete · ${rows.length}/${JOBS.length} rows returned · one or more theme ids may be wrong`,
    );
    process.exit(1);
  }
  console.log(`\nAll ${JOBS.length} themes seeded. Phase 4A storage + seed complete.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
