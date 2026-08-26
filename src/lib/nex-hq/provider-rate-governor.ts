// src/lib/nex-hq/provider-rate-governor.ts
//
// NEX Provider Rate Governor · Phase A of workforce scaling (2026-08-24).
//
// Doctrine anchor: project_nex_provider_rate_governor_scaling_2026_08_24
//
// Purpose: DECOUPLE workforce capacity (MAX_SLOTS) from provider-side rate
// limits. 100 workers can wait behind ONE Nominatim slot without either
// being abusive or wasting workforce capacity.
//
// Contract (called by walkers before firing any external provider request):
//   1. acquireLease(pool, provider, walkerId) → { granted, leaseId, waitMs, reason }
//   2. if !granted · sleep waitMs · retry
//   3. do the provider request
//   4. releaseLease(pool, leaseId)
//
// Pure lease logic is exported for testing · a DB adapter wraps it.
// The DB-facing functions are minimal · governor is easy to reason about.

import type { Pool, PoolClient } from "pg";

export interface RateConfig {
  provider: string;
  minIntervalMs: number;
  maxConcurrent: number;
}

export interface ActiveLease {
  leaseId: string;
  provider: string;
  walkerId: string;
  acquiredAt: Date;
  expiresAt: Date;
}

export interface AcquireDecision {
  granted: boolean;
  reason: "granted" | "max_concurrent_reached" | "min_interval_not_elapsed" | "unknown_provider";
  waitMs: number;   // >0 when denied · caller sleeps this long before retry
}

// ── Pure decision logic (called by DB acquire · exported for tests) ──────

export function decideAcquire(
  config: RateConfig | null,
  activeLeases: ActiveLease[],
  mostRecentReleasedAt: Date | null,
  now: Date = new Date(),
): AcquireDecision {
  if (!config) return { granted: false, reason: "unknown_provider", waitMs: 5000 };

  // Effective concurrent count = active leases whose expires_at is still in the future.
  // Leases past expires_at are treated as released (stale · walker likely crashed).
  const effectivelyActive = activeLeases.filter((l) => l.expiresAt.getTime() > now.getTime());
  if (effectivelyActive.length >= config.maxConcurrent) {
    // Wait until the oldest active lease expires · then retry.
    const oldest = effectivelyActive.reduce((a, b) => (a.expiresAt < b.expiresAt ? a : b));
    const waitMs = Math.max(50, oldest.expiresAt.getTime() - now.getTime());
    return { granted: false, reason: "max_concurrent_reached", waitMs };
  }

  // Enforce min_interval_ms since the last released (or currently held) provider call.
  const lastActivityMs = Math.max(
    mostRecentReleasedAt ? mostRecentReleasedAt.getTime() : 0,
    ...effectivelyActive.map((l) => l.acquiredAt.getTime()),
    0,
  );
  if (lastActivityMs > 0) {
    const elapsed = now.getTime() - lastActivityMs;
    if (elapsed < config.minIntervalMs) {
      return { granted: false, reason: "min_interval_not_elapsed", waitMs: config.minIntervalMs - elapsed };
    }
  }

  return { granted: true, reason: "granted", waitMs: 0 };
}

// ── DB adapter ──────────────────────────────────────────────────────────

/**
 * Attempt to acquire a provider rate lease · returns leaseId when granted or
 * waitMs when denied. Wraps decideAcquire with a serialisable transaction so
 * multiple walkers racing for a Nominatim slot serialise correctly.
 */
export async function acquireLease(
  pool: Pool | PoolClient,
  provider: string,
  walkerId: string,
  cycleRunId: string | null = null,
): Promise<{ granted: true; leaseId: string } | { granted: false; waitMs: number; reason: AcquireDecision["reason"] }> {
  const client = "connect" in pool ? await pool.connect() : (pool as PoolClient);
  const isPool = "connect" in pool;
  try {
    await client.query("BEGIN ISOLATION LEVEL SERIALIZABLE");
    const cfgRes = await client.query<{ provider: string; min_interval_ms: number; max_concurrent: number }>(
      `SELECT provider, min_interval_ms, max_concurrent FROM nex.provider_rate_config WHERE provider = $1 FOR UPDATE`,
      [provider],
    );
    const cfg = cfgRes.rows[0]
      ? { provider: cfgRes.rows[0].provider, minIntervalMs: cfgRes.rows[0].min_interval_ms, maxConcurrent: cfgRes.rows[0].max_concurrent }
      : null;
    const leases = await client.query<{ lease_id: string; provider: string; walker_id: string; acquired_at: string; expires_at: string }>(
      `SELECT lease_id, provider, walker_id, acquired_at, expires_at
         FROM nex.provider_rate_lease
        WHERE provider = $1 AND released_at IS NULL`,
      [provider],
    );
    const activeLeases: ActiveLease[] = leases.rows.map((r) => ({
      leaseId: r.lease_id,
      provider: r.provider,
      walkerId: r.walker_id,
      acquiredAt: new Date(r.acquired_at),
      expiresAt: new Date(r.expires_at),
    }));
    const lastReleased = await client.query<{ latest: string | null }>(
      `SELECT MAX(released_at) AS latest FROM nex.provider_rate_lease WHERE provider = $1 AND released_at IS NOT NULL`,
      [provider],
    );
    const mostRecentReleasedAt = lastReleased.rows[0]?.latest ? new Date(lastReleased.rows[0].latest) : null;

    const decision = decideAcquire(cfg, activeLeases, mostRecentReleasedAt);
    if (!decision.granted) {
      await client.query("COMMIT");
      return { granted: false, waitMs: decision.waitMs, reason: decision.reason };
    }

    const inserted = await client.query<{ lease_id: string }>(
      `INSERT INTO nex.provider_rate_lease (provider, walker_id, cycle_run_id)
       VALUES ($1, $2, $3) RETURNING lease_id`,
      [provider, walkerId, cycleRunId],
    );
    await client.query("COMMIT");
    return { granted: true, leaseId: inserted.rows[0].lease_id };
  } catch (e) {
    try { await client.query("ROLLBACK"); } catch { /* ignore */ }
    throw e;
  } finally {
    if (isPool) (client as PoolClient).release();
  }
}

export async function releaseLease(pool: Pool | PoolClient, leaseId: string): Promise<void> {
  await pool.query(
    `UPDATE nex.provider_rate_lease SET released_at = now() WHERE lease_id = $1 AND released_at IS NULL`,
    [leaseId],
  );
}

/**
 * Acquire with automatic retry/backoff. Convenience wrapper for the common
 * walker pattern. Returns leaseId on success · throws on unrecoverable failure
 * (unknown provider) or exhaustion (maxWaitMs elapsed without a grant).
 */
export async function acquireLeaseWithRetry(
  pool: Pool | PoolClient,
  provider: string,
  walkerId: string,
  opts: { cycleRunId?: string | null; maxWaitMs?: number; maxAttempts?: number } = {},
): Promise<string> {
  // 2026-08-24 · bumped 30s → 300s per Philip's Stage-10 stability doctrine.
  // A legitimate worker queued behind other legitimate workers should WAIT
  // and ACQUIRE, not FAIL and disappear. 300s covers the worst-case burst at
  // MAX_SLOTS=10: 10 walkers × up to 100 queries × 1500ms = ~25 min lane time,
  // but each worker only waits for ITS OWN slot, so 5 min is comfortably safe.
  const maxWaitMs = opts.maxWaitMs ?? 300000;
  const maxAttempts = opts.maxAttempts ?? 200;
  const deadline = Date.now() + maxWaitMs;
  let lastReason: string = "unknown";
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const remaining = deadline - Date.now();
    if (remaining <= 0) break;
    const r = await acquireLease(pool, provider, walkerId, opts.cycleRunId ?? null);
    if (r.granted) return r.leaseId;
    lastReason = r.reason;
    if (r.reason === "unknown_provider") throw new Error(`Provider "${provider}" not configured in nex.provider_rate_config`);
    const sleep = Math.min(r.waitMs, remaining);
    await new Promise((resolve) => setTimeout(resolve, sleep));
  }
  throw new Error(`Failed to acquire "${provider}" lease within ${maxWaitMs}ms · last reason: ${lastReason}`);
}
