// src/lib/nex/brain/adapters/whatsapp-outbox-db.ts
//
// Dedicated Postgres pool for the WhatsApp outbox table
// `public.hammerex_nex_whatsapp_outbox`, which lives in the existing
// Trades/Hammerex Supabase — NOT in NEX Project B.
//
// Reads exactly ONE env var:
//
//   NEX_WHATSAPP_OUTBOX_POSTGRES_URL
//
// NEVER falls back to `NEX_POSTGRES_URL`. Post-cutover, NEX_POSTGRES_URL
// points at Supabase Project B, which does not have (and must not have)
// the WhatsApp outbox table. A silent fallback would either 500 or, worse,
// create shadow rows in the wrong database.
//
// The pool is lazy · created on first `withWhatsAppOutboxClient` call
// so that non-WhatsApp code paths never open a connection to the Trades
// database. In dev/test the var may be unset; `withWhatsAppOutboxClient`
// then returns `null` (same graceful-degradation shape as
// `src/lib/nex/db.ts::withClient`), so unit tests that don't need the
// outbox continue to run without config.
//
// Contract with the Postgres driver in whatsapp-outbox.ts:
//   makePostgresOutboxDriver(withWhatsAppOutboxClient)
// The driver's `withClient` argument is polymorphic · pool acquisition
// happens here, driver logic (SQL, error mapping) stays there. Two
// concerns · two files.

import type { PgClientLike } from "@/lib/nex/db";

const ENV_NAME = "NEX_WHATSAPP_OUTBOX_POSTGRES_URL";

// Redact password for any log/error line. Never leak credentials.
function redactUrl(url: string): string {
  return url.replace(/:[^:@/]+@/, ":****@");
}

function readEnvUrl(): string | null {
  const raw = process.env[ENV_NAME];
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (trimmed.length === 0) return null;
  if (!/^postgres(ql)?:\/\//.test(trimmed)) {
    // Invalid URL is a real bug worth surfacing loudly · never silent-null.
    const err = new Error(
      `[whatsapp-outbox-db] ${ENV_NAME} must start with postgres:// or postgresql:// · got: ${trimmed.slice(0, 24)}…`,
    ) as Error & { code: string };
    err.code = "invalid-whatsapp-outbox-url";
    throw err;
  }
  return trimmed;
}

type PgPoolLike = { connect: () => Promise<PgClientLike>; end: () => Promise<void> };

let poolPromise: Promise<PgPoolLike | null> | null = null;

async function getPool(): Promise<PgPoolLike | null> {
  if (poolPromise) return poolPromise;
  const url = readEnvUrl();
  if (!url) { poolPromise = Promise.resolve(null); return poolPromise; }
  poolPromise = (async () => {
    let pg: unknown;
    try { pg = await import("pg" as string); } catch { return null; }
    const { Pool } = ((pg as { default?: unknown }).default ?? pg) as {
      Pool: new (c: { connectionString: string; max?: number; ssl?: { rejectUnauthorized: boolean } | boolean }) => PgPoolLike;
    };
    // Trades/Hammerex Supabase requires SSL like the NEX pool does.
    const needsSsl = /supabase\.co|render\.com|neon\.tech|amazonaws\.com/.test(url);
    // eslint-disable-next-line no-console
    console.log(`[whatsapp-outbox-db] pool constructed · ${redactUrl(url)}`);
    return new Pool({
      connectionString: url,
      max: 2,   // outbox writes are low-volume · cap small.
      ssl: needsSsl ? { rejectUnauthorized: false } : undefined,
    });
  })();
  return poolPromise;
}

/**
 * Acquire a client from the WhatsApp outbox pool and run `fn`. Returns
 * `null` when NEX_WHATSAPP_OUTBOX_POSTGRES_URL is unset — the caller
 * (Postgres outbox driver) then throws its own loud error if it was
 * explicitly selected, so a missing config never silently degrades to
 * an in-memory driver in production.
 */
export async function withWhatsAppOutboxClient<T>(
  fn: (c: PgClientLike) => Promise<T>,
): Promise<T | null> {
  const pool = await getPool();
  if (!pool) return null;
  const client = await pool.connect();
  try { return await fn(client); }
  finally { client.release(); }
}

/**
 * Test-only hook to reset the memoised pool (e.g. after mutating
 * process.env inside a vitest fixture). Not exported for runtime use.
 */
export function _resetWhatsAppOutboxPoolForTests(): void {
  poolPromise = null;
}
