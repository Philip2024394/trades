// scripts/nex-acquisition/sources/_provider-lease-helper.mjs
//
// Phase B (2026-08-24) · shared Provider Rate Governor helper for the
// acquisition sources (osm-overpass · future business-website · etc).
//
// Uses its own module-scoped pool (max=1) so source discover() functions
// that don't have access to the walker's main pool can still acquire leases.
// Lease queries are tiny (SELECT + INSERT/UPDATE) so a max-1 pool is fine.

import pg from "pg";

let _pool = null;
function getPool() {
  if (_pool) return _pool;
  const url = process.env.NEX_POSTGRES_URL;
  if (!url) throw new Error("NEX_POSTGRES_URL not set · governor lease unavailable");
  _pool = new pg.Pool({ connectionString: url, max: 1 });
  return _pool;
}

/**
 * Acquire a provider rate lease · retries with backoff until success or maxWaitMs.
 * Mirrors src/lib/nex-hq/provider-rate-governor.ts decideAcquire logic.
 */
// Postgres SQLSTATE codes we retry on. 40001 = serialization_failure,
// 40P01 = deadlock_detected. Both are safe to retry — Postgres has
// already rolled the tx back and the caller can try again.
const RETRYABLE_SQLSTATES = new Set(["40001", "40P01"]);

function isRetryableSerializationError(e) {
  return !!(e && typeof e === "object" && RETRYABLE_SQLSTATES.has(e.code));
}

// Sleep with jitter used between retries. 40001 storms happen when many
// concurrent walkers hit the same lease row · jitter spreads them out.
async function sleepWithJitter(baseMs, attempt) {
  const backoff = Math.min(baseMs * Math.pow(2, attempt), 2000);
  const jitter  = Math.floor(Math.random() * backoff);
  await new Promise((r) => setTimeout(r, backoff + jitter));
}

export async function acquireProviderLease(provider, walkerId, opts = {}) {
  // 2026-08-24 · Stage-10 stability · 30s → 300s so legitimate queued workers
  // don't fail while patiently waiting behind other legitimate workers. Governor
  // remains authoritative · nobody bypasses. Every request WAITS→ACQUIRES→WORKS.
  //
  // 2026-08-24 · P0 concurrency fix · Under MAX_SLOTS=10 burst, the SERIALIZABLE
  // acquire tx was aborting with SQLSTATE 40001 (transport walker: 100% failure,
  // market walker: 95% persisted=0). Retry with exponential + jitter backoff so
  // the walker survives the conflict instead of the whole cycle failing.
  const maxWaitMs           = opts.maxWaitMs ?? 300000;
  // 2026-08-24 · bumped 8 → 20 after single-event investigation. One
  // transport:Bantul cycle exhausted 8 retries during a MAX_SLOTS=10
  // burst · retry budget (~16s) was less than sustained-contention window.
  // 20 attempts ≈ ~40s worst-case backoff · fits inside the 300s outer
  // deadline · never weakens SERIALIZABLE isolation.
  const maxSerializationTry = opts.maxSerializationRetries ?? 20;
  const deadline            = Date.now() + maxWaitMs;
  const pool                = getPool();
  let serializationAttempts = 0;

  while (Date.now() < deadline) {
    const client = await pool.connect();
    // 2026-08-24 · P0 fix · doSerializationRetry pattern from
    // _transport-walker-cycle.mjs (proven). Previous version called
    // client.release() inside the catch AND again in the finally, producing
    // "Release called on client which has already been released to the pool"
    // errors that blocked new-city cycles from completing. The single release
    // site is now the finally block · retry sleep runs AFTER release, outside
    // the try/catch/finally.
    let doSerializationRetry = false;
    try {
      await client.query("BEGIN ISOLATION LEVEL SERIALIZABLE");
      const cfgR = await client.query(
        `SELECT provider, min_interval_ms, max_concurrent FROM nex.provider_rate_config WHERE provider = $1 FOR UPDATE`,
        [provider],
      );
      if (cfgR.rowCount === 0) {
        await client.query("ROLLBACK");
        throw new Error(`Provider "${provider}" not configured in nex.provider_rate_config`);
      }
      const cfg = cfgR.rows[0];
      const activeR = await client.query(
        `SELECT lease_id, acquired_at, expires_at FROM nex.provider_rate_lease WHERE provider = $1 AND released_at IS NULL`,
        [provider],
      );
      const now = Date.now();
      const effectivelyActive = activeR.rows.filter((r) => new Date(r.expires_at).getTime() > now);
      if (effectivelyActive.length >= cfg.max_concurrent) {
        const oldest = effectivelyActive.reduce((a, b) => (new Date(a.expires_at) < new Date(b.expires_at) ? a : b));
        const wait = Math.max(50, new Date(oldest.expires_at).getTime() - now);
        await client.query("COMMIT");
        await new Promise((r) => setTimeout(r, Math.min(wait, deadline - Date.now())));
        continue;
      }
      const lastR = await client.query(
        `SELECT MAX(released_at) AS latest FROM nex.provider_rate_lease WHERE provider = $1 AND released_at IS NOT NULL`,
        [provider],
      );
      const lastActivity = Math.max(
        lastR.rows[0]?.latest ? new Date(lastR.rows[0].latest).getTime() : 0,
        ...effectivelyActive.map((r) => new Date(r.acquired_at).getTime()),
        0,
      );
      if (lastActivity > 0 && (now - lastActivity) < cfg.min_interval_ms) {
        const wait = cfg.min_interval_ms - (now - lastActivity);
        await client.query("COMMIT");
        await new Promise((r) => setTimeout(r, Math.min(wait, deadline - Date.now())));
        continue;
      }
      const ins = await client.query(
        `INSERT INTO nex.provider_rate_lease (provider, walker_id) VALUES ($1, $2) RETURNING lease_id`,
        [provider, walkerId],
      );
      await client.query("COMMIT");
      return ins.rows[0].lease_id;
    } catch (e) {
      try { await client.query("ROLLBACK"); } catch { /* ignore */ }
      if (isRetryableSerializationError(e) && serializationAttempts < maxSerializationTry) {
        serializationAttempts += 1;
        doSerializationRetry = true;
      } else {
        throw e;
      }
    } finally {
      client.release();
    }
    if (doSerializationRetry) {
      await sleepWithJitter(50, serializationAttempts);
    }
  }
  throw new Error(`Failed to acquire "${provider}" lease within ${maxWaitMs}ms`);
}

/**
 * Retry helper: run `fn` and retry on Postgres serialization/deadlock errors.
 * Use this to wrap any short DB transaction that runs under concurrent load
 * (e.g. persistence upserts hit from multiple walkers on shared rows).
 *
 * fn MUST be idempotent · retries repeat it wholesale after a rollback.
 */
export async function withSerializationRetry(fn, opts = {}) {
  const maxRetries = opts.maxRetries ?? 8;
  const baseMs     = opts.baseMs     ?? 50;
  let attempt = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      return await fn();
    } catch (e) {
      if (isRetryableSerializationError(e) && attempt < maxRetries) {
        attempt += 1;
        await sleepWithJitter(baseMs, attempt);
        continue;
      }
      throw e;
    }
  }
}

export async function releaseProviderLease(leaseId) {
  const pool = getPool();
  try {
    await pool.query(`UPDATE nex.provider_rate_lease SET released_at = now() WHERE lease_id = $1 AND released_at IS NULL`, [leaseId]);
  } catch (e) {
    // Non-fatal · lease will auto-expire from expires_at.
    console.error(`  ! provider lease release failed:`, e.message ?? e);
  }
}
