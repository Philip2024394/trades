// src/lib/nex/programmer-improvement/types.ts
//
// NEX Programmer Agent · Phase F · Continuous Improvement types
// Philip 2026-09-06 · AUTHORIZE · PHASE F
//
// Discipline (§3 §22):
//   No self-reported success. Every improvement moves through:
//     OBSERVATION → CANDIDATE → EVALUATION → INDEPENDENT REVIEW →
//     BENCHMARK → DRIFT CHECK → STABILITY → ATTRIBUTION → PROMOTION
//   The learning system CANNOT be the sole authority validating its
//   own learning (§22 · anti-self-reinforcement). The reviewer used at
//   the review stage must be composed from the Phase C module, NOT
//   re-implemented inside Phase F.
//
// Boundary (§10 §11):
//   Phase F may improve KNOWLEDGE, SKILLS, EXPERIENCES, and internal
//   learning records. It may NOT modify production application code,
//   the DB schema, deployment configuration, or any security control.
//   Type unions here reflect that boundary (see PhaseFForbiddenAction
//   at the bottom of the file).

import type {
  KnowledgeItem,
  SkillItem,
  ExperienceItem,
  Provenance,
} from "@/lib/nex/programmer-learning/types";
import type { ReviewResponse, ReviewVerdict } from "@/lib/nex/programmer-review/types";
import type {
  EvaluationRun,
  OverallMetrics,
  ClassMetrics,
  Thresholds,
} from "@/lib/nex/programmer-benchmark/types";
import type {
  VersionManifest,
  DriftReport,
  DriftDirection,
  StabilityRun,
} from "@/lib/nex/programmer-stability/types";

// ─── Candidate kind · what is being improved ─────────────────────

/** Phase F improves ONE of three artifact kinds per candidate.
 *  KNOWLEDGE / SKILL / EXPERIENCE separation (§4) is preserved · a
 *  single candidate never mixes them. */
export type CandidateKind = "knowledge" | "skill" | "experience";

// ─── Candidate lifecycle (§9) ────────────────────────────────────
//
// Closed union · new states require an explicit code change.
// No candidate may jump directly from OBSERVED to PROMOTED.

export type CandidateStatus =
  | "OBSERVED"       // learning event captured · candidate not yet proposed
  | "CANDIDATE"      // candidate proposed with source evidence
  | "EVALUATING"     // benchmark / drift run in progress
  | "REVIEWED"       // independent reviewer produced a verdict
  | "BENCHMARKED"    // benchmark run completed
  | "STABLE"         // stability + fresh-process reproducibility confirmed
  | "PROMOTED"       // verified improvement · appended to durable store
  | "REJECTED"       // evaluation cleanly failed (evidence sufficient · improvement absent)
  | "CONFLICTED"     // evidence disagrees across sources
  | "REGRESSED"      // improvement introduced an unacceptable regression
  | "UNPROVEN"       // evidence insufficient to conclude
  | "FAILED";        // evaluation machinery failed (not the candidate)

/** Ordered lifecycle — each index represents the earliest phase a
 *  status may be observed. Failure states are LATE (only reachable
 *  after enough of the pipeline ran to distinguish them). */
export const CANDIDATE_LIFECYCLE_ORDER: readonly CandidateStatus[] = [
  "OBSERVED",
  "CANDIDATE",
  "EVALUATING",
  "REVIEWED",
  "BENCHMARKED",
  "STABLE",
  "PROMOTED",
] as const;

export const CANDIDATE_FAILURE_STATUSES: readonly CandidateStatus[] = [
  "REJECTED",
  "CONFLICTED",
  "REGRESSED",
  "UNPROVEN",
  "FAILED",
] as const;

// ─── Learning candidate ──────────────────────────────────────────

/** §6 evidence-based learning: a candidate must state its source, the
 *  affected capability, previous state, proposed state, and supporting
 *  evidence. Any missing field triggers UNPROVEN at review time. */
export type LearningCandidate = {
  candidate_id: string;
  kind: CandidateKind;
  /** Source engineering event that produced this candidate. When absent
   *  we consider the candidate provenance-less and the promoter refuses
   *  promotion (§6). */
  source_event_id: string | null;
  /** What was observed. */
  what_was_learned: string;
  /** Why it matters (which capability it affects). */
  affects_capability: string;
  /** Prior state pointer (knowledge/skill/experience id) — null when
   *  this is a fresh addition. */
  previous_state_id: string | null;
  /** Proposed content. Exactly one of these is set, matching `kind`. */
  proposed_knowledge?: KnowledgeItem;
  proposed_skill?: SkillItem;
  proposed_experience?: ExperienceItem;
  /** Supporting evidence pointers (files, URLs, test logs). Must be
   *  non-empty for promotion. */
  supporting_evidence: string[];
  /** Bounded metadata (< 4KB). */
  meta?: Record<string, unknown>;
  /** Provenance of the candidate itself · who proposed it. */
  provenance: Provenance;
  created_at: string;
  /** Content hash · used for duplicate-candidate detection (§23). */
  content_hash: string;
};

// ─── Failure classification ─────────────────────────────────────

/** Independent enum matched 1:1 to the terminal failure states in the
 *  lifecycle. Enables switch-exhaustive downstream reporting. */
export type CandidateFailureReason =
  | "no_source_evidence"
  | "insufficient_evidence"
  | "conflicting_evidence"
  | "review_rejected"
  | "review_needs_changes"
  | "review_uncertain"
  | "benchmark_below_threshold"
  | "per_class_regression"
  | "aggregate_masking_detected"
  | "fingerprint_reproduction_failed"
  | "duplicate_candidate"
  | "machinery_failure";

// ─── Promotion decision ─────────────────────────────────────────
//
// §18 §19 §20 — promotion is deterministic. A single promoter reads:
//   reviewer verdict (Phase C)
//   evaluation metrics (Phase D)
//   drift report (Phase E)
//   candidate provenance
//   fresh-process reproduction proof
//
// … and returns exactly one decision. The promoter has no side effects
// beyond returning the decision; a separate persistence layer applies
// the decision only if PROMOTED.

export type PromotionDecision =
  | {
      status: "PROMOTED";
      reasons: string[];
      review_verdict: ReviewVerdict;
      drift_direction: DriftDirection;
    }
  | {
      status: "REJECTED" | "CONFLICTED" | "REGRESSED" | "UNPROVEN" | "FAILED";
      failure_reason: CandidateFailureReason;
      reasons: string[];
      review_verdict?: ReviewVerdict;
      drift_direction?: DriftDirection;
    };

/** Convenience type-guard for the successful branch. */
export function isPromoted(d: PromotionDecision): d is Extract<PromotionDecision, { status: "PROMOTED" }> {
  return d.status === "PROMOTED";
}

// ─── Improvement run ────────────────────────────────────────────

/** One full pipeline execution for a single candidate. Op-Truth §13:
 *  final_status is ALWAYS null in the persisted record. A separate
 *  verifier reads the append-only log to derive success/failure. */
export type ImprovementRun = {
  run_id: string;
  candidate_id: string;
  candidate_kind: CandidateKind;
  started_at: string;
  completed_at: string | null;
  triggered_by: "manual" | "runner" | "test";
  /** State transitions observed during this run. Append-only ·
   *  duplicates disallowed (guaranteed by the state machine). */
  status_trace: readonly {
    from: CandidateStatus;
    to: CandidateStatus;
    at: string;
    note?: string;
  }[];
  terminal_status: CandidateStatus;
  /** Version manifest captured at run start (attribution surface · §21). */
  manifest_at_start: VersionManifest;
  /** Version manifest captured at run end. Identical to manifest_at_start
   *  unless the promoter applied a knowledge/skill change mid-run — but
   *  since our promoter has no side effects, they always match. */
  manifest_at_end: VersionManifest;
  /** Included only when the run reached BENCHMARKED. Pointer, not
   *  inline body (bodies can be large). */
  benchmark_run_pointer?: string;
  /** Included only when REVIEWED. */
  review_response?: ReviewResponse;
  /** Included only when reached STABLE or later. */
  drift_report?: DriftReport;
  /** Fresh-process reproducibility check (§15 · fingerprint identity
   *  across a spawned subprocess). */
  fresh_process_reproduced?: boolean;
  /** Deterministic decision returned by the promoter. */
  promotion_decision?: PromotionDecision;
  /** Terminal notes: failure reasons, adversarial context. */
  notes: string;
  /** Op-Truth §OP.5 — always null in persisted record. */
  final_status: null;
};

// ─── Improvement history entry ──────────────────────────────────

/** Immutable log entry appended to `improvement_runs.jsonl`. §16
 *  requires historical inspection AND failure-visibility: every
 *  attempt is preserved whether promoted, rejected, or failed. */
export type ImprovementHistoryEntry = Pick<
  ImprovementRun,
  | "run_id"
  | "candidate_id"
  | "candidate_kind"
  | "started_at"
  | "completed_at"
  | "terminal_status"
  | "notes"
  | "final_status"
> & {
  benchmark_run_id?: string;      // pointer to persisted benchmark run
  drift_summary?: {
    fingerprint_identical: boolean;
    overall_direction: DriftDirection;
  };
  promotion_status?: PromotionDecision["status"];
};

// ─── Attribution surface (§13 §21) ──────────────────────────────

/** Complete attribution bundle so any third-party observer can
 *  reproduce the decision. Every field is either an ID or a hash — no
 *  free text influences the promotion outcome. */
export type ImprovementAttribution = {
  run_id: string;
  candidate_id: string;
  candidate_content_hash: string;
  candidate_source_event_id: string | null;
  manifest_at_start: VersionManifest;
  reviewer_verdict?: ReviewVerdict;
  benchmark_pass_flags?: Record<string, boolean>;
  drift_direction?: DriftDirection;
  fresh_process_reproduced?: boolean;
  final_status: null;
};

// ─── Phase F thresholds ─────────────────────────────────────────

/** §7 §8 measurable thresholds. Same conservative defaults as Phase E
 *  · Phase F must not silently relax them. */
export type ImprovementThresholds = {
  /** Reuses Phase E stability thresholds — regression rejection MUST
   *  apply per-class, not per-aggregate (§8). */
  per_class_min_catch_rate: number;
  max_false_positive_rate: number;
  tests_pass_but_code_wrong_min_catch_rate: number;
  min_uncertainty_accuracy: number;
  /** Required to be true — fingerprint identity across identical runs
   *  is not optional. */
  require_fresh_process_reproducibility: boolean;
  /** Reviewer verdicts that are permitted for promotion. NEEDS_CHANGES
   *  and REJECT are always disqualifying. UNCERTAIN blocks promotion
   *  per §14 (returns UNPROVEN). */
  allowed_review_verdicts_for_promotion: readonly ReviewVerdict[];
};

export const DEFAULT_IMPROVEMENT_THRESHOLDS: ImprovementThresholds = {
  per_class_min_catch_rate: 0.80,
  max_false_positive_rate: 0.10,
  tests_pass_but_code_wrong_min_catch_rate: 0.80,
  min_uncertainty_accuracy: 0.80,
  require_fresh_process_reproducibility: true,
  allowed_review_verdicts_for_promotion: ["ACCEPT", "ACCEPT_WITH_WARNINGS"] as const,
};

// ─── Phase F forbidden actions (§10 §11 §12) ────────────────────
//
// Type-level marker enumerating what Phase F is NEVER allowed to do.
// A dedicated audit test asserts no exported symbol whose name matches
// these prefixes exists in the phase-F surface.

export type PhaseFForbiddenAction =
  // Autonomy escalation
  | "createScheduler"
  | "createCron"
  | "createWatcher"
  | "createDaemon"
  | "startBackgroundLoop"
  | "start24x7Loop"
  // Production authority
  | "commit"
  | "deploy"
  | "modifyProduction"
  | "grantAccess"
  | "createAccount"
  // Database mutation
  | "alterDatabaseSchema"
  | "mutateProductionDatabase"
  // Self-reinforcement (§22)
  | "selfValidateWithoutIndependentReviewer"
  | "promoteWithoutBenchmark"
  | "promoteWithoutStabilityCheck"
  // Cross-agent boundary (Two-Agent Separation Contract 2026-09-06)
  | "modifyAccommodationData"
  | "callAccommodationAdapter"
  | "activateAccommodationWorkforce";

/** Convenience: enumerate every non-failure lifecycle state at runtime. */
export const ALL_CANDIDATE_STATUSES: readonly CandidateStatus[] = [
  ...CANDIDATE_LIFECYCLE_ORDER,
  ...CANDIDATE_FAILURE_STATUSES,
] as const;
