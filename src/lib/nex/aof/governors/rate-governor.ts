// src/lib/nex/aof/governors/rate-governor.ts
//
// NEX Autonomous Operations Framework · Rate & politeness governor
// Founder-authorised programme · 2026-09-22.
//
// One central governor for:
//   * min_interval per host
//   * per-host concurrency ceiling
//   * per-source cooldown (delegates to source-cooldown for DB persistence)
//   * timeout backoff
//   * retry ceilings
//
// The governor is a decision surface: it returns "proceed" or a reason to
// wait/skip. It never actually fetches anything itself — the caller
// consults it, then respects the answer.

export interface RateGovernorConfig {
  readonly default_min_interval_ms: number;
  readonly default_concurrency: number;
  readonly max_retries: number;
  readonly default_backoff_base_ms: number;
  readonly default_backoff_max_ms: number;
  readonly cooldown_after_consecutive_failures: number;
  readonly cooldown_ms_by_failure_kind: Readonly<Record<string, number>>;
}

export const DEFAULT_RATE_GOVERNOR_CONFIG: RateGovernorConfig = {
  default_min_interval_ms: 2000,
  default_concurrency: 1,
  max_retries: 3,
  default_backoff_base_ms: 1000,
  default_backoff_max_ms: 60_000,
  cooldown_after_consecutive_failures: 3,
  cooldown_ms_by_failure_kind: {
    rate_limited: 60_000,
    source_unavailable: 30_000,
    ip_blocked: 600_000,      // 10 minutes · Founder-signed sources shouldn't be hammered when blocked
    network_error: 15_000,
    robots_denied: 3600_000,  // 1 hour · robots.txt decisions are stable
    parse_error: 10_000,
    other: 10_000,
  },
};

export interface HostState {
  readonly last_started_at_ms: number;
  readonly in_flight: number;
}

export interface ProceedInput {
  readonly host: string;
  readonly source_slug: string;
  readonly now_ms: number;
  readonly host_state: HostState;
  readonly host_min_interval_ms?: number;
  readonly host_concurrency?: number;
  readonly source_cooldown_until_ms?: number | null;
  readonly cfg?: Partial<RateGovernorConfig>;
}

export type ProceedDecision =
  | { kind: "proceed" }
  | { kind: "wait"; reason: string; ms_until_ok: number }
  | { kind: "skip_source_cooldown"; reason: string; ms_until_ok: number };

export function decideCanProceed(input: ProceedInput): ProceedDecision {
  const cfg = { ...DEFAULT_RATE_GOVERNOR_CONFIG, ...(input.cfg ?? {}) };
  // Source cooldown wins first · this is failover territory
  if (input.source_cooldown_until_ms && input.now_ms < input.source_cooldown_until_ms) {
    return {
      kind: "skip_source_cooldown",
      reason: `source ${input.source_slug} in cooldown`,
      ms_until_ok: input.source_cooldown_until_ms - input.now_ms,
    };
  }
  // Concurrency check
  const conc = input.host_concurrency ?? cfg.default_concurrency;
  if (input.host_state.in_flight >= conc) {
    return { kind: "wait", reason: `host ${input.host} at concurrency ${input.host_state.in_flight}/${conc}`, ms_until_ok: 500 };
  }
  // Politeness min_interval
  const minInt = input.host_min_interval_ms ?? cfg.default_min_interval_ms;
  const elapsed = input.now_ms - input.host_state.last_started_at_ms;
  if (elapsed < minInt) {
    return { kind: "wait", reason: `host ${input.host} min_interval ${minInt}ms · elapsed ${elapsed}ms`, ms_until_ok: minInt - elapsed };
  }
  return { kind: "proceed" };
}

export function computeBackoffMs(attempt: number, cfg?: Partial<RateGovernorConfig>): number {
  const c = { ...DEFAULT_RATE_GOVERNOR_CONFIG, ...(cfg ?? {}) };
  const base = c.default_backoff_base_ms;
  const max = c.default_backoff_max_ms;
  // Exponential with jitter (deterministic-ish · seedable via callers)
  const raw = Math.min(max, base * Math.pow(2, Math.max(0, attempt - 1)));
  const jitter = raw * 0.25 * ((attempt * 2654435761) % 1000 / 1000); // deterministic jitter
  return Math.round(raw - jitter);
}

export function computeCooldownMs(failure_kind: string, consecutive_failures: number, cfg?: Partial<RateGovernorConfig>): number {
  const c = { ...DEFAULT_RATE_GOVERNOR_CONFIG, ...(cfg ?? {}) };
  const base = c.cooldown_ms_by_failure_kind[failure_kind] ?? c.cooldown_ms_by_failure_kind["other"];
  // Escalating: multiply by consecutive_failures capped at 5×
  return Math.min(base * 5, base * Math.max(1, consecutive_failures));
}

// ─── In-memory host state tracker (for governors that live for the duration of one cycle) ─
export class HostStateTracker {
  private readonly state: Map<string, { last_started_at_ms: number; in_flight: number }> = new Map();
  snapshot(host: string): HostState {
    return this.state.get(host) ?? { last_started_at_ms: 0, in_flight: 0 };
  }
  markStart(host: string, now_ms: number): void {
    const s = this.state.get(host) ?? { last_started_at_ms: 0, in_flight: 0 };
    this.state.set(host, { last_started_at_ms: now_ms, in_flight: s.in_flight + 1 });
  }
  markEnd(host: string): void {
    const s = this.state.get(host);
    if (!s) return;
    this.state.set(host, { last_started_at_ms: s.last_started_at_ms, in_flight: Math.max(0, s.in_flight - 1) });
  }
}

// ─── Doctrine locks ─────────────────────────────────────────────────
export const _GOVERNOR_NEVER_BYPASSES_LIMITS =
  "governor_returns_wait_or_skip_never_proceed_when_limit_reached";
export const _GOVERNOR_COOLDOWN_ESCALATES =
  "consecutive_failures_extend_cooldown_never_shorten_it";
