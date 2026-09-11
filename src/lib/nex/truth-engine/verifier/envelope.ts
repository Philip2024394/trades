// src/lib/nex/truth-engine/verifier/envelope.ts
//
// Truth Engine Verifier · Stage 1a · Envelope construction (R-18).
//
// Founder-authorised sub-step 1a.3 · 2026-09-11.
// Doctrine: R-18.v1.0.0 (verifier envelope) + ADR-0314e Section 4.
//
// Constitutional invariants enforced here:
//   1. Every envelope carries verifier_instance_id + rule_set_version +
//      guardian_version. R-18 requires all three per verdict.
//   2. authorisation_policy_ref is ALWAYS null at Stage 1a. Stage 2 R-10
//      wires this field. Non-null values here would violate the
//      Stage 1a → Stage 1b → Stage 2 sequencing (per D-Impl).
//   3. truth_engine_ok is derived deterministically from per-rule verdicts
//      per the AggregationPolicy · same inputs → same output.

import type {
  AggregationPolicy,
  RuleVerdict,
  VerdictEnvelope,
  VerifierConfig,
  VerifierInput,
} from "./types";
import { composeRuleSetVersion } from "./version-manifest";

/**
 * Compute truth_engine_ok from a set of per-rule verdicts using the
 * specified aggregation policy. DETERMINISTIC.
 *
 * DEFAULT `all_must_pass`:
 *   - PASS: passes
 *   - CANDIDATE_FLAG: passes (subjective tier · never blocks)
 *   - UNKNOWN: fails aggregate (fail-closed per §7.7 H1 + R-07 doctrine)
 *   - FAIL: fails aggregate
 *   - CONTRADICTION_RECORDED: fails aggregate
 *
 * Rationale: at aggregate level, UNKNOWN cannot promote to truth_engine_ok
 * because we cannot certify a row that has unresolved verdicts. This does
 * NOT convert UNKNOWN to FAIL (per §7.7 H1 forbids silent conversion) · it
 * simply means the aggregate cannot be certified true.
 */
export function computeTruthEngineOk(
  perRuleVerdicts: readonly RuleVerdict[],
  policy: AggregationPolicy = "all_must_pass",
): boolean {
  if (policy !== "all_must_pass") {
    // Only one policy currently authored. Future policies require a
    // founder-authored versioning-policy ADR (per D-17 amendment pattern).
    throw new Error(
      `Unknown aggregation policy: ${policy}. Only "all_must_pass" is currently authored.`,
    );
  }
  if (perRuleVerdicts.length === 0) {
    // No registered rules · vacuously false (cannot certify without evaluation).
    return false;
  }
  for (const v of perRuleVerdicts) {
    if (v.verdict === "PASS" || v.verdict === "CANDIDATE_FLAG") continue;
    return false;
  }
  return true;
}

/**
 * Construct a VerdictEnvelope from an input, config, and computed
 * per-rule verdicts. R-18 envelope shape enforced at the type level.
 *
 * IMPORTANT: `authorisationPolicyRef` is ALWAYS null. Stage 2 R-10
 * wires this field · not this skeleton.
 */
export function buildEnvelope(
  input: VerifierInput,
  config: VerifierConfig,
  perRuleVerdicts: readonly RuleVerdict[],
  policy: AggregationPolicy = "all_must_pass",
  clock: () => string = defaultClock,
): VerdictEnvelope {
  const ruleSetVersion = composeRuleSetVersion(config.rules);
  const truthEngineOk = computeTruthEngineOk(perRuleVerdicts, policy);
  return {
    verifierInstanceId: config.verifierInstanceId,
    ruleSetVersion,
    guardianVersion: config.guardianVersion,
    authorisationPolicyRef: null, // Stage 1a · always null · Stage 2 R-10 wires this
    truthEngineOk,
    perRuleVerdicts,
    objectSnapshotRef: input.objectSnapshotRef,
    evidenceRefs: input.evidenceRefs,
    verdictAt: clock(),
  };
}

/**
 * Default clock returns ISO-8601 UTC. Injectable for deterministic
 * tests (fixture runs use a fixed timestamp so verdicts are byte-identical
 * across reproducibility runs).
 */
function defaultClock(): string {
  return new Date().toISOString();
}
