// NEX Food · PG17 (port 5433) connection pool.
//
// Reuses the same NEX_POSTGRES_URL that nex.conv_* tables use (per pinned
// reference `reference_trades_postgres_port_5433`). One database, one pool.
//
// Phase 1 · Business schema. Reads/writes against nex.food_business.
// Later phases (dedupe, verify, outreach, claim, dashboard) all import from here.

import { Pool, type QueryResult, type QueryResultRow } from "pg";

let cachedPool: Pool | null = null;

/**
 * Lazy-initialised pool. First call creates the pool; subsequent calls reuse.
 * Missing NEX_POSTGRES_URL throws — pipeline scripts should fail loudly.
 */
export function getFoodDbPool(): Pool {
  if (cachedPool) return cachedPool;
  const url = process.env.NEX_POSTGRES_URL;
  if (!url) {
    throw new Error(
      "NEX_POSTGRES_URL is not set. NEX Food pipeline requires PG17 on port 5433. " +
      "See .env.local and pinned reference_trades_postgres_port_5433."
    );
  }
  cachedPool = new Pool({
    connectionString: url,
    max: 8,
    idleTimeoutMillis: 30_000,
    // Bumped from 5_000 → 15_000 on 2026-08-23 (Philip). Windows dev cold
    // TCP handshakes to local PG occasionally exceed 5s and surface as a
    // "Connection terminated due to connection timeout" on Reception's
    // first request. 15s is generous for cold starts, harmless in prod
    // (healthy PG responds in ms). Reliability adjustment only · no other
    // pool architecture changes.
    connectionTimeoutMillis: 15_000,
  });
  return cachedPool;
}

/**
 * Convenience query helper · use for one-off queries. Long-running transactions
 * should acquire a client directly via `getFoodDbPool().connect()`.
 */
export async function foodDbQuery<T extends QueryResultRow = QueryResultRow>(
  sql: string,
  params?: unknown[]
): Promise<QueryResult<T>> {
  return getFoodDbPool().query<T>(sql, params);
}

/** For tests / graceful shutdown. Typical dev use never needs this. */
export async function closeFoodDbPool(): Promise<void> {
  if (cachedPool) {
    await cachedPool.end();
    cachedPool = null;
  }
}
