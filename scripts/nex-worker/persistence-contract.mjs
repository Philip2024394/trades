// scripts/nex-worker/persistence-contract.mjs
//
// NEX Persistence Contract · shared helpers · Philip 2026-08-26 P5.
//
// Doctrine anchor: project_nex_walker_production_launch_directive_2026_08_26
//
// The ENGINE (scripts/nex-acquisition/engine.mjs) owns the vertical-agnostic
// contract. Configs supply structure. Walkers that don't use the engine
// (market · transport) also need to enforce the contract — this file gives
// them the same building blocks so we have ONE implementation of each
// primitive across the codebase.
//
// Primitives:
//   · verifyInsertedRow    — three-way match (pk + cycle_run_id + worker_id)
//   · checkPersistenceInvariant — SELECT COUNT vs insert_verified · returns invariant object
//   · isSaturationCountable — filters PROVIDER_ERROR / FATAL out of rotation saturation counting
//                              (Philip's P4 finding · 2026-08-26)
//
// Zero side effects beyond the two SELECTs. Deterministic. Testable.

/**
 * Verify a single row was inserted with correct attribution.
 * Three-way match: primary key + cycle_run_id + worker_id.
 *
 * @param {import('pg').Pool} pool
 * @param {object} args
 * @param {string} args.table              e.g. 'nex.food_business'
 * @param {string} args.primaryKeyColumn   e.g. 'internal_id'
 * @param {*}      args.returnedPk         value from INSERT ... RETURNING
 * @param {string} args.cycleRunId
 * @param {string} args.workerId
 * @returns {Promise<boolean>} true if exactly one row matches all three
 */
export async function verifyInsertedRow(pool, { table, primaryKeyColumn, returnedPk, cycleRunId, workerId }) {
  const q = await pool.query(
    `SELECT ${primaryKeyColumn} FROM ${table}
      WHERE ${primaryKeyColumn} = $1 AND cycle_run_id = $2 AND worker_id = $3`,
    [returnedPk, cycleRunId, workerId]
  );
  return q.rowCount === 1;
}

/**
 * Compute persistence invariant from DB truth. Compares actual DB row count
 * (WHERE cycle_run_id = $1) against the walker's insert_verified counter.
 * Any mismatch is a contract violation · cycle must be marked FAILED.
 *
 * Philip 2026-08-26: no errors_count escape hatch · mismatch === FAILED.
 *
 * @param {import('pg').Pool} pool
 * @param {object} args
 * @param {string} args.table
 * @param {string} args.cycleRunId
 * @param {number} args.insertVerified
 * @returns {Promise<{held: boolean, db_count: number, insert_verified: number, delta: number}>}
 */
export async function checkPersistenceInvariant(pool, { table, cycleRunId, insertVerified }) {
  const q = await pool.query(
    `SELECT COUNT(*)::int AS n FROM ${table} WHERE cycle_run_id = $1`,
    [cycleRunId]
  );
  const dbCount = q.rows[0].n;
  return {
    held: dbCount === insertVerified,
    db_count: dbCount,
    insert_verified: insertVerified,
    delta: insertVerified - dbCount,
  };
}

/**
 * Cycle outcomes that should NOT count toward consecutive_zero_new_cycles
 * saturation counting · they represent infrastructural noise, not honest
 * "we walked the surface and found nothing new" signals.
 *
 * Philip 2026-08-26 P4 finding: "A provider outage should not consume a
 * saturation attempt in the same way as a successful zero-result discovery."
 *
 * P8 (Philip 2026-08-26): BUDGET_EXHAUSTED added · cost-oracle blocks the
 * cycle BEFORE any provider call, so we have no evidence at all about the
 * surface. Counting it toward saturation would starve surfaces during
 * budget-freeze windows and mask upstream cost regressions.
 *
 * Distinguishes:
 *   PRODUCTIVE / PARTIAL      · reset saturation
 *   ALL_DEDUPED / EMPTY_RESULT / PROVIDER_EMPTY / NO_NEW_CANDIDATES · genuine zero (counts toward saturation)
 *   PROVIDER_ERROR / FATAL / BUDGET_EXHAUSTED · infrastructural noise (does NOT count)
 */
const INFRASTRUCTURAL_NOISE_OUTCOMES = new Set([
  "PROVIDER_ERROR",
  "FATAL",
  "BUDGET_EXHAUSTED",
]);

/**
 * Return true if this cycle should count toward consecutive_zero_new_cycles.
 * PROVIDER_ERROR and FATAL cycles are excluded.
 */
export function isSaturationCountable(cycleOutcome) {
  if (!cycleOutcome) return true;   // untelemetered cycles (pre-P1) count · legacy
  return !INFRASTRUCTURAL_NOISE_OUTCOMES.has(cycleOutcome);
}
