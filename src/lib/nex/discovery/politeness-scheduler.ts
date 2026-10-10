// src/lib/nex/discovery/politeness-scheduler.ts
//
// UWI · Wave 3.3 · M9/M10 · Politeness scheduling
// Founder-authorised programme.
//
// Combines Wave 2 D4 `HostTokenBucketRegistry` with robots-parser's
// `crawl_delay` semantics. Every outbound fetch waits for:
//   max(token-bucket delay, crawl-delay since last fetch to this host)
// before proceeding.
//
// The scheduler is deterministic under supplied `now_ms` (for tests).

import type { CanonicalUrl, PolitenessOutcome } from "./types";
import { HostTokenBucketRegistry, type TokenBucketConfig } from "@/lib/nex/durability/token-bucket";

export interface PolitenessConfig {
  /** Default token-bucket config (may be overridden per host). */
  readonly default_bucket: TokenBucketConfig;
  /** Absolute maximum wait per request; caller aborts if exceeded. */
  readonly max_wait_ms: number;
}

export const DEFAULT_POLITENESS: PolitenessConfig = {
  default_bucket: { capacity: 4, refill_per_second: 1 }, // 1 req/s sustained, burst of 4
  max_wait_ms: 60_000,
};

export class PolitenessScheduler {
  private tokens: HostTokenBucketRegistry;
  private last_fetch_ms = new Map<string, number>(); // host → last fetch ts

  constructor(public readonly config: PolitenessConfig = DEFAULT_POLITENESS) {
    this.tokens = new HostTokenBucketRegistry(config.default_bucket);
  }

  /** Compute the delay-until-next-slot for a URL. Pure function; caller
   *  awaits the returned ms then re-checks. Returns null if within max_wait. */
  computeWaitMs(
    url: CanonicalUrl,
    crawl_delay_ms: number | null,
    now_ms: number = Date.now(),
  ): number {
    const token_wait = this.tokens.msUntilNextToken(url.host, undefined, now_ms);
    const last = this.last_fetch_ms.get(url.host);
    const crawl_wait = (crawl_delay_ms && last)
      ? Math.max(0, (last + crawl_delay_ms) - now_ms)
      : 0;
    return Math.max(token_wait, crawl_wait);
  }

  /** Schedule a fetch. Returns a PolitenessOutcome describing what
   *  waiting was done. Throws if the wait would exceed max_wait_ms. */
  async schedule(
    url: CanonicalUrl,
    crawl_delay_ms: number | null,
    now: () => number = () => Date.now(),
    sleeper: (ms: number) => Promise<void> = defaultSleep,
  ): Promise<PolitenessOutcome> {
    const start = now();
    const wait = this.computeWaitMs(url, crawl_delay_ms, start);

    if (wait > this.config.max_wait_ms) {
      throw new PolitenessDeadlineExceededError(url.host, wait, this.config.max_wait_ms);
    }

    if (wait > 0) await sleeper(wait);

    // Attempt to consume a token (should always succeed after the wait).
    const consumed_at = now();
    const got_token = this.tokens.tryConsume(url.host, undefined, consumed_at);
    if (!got_token) {
      // Race with another caller. Very short retry.
      await sleeper(100);
      const retry_ok = this.tokens.tryConsume(url.host);
      if (!retry_ok) throw new PolitenessScheduleError(url.host, "token contention after wait");
    }
    this.last_fetch_ms.set(url.host, now());

    const source: PolitenessOutcome["source"] =
      wait === 0 ? "none"
      : (crawl_delay_ms != null && this.last_fetch_ms.get(url.host)! - crawl_delay_ms <= start)
        ? "crawl_delay"
        : "token_bucket";

    return {
      scheduled_at_ms: now(),
      waited_ms: wait,
      source,
    };
  }
}

async function defaultSleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}

export class PolitenessDeadlineExceededError extends Error {
  constructor(public readonly host: string, public readonly required_ms: number, public readonly max_ms: number) {
    super(`politeness wait for host '${host}' would be ${required_ms}ms > max_wait ${max_ms}ms`);
    this.name = "PolitenessDeadlineExceededError";
  }
}

export class PolitenessScheduleError extends Error {
  constructor(public readonly host: string, detail: string) {
    super(`politeness schedule failure for host '${host}' · ${detail}`);
    this.name = "PolitenessScheduleError";
  }
}
