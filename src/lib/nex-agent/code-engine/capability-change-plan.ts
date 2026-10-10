// src/lib/nex-agent/code-engine/capability-change-plan.ts
//
// NEX1 · Multi-File Change Plan (§11 · §36)
// Ledger B additive · Zero LLM · Deterministic.
//
// PURPOSE
//   Take a ChangeHypothesis (or several) and expand into an ordered ChangePlan
//   with per-step operator calls, dependencies, expected effects, and a
//   validation plan. This is the machine-readable change graph.

import { createHash } from "node:crypto";
import type { ChangeHypothesis, OperatorSuggestion } from "./capability-change-hypothesis-engine";

export const CHANGE_PLAN_VERSION = "change-plan.v1.2026-09-19";

// ── Plan step ────────────────────────────────────────────────────────────

export interface ChangePlanStep {
  readonly step_id: string;
  readonly step_index: number;
  readonly file_path: string;
  readonly symbol: string | null;
  readonly operator: OperatorSuggestion;
  readonly operator_input_summary: string;
  readonly expected_effect: string;
  readonly depends_on_step_ids: readonly string[];
  readonly rollback_hint: string;
}

// ── Validation plan ─────────────────────────────────────────────────────

export interface ValidationCheck {
  readonly check_id: string;
  readonly check_kind: "static" | "target_test" | "regression_test" | "runtime_probe" | "semantic";
  readonly required: boolean;
  readonly rationale: string;
}

// ── Full plan ────────────────────────────────────────────────────────────

export interface ChangePlan {
  readonly plan_id: string;
  readonly specification_id: string;
  readonly source_hypothesis_id: string;

  readonly ordered_steps: readonly ChangePlanStep[];
  readonly affected_files: readonly string[];
  readonly affected_symbols: readonly string[];

  readonly dependencies: readonly string[];  // external dependencies (packages, config)
  readonly expected_effects: readonly string[];
  readonly validation_plan: readonly ValidationCheck[];

  readonly complexity: "trivial" | "simple" | "moderate" | "complex";
  readonly estimated_steps: number;
  readonly rollback_strategy: string;

  readonly caller_must_decide: true;
  readonly input_digest: string;
  readonly zero_llm: true;
  readonly ledger: "B";
  readonly version: string;
}

// ── Public entry ─────────────────────────────────────────────────────────

export interface BuildChangePlanInput {
  readonly hypothesis: ChangeHypothesis;
  /** For multi-file plans · additional hypothesis targets from repo model. */
  readonly additional_targets?: readonly {
    readonly file_path: string;
    readonly symbol: string | null;
    readonly operator: OperatorSuggestion;
    readonly rationale: string;
    readonly depends_on_primary: boolean;
  }[];
}

export function buildChangePlan(input: BuildChangePlanInput): ChangePlan {
  const primary = input.hypothesis;
  const additional = input.additional_targets ?? [];
  const now = Date.now();

  const steps: ChangePlanStep[] = [];
  // Primary hypothesis steps
  for (let i = 0; i < primary.proposed_changes.length; i++) {
    const pc = primary.proposed_changes[i];
    steps.push({
      step_id: `step_${now}_p${i}`,
      step_index: i,
      file_path: pc.file_path,
      symbol: pc.symbol,
      operator: pc.operator,
      operator_input_summary: pc.rationale,
      expected_effect: primary.intended_behaviour,
      depends_on_step_ids: [],
      rollback_hint: rollbackHintForOperator(pc.operator),
    });
  }
  // Additional targets (may depend on primary)
  for (let i = 0; i < additional.length; i++) {
    const t = additional[i];
    const primaryIds = t.depends_on_primary ? steps.map((s) => s.step_id) : [];
    steps.push({
      step_id: `step_${now}_a${i}`,
      step_index: steps.length,
      file_path: t.file_path,
      symbol: t.symbol,
      operator: t.operator,
      operator_input_summary: t.rationale,
      expected_effect: primary.intended_behaviour,
      depends_on_step_ids: primaryIds,
      rollback_hint: rollbackHintForOperator(t.operator),
    });
  }

  const affected_files = [...new Set(steps.map((s) => s.file_path))].sort();
  const affected_symbols = [...new Set(steps.map((s) => s.symbol).filter((s): s is string => s !== null))].sort();

  // Validation plan · always includes static + target · adds more for complex plans
  const validation_plan: ValidationCheck[] = [
    { check_id: "v_static", check_kind: "static", required: true, rationale: "syntax / brace balance / imports resolve" },
    { check_id: "v_target", check_kind: "target_test", required: true, rationale: "behaviour requested by spec observed" },
  ];
  if (affected_files.length > 1) {
    validation_plan.push({ check_id: "v_regression", check_kind: "regression_test", required: true, rationale: "multi-file change · run related regression tests" });
  }
  if (primary.change_verb === "style" || primary.change_verb === "layout" || primary.change_verb === "behaviour") {
    validation_plan.push({ check_id: "v_runtime", check_kind: "runtime_probe", required: false, rationale: "visual/behaviour change · runtime probe recommended" });
  }
  if (primary.change_verb === "refactor") {
    validation_plan.push({ check_id: "v_semantic", check_kind: "semantic", required: true, rationale: "refactor · behaviour must be preserved · semantic verification required" });
  }

  const complexity = classifyComplexity(steps.length, affected_files.length);
  const input_digest = createHash("sha256")
    .update(JSON.stringify({
      hyp: primary.hypothesis_id,
      steps: steps.length,
      files: affected_files,
    }))
    .digest("hex")
    .slice(0, 16);

  return {
    plan_id: `plan_${now}_${input_digest.slice(0, 6)}`,
    specification_id: primary.specification_id,
    source_hypothesis_id: primary.hypothesis_id,
    ordered_steps: steps,
    affected_files,
    affected_symbols,
    dependencies: [],
    expected_effects: [primary.intended_behaviour],
    validation_plan,
    complexity,
    estimated_steps: steps.length,
    rollback_strategy: complexity === "trivial" ? "git_checkout_files" : "git_checkout_branch_or_stash",
    caller_must_decide: true,
    input_digest,
    zero_llm: true,
    ledger: "B",
    version: CHANGE_PLAN_VERSION,
  };
}

function classifyComplexity(stepCount: number, fileCount: number): ChangePlan["complexity"] {
  if (stepCount <= 1 && fileCount <= 1) return "trivial";
  if (stepCount <= 3 && fileCount <= 2) return "simple";
  if (stepCount <= 8 && fileCount <= 5) return "moderate";
  return "complex";
}

function rollbackHintForOperator(op: OperatorSuggestion): string {
  switch (op) {
    case "create_file": return "delete_created_file";
    case "modify_return": return "git_checkout_file";
    case "add_export": return "revert_added_export_line";
    case "update_import": return "git_checkout_file";
    case "replace_expression": return "revert_replacement";
    case "add_object_property": return "remove_added_property";
    case "modify_component_prop_default": return "restore_previous_default";
  }
}
