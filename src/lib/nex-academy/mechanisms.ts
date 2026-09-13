// WO-ACADEMY-01 · The Ten Mechanisms (founder-specified) as pure functions.
//
// M1 · performance floor
// M2 · improvement requirement
// M3 · discovery quota
// M4 · challenge mode
// M5 · adversarial examination
// M6 · benchmark competition
// M7 · knowledge contribution score
// M8 · regression penalty
// M9 · three-strike career system (delegated to notices.ts)
// M10 · promotion is difficult (delegated to career-state.ts)
//
// Each mechanism is DETERMINISTIC. Same inputs → same output. No I/O in
// this module.

import { PERFORMANCE_FLOORS } from "./career-state";
import type { CareerState } from "./types";

// ── M1 · Performance floor ─────────────────────────────────────────────

export function meetsPerformanceFloor(state: CareerState, success_rate: number): boolean {
  return success_rate >= PERFORMANCE_FLOORS[state];
}

// ── M2 · Improvement requirement ────────────────────────────────────────

export interface ImprovementInput {
  readonly current_best_score: number;
  readonly baseline_score: number;
  readonly attempts_used: number;
  readonly max_attempts: number;
}

export function meetsImprovementRequirement(input: ImprovementInput): {
  readonly improved: boolean;
  readonly delta: number;
  readonly attempts_remaining: number;
} {
  const delta = input.current_best_score - input.baseline_score;
  return {
    improved: delta > 0,
    delta,
    attempts_remaining: Math.max(0, input.max_attempts - input.attempts_used),
  };
}

// ── M3 · Discovery quota ────────────────────────────────────────────────

/** Discovery-lane agents: ≥ 1 evidence-backed discovery per 20 qualifying tasks. Zero is acceptable if no genuine discovery exists — fabrication is failure. */
export interface DiscoveryQuotaInput {
  readonly qualifying_task_count: number;
  readonly accepted_discovery_count: number;
  readonly rejected_discovery_count: number;   // proposals rejected as unsupported
  readonly agent_lane: "orchestrator" | "intelligence";
}

export function assessDiscoveryQuota(input: DiscoveryQuotaInput): {
  readonly applies: boolean;
  readonly expected_discoveries: number;
  readonly quota_met: boolean;
  readonly fabrication_penalty: boolean;
} {
  if (input.agent_lane !== "intelligence") {
    return { applies: false, expected_discoveries: 0, quota_met: true, fabrication_penalty: false };
  }
  const expected = Math.floor(input.qualifying_task_count / 20);
  const quotaMet = input.accepted_discovery_count >= expected;
  // Fabrication penalty: rejected discoveries outnumber accepted by a wide margin
  const fabrication = input.rejected_discovery_count > 0
    && input.rejected_discovery_count >= Math.max(2, input.accepted_discovery_count * 2 + 1);
  return { applies: true, expected_discoveries: expected, quota_met: quotaMet, fabrication_penalty: fabrication };
}

// ── M4 · Challenge mode ────────────────────────────────────────────────

export interface ChallengeOutcome {
  readonly attempt_number: number;
  readonly best_score: number;
  readonly target_score: number;
  readonly succeeded: boolean;
  readonly evidence_pointer: string;
}

export function assessChallenge(input: {
  readonly attempts: readonly ChallengeOutcome[];
  readonly max_attempts: number;
}): {
  readonly graduated: boolean;
  readonly failed: boolean;
  readonly best_score: number;
} {
  const best = input.attempts.reduce((max, a) => Math.max(max, a.best_score), 0);
  const graduated = input.attempts.some((a) => a.succeeded);
  const failed = !graduated && input.attempts.length >= input.max_attempts;
  return { graduated, failed, best_score: best };
}

// ── M5 · Adversarial examination ───────────────────────────────────────

export interface AdversarialSuiteResult {
  readonly suite_id: string;
  readonly target_state: CareerState;
  readonly tests_run: number;
  readonly tests_passed: number;
  readonly required_pass_ratio: number;
  readonly ran_at: string;
}

export function adversarialSuitePassed(r: AdversarialSuiteResult): boolean {
  if (r.tests_run === 0) return false;
  return (r.tests_passed / r.tests_run) >= r.required_pass_ratio;
}

// ── M6 · Benchmark competition ─────────────────────────────────────────

export interface BenchmarkEntry {
  readonly agent_id: string;
  readonly score: number;
  readonly evidence_pointer: string;
}

export function scoreBenchmarkRun(entries: readonly BenchmarkEntry[]): {
  readonly ranked: readonly BenchmarkEntry[];
  readonly winner: string | null;
  readonly reason_recorded: string;
} {
  const sorted = [...entries].sort((a, b) => b.score - a.score);
  const winner = sorted.length > 0 ? sorted[0].agent_id : null;
  const reason = winner
    ? `winner=${winner} score=${sorted[0].score.toFixed(3)} (system records WHY, does not blindly copy)`
    : "no entries";
  return { ranked: sorted, winner, reason_recorded: reason };
}

// ── M7 · Knowledge contribution score ──────────────────────────────────

export interface ContributionInput {
  readonly accepted_discoveries: number;
  readonly reproduced_by_others: number;
  readonly regression_bugs_discovered: number;
  readonly superseded_edges_created: number;
  readonly unsupported_proposals_rejected: number;
  readonly self_reported_improvements_without_evidence: number;
}

export function computeKnowledgeContributionScore(input: ContributionInput): number {
  const positive =
    input.accepted_discoveries * 1.0 +
    input.reproduced_by_others * 1.5 +
    input.regression_bugs_discovered * 1.0 +
    input.superseded_edges_created * 0.5;
  const negative =
    input.unsupported_proposals_rejected * 0.5 +
    input.self_reported_improvements_without_evidence * 1.0;
  const raw = positive - negative;
  // Negative raw (penalties exceed positives) is bounded to 0 — an agent
  // that manufactures more noise than value contributes zero. Positive raw
  // is normalised via a squashing function that keeps score in [0, 1]
  // regardless of activity volume (§5 — never reward activity for its
  // own sake).
  if (raw <= 0) return 0;
  return Math.max(0, Math.min(1, raw / (raw + 5)));
}

// ── M8 · Regression penalty ────────────────────────────────────────────

export interface RegressionInput {
  readonly total_changes: number;
  readonly regressions_introduced: number;
}

export function computeRegressionScore(input: RegressionInput): number {
  if (input.total_changes <= 0) return 1;
  const ratio = input.regressions_introduced / input.total_changes;
  return Math.max(0, Math.min(1, 1 - ratio));
}

/** M8 triggers Notice 1 immediately if any regressions_introduced > 0. */
export function regressionTriggersNotice(input: RegressionInput): boolean {
  return input.regressions_introduced > 0;
}
