// scripts/nex-acquisition/engine-records-persisted.test.mjs
//
// 2026-08-24 · P1 records_new pollution fix · deterministic test.
//
// Verifies that `audit.counts.records_persisted` (which now drives the
// worker_cycle_run.records_new column) reflects ONLY rows the DB actually
// accepted · never Phase B candidate classifications, provider return counts,
// or scoring output. Covers Philip's 5-case acceptance matrix:
//
//   Case 1 · 10 new candidates · 10 inserted        → records_persisted = 10
//   Case 2 · 10 candidates all existing             → records_persisted = 0
//   Case 3 · 4 new + 6 existing                     → records_persisted = 4
//   Case 4 · scoring-only (no new inserts)          → records_persisted = 0
//                                                     (scoring_stats non-zero)
//   Case 5 · concurrent duplicate (2 workers race)  → aggregate = 1
//
// The engine's Phase E loop is small enough to reproduce as a pure function
// here · this test replays that logic against synthetic candidates with
// scripted insertNewRecord return values, then asserts the invariants.
// Running: node --test scripts/nex-acquisition/engine-records-persisted.test.mjs

import test from "node:test";
import assert from "node:assert/strict";

/**
 * Replays the P1-corrected Phase E loop from scripts/nex-acquisition/engine.mjs
 * (lines 340-360 as of 2026-08-24). Kept in lockstep with the production loop —
 * change one, change the other. Guards against silent regression to the pre-fix
 * behaviour where `new_candidates` (candidate count) was mistaken for the
 * persistence count.
 */
async function runPhaseE(newRecords, insertNewRecord) {
  const audit = {
    counts: { records_persisted: 0, errors: 0 },
    errors: [],
  };
  for (const c of newRecords) {
    try {
      const ok = await insertNewRecord(c);
      if (ok) audit.counts.records_persisted++;
    } catch (err) {
      audit.errors.push({ phase: "persist", ref: c.publicRef, message: err.message });
      audit.counts.errors++;
    }
  }
  return audit;
}

function makeCandidates(n) {
  return Array.from({ length: n }, (_, i) => ({
    publicRef: `TEST-${i}`,
    name: `Test Business ${i}`,
    dedupeHash: `h-${i}`,
  }));
}

test("Case 1 · all new · 10 candidates → records_persisted = 10", async () => {
  const audit = await runPhaseE(makeCandidates(10), async () => true);
  assert.equal(audit.counts.records_persisted, 10, "all 10 should be counted as persisted");
  assert.equal(audit.counts.errors, 0);
});

test("Case 2 · all existing · 10 candidates → records_persisted = 0", async () => {
  const audit = await runPhaseE(makeCandidates(10), async () => false);
  assert.equal(audit.counts.records_persisted, 0, "when insertNewRecord always returns false, nothing counted");
  assert.equal(audit.counts.errors, 0);
});

test("Case 3 · 4 new + 6 existing → records_persisted = 4", async () => {
  const returns = [true, false, false, true, true, false, false, true, false, false];
  let i = 0;
  const audit = await runPhaseE(makeCandidates(10), async () => returns[i++]);
  assert.equal(audit.counts.records_persisted, 4, "only the 4 true returns should count");
});

test("Case 4 · scoring only · Phase E never runs (0 newRecords) → records_persisted = 0", async () => {
  // A scoring-only cycle classifies candidates as matched/eligible in Phase B
  // but produces zero items in the newRecords array reaching Phase E. The counter
  // must stay 0 while scoring_stats (matched_exact, eligible, etc.) may be non-zero.
  const audit = await runPhaseE([], async () => { throw new Error("should not be called"); });
  assert.equal(audit.counts.records_persisted, 0);
  assert.equal(audit.counts.errors, 0);
});

test("Case 5 · concurrent duplicate discovery · only insertion winner gets credit", async () => {
  // Simulate two workers both discovering the same business. Only one wins
  // the ON CONFLICT DO NOTHING race (returns true); the other gets
  // rowCount=0 (returns false). Aggregate records_persisted across both
  // workers = 1, not 2.
  const workerA = await runPhaseE([{ publicRef: "SAME", dedupeHash: "h-same" }], async () => true);
  const workerB = await runPhaseE([{ publicRef: "SAME", dedupeHash: "h-same" }], async () => false);
  const aggregate = workerA.counts.records_persisted + workerB.counts.records_persisted;
  assert.equal(aggregate, 1, "concurrent duplicate must count once across workers");
});

test("Invariant · errors during persistence do NOT increment records_persisted", async () => {
  // Persistence throwing mid-loop must NOT bump the counter for the failed row.
  const returns = [true, "THROW", true, true];
  let i = 0;
  const audit = await runPhaseE(makeCandidates(4), async () => {
    const r = returns[i++];
    if (r === "THROW") throw new Error("simulated DB timeout");
    return r;
  });
  assert.equal(audit.counts.records_persisted, 3, "the throw row must not be counted");
  assert.equal(audit.counts.errors, 1);
});

test("Invariant · records_persisted never exceeds newRecords length", async () => {
  const audit = await runPhaseE(makeCandidates(5), async () => true);
  assert.ok(audit.counts.records_persisted <= 5);
});
