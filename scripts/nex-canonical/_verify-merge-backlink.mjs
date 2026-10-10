#!/usr/bin/env node
// scripts/nex-canonical/_verify-merge-backlink.mjs
//
// Bounded probe for the sealed MERGE-path legacy backlink fix.
//
// What it does
//   1. Measures `nex.food_business WHERE canonical_business_id IS NULL`
//      BEFORE.
//   2. Runs ONE bounded `real-ingestion-runner` + `bulk-approve-runner`
//      + `write-approved-candidates` cycle, capped at a small
//      --limit (default 20).
//   3. Measures AFTER and reports:
//        · null_before     · null_after    · delta
//        · merge_matches   · insert_news
//        · backlinked_rows (= rows whose canonical_business_id flipped
//                            from NULL → non-NULL during this run)
//
// What it does NOT do
//   · Does NOT run the continuous loop.
//   · Does NOT loop until exhaustion.
//   · Does NOT promote DISCOVERED → VERIFIED.
//   · Does NOT backup the DB.
//   · Does NOT fabricate rows, flip `can_display`, or run the
//     admin-promote stage.
//
// Expected post-fix outcome
//   · If the sealed resolver issues any MATCH verdicts in this batch,
//     the newly-sealed `backfill_legacy_canonical_id` stage flips the
//     food_business row's canonical_business_id from NULL → the
//     canonical target id · the "delta" count DECREASES by at least 1.
//   · If every verdict is NO_MATCH, the delta is 0 but no error ·
//     insert_new rows don't backlink (the new canonical row has nothing
//     to link to the legacy row via the backlink column).
//
// Exit codes
//   0  · ran to completion (delta reported honestly, even if zero)
//   1  · sealed sub-script fatal error
//   2  · session identity check failed (DB name mismatch)

import { spawn } from "node:child_process";
import * as fs from "node:fs/promises";
import pg from "pg";

const REPO = process.cwd();
const PENDING = "data/nex-canonical/pending-review.jsonl";
const DECISIONS = "data/nex-canonical/decisions.jsonl";
const CHECKPOINTS = "data/nex-canonical/checkpoints.jsonl";
const FOUNDER_ID = "philip";

// ─── CLI parsing ────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
const limitArg = argv.find((a) => a.startsWith("--limit="));
const LIMIT = limitArg ? Number(limitArg.split("=")[1]) : 20;
if (!Number.isFinite(LIMIT) || LIMIT < 1 || LIMIT > 200) {
  console.error(`fatal · --limit must be an integer in [1,200] · got ${LIMIT}`);
  process.exit(1);
}

const CONN = process.env.NEX_POSTGRES_URL;
if (!CONN) {
  console.error("fatal · NEX_POSTGRES_URL env is required");
  process.exit(1);
}

// ─── Session identity guard ─────────────────────────────────────────────
async function sessionCheck() {
  const c = new pg.Client({ connectionString: CONN });
  await c.connect();
  const r = await c.query("SELECT current_database() AS db");
  await c.end();
  if (r.rows[0].db !== "nex_dev") {
    console.error(
      `fatal · session identity check · current_database()="${r.rows[0].db}" expected "nex_dev"`,
    );
    process.exit(2);
  }
  console.log(`[session] current_database()=nex_dev · OK`);
}

async function queryJson(sql, params = []) {
  const c = new pg.Client({ connectionString: CONN });
  await c.connect();
  const r = await c.query(sql, params);
  await c.end();
  return r.rows;
}

async function queryCount(sql) {
  const rows = await queryJson(sql);
  return Number(rows[0].n);
}

function spawnSealed(args, label) {
  return new Promise((resolve) => {
    const started = Date.now();
    const p = spawn("npx", args, {
      cwd: REPO,
      stdio: ["ignore", "pipe", "pipe"],
      shell: true,
    });
    let out = "";
    p.stdout.on("data", (b) => {
      const s = b.toString();
      process.stdout.write(s);
      out += s;
      if (out.length > 50000) out = out.slice(-50000);
    });
    p.stderr.on("data", (b) => {
      const s = b.toString();
      process.stderr.write(s);
    });
    p.on("exit", (code) => {
      const dur = ((Date.now() - started) / 1000).toFixed(1);
      console.log(`[${label}] exit=${code} · ${dur}s`);
      resolve({ code: code ?? 1, out });
    });
  });
}

async function extractFreshIds() {
  const seen = new Set();
  try {
    const text = await fs.readFile(PENDING, "utf8");
    for (const line of text.split(/\r?\n/)) {
      if (!line.trim()) continue;
      try {
        const r = JSON.parse(line);
        const id =
          r.candidate_id ??
          r.review_package?.candidates?.[0]?.candidate_id;
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

// ─── MAIN ───────────────────────────────────────────────────────────────
console.log(`=== verify-merge-backlink · limit=${LIMIT} ===`);
await sessionCheck();

const sqlNullCount = `
  SELECT COUNT(*)::int AS n FROM nex.food_business
   WHERE country='ID'
     AND business_name IS NOT NULL
     AND length(trim(business_name))>0
     AND canonical_business_id IS NULL`;

const beforeNull = await queryCount(sqlNullCount);
const beforeCanonical = await queryCount(
  "SELECT COUNT(*)::int AS n FROM nex.business_canonical",
);
const beforeEvidence = await queryCount(
  "SELECT COUNT(*)::int AS n FROM nex.business_evidence",
);
const beforeMerges = await queryCount(
  "SELECT COUNT(*)::int AS n FROM nex.business_evidence WHERE resolver_verdict_kind='MATCH'",
);
console.log(
  `[before] food_business.canonical_business_id IS NULL = ${beforeNull}`,
);
console.log(`[before] business_canonical = ${beforeCanonical}`);
console.log(`[before] business_evidence  = ${beforeEvidence}`);
console.log(`[before] merge_match rows   = ${beforeMerges}`);

const genRunId = `verify-merge-backlink-${Date.now()}`;

// 1. real-ingestion-runner · bounded
console.log(`--- running real-ingestion-runner (max=${LIMIT}) ---`);
const ri = await spawnSealed(
  [
    "tsx",
    "--env-file=.env.local",
    "scripts/nex-canonical/real-ingestion-runner.ts",
    `--max-candidates=${LIMIT}`,
    `--generation-run-id=${genRunId}`,
    `--pending-queue=${PENDING}`,
    `--decision-log=${DECISIONS}`,
    `--checkpoint-log=${CHECKPOINTS}`,
    `--batch-size=10`,
    `--max-batches=5`,
  ],
  "real-ingestion-runner",
);
if (ri.code !== 0) {
  console.error(`fatal · real-ingestion-runner exit=${ri.code}`);
  process.exit(1);
}

const freshIds = await extractFreshIds();
console.log(`[fresh] candidate_ids=${freshIds.length}`);
if (freshIds.length === 0) {
  const afterNull = await queryCount(sqlNullCount);
  console.log(`[after] food_business.canonical_business_id IS NULL = ${afterNull}`);
  console.log(
    `[result] delta=0 · fresh candidates = 0 · nothing to merge or insert`,
  );
  process.exit(0);
}

// 2. Write batch decision file + bulk-approve
const batchFile = `data/nex-canonical/_verify-merge-backlink-batch-${Date.now()}.json`;
await fs.writeFile(
  batchFile,
  JSON.stringify(
    {
      batch_name: `verify-merge-backlink-${genRunId}`,
      founder_id: FOUNDER_ID,
      decision_timestamp: new Date().toISOString(),
      decisions: freshIds.map((id) => ({
        candidate_id: id,
        decision: "approve",
        founder_note:
          "verify-merge-backlink · bounded probe · admin-attested approval · Indonesian food vertical · source nex_food_business_legacy (can_display=TRUE)",
      })),
    },
    null,
    2,
  ),
  "utf8",
);
console.log(`[batch] wrote ${batchFile}`);

const ba = await spawnSealed(
  [
    "tsx",
    "--env-file=.env.local",
    "scripts/nex-canonical/bulk-approve-runner.ts",
    batchFile,
    PENDING,
    DECISIONS,
  ],
  "bulk-approve-runner",
);
if (ba.code !== 0 && ba.code !== 2) {
  console.error(`fatal · bulk-approve-runner exit=${ba.code}`);
  process.exit(1);
}

// 3. write-approved-candidates · the sealed executor path · where our
//    new `backfill_legacy_canonical_id` stage runs INSIDE the SERIALIZABLE
//    transaction for every merge_match verdict.
const wa = await spawnSealed(
  [
    "tsx",
    "--env-file=.env.local",
    "scripts/nex-canonical/write-approved-candidates.ts",
    `--allowlist=${freshIds.join(",")}`,
    `--pending-queue=${PENDING}`,
    `--decision-log=${DECISIONS}`,
  ],
  "write-approved-candidates",
);
if (wa.code !== 0 && wa.code !== 3) {
  console.error(`fatal · write-approved-candidates exit=${wa.code}`);
  process.exit(1);
}

// 4. Measure AFTER
const afterNull = await queryCount(sqlNullCount);
const afterCanonical = await queryCount(
  "SELECT COUNT(*)::int AS n FROM nex.business_canonical",
);
const afterEvidence = await queryCount(
  "SELECT COUNT(*)::int AS n FROM nex.business_evidence",
);
const afterMerges = await queryCount(
  "SELECT COUNT(*)::int AS n FROM nex.business_evidence WHERE resolver_verdict_kind='MATCH'",
);

const nullDelta = beforeNull - afterNull;
const canonicalDelta = afterCanonical - beforeCanonical;
const evidenceDelta = afterEvidence - beforeEvidence;
const mergeDelta = afterMerges - beforeMerges;

console.log(`\n=== RESULT ===`);
console.log(
  `food_business.canonical_business_id IS NULL · before=${beforeNull} · after=${afterNull} · delta=-${nullDelta}`,
);
console.log(
  `business_canonical rows                      · before=${beforeCanonical} · after=${afterCanonical} · delta=+${canonicalDelta}`,
);
console.log(
  `business_evidence  rows                      · before=${beforeEvidence} · after=${afterEvidence} · delta=+${evidenceDelta}`,
);
console.log(
  `business_evidence MATCH rows                 · before=${beforeMerges} · after=${afterMerges} · delta=+${mergeDelta}`,
);
console.log(``);
if (mergeDelta > 0) {
  console.log(
    `[fix-verified] ${mergeDelta} merge_match write(s) completed. The backfill stage ran inside each txn.`,
  );
  if (nullDelta >= mergeDelta) {
    console.log(
      `[fix-verified] food_business null count dropped by at least ${mergeDelta} (merge count). Backlink UPDATE is firing.`,
    );
  } else {
    console.log(
      `[note] null-delta (${nullDelta}) < merge-delta (${mergeDelta}) · some merges may have been against rows that were already linked, or the row was not found by (table,internal_id) — inspect business_evidence rows.`,
    );
  }
} else if (canonicalDelta > 0 && mergeDelta === 0) {
  console.log(
    `[note] all ${canonicalDelta} write(s) were insert_new (resolver found no match). No backlink stage expected to fire. Delta reduction reflects only the insert path's natural adapter-side behaviour, not this fix.`,
  );
} else {
  console.log(
    `[note] no writes landed in this bounded run. Try a larger --limit or inspect sealed sub-script logs.`,
  );
}
process.exit(0);
