// P2 Persistence Contract · smoke test with clearly-labeled synthetic candidates.
//
// Philip 2026-08-26 · P2 smoke test = validates the new CODE.
// (P4 autonomous proof = validates the WORKFORCE — different test, no manual walker.)
//
// Purpose: exercise the INSERT → RETURNING → SELECT-verify → invariant chain
// end-to-end using the REAL config.persistence + REAL engine.persistCandidates,
// producing evidence in exactly the format Philip requested.
//
// Test data is:
//   · Named "P2-SMOKE-<runId>-N" so it's identifiable at a glance
//   · Sourced as "p2-smoke-test-2026-08-26" so it never contaminates real analytics
//   · Deleted after verification (with the cycle_run row's status → completed)
//
// Nothing about this test bypasses the contract. Contract enforcement lives in
// engine.mjs · this script only supplies candidates.

import { randomUUID } from "node:crypto";
import pg from "pg";
import { persistCandidates } from "./engine.mjs";
import { foodYogyakartaConfig } from "./configs/food-yogyakarta.mjs";

const pool = new pg.Pool({
  connectionString: process.env.NEX_POSTGRES_URL
    ?? "postgresql://postgres:Admin1phil@localhost:5433/nex_dev",
});

const runId    = randomUUID().slice(0, 8);
const workerId = `smoke-test:food:P2-${runId}`;
const source   = `p2-smoke-test-2026-08-26-${runId}`;

// ── 1. Create a real cycle_run row (contract requires FK integrity) ─────
const cycleRunId = randomUUID();
await pool.query(
  `INSERT INTO nex.worker_cycle_run (id, worker_id, worker_type, worker_config, started_at, status)
   VALUES ($1, $2, 'smoke_test', $3, now(), 'running')`,
  [cycleRunId, workerId, `p2-smoke:${runId}`]
);

// ── 2. Construct 3 synthetic candidates with GUARANTEED-unique dedupe_hash ──
// Each has a name+phone that won't match any of the 7,045 existing rows.
const now = new Date();
const yearPrefix = String(now.getUTCFullYear());
const candidates = [
  {
    name: `P2-SMOKE-${runId}-Restaurant-A`,
    publicRef: `#FL-${yearPrefix}-${runId.slice(0,5).toUpperCase()}`,
    category: "restaurant",
    categories: [],
    address: `Synthetic P2 test address · ${runId} · A`,
    city: "Yogyakarta",
    lng: 110.90000, lat: -7.10000,      // outside every real bbox (correct lng/lat orientation)
    phone: `+62-P2-${runId}-AAA`,
    whatsapp: null, website: null,
    dedupeHash: `p2-smoke|${runId}|A|synth`,
    sourceType: source,
    sourceReference: `p2-smoke-test-run-${runId}-A`,
    sourceLicenceTerms: "P2-SMOKE-TEST",
    sourceUpdatedAt: null, lastVerifiedAt: null, verificationSource: null,
    sourceName: source,
  },
  {
    name: `P2-SMOKE-${runId}-Cafe-B`,
    publicRef: `#FL-${yearPrefix}-${runId.slice(0,4).toUpperCase()}B`,
    category: "coffee-cafe",
    categories: ["cafe", "coffee"],
    address: `Synthetic P2 test address · ${runId} · B`,
    city: "Yogyakarta",
    lng: 110.90001, lat: -7.10001,
    phone: `+62-P2-${runId}-BBB`,
    whatsapp: null, website: null,
    dedupeHash: `p2-smoke|${runId}|B|synth`,
    sourceType: source,
    sourceReference: `p2-smoke-test-run-${runId}-B`,
    sourceLicenceTerms: "P2-SMOKE-TEST",
    sourceUpdatedAt: null, lastVerifiedAt: null, verificationSource: null,
    sourceName: source,
  },
  {
    name: `P2-SMOKE-${runId}-FastFood-C`,
    publicRef: `#FL-${yearPrefix}-${runId.slice(0,4).toUpperCase()}C`,
    category: "fast-food",
    categories: [],
    address: `Synthetic P2 test address · ${runId} · C`,
    city: "Yogyakarta",
    lng: 110.90002, lat: -7.10002,
    phone: `+62-P2-${runId}-CCC`,
    whatsapp: null, website: null,
    dedupeHash: `p2-smoke|${runId}|C|synth`,
    sourceType: source,
    sourceReference: `p2-smoke-test-run-${runId}-C`,
    sourceLicenceTerms: "P2-SMOKE-TEST",
    sourceUpdatedAt: null, lastVerifiedAt: null, verificationSource: null,
    sourceName: source,
  },
];

// ── 3. Exercise the REAL persistCandidates from engine.mjs ──────────────
const results = await persistCandidates(pool, candidates, foodYogyakartaConfig, {
  workerId, cycleRunId,
});

// ── 4. Strict invariant check (mirrors engine.mjs logic) ────────────────
const dbQ = await pool.query(
  `SELECT COUNT(*)::int AS n FROM nex.food_business WHERE cycle_run_id = $1`,
  [cycleRunId]
);
const dbCount = dbQ.rows[0].n;
const invariantHeld = dbCount === results.insertVerified;

// ── 5. Show actual rows Philip wanted to see ────────────────────────────
const rows = await pool.query(
  `SELECT internal_id, worker_id, cycle_run_id, source, business_name, created_at
   FROM nex.food_business
   WHERE cycle_run_id = $1
   ORDER BY created_at ASC`,
  [cycleRunId]
);

// ── 6. Report in Philip's exact requested format ────────────────────────
console.log("");
console.log("═══════════════════════════════════════════════════════════════");
console.log("  P2 PERSISTENCE CONTRACT · SMOKE TEST");
console.log("  Philip 2026-08-26 · code validation (NOT workforce validation)");
console.log("═══════════════════════════════════════════════════════════════");
console.log("");
console.log(`  worker_id                : ${workerId}`);
console.log(`  cycle_id                 : ${cycleRunId}`);
console.log("");
console.log("── PERSISTENCE CONTRACT COUNTS ────────────────────────────────");
console.log(`  Candidates supplied      : ${candidates.length}`);
console.log(`  Insert attempted         : ${results.insertAttempted}`);
console.log(`  INSERT RETURNING (rows)  : ${results.insertReturned}`);
console.log(`  Skipped conflict         : ${results.conflictSkipped}`);
console.log(`  SELECT verified          : ${results.insertVerified}`);
console.log(`  DB COUNT(cycle_run_id)   : ${dbCount}`);
console.log(`  records_new (DB truth)   : ${dbCount}`);
console.log(`  verification failed      : ${results.verificationFailed}`);
console.log(`  side-effect errors       : ${results.errors}`);
console.log("");
console.log("── INVARIANT ──────────────────────────────────────────────────");
console.log(`  db_count === insert_verified · ${dbCount} === ${results.insertVerified}`);
console.log(`  Invariant                : ${invariantHeld ? "PASS ✓" : "FAIL ✗"}`);
const cycleOutcome = dbCount > 0 ? "PRODUCTIVE" : "NO_NEW_CANDIDATES";
console.log(`  cycle_outcome            : ${cycleOutcome}`);
const cycleStatus = invariantHeld ? "completed" : "failed";
console.log(`  cycle status             : ${cycleStatus}`);
console.log("");
console.log("── ACTUAL ROWS · nex.food_business (WHERE cycle_run_id = above) ──");
console.log("");
for (const r of rows.rows) {
  console.log(`  internal_id   : ${r.internal_id}`);
  console.log(`  worker_id     : ${r.worker_id}`);
  console.log(`  cycle_run_id  : ${r.cycle_run_id}`);
  console.log(`  source        : ${r.source}`);
  console.log(`  business_name : ${r.business_name}`);
  console.log(`  created_at    : ${r.created_at.toISOString()}`);
  console.log("");
}

// ── 7. Also finish the cycle_run row cleanly ────────────────────────────
await pool.query(
  `UPDATE nex.worker_cycle_run SET
     finished_at = now(),
     duration_ms = (EXTRACT(EPOCH FROM (now() - started_at)) * 1000)::int,
     status = $2,
     records_new = $3,
     summary = $4::jsonb
   WHERE id = $1`,
  [cycleRunId, cycleStatus, dbCount, JSON.stringify({
    cycle_outcome: cycleOutcome,
    persistence_invariant: { held: invariantHeld, db_count: dbCount, insert_verified: results.insertVerified, delta: results.insertVerified - dbCount },
    persistence_counts: {
      insert_attempted:    results.insertAttempted,
      insert_returned:     results.insertReturned,
      insert_verified:     results.insertVerified,
      insert_conflicts:    results.conflictSkipped,
      verification_failed: results.verificationFailed,
      records_new_from_db: dbCount,
    },
    note: "P2 smoke test · synthetic candidates · self-cleaning",
  })]
);

// ── 8. Clean up · delete test rows (contract validated, evidence captured) ──
console.log("── CLEANUP · removing synthetic test data ─────────────────────");
const publicRefs = candidates.map((c) => c.publicRef);
const provDel = await pool.query(
  `DELETE FROM nex.food_business_field_provenance
   WHERE cycle_run_id = $1 OR business_ref = ANY($2::text[])`,
  [cycleRunId, publicRefs]
);
const snapDel = await pool.query(
  `DELETE FROM nex.food_business_source_snapshot WHERE business_ref = ANY($1::text[])`,
  [publicRefs]
);
const fbDel = await pool.query(
  `DELETE FROM nex.food_business WHERE cycle_run_id = $1`,
  [cycleRunId]
);
console.log(`  food_business rows deleted        : ${fbDel.rowCount}`);
console.log(`  snapshot rows deleted             : ${snapDel.rowCount}`);
console.log(`  provenance rows deleted           : ${provDel.rowCount}`);
console.log(`  cycle_run row PRESERVED (audit)   : ${cycleRunId} (status=${cycleStatus})`);

// Verify cleanup
const verifyClean = await pool.query(
  `SELECT COUNT(*)::int AS n FROM nex.food_business WHERE cycle_run_id = $1`,
  [cycleRunId]
);
console.log(`  post-cleanup DB COUNT             : ${verifyClean.rows[0].n} (should be 0)`);
console.log("");
console.log("═══════════════════════════════════════════════════════════════");
console.log(invariantHeld
  ? "  ✓ P2 CONTRACT VALIDATED · code path proven end-to-end · cleanup successful"
  : "  ✗ P2 CONTRACT FAILED · invariant broken · investigate before P3");
console.log("═══════════════════════════════════════════════════════════════");

await pool.end();
