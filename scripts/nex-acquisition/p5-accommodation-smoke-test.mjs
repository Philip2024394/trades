// P5 accommodation walker · synthetic persistence contract smoke test.
// Same pattern as p2-smoke-test.mjs (food) · imports the REAL persistCandidates
// and the REAL accommodationYogyakartaConfig.persistence block.

import { randomUUID } from "node:crypto";
import pg from "pg";
import { persistCandidates } from "./engine.mjs";
import { accommodationYogyakartaConfig } from "./configs/accommodation-yogyakarta.mjs";

const pool = new pg.Pool({
  connectionString: process.env.NEX_POSTGRES_URL
    ?? "postgresql://postgres:Admin1phil@localhost:5433/nex_dev",
});

const runId    = randomUUID().slice(0, 8);
const workerId = `smoke-test:accommodation:P5-${runId}`;
const source   = `p5-smoke-accommodation-${runId}`;

const cycleRunId = randomUUID();
await pool.query(
  `INSERT INTO nex.worker_cycle_run (id, worker_id, worker_type, worker_config, started_at, status)
   VALUES ($1, $2, 'smoke_test', $3, now(), 'running')`,
  [cycleRunId, workerId, `p5-smoke-accommodation:${runId}`]
);

const candidates = [
  {
    name: `P5-SMOKE-${runId}-Hotel-A`, category: "hotel", categories: [],
    address: `P5 test address A · ${runId}`, city: "Yogyakarta",
    lng: 110.90003, lat: -7.10003, phone: `+62-P5A-${runId}`, whatsapp: null, website: null,
    dedupeHash: `p5-accom|${runId}|A|synth`,
    sourceType: source, sourceReference: `p5-smoke-A-${runId}`, sourceLicenceTerms: "P5-SMOKE",
    sourceUpdatedAt: null, lastVerifiedAt: null, verificationSource: null, sourceName: source,
  },
  {
    name: `P5-SMOKE-${runId}-Villa-B`, category: "villa", categories: [],
    address: `P5 test address B · ${runId}`, city: "Yogyakarta",
    lng: 110.90004, lat: -7.10004, phone: `+62-P5B-${runId}`, whatsapp: null, website: null,
    dedupeHash: `p5-accom|${runId}|B|synth`,
    sourceType: source, sourceReference: `p5-smoke-B-${runId}`, sourceLicenceTerms: "P5-SMOKE",
    sourceUpdatedAt: null, lastVerifiedAt: null, verificationSource: null, sourceName: source,
  },
  {
    name: `P5-SMOKE-${runId}-Guesthouse-C`, category: "guesthouse", categories: [],
    address: `P5 test address C · ${runId}`, city: "Yogyakarta",
    lng: 110.90005, lat: -7.10005, phone: `+62-P5C-${runId}`, whatsapp: null, website: null,
    dedupeHash: `p5-accom|${runId}|C|synth`,
    sourceType: source, sourceReference: `p5-smoke-C-${runId}`, sourceLicenceTerms: "P5-SMOKE",
    sourceUpdatedAt: null, lastVerifiedAt: null, verificationSource: null, sourceName: source,
  },
];

const results = await persistCandidates(pool, candidates, accommodationYogyakartaConfig, {
  workerId, cycleRunId,
});

const dbQ = await pool.query(
  `SELECT COUNT(*)::int AS n FROM nex.accommodation_business WHERE cycle_run_id = $1`,
  [cycleRunId]
);
const dbCount = dbQ.rows[0].n;
const invariantHeld = dbCount === results.insertVerified;

const rows = await pool.query(
  `SELECT internal_id, worker_id, cycle_run_id, source, business_name, created_at
   FROM nex.accommodation_business WHERE cycle_run_id = $1 ORDER BY created_at ASC`,
  [cycleRunId]
);

console.log("");
console.log("═══════════════════════════════════════════════════════════════");
console.log("  P5 ACCOMMODATION PERSISTENCE CONTRACT · SMOKE TEST");
console.log("═══════════════════════════════════════════════════════════════");
console.log(`  worker_id                : ${workerId}`);
console.log(`  cycle_id                 : ${cycleRunId}`);
console.log("");
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
console.log(`  Invariant                : ${invariantHeld ? "PASS ✓" : "FAIL ✗"}`);
console.log(`  cycle_outcome            : ${dbCount > 0 ? "PRODUCTIVE" : "NO_NEW_CANDIDATES"}`);
console.log(`  cycle status             : ${invariantHeld ? "completed" : "failed"}`);
console.log("");
console.log("── ACTUAL ROWS · nex.accommodation_business ──");
for (const r of rows.rows) {
  console.log(`  internal_id   : ${r.internal_id}`);
  console.log(`  worker_id     : ${r.worker_id}`);
  console.log(`  cycle_run_id  : ${r.cycle_run_id}`);
  console.log(`  source        : ${r.source}`);
  console.log(`  business_name : ${r.business_name}`);
  console.log(`  created_at    : ${r.created_at.toISOString()}`);
  console.log("");
}

// Cleanup
const publicRefs = await pool.query(`SELECT public_listing_ref FROM nex.accommodation_business WHERE cycle_run_id = $1`, [cycleRunId]);
const refList = publicRefs.rows.map(r => r.public_listing_ref);
if (refList.length > 0) {
  await pool.query(`DELETE FROM nex.accommodation_business_field_provenance WHERE cycle_run_id = $1 OR business_ref = ANY($2::text[])`, [cycleRunId, refList]);
  await pool.query(`DELETE FROM nex.accommodation_business_source_snapshot WHERE business_ref = ANY($1::text[])`, [refList]);
}
const del = await pool.query(`DELETE FROM nex.accommodation_business WHERE cycle_run_id = $1`, [cycleRunId]);
await pool.query(
  `UPDATE nex.worker_cycle_run SET finished_at = now(), status = $2, records_new = $3 WHERE id = $1`,
  [cycleRunId, invariantHeld ? "completed" : "failed", dbCount]
);
console.log(`── CLEANUP · deleted ${del.rowCount} rows · cycle_run row preserved for audit ──`);
console.log("");
console.log(invariantHeld
  ? "  ✓ P5 ACCOMMODATION CONTRACT VALIDATED"
  : "  ✗ P5 ACCOMMODATION CONTRACT FAILED");
console.log("═══════════════════════════════════════════════════════════════");

await pool.end();
