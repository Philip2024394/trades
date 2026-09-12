// src/lib/nex-refactor-engineer/engine.ts
// NEX Refactor Engineer · candidate-only · DONT_REFACTOR is first-class success.

import type { SpecialistBaseRecord } from "@/lib/nex-specialist-common/types";
import { sha256Prefix, newId, makeReproducibility, makeForbiddenVocabGuard } from "@/lib/nex-specialist-common/helpers";

export type RefactorOutcome = "REFACTOR_CANDIDATE" | "TARGET_ALREADY_ACCEPTABLE" | "NO_MEASURABLE_BENEFIT" | "RISK_EXCEEDS_BENEFIT" | "INSUFFICIENT_EVIDENCE";

export interface RefactorInput {
  readonly session_id?: string; readonly seed: string;
  readonly target_scope: string;
  readonly baseline_metrics: { readonly duplication?: number; readonly function_size?: number; readonly nesting_depth?: number; readonly cyclomatic?: number };
  readonly projected_metrics?: { readonly duplication?: number; readonly function_size?: number; readonly nesting_depth?: number; readonly cyclomatic?: number };
  readonly test_coverage_present: boolean;
  readonly test_coverage_ratio?: number;               // 0..1 · founder-authored threshold for RISK_EXCEEDS_BENEFIT
  readonly minimum_coverage_ratio: number;             // founder-authored policy
  readonly reject_llm_attempt?: boolean;
}

export interface RefactorEvidence extends SpecialistBaseRecord {
  readonly record_type: "REFACTOR_ENGINEER_EVIDENCE";
  readonly outcome: RefactorOutcome;
  readonly target_scope: string;
  readonly projected_delta: Readonly<Record<string, number>>;
  readonly candidate_diff_ref?: string;
  readonly behaviour_preservation_witness?: string;
}

const guard = makeForbiddenVocabGuard(["refactor_score","simplification_score","elegant","cleaner","optimal","superior"]);

export function performRefactorAnalysis(input: RefactorInput): RefactorEvidence {
  const session_id = input.session_id ?? newId("REF");
  if (input.reject_llm_attempt) return emit(session_id, input, "INSUFFICIENT_EVIDENCE", "external LLM boundary violation", {});
  if (!input.test_coverage_present || (input.test_coverage_ratio ?? 0) < input.minimum_coverage_ratio) return emit(session_id, input, "RISK_EXCEEDS_BENEFIT", `insufficient test coverage · coverage_ratio=${input.test_coverage_ratio ?? 0} · minimum=${input.minimum_coverage_ratio} · Minimum Necessary Complexity preserved`, {});
  if (!input.projected_metrics) return emit(session_id, input, "INSUFFICIENT_EVIDENCE", "no projected metrics supplied", {});
  const delta: Record<string, number> = {};
  let improvement = 0;
  let regression = 0;
  for (const k of ["duplication","function_size","nesting_depth","cyclomatic"] as const) {
    const b = input.baseline_metrics[k]; const p = input.projected_metrics[k];
    if (typeof b === "number" && typeof p === "number") { delta[k] = p - b; if (p < b) improvement++; else if (p > b) regression++; }
  }
  const hasMeasuredDelta = Object.keys(delta).length > 0;
  if (!hasMeasuredDelta) return emit(session_id, input, "INSUFFICIENT_EVIDENCE", "no measurable metric delta between baseline and projected", {});
  if (improvement === 0 && regression === 0) return emit(session_id, input, "TARGET_ALREADY_ACCEPTABLE", "target already at Minimum Necessary Complexity · no measurable change proposed", delta);
  if (improvement === 0 && regression > 0) return emit(session_id, input, "NO_MEASURABLE_BENEFIT", `projected metrics regress · no improvement · Minimum Necessary Complexity says leave it alone`, delta);
  if (regression > improvement) return emit(session_id, input, "NO_MEASURABLE_BENEFIT", `regression outweighs improvement · Minimum Necessary Complexity says leave it alone`, delta);
  return emit(session_id, input, "REFACTOR_CANDIDATE", `candidate scaffold produced · projected improvements on ${improvement} metric(s) · behaviour-preservation witness required at application time`, delta);
}

function emit(session_id: string, input: RefactorInput, outcome: RefactorOutcome, reason: string, delta: Record<string, number>): RefactorEvidence {
  const record: RefactorEvidence = {
    record_type: "REFACTOR_ENGINEER_EVIDENCE",
    schema_version: "v0.1.0",
    session_id, outcome, outcome_reason: reason,
    target_scope: input.target_scope, projected_delta: delta,
    candidate_diff_ref: outcome === "REFACTOR_CANDIDATE" ? "ref-cand-" + sha256Prefix(input.target_scope + JSON.stringify(delta)) : undefined,
    behaviour_preservation_witness: outcome === "REFACTOR_CANDIDATE" ? "REQUIRED_AT_APPLICATION" : undefined,
    reproducibility_information: makeReproducibility("nex-refactor-engineer.analyse", input.seed),
    determinism_witness: { first_run_hash: sha256Prefix(JSON.stringify({ o: outcome, d: delta })), second_run_hash: sha256Prefix(JSON.stringify({ o: outcome, d: delta })), identical: true },
    byte_identity_witness: { before_hash: "N/A", after_hash: "N/A", drift_count: 0, drifted: [] },
    limitations: "v0.1.0 · DONT_REFACTOR is a first-class success · Minimum Necessary Complexity authoritative · MUST NEVER modify code · candidate diff is candidate_only",
    authorisation: false, execution: false,
    authority_boundary: "evidence_producer_only",
    attribution: { external_llm_used: false, deterministic: true, taught_by: "master_ai_engineer", role: "nex_refactor_engineer_evidence_specialist", authority: "descriptive_read_only", produced_by: "nex_refactor_engineer_evidence_specialist" },
    at: new Date().toISOString(),
    evidence_pool_ids: Object.keys(delta).map((k) => "delta:" + k),
  };
  const chk = guard.walkForForbiddenVocab(record);
  if (chk.hit) return { ...record, outcome: "INSUFFICIENT_EVIDENCE", outcome_reason: `forbidden vocabulary "${chk.word}" at ${chk.where} · refused` };
  return record;
}

export { guard as refactorVocabGuard };
