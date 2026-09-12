// src/lib/nex/programmer-review/types.ts
//
// NEX Programmer Agent · Phase C · review contract types
// Philip 2026-09-05 · AUTHORIZE · PHASE C
//
// Discipline (Op-Truth · Phase C mandate):
//   The implementer does not determine whether the implementation is
//   correct. Claude may claim completion, tests may pass, runtime may
//   look green — none of that alone is authoritative. The reviewer
//   consults REQUIREMENT + IMPLEMENTATION + EVIDENCE + KNOWLEDGE and
//   returns a verdict that can DISAGREE with the implementer.
//
// The reviewer supports exactly five verdicts (§3):

export type ReviewVerdict =
  | "ACCEPT"                   // evidence supports · no material defect
  | "ACCEPT_WITH_WARNINGS"     // supported · non-blocking concerns
  | "NEEDS_CHANGES"            // correctable engineering problem
  | "REJECT"                   // materially incorrect · unsafe · unsupported · violates doctrine
  | "UNCERTAIN";               // available evidence insufficient to establish correctness

// Confidence is INDEPENDENT of verdict (§16).
export type ReviewConfidence = "low" | "medium" | "high";

// Findings distinguish at least these severities (§15).
export type FindingSeverity = "INFO" | "WARNING" | "MATERIAL" | "CRITICAL";

// Finding categories the reviewer understands.
export type FindingCategory =
  | "requirement_mismatch"
  | "test_gap"
  | "test_weakness"
  | "security"
  | "regression"
  | "unsupported_claim"
  | "correctness"
  | "concurrency"
  | "performance"
  | "documentation"
  | "insufficient_evidence"
  | "other";

/** A specific finding raised during review. Every finding must have
 *  actionable content — the reviewer cannot say "looks wrong". */
export type Finding = {
  finding_id: string;
  severity: FindingSeverity;
  category: FindingCategory;
  message: string;               // what is wrong
  rationale: string;             // why it matters
  evidence_pointer: string;      // where the finding was observed
  affected_behavior: string;     // what behavior is affected
  recommended_correction: string;
};

/** Reviewer input · describes an implementation to be reviewed.
 *
 *  The shape is intentionally structured so the reviewer applies
 *  deterministic rules to fields — not free-text reasoning. That
 *  makes verdicts reproducible (§17).
 *
 *  A caller MAY populate any subset; the reviewer treats missing
 *  fields as "evidence not provided" (which may itself contribute
 *  to an UNCERTAIN verdict). */
export type ReviewRequest = {
  review_id: string;
  requirement: string;                          // what SHOULD be true
  implementation: {
    id: string;
    files: string[];
    summary: string;                            // human-authored description
    claim: string;                              // what the implementer asserts
    claimed_by: "claude" | "ollama" | "human" | "system";
  };
  tests: {
    files: string[];
    passed: number;
    failed: number;
    summary: string;                            // what tests actually check
    known_gaps: string[];                       // material gaps in coverage
  };
  runtime_evidence: string[];                   // pointers to logs/probes
  requirement_details: {
    edge_cases_required: string[];              // edge cases the requirement implies
    edge_cases_covered: string[];               // subset actually covered by tests
    security_requirements: string[];            // security constraints
    security_violations_observed: string[];     // known violations (fixture-supplied)
  };
  /** Optional Phase B knowledge ids the reviewer should consult. When
   *  provided, the reviewer records that they were used. */
  relevant_knowledge_ids?: string[];
  /** Optional Phase B skill ids the reviewer should consult (Phase 2 ·
   *  cross-kind extension). Same additive-only discipline as
   *  relevant_knowledge_ids. */
  relevant_skill_ids?: string[];
  /** Optional Phase B experience ids the reviewer should consult
   *  (Phase 2 · cross-kind extension). Same additive-only discipline. */
  relevant_experience_ids?: string[];
  reviewer_timestamp?: string;
};

/** Reviewer output. */
export type ReviewResponse = {
  review_id: string;
  verdict: ReviewVerdict;
  confidence: ReviewConfidence;
  findings: Finding[];
  evidence_inspected: string[];      // what artifacts the reviewer examined
  knowledge_used: string[];           // Phase B knowledge ids consulted
  /** Phase 2 cross-kind additions. */
  skills_used?: string[];             // Phase B skill ids consulted (Phase 2)
  experiences_used?: string[];        // Phase B experience ids consulted (Phase 2)
  reasoning_trace: string[];          // deterministic steps taken
  reviewer_timestamp: string;
};

/** Optional external verdict shape · used to compare adversarial-fixture
 *  expected vs actual · never stored in production. */
export type FixtureExpectation = {
  expected_verdict: ReviewVerdict;
  expected_finding_categories?: FindingCategory[];
  notes?: string;
};

/** Convenience: enumerate every verdict so callers can iterate.
 *  Keeps the union closed at compile-time and enumerable at runtime. */
export const ALL_VERDICTS: readonly ReviewVerdict[] = [
  "ACCEPT",
  "ACCEPT_WITH_WARNINGS",
  "NEEDS_CHANGES",
  "REJECT",
  "UNCERTAIN",
] as const;

export const ALL_SEVERITIES: readonly FindingSeverity[] = [
  "INFO",
  "WARNING",
  "MATERIAL",
  "CRITICAL",
] as const;
