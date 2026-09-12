// src/lib/nex/intelligence-storage-grid/accommodation/hot-tier-facts.ts
//
// Founder BEGIN 2026-09-09 · HOT-TIER FACTS (P3)
//
// In-process, sub-ms FactBundle lookup keyed by public_listing_ref.
//
// Design rules (inherited from hot-tier-cache.ts + Founder guidance):
//   1. Disposable · rebuildable on miss from canonical Postgres.
//   2. Bounded LRU (default 4,096 entries · covers all 877 visible + growth
//      headroom for a country expansion).
//   3. TTL (default 15 min · long enough that repeated chat turns hit warm ·
//      short enough that a Gap Engine write is reflected within 15 min).
//   4. onCanonicalChange(listing_ref) hook · called by writers to force refresh.
//   5. Stats API returns hit ratio · P50/P95/P99 lookup ms · size · so we can
//      measure "customer-answered-from-hot-tier %" against the Founder target.
//   6. Zero side effects. Zero I/O. Never talks to Postgres.

import { performance } from "node:perf_hooks";
import type { FactBundle } from "./fact-computer";

// ═══════════════════════════════════════════════════════════════════
// Config
// ═══════════════════════════════════════════════════════════════════

export const HOT_TIER_FACTS_TTL_MS = (() => {
  const raw = process.env.NEX_ACCOMMODATION_HOT_TIER_FACTS_TTL_MS;
  const n = raw ? Number(raw) : 15 * 60 * 1_000;
  return Number.isFinite(n) && n >= 0 && n <= 60 * 60 * 1_000 ? n : 15 * 60 * 1_000;
})();

export const HOT_TIER_FACTS_MAX_ENTRIES = (() => {
  const raw = process.env.NEX_ACCOMMODATION_HOT_TIER_FACTS_MAX;
  const n = raw ? Number(raw) : 4_096;
  return Number.isFinite(n) && n >= 1 && n <= 100_000 ? n : 4_096;
})();

// ═══════════════════════════════════════════════════════════════════
// Cache primitives
// ═══════════════════════════════════════════════════════════════════

interface FactCacheEntry {
  listing_ref: string;
  bundle: FactBundle;
  stored_at_ms: number;
  expires_at_ms: number;
  hit_count: number;
  last_hit_at_ms: number;
}

const _cache: Map<string, FactCacheEntry> = new Map();
const _lookupMs: number[] = [];
const _stats = {
  hits: 0,
  misses: 0,
  expired: 0,
  evictions: 0,
  refreshes: 0,
  invalidations_from_canonical_change: 0,
  bootstrap_at_iso: new Date().toISOString(),
};

function recordLookup(dt: number): void {
  _lookupMs.push(dt);
  if (_lookupMs.length > 10_000) _lookupMs.shift();
}

function evictOldestIfFull(): void {
  if (_cache.size < HOT_TIER_FACTS_MAX_ENTRIES) return;
  let oldestKey: string | null = null;
  let oldestTs = Infinity;
  for (const [k, e] of _cache) {
    if (e.last_hit_at_ms < oldestTs) {
      oldestTs = e.last_hit_at_ms;
      oldestKey = k;
    }
  }
  if (oldestKey) {
    _cache.delete(oldestKey);
    _stats.evictions++;
  }
}

// ═══════════════════════════════════════════════════════════════════
// Public API
// ═══════════════════════════════════════════════════════════════════

export function factHotGet(listing_ref: string): {
  bundle: FactBundle;
  age_ms: number;
  ttl_remaining_ms: number;
  lookup_ms: number;
} | null {
  const t0 = performance.now();
  const entry = _cache.get(listing_ref);
  if (!entry) {
    const dt = performance.now() - t0;
    recordLookup(dt);
    _stats.misses++;
    return null;
  }
  const now = Date.now();
  if (entry.expires_at_ms <= now) {
    _cache.delete(listing_ref);
    _stats.expired++;
    _stats.misses++;
    const dt = performance.now() - t0;
    recordLookup(dt);
    return null;
  }
  entry.hit_count++;
  entry.last_hit_at_ms = now;
  _stats.hits++;
  const dt = performance.now() - t0;
  recordLookup(dt);
  return {
    bundle: entry.bundle,
    age_ms: now - entry.stored_at_ms,
    ttl_remaining_ms: entry.expires_at_ms - now,
    lookup_ms: Math.round(dt * 1000) / 1000,
  };
}

export function factHotSet(listing_ref: string, bundle: FactBundle, ttl_ms: number = HOT_TIER_FACTS_TTL_MS): void {
  evictOldestIfFull();
  const now = Date.now();
  _cache.set(listing_ref, {
    listing_ref,
    bundle,
    stored_at_ms: now,
    expires_at_ms: now + ttl_ms,
    hit_count: 0,
    last_hit_at_ms: now,
  });
  _stats.refreshes++;
}

export function factHotSetBulk(bundles: readonly FactBundle[], ttl_ms: number = HOT_TIER_FACTS_TTL_MS): number {
  let n = 0;
  for (const b of bundles) {
    factHotSet(b.listing_ref, b, ttl_ms);
    n++;
  }
  return n;
}

/**
 * Called by Gap Engine + Coverage Queue writers whenever the canonical row
 * (or its evidence) changes. Forces a refresh on the next lookup.
 */
export function onCanonicalChange(listing_ref: string): boolean {
  const existed = _cache.delete(listing_ref);
  if (existed) _stats.invalidations_from_canonical_change++;
  return existed;
}

export function factHotInvalidateAll(): number {
  const n = _cache.size;
  _cache.clear();
  _stats.evictions += n;
  return n;
}

// ═══════════════════════════════════════════════════════════════════
// Stats · reads only
// ═══════════════════════════════════════════════════════════════════

function pct(sorted: readonly number[], p: number): number {
  if (sorted.length === 0) return 0;
  const i = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[Math.max(0, i)];
}

export function factHotStats(): {
  size: number;
  max_entries: number;
  ttl_ms: number;
  hits: number;
  misses: number;
  expired: number;
  evictions: number;
  refreshes: number;
  invalidations_from_canonical_change: number;
  hit_ratio: number;
  lookup_ms_p50: number;
  lookup_ms_p95: number;
  lookup_ms_p99: number;
  bootstrap_at_iso: string;
} {
  const sorted = [..._lookupMs].sort((a, b) => a - b);
  const total = _stats.hits + _stats.misses;
  return {
    size: _cache.size,
    max_entries: HOT_TIER_FACTS_MAX_ENTRIES,
    ttl_ms: HOT_TIER_FACTS_TTL_MS,
    hits: _stats.hits,
    misses: _stats.misses,
    expired: _stats.expired,
    evictions: _stats.evictions,
    refreshes: _stats.refreshes,
    invalidations_from_canonical_change: _stats.invalidations_from_canonical_change,
    hit_ratio: total > 0 ? Math.round((_stats.hits / total) * 10000) / 10000 : 0,
    lookup_ms_p50: Math.round(pct(sorted, 50) * 1000) / 1000,
    lookup_ms_p95: Math.round(pct(sorted, 95) * 1000) / 1000,
    lookup_ms_p99: Math.round(pct(sorted, 99) * 1000) / 1000,
    bootstrap_at_iso: _stats.bootstrap_at_iso,
  };
}

/** Read-only enumeration · admin / bench helper. */
export function factHotEnumerate(): { listing_ref: string; age_ms: number; hit_count: number }[] {
  const now = Date.now();
  return [..._cache.values()].map((e) => ({
    listing_ref: e.listing_ref,
    age_ms: now - e.stored_at_ms,
    hit_count: e.hit_count,
  }));
}

/**
 * Founder BEGIN LCC 2026-09-09 · read all canonical business names in hot tier.
 * Used by the intent parser to detect specific-entity questions
 * (e.g. "how many rooms does Hotel Melia Purosani have?").
 * Zero I/O · pure in-memory.
 */
export function factHotAllNames(): { listing_ref: string; business_name: string }[] {
  const out: { listing_ref: string; business_name: string }[] = [];
  for (const entry of _cache.values()) {
    const name = entry.bundle.business_name;
    if (name && typeof name === "string" && name.length > 0) {
      out.push({ listing_ref: entry.listing_ref, business_name: name });
    }
  }
  return out;
}
