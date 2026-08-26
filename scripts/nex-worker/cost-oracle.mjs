// scripts/nex-worker/cost-oracle.mjs
//
// NEX Cost Oracle · Discovery Fabric P8 · Foundation C.
// Philip 2026-08-26 · design spec at docs/nex-fabric/02-provider-abstraction-router-failure.md
//
// Doctrine anchor: project_nex_walker_production_launch_directive_2026_08_26
//
// Purpose:
//   · Before a cycle calls a paid provider, ask checkBudget(). If allowed=false,
//     the walker records cycle_outcome=BUDGET_EXHAUSTED (see rejection-reasons)
//     and skips the surface for this cycle. BUDGET_EXHAUSTED is classified as
//     infrastructural noise in persistence-contract · does NOT count toward
//     saturation (walker didn't actually search, therefore has no evidence).
//   · After the call, walker calls recordSpend() with the observed cost. If
//     recorded spend >= cap, circuit_open_at is stamped and every subsequent
//     checkBudget for the day returns allowed=false with CIRCUIT_OPEN_TODAY.
//   · At cycle start, walker calls resetDailyIfNeeded() to clear stale caps.
//
// Provider cost per request is read from nex.provider_registry.cost_per_request_usd
// so operators tune caps and per-provider prices in ONE place.
//
// Concurrency:
//   · recordSpend uses SERIALIZABLE + row lock so two workers touching the
//     same branch cannot double-spend past the cap.

const REASON = Object.freeze({
  OK: "OK",
  CAP_EXCEEDED_PROJECTED: "CAP_EXCEEDED_PROJECTED",
  CIRCUIT_OPEN_TODAY: "CIRCUIT_OPEN_TODAY",
  UNKNOWN_BRANCH: "UNKNOWN_BRANCH",
  UNKNOWN_PROVIDER: "UNKNOWN_PROVIDER",
});

export const COST_ORACLE_REASONS = REASON;

/**
 * Determine whether a walker may make `projectedCalls` calls to `providerId`
 * against the daily cap for `branch`.
 *
 * @param {{ query: Function, connect?: Function }} pool
 * @param {string} branch                one of food|accommodation|market|transport
 * @param {string} providerId            row in nex.provider_registry
 * @param {number} [projectedCalls=1]
 * @returns {Promise<{
 *   allowed: boolean,
 *   remainingUsd: number,
 *   capUsd: number,
 *   spentUsd: number,
 *   providerCostPerRequest: number,
 *   projectedSpendUsd: number,
 *   reason: string
 * }>}
 */
export async function checkBudget(pool, branch, providerId, projectedCalls = 1) {
  const budgetQ = await pool.query(
    `SELECT branch, daily_cap_usd, spent_today_usd, circuit_open_at
       FROM nex.cost_budget WHERE branch = $1`,
    [branch]
  );
  const budget = budgetQ.rows[0];
  if (!budget) {
    return {
      allowed: false,
      remainingUsd: 0,
      capUsd: 0,
      spentUsd: 0,
      providerCostPerRequest: 0,
      projectedSpendUsd: 0,
      reason: REASON.UNKNOWN_BRANCH,
    };
  }

  const providerQ = await pool.query(
    `SELECT cost_per_request_usd FROM nex.provider_registry WHERE provider_id = $1`,
    [providerId]
  );
  const provider = providerQ.rows[0];
  if (!provider) {
    return {
      allowed: false,
      remainingUsd: Number(budget.daily_cap_usd) - Number(budget.spent_today_usd),
      capUsd: Number(budget.daily_cap_usd),
      spentUsd: Number(budget.spent_today_usd),
      providerCostPerRequest: 0,
      projectedSpendUsd: 0,
      reason: REASON.UNKNOWN_PROVIDER,
    };
  }

  const capUsd = Number(budget.daily_cap_usd);
  const spentUsd = Number(budget.spent_today_usd);
  const perReq = Number(provider.cost_per_request_usd);
  const projected = perReq * projectedCalls;
  const remaining = capUsd - spentUsd;

  if (budget.circuit_open_at) {
    return {
      allowed: false,
      remainingUsd: remaining,
      capUsd,
      spentUsd,
      providerCostPerRequest: perReq,
      projectedSpendUsd: projected,
      reason: REASON.CIRCUIT_OPEN_TODAY,
    };
  }

  if (spentUsd + projected > capUsd) {
    return {
      allowed: false,
      remainingUsd: remaining,
      capUsd,
      spentUsd,
      providerCostPerRequest: perReq,
      projectedSpendUsd: projected,
      reason: REASON.CAP_EXCEEDED_PROJECTED,
    };
  }

  return {
    allowed: true,
    remainingUsd: remaining,
    capUsd,
    spentUsd,
    providerCostPerRequest: perReq,
    projectedSpendUsd: projected,
    reason: REASON.OK,
  };
}

/**
 * Atomically add `actualCostUsd` to spent_today_usd for `branch`. If the new
 * total meets or exceeds cap, stamp circuit_open_at (idempotent · only stamps
 * if currently NULL).
 *
 * Uses SERIALIZABLE isolation + SELECT FOR UPDATE so concurrent workers cannot
 * race past the cap. Providers with zero cost still legally call this
 * (actualCostUsd may be 0) · row is still locked/unlocked but cap never trips.
 *
 * @param {{ query: Function, connect: Function }} pool  must expose connect()
 * @param {string} branch
 * @param {string} providerId       for audit only · not persisted in P8
 * @param {number} actualCalls      for audit only · not persisted in P8
 * @param {number} actualCostUsd
 * @returns {Promise<{
 *   newSpentUsd: number,
 *   capUsd: number,
 *   circuitOpenedNow: boolean
 * }>}
 */
export async function recordSpend(pool, branch, providerId, actualCalls, actualCostUsd) {
  if (typeof actualCostUsd !== "number" || actualCostUsd < 0) {
    throw new Error(`recordSpend: actualCostUsd must be >= 0, got ${actualCostUsd}`);
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN ISOLATION LEVEL SERIALIZABLE");
    const lockQ = await client.query(
      `SELECT daily_cap_usd, spent_today_usd, circuit_open_at
         FROM nex.cost_budget
        WHERE branch = $1
        FOR UPDATE`,
      [branch]
    );
    if (lockQ.rowCount === 0) {
      await client.query("ROLLBACK");
      throw new Error(`recordSpend: unknown branch '${branch}'`);
    }

    const capUsd = Number(lockQ.rows[0].daily_cap_usd);
    const prevSpent = Number(lockQ.rows[0].spent_today_usd);
    const alreadyOpen = lockQ.rows[0].circuit_open_at !== null;
    const newSpent = prevSpent + actualCostUsd;
    const shouldOpen = !alreadyOpen && newSpent >= capUsd;

    if (shouldOpen) {
      await client.query(
        `UPDATE nex.cost_budget
            SET spent_today_usd = $1,
                circuit_open_at = now(),
                updated_at      = now()
          WHERE branch = $2`,
        [newSpent, branch]
      );
    } else {
      await client.query(
        `UPDATE nex.cost_budget
            SET spent_today_usd = $1,
                updated_at      = now()
          WHERE branch = $2`,
        [newSpent, branch]
      );
    }
    await client.query("COMMIT");

    // providerId + actualCalls accepted for signature compatibility;
    // full audit trail lands with a future cost_ledger table.
    void providerId; void actualCalls;

    return {
      newSpentUsd: newSpent,
      capUsd,
      circuitOpenedNow: shouldOpen,
    };
  } catch (err) {
    try { await client.query("ROLLBACK"); } catch { /* swallow */ }
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Reset spent_today_usd and circuit_open_at when last_reset_at is on a prior
 * calendar day (UTC). Idempotent · same-day calls are no-ops. Called at the
 * top of every walker cycle · cheap SELECT + occasional UPDATE.
 *
 * @param {{ query: Function }} pool
 * @param {string} branch
 * @returns {Promise<{ reset: boolean, newLastResetAt: string|null }>}
 */
export async function resetDailyIfNeeded(pool, branch) {
  const q = await pool.query(
    `SELECT last_reset_at FROM nex.cost_budget WHERE branch = $1`,
    [branch]
  );
  if (q.rowCount === 0) {
    return { reset: false, newLastResetAt: null };
  }

  const lastReset = new Date(q.rows[0].last_reset_at);
  const now = new Date();
  const sameDay =
    lastReset.getUTCFullYear() === now.getUTCFullYear() &&
    lastReset.getUTCMonth() === now.getUTCMonth() &&
    lastReset.getUTCDate() === now.getUTCDate();

  if (sameDay) {
    return { reset: false, newLastResetAt: lastReset.toISOString() };
  }

  const upd = await pool.query(
    `UPDATE nex.cost_budget
        SET spent_today_usd = 0,
            circuit_open_at = NULL,
            last_reset_at   = now(),
            updated_at      = now()
      WHERE branch = $1
      RETURNING last_reset_at`,
    [branch]
  );
  return {
    reset: true,
    newLastResetAt: upd.rows[0]?.last_reset_at
      ? new Date(upd.rows[0].last_reset_at).toISOString()
      : null,
  };
}
