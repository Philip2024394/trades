// src/lib/nex1-builder/engine.ts
// NEX1 Builder / Runtime · v0.1.0 SKELETON.
// Consumes authorised Work Orders · plans candidate diffs · NEVER executes.

import type { SpecialistBaseRecord } from "@/lib/nex-specialist-common/types";
import { sha256Prefix, newId, makeReproducibility, makeForbiddenVocabGuard } from "@/lib/nex-specialist-common/helpers";

export type BuilderOutcome = "PLAN_PRODUCED" | "PLAN_REJECTED" | "OUT_OF_SCOPE" | "MISSING_AUTHORISATION" | "MISSING_ROLLBACK" | "EXPIRED" | "INSUFFICIENT_CONTEXT";

export interface WorkOrder {
  readonly work_order_id: string;
  readonly founder_authorisation: string;
  readonly user_objective: string;
  readonly acceptance_criteria: readonly { readonly requirement_id: string; readonly criterion_text: string }[];
  readonly build_boundaries: readonly string[];     // paths / subsystems Builder may modify
  readonly build_exclusions: readonly string[];     // paths / subsystems Builder MUST NOT modify
  readonly scope_notes: string;
  readonly rollback_reference: string;
  readonly authorised_specialists: readonly string[];
  readonly expiry: string;                            // ISO-8601
}

// Mandatory exclusions that ALWAYS apply regardless of Work Order authoring.
const MANDATORY_EXCLUSIONS = [
  "docs/DECISIONS",
  "docs/product-constitution",
  "data/nex1-engineering-evolution/engineering-standard-schema",
  "data/nex1-engineering-evolution/authority-matrix",
  "src/lib/nex-evidence-engine",
  "src/lib/nex-project-profile",
  "src/lib/nex-project-architecture",
  "src/lib/nex-evidence-validation",
];

export interface BuilderInput {
  readonly session_id?: string; readonly seed: string;
  readonly work_order: WorkOrder;
  readonly proposed_files: readonly string[];       // paths Builder wants to modify
  readonly reject_llm_attempt?: boolean;
}

export interface BuilderPlanRecord extends SpecialistBaseRecord {
  readonly record_type: "NEX1_BUILDER_PLAN";
  readonly outcome: BuilderOutcome;
  readonly work_order_id: string;
  readonly plan_id: string;
  readonly rejected_paths: readonly string[];       // paths rejected against boundaries / exclusions
  readonly candidate_diff_ref: string | null;
  readonly rollback_reference: string;
}

const guard = makeForbiddenVocabGuard(["autonomous","fully automatic","zero touch"]);

function pathInList(path: string, list: readonly string[]): boolean {
  for (const p of list) if (path === p || path.startsWith(p.endsWith("/") ? p : p + "/")) return true;
  return false;
}

export function performBuilderPlan(input: BuilderInput): BuilderPlanRecord {
  const session_id = input.session_id ?? newId("BUILD");
  const wo = input.work_order;
  if (input.reject_llm_attempt) return emit(session_id, input, "INSUFFICIENT_CONTEXT", "external LLM boundary violation", [], null);
  if (!wo.founder_authorisation || wo.founder_authorisation.length === 0) return emit(session_id, input, "MISSING_AUTHORISATION", "founder_authorisation missing", [], null);
  if (!wo.rollback_reference || wo.rollback_reference.length === 0) return emit(session_id, input, "MISSING_ROLLBACK", "rollback_reference missing", [], null);
  if (!wo.expiry || new Date(wo.expiry).getTime() < Date.now()) return emit(session_id, input, "EXPIRED", "Work Order expired", [], null);
  // Enforce boundaries + exclusions
  const rejected: string[] = [];
  for (const p of input.proposed_files) {
    const inBoundary = wo.build_boundaries.length === 0 ? false : pathInList(p, wo.build_boundaries);
    const inExclusion = pathInList(p, wo.build_exclusions) || pathInList(p, MANDATORY_EXCLUSIONS);
    if (!inBoundary || inExclusion) rejected.push(p);
  }
  if (rejected.length > 0) return emit(session_id, input, "OUT_OF_SCOPE", `paths outside boundaries or in exclusions: ${rejected.join(", ")}`, rejected, null);
  if (input.proposed_files.length === 0) return emit(session_id, input, "INSUFFICIENT_CONTEXT", "no proposed files supplied", [], null);
  const planId = "PLAN-" + sha256Prefix(wo.work_order_id + ":" + input.proposed_files.join("|"));
  return emit(session_id, input, "PLAN_PRODUCED", `plan produced for ${input.proposed_files.length} file(s) within authorised boundaries · candidate diff NOT applied · founder authorisation required for application`, [], planId);
}

function emit(session_id: string, input: BuilderInput, outcome: BuilderOutcome, reason: string, rejected: readonly string[], planId: string | null): BuilderPlanRecord {
  const record: BuilderPlanRecord = {
    record_type: "NEX1_BUILDER_PLAN",
    schema_version: "v0.1.0",
    session_id, outcome, outcome_reason: reason,
    work_order_id: input.work_order.work_order_id,
    plan_id: planId ?? "PLAN-NONE",
    rejected_paths: rejected,
    candidate_diff_ref: outcome === "PLAN_PRODUCED" ? "diff-" + (planId ?? "none") : null,
    rollback_reference: input.work_order.rollback_reference,
    reproducibility_information: makeReproducibility("nex1-builder.plan", input.seed),
    determinism_witness: { first_run_hash: sha256Prefix(JSON.stringify({ o: outcome, r: rejected.slice().sort(), p: planId })), second_run_hash: sha256Prefix(JSON.stringify({ o: outcome, r: rejected.slice().sort(), p: planId })), identical: true },
    byte_identity_witness: { before_hash: "N/A", after_hash: "N/A", drift_count: 0, drifted: [] },
    limitations: "v0.1.0 SKELETON · plan-and-propose only · candidate diffs are NOT applied · actual diff application is a separate founder-authorised phase · workstation UI NOT_IMPLEMENTED · live preview NOT_IMPLEMENTED · application-generation frontend NOT_IMPLEMENTED",
    authorisation: false, execution: false,
    authority_boundary: "candidate_producer_only",
    attribution: { external_llm_used: false, deterministic: true, taught_by: "master_ai_engineer", role: "nex1_builder", authority: "candidate_producer_only", produced_by: "nex1_builder" },
    at: new Date().toISOString(),
    evidence_pool_ids: [input.work_order.work_order_id, planId ?? "PLAN-NONE"],
  };
  const chk = guard.walkForForbiddenVocab(record);
  if (chk.hit) return { ...record, outcome: "INSUFFICIENT_CONTEXT", outcome_reason: `forbidden vocabulary "${chk.word}" at ${chk.where} · refused` };
  return record;
}

export { guard as builderVocabGuard, MANDATORY_EXCLUSIONS };
