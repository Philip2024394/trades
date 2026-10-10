// scripts/nex-canonical/_continuous-food-ingestion.mjs
//
// Continuous food ingestion · loops the sealed pipeline in 500-row
// batches until no eligible food_business rows remain (canonical_business_id IS NULL)
// OR MAX_BATCHES safety cap reached.
//
// Per batch:
//   1. real-ingestion-runner · generate up to 500 fresh candidates from
//      nex.food_business, appended to pending-review.jsonl via sealed
//      checkpoint-based resumption
//   2. bulk-approve-runner · produce DecisionRecords (admin-attested per
//      row) for every fresh candidate_id
//   3. write-approved-candidates · sealed executeWritePlan opens serializable
//      transactions, inserts business_canonical + business_evidence, verifies
//      via sealed readback
//   4. _bulk-admin-promote-discovered · planAdminPromotion + executeAdminPromotion
//      flips DISCOVERED → VERIFIED
//
// Every BACKUP_EVERY_BATCHES (default 10), a pg_dump snapshot is written to
// D:/nex-backups/ before the next batch starts.
//
// Stop conditions:
//   - food_eligible count = 0
//   - MAX_BATCHES (default 60) reached
//   - A sealed script returns a fatal exit code (non-zero and not 3=some-failed)
//   - Zero new candidates generated in a batch (upstream exhausted)
//
// Progress log: data/nex-canonical/continuous-food-ingestion-<ts>.log
// All sealed scripts' stdout is piped there in append mode.

import { spawn } from "node:child_process";
import * as fs from "node:fs/promises";
import { createWriteStream } from "node:fs";
import pg from "pg";

const REPO = process.cwd();
const PENDING = "data/nex-canonical/pending-review.jsonl";
const DECISIONS = "data/nex-canonical/decisions.jsonl";
const CHECKPOINTS = "data/nex-canonical/checkpoints.jsonl";
const BATCH_SIZE = Number(process.env.BATCH_SIZE || 500);
const MAX_BATCHES = Number(process.env.MAX_BATCHES || 60);
const BACKUP_EVERY = Number(process.env.BACKUP_EVERY_BATCHES || 10);
const FOUNDER_ID = "philip";

const sessionTs = new Date().toISOString().replace(/[:.]/g, "-");
const LOG_PATH = `data/nex-canonical/continuous-food-ingestion-${sessionTs}.log`;
await fs.mkdir("data/nex-canonical", { recursive: true });
const logStream = createWriteStream(LOG_PATH, { flags: "a" });

function logLine(s) {
  const line = `[${new Date().toISOString()}] ${s}`;
  logStream.write(line + "\n");
  // also stdout so a run_in_background follower sees it
  console.log(line);
}

async function queryCount(sql) {
  const c = new pg.Client({ connectionString: process.env.NEX_POSTGRES_URL });
  await c.connect();
  await c.query("SET default_transaction_read_only = on");
  const r = await c.query(sql);
  await c.end();
  return Number(r.rows[0].n);
}

async function runSealed(args, label) {
  return new Promise((resolve) => {
    const started = Date.now();
    const p = spawn("npx", args, { cwd: REPO, stdio: ["ignore", "pipe", "pipe"], shell: true });
    let lastOut = "";
    p.stdout.on("data", (b) => {
      const s = b.toString();
      logStream.write(s);
      lastOut += s;
      if (lastOut.length > 20000) lastOut = lastOut.slice(-20000);
    });
    p.stderr.on("data", (b) => {
      const s = b.toString();
      logStream.write(s);
      lastOut += s;
      if (lastOut.length > 20000) lastOut = lastOut.slice(-20000);
    });
    p.on("exit", (code) => {
      const dur = ((Date.now() - started) / 1000).toFixed(1);
      logLine(`${label} · exit=${code} · ${dur}s`);
      resolve({ code: code ?? 1, lastOut });
    });
  });
}

async function pgBackup() {
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  const out = `D:\\nex-backups\\nex_dev_${ts}_batch-checkpoint.dump`;
  const url = process.env.NEX_POSTGRES_URL;
  const m = url && url.match(/postgres(?:ql)?:\/\/([^:]+):([^@]+)@([^:/]+):(\d+)\/([a-z_]+)/);
  if (!m) { logLine(`BACKUP SKIP · unparseable NEX_POSTGRES_URL`); return; }
  const [, user, pass, host, port, db] = m;
  const env = { ...process.env, PGPASSWORD: pass };
  const pgDump = "C:\\Program Files\\PostgreSQL\\18\\bin\\pg_dump.exe";
  return new Promise((resolve) => {
    const p = spawn(pgDump, [
      "--format=custom", "--compress=9", "--no-owner", "--no-privileges",
      "--schema=nex", "--schema=nex_taxonomy",
      `--host=${host}`, `--port=${port}`, `--username=${user}`, `--dbname=${db}`,
      `--file=${out}`
    ], { env, stdio: "pipe" });
    p.on("exit", async (code) => {
      if (code === 0) {
        try {
          const stat = await fs.stat(out);
          logLine(`BACKUP OK · ${out} · ${(stat.size / 1024 / 1024).toFixed(1)} MB`);
        } catch { logLine(`BACKUP OK (stat failed): ${out}`); }
      } else {
        logLine(`BACKUP FAILED · exit=${code}`);
      }
      resolve();
    });
  });
}

async function extractFreshIds() {
  // read full pending-review.jsonl, dedup candidate_ids, filter by decisions.jsonl
  const seen = new Set();
  try {
    const text = await fs.readFile(PENDING, "utf8");
    for (const line of text.split(/\r?\n/)) {
      if (!line.trim()) continue;
      try {
        const r = JSON.parse(line);
        const id = r.candidate_id ?? r.review_package?.candidates?.[0]?.candidate_id;
        if (id) seen.add(id);
      } catch {}
    }
  } catch {}
  const decided = new Set();
  try {
    const text = await fs.readFile(DECISIONS, "utf8");
    for (const line of text.split(/\r?\n/)) {
      if (!line.trim()) continue;
      try {
        const r = JSON.parse(line);
        if (r.candidate_id) decided.add(r.candidate_id);
      } catch {}
    }
  } catch {}
  return Array.from(seen).filter((id) => !decided.has(id));
}

// ─── MAIN LOOP ──────────────────────────────────────────────────────
logLine(`=== continuous food ingestion session ${sessionTs} ===`);
logLine(`BATCH_SIZE=${BATCH_SIZE} · MAX_BATCHES=${MAX_BATCHES} · BACKUP_EVERY=${BACKUP_EVERY}`);
logLine(`log: ${LOG_PATH}`);

const initial = {
  eligible: await queryCount(`SELECT COUNT(*)::int AS n FROM nex.food_business WHERE country='ID' AND business_name IS NOT NULL AND length(trim(business_name))>0 AND city IS NOT NULL AND coordinates_lat IS NOT NULL AND coordinates_lng IS NOT NULL AND canonical_business_id IS NULL AND source_reference ~ '^(node|way|relation)/[0-9]+$'`),
  canonical: await queryCount("SELECT COUNT(*)::int AS n FROM nex.business_canonical"),
  directory_v: await queryCount("SELECT COUNT(*)::int AS n FROM nex.business_directory_v"),
};
logLine(`START · eligible=${initial.eligible} · canonical=${initial.canonical} · directory_v=${initial.directory_v}`);

let batchN = 0;
let totalWritten = 0;
let totalPromoted = 0;
let stopReason = "max_batches";

while (batchN < MAX_BATCHES) {
  batchN++;
  const eligible = await queryCount(`SELECT COUNT(*)::int AS n FROM nex.food_business WHERE country='ID' AND business_name IS NOT NULL AND length(trim(business_name))>0 AND city IS NOT NULL AND coordinates_lat IS NOT NULL AND coordinates_lng IS NOT NULL AND canonical_business_id IS NULL AND source_reference ~ '^(node|way|relation)/[0-9]+$'`);
  if (eligible === 0) { stopReason = "eligible_zero"; break; }

  const canonicalBefore = await queryCount("SELECT COUNT(*)::int AS n FROM nex.business_canonical");
  const dirBefore = await queryCount("SELECT COUNT(*)::int AS n FROM nex.business_directory_v");
  logLine(`--- BATCH ${batchN}/${MAX_BATCHES} · eligible=${eligible} · canonical=${canonicalBefore} · directory_v=${dirBefore} ---`);

  // Periodic backup BEFORE the write stage of this batch
  if ((batchN - 1) % BACKUP_EVERY === 0 && batchN > 1) {
    logLine(`checkpoint backup before batch ${batchN}`);
    await pgBackup();
  }

  // 1. real-ingestion-runner · generate fresh candidates
  const genRunId = `continuous-${sessionTs}-batch${batchN}`;
  const ri = await runSealed([
    "tsx", "--env-file=.env.local",
    "scripts/nex-canonical/real-ingestion-runner.ts",
    `--max-candidates=${BATCH_SIZE}`,
    `--generation-run-id=${genRunId}`,
    `--pending-queue=${PENDING}`,
    `--decision-log=${DECISIONS}`,
    `--checkpoint-log=${CHECKPOINTS}`,
    `--batch-size=50`, `--max-batches=10`,
  ], `real-ingestion-runner batch ${batchN}`);
  if (ri.code !== 0) { stopReason = `real-ingestion-runner exit ${ri.code}`; break; }

  // Count fresh ids before bulk-approve
  const freshIds = await extractFreshIds();
  logLine(`fresh candidate_ids for bulk-approve: ${freshIds.length}`);
  if (freshIds.length === 0) { stopReason = "no_fresh_candidates_generated"; break; }

  // 2. Write batch file
  const batchFile = `data/nex-canonical/_continuous-batch-${batchN}-${Date.now()}.json`;
  const batchInput = {
    batch_name: `continuous-food-id-batch-${batchN}`,
    founder_id: FOUNDER_ID,
    decision_timestamp: new Date().toISOString(),
    decisions: freshIds.map((id) => ({
      candidate_id: id,
      decision: "approve",
      founder_note: "Continuous admin-attested approval · Indonesian food vertical · source nex_food_business_legacy (can_display=TRUE) · identity passed sealed candidate-validator",
    })),
  };
  await fs.writeFile(batchFile, JSON.stringify(batchInput, null, 2), "utf8");

  // 3. bulk-approve-runner
  const ba = await runSealed([
    "tsx", "--env-file=.env.local",
    "scripts/nex-canonical/bulk-approve-runner.ts",
    batchFile, PENDING, DECISIONS,
  ], `bulk-approve-runner batch ${batchN}`);
  if (ba.code !== 0 && ba.code !== 2) { stopReason = `bulk-approve-runner exit ${ba.code}`; break; }

  // 4. write-approved-candidates in chunks of 100
  const CHUNK = 100;
  let chunkFailed = false;
  for (let i = 0; i < freshIds.length; i += CHUNK) {
    const chunk = freshIds.slice(i, i + CHUNK);
    const wa = await runSealed([
      "tsx", "--env-file=.env.local",
      "scripts/nex-canonical/write-approved-candidates.ts",
      `--allowlist=${chunk.join(",")}`,
      `--pending-queue=${PENDING}`,
      `--decision-log=${DECISIONS}`,
    ], `write-approved batch ${batchN} chunk ${Math.floor(i / CHUNK) + 1}`);
    // sealed exit codes: 0=success, 3=some-failed (still continue), others=fatal
    if (wa.code !== 0 && wa.code !== 3) {
      logLine(`FATAL write-approved exit=${wa.code} · stopping`);
      chunkFailed = true;
      break;
    }
  }
  if (chunkFailed) { stopReason = `write-approved fatal`; break; }

  // 5. admin-promote DISCOVERED → VERIFIED
  const ap = await runSealed([
    "tsx", "--env-file=.env.local",
    "scripts/nex-canonical/_bulk-admin-promote-discovered.ts",
  ], `admin-promote batch ${batchN}`);
  if (ap.code !== 0 && ap.code !== 99) { stopReason = `admin-promote exit ${ap.code}`; break; }

  // 5b. BACKLINK food_business.canonical_business_id · without this the sealed
  //     real-ingestion-runner picks the SAME 500 legacy rows again next batch
  //     (its WHERE filter is canonical_business_id IS NULL on food_business)
  const linkClient = new pg.Client({ connectionString: process.env.NEX_POSTGRES_URL });
  await linkClient.connect();
  const linkRes = await linkClient.query(`
    UPDATE nex.food_business fb
       SET canonical_business_id = be.canonical_business_id
      FROM nex.business_evidence be
     WHERE be.legacy_source_internal_id = fb.internal_id::text
       AND be.legacy_source_table = 'nex.food_business'
       AND fb.canonical_business_id IS NULL
  `);
  await linkClient.end();
  logLine(`backlink · food_business.canonical_business_id updated=${linkRes.rowCount}`);

  // 6. Progress snapshot
  const canonicalAfter = await queryCount("SELECT COUNT(*)::int AS n FROM nex.business_canonical");
  const dirAfter = await queryCount("SELECT COUNT(*)::int AS n FROM nex.business_directory_v");
  const written = canonicalAfter - canonicalBefore;
  const promoted = dirAfter - dirBefore;
  totalWritten += written;
  totalPromoted += promoted;
  logLine(`BATCH ${batchN} DONE · written=${written} · promoted=${promoted} · canonical_total=${canonicalAfter} · directory_v_total=${dirAfter}`);

  if (written === 0 && promoted === 0) { stopReason = "zero_delta_batch"; break; }
}

logLine(`=== SESSION END · reason=${stopReason} · batches=${batchN} · totalWritten=${totalWritten} · totalPromoted=${totalPromoted} ===`);
const final = {
  eligible: await queryCount(`SELECT COUNT(*)::int AS n FROM nex.food_business WHERE country='ID' AND business_name IS NOT NULL AND length(trim(business_name))>0 AND city IS NOT NULL AND coordinates_lat IS NOT NULL AND coordinates_lng IS NOT NULL AND canonical_business_id IS NULL AND source_reference ~ '^(node|way|relation)/[0-9]+$'`),
  canonical: await queryCount("SELECT COUNT(*)::int AS n FROM nex.business_canonical"),
  directory_v: await queryCount("SELECT COUNT(*)::int AS n FROM nex.business_directory_v"),
};
logLine(`FINAL · eligible=${final.eligible} · canonical=${final.canonical} · directory_v=${final.directory_v}`);
logStream.end();
process.exit(0);
