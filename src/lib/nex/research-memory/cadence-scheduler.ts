// src/lib/nex/research-memory/cadence-scheduler.ts
//
// UWI · Wave 5 · M24 · Cadence primitives
// Founder-authorised programme.
//
// Deterministic scheduling for opportunity/idea review cycles.
// Not "always research everything" — respects:
//   - last_reviewed_at (when we last touched it)
//   - next_review_at (deterministic schedule for next touch)
//   - decay_window (how long since last-supporting-evidence before decay)
//   - cost_cap (research budget per cycle)
//   - cool_down (grace period after failure before re-attempting)
//
// Deterministic · pure · no external deps.

export interface CadenceState {
  readonly last_reviewed_at_iso: string;
  readonly next_review_at_iso: string | null;
  readonly decay_window_ms: number | null;
  readonly cost_cap_units: number | null;
  readonly cool_down_until_iso: string | null;
  readonly last_supporting_evidence_at_iso: string | null;
  readonly cost_spent_units: number;
}

export interface CadenceDecision {
  readonly action: "review_due" | "in_cool_down" | "cost_cap_reached" | "decay_triggered" | "not_yet_due";
  readonly reason: string;
  readonly next_review_at_iso: string | null;
}

/** Determine whether a research/review cycle should fire for this state. Pure. */
export function evaluateCadence(state: CadenceState, now_iso: string = new Date().toISOString()): CadenceDecision {
  const now_ms = Date.parse(now_iso);

  // Cool-down takes precedence
  if (state.cool_down_until_iso) {
    const cool_until_ms = Date.parse(state.cool_down_until_iso);
    if (now_ms < cool_until_ms) {
      return { action: "in_cool_down", reason: `cool_down until ${state.cool_down_until_iso}`, next_review_at_iso: state.cool_down_until_iso };
    }
  }

  // Cost cap
  if (state.cost_cap_units != null && state.cost_spent_units >= state.cost_cap_units) {
    return { action: "cost_cap_reached", reason: `spent ${state.cost_spent_units}/${state.cost_cap_units} units`, next_review_at_iso: null };
  }

  // Decay window (no supporting evidence in T time → decay)
  if (state.decay_window_ms != null && state.last_supporting_evidence_at_iso) {
    const last_supp_ms = Date.parse(state.last_supporting_evidence_at_iso);
    if ((now_ms - last_supp_ms) >= state.decay_window_ms) {
      return {
        action: "decay_triggered",
        reason: `no supporting evidence since ${state.last_supporting_evidence_at_iso} (window ${state.decay_window_ms}ms)`,
        next_review_at_iso: null,
      };
    }
  }

  // Scheduled review due?
  if (state.next_review_at_iso) {
    const next_ms = Date.parse(state.next_review_at_iso);
    if (now_ms >= next_ms) {
      return { action: "review_due", reason: `scheduled review at ${state.next_review_at_iso}`, next_review_at_iso: state.next_review_at_iso };
    }
    return { action: "not_yet_due", reason: `next review at ${state.next_review_at_iso}`, next_review_at_iso: state.next_review_at_iso };
  }

  return { action: "not_yet_due", reason: "no next_review_at scheduled", next_review_at_iso: null };
}

/** Compute the next review timestamp given a fixed interval. Pure. */
export function scheduleNextReview(interval_ms: number, now_iso: string = new Date().toISOString()): string {
  const next = Date.parse(now_iso) + interval_ms;
  return new Date(next).toISOString();
}

/** Compute the next review timestamp with exponential decay (each cycle
 *  doubles the interval up to cap). Used for stable / mature opportunities
 *  that don't need frequent re-review. */
export function scheduleExponentialDecayReview(
  base_ms: number,
  cycle: number,
  cap_ms: number,
  now_iso: string = new Date().toISOString(),
): string {
  const interval = Math.min(cap_ms, base_ms * Math.pow(2, Math.max(0, cycle)));
  return scheduleNextReview(interval, now_iso);
}
