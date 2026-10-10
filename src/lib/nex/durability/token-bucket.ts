// src/lib/nex/durability/token-bucket.ts
//
// UWI · Wave 2 · D4 · Per-host token bucket (~80 LOC)
// Founder-authorised programme.
//
// Classical token-bucket rate limiter. Refills continuously at a fixed
// rate; permits bursts up to `capacity`. Used to enforce RFC 9309
// per-host politeness (crawl-delay) and defend allowlisted sources from
// unintended flood.
//
// Deterministic under supplied `now_ms` (for tests). No external deps.

export interface TokenBucketConfig {
  /** Maximum tokens (burst capacity). */
  readonly capacity: number;
  /** Refill rate in tokens per second. */
  readonly refill_per_second: number;
}

interface BucketState {
  tokens: number;
  last_refill_ms: number;
}

export class TokenBucket {
  private state: BucketState;

  constructor(public readonly config: TokenBucketConfig, now_ms: number = Date.now()) {
    if (config.capacity <= 0) throw new Error("TokenBucket capacity must be > 0");
    if (config.refill_per_second <= 0) throw new Error("TokenBucket refill_per_second must be > 0");
    this.state = { tokens: config.capacity, last_refill_ms: now_ms };
  }

  private refill(now_ms: number): void {
    const elapsed_s = (now_ms - this.state.last_refill_ms) / 1000;
    if (elapsed_s <= 0) return;
    const gained = elapsed_s * this.config.refill_per_second;
    this.state.tokens = Math.min(this.config.capacity, this.state.tokens + gained);
    this.state.last_refill_ms = now_ms;
  }

  /** Try to consume 1 token. Returns true if granted; false if empty. */
  tryConsume(now_ms: number = Date.now()): boolean {
    this.refill(now_ms);
    if (this.state.tokens >= 1) {
      this.state.tokens -= 1;
      return true;
    }
    return false;
  }

  /** Milliseconds until next token would be available (0 if already available). */
  msUntilNextToken(now_ms: number = Date.now()): number {
    this.refill(now_ms);
    if (this.state.tokens >= 1) return 0;
    const needed = 1 - this.state.tokens;
    return Math.ceil((needed / this.config.refill_per_second) * 1000);
  }

  snapshot(): Readonly<BucketState> {
    return { ...this.state };
  }
}

/** Registry that lazily creates a bucket per host. Buckets survive as
 *  long as the process; garbage-collection is intentionally not
 *  implemented — host set is bounded by the internet-gate allowlist. */
export class HostTokenBucketRegistry {
  private buckets = new Map<string, TokenBucket>();

  constructor(public readonly defaultConfig: TokenBucketConfig) {}

  get(host: string, config: TokenBucketConfig = this.defaultConfig): TokenBucket {
    let b = this.buckets.get(host);
    if (!b) {
      b = new TokenBucket(config);
      this.buckets.set(host, b);
    }
    return b;
  }

  /** Try to consume 1 token for `host`. Returns true if granted; false if throttled. */
  tryConsume(host: string, config?: TokenBucketConfig, now_ms: number = Date.now()): boolean {
    return this.get(host, config).tryConsume(now_ms);
  }

  /** Milliseconds until next token available for `host`. */
  msUntilNextToken(host: string, config?: TokenBucketConfig, now_ms: number = Date.now()): number {
    return this.get(host, config).msUntilNextToken(now_ms);
  }

  hosts(): string[] {
    return Array.from(this.buckets.keys());
  }
}
