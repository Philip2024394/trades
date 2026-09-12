// NEX Workforce v2 · Application Cutover Gate · withWorkforceRole helper
// ─────────────────────────────────────────────────────────────────────────────
// The only application-side boundary through which workforce processes
// (agent · reaper · orchestrator · heartbeat) obtain nex_workforce_app
// privileges.
//
// Contract:
//   const result = await withWorkforceRole(pool, async (client) => {
//     return client.query("SELECT nex_workforce.claim($1) AS row", [agentId]);
//   });
//   result.rows[0].row   // pg result shape preserved (minimal caller churn)
//
// Guarantees:
//   1. Opens a fresh pg client from the caller's existing pool.
//   2. BEGIN a transaction.
//   3. Executes  SET LOCAL ROLE nex_workforce_app  (transaction-scoped).
//   4. Verifies current_user is exactly 'nex_workforce_app' · fail-closed.
//   5. Runs the caller's fn(client).
//   6. COMMIT on success · ROLLBACK on any error.
//   7. RESET ROLE at connection-scope on release for defence-in-depth
//      against any pooled-connection leak (SET LOCAL already reverts at
//      COMMIT/ROLLBACK; this is belt-and-braces).
//   8. Never silently falls back to the runtime role.
//
// Fail-closed rules:
//   - SET LOCAL ROLE failure  → WorkforceRoleElevationError (no callback run).
//   - current_user mismatch   → WorkforceRoleElevationError (no callback run).
//   - Callback throw          → ROLLBACK · re-throw the caller's error.
//   - Pool.connect() failure  → propagates directly · no callback run.
//
// Non-goals:
//   - Does NOT create its own pool. Reuses the caller's existing pool.
//   - Does NOT read env vars. The pool's connection string decides which
//     LOGIN role opens the underlying session (nex_app_runtime in
//     production · nex_workforce_runtime in portable tests).
//   - Does NOT wrap multi-transaction workflows. The helper is one
//     transaction per invocation. Callers wanting multiple queries in one
//     txn pass a callback that does multiple client.query() calls.

const WORKFORCE_ROLE = "nex_workforce_app";

export class WorkforceRoleElevationError extends Error {
  constructor(message, meta = {}) {
    super(message);
    this.name = "WorkforceRoleElevationError";
    Object.assign(this, meta);
  }
}

export async function withWorkforceRole(pool, fn) {
  if (!pool || typeof pool.connect !== "function") {
    throw new WorkforceRoleElevationError("withWorkforceRole: pool required");
  }
  if (typeof fn !== "function") {
    throw new WorkforceRoleElevationError("withWorkforceRole: callback (client => ...) required");
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Step 1 · SET LOCAL ROLE inside the transaction.
    try {
      await client.query(`SET LOCAL ROLE ${WORKFORCE_ROLE}`);
    } catch (e) {
      await client.query("ROLLBACK").catch(() => {});
      throw new WorkforceRoleElevationError(
        `SET LOCAL ROLE ${WORKFORCE_ROLE} failed: ${e.message}`,
        { cause: e }
      );
    }

    // Step 2 · Verify the elevation actually took effect · fail-closed.
    const who = await client.query("SELECT current_user AS cu, session_user AS su");
    const cu = who.rows[0].cu;
    const su = who.rows[0].su;
    if (cu !== WORKFORCE_ROLE) {
      await client.query("ROLLBACK").catch(() => {});
      throw new WorkforceRoleElevationError(
        `role elevation verification failed · current_user=${cu} (expected ${WORKFORCE_ROLE})`,
        { current_user: cu, session_user: su }
      );
    }

    // Step 3 · Run the caller's work under the workforce role.
    let result;
    try {
      result = await fn(client);
    } catch (workErr) {
      await client.query("ROLLBACK").catch(() => {});
      throw workErr;
    }

    await client.query("COMMIT");
    return result;
  } finally {
    // Belt-and-braces · SET LOCAL is txn-scoped so COMMIT/ROLLBACK already
    // reverts, but issuing RESET ROLE guarantees the released client goes
    // back to the pool with no lingering role state · protects against
    // future misuse where a caller forgets to wrap COMMIT/ROLLBACK.
    try { await client.query("RESET ROLE"); } catch { /* best-effort */ }
    client.release();
  }
}
