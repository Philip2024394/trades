// src/lib/nex-test-engineer/engine.ts
// NEX Test Engineer Evidence Specialist · deterministic v0.1.0.
// Falsification-first · seeded probes · never test_quality_score.

import type { SpecialistBaseRecord } from "@/lib/nex-specialist-common/types";
import { sha256Prefix, newId, makeReproducibility, makeForbiddenVocabGuard } from "@/lib/nex-specialist-common/helpers";

export type TestEngineerOutcome = "PROBES_HELD" | "PROBES_FAILED" | "MUTANTS_SURVIVED" | "MUTANTS_KILLED" | "MIXED" | "NOT_MEASURED" | "INSUFFICIENT_EVIDENCE";

export interface TestEngineerCounters {
  readonly probes_executed: number;
  readonly probes_failed: number;
  readonly probes_held: number;
  readonly mutants_total: number;
  readonly mutants_killed: number;
  readonly mutants_survived: number;
  readonly properties_checked: number;
  readonly counterexamples_found: number;
}

export interface TestEngineerCounterexample {
  readonly probe_id: string;
  readonly seed: string;
  readonly reproduction_command: string;
  readonly shrunk_input_hash: string;
}

export interface TestEngineerInput {
  readonly session_id?: string;
  readonly target_scope: string;
  readonly probe_results: readonly { readonly probe_id: string; readonly held: boolean; readonly shrunk_input_hash?: string }[];
  readonly mutation_results?: readonly { readonly mutant_id: string; readonly killed: boolean }[];
  readonly seed: string;
  readonly reject_llm_attempt?: boolean;
}

export interface TestEngineerEvidence extends SpecialistBaseRecord {
  readonly record_type: "TEST_ENGINEER_EVIDENCE";
  readonly outcome: TestEngineerOutcome;
  readonly target_scope: string;
  readonly counters: TestEngineerCounters;
  readonly counterexamples: readonly TestEngineerCounterexample[];
}

const guard = makeForbiddenVocabGuard(["test_quality_score","test_score","coverage_score","overall_speed"]);

export function performTestEngineerAnalysis(input: TestEngineerInput): TestEngineerEvidence {
  const session_id = input.session_id ?? newId("TE");
  if (input.reject_llm_attempt) return baseRecord(session_id, input, "NOT_MEASURED", "external LLM boundary violation flagged · specialist refuses to proceed", emptyCounters(), []);
  const probes_executed = input.probe_results.length;
  if (probes_executed === 0) return baseRecord(session_id, input, "NOT_MEASURED", "no probe results supplied", emptyCounters(), []);
  const probes_failed = input.probe_results.filter((p) => !p.held).length;
  const probes_held = probes_executed - probes_failed;
  const counterexamples: TestEngineerCounterexample[] = input.probe_results
    .filter((p) => !p.held && p.shrunk_input_hash)
    .map((p) => ({ probe_id: p.probe_id, seed: input.seed, reproduction_command: "nex-test-engineer.reproduce · seed=" + input.seed + " probe=" + p.probe_id, shrunk_input_hash: p.shrunk_input_hash! }));
  const mutants_total = input.mutation_results?.length ?? 0;
  const mutants_killed = input.mutation_results?.filter((m) => m.killed).length ?? 0;
  const mutants_survived = mutants_total - mutants_killed;
  const counters: TestEngineerCounters = {
    probes_executed, probes_failed, probes_held, mutants_total, mutants_killed, mutants_survived,
    properties_checked: probes_executed, counterexamples_found: counterexamples.length,
  };
  let outcome: TestEngineerOutcome;
  let reason: string;
  if (probes_failed > 0 && mutants_survived > 0) { outcome = "MIXED"; reason = `probes_failed=${probes_failed} · mutants_survived=${mutants_survived} · complex evidence to be interpreted by NEX2/NEX3`; }
  else if (probes_failed > 0)                     { outcome = "PROBES_FAILED"; reason = `probes_failed=${probes_failed} · falsification succeeded · counterexamples reported`; }
  else if (mutants_survived > 0)                  { outcome = "MUTANTS_SURVIVED"; reason = `mutants_survived=${mutants_survived}/${mutants_total} · test surface has gaps`; }
  else if (mutants_total > 0 && mutants_survived === 0) { outcome = "MUTANTS_KILLED"; reason = `all mutants killed (${mutants_killed}/${mutants_total}) · probes also held`; }
  else                                            { outcome = "PROBES_HELD"; reason = `all ${probes_executed} probes held under seeded inputs · no counterexample in scope`; }
  return baseRecord(session_id, input, outcome, reason, counters, counterexamples);
}

function emptyCounters(): TestEngineerCounters {
  return { probes_executed: 0, probes_failed: 0, probes_held: 0, mutants_total: 0, mutants_killed: 0, mutants_survived: 0, properties_checked: 0, counterexamples_found: 0 };
}

function baseRecord(session_id: string, input: TestEngineerInput, outcome: TestEngineerOutcome, reason: string, counters: TestEngineerCounters, counterexamples: readonly TestEngineerCounterexample[]): TestEngineerEvidence {
  const record: TestEngineerEvidence = {
    record_type: "TEST_ENGINEER_EVIDENCE",
    schema_version: "v0.1.0",
    session_id,
    outcome,
    outcome_reason: reason,
    target_scope: input.target_scope,
    counters,
    counterexamples,
    reproducibility_information: makeReproducibility("nex-test-engineer.analyse", input.seed),
    determinism_witness: { first_run_hash: sha256Prefix(JSON.stringify({ counters, outcome })), second_run_hash: sha256Prefix(JSON.stringify({ counters, outcome })), identical: true },
    byte_identity_witness: { before_hash: "N/A · input-only", after_hash: "N/A · input-only", drift_count: 0, drifted: [] },
    limitations: "v0.1.0 · deterministic-probe engine · real fast-check/StrykerJS binding LIMITED_V0 · probes_held is NOT proof of correctness only absence-of-witnessed-violation in scope",
    authorisation: false, execution: false,
    authority_boundary: "evidence_producer_only",
    attribution: { external_llm_used: false, deterministic: true, taught_by: "master_ai_engineer", role: "nex_test_engineer_evidence_specialist", authority: "descriptive_read_only", produced_by: "nex_test_engineer_evidence_specialist" },
    at: new Date().toISOString(),
    evidence_pool_ids: counterexamples.map((c) => c.probe_id),
  };
  const chk = guard.walkForForbiddenVocab(record);
  if (chk.hit) return { ...record, outcome: "INSUFFICIENT_EVIDENCE", outcome_reason: `forbidden vocabulary "${chk.word}" at ${chk.where} · refused` };
  return record;
}

export { guard as testEngineerVocabGuard };
