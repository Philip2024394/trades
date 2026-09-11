// src/lib/nex/truth-engine/verifier/types.ts
//
// Truth Engine Verifier · Stage 1a skeleton · core types.
//
// Founder-authorised sub-step 1a.3 · 2026-09-11.
// Doctrine: ADR-0314e (verifier · Gate 3 CANDIDATE) + R-18.v1.0.0 (verifier
// envelope) + R-DOMAIN-01 (three-axis) + §7.7 H1 (`unknown` ≠ `false`).
//
// This file defines the TYPES only. No runtime logic. No database access.
// No AUTHORITATIVE promotion. No Guardian rule installation. No fixture
// population. Verifier is a pure function: VerifierInput → VerdictEnvelope.

/**
 * Verdict kinds · deterministic per §7.7 H1 + §7.6.5 G4 + R-07 doctrine.
 *
 * PASS / FAIL / UNKNOWN are the three canonical outcomes for evaluation
 * rules. CANDIDATE_FLAG surfaces subjective-tier findings for founder
 * review (never auto-promoted). CONTRADICTION_RECORDED indicates R-20
 * detected a deterministic contradiction between claims.
 *
 * IMPORTANT: `UNKNOWN` is a legitimate deterministic verdict per §7.7 H1.
 * It is DISTINCT from `FAIL`. Silent conversion between them is forbidden
 * (G-2 non-bypass violation per R-DOMAIN-01).
 */
export type VerdictKind =
  | "PASS"
  | "FAIL"
  | "UNKNOWN"
  | "CANDIDATE_FLAG"
  | "CONTRADICTION_RECORDED";

/**
 * Per-rule verdict produced by a registered RuleModule. Carries the
 * rule identifier, the rule version, the verdict kind, and an optional
 * named fail-closed reason string (per §7.7 H1 · every fail-closed reason
 * is named · never silent).
 */
export interface RuleVerdict {
  ruleId: string;                // e.g. "R-01" · "R-03" · "R-05" · "R-11" · "R-18" · "R-20"
  ruleVersion: string;           // e.g. "R-01.v1.0.0"
  verdict: VerdictKind;
  reason: string | null;         // named fail-closed reason if UNKNOWN · FAIL detail if applicable · null when PASS with no reason
  evidenceRefs: readonly string[]; // opaque provenance identifiers · never fabricated
  thresholdVersion?: string;     // e.g. "plausibility_threshold.v1.0.0" for R-01 · "confidence_band_derivation.v1.0.0" for R-11
  candidateFlagPayload?: Readonly<Record<string, unknown>>; // subjective-tier only · founder review data
}

/**
 * VerifierInput · the deterministic input to `verify()`. Contains
 * enough context for rule modules to evaluate a row without side effects.
 *
 * All fields are READ-ONLY. Verifier does not mutate the input.
 */
export interface VerifierInput {
  /** Snapshot reference identifying the object being verified.
   *  Opaque to the verifier · consumers pass e.g. row UUID · Bridge ID · fixture ID. */
  readonly objectSnapshotRef: string;

  /** Structural object shape · exact contents depend on the LAM Object Type. */
  readonly objectSnapshot: Readonly<Record<string, unknown>>;

  /** Provenance/evidence references attached to this input. */
  readonly evidenceRefs: readonly string[];

  /** Optional context data available to rule modules · never mutated. */
  readonly context?: Readonly<Record<string, unknown>>;
}

/**
 * VerdictEnvelope · the R-18 verdict envelope per ADR-0314e Section 4.
 *
 * Composed from:
 *   - verifier_instance_id (deterministic per verifier deploy · fixed at construction)
 *   - rule_set_version (composed manifest from individual rule versions)
 *   - guardian_version (from guardian config)
 *   - authorisation_policy_ref (NULLABLE · null at Stage 1 · Stage 2 R-10 fills)
 *   - truth_engine_ok (aggregate boolean · NOT promotion to AUTHORITATIVE)
 *   - per_rule_verdicts (individual RuleVerdict entries)
 *   - verdict_at (ISO-8601 timestamp)
 *
 * IMPORTANT: authorisation_policy_ref is `string | null`. The Stage 1
 * verifier ALWAYS produces `null` here. Non-null values are only
 * legitimate when Stage 2 R-10 policies are wired · which does not
 * happen in this skeleton.
 */
export interface VerdictEnvelope {
  readonly verifierInstanceId: string;
  readonly ruleSetVersion: string;
  readonly guardianVersion: string;
  readonly authorisationPolicyRef: string | null;
  readonly truthEngineOk: boolean;
  readonly perRuleVerdicts: readonly RuleVerdict[];
  readonly objectSnapshotRef: string;
  readonly evidenceRefs: readonly string[];
  readonly verdictAt: string; // ISO-8601
}

/**
 * RuleModule · the interface every R-XX rule module must implement to
 * plug into the verifier pipeline.
 *
 * Rule modules are PURE FUNCTIONS. They take VerifierInput and return
 * a RuleVerdict. They MUST NOT:
 *   - Write to any database (production or nex_test.*)
 *   - Install Guardian rules
 *   - Promote anything to AUTHORITATIVE
 *   - Adjust their own thresholds based on observation
 *   - Reference constitutional policy values not authored by founder
 *
 * Rule modules PLUG IN at construction time via `createVerifier({ rules })`.
 * Ordering of registered rules is preserved but does not doctrinally
 * constrain execution order (per R-10 gate model 2026-09-11 · gate
 * semantics locked · implementation ordering delegated).
 */
export interface RuleModule {
  readonly ruleId: string;
  readonly ruleVersion: string;
  evaluate(input: VerifierInput): RuleVerdict;
}

/**
 * VerifierConfig · construction-time configuration for the verifier.
 *
 * verifierInstanceId is deterministic per verifier deploy (fixed at
 * process start · same for every verdict produced by that instance).
 * guardianVersion is the version of the Guardian rule set in force.
 * rules is the ordered set of RuleModule instances plugged into the
 * pipeline.
 */
export interface VerifierConfig {
  readonly verifierInstanceId: string;
  readonly guardianVersion: string;
  readonly rules: readonly RuleModule[];
}

/**
 * Aggregation policy · how per-rule verdicts combine into truth_engine_ok.
 *
 * DEFAULT: all-must-pass semantics (any FAIL / CONTRADICTION_RECORDED
 * blocks truth_engine_ok; UNKNOWN blocks truth_engine_ok per R-07
 * doctrine `unknown ≠ false` but `unknown` still fails-closed at the
 * aggregate; CANDIDATE_FLAG is neutral · does not block).
 *
 * This aggregation is DETERMINISTIC. Same rule verdicts → same
 * truth_engine_ok.
 */
export type AggregationPolicy = "all_must_pass";
