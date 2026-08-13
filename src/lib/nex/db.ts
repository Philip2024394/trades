// NEX · shared pg pool · used by every subsystem that needs Postgres.
// Historically lived at src/lib/nex/delivery/db.ts. Moved here so that
// subsystems bound by doctrine tripwires (e.g. Predictive Engine ·
// invariant #15) can reach the pool without importing a domain module.
//
// The pool is lazy · created only when NEX_POSTGRES_URL is set · returns
// null otherwise so callers can degrade gracefully in dev/test.
//
// Wave 11 · Step 11 · F28 · URL resolution routes through the shared
// `getPostgresUrlOrNull` helper. Null-return semantics preserved · the
// helper handles empty/whitespace normalisation and malformed-URL
// detection that this file previously did not.

import { getPostgresUrlOrNull } from "./config/pg";
// Wave 3 · H3 · T-3 pool-acquire timeout (§4.1 of WAVE-3-H3-TIMEOUT-BUDGETS.md).
import { connectionTimeoutMs } from "./config/timeouts";

export type PgClientLike = {
  query: (text: string, params?: unknown[]) => Promise<{ rows: Record<string, unknown>[]; rowCount: number | null }>;
  release: () => void;
};
type PgPoolLike = { connect: () => Promise<PgClientLike>; end: () => Promise<void> };

let poolPromise: Promise<PgPoolLike | null> | null = null;

async function getPool(): Promise<PgPoolLike | null> {
  if (poolPromise) return poolPromise;
  const url = getPostgresUrlOrNull();
  if (!url) { poolPromise = Promise.resolve(null); return poolPromise; }
  poolPromise = (async () => {
    let pg: unknown;
    try { pg = await import("pg" as string); } catch { return null; }
    const { Pool } = ((pg as { default?: unknown }).default ?? pg) as {
      Pool: new (c: { connectionString: string; max?: number; ssl?: { rejectUnauthorized: boolean } | boolean; connectionTimeoutMillis?: number }) => PgPoolLike;
    };
    const needsSsl = /supabase\.co|render\.com|neon\.tech|amazonaws\.com/.test(url);
    return new Pool({
      connectionString: url,
      max: 3,
      ssl: needsSsl ? { rejectUnauthorized: false } : undefined,
      // T-3 · fail-fast on pool exhaustion · env-var override via
      // NEX_PG_CONNECTION_TIMEOUT_MS (default 10s). Prevents blocked
      // callers from stacking indefinitely when the pool is empty.
      connectionTimeoutMillis: connectionTimeoutMs(),
    });
  })();
  return poolPromise;
}

export async function withClient<T>(fn: (c: PgClientLike) => Promise<T>): Promise<T | null> {
  const pool = await getPool();
  if (!pool) return null;
  const client = await pool.connect();
  try { return await fn(client); }
  finally { client.release(); }
}
