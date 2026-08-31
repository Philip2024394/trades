// Freshness engine · per-record refresh scheduling.
//
// Every record has a FreshnessPolicy that maps to a time budget.
// The supervisor uses `computeStaleness` to decide whether a record
// should be re-verified this cycle. `nextRefreshAt` is stamped when
// a record is verified so the queue knows when to bring it back.

import type { FreshnessPolicy, FreshnessState } from "./types";

/** Refresh windows per policy (ms). Live/very_fast are for the
 *  supervisor to keep tight; long_lived can drift for months. */
export const FRESHNESS_WINDOW_MS: Record<FreshnessPolicy, number> = {
  live:          60_000,               // 1 minute
  very_fast:     10 * 60_000,          // 10 minutes
  hourly:        60 * 60_000,          // 1 hour
  daily:         24 * 60 * 60_000,     // 1 day
  weekly:        7 * 24 * 60 * 60_000, // 1 week
  monthly:       30 * 24 * 60 * 60_000, // 30 days
  seasonal:      90 * 24 * 60 * 60_000, // 90 days
  long_lived:    180 * 24 * 60 * 60_000, // 6 months
};

/** Compute the staleness of a record in the range 0..1.
 *  0 = just verified, 1 = at or past the refresh window. */
export function computeStaleness(state: FreshnessState, now: Date = new Date()): number {
  if (!state.lastVerifiedAt) return 1; // never verified · maximally stale
  const window = FRESHNESS_WINDOW_MS[state.policy];
  const elapsed = now.getTime() - new Date(state.lastVerifiedAt).getTime();
  if (elapsed <= 0) return 0;
  return Math.min(1, elapsed / window);
}

/** Stamp verification · returns a fresh FreshnessState with
 *  lastVerifiedAt=now and nextRefreshAt=now+window. */
export function stampVerified(policy: FreshnessPolicy, now: Date = new Date()): FreshnessState {
  const nowIso = now.toISOString();
  const nextRefreshMs = now.getTime() + FRESHNESS_WINDOW_MS[policy];
  return {
    policy,
    lastVerifiedAt: nowIso,
    nextRefreshAt: new Date(nextRefreshMs).toISOString(),
    staleness: 0,
  };
}

/** Should we refresh this record right now? */
export function needsRefresh(state: FreshnessState, now: Date = new Date()): boolean {
  if (!state.nextRefreshAt) return true;
  return new Date(state.nextRefreshAt) <= now;
}
