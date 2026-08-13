#!/usr/bin/env node
// parity-report.mjs · Phase 11.2 shadow observation
//
// Compares data/knowledge-inbox/index.json + stats.json + data/nex-jobs/
// jobs.jsonl against nex.knowledge_inbox + nex.knowledge_inbox_stats +
// nex.knowledge_dump_jobs. Reports concrete drift per dimension:
//
//   · total counts
//   · ID set intersection / symmetric difference
//   · hash set intersection / symmetric difference
//   · status distribution
//   · fs-only rows (missing from Postgres)
//   · pg-only rows (Postgres has rows filesystem doesn't)
//   · per-item status mismatch
//   · jobs: same, plus per-job status parity
//
// Any unexplained drift row is a blocker for 11.3. This script does
// NOT mutate anything · pure read-and-compare.

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

const PG_URL = process.env.NEX_POSTGRES_URL || "postgresql://postgres:Admin1phil@localhost:5433/nex_dev";
const pool   = new Pool({ connectionString: PG_URL, max: 2 });

const label = process.argv[2] || "snapshot";

function readJson(p) {
  try { return JSON.parse(fs.readFileSync(p, "utf8")); }
  catch (e) { if (e.code === "ENOENT") return null; throw e; }
}
function readJsonl(p) {
  try {
    return fs.readFileSync(p, "utf8").split("\n").filter(Boolean)
      .map((l) => { try { return JSON.parse(l); } catch { return null; } })
      .filter(Boolean);
  } catch (e) { if (e.code === "ENOENT") return []; throw e; }
}
function setDiff(a, b) {
  const out = [];
  for (const x of a) if (!b.has(x)) out.push(x);
  return out;
}
function bucket(arr, key) {
  const m = {};
  for (const x of arr) m[x[key]] = (m[x[key]] ?? 0) + 1;
  return m;
}

async function main() {
  const now = new Date().toISOString();
  console.log(`\n═══════════════════════════════════════════════════════════════`);
  console.log(`  PARITY REPORT · ${label} · ${now}`);
  console.log(`═══════════════════════════════════════════════════════════════\n`);

  // ── Inbox ──────────────────────────────────────────────────────────
  const fsItems = readJson(INBOX_JSON) ?? [];
  const pgResult = await pool.query(
    `SELECT id, title, kind, status, source, hash,
            created_at_ms, created_at_iso,
            processed_at_ms
       FROM nex.knowledge_inbox
      ORDER BY created_at_iso DESC`
  );
  const pgItems = pgResult.rows;

  const fsIds   = new Set(fsItems.map((x) => x.id));
  const pgIds   = new Set(pgItems.map((x) => x.id));
  const fsHash  = new Set(fsItems.map((x) => x.hash));
  const pgHash  = new Set(pgItems.map((x) => x.hash));

  const fsOnlyIds = setDiff(fsIds, pgIds);
  const pgOnlyIds = setDiff(pgIds, fsIds);
  const fsOnlyHash = setDiff(fsHash, pgHash);
  const pgOnlyHash = setDiff(pgHash, fsHash);

  const fsStatuses = bucket(fsItems, "status");
  const pgStatuses = bucket(pgItems, "status");

  // Per-item status drift on IDs present in both stores
  const commonIds = [...fsIds].filter((id) => pgIds.has(id));
  const statusMismatch = [];
  const fsById = new Map(fsItems.map((x) => [x.id, x]));
  const pgById = new Map(pgItems.map((x) => [x.id, x]));
  for (const id of commonIds) {
    const f = fsById.get(id);
    const p = pgById.get(id);
    if (f && p && f.status !== p.status) {
      statusMismatch.push({ id, fs: f.status, pg: p.status });
    }
  }

  console.log(`INBOX ───────────────────────────────────────────────────────`);
  console.log(`  fs total:     ${fsItems.length}`);
  console.log(`  pg total:     ${pgItems.length}`);
  console.log(`  common ids:   ${commonIds.length}`);
  console.log(`  fs-only ids:  ${fsOnlyIds.length}${fsOnlyIds.length ? " · " + fsOnlyIds.slice(0, 5).join(", ") + (fsOnlyIds.length > 5 ? " ..." : "") : ""}`);
  console.log(`  pg-only ids:  ${pgOnlyIds.length}${pgOnlyIds.length ? " · " + pgOnlyIds.slice(0, 5).join(", ") + (pgOnlyIds.length > 5 ? " ..." : "") : ""}`);
  console.log(`  fs-only hash: ${fsOnlyHash.length}${fsOnlyHash.length ? " · " + fsOnlyHash.slice(0, 3).map((h) => h.slice(0, 10)).join(", ") : ""}`);
  console.log(`  pg-only hash: ${pgOnlyHash.length}${pgOnlyHash.length ? " · " + pgOnlyHash.slice(0, 3).map((h) => h.slice(0, 10)).join(", ") : ""}`);
  console.log(`  status fs:    ${JSON.stringify(fsStatuses)}`);
  console.log(`  status pg:    ${JSON.stringify(pgStatuses)}`);
  console.log(`  status drift: ${statusMismatch.length}${statusMismatch.length ? " · " + statusMismatch.slice(0, 5).map((x) => `${x.id.slice(-10)}:${x.fs}!=${x.pg}`).join(", ") : ""}`);

  // ── Stats ──────────────────────────────────────────────────────────
  const fsStats = readJson(STATS_JSON) ?? {};
  const pgStatsRes = await pool.query(
    `SELECT stat_date::text, completed_today, images_analysed_lifetime,
            voice_notes_transcribed_lifetime, last_processed_at_ms
       FROM nex.knowledge_inbox_stats
      ORDER BY stat_date DESC`
  );
  const pgStatsRows = pgStatsRes.rows;
  const pgStatsForDate = pgStatsRows.find((r) => r.stat_date === fsStats.completedTodayDate);

  console.log(`\nSTATS ───────────────────────────────────────────────────────`);
  console.log(`  fs date:                ${fsStats.completedTodayDate ?? "—"}`);
  console.log(`  fs completedToday:      ${fsStats.completedToday ?? "—"}`);
  console.log(`  fs imagesAnalysed:      ${fsStats.imagesAnalysed ?? "—"}`);
  console.log(`  fs voiceNotesTrans:     ${fsStats.voiceNotesTranscribed ?? "—"}`);
  console.log(`  fs lastProcessedAt:     ${fsStats.lastProcessedAt ?? "—"}`);
  console.log(`  pg rows:                ${pgStatsRows.length}`);
  if (pgStatsForDate) {
    console.log(`  pg (same date):         completed=${pgStatsForDate.completed_today} img=${pgStatsForDate.images_analysed_lifetime} voice=${pgStatsForDate.voice_notes_transcribed_lifetime} last=${pgStatsForDate.last_processed_at_ms}`);
    const matches = Number(pgStatsForDate.completed_today) === Number(fsStats.completedToday ?? 0)
                 && Number(pgStatsForDate.images_analysed_lifetime) === Number(fsStats.imagesAnalysed ?? 0)
                 && Number(pgStatsForDate.voice_notes_transcribed_lifetime) === Number(fsStats.voiceNotesTranscribed ?? 0);
    console.log(`  stats parity:           ${matches ? "OK" : "DRIFT"}`);
  } else {
    console.log(`  pg (same date):         MISSING`);
  }

  // ── Jobs ───────────────────────────────────────────────────────────
  const fsJobSnapshots = readJsonl(JOBS_JSONL);
  const fsJobsLatest = new Map();
  for (const s of fsJobSnapshots) {
    if (!s.job_id) continue;
    const prev = fsJobsLatest.get(s.job_id);
    if (!prev || s.updated_at > prev.updated_at) fsJobsLatest.set(s.job_id, s);
  }
  const pgJobsRes = await pool.query(
    `SELECT job_id, source, owner, status, progress, inbox_item_id, created_at, updated_at
       FROM nex.knowledge_dump_jobs
      ORDER BY updated_at DESC`
  );
  const pgJobs = pgJobsRes.rows;
  const pgJobsMap = new Map(pgJobs.map((j) => [j.job_id, j]));

  const fsJobIds = new Set(fsJobsLatest.keys());
  const pgJobIds = new Set(pgJobsMap.keys());
  const fsOnlyJobs = setDiff(fsJobIds, pgJobIds);
  const pgOnlyJobs = setDiff(pgJobIds, fsJobIds);
  const jobStatusMismatch = [];
  for (const jid of fsJobIds) {
    if (!pgJobsMap.has(jid)) continue;
    const f = fsJobsLatest.get(jid);
    const p = pgJobsMap.get(jid);
    if (f.status !== p.status) jobStatusMismatch.push({ jid, fs: f.status, pg: p.status });
  }

  const fsJobStatus = bucket([...fsJobsLatest.values()], "status");
  const pgJobStatus = bucket(pgJobs, "status");

  console.log(`\nJOBS ────────────────────────────────────────────────────────`);
  console.log(`  fs snapshots:  ${fsJobSnapshots.length}`);
  console.log(`  fs unique:     ${fsJobsLatest.size}`);
  console.log(`  pg total:      ${pgJobs.length}`);
  console.log(`  fs-only:       ${fsOnlyJobs.length}${fsOnlyJobs.length ? " · " + fsOnlyJobs.slice(0, 3).join(", ") : ""}`);
  console.log(`  pg-only:       ${pgOnlyJobs.length}${pgOnlyJobs.length ? " · " + pgOnlyJobs.slice(0, 3).join(", ") : ""}`);
  console.log(`  status fs:     ${JSON.stringify(fsJobStatus)}`);
  console.log(`  status pg:     ${JSON.stringify(pgJobStatus)}`);
  console.log(`  status drift:  ${jobStatusMismatch.length}${jobStatusMismatch.length ? " · " + jobStatusMismatch.slice(0, 5).map((x) => `${x.jid.slice(-8)}:${x.fs}!=${x.pg}`).join(", ") : ""}`);

  // ── Verdict ────────────────────────────────────────────────────────
  const drift =
    fsOnlyIds.length + pgOnlyIds.length +
    fsOnlyHash.length + pgOnlyHash.length +
    statusMismatch.length +
    fsOnlyJobs.length + pgOnlyJobs.length +
    jobStatusMismatch.length;

  console.log(`\nVERDICT ─────────────────────────────────────────────────────`);
  console.log(`  drift rows: ${drift}`);
  console.log(`  status:     ${drift === 0 ? "PARITY" : "DRIFT PRESENT · investigate"}`);
  console.log(`\n═══════════════════════════════════════════════════════════════\n`);

  await pool.end();
  process.exit(drift === 0 ? 0 : 2);
}

main().catch(async (err) => {
  console.error("parity-report fatal:", err);
  await pool.end().catch(() => {});
  process.exit(1);
});
