// src/lib/nex/verification/readonly-pg.ts
//
// STEP 4C · Tier 1 · safe production read-only helper.
// Governed by: docs/headquarters-production-readiness/STEP-4B-SAFE-READONLY-ACCESS-DESIGN.md
//
// PURPOSE
//   The ONLY sanctioned code path for read-only production verification
//   queries. Never falls back to `NEX_POSTGRES_URL`, `DATABASE_URL`, or
//   any other name. Never opens a connection whose URL matches the local
//   dev DB. Every query runs inside a server-enforced READ ONLY
//   transaction that Postgres itself will reject writes on.
//
// SAFETY LAYERS (per STEP 4B §3):
//   L1 · Naming        · reads ONLY NEX_PROD_READONLY_URL
//   L2 · URL rejection · refuses localhost / 127.0.0.1 / nex_dev / :5433
//   L3 · Session lock  · SET SESSION default_transaction_read_only = on
//   L4 · Tx lock       · BEGIN TRANSACTION READ ONLY ... ROLLBACK per fn
//   L5 · Credential quarantine · never logs the connection string;
//        prints only the resolved host (no user, no password, no path)
//
// USAGE
//   import { readOnlyProductionClient } from "@/lib/nex/verification/readonly-pg";
//   const client = readOnlyProductionClient();
//   if (!client) { /* env var not set; caller decides */ }
//   const rows = await client.withReadOnlyTx(async (c) => {
//     const r = await c.query(`SELECT to_regclass('nex.analytics_rollup_queue')`);
//     return r.rows;
//   });
//
// USAGE POLICY (enforced by RU1-RU4 drift-catcher):
//   · Only files under src/lib/nex/verification/** or
//     scripts/prove-production-*-readonly.* may import this module.
//   · No other file may read process.env.NEX_PROD_READONLY_URL directly.
//   · Verification code must not import withClient / withBrainRole / raw pg.

export type ReadOnlyPgClient = {
  /** Host portion of the resolved URL (safe to log · no credentials). */
  hostForLog: string;
  /** Run `fn` inside a server-enforced READ ONLY transaction. Rolls back on exit. */
  withReadOnlyTx<T>(fn: (c: { query: (sql: string, params?: unknown[]) => Promise<{ rows: Record<string, unknown>[]; rowCount: number | null }> }) => Promise<T>): Promise<T>;
  /** Explicit pool teardown for probe scripts. */
  end(): Promise<void>;
};

const ENV_NAME = "NEX_PROD_READONLY_URL";

// L2 · URL rejection substrings. Any match aborts before a connection opens.
const DEV_REJECT_SUBSTRINGS = ["localhost", "127.0.0.1", "nex_dev", ":5433"];

export class ReadOnlyProductionUrlUnsafeError extends Error {
  readonly code = "readonly-url-unsafe" as const;
  constructor(reason: string) {
    super(`[readonly-pg] refused NEX_PROD_READONLY_URL · ${reason}`);
    this.name = "ReadOnlyProductionUrlUnsafeError";
  }
}

export class ReadOnlyProductionMisconfiguredError extends Error {
  readonly code = "readonly-misconfigured" as const;
  constructor(msg: string) {
    super(`[readonly-pg] ${msg}`);
    this.name = "ReadOnlyProductionMisconfiguredError";
  }
}

// Injection point for tests.
type EnvLike = { NEX_PROD_READONLY_URL?: string };

/** Test-only · read the URL and run the safety checks without opening a pool.
 *  Returns the safe host for logging, or throws the exact error the runtime
 *  would throw. Never touches pg. */
export function validateReadOnlyUrlForTests(env?: EnvLike): string {
  const url = (env ?? (process.env as EnvLike)).NEX_PROD_READONLY_URL;
  if (!url || url.trim().length === 0) {
    throw new ReadOnlyProductionMisconfiguredError(
      `${ENV_NAME} is unset · verification cannot start`,
    );
  }
  for (const bad of DEV_REJECT_SUBSTRINGS) {
    if (url.includes(bad)) {
      throw new ReadOnlyProductionUrlUnsafeError(
        `URL contains banned substring "${bad}" · verification MUST NOT target local dev DB`,
      );
    }
  }
  // Extract host with no credentials for logging.
  try {
    const u = new URL(url);
    return u.hostname;
  } catch {
    throw new ReadOnlyProductionUrlUnsafeError("URL is not a valid connection string");
  }
}

/** Returns a scoped read-only client · or null if the env var is unset.
 *  Throws on unsafe URLs (dev-substring hits) even when the var is set. */
export function readOnlyProductionClient(env?: EnvLike): ReadOnlyPgClient | null {
  const src = env ?? (process.env as EnvLike);
  const url = src.NEX_PROD_READONLY_URL;
  if (!url || url.trim().length === 0) return null;

  // L2 · reject dev substrings BEFORE any driver import or connection attempt.
  const hostForLog = validateReadOnlyUrlForTests(src);

  // Lazy import so the module loads cleanly in environments without pg.
  const pgModule: unknown = require("pg");
  const PoolCtor = ((pgModule as { default?: unknown }).default ?? pgModule) as {
    Pool: new (c: {
      connectionString: string;
      max?: number;
      ssl?: { rejectUnauthorized: boolean } | boolean;
      application_name?: string;
    }) => {
      connect: () => Promise<{
        query: (text: string, params?: unknown[]) => Promise<{ rows: Record<string, unknown>[]; rowCount: number | null }>;
        release: () => void;
      }>;
      end: () => Promise<void>;
    };
  };
  // Supabase / managed-Postgres providers usually require SSL. Enable
  // rejectUnauthorized=false to match the pattern already used by
  // apply-nex-storage-schema.mjs and bootstrap-nex-postgres.mjs. Do NOT
  // change this pattern here · consistency with the rest of the codebase.
  const needsSsl = /supabase\.co|render\.com|neon\.tech|amazonaws\.com/.test(url);
  const pool = new PoolCtor.Pool({
    connectionString: url,
    max: 1,
    ssl: needsSsl ? { rejectUnauthorized: false } : undefined,
    application_name: "nex-verification-readonly",
  });

  async function withReadOnlyTx<T>(fn: (c: { query: (sql: string, params?: unknown[]) => Promise<{ rows: Record<string, unknown>[]; rowCount: number | null }> }) => Promise<T>): Promise<T> {
    const c = await pool.connect();
    try {
      // L3 · session lock. Any subsequent transaction defaults to READ ONLY
      // unless explicitly overridden, which we never do.
      await c.query("SET SESSION default_transaction_read_only = on");
      // L4 · transaction lock. Postgres rejects DDL/DML inside a READ ONLY
      // transaction with SQLSTATE 25006 · this is the belt-and-braces guarantee.
      await c.query("BEGIN TRANSACTION READ ONLY");
      try {
        const value = await fn({ query: c.query.bind(c) });
        // Always ROLLBACK · nothing this helper does should ever commit.
        await c.query("ROLLBACK");
        return value;
      } catch (e) {
        // Best-effort rollback · fn already threw · rethrow after cleanup.
        await c.query("ROLLBACK").catch(() => {});
        throw e;
      }
    } finally {
      c.release();
    }
  }

  return {
    hostForLog,
    withReadOnlyTx,
    end: async () => { await pool.end(); },
  };
}
