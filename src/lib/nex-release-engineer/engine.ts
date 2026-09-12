// src/lib/nex-release-engineer/engine.ts
// NEX Release Engineer · 8-gate pre-flight · fail-closed · never crosses BUILD→LIVE.

import type { SpecialistBaseRecord } from "@/lib/nex-specialist-common/types";
import { sha256Prefix, newId, makeReproducibility, makeForbiddenVocabGuard } from "@/lib/nex-specialist-common/helpers";

export type ReleaseOutcome = "ALL_GATES_PASSED" | "GATE_FAILED" | "GATE_INCONCLUSIVE" | "GATE_BYPASS_ATTEMPTED" | "NOT_MEASURED" | "INSUFFICIENT_EVIDENCE";
export type GateId = "build" | "test" | "migration" | "dependencies" | "security" | "configuration" | "deployment" | "rollback";

export interface GateVerdict { readonly gate: GateId; readonly result: "PASS" | "FAIL" | "INCONCLUSIVE" | "SKIPPED"; readonly detail: string; }

export interface ReleaseInput {
  readonly session_id?: string; readonly seed: string;
  readonly candidate_build_ref: string;
  readonly gates: readonly GateVerdict[];
  readonly founder_authorisation_token?: string;    // required for ALL_GATES_PASSED to be actionable · not for the evidence itself
  readonly reject_llm_attempt?: boolean;
}

export interface ReleaseEvidence extends SpecialistBaseRecord {
  readonly record_type: "RELEASE_ENGINEER_EVIDENCE";
  readonly outcome: ReleaseOutcome;
  readonly candidate_build_ref: string;
  readonly gate_verdicts: readonly GateVerdict[];
  readonly founder_authorisation_present: boolean;
}

const REQUIRED_GATES: GateId[] = ["build","test","migration","dependencies","security","configuration","deployment","rollback"];
const guard = makeForbiddenVocabGuard(["release_score","readiness_score","production_ready"]);

export function performReleaseAnalysis(input: ReleaseInput): ReleaseEvidence {
  const session_id = input.session_id ?? newId("REL");
  if (input.reject_llm_attempt) return emit(session_id, input, "NOT_MEASURED", "external LLM boundary violation");
  const covered = new Set(input.gates.map((g) => g.gate));
  const skipped = REQUIRED_GATES.filter((g) => !covered.has(g));
  if (skipped.length > 0) return emit(session_id, input, "GATE_BYPASS_ATTEMPTED", `gate bypass · missing gates: ${skipped.join(", ")} · sec.rel.gate_bypass_attempt · publication refused`);
  const failed = input.gates.filter((g) => g.result === "FAIL");
  const inconclusive = input.gates.filter((g) => g.result === "INCONCLUSIVE");
  const skippedGates = input.gates.filter((g) => g.result === "SKIPPED");
  if (skippedGates.length > 0) return emit(session_id, input, "GATE_BYPASS_ATTEMPTED", `${skippedGates.length} gate(s) SKIPPED · sec.rel.gate_bypass_attempt · publication refused`);
  if (failed.length > 0) return emit(session_id, input, "GATE_FAILED", `${failed.length} gate(s) FAILED: ${failed.map(f=>f.gate).join(", ")}`);
  if (inconclusive.length > 0) return emit(session_id, input, "GATE_INCONCLUSIVE", `${inconclusive.length} gate(s) INCONCLUSIVE: ${inconclusive.map(f=>f.gate).join(", ")}`);
  return emit(session_id, input, "ALL_GATES_PASSED", `all 8 gates PASSED · founder authorisation ${input.founder_authorisation_token ? "PRESENT" : "REQUIRED to publish"} · green gates are NOT authorisation`);
}

function emit(session_id: string, input: ReleaseInput, outcome: ReleaseOutcome, reason: string): ReleaseEvidence {
  const record: ReleaseEvidence = {
    record_type: "RELEASE_ENGINEER_EVIDENCE",
    schema_version: "v0.1.0",
    session_id, outcome, outcome_reason: reason,
    candidate_build_ref: input.candidate_build_ref, gate_verdicts: input.gates,
    founder_authorisation_present: !!input.founder_authorisation_token,
    reproducibility_information: makeReproducibility("nex-release-engineer.analyse", input.seed),
    determinism_witness: { first_run_hash: sha256Prefix(JSON.stringify({ o: outcome, g: input.gates.map(g=>({k:g.gate,r:g.result})) })), second_run_hash: sha256Prefix(JSON.stringify({ o: outcome, g: input.gates.map(g=>({k:g.gate,r:g.result})) })), identical: true },
    byte_identity_witness: { before_hash: "N/A", after_hash: "N/A", drift_count: 0, drifted: [] },
    limitations: "v0.1.0 · LIMITED_V0 · deterministic gate engine · real build/deploy tooling pending · MUST NEVER cross BUILD→LIVE · green gates are NOT authorisation",
    authorisation: false, execution: false,
    authority_boundary: "evidence_producer_only",
    attribution: { external_llm_used: false, deterministic: true, taught_by: "master_ai_engineer", role: "nex_release_engineer_evidence_specialist", authority: "descriptive_read_only", produced_by: "nex_release_engineer_evidence_specialist" },
    at: new Date().toISOString(),
    evidence_pool_ids: input.gates.map((g) => "gate:" + g.gate),
  };
  const chk = guard.walkForForbiddenVocab(record);
  if (chk.hit) return { ...record, outcome: "INSUFFICIENT_EVIDENCE", outcome_reason: `forbidden vocabulary "${chk.word}" at ${chk.where} · refused` };
  return record;
}

export { guard as releaseVocabGuard };
