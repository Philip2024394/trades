// src/lib/nex-documentation-engineer/engine.ts
// NEX Documentation Engineer · drift detector v0.1.0.

import type { SpecialistBaseRecord } from "@/lib/nex-specialist-common/types";
import { sha256Prefix, newId, makeReproducibility, makeForbiddenVocabGuard } from "@/lib/nex-specialist-common/helpers";

export type DocsOutcome = "DOCS_IN_SYNC" | "API_SURFACE_DRIFT" | "OPENAPI_DRIFT" | "SCHEMA_DRIFT" | "PROSE_SYMBOL_DRIFT" | "TESTS_COVERAGE_GAP" | "MULTIPLE_DRIFTS" | "NOT_MEASURED" | "INSUFFICIENT_EVIDENCE";

export interface DocsInput {
  readonly session_id?: string; readonly seed: string;
  readonly scope: string;
  readonly api_surface_hash_current?: string;
  readonly api_surface_hash_committed?: string;
  readonly openapi_diff_findings?: number;
  readonly schema_drift_findings?: number;
  readonly prose_symbol_missing_ids?: readonly string[];
  readonly tests_missing_for_documented?: readonly string[];
  readonly reject_llm_attempt?: boolean;
}

export interface DocsEvidence extends SpecialistBaseRecord {
  readonly record_type: "DOCUMENTATION_ENGINEER_EVIDENCE";
  readonly outcome: DocsOutcome;
  readonly scope: string;
  readonly api_drift: boolean;
  readonly openapi_findings: number;
  readonly schema_findings: number;
  readonly prose_symbol_missing: readonly string[];
  readonly tests_missing: readonly string[];
}

const guard = makeForbiddenVocabGuard(["docs_score","documentation_quality","complete_documentation"]);

export function performDocsAnalysis(input: DocsInput): DocsEvidence {
  const session_id = input.session_id ?? newId("DOC");
  if (input.reject_llm_attempt) return emit(session_id, input, "NOT_MEASURED", "external LLM boundary violation");
  const drifts: string[] = [];
  const apiDrift = !!(input.api_surface_hash_current && input.api_surface_hash_committed && input.api_surface_hash_current !== input.api_surface_hash_committed);
  if (apiDrift) drifts.push("API_SURFACE_DRIFT");
  if ((input.openapi_diff_findings ?? 0) > 0) drifts.push("OPENAPI_DRIFT");
  if ((input.schema_drift_findings ?? 0) > 0) drifts.push("SCHEMA_DRIFT");
  if ((input.prose_symbol_missing_ids ?? []).length > 0) drifts.push("PROSE_SYMBOL_DRIFT");
  if ((input.tests_missing_for_documented ?? []).length > 0) drifts.push("TESTS_COVERAGE_GAP");
  let outcome: DocsOutcome;
  let reason: string;
  if (drifts.length === 0) { outcome = "DOCS_IN_SYNC"; reason = "no drift detected in scope"; }
  else if (drifts.length === 1) { outcome = drifts[0] as DocsOutcome; reason = `single drift category: ${drifts[0]}`; }
  else { outcome = "MULTIPLE_DRIFTS"; reason = `multiple drift categories: ${drifts.join(", ")}`; }
  return emit(session_id, input, outcome, reason);
}

function emit(session_id: string, input: DocsInput, outcome: DocsOutcome, reason: string): DocsEvidence {
  const apiDrift = !!(input.api_surface_hash_current && input.api_surface_hash_committed && input.api_surface_hash_current !== input.api_surface_hash_committed);
  const record: DocsEvidence = {
    record_type: "DOCUMENTATION_ENGINEER_EVIDENCE",
    schema_version: "v0.1.0",
    session_id, outcome, outcome_reason: reason,
    scope: input.scope, api_drift: apiDrift,
    openapi_findings: input.openapi_diff_findings ?? 0,
    schema_findings: input.schema_drift_findings ?? 0,
    prose_symbol_missing: input.prose_symbol_missing_ids ?? [],
    tests_missing: input.tests_missing_for_documented ?? [],
    reproducibility_information: makeReproducibility("nex-documentation-engineer.analyse", input.seed),
    determinism_witness: { first_run_hash: sha256Prefix(JSON.stringify({ o: outcome, a: apiDrift })), second_run_hash: sha256Prefix(JSON.stringify({ o: outcome, a: apiDrift })), identical: true },
    byte_identity_witness: { before_hash: "N/A", after_hash: "N/A", drift_count: 0, drifted: [] },
    limitations: "v0.1.0 · LIMITED_V0 · deterministic drift detector · real api-extractor/typedoc/oasdiff binding pending · MUST NEVER rewrite docs autonomously",
    authorisation: false, execution: false,
    authority_boundary: "evidence_producer_only",
    attribution: { external_llm_used: false, deterministic: true, taught_by: "master_ai_engineer", role: "nex_documentation_engineer_evidence_specialist", authority: "descriptive_read_only", produced_by: "nex_documentation_engineer_evidence_specialist" },
    at: new Date().toISOString(),
    evidence_pool_ids: [...(input.prose_symbol_missing_ids ?? []), ...(input.tests_missing_for_documented ?? [])],
  };
  const chk = guard.walkForForbiddenVocab(record);
  if (chk.hit) return { ...record, outcome: "INSUFFICIENT_EVIDENCE", outcome_reason: `forbidden vocabulary "${chk.word}" at ${chk.where} · refused` };
  return record;
}

export { guard as documentationVocabGuard };
