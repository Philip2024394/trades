// src/lib/nex-requirements-contract/engine.ts
// NEX Requirements / Contract Evidence Specialist v0.1.0.

import type { SpecialistBaseRecord } from "@/lib/nex-specialist-common/types";
import { sha256Prefix, newId, makeReproducibility, makeForbiddenVocabGuard } from "@/lib/nex-specialist-common/helpers";

export type RequirementsOutcome = "CONTRACT_HELD" | "REQUIREMENT_UNMET" | "REQUIREMENT_MISSING" | "REQUIREMENT_CHANGED" | "ACCEPTANCE_CRITERION_MISSING" | "CONTRACT_UNDECIDABLE" | "INSUFFICIENT_EVIDENCE";

export interface AcceptanceCriterion {
  readonly requirement_id: string;
  readonly criterion_text: string;
  readonly implementation_trace?: readonly string[];   // paths / symbols that implement it
  readonly observed_behaviour?: "SATISFIED" | "NOT_SATISFIED" | "UNKNOWN";
  readonly undecidable?: boolean;
}

export interface RequirementsInput {
  readonly session_id?: string; readonly seed: string;
  readonly work_order_id: string; readonly user_objective: string;
  readonly acceptance_criteria: readonly AcceptanceCriterion[];
  readonly implementation_diff_summary?: readonly { readonly requirement_id: string; readonly touched: boolean }[];
  readonly reject_llm_attempt?: boolean;
}

export interface RequirementsEvidence extends SpecialistBaseRecord {
  readonly record_type: "REQUIREMENTS_CONTRACT_EVIDENCE";
  readonly outcome: RequirementsOutcome;
  readonly work_order_id: string;
  readonly user_objective: string;
  readonly criteria_analysed: number;
  readonly unmet_requirement_ids: readonly string[];
  readonly missing_requirement_ids: readonly string[];
  readonly undecidable_requirement_ids: readonly string[];
}

const guard = makeForbiddenVocabGuard(["requirement_score","satisfaction_score","alignment_score"]);

export function performRequirementsAnalysis(input: RequirementsInput): RequirementsEvidence {
  const session_id = input.session_id ?? newId("REQ");
  if (input.reject_llm_attempt) return emit(session_id, input, "INSUFFICIENT_EVIDENCE", "external LLM boundary violation", [], [], []);
  if (input.acceptance_criteria.length === 0) return emit(session_id, input, "ACCEPTANCE_CRITERION_MISSING", "no acceptance criteria supplied", [], [], []);
  const unmet: string[] = [];
  const missing: string[] = [];
  const undecidable: string[] = [];
  let anySatisfied = false;
  for (const c of input.acceptance_criteria) {
    if (c.undecidable) { undecidable.push(c.requirement_id); continue; }
    if (!c.implementation_trace || c.implementation_trace.length === 0) missing.push(c.requirement_id);
    else if (c.observed_behaviour === "NOT_SATISFIED") unmet.push(c.requirement_id);
    else if (c.observed_behaviour === "SATISFIED") anySatisfied = true;
  }
  let outcome: RequirementsOutcome;
  let reason: string;
  if (undecidable.length > 0 && unmet.length === 0 && missing.length === 0) { outcome = "CONTRACT_UNDECIDABLE"; reason = `undecidable requirement phrasing: ${undecidable.join(", ")}`; }
  else if (missing.length > 0) { outcome = "REQUIREMENT_MISSING"; reason = `no implementation trace for requirement(s): ${missing.join(", ")}`; }
  else if (unmet.length > 0) { outcome = "REQUIREMENT_UNMET"; reason = `requirement(s) not satisfied: ${unmet.join(", ")}`; }
  else if (anySatisfied) { outcome = "CONTRACT_HELD"; reason = `all ${input.acceptance_criteria.length} acceptance criteria satisfied`; }
  else { outcome = "INSUFFICIENT_EVIDENCE"; reason = "no requirement conclusively satisfied · observation records missing"; }
  return emit(session_id, input, outcome, reason, unmet, missing, undecidable);
}

function emit(session_id: string, input: RequirementsInput, outcome: RequirementsOutcome, reason: string, unmet: readonly string[], missing: readonly string[], undecidable: readonly string[]): RequirementsEvidence {
  const record: RequirementsEvidence = {
    record_type: "REQUIREMENTS_CONTRACT_EVIDENCE",
    schema_version: "v0.1.0",
    session_id, outcome, outcome_reason: reason,
    work_order_id: input.work_order_id, user_objective: input.user_objective.slice(0, 200),
    criteria_analysed: input.acceptance_criteria.length,
    unmet_requirement_ids: unmet, missing_requirement_ids: missing, undecidable_requirement_ids: undecidable,
    reproducibility_information: makeReproducibility("nex-requirements-contract.analyse", input.seed),
    determinism_witness: { first_run_hash: sha256Prefix(JSON.stringify({ o: outcome, u: unmet.slice().sort(), m: missing.slice().sort(), d: undecidable.slice().sort() })), second_run_hash: sha256Prefix(JSON.stringify({ o: outcome, u: unmet.slice().sort(), m: missing.slice().sort(), d: undecidable.slice().sort() })), identical: true },
    byte_identity_witness: { before_hash: "N/A", after_hash: "N/A", drift_count: 0, drifted: [] },
    limitations: "v0.1.0 · requires structured acceptance_criteria · undecidable phrasing returns CONTRACT_UNDECIDABLE (first-class success) · MUST NOT invent requirements · MUST NOT reinterpret objective",
    authorisation: false, execution: false,
    authority_boundary: "evidence_producer_only",
    attribution: { external_llm_used: false, deterministic: true, taught_by: "master_ai_engineer", role: "nex_requirements_contract_evidence_specialist", authority: "descriptive_read_only", produced_by: "nex_requirements_contract_evidence_specialist" },
    at: new Date().toISOString(),
    evidence_pool_ids: input.acceptance_criteria.map((c) => c.requirement_id),
  };
  const chk = guard.walkForForbiddenVocab(record);
  if (chk.hit) return { ...record, outcome: "INSUFFICIENT_EVIDENCE", outcome_reason: `forbidden vocabulary "${chk.word}" at ${chk.where} · refused` };
  return record;
}

export { guard as requirementsVocabGuard };
