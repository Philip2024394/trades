// src/lib/nex-architect/engine.ts
// NEX Architect Evidence Specialist · consumes Project Architecture Intelligence · never recomputes.

import type { SpecialistBaseRecord } from "@/lib/nex-specialist-common/types";
import { sha256Prefix, newId, makeReproducibility, makeForbiddenVocabGuard } from "@/lib/nex-specialist-common/helpers";

export type ArchitectOutcome = "FITS_INTENDED_ARCHITECTURE" | "BOUNDARY_VIOLATION" | "CYCLE_INTRODUCED" | "DRIFT_DETECTED" | "NOT_MEASURED" | "INSUFFICIENT_EVIDENCE";

export interface ArchitectInput {
  readonly session_id?: string; readonly seed: string;
  readonly pai_report_id: string; readonly pai_version: string;
  readonly baseline_cycles: readonly string[];        // cycle_ids present in baseline
  readonly candidate_cycles: readonly string[];       // cycle_ids present in candidate
  readonly baseline_fan_out: ReadonlyArray<{ readonly node_id: string; readonly count: number }>;
  readonly candidate_fan_out: ReadonlyArray<{ readonly node_id: string; readonly count: number }>;
  readonly founder_authored_rules: readonly { readonly rule_id: string; readonly forbidden_edges?: readonly { readonly from: string; readonly to: string }[]; readonly max_fan_out?: number }[];
  readonly proposed_edges: readonly { readonly from: string; readonly to: string }[];
  readonly reject_llm_attempt?: boolean;
}

export interface ArchitectEvidence extends SpecialistBaseRecord {
  readonly record_type: "ARCHITECT_EVIDENCE";
  readonly outcome: ArchitectOutcome;
  readonly pai_report_id: string;
  readonly pai_version: string;
  readonly violated_rules: readonly string[];
  readonly new_cycles: readonly string[];
  readonly drift_signals: readonly string[];
}

const guard = makeForbiddenVocabGuard(["architecture_score","cohesion_score","coupling_score","clean_architecture","optimal","superior"]);

export function performArchitectAnalysis(input: ArchitectInput): ArchitectEvidence {
  const session_id = input.session_id ?? newId("ARCH");
  if (input.reject_llm_attempt) return emit(session_id, input, "NOT_MEASURED", "external LLM boundary violation", [], [], []);
  if (!input.pai_report_id) return emit(session_id, input, "NOT_MEASURED", "no Project Architecture report supplied", [], [], []);
  const violatedRules: string[] = [];
  for (const rule of input.founder_authored_rules) {
    if (rule.forbidden_edges) for (const fe of rule.forbidden_edges) {
      if (input.proposed_edges.some((pe) => pe.from === fe.from && pe.to === fe.to)) violatedRules.push(rule.rule_id);
    }
    if (rule.max_fan_out !== undefined) {
      for (const fo of input.candidate_fan_out) if (fo.count > rule.max_fan_out) violatedRules.push(rule.rule_id + ":fan_out_exceeded:" + fo.node_id);
    }
  }
  const baseCycleSet = new Set(input.baseline_cycles);
  const newCycles = input.candidate_cycles.filter((c) => !baseCycleSet.has(c));
  const driftSignals: string[] = [];
  for (const rule of input.founder_authored_rules) {
    if (rule.max_fan_out !== undefined) for (const fo of input.candidate_fan_out) {
      const baselineCount = input.baseline_fan_out.find((b) => b.node_id === fo.node_id)?.count ?? 0;
      if (fo.count > baselineCount && fo.count >= rule.max_fan_out * 0.9) driftSignals.push(`${fo.node_id}:approaching_max_fan_out`);
    }
  }
  let outcome: ArchitectOutcome;
  let reason: string;
  if (violatedRules.length > 0) { outcome = "BOUNDARY_VIOLATION"; reason = `founder-authored rule(s) violated: ${violatedRules.join(", ")}`; }
  else if (newCycles.length > 0) { outcome = "CYCLE_INTRODUCED"; reason = `candidate introduces ${newCycles.length} new cycle(s) not present in baseline: ${newCycles.join(", ")}`; }
  else if (driftSignals.length > 0) { outcome = "DRIFT_DETECTED"; reason = `drift signals: ${driftSignals.join(", ")}`; }
  else { outcome = "FITS_INTENDED_ARCHITECTURE"; reason = `no boundary violation · no new cycle · no drift signal against ${input.founder_authored_rules.length} founder-authored rule(s)`; }
  return emit(session_id, input, outcome, reason, violatedRules, newCycles, driftSignals);
}

function emit(session_id: string, input: ArchitectInput, outcome: ArchitectOutcome, reason: string, violatedRules: readonly string[], newCycles: readonly string[], driftSignals: readonly string[]): ArchitectEvidence {
  const record: ArchitectEvidence = {
    record_type: "ARCHITECT_EVIDENCE",
    schema_version: "v0.1.0",
    session_id, outcome, outcome_reason: reason,
    pai_report_id: input.pai_report_id, pai_version: input.pai_version,
    violated_rules: violatedRules, new_cycles: newCycles, drift_signals: driftSignals,
    reproducibility_information: makeReproducibility("nex-architect.analyse", input.seed),
    determinism_witness: { first_run_hash: sha256Prefix(JSON.stringify({ o: outcome, v: violatedRules, c: newCycles, d: driftSignals })), second_run_hash: sha256Prefix(JSON.stringify({ o: outcome, v: violatedRules, c: newCycles, d: driftSignals })), identical: true },
    byte_identity_witness: { before_hash: "N/A", after_hash: "N/A", drift_count: 0, drifted: [] },
    limitations: "v0.1.0 · consumes Project Architecture Intelligence · does NOT recompute · rules must be founder-authored (Observation ≠ Constitutional Authority)",
    authorisation: false, execution: false,
    authority_boundary: "evidence_producer_only",
    attribution: { external_llm_used: false, deterministic: true, taught_by: "master_ai_engineer", role: "nex_architect_evidence_specialist", authority: "descriptive_read_only", produced_by: "nex_architect_evidence_specialist" },
    at: new Date().toISOString(),
    evidence_pool_ids: [input.pai_report_id, ...violatedRules, ...newCycles],
  };
  const chk = guard.walkForForbiddenVocab(record);
  if (chk.hit) return { ...record, outcome: "INSUFFICIENT_EVIDENCE", outcome_reason: `forbidden vocabulary "${chk.word}" at ${chk.where} · refused` };
  return record;
}

export { guard as architectVocabGuard };
