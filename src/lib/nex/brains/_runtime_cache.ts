// src/lib/nex/brains/_runtime_cache.ts
//
// In-memory brain cache. Serves runtime reads without hitting Supabase
// on every request. ADR-0037 · the "Cache" tier in the stack:
//   API → Brain Runtime → Cache → Supabase → Filesystem
//
// Phase 1 policy:
//   · TTL per entry (default 5 minutes) — refreshes on next access
//   · Explicit invalidation on brain_version_published / rolled_back
//     events (wired later when the events-subscription surface ships)
//   · Global clear() for admin ops and testing
//   · Never blocks on a stale entry — returns cache if fresh, otherwise
//     the caller re-loads and populates
//
// The cache is bounded — the process only holds as many brains as are
// actively queried within the TTL window. No eviction complexity
// needed at Phase 1 scale.

import type { BrainLoadResult } from "./_supabase_loader";

const DEFAULT_TTL_MS = 5 * 60 * 1000; // 5 minutes

type CacheEntry = {
  result:    BrainLoadResult;
  loaded_at: number;
  ttl_ms:    number;
};

class BrainRuntimeCache {
  private store = new Map<string, CacheEntry>();
  private defaultTtl = DEFAULT_TTL_MS;

  setDefaultTtl(ms: number): void {
    this.defaultTtl = ms;
  }

  get(slug: string): BrainLoadResult | null {
    const entry = this.store.get(slug);
    if (!entry) return null;
    if (Date.now() - entry.loaded_at > entry.ttl_ms) {
      this.store.delete(slug);
      return null;
    }
    // Tag the returned result so consumers can distinguish cache hits.
    return { ...entry.result, source: "cache" };
  }

  set(slug: string, result: BrainLoadResult, ttlMs?: number): void {
    this.store.set(slug, {
      result,
      loaded_at: Date.now(),
      ttl_ms: ttlMs ?? this.defaultTtl,
    });
  }

  invalidate(slug: string): void {
    this.store.delete(slug);
  }

  invalidateAll(): void {
    this.store.clear();
  }

  size(): number {
    return this.store.size;
  }

  snapshot(): Array<{ slug: string; loaded_at: number; ttl_ms: number; source: string }> {
    return Array.from(this.store.entries()).map(([slug, entry]) => ({
      slug,
      loaded_at: entry.loaded_at,
      ttl_ms: entry.ttl_ms,
      source: entry.result.source,
    }));
  }
}

/** Module-level singleton — one cache per Node process. */
export const brainCache = new BrainRuntimeCache();
