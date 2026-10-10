// src/lib/nex-agent/code-engine/capability-fast-path-router.ts
//
// NEX1 · Fast-Path / Deep-Path Router (§25 · §46-47)
// Ledger B additive · Zero LLM · Deterministic.
//
// PURPOSE
//   Classify a change plan into fast vs deep path so simple safe changes
//   do not waste latency on the full Twin/Referee cycle.
//
// FOUNDER PRINCIPLE (§41 verbatim)
//   "Speed optimises the path to evidence. It does not replace evidence."

import type { ChangePlan } from "./capability-change-plan";
import type { ChangeHypothesis } from "./capability-change-hypothesis-engine";

export const FAST_PATH_ROUTER_VERSION = "fast-path-router.v1.2026-09-19";

export type ExecutionPath =
  | "FAST_PATH"       // trivial change · direct target-test verification
  | "DEEP_PATH"       // multi-file / risky / semantic-verification required
  | "FORCED_DEEP";    // policy override (e.g. touches sensitive path)

export interface FastPathDecision {
  readonly path: ExecutionPath;
  readonly rationale: string;
  readonly evidence_signals: readonly string[];
  readonly required_checks: readonly string[];
  readonly skipped_checks: readonly string[];
  readonly caller_must_decide: true;
  readonly zero_llm: true;
  readonly ledger: "B";
  readonly version: string;
}

export interface FastPathInput {
  readonly plan: ChangePlan;
  readonly hypothesis: ChangeHypothesis;
  readonly repo_health: "clean" | "recent_failures" | "unknown";
  readonly sensitive_paths?: readonly string[];  // e.g. pricing.ts, DECISIONS/, capability-fear.ts
}

export function classifyPath(input: FastPathInput): FastPathDecision {
  const signals: string[] = [`complexity=${input.plan.complexity}`, `verb=${input.hypothesis.change_verb}`];
  const required: string[] = [];
  const skipped: string[] = [];

  // Sensitive path check (§FORCED_DEEP)
  const sensitiveHit = (input.sensitive_paths ?? []).some((sp) =>
    input.plan.affected_files.some((f) => f.startsWith(sp))
  );
  if (sensitiveHit) {
    required.push("static_check", "target_test", "regression_test", "semantic_verification", "referee");
    signals.push("sensitive_path_touched");
    return {
      path: "FORCED_DEEP",
      rationale: "affected files include sensitive path · forcing deep verification per policy",
      evidence_signals: signals,
      required_checks: required,
      skipped_checks: [],
      caller_must_decide: true,
      zero_llm: true,
      ledger: "B",
      version: FAST_PATH_ROUTER_VERSION,
    };
  }

  // Deep-path triggers
  const deepTriggers: string[] = [];
  if (input.plan.complexity === "complex" || input.plan.complexity === "moderate") {
    deepTriggers.push(`complexity=${input.plan.complexity}`);
  }
  if (input.plan.affected_files.length > 1) {
    deepTriggers.push("multi_file");
  }
  if (input.hypothesis.change_verb === "refactor") {
    deepTriggers.push("refactor_requires_semantic");
  }
  if (input.hypothesis.change_verb === "remove" || input.hypothesis.change_verb === "move") {
    deepTriggers.push("destructive_verb");
  }
  // Risk flag only pushes to deep when combined with multi-file OR non-trivial complexity.
  // A trivial single-file change carries generic "may break dependent tests" as a natural
  // property of any change · that alone shouldn't force deep path per §25.
  const hasRiskFlag = input.hypothesis.risks.some((r) => r.includes("break") || r.includes("regression"));
  if (hasRiskFlag && (input.plan.complexity !== "trivial" || input.plan.affected_files.length > 1)) {
    deepTriggers.push("risk_flag_with_scale");
  }
  if (input.repo_health === "recent_failures") {
    deepTriggers.push("recent_failures_in_repo");
  }

  if (deepTriggers.length > 0) {
    required.push("static_check", "target_test", "regression_test");
    if (deepTriggers.includes("refactor_requires_semantic")) required.push("semantic_verification");
    if (deepTriggers.includes("multi_file") || deepTriggers.includes("destructive_verb")) required.push("referee");
    signals.push(...deepTriggers);
    return {
      path: "DEEP_PATH",
      rationale: `deep_triggers: ${deepTriggers.join(", ")}`,
      evidence_signals: signals,
      required_checks: required,
      skipped_checks: [],
      caller_must_decide: true,
      zero_llm: true,
      ledger: "B",
      version: FAST_PATH_ROUTER_VERSION,
    };
  }

  // Fast path: trivial, single-file, non-refactor, no risk flags, repo healthy
  required.push("static_check", "target_test");
  skipped.push("full_regression_test", "referee", "semantic_verification");
  signals.push("fast_path_criteria_met");
  return {
    path: "FAST_PATH",
    rationale: "trivial single-file · non-refactor · no risk flags · repo healthy",
    evidence_signals: signals,
    required_checks: required,
    skipped_checks: skipped,
    caller_must_decide: true,
    zero_llm: true,
    ledger: "B",
    version: FAST_PATH_ROUTER_VERSION,
  };
}
