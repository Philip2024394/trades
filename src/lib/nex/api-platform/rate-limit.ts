// src/lib/nex/api-platform/rate-limit.ts
//
// Founder Phase 14 · P14-3 · Per-key sliding-window rate limiter.
//
// Tiers (requests per minute):
//   free       ·  20
//   pro        ·  300
//   enterprise ·  3000
//
// In-memory · single-process. For horizontal scale, swap to Redis. The
// interface stays identical.

import type { ApiKeyTier } from "./keys";

const WINDOW_MS = 60_000;
const LIMITS: Record<ApiKeyTier, number> = {
  free: 20,
  pro: 300,
  enterprise: 3000,
};

// key_id → array of request-start timestamps within the window
const buckets = new Map<string, number[]>();

export interface RateLimitVerdict {
  allowed: boolean;
  limit: number;
  remaining: number;
  reset_ms: number;
  retry_after_s: number | null;
}

export function checkRateLimit(api_key_id: string, tier: ApiKeyTier): RateLimitVerdict {
  const limit = LIMITS[tier] ?? LIMITS.free;
  const now = Date.now();
  const cutoff = now - WINDOW_MS;
  const arr = buckets.get(api_key_id) ?? [];
  // Trim old entries.
  const fresh: number[] = [];
  for (const t of arr) if (t > cutoff) fresh.push(t);
  if (fresh.length >= limit) {
    const oldest = fresh[0];
    const reset_ms = oldest + WINDOW_MS - now;
    buckets.set(api_key_id, fresh);
    return {
      allowed: false,
      limit,
      remaining: 0,
      reset_ms,
      retry_after_s: Math.ceil(reset_ms / 1000),
    };
  }
  fresh.push(now);
  buckets.set(api_key_id, fresh);
  return {
    allowed: true,
    limit,
    remaining: limit - fresh.length,
    reset_ms: WINDOW_MS,
    retry_after_s: null,
  };
}

export function rateLimitHeaders(v: RateLimitVerdict): Record<string, string> {
  const h: Record<string, string> = {
    "X-RateLimit-Limit": String(v.limit),
    "X-RateLimit-Remaining": String(v.remaining),
    "X-RateLimit-Reset": String(Math.ceil(v.reset_ms / 1000)),
  };
  if (v.retry_after_s != null) h["Retry-After"] = String(v.retry_after_s);
  return h;
}

// Test-only reset · called by smoke matrix to isolate cases.
export function _resetRateLimitFor(api_key_id: string): void {
  buckets.delete(api_key_id);
}
