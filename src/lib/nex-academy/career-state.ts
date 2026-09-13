// WO-ACADEMY-01 · CareerState machine + deterministic transitions.
//
// Pure functions only — same inputs, same output, always.
// P-U discipline: no career state carries execution authority. This module
// deals in qualification, not authorisation.

import { CAREER_RANK, type CareerState } from "./types";

// ── Founder-locked thresholds (spec §5, mechanisms M1 + M10) ──────────

/**
 * Performance floors — the minimum success_rate an agent must sustain to
 * maintain a given career state.
 */
export const PERFORMANCE_FLOORS: Readonly<Record<CareerState, number>> = Object.freeze({
  DECOMMISSIONED: 0.0,
  RESTRICTED:     0.0,
  TRAINEE:        0.0,
  TESTED:         0.4,
  CERTIFIED:      0.6,
  SPECIALIST:     0.8,
  ELITE_SPECIALIST: 0.9,
  MASTER:         0.95,
});

/** Minimum knowledge-contribution score by target state. */
export const KNOWLEDGE_CONTRIBUTION_MINS: Readonly<Record<CareerState, number>> = Object.freeze({
  DECOMMISSIONED: 0.0,
  RESTRICTED:     0.0,
  TRAINEE:        0.0,
  TESTED:         0.0,
  CERTIFIED:      0.1,
  SPECIALIST:     0.3,
  ELITE_SPECIALIST: 0.5,
  MASTER:         0.7,
});

/** Minimum regression score (1 = zero regressions). MASTER demands ≥ 0.9. */
export const REGRESSION_MINS: Readonly<Record<CareerState, number>> = Object.freeze({
  DECOMMISSIONED: 0.0,
  RESTRICTED:     0.0,
  TRAINEE:        0.0,
  TESTED:         0.6,
  CERTIFIED:      0.7,
  SPECIALIST:     0.8,
  ELITE_SPECIALIST: 0.85,
  MASTER:         0.9,
});

// ── Transition decision (pure function) ────────────────────────────────

export interface CareerScores {
  readonly task_completion_score: number;   // 0..1 (== success_rate proxy)
  readonly knowledge_contribution_score: number;
  readonly regression_score: number;
  readonly unresolved_notices: number;      // count of open notices
  readonly adversarial_suite_passed_for_target: boolean;
}

export type CareerTransitionOutcome =
  | { readonly kind: "PROMOTE"; readonly to: CareerState; readonly reason: string }
  | { readonly kind: "HOLD"; readonly at: CareerState; readonly reason: string }
  | { readonly kind: "DEMOTE"; readonly to: CareerState; readonly reason: string }
  ;

/**
 * Decide the career transition given current state + scores + adversarial
 * suite outcome. Pure — no side effects, no storage reads.
 *
 * Discipline (spec §10.M10 · "Promotion should be difficult"):
 *   PROMOTE only when ALL:
 *     · task_completion_score ≥ PERFORMANCE_FLOORS[target]
 *     · knowledge_contribution_score ≥ KNOWLEDGE_CONTRIBUTION_MINS[target]
 *     · regression_score ≥ REGRESSION_MINS[target]
 *     · unresolved_notices == 0
 *     · adversarial_suite_passed_for_target == true
 *
 * DEMOTE when current state's floor is not met.
 *
 * RESTRICTED and DECOMMISSIONED are exit-only states handled by the
 * Notice machinery — this function never enters them.
 */
export function decideCareerTransition(input: {
  readonly current: CareerState;
  readonly scores: CareerScores;
}): CareerTransitionOutcome {
  const { current, scores } = input;

  // No promotion / demotion happens FROM RESTRICTED or DECOMMISSIONED.
  if (current === "DECOMMISSIONED") {
    return { kind: "HOLD", at: current, reason: "agent decommissioned — no transitions from this state" };
  }
  if (current === "RESTRICTED") {
    return { kind: "HOLD", at: current, reason: "agent RESTRICTED — retraining outcome required before transitions resume" };
  }

  // Demote if current state's floor is not met.
  if (!meetsFloor(current, scores)) {
    const demotedTo = demoteFrom(current);
    if (demotedTo !== current) {
      return {
        kind: "DEMOTE",
        to: demotedTo,
        reason: `${current} floor not met (task=${scores.task_completion_score.toFixed(2)} / know=${scores.knowledge_contribution_score.toFixed(2)} / reg=${scores.regression_score.toFixed(2)})`,
      };
    }
  }

  // Try to promote to the highest state whose floor is fully met + suite passed + no open notices.
  const targets: CareerState[] = ["MASTER", "ELITE_SPECIALIST", "SPECIALIST", "CERTIFIED", "TESTED"];
  for (const target of targets) {
    if (CAREER_RANK[target] <= CAREER_RANK[current]) continue;
    if (meetsFloor(target, scores) && scores.unresolved_notices === 0 && scores.adversarial_suite_passed_for_target) {
      return {
        kind: "PROMOTE",
        to: target,
        reason: `all thresholds met for ${target} · adversarial suite passed · no open notices`,
      };
    }
  }
  return { kind: "HOLD", at: current, reason: `no higher state fully qualified from ${current}` };
}

function meetsFloor(target: CareerState, s: CareerScores): boolean {
  return (
    s.task_completion_score >= PERFORMANCE_FLOORS[target] &&
    s.knowledge_contribution_score >= KNOWLEDGE_CONTRIBUTION_MINS[target] &&
    s.regression_score >= REGRESSION_MINS[target]
  );
}

function demoteFrom(current: CareerState): CareerState {
  switch (current) {
    case "MASTER":            return "ELITE_SPECIALIST";
    case "ELITE_SPECIALIST":  return "SPECIALIST";
    case "SPECIALIST":        return "CERTIFIED";
    case "CERTIFIED":         return "TESTED";
    case "TESTED":            return "TRAINEE";
    default:                  return current;
  }
}
