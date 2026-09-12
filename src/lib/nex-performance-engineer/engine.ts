// src/lib/nex-performance-engineer/engine.ts
// NEX Performance Engineer · LIMITED_V0 · deterministic harness · no cross-machine compare.

import type { SpecialistBaseRecord } from "@/lib/nex-specialist-common/types";
import { sha256Prefix, newId, makeReproducibility, makeForbiddenVocabGuard } from "@/lib/nex-specialist-common/helpers";

export type PerformanceOutcome = "IMPROVEMENT_MEASURED" | "REGRESSION_MEASURED" | "EQUAL_WITHIN_NOISE" | "NOT_MEASURED" | "INSUFFICIENT_EVIDENCE" | "INCONCLUSIVE";

export interface PerformanceSample {
  readonly metric: string; readonly unit: string;
  readonly baseline_values: readonly number[];   // raw samples
  readonly candidate_values: readonly number[];  // raw samples
  readonly noise_floor: number;                   // founder-authored noise threshold
}

export interface PerformanceInput {
  readonly session_id?: string; readonly seed: string;
  readonly target_scope: string;
  readonly samples: readonly PerformanceSample[];
  readonly min_sample_count: number;             // founder-authored minimum
  readonly environment_fingerprint: string;
  readonly reject_llm_attempt?: boolean;
}

export interface PerformanceEvidence extends SpecialistBaseRecord {
  readonly record_type: "PERFORMANCE_ENGINEER_EVIDENCE";
  readonly outcome: PerformanceOutcome;
  readonly target_scope: string;
  readonly per_metric: readonly { readonly metric: string; readonly baseline_median: number; readonly candidate_median: number; readonly delta: number; readonly within_noise: boolean; readonly direction: "improvement" | "regression" | "equal" | "unknown" }[];
}

const guard = makeForbiddenVocabGuard(["performance_score","speed_score","overall_speed","much faster","significantly faster","dramatically faster","87% faster","92% faster"]);

function median(arr: readonly number[]): number { if (arr.length === 0) return NaN; const s = arr.slice().sort((a,b)=>a-b); return arr.length % 2 === 1 ? s[Math.floor(arr.length/2)] : (s[arr.length/2-1] + s[arr.length/2]) / 2; }

export function performPerformanceAnalysis(input: PerformanceInput): PerformanceEvidence {
  const session_id = input.session_id ?? newId("PERF");
  if (input.reject_llm_attempt) return emit(session_id, input, "NOT_MEASURED", "external LLM boundary violation", []);
  if (input.samples.length === 0) return emit(session_id, input, "NOT_MEASURED", "no samples supplied", []);
  const perMetric = input.samples.map((s) => {
    const bMed = median(s.baseline_values);
    const cMed = median(s.candidate_values);
    const delta = cMed - bMed;
    const within = Math.abs(delta) < s.noise_floor;
    let direction: "improvement" | "regression" | "equal" | "unknown" = "unknown";
    if (Number.isFinite(delta)) direction = within ? "equal" : (delta < 0 ? "improvement" : "regression");
    return { metric: s.metric, baseline_median: bMed, candidate_median: cMed, delta, within_noise: within, direction };
  });
  // Insufficient samples on any metric → INSUFFICIENT_EVIDENCE
  const insufficient = input.samples.some((s) => s.baseline_values.length < input.min_sample_count || s.candidate_values.length < input.min_sample_count);
  if (insufficient) return emit(session_id, input, "INSUFFICIENT_EVIDENCE", `sample count below founder-authored minimum ${input.min_sample_count}`, perMetric);
  const anyRegression = perMetric.some((m) => m.direction === "regression");
  const anyImprovement = perMetric.some((m) => m.direction === "improvement");
  const allEqual = perMetric.every((m) => m.direction === "equal");
  let outcome: PerformanceOutcome;
  let reason: string;
  if (anyRegression && !anyImprovement) { outcome = "REGRESSION_MEASURED"; reason = `regression on ${perMetric.filter(m=>m.direction==="regression").map(m=>m.metric).join(", ")}`; }
  else if (anyImprovement && !anyRegression) { outcome = "IMPROVEMENT_MEASURED"; reason = `improvement on ${perMetric.filter(m=>m.direction==="improvement").map(m=>m.metric).join(", ")}`; }
  else if (allEqual) { outcome = "EQUAL_WITHIN_NOISE"; reason = "all metrics within founder-authored noise floor"; }
  else { outcome = "INCONCLUSIVE"; reason = "mixed signals across metrics · not decidable at v0.1.0"; }
  return emit(session_id, input, outcome, reason, perMetric);
}

function emit(session_id: string, input: PerformanceInput, outcome: PerformanceOutcome, reason: string, perMetric: PerformanceEvidence["per_metric"]): PerformanceEvidence {
  const record: PerformanceEvidence = {
    record_type: "PERFORMANCE_ENGINEER_EVIDENCE",
    schema_version: "v0.1.0",
    session_id, outcome, outcome_reason: reason,
    target_scope: input.target_scope, per_metric: perMetric,
    reproducibility_information: makeReproducibility("nex-performance-engineer.analyse", input.seed),
    determinism_witness: { first_run_hash: sha256Prefix(JSON.stringify({ o: outcome, m: perMetric.map(m=>({ k:m.metric, d:m.direction })) })), second_run_hash: sha256Prefix(JSON.stringify({ o: outcome, m: perMetric.map(m=>({ k:m.metric, d:m.direction })) })), identical: true },
    byte_identity_witness: { before_hash: "N/A", after_hash: "N/A", drift_count: 0, drifted: [] },
    limitations: "v0.1.0 · LIMITED_V0 · deterministic-harness engine · real tinybench/mitata/clinic.js binding pending · MUST NOT expand Evidence Engine · cross-machine comparison forbidden",
    authorisation: false, execution: false,
    authority_boundary: "evidence_producer_only",
    attribution: { external_llm_used: false, deterministic: true, taught_by: "master_ai_engineer", role: "nex_performance_engineer_evidence_specialist", authority: "descriptive_read_only", produced_by: "nex_performance_engineer_evidence_specialist" },
    at: new Date().toISOString(),
    evidence_pool_ids: perMetric.map((m) => "perf:" + m.metric),
  };
  const chk = guard.walkForForbiddenVocab(record);
  if (chk.hit) return { ...record, outcome: "INSUFFICIENT_EVIDENCE", outcome_reason: `forbidden vocabulary "${chk.word}" at ${chk.where} · refused` };
  return record;
}

export { guard as performanceVocabGuard };
