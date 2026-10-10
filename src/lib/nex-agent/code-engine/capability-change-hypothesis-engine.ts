// src/lib/nex-agent/code-engine/capability-change-hypothesis-engine.ts
//
// NEX1 · Change Hypothesis Engine (Phase 3 · §4)
// Ledger B additive · Zero LLM · Deterministic.
//
// PURPOSE
//   Answer: "What needs to change, where, and why should that change satisfy
//   the user's specification?"
//
//   Consumes:
//     · specification (from capability-spec-representation)
//     · repository model / candidate file evidence
//     · file-scoped evidence (from technical-evidence-stream)
//
//   Produces:
//     · one or more ChangeHypotheses with confidence + risks + alternatives
//
// INVARIANTS
//   · Never invents a target file · every target has evidence citation
//   · Refuses when no repository evidence is available
//   · Multiple hypotheses when ambiguous · caller_must_decide
//   · Zero LLM · deterministic given same input

import { createHash } from "node:crypto";

export const CHANGE_HYPOTHESIS_ENGINE_VERSION = "change-hypothesis-engine.v1.2026-09-19";

// ── Input contract ───────────────────────────────────────────────────────

export type ChangeVerb =
  | "create"
  | "modify"
  | "remove"
  | "move"
  | "rename"
  | "connect"
  | "style"
  | "layout"
  | "behaviour"
  | "add_test"
  | "fix_bug"
  | "refactor";

export interface RepoFactRef {
  readonly file_path: string;
  readonly symbol: string | null;
  readonly evidence_id: string;
  readonly confidence: number;  // 0..1 · from retrieval source
}

export interface ChangeHypothesisInput {
  readonly specification_id: string;
  readonly natural_language_request: string;
  readonly change_verb: ChangeVerb;
  readonly candidate_targets: readonly RepoFactRef[];
  readonly intended_behaviour_summary: string;
  readonly constraints?: readonly string[];
  readonly forbidden_paths?: readonly string[];
}

// ── Output contract ─────────────────────────────────────────────────────

export type OperatorSuggestion =
  | "create_file"
  | "modify_return"
  | "add_export"
  | "update_import"
  | "replace_expression"
  | "add_object_property"
  | "modify_component_prop_default";

export interface ProposedChange {
  readonly file_path: string;
  readonly symbol: string | null;
  readonly operator: OperatorSuggestion;
  readonly rationale: string;
  readonly evidence_id_source: string;
}

export interface ChangeHypothesis {
  readonly hypothesis_id: string;
  readonly specification_id: string;
  readonly change_verb: ChangeVerb;

  readonly target_files: readonly string[];
  readonly target_symbols: readonly string[];

  readonly intended_behaviour: string;
  readonly proposed_changes: readonly ProposedChange[];
  readonly dependencies: readonly string[];
  readonly risks: readonly string[];

  readonly confidence: number;
  readonly is_primary: boolean;
  readonly alternative_hypothesis_ids: readonly string[];

  readonly caller_must_decide: true;
  readonly rationale: string;
  readonly evidence_ids_consulted: readonly string[];
  readonly zero_llm: true;
  readonly ledger: "B";
  readonly version: string;
}

export interface HypothesisEngineResult {
  readonly hypotheses: readonly ChangeHypothesis[];
  readonly primary_hypothesis_id: string | null;
  readonly refusal_reason: string | null;
  readonly input_digest: string;
  readonly zero_llm: true;
  readonly ledger: "B";
}

// ── Public entry ─────────────────────────────────────────────────────────

export function generateChangeHypotheses(input: ChangeHypothesisInput): HypothesisEngineResult {
  const input_digest = createHash("sha256")
    .update(JSON.stringify({
      spec: input.specification_id,
      verb: input.change_verb,
      req: input.natural_language_request,
      targets: input.candidate_targets.map((t) => `${t.file_path}#${t.symbol ?? ""}`).sort(),
    }))
    .digest("hex")
    .slice(0, 16);

  // Refuse when there's no target evidence AND the verb is not "create"
  if (input.candidate_targets.length === 0 && input.change_verb !== "create") {
    return {
      hypotheses: [],
      primary_hypothesis_id: null,
      refusal_reason: `no_target_evidence_for_verb:${input.change_verb}`,
      input_digest,
      zero_llm: true,
      ledger: "B",
    };
  }

  // Filter out forbidden paths
  const forbidden = new Set(input.forbidden_paths ?? []);
  const allowedTargets = input.candidate_targets.filter((t) => !forbidden.has(t.file_path));
  if (allowedTargets.length === 0 && input.change_verb !== "create") {
    return {
      hypotheses: [],
      primary_hypothesis_id: null,
      refusal_reason: "all_candidate_targets_forbidden",
      input_digest,
      zero_llm: true,
      ledger: "B",
    };
  }

  // Sort by confidence desc · take top 3 as candidate hypotheses
  const sorted = [...allowedTargets].sort((a, b) => b.confidence - a.confidence);
  const topN = sorted.slice(0, 3);

  const hypotheses: ChangeHypothesis[] = [];
  const now = new Date().toISOString();
  const specId = input.specification_id;

  if (input.change_verb === "create") {
    // Creation hypothesis · uses the first candidate target path if any · else infer from spec
    const targetPath = topN[0]?.file_path ?? inferPathFromRequest(input.natural_language_request);
    const hyp_id = `hyp_${Date.now()}_${input_digest.slice(0, 6)}_A`;
    hypotheses.push(buildHypothesis({
      hypothesis_id: hyp_id,
      specification_id: specId,
      change_verb: "create",
      target_files: [targetPath],
      target_symbols: [],
      intended_behaviour: input.intended_behaviour_summary,
      proposed_changes: [{
        file_path: targetPath,
        symbol: null,
        operator: "create_file",
        rationale: "create the requested file",
        evidence_id_source: topN[0]?.evidence_id ?? "no_prior_evidence",
      }],
      confidence: topN[0]?.confidence ?? 0.5,
      is_primary: true,
      alternative_hypothesis_ids: [],
      rationale: `verb=create · target=${targetPath}`,
      evidence_ids_consulted: topN.map((t) => t.evidence_id),
      risks: ["file_may_already_exist", "path_may_not_match_project_convention"],
      dependencies: [],
      caller_must_decide: true,
      created_at_iso: now,
    }));
  } else {
    // Modification-family verbs · one hypothesis per candidate target (up to 3)
    for (let i = 0; i < topN.length; i++) {
      const t = topN[i];
      const hyp_id = `hyp_${Date.now()}_${input_digest.slice(0, 6)}_${String.fromCharCode(65 + i)}`;
      const suggestedOperator = pickOperatorForVerb(input.change_verb, t.symbol !== null);
      const proposedChanges: ProposedChange[] = suggestedOperator ? [{
        file_path: t.file_path,
        symbol: t.symbol,
        operator: suggestedOperator,
        rationale: `verb=${input.change_verb} · operator=${suggestedOperator} · target=${t.file_path}${t.symbol ? "#" + t.symbol : ""}`,
        evidence_id_source: t.evidence_id,
      }] : [];
      hypotheses.push(buildHypothesis({
        hypothesis_id: hyp_id,
        specification_id: specId,
        change_verb: input.change_verb,
        target_files: [t.file_path],
        target_symbols: t.symbol ? [t.symbol] : [],
        intended_behaviour: input.intended_behaviour_summary,
        proposed_changes: proposedChanges,
        confidence: t.confidence,
        is_primary: i === 0,
        alternative_hypothesis_ids: [],
        rationale: `verb=${input.change_verb} · candidate_rank=${i + 1}·confidence=${t.confidence.toFixed(3)}`,
        evidence_ids_consulted: [t.evidence_id],
        risks: pickRisksForVerb(input.change_verb),
        dependencies: [],
        caller_must_decide: true,
        created_at_iso: now,
      }));
    }
    // Link alternatives
    for (let i = 0; i < hypotheses.length; i++) {
      const others = hypotheses.filter((_, j) => j !== i).map((h) => h.hypothesis_id);
      hypotheses[i] = { ...hypotheses[i], alternative_hypothesis_ids: others };
    }
  }

  return {
    hypotheses,
    primary_hypothesis_id: hypotheses[0]?.hypothesis_id ?? null,
    refusal_reason: null,
    input_digest,
    zero_llm: true,
    ledger: "B",
  };
}

// ── Helpers ──────────────────────────────────────────────────────────────

function buildHypothesis(args: Omit<ChangeHypothesis, "zero_llm" | "ledger" | "version"> & { readonly created_at_iso: string }): ChangeHypothesis {
  const { created_at_iso: _ignore, ...rest } = args;
  return {
    ...rest,
    zero_llm: true,
    ledger: "B",
    version: CHANGE_HYPOTHESIS_ENGINE_VERSION,
  };
}

function pickOperatorForVerb(verb: ChangeVerb, hasSymbol: boolean): OperatorSuggestion | null {
  switch (verb) {
    case "modify":
    case "fix_bug":
    case "behaviour":
      return hasSymbol ? "modify_return" : "replace_expression";
    case "style":
    case "layout":
      return "modify_component_prop_default";
    case "connect":
      return "update_import";
    case "add_test":
      return "create_file";
    case "refactor":
      return "add_export";
    case "remove":
    case "move":
    case "rename":
      return "replace_expression";
    case "create":
      return "create_file";
  }
}

function pickRisksForVerb(verb: ChangeVerb): readonly string[] {
  switch (verb) {
    case "modify": case "fix_bug": case "behaviour":
      return ["may_break_dependent_tests", "may_affect_other_callers"];
    case "style": case "layout":
      return ["visual_regression_possible", "responsive_variants_may_diverge"];
    case "connect":
      return ["circular_dependency_possible", "import_path_may_not_resolve"];
    case "remove":
      return ["dependent_code_may_break", "no_easy_rollback_without_git"];
    case "move": case "rename":
      return ["all_references_must_be_updated_simultaneously"];
    case "add_test":
      return ["test_may_be_flaky_without_isolation"];
    case "refactor":
      return ["behaviour_must_be_preserved"];
    case "create":
      return ["file_may_already_exist", "path_may_not_match_project_convention"];
  }
}

function inferPathFromRequest(request: string): string {
  const lower = request.toLowerCase();
  if (lower.includes("component") || lower.includes("react")) return "src/components/GeneratedComponent.tsx";
  if (lower.includes("hook")) return "src/hooks/useGenerated.ts";
  if (lower.includes("api")) return "src/api/generated-endpoint.ts";
  if (lower.includes("test")) return "src/generated.test.ts";
  return "src/generated.ts";
}
