// src/lib/nex/analytics/rollup-gate.ts
//
// Wave 3 · H4 · runtime fail-closed gate for the analytics rollup async path.
// Governed by: docs/headquarters-production-readiness/WAVE-3-H4-MIGRATION-049-GATE.md
//
// PURPOSE
//   Refuse to activate the async rollup path (ingest queue INSERT + drain
//   worker) when the target database is missing the 049 schema. Prevents the
//   R-5 landmine: NEX_ANALYTICS_ROLLUP_ASYNC=1 against a DB without migration
//   049 currently produces cryptic 42P01 / 42883 Postgres errors on every
//   ingest or cron-tick.
//
// SAFETY
//   · Read-only probe · SELECT to_regclass + to_regproc · zero mutations.
//   · Cached POSITIVE result at module scope. Never caches NEGATIVE result so
//     the process self-heals the moment 049 is applied (no restart needed).
//   · When NEX_ANALYTICS_ROLLUP_ASYNC is unset / not 1, the module is a total
//     no-op · no probe fires · no 049 dependency observable.
//
// SEMANTICS
//   Positive verdict is CACHED once for the process lifetime · subsequent
//   calls are zero-DB-round-trip. Negative verdict is NOT cached · every
//   assertion re-probes so an operator applying 049 mid-run recovers on the
//   next call.

import type { PgClientLike } from "@/lib/nex/db";
import { isRollupAsync } from "./ingest";

const REQUIRED_TABLE = "nex.analytics_rollup_queue";
const REQUIRED_FUNCTION_SIGNATURE = "nex.claim_analytics_rollup_batch(text,int,int)";
const REQUIRED_FUNCTION_DISPLAY = "nex.claim_analytics_rollup_batch";
const MIGRATION_FILENAME = "049_analytics_rollup_queue.sql";

export class MigrationDependencyError extends Error {
  readonly code = "migration-049-not-applied" as const;
  readonly migration = MIGRATION_FILENAME;
  readonly missing_objects: string[];
  constructor(missing_objects: string[]) {
    const detail = missing_objects.join(", ");
    super(
      `migration 049 not applied · missing objects: ${detail} · run: npm run nex:apply-storage-schema (or apply deploy/postgres/init/${MIGRATION_FILENAME} manually) then re-enable NEX_ANALYTICS_ROLLUP_ASYNC`,
    );
    this.name = "MigrationDependencyError";
    this.missing_objects = missing_objects;
  }
}

type SchemaProbe = { ready: true } | { ready: false; missing: string[] };

/**
 * Pure schema probe. Returns { ready } based on presence of the required
 * 049 objects on the connection. NEVER throws · caller decides how to react.
 */
export async function checkRollupSchema(c: PgClientLike): Promise<SchemaProbe> {
  // to_regclass returns NULL if the relation doesn't exist · avoids catching
  // an exception, which is expensive under load.
  const r = await c.query(
    `SELECT
       to_regclass($1) AS table_oid,
       to_regprocedure($2) AS fn_oid`,
    [REQUIRED_TABLE, REQUIRED_FUNCTION_SIGNATURE],
  );
  const row = (r.rows[0] ?? {}) as { table_oid: string | null; fn_oid: string | null };
  const missing: string[] = [];
  if (!row.table_oid) missing.push(`${REQUIRED_TABLE} (table)`);
  if (!row.fn_oid) missing.push(`${REQUIRED_FUNCTION_DISPLAY} (function)`);
  return missing.length === 0 ? { ready: true } : { ready: false, missing };
}

// Positive-only cache. `true` means we've verified once this process.
// `null` means we have not yet observed a positive verify.
let cachedReady: true | null = null;

// Injection point for tests · production code passes no argument.
type CounterIncr = (name: string) => void;
let counterIncr: CounterIncr = (() => {
  // Late-bind the counters module so a test loader can supply its own.
  // The dynamic require avoids importing at module init (some test loaders
  // stub only a subset of dependencies).
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const mod = require("@/lib/nex/observability/counters") as { incr: (name: string) => void };
  return mod.incr;
})();

/** TEST-ONLY · inject a counter incrementer. */
export function _setCounterIncrForTests(fn: CounterIncr): void { counterIncr = fn; }
/** TEST-ONLY · reset the positive-verify cache. */
export function _resetGateCacheForTests(): void { cachedReady = null; }

/**
 * Fail-closed activation gate for the analytics rollup async path.
 *
 * Contract:
 *   · When NEX_ANALYTICS_ROLLUP_ASYNC is off, this function is a no-op and
 *     does NOT probe the DB.
 *   · When the flag is on, it probes the 049 schema. First success is cached.
 *   · On missing objects it throws `MigrationDependencyError` with a full
 *     remediation-oriented message AND increments `analytics.rollup_missing_table`.
 */
export async function assertRollupAsyncReady(c: PgClientLike): Promise<void> {
  if (!isRollupAsync()) return;
  if (cachedReady === true) return;
  const probe = await checkRollupSchema(c);
  if (probe.ready) {
    cachedReady = true;
    return;
  }
  // Negative verdict · bump counter · throw with actionable diagnostic.
  // Do NOT cache the negative result · self-heal on the next call once 049
  // lands.
  try { counterIncr("analytics.rollup_missing_table"); } catch { /* swallow */ }
  throw new MigrationDependencyError(probe.missing);
}
