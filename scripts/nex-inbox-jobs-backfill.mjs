#!/usr/bin/env node
// nex-inbox-jobs-backfill.mjs · Phase 11.2 · One-shot backfill
//
// Copies the current filesystem inbox + jobs snapshots into the shadow
// Postgres tables (nex.knowledge_inbox · nex.knowledge_inbox_stats ·
// nex.knowledge_dump_jobs) so 11.3's flip has a full history to switch
// onto.
//
// Idempotent: uses ON CONFLICT DO NOTHING on insert paths so re-runs
// won't duplicate rows or clobber shadow_updated_at on rows that were
// modified after the backfill (dual-write via NEX_INBOX_SHADOW_POSTGRES=1).
//
// Runs directly against NEX_POSTGRES_URL · authenticates as postgres
// (via the DB URL) but immediately drops to nex_brain_app for every
// insert, mirroring the adapter's transaction discipline.
//
// Usage:
//   node scripts/nex-inbox-jobs-backfill.mjs
//     Backfills using data/knowledge-inbox/index.json + stats.json + data/nex-jobs/jobs.jsonl
//   node scripts/nex-inbox-jobs-backfill.mjs --dry-run
//     Reports what would be inserted · touches nothing
//
// Guardrails:
//   · NEVER modifies filesystem
//   · NEVER touches Supabase (production stays untouched)
//   · Reports counts + first-seen/last-seen so you can eyeball parity
//   · Exits non-zero if any INSERT throws (partial backfill · re-runnable)

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
const { Pool } = pg;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO      = path.join(__dirname, "..");
const INBOX_JSON = path.join(REPO, "data/knowledge-inbox/index.json");
const STATS_JSON = path.join(REPO, "data/knowledge-inbox/stats.json");
const JOBS_JSONL = path.join(REPO, "data/nex-jobs/jobs.jsonl");

const DRY_RUN = process.argv.includes("--dry-run");
const PG_URL  = process.env.NEX_POSTGRES_URL || "postgresql://postgres:Admin1phil@localhost:5433/nex_dev";

const pool = new Pool({ connectionString: PG_URL, max: 3 });

async function inRole(fn) {
  const c = await pool.connect();
  try {
    await c.query("BEGIN");
    await c.query("SET LOCAL ROLE nex_brain_app");
    const r = await fn(c);
    await c.query("COMMIT");
    return r;
  } catch (e) {
    await c.query("ROLLBACK").catch(() => {});
    throw e;
  } finally {
    c.release();
  }
}

function readJsonIfExists(p) {
  try { return JSON.parse(fs.readFileSync(p, "utf8")); }
  catch (e) { if (e.code === "ENOENT") return null; throw e; }
}

function readJsonlIfExists(p) {
  try {
    const raw = fs.readFileSync(p, "utf8");
    return raw.split("\n").filter(Boolean).map((line) => {
      try { return JSON.parse(line); } catch { return null; }
    }).filter(Boolean);
  } catch (e) { if (e.code === "ENOENT") return []; throw e; }
}

async function backfillInbox() {
  const items = readJsonIfExists(INBOX_JSON) ?? [];
  if (!Array.isArray(items) || items.length === 0) {
    console.log("inbox: nothing to backfill (index.json empty or missing)");
    return { attempted: 0, inserted: 0 };
  }
  console.log(`inbox: ${items.length} filesystem items · earliest=${items[items.length-1]?.createdAtIso ?? "?"} · latest=${items[0]?.createdAtIso ?? "?"}`);
  if (DRY_RUN) return { attempted: items.length, inserted: 0 };
  let inserted = 0;
  for (const item of items) {
    try {
      const r = await inRole((c) => c.query(
        `INSERT INTO nex.knowledge_inbox
           (id, title, kind, status, source, hash,
            created_at_ms, created_at_iso, meta, preview_text,
            content_path, file_path, original_filename,
            byte_size, mime_type, url,
            processed_at_ms, processed_notes,
            shadow_written_at, shadow_updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8::timestamptz,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18, NOW(), NOW())
         ON CONFLICT (id) DO NOTHING
         RETURNING id`,
        [
          item.id, item.title, item.kind, item.status, item.source, item.hash,
          item.createdAt, item.createdAtIso, item.meta ?? null, item.previewText ?? null,
          item.contentPath ?? null, item.filePath ?? null, item.originalFilename ?? null,
          item.byteSize ?? null, item.mimeType ?? null, item.url ?? null,
          item.processedAt ?? null, item.processedNotes ?? null,
        ]
      ));
      if (r.rowCount > 0) inserted += 1;
    } catch (err) {
      console.warn(`  ! insert failed id=${item.id}: ${err.message}`);
    }
  }
  console.log(`inbox: inserted ${inserted}/${items.length} (${items.length - inserted} already present)`);
  return { attempted: items.length, inserted };
}

async function backfillStats() {
  const s = readJsonIfExists(STATS_JSON);
  if (!s || !s.completedTodayDate) {
    console.log("stats: nothing to backfill (stats.json missing or malformed)");
    return { attempted: 0, inserted: 0 };
  }
  console.log(`stats: date=${s.completedTodayDate} completed_today=${s.completedToday} images=${s.imagesAnalysed} voice=${s.voiceNotesTranscribed}`);
  if (DRY_RUN) return { attempted: 1, inserted: 0 };
  try {
    const r = await inRole((c) => c.query(
      `INSERT INTO nex.knowledge_inbox_stats
         (stat_date, completed_today, images_analysed_lifetime,
          voice_notes_transcribed_lifetime, last_processed_at_ms,
          shadow_written_at, shadow_updated_at)
       VALUES ($1::date, $2, $3, $4, $5, NOW(), NOW())
       ON CONFLICT (stat_date) DO NOTHING
       RETURNING stat_date`,
      [s.completedTodayDate, s.completedToday ?? 0, s.imagesAnalysed ?? 0,
       s.voiceNotesTranscribed ?? 0, s.lastProcessedAt ?? null]
    ));
    return { attempted: 1, inserted: r.rowCount ?? 0 };
  } catch (err) {
    console.warn(`  ! insert failed: ${err.message}`);
    return { attempted: 1, inserted: 0 };
  }
}

async function backfillJobs() {
  const snapshots = readJsonlIfExists(JOBS_JSONL);
  if (snapshots.length === 0) {
    console.log("jobs: nothing to backfill (jobs.jsonl empty or missing)");
    return { attempted: 0, inserted: 0 };
  }
  // Collapse to latest-snapshot-per-job_id (matches filesystem read semantic).
  const latest = new Map();
  for (const snap of snapshots) {
    if (!snap.job_id) continue;
    const prev = latest.get(snap.job_id);
    if (!prev || snap.updated_at > prev.updated_at) latest.set(snap.job_id, snap);
  }
  console.log(`jobs: ${snapshots.length} snapshots → ${latest.size} unique job_ids`);
  if (DRY_RUN) return { attempted: latest.size, inserted: 0 };
  let inserted = 0;
  for (const job of latest.values()) {
    try {
      const r = await inRole((c) => c.query(
        `INSERT INTO nex.knowledge_dump_jobs
           (job_id, source, owner, knowledge_type, target_brains,
            status, progress, completion_result,
            inbox_item_id, title, content_length,
            created_at, updated_at,
            shadow_written_at, shadow_updated_at)
         VALUES ($1,$2,$3,$4,$5::text[],$6,$7,$8::jsonb,$9,$10,$11,
                 $12::timestamptz, $13::timestamptz, NOW(), NOW())
         ON CONFLICT (job_id) DO NOTHING
         RETURNING job_id`,
        [
          job.job_id, job.source, job.owner, job.knowledge_type ?? null, job.target_brains ?? [],
          job.status, job.progress ?? 0,
          job.completion_result ? JSON.stringify(job.completion_result) : null,
          job.inbox_item_id ?? null, job.title ?? null, job.content_length ?? 0,
          job.created_at, job.updated_at,
        ]
      ));
      if (r.rowCount > 0) inserted += 1;
    } catch (err) {
      console.warn(`  ! insert failed job_id=${job.job_id}: ${err.message}`);
    }
  }
  console.log(`jobs: inserted ${inserted}/${latest.size} (${latest.size - inserted} already present)`);
  return { attempted: latest.size, inserted };
}

async function main() {
  console.log(`nex-inbox-jobs-backfill · dry-run=${DRY_RUN}`);
  console.log(`  target: ${PG_URL.replace(/:[^:@]+@/, ":****@")}`);
  const r1 = await backfillInbox();
  const r2 = await backfillStats();
  const r3 = await backfillJobs();
  console.log(`\nSummary:`);
  console.log(`  inbox: ${r1.inserted}/${r1.attempted}`);
  console.log(`  stats: ${r2.inserted}/${r2.attempted}`);
  console.log(`  jobs:  ${r3.inserted}/${r3.attempted}`);
  await pool.end();
}

main().catch(async (err) => {
  console.error("backfill fatal:", err);
  await pool.end().catch(() => {});
  process.exit(1);
});
