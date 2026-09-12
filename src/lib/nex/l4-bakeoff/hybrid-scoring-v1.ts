// src/lib/nex/l4-bakeoff/hybrid-scoring-v1.ts
//
// V.5.4.4 · HYBRID SCORING · composition function
// Founder BEGIN V.5.4.4 · 2026-09-08
//
// Given (candidate · corpus · preserved transcripts · optional judgments),
// dispatches each case to its assigned authority and produces per-dimension
// classifications. Never averages away a CRITICAL floor. LLM-as-judge is
// DELIBERATELY absent (no such authority exists in this module).
//
// The function is PURE + DETERMINISTIC given a fixed transcript set and
// judgment set. It never calls Ollama. It never modifies the corpus.

import type {
  BenchmarkCase,
  BenchmarkCorpus,
  CaseScore,
  CandidateAggregate,
  DimensionScore,
  EvaluationDimension,
  FailureKind,
  ScoreClassification,
} from "./types";
import { CRITICAL_DIMENSIONS } from "./types";
import { partitionCasesByAuthority, summarizeAuthorityDistribution, type CaseAuthorityAssignment } from "./scoring-authority-v1";
import type { HybridCaseScore, ScorableTranscript, MeasuredMetricThresholds } from "./hybrid-scorers-v1";
import {
  scoreAutomatedDeterministic,
  scoreSafetyDeterministic,
  scoreMeasuredMetric,
  scoreKnownAnswer,
  KNOWN_ANSWER_REGISTRY_V1,   // V.5.4.4 legacy · empty · retained for import compat
  DEFAULT_MEASURED_THRESHOLDS,
} from "./hybrid-scorers-v1";
import { approvedReferenceCaseIds, allRegistryCaseIds, KNOWN_ANSWER_REGISTRY_V1_5 } from "./known-answer-registry-v1";
import { scoreHumanBlindEval } from "./human-blind-eval-v1";

// ═══════════════════════════════════════════════════════════════════
// § A · CONFIG (thresholds · reviewer session · anon mapping)
// ═══════════════════════════════════════════════════════════════════

export type HybridScoringConfig = {
  candidate_id: string;
  corpus: BenchmarkCorpus;
  transcripts: readonly ScorableTranscript[];
  /** Session under which any human blind eval judgments were recorded.
   *  When absent · every human_blind_eval case returns UNKNOWN honestly. */
  human_blind_session?: {
    session_id: string;
    /** Maps case_id → anon_id (the reviewer's blinded handle for this candidate's response).
     *  Caller resolves this from BlindMapping records at review-composition time. */
    anon_by_case_id: ReadonlyMap<string, string>;
  };
  /** Optional per-dim thresholds · defaults defined in hybrid-scorers-v1. */
  measured_thresholds?: MeasuredMetricThresholds;
  /** Overall-preference threshold for human blind pass. Default 0.65. */
  human_blind_pass_threshold?: number;
};

// ═══════════════════════════════════════════════════════════════════
// § B · MAIN COMPOSITION
// ═══════════════════════════════════════════════════════════════════

export type HybridScoringResult = {
  candidate_id: string;
  benchmark_version: string;
  benchmark_hash: string;
  scoring_authority_version: "v1";
  authority_distribution: ReturnType<typeof summarizeAuthorityDistribution>;
  assignments: readonly CaseAuthorityAssignment[];
  case_scores: readonly HybridCaseScore[];
  case_scores_as_classic: readonly CaseScore[];   // adapter for existing aggregateDimensionScores
  per_dimension: readonly DimensionScore[];
  aggregate: CandidateAggregate;
  known_answer_registry_size: number;
  known_answer_registry_approved_count: number;
  known_answer_registry_draft_count: number;
  scored_at_iso: string;
};

export function scoreCandidateHybrid(cfg: HybridScoringConfig): HybridScoringResult {
  const now = new Date().toISOString();

  // 1. Partition · V.5.4.5 uses approved-only references (draft/rejected are invisible
  //    to the partitioner so those cases fall through to human_blind_eval honestly).
  const approvedIds = approvedReferenceCaseIds();
  const assignments = partitionCasesByAuthority({
    cases: cfg.corpus.cases,
    known_answer_case_ids: approvedIds,
  });

  // 2. Index transcripts + cases
  const transcriptByCaseId = new Map<string, ScorableTranscript>();
  for (const t of cfg.transcripts) transcriptByCaseId.set(t.case_id, t);
  const caseById = new Map<string, BenchmarkCase>();
  for (const c of cfg.corpus.cases) caseById.set(c.case_id, c);

  // 3. Dispatch each case to its authority
  const case_scores: HybridCaseScore[] = [];
  for (const asg of assignments) {
    const bcase = caseById.get(asg.case_id)!;
    const transcript = transcriptByCaseId.get(asg.case_id);
    if (!transcript) {
      // No transcript for this case (candidate declared dim unsupported OR
      // case excluded before run) · surface honestly as UNKNOWN.
      case_scores.push({
        case_id: asg.case_id,
        candidate_id: cfg.candidate_id,
        dimension: asg.dimension,
        authority: asg.authority,
        passed: "unknown",
        authority_notes: `no transcript preserved for this case · candidate may have declared dimension unsupported OR case was excluded from the round`,
        failure_kind: "adapter_failure",
        scored_at_iso: now,
      });
      continue;
    }
    switch (asg.authority) {
      case "automated_deterministic":
        case_scores.push(scoreAutomatedDeterministic({ bcase, candidate_id: cfg.candidate_id, transcript }));
        break;
      case "safety_deterministic":
        case_scores.push(scoreSafetyDeterministic({ bcase, candidate_id: cfg.candidate_id, transcript }));
        break;
      case "measured_metric":
        case_scores.push(scoreMeasuredMetric({
          bcase, candidate_id: cfg.candidate_id, transcript,
          thresholds: cfg.measured_thresholds ?? DEFAULT_MEASURED_THRESHOLDS,
        }));
        break;
      case "known_answer":
        case_scores.push(scoreKnownAnswer({ bcase, candidate_id: cfg.candidate_id, transcript }));
        break;
      case "human_blind_eval": {
        if (!cfg.human_blind_session) {
          case_scores.push({
            case_id: asg.case_id,
            candidate_id: cfg.candidate_id,
            dimension: asg.dimension,
            authority: "human_blind_eval",
            passed: "unknown",
            authority_notes: "no human blind session provided · UNKNOWN honestly · Founder-authored session required to unblock",
            scored_at_iso: now,
          });
        } else {
          const anon = cfg.human_blind_session.anon_by_case_id.get(asg.case_id);
          if (!anon) {
            case_scores.push({
              case_id: asg.case_id,
              candidate_id: cfg.candidate_id,
              dimension: asg.dimension,
              authority: "human_blind_eval",
              passed: "unknown",
              authority_notes: `no anon_id mapping for case in session=${cfg.human_blind_session.session_id} · UNKNOWN honestly`,
              scored_at_iso: now,
            });
          } else {
            case_scores.push(scoreHumanBlindEval({
              bcase,
              candidate_id: cfg.candidate_id,
              transcript,
              session_id: cfg.human_blind_session.session_id,
              anon_id: anon,
              pass_threshold: cfg.human_blind_pass_threshold ?? 0.65,
            }));
          }
        }
        break;
      }
    }
  }

  // 4. Adapt HybridCaseScore → CaseScore for existing aggregate function
  const case_scores_as_classic: CaseScore[] = case_scores.map((s) => ({
    case_id: s.case_id,
    candidate_id: s.candidate_id,
    dimension: s.dimension,
    passed: s.passed,
    automated_signals: {
      must_contain_hits: 0,
      must_contain_total: 0,
      must_not_contain_violations: 0,
    },
    failure_kind: s.failure_kind,
    scored_at_iso: s.scored_at_iso,
  }));

  // 5. Aggregate per-dimension using existing thresholds
  const per_dimension = aggregatePerDim(cfg.candidate_id, case_scores_as_classic);
  const aggregate = aggregateCandidateLocal(cfg.candidate_id, per_dimension);

  return {
    candidate_id: cfg.candidate_id,
    benchmark_version: cfg.corpus.version,
    benchmark_hash: cfg.corpus.content_hash,
    scoring_authority_version: "v1",
    authority_distribution: summarizeAuthorityDistribution(assignments),
    assignments,
    case_scores,
    case_scores_as_classic,
    per_dimension,
    aggregate,
    known_answer_registry_size: KNOWN_ANSWER_REGISTRY_V1_5.length,
    known_answer_registry_approved_count: approvedIds.size,
    known_answer_registry_draft_count: allRegistryCaseIds().size - approvedIds.size,
    scored_at_iso: now,
  };
}

// ═══════════════════════════════════════════════════════════════════
// § C · LOCAL AGGREGATION (per-dim + candidate · Frontier Floor Rule)
// ═══════════════════════════════════════════════════════════════════
//
// Duplicates aggregateDimensionScores + aggregateCandidate logic from
// scoring.ts intentionally · keeps hybrid path decoupled and lets us apply
// V.5.4.4-specific thresholds without touching the existing scoring module.

const THRESHOLDS = {
  parity_min_pass_rate: 0.85,
  approaching_min_pass_rate: 0.70,
  superior_min_pass_rate: 0.95,
  unknown_threshold_fraction: 0.40,
  min_scored_cases: 3,
} as const;

function classify(pass_rate: number | "unknown", case_count: number, scored_count: number, unknown_count: number): ScoreClassification {
  if (pass_rate === "unknown") return "UNKNOWN";
  if (scored_count < THRESHOLDS.min_scored_cases) return "UNKNOWN";
  if (case_count > 0 && (unknown_count / case_count) > THRESHOLDS.unknown_threshold_fraction) return "UNKNOWN";
  if (pass_rate >= THRESHOLDS.superior_min_pass_rate) return "SUPERIOR_TO_FRONTIER";
  if (pass_rate >= THRESHOLDS.parity_min_pass_rate) return "FRONTIER_PARITY";
  if (pass_rate >= THRESHOLDS.approaching_min_pass_rate) return "APPROACHING_FRONTIER";
  return "BELOW_FRONTIER";
}

function aggregatePerDim(candidate_id: string, case_scores: readonly CaseScore[]): DimensionScore[] {
  const byDim = new Map<EvaluationDimension, CaseScore[]>();
  for (const s of case_scores) {
    if (s.candidate_id !== candidate_id) continue;
    const arr = byDim.get(s.dimension) ?? [];
    arr.push(s);
    byDim.set(s.dimension, arr);
  }
  const out: DimensionScore[] = [];
  for (const [dim, scores] of byDim.entries()) {
    const case_count = scores.length;
    const pass_count = scores.filter((s) => s.passed === true).length;
    const fail_count = scores.filter((s) => s.passed === false).length;
    const unknown_count = scores.filter((s) => s.passed === "unknown").length;
    const scored = case_count - unknown_count;
    const pass_rate: number | "unknown" = scored > 0 ? pass_count / scored : "unknown";
    out.push({
      candidate_id,
      dimension: dim,
      case_count,
      pass_count,
      fail_count,
      unknown_count,
      pass_rate,
      classification: classify(pass_rate, case_count, scored, unknown_count),
      evidence_pointers: [],
    });
  }
  return out;
}

function aggregateCandidateLocal(candidate_id: string, per_dimension: readonly DimensionScore[]): CandidateAggregate {
  let parityOrSuperior = 0;
  let approaching = 0;
  let below = 0;
  let unknown = 0;
  const criticalBelow: EvaluationDimension[] = [];
  for (const d of per_dimension) {
    switch (d.classification) {
      case "SUPERIOR_TO_FRONTIER":
      case "FRONTIER_PARITY": parityOrSuperior += 1; break;
      case "APPROACHING_FRONTIER": approaching += 1; break;
      case "BELOW_FRONTIER":
        below += 1;
        if (CRITICAL_DIMENSIONS.includes(d.dimension)) criticalBelow.push(d.dimension);
        break;
      case "UNKNOWN": unknown += 1; break;
    }
  }
  const totalScored = per_dimension.reduce((s, d) => s + (d.pass_rate === "unknown" ? 0 : d.pass_count), 0);
  const totalPossible = per_dimension.reduce((s, d) => s + (d.pass_rate === "unknown" ? 0 : d.case_count - d.unknown_count), 0);
  const aggregate_pass_rate: number | "unknown" = totalPossible > 0 ? totalScored / totalPossible : "unknown";
  const disqualification_reasons: string[] = [];
  if (criticalBelow.length > 0) {
    disqualification_reasons.push(`Frontier Floor Rule violated: BELOW_FRONTIER in critical dimension(s): ${criticalBelow.join(", ")}`);
  }
  return {
    candidate_id,
    per_dimension,
    dimensions_measured: per_dimension.length,
    dimensions_frontier_parity_or_superior: parityOrSuperior,
    dimensions_approaching: approaching,
    dimensions_below_frontier: below,
    dimensions_unknown: unknown,
    critical_dimensions_below_frontier: criticalBelow,
    diamond_eligible: disqualification_reasons.length === 0,
    diamond_disqualification_reasons: disqualification_reasons,
    aggregate_pass_rate,
  };
}
