// src/lib/nex/signals/kleinberg-burst.ts
//
// UWI · Wave 4 · M15a · Kleinberg burst detection (Kleinberg 2002)
// Founder-authorised programme.
//
// Reference: Kleinberg, J. "Bursty and Hierarchical Structure in Streams",
// KDD 2002 · https://www.cs.cornell.edu/home/kleinber/bhs.pdf
//
// Two-state variant (baseline vs burst) with a dynamic-programming
// Viterbi-style solver. Given event timestamps, returns the optimal
// state sequence maximising:
//   Σ log f_{s_i}(gap_i) - Σ τ(s_{i-1}, s_i)
// where gaps are exponentially distributed with rate α_state and τ is
// the state-transition cost.
//
// Deterministic · pure · no external deps.

import type { BurstDetectionResult, BurstInterval } from "./types";

export interface KleinbergConfig {
  /** Ratio α₁/α₀ — burst rate multiplier over baseline. */
  readonly s: number;
  /** State-transition cost coefficient γ. */
  readonly gamma: number;
}

export const DEFAULT_KLEINBERG: KleinbergConfig = { s: 2, gamma: 1 };

/** Detect bursts in a sequence of event timestamps (ms).
 *  Timestamps must be sorted ascending. */
export function detectBursts(
  timestamps_ms: ReadonlyArray<number>,
  config: KleinbergConfig = DEFAULT_KLEINBERG,
): BurstDetectionResult {
  const n = timestamps_ms.length;
  if (n < 2) {
    return {
      method: "kleinberg-2state",
      bursts: [],
      baseline_rate: 0,
      burst_rate: 0,
    };
  }
  // Compute inter-arrival gaps
  const gaps: number[] = new Array(n - 1);
  for (let i = 1; i < n; i++) gaps[i - 1] = Math.max(1, timestamps_ms[i] - timestamps_ms[i - 1]);
  const total_time_ms = timestamps_ms[n - 1] - timestamps_ms[0];
  if (total_time_ms <= 0) {
    return { method: "kleinberg-2state", bursts: [], baseline_rate: 0, burst_rate: 0 };
  }

  const baseline_rate = (n - 1) / total_time_ms; // events per ms
  const burst_rate = baseline_rate * config.s;
  const alpha_0 = baseline_rate;
  const alpha_1 = burst_rate;

  // f_j(x) = α_j exp(-α_j x) · take -log for cost minimisation
  const costEmit = (state: 0 | 1, gap: number) => {
    const alpha = state === 0 ? alpha_0 : alpha_1;
    return -Math.log(alpha) + alpha * gap;
  };

  // Transition cost: 0→1 pays γ * log n; 1→0 free; same-state free.
  const trans_up_cost = config.gamma * Math.log(Math.max(2, n));

  // Viterbi DP over gaps
  const m = gaps.length;
  const dp: [number, number][] = new Array(m).fill(0).map(() => [0, 0]);
  const bp: [0 | 1, 0 | 1][] = new Array(m).fill(0).map(() => [0, 0]); // backpointers

  // Initialise (start in baseline state)
  dp[0][0] = costEmit(0, gaps[0]);
  dp[0][1] = costEmit(1, gaps[0]) + trans_up_cost;
  bp[0] = [0, 0];

  for (let i = 1; i < m; i++) {
    // Coming from state 0
    const from0_to0 = dp[i - 1][0] + costEmit(0, gaps[i]);
    const from0_to1 = dp[i - 1][0] + trans_up_cost + costEmit(1, gaps[i]);
    // Coming from state 1
    const from1_to0 = dp[i - 1][1] + costEmit(0, gaps[i]);
    const from1_to1 = dp[i - 1][1] + costEmit(1, gaps[i]);
    if (from0_to0 <= from1_to0) { dp[i][0] = from0_to0; bp[i][0] = 0; }
    else { dp[i][0] = from1_to0; bp[i][0] = 1; }
    if (from0_to1 <= from1_to1) { dp[i][1] = from0_to1; bp[i][1] = 0; }
    else { dp[i][1] = from1_to1; bp[i][1] = 1; }
  }

  // Traceback
  const states: (0 | 1)[] = new Array(m);
  states[m - 1] = dp[m - 1][0] <= dp[m - 1][1] ? 0 : 1;
  for (let i = m - 1; i > 0; i--) states[i - 1] = bp[i][states[i]];

  // Collect burst intervals (state 1)
  const bursts: BurstInterval[] = [];
  let interval_start_idx: number | null = null;
  for (let i = 0; i < states.length; i++) {
    if (states[i] === 1 && interval_start_idx === null) interval_start_idx = i;
    else if (states[i] === 0 && interval_start_idx !== null) {
      pushInterval(bursts, timestamps_ms, interval_start_idx, i);
      interval_start_idx = null;
    }
  }
  if (interval_start_idx !== null) pushInterval(bursts, timestamps_ms, interval_start_idx, states.length);

  return {
    method: "kleinberg-2state",
    bursts,
    baseline_rate,
    burst_rate,
  };
}

function pushInterval(out: BurstInterval[], ts: ReadonlyArray<number>, start_gap_idx: number, end_gap_idx: number): void {
  // gap i is between ts[i] and ts[i+1] · burst covers events ts[start_gap_idx..end_gap_idx]
  const start_ms = ts[start_gap_idx];
  const end_ms = ts[Math.min(ts.length - 1, end_gap_idx)];
  const count = end_gap_idx - start_gap_idx + 1;
  const duration_ms = Math.max(1, end_ms - start_ms);
  out.push({ state: 1, start_ms, end_ms, count, rate: count / duration_ms });
}
