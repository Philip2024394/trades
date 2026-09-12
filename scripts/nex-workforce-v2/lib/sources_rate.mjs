// NEX Workforce v2 · Slice 1c · Central Source Rate Limits (per D3)
// ─────────────────────────────────────────────────────────────────────────────
// Central per-source rate policy · step-libraries may override for specific
// steps but the source-level default is authoritative.
//
// Simple token-bucket per source_slug. Kept in-memory per agent process
// (each agent has its own bucket). The DB-level per-source concurrency cap
// (max_concurrent_per_source, enforced in claim()) handles cross-agent
// coordination; this in-agent bucket handles per-request politeness.
//
// Policy shape:
//   { requestsPerSec, burst, description }
//
// Step override (in step-library):
//   step = { id, execute, rateOverride: { requestsPerSec, burst } }

const DEFAULT_POLICIES = {
  // Overpass API · typical polite rate
  overpass:      { requestsPerSec: 0.5, burst: 2, description: "Overpass · 1 req / 2s" },
  // Image extraction hosts · generic default
  image:         { requestsPerSec: 5,   burst: 10, description: "image hosts · 5 req/s" },
  // Hello-world smoke test source · no throttling
  helloworld:    { requestsPerSec: 100, burst: 100, description: "smoke test · unlimited" },
  // Fallback · reasonable default
  __default__:   { requestsPerSec: 1,   burst: 3, description: "default polite rate" },
};

class TokenBucket {
  constructor(policy) {
    this.rate = policy.requestsPerSec;
    this.capacity = policy.burst;
    this.tokens = policy.burst;
    this.lastRefill = Date.now();
  }

  async acquire(count = 1) {
    while (true) {
      this._refill();
      if (this.tokens >= count) {
        this.tokens -= count;
        return;
      }
      // Not enough tokens · wait for at least one to be produced
      const need = count - this.tokens;
      const waitMs = Math.ceil((need / this.rate) * 1000);
      await new Promise((res) => setTimeout(res, waitMs));
    }
  }

  _refill() {
    const now = Date.now();
    const elapsed = (now - this.lastRefill) / 1000;
    if (elapsed <= 0) return;
    const added = elapsed * this.rate;
    this.tokens = Math.min(this.capacity, this.tokens + added);
    this.lastRefill = now;
  }
}

const bucketCache = new Map(); // key: `${source}::${override?}`

/** Get or create a token bucket for a source (with optional step-level override) */
function getBucket(sourceSlug, override) {
  const policy = override
    ?? DEFAULT_POLICIES[sourceSlug]
    ?? DEFAULT_POLICIES.__default__;
  const key = override
    ? `${sourceSlug}::${policy.requestsPerSec}::${policy.burst}`
    : sourceSlug;
  let b = bucketCache.get(key);
  if (!b) { b = new TokenBucket(policy); bucketCache.set(key, b); }
  return b;
}

/** Wait for permission to make one request against `sourceSlug`. */
export async function acquire(sourceSlug, stepOverride = null) {
  const bucket = getBucket(sourceSlug, stepOverride);
  await bucket.acquire(1);
}

/** For tests: reset all buckets */
export function _resetForTests() { bucketCache.clear(); }

/** Introspection · used by the agent to log its rate configuration on startup */
export function policyFor(sourceSlug) {
  return DEFAULT_POLICIES[sourceSlug] ?? DEFAULT_POLICIES.__default__;
}
