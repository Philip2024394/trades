// src/lib/nex/db/with-brain-role.ts
//
// Wave 11 · Step 7 · F34 remediation.
//
// SHARED canonical `withBrainRole` helper. Before this module, six
// callsites (knowledge-inbox pg-reads/pg-shadow, jobs pg-reads/pg-shadow/pg-claim,
// storage object-postgres) each maintained a copy of the same BEGIN +
// SET LOCAL ROLE + COMMIT/ROLLBACK pattern. Five of them returned
// `Promise<T | null>`; one (object-postgres) returned `Promise<T>` by
// throwing on null pool. Both semantics are preserved here as two
// exported variants so migration is behavior-preserving.
//
// This helper is also the prerequisite for F12 (storage.ts monolith
// extraction) — the extracted adapters need a shared role-transaction
// helper to reference rather than each redefining one.
//
// CONTRACT
//   withBrainRole(fn)       · returns Promise<T | null>
//                             · null when NEX_POSTGRES_URL unset (dev)
//                             · rethrows any error fn throws (after ROLLBACK)
//   withBrainRoleStrict(fn) · returns Promise<T>
//                             · throws with .code="pg-not-configured" on null pool
//                             · rethrows any error fn throws (after ROLLBACK)
//
// SAFETY
//   · Every transaction is guaranteed to end in COMMIT or ROLLBACK
//     (finally-like semantics via try/catch)
//   · Pool connection released by underlying withClient
//   · SET LOCAL ROLE is LOCAL to the transaction · never leaks across
//     connection reuse in the pool

import { withClient, type PgClientLike } from "@/lib/nex/db";
// Wave 3 · H3 · SET LOCAL statement_timeout + idle_in_transaction_session_timeout
// (T-1, T-4) — §4.2 of WAVE-3-H3-TIMEOUT-BUDGETS.md.
import { statementTimeoutMs, idleInTransactionTimeoutMs } from "@/lib/nex/config/timeouts";

export type BrainRoleFn<T> = (c: PgClientLike) => Promise<T>;

/**
 * Run `fn` inside a `BEGIN … SET LOCAL ROLE nex_brain_app … COMMIT`
 * transaction. Rolls back on exception (which is then rethrown to
 * the caller). Returns `null` when NEX_POSTGRES_URL is unset — the
 * caller uses that as the "pg unavailable" signal.
 */
export async function withBrainRole<T>(fn: BrainRoleFn<T>): Promise<T | null> {
  return withClient(async (c) => {
    await c.query("BEGIN");
    try {
      await c.query("SET LOCAL ROLE nex_brain_app");
      // Wave 3 · H3 · per-transaction server-side timeout caps.
      //   · T-1 statement_timeout · cancels any single SQL that runs too long
      //   · T-4 idle_in_transaction_session_timeout · kills the connection if
      //     a transaction sits idle (typically a code bug that forgot COMMIT)
      // Both are SET LOCAL · never leak across connection reuse in the pool.
      // Values come from the shared config module · env-var overrides via
      // NEX_PG_STATEMENT_TIMEOUT_MS · NEX_PG_IDLE_TX_TIMEOUT_MS.
      const st = statementTimeoutMs();
      const it = idleInTransactionTimeoutMs();
      await c.query(`SET LOCAL statement_timeout = ${st}`);
      await c.query(`SET LOCAL idle_in_transaction_session_timeout = ${it}`);
      const r = await fn(c);
      await c.query("COMMIT");
      return r;
    } catch (e) {
      await c.query("ROLLBACK").catch(() => {});
      throw e;
    }
  });
}

/**
 * Strict variant · same transactional semantics but throws when the
 * pool is unavailable rather than returning null. Used by object
 * storage (which cannot degrade gracefully without a backend) and
 * any future adapter that requires Postgres to be present.
 *
 * The thrown error carries `.code = "pg-not-configured"` so callers
 * can map it via the shared error envelope (`toClientError`) to the
 * standard `misconfigured` safe code.
 */
export async function withBrainRoleStrict<T>(fn: BrainRoleFn<T>, contextTag = "pg"): Promise<T> {
  const result = await withBrainRole(fn);
  if (result === null) {
    const err: Error & { code?: string } = new Error(
      `[${contextTag}] NEX_POSTGRES_URL not configured · this operation requires Postgres`,
    );
    err.code = "pg-not-configured";
    throw err;
  }
  return result;
}

// PgClientLike is re-exported via type alias so callers importing the
// helper don't need a second import for the fn signature. (Written as
// alias rather than `export type { X } from`-syntax so the test loader
// can strip `^export\s+` without breaking the module.)
export type PgClientLikeReexport = PgClientLike;
