// src/lib/nex/intelligence-storage-grid/accommodation/hot-tier-cache.ts
//
// NEX Accommodation Agent · Hot-Tier cache
// Founder BEGIN 1 · LIVE-PROOF-HOT-TIER · 2026-09-09
//
// Founder constraint (verbatim):
//   "prove the speed improvement against canonical Postgres, don't merely
//    build a cache and declare success."
//
// Design principles:
//   1. Hot-tier is DISPOSABLE · rebuilt on any cache miss from canonical
//      Postgres · NEVER a second source of truth.
//   2. Every request MUST record cache_hit / cache_miss + cache_age +
//      cache_ttl_remaining so speed claims are auditable.
//   3. Payload IDENTITY is proven separately by a stable-fields hash · the
//      hot-tier response and the canonical response must hash identically
//      for the same query at the same moment (excluding volatile timestamps).
//   4. Two paths co-exist in production behind a query param:
//        ?scope=canonical  → bypass cache · always hit Postgres · reference
//        ?scope=hot-tier   → default · use cache with TTL
//      The bench harness compares both.
//
// Zero fabrication. Zero LLM. No new database. No paid infra.
// Pure in-process Map · single-instance dev-server semantics.

import crypto from "node:crypto";

// ═══════════════════════════════════════════════════════════════════
// Cache config (env-overridable for benchmarks)
// ═══════════════════════════════════════════════════════════════════

/** Default TTL (30s) · configurable via NEX_ACCOMMODATION_HOT_TIER_TTL_MS. */
export const HOT_TIER_TTL_MS = (() => {
  const raw = process.env.NEX_ACCOMMODATION_HOT_TIER_TTL_MS;
  const n = raw ? Number(raw) : 30_000;
  return Number.isFinite(n) && n >= 0 && n <= 600_000 ? n : 30_000;
})();

/** Max cache entries (LRU-like eviction · bounded so cache doesn't grow unbounded). */
export const HOT_TIER_MAX_ENTRIES = 256;

// ═══════════════════════════════════════════════════════════════════
// Cache primitives (module-local · single-instance)
// ═══════════════════════════════════════════════════════════════════

interface CacheEntry<T> {
  key: string;
  body: T;
  stored_at_ms: number;
  expires_at_ms: number;
  hit_count: number;
}

const _cache: Map<string, CacheEntry<unknown>> = new Map();
const _stats = {
  hits: 0,
  misses: 0,
  evictions: 0,
  refreshes: 0,
  bootstrap_at_iso: new Date().toISOString(),
};

/** Cache key builder · stable across identical query shapes. */
export function hotTierCacheKey(input: Record<string, unknown>): string {
  const norm: Record<string, unknown> = {};
  for (const k of Object.keys(input).sort()) {
    const v = input[k];
    norm[k] = v ?? null;
  }
  return `acc:v1:${JSON.stringify(norm)}`;
}

/** Get with TTL check. Returns null on miss or expired. */
export function hotTierGet<T>(key: string): { body: T; age_ms: number; ttl_remaining_ms: number } | null {
  const entry = _cache.get(key) as CacheEntry<T> | undefined;
  if (!entry) {
    _stats.misses++;
    return null;
  }
  const now = Date.now();
  if (entry.expires_at_ms <= now) {
    _cache.delete(key);
    _stats.evictions++;
    _stats.misses++;
    return null;
  }
  entry.hit_count++;
  _stats.hits++;
  return {
    body: entry.body,
    age_ms: now - entry.stored_at_ms,
    ttl_remaining_ms: entry.expires_at_ms - now,
  };
}

/** Store with TTL. Bounded LRU-ish eviction · drops oldest when full. */
export function hotTierSet<T>(key: string, body: T, ttl_ms: number = HOT_TIER_TTL_MS): void {
  const now = Date.now();
  if (_cache.size >= HOT_TIER_MAX_ENTRIES) {
    // Drop oldest by stored_at_ms
    let oldestKey: string | null = null;
    let oldestTs = Infinity;
    for (const [k, e] of _cache) {
      if (e.stored_at_ms < oldestTs) {
        oldestTs = e.stored_at_ms;
        oldestKey = k;
      }
    }
    if (oldestKey) {
      _cache.delete(oldestKey);
      _stats.evictions++;
    }
  }
  _cache.set(key, {
    key,
    body,
    stored_at_ms: now,
    expires_at_ms: now + ttl_ms,
    hit_count: 0,
  });
  _stats.refreshes++;
}

/** Force-invalidate a key or the entire cache (admin / test helper). */
export function hotTierInvalidate(keyOrAll?: string): number {
  if (!keyOrAll) {
    const n = _cache.size;
    _cache.clear();
    _stats.evictions += n;
    return n;
  }
  const existed = _cache.delete(keyOrAll);
  if (existed) _stats.evictions++;
  return existed ? 1 : 0;
}

/** Read stats without mutating. */
export function hotTierStats(): {
  size: number;
  hits: number;
  misses: number;
  evictions: number;
  refreshes: number;
  hit_ratio: number;
  bootstrap_at_iso: string;
  ttl_ms: number;
  max_entries: number;
} {
  const total = _stats.hits + _stats.misses;
  return {
    size: _cache.size,
    hits: _stats.hits,
    misses: _stats.misses,
    evictions: _stats.evictions,
    refreshes: _stats.refreshes,
    hit_ratio: total > 0 ? Math.round((_stats.hits / total) * 10000) / 10000 : 0,
    bootstrap_at_iso: _stats.bootstrap_at_iso,
    ttl_ms: HOT_TIER_TTL_MS,
    max_entries: HOT_TIER_MAX_ENTRIES,
  };
}

// ═══════════════════════════════════════════════════════════════════
// Payload IDENTITY hash (Founder rigor: prove hot-tier == canonical data)
// ═══════════════════════════════════════════════════════════════════

/**
 * Hash the STABLE parts of a live-proof response so callers can prove that
 * the hot-tier body is byte-identical to the canonical body (modulo the
 * intentionally-volatile fields listed below).
 *
 * Volatile fields (excluded from hash):
 *   latency_ms · latency_breakdown · agent_heartbeat.* · throughput_24h.* ·
 *   trace.marketing_claim_funnel_note · gap_engine_scan_ms ·
 *   gap_engine_full_corpus.scan_ms
 *
 * Everything else (postings, cards, funnel, coverage, gap_engine counts,
 * governance_gateway, trace source/gate flags) MUST match.
 */
export function payloadIdentityHash(body: any): string {
  const stable = extractStableView(body);
  const json = JSON.stringify(stable, Object.keys(stable).sort());
  return crypto.createHash("sha256").update(json).digest("hex").slice(0, 24);
}

function extractStableView(body: any): any {
  if (!body || typeof body !== "object") return body;
  const clone = JSON.parse(JSON.stringify(body));
  // Remove volatile top-level fields
  delete clone.latency_ms;
  delete clone.latency_breakdown;
  delete clone.gap_engine_scan_ms;
  if (clone.gap_engine_full_corpus) delete clone.gap_engine_full_corpus.scan_ms;
  if (clone.agent_heartbeat) {
    delete clone.agent_heartbeat.last_heartbeat_iso;
    delete clone.agent_heartbeat.heartbeat_age_seconds;
    delete clone.agent_heartbeat.last_success_iso;
    delete clone.agent_heartbeat.last_failure_iso;
    delete clone.agent_heartbeat.current_task;
  }
  if (clone.throughput_24h) {
    delete clone.throughput_24h.window_start_iso;
    delete clone.throughput_24h.window_end_iso;
    delete clone.throughput_24h.bar_bins;
    delete clone.throughput_24h.events_total;
    delete clone.throughput_24h.work_completed;
    delete clone.throughput_24h.work_blocked;
    delete clone.throughput_24h.internet_offline_toggles;
    delete clone.throughput_24h.internet_online_toggles;
    delete clone.throughput_24h.records_processed_sum;
    delete clone.throughput_24h.work_types;
  }
  return clone;
}

// ═══════════════════════════════════════════════════════════════════
// Scope routing (query param semantics)
// ═══════════════════════════════════════════════════════════════════

export type HotTierScope = "hot-tier" | "canonical";

export function resolveScope(raw: string | null | undefined): HotTierScope {
  if (raw === "canonical") return "canonical";
  return "hot-tier"; // default · Founder wants the cache path to be the default
}
