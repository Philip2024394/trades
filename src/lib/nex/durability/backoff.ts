// src/lib/nex/durability/backoff.ts
//
// UWI · Wave 2 · D6 · Jittered exponential backoff utility (~30 LOC)
// Founder-authorised programme.
//
// Unified backoff primitive. Attempt N delay = min(cap, base * 2^N) with
// symmetric jitter in [1 - jitter_fraction, 1 + jitter_fraction] to break
// synchronised retry storms across worker fleets. Deterministic under a
// supplied random function (for tests); jittered by default.

export interface BackoffConfig {
  /** Baseline delay for attempt 0. Milliseconds. */
  readonly base_ms: number;
  /** Maximum delay for any attempt. Milliseconds. */
  readonly cap_ms: number;
  /** Symmetric jitter as a fraction of the exponential delay. 0 = deterministic, 0.5 = ±50%. */
  readonly jitter_fraction: number;
}

export const DEFAULT_BACKOFF: BackoffConfig = {
  base_ms: 500,
  cap_ms: 30_000,
  jitter_fraction: 0.5,
};

/** Compute the next delay for retry attempt N (0-indexed). Pure. */
export function jitteredBackoff(
  attempt: number,
  config: BackoffConfig = DEFAULT_BACKOFF,
  random: () => number = Math.random,
): number {
  const exp_delay = Math.min(config.cap_ms, config.base_ms * Math.pow(2, Math.max(0, attempt)));
  const jitter = 1 + (random() * 2 - 1) * Math.max(0, Math.min(1, config.jitter_fraction));
  return Math.max(0, Math.floor(exp_delay * jitter));
}
