// scripts/nex-discovery-rotation/_reactivation-policy.mjs
//
// NEX Reactivation Policy · pure functions · Philip 2026-08-26.
//
// Doctrine anchor: project_nex_walker_production_launch_directive_2026_08_26
//   "saturation is now a cooldown, not a death sentence" (Philip 2026-08-26).
//
// Cooldown durations (approved 2026-08-26):
//   food          → 6 hours
//   accommodation → 6 hours
//   transport     → 6 hours
//   market        → 12 hours
//   after 3 consecutive unproductive reactivations → 2× backoff
//   provider/query refresh                        → immediate (cooldown_until = NOW)
//
// This file is shared vocabulary between:
//   · scripts/nex-discovery-rotation/_rotation-tick.mjs  (runtime, sets cooldown)
//   · src/lib/nex-hq/reactivation-policy.ts              (TS mirror for HQ + tests)
//   · scripts/nex-discovery-rotation/p3-reactivation-test.mjs (evidence)
//
// PURE FUNCTIONS ONLY · no DB · no side effects · deterministic.

export const COOLDOWN_HOURS_BY_CATEGORY = Object.freeze({
  food:          6,
  accommodation: 6,
  transport:     6,
  market:       12,
});

export const DEFAULT_COOLDOWN_HOURS         = 6;
export const UNPRODUCTIVE_BACKOFF_THRESHOLD = 3;   // consecutive unproductive reactivations
export const UNPRODUCTIVE_BACKOFF_MULTIPLIER = 2;  // 2× cooldown after threshold

/**
 * Cooldown hours for a category · with 2× backoff after N unproductive reactivations.
 * @param {string} category
 * @param {number} consecutiveUnproductiveReactivations
 * @returns {number} hours
 */
export function cooldownHoursFor(category, consecutiveUnproductiveReactivations = 0) {
  const base = COOLDOWN_HOURS_BY_CATEGORY[category] ?? DEFAULT_COOLDOWN_HOURS;
  const multiplier = consecutiveUnproductiveReactivations >= UNPRODUCTIVE_BACKOFF_THRESHOLD
    ? UNPRODUCTIVE_BACKOFF_MULTIPLIER
    : 1;
  return base * multiplier;
}

/**
 * Compute cooldown_until timestamp · NOW + cooldownHoursFor().
 * @param {string} category
 * @param {number} consecutiveUnproductiveReactivations
 * @param {Date} now  (injectable for tests; defaults to actual now)
 * @returns {Date}
 */
export function computeCooldownUntil(category, consecutiveUnproductiveReactivations = 0, now = new Date()) {
  const hours = cooldownHoursFor(category, consecutiveUnproductiveReactivations);
  return new Date(now.getTime() + hours * 3600 * 1000);
}

/**
 * Given a rotation state + latest cycle, decide the reactivation counters.
 * Called by rotation-tick BEFORE the state-transition decision.
 *
 * Rules:
 *   · If the surface was reactivated (reactivation_reason set) AND a cycle has
 *     completed since state_entered_at:
 *       - productive cycle (records_new > 0) → reset consecutive_unproductive = 0
 *       - unproductive cycle (records_new === 0) → increment consecutive_unproductive
 *     The reactivation_reason is then "consumed" (returned as null by caller).
 *
 *   · Otherwise: unchanged.
 *
 * @param {object} params
 * @param {string|null} params.reactivationReason  current reason (non-null = post-reactivation)
 * @param {number} params.consecutiveUnproductive  current counter
 * @param {number|null} params.lastCycleRecordsNew records_new of latest cycle since reactivation
 * @param {boolean} params.hasCycleSinceReactivation  did any cycle happen after state_entered_at?
 * @returns {{ newConsecutive: number, consumeReason: boolean }}
 */
export function assessReactivationOutcome({
  reactivationReason,
  consecutiveUnproductive,
  lastCycleRecordsNew,
  hasCycleSinceReactivation,
}) {
  if (!reactivationReason || !hasCycleSinceReactivation) {
    return { newConsecutive: consecutiveUnproductive, consumeReason: false };
  }
  if ((lastCycleRecordsNew ?? 0) > 0) {
    return { newConsecutive: 0, consumeReason: true };
  }
  return { newConsecutive: consecutiveUnproductive + 1, consumeReason: true };
}
