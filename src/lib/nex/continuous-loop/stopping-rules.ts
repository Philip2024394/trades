// src/lib/nex/continuous-loop/stopping-rules.ts
//
// UWI · Wave 7 · M28 · Typed stopping rules
// Founder-authorised programme.
//
// 4 typed stopping rules (CRII synthesis §21) evaluated in
// deterministic priority order:
//   1. cost_cap                     · budget exhausted → HARD STOP
//   2. unresolvable_contradiction   · sources disagree beyond tolerance → escalate to human
//   3. enough_evidence              · ≥N sources agree · confidence ≥ threshold · novelty < ε → stop research (result achieved)
//   4. decay                        · no supporting evidence in T time → PARK
//   default: still_running          · continue
//
// Composes with Wave 5 `cadence-scheduler.ts` (which handles the
// scheduled cadence signals like cool_down / next_review_at) — this
// module handles the CONTENT-based stopping rules (what the research
// itself has produced), not the schedule.
//
// Deterministic · pure · no external deps.

import type {
  StoppingDecision,
  StoppingRuleConfig,
  StoppingRuleInputs,
} from "./types";
import { DEFAULT_STOPPING_RULE_CONFIG } from "./types";

export function evaluateStoppingRules(
  inputs: StoppingRuleInputs,
  config: StoppingRuleConfig = DEFAULT_STOPPING_RULE_CONFIG,
): StoppingDecision {
  // Priority 1 · cost cap · HARD STOP regardless of research state
  if (inputs.cost_cap_units != null && inputs.cost_spent_units >= inputs.cost_cap_units) {
    return {
      rule: "cost_cap",
      reason: `cost_spent ${inputs.cost_spent_units} ≥ cap ${inputs.cost_cap_units} units`,
      should_stop: true,
      should_escalate_to_human: false,
      recommended_next_action: "cost_cap_review",
    };
  }

  // Priority 2 · unresolvable contradiction · escalate to human
  // Trigger: ≥N high-reliability sources disagree AND all sources are fresh
  if (
    inputs.high_reliability_sources_disagreeing >= config.contradiction_high_reliability_threshold
    && inputs.all_sources_fresh
    && inputs.contradicting_signal_count > 0
  ) {
    return {
      rule: "unresolvable_contradiction",
      reason: `${inputs.high_reliability_sources_disagreeing} high-reliability sources disagreeing · all fresh · ${inputs.contradicting_signal_count} contradicting signals`,
      should_stop: true,
      should_escalate_to_human: true,
      recommended_next_action: "escalate",
    };
  }

  // Priority 3 · enough evidence · stop research (result achieved)
  if (
    inputs.independent_source_count >= config.enough_evidence_min_independent_sources
    && inputs.confidence >= config.enough_evidence_min_confidence
    && inputs.novelty_of_last_source <= config.enough_evidence_max_novelty
  ) {
    return {
      rule: "enough_evidence",
      reason: `${inputs.independent_source_count} independent sources · confidence ${inputs.confidence.toFixed(2)} · novelty ${inputs.novelty_of_last_source.toFixed(2)}`,
      should_stop: true,
      should_escalate_to_human: false,
      recommended_next_action: "continue", // downstream (opportunity/idea) picks up
    };
  }

  // Priority 4 · decay · no supporting evidence in T time → PARK
  if (
    inputs.decay_window_ms != null
    && inputs.time_since_last_supporting_ms >= inputs.decay_window_ms
  ) {
    return {
      rule: "decay",
      reason: `no supporting evidence in ${inputs.time_since_last_supporting_ms}ms (window ${inputs.decay_window_ms}ms)`,
      should_stop: true,
      should_escalate_to_human: false,
      recommended_next_action: "park",
    };
  }

  // No stopping rule fired
  return {
    rule: "still_running",
    reason: "no stopping rule fired · continue research",
    should_stop: false,
    should_escalate_to_human: false,
    recommended_next_action: "continue",
  };
}
